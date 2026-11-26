'use strict';
/*
 * Fila de prioridade da ilha.
 *
 * Só cabe uma coisa por vez na linha fechada da ilha, e é este módulo que
 * escolhe qual. Ele é puro de propósito — nada de Electron, nada de relógio
 * próprio: recebe as fontes e o instante e devolve o estado. Assim dá para
 * testar cada regra com `node --test` e o processo principal só faz a fiação.
 *
 * Ordem (a de cima ganha):
 *   0. indicador (volume, brilho, teclas, microfone) — 1,6s, no lugar do aviso
 *      do Windows; é resposta a um gesto da pessoa, então passa na frente
 *   0b. notificação de outro app (WhatsApp, Discord, e-mail) — 6s
 *   1. lembrete vencido e não resolvido   — fica até ser resolvido
 *   1b. água / levantar                   — esperam o bloco de foco acabar
 *   2. pulso do player                    — 3s quando a faixa muda; silenciado
 *                                           durante o foco, que existe para não
 *                                           ser interrompido
 *   3. timer de foco rodando
 *   4. próximo compromisso a 30 min ou menos
 *   5. repouso                            — capa, data e hora
 *
 * Só lembrete crítico pede para a ilha furar as janelas (`raise`); os outros
 * esperam atrás delas e acumulam.
 */

const PULSE_MS = 3000;
const INDICATOR_MS = 1600;
const INDICATOR_KINDS = ['volume', 'brightness', 'mic', 'caps', 'num'];
const NOTIF_MS = 6000;

/** Notificação de outro app ainda no ar, já limpa; null se passou. */
function liveNotification(raw, now) {
  if (!raw || typeof raw !== 'object') return null;
  const at = finite(raw.at);
  const app = text(raw.app).slice(0, 60);
  if (at === null || !app || now < at || now - at >= NOTIF_MS) return null;
  return { app, title: text(raw.title).slice(0, 120), body: text(raw.body).slice(0, 160), at };
}

/** Indicador ainda valendo, já limpo; null se passou ou não tem forma certa. */
function liveIndicator(raw, now) {
  if (!raw || typeof raw !== 'object' || !INDICATOR_KINDS.includes(raw.kind)) return null;
  const at = finite(raw.at);
  if (at === null || now < at || now - at >= INDICATOR_MS) return null;
  const lv = finite(raw.level);
  return {
    kind: raw.kind,
    level: lv === null ? null : Math.max(0, Math.min(1, lv)),
    muted: raw.muted === true,
    on: raw.on === true,
    at,
  };
}
const NEXT_WINDOW_MS = 30 * 60 * 1000;
const FRESH_MS = 60 * 1000; // até aqui um lembrete é "agora"; depois, o horário

const URGENCIES = ['low', 'medium', 'high', 'critical'];
const MAX_TEXT = 200;
const MAX_REMINDERS = 50;

/* Ordem padrão das setas; a pessoa pode reordenar e desligar qualquer uma
   (água liga junto com o lembrete de água). Se tudo ficar desligado, "hoje"
   volta: o painel aberto nunca fica vazio. */
const PAGE_ORDER = ['hoje', 'player', 'foco', 'lembretes', 'agua', 'captura'];
const TOGGLEABLE = ['hoje', 'player', 'foco', 'lembretes', 'captura'];

/** Ordem pedida, sem repetição nem desconhecidas; o que faltar entra no fim. */
function normalizeOrder(order) {
  const seen = new Set();
  const out = [];
  for (const k of Array.isArray(order) ? order : []) {
    if (PAGE_ORDER.includes(k) && !seen.has(k)) { seen.add(k); out.push(k); }
  }
  for (const k of PAGE_ORDER) if (!seen.has(k)) out.push(k);
  return out;
}

/* Ao abrir a ilha, em que seção ela entra conforme a linha que estava no ar. */
const ENTRY_PAGE = {
  lembrete: 'lembretes',
  player: 'player',
  foco: 'foco',
  proxima: 'hoje',
  repouso: 'hoje',
  agua: 'agua',
  levantar: 'hoje',
  indicador: 'hoje',
  notif: 'hoje',
};

/* Bem-estar já resolvido pelo wellness.cjs; aqui só confere a forma. */
function sanitizeWellness(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const d = src.due && typeof src.due === 'object' ? src.due : {};
  const sm = src.summary && typeof src.summary === 'object' ? src.summary : {};
  const water = (o) => o && typeof o === 'object' && finite(o.goalMl) !== null
    ? { ml: Math.max(0, finite(o.ml) || 0), goalMl: o.goalMl, cupMl: Math.max(0, finite(o.cupMl) || 0) }
    : null;
  const stand = (o) => o && typeof o === 'object' && finite(o.sittingMin) !== null
    ? { sittingMin: Math.max(0, Math.floor(o.sittingMin)), afterMin: finite(o.afterMin) }
    : null;
  return {
    due: { water: water(d.water), stand: stand(d.stand) },
    summary: { water: water(sm.water), stand: stand(sm.stand) },
  };
}

function pad(n) {
  return (n < 10 ? '0' : '') + n;
}

/** "14:02" no fuso da máquina — é o horário que o usuário vê no relógio dele. */
function hhmm(ms) {
  const d = new Date(ms);
  return pad(d.getHours()) + ':' + pad(d.getMinutes());
}

function text(v) {
  return typeof v === 'string' ? v.trim().slice(0, MAX_TEXT) : '';
}

function finite(v) {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function urgency(v) {
  return URGENCIES.includes(v) ? v : 'medium';
}

/**
 * Limpa o retrato que chega do renderer por IPC. Tudo que não tiver a forma
 * esperada some aqui, para o resolvedor não precisar desconfiar de nada.
 */
function sanitizeSources(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};

  const reminders = (Array.isArray(src.reminders) ? src.reminders : [])
    .map(r => ({
      id: text(r && r.id),
      taskId: text(r && r.taskId),
      title: text(r && r.title),
      urgency: urgency(r && r.urgency),
      firedAt: finite(r && r.firedAt),
    }))
    .filter(r => r.id && r.title && r.firedAt !== null)
    .slice(0, MAX_REMINDERS);

  let next = null;
  if (src.next && typeof src.next === 'object') {
    const title = text(src.next.title);
    const dueAt = finite(src.next.dueAt);
    if (title && dueAt !== null) {
      next = { id: text(src.next.id), title, dueAt, urgency: urgency(src.next.urgency) };
    }
  }

  let focus = null;
  if (src.focus && typeof src.focus === 'object') {
    focus = {
      running: src.focus.running === true,
      kind: src.focus.kind === 'stopwatch' ? 'stopwatch' : 'pomodoro',
      mode: src.focus.mode === 'break' ? 'break' : 'work',
      long: src.focus.mode === 'break' && src.focus.long === true,
      endsAt: finite(src.focus.endsAt),
      /* pausado: quanto sobra; o tamanho do bloco serve ao anel de progresso */
      leftMs: Math.max(0, finite(src.focus.leftMs) || 0),
      totalMs: Math.max(0, finite(src.focus.totalMs) || 0),
      /* cronômetro livre: conta para cima a partir daqui */
      startedAt: finite(src.focus.startedAt),
      taskTitle: text(src.focus.taskTitle),
      cycles: Math.max(0, Math.floor(finite(src.focus.cycles) || 0)),
    };
  }

  const day = src.day && typeof src.day === 'object' ? src.day : {};
  const total = Math.max(0, Math.floor(finite(day.total) || 0));
  const done = Math.min(total, Math.max(0, Math.floor(finite(day.done) || 0)));

  return { reminders, next, focus, day: { done, total } };
}

/** O que vier de fora é ligado, menos o que estiver explicitamente `false`. */
function normalizeSections(sections) {
  const on = {};
  for (const k of TOGGLEABLE) on[k] = !(sections && sections[k] === false);
  return on;
}

/** Críticos sempre na frente; dentro de cada grupo, o mais recente primeiro. */
function sortReminders(list) {
  return list.slice().sort((a, b) => {
    const ca = a.urgency === 'critical' ? 1 : 0;
    const cb = b.urgency === 'critical' ? 1 : 0;
    if (ca !== cb) return cb - ca;
    return b.firedAt - a.firedAt;
  });
}

/*
 * A linha fechada dos lembretes:
 *   - um só: o título, e "agora" ou o horário em que venceu;
 *   - vários com um crítico: o crítico, que foi quem interrompeu, e "+N";
 *   - vários comuns: quantos e desde quando — é o que importa ao voltar.
 */
function reminderLine(list, now) {
  const top = list[0];
  const n = list.length;
  const critical = top.urgency === 'critical';
  if (n === 1) {
    return {
      kind: 'lembrete', critical, count: 1, title: top.title,
      meta: now - top.firedAt < FRESH_MS ? 'agora' : hhmm(top.firedAt),
    };
  }
  if (critical) {
    return { kind: 'lembrete', critical: true, count: n, title: top.title, meta: '+' + (n - 1) };
  }
  const oldest = Math.min.apply(null, list.map(r => r.firedAt));
  return {
    kind: 'lembrete', critical: false, count: n,
    title: n + ' lembretes esperando', meta: 'desde ' + hhmm(oldest),
  };
}

/**
 * Resolve o estado da ilha.
 *
 * @param {object}  input
 * @param {object}  input.sources   retrato do renderer (passa por sanitizeSources)
 * @param {object}  [input.player]  { title, artist, playing, trackChangedAt } — vem do SMTC
 * @param {object}  [input.sections] seções ligadas nas configurações
 * @param {number}  input.now
 */
function resolve(input) {
  const opts = input || {};
  const now = finite(opts.now) !== null ? opts.now : Date.now();
  const src = sanitizeSources(opts.sources);
  const on = normalizeSections(opts.sections);
  const p = opts.player && typeof opts.player === 'object' ? opts.player : null;

  const reminders = on.lembretes ? sortReminders(src.reminders) : [];
  const focusRunning = on.foco && !!(src.focus && src.focus.running);
  const well = sanitizeWellness(opts.wellness);
  /* Durante um bloco de foco, água e levantar esperam a pausa — o foco existe
     para não ser interrompido. Na pausa eles caem bem. */
  const focusWork = focusRunning && src.focus.mode === 'work';
  const standDue = !focusWork ? well.due.stand : null;
  const waterDue = !focusWork ? well.due.water : null;
  const playing = on.player && !!(p && p.playing && text(p.title));
  const changedAt = playing ? finite(p.trackChangedAt) : null;
  /* O pulso de faixa nova é o indicador "músicas": dá para desligar. */
  const pulse = opts.mediaPulse !== false && changedAt !== null && now >= changedAt && now - changedAt < PULSE_MS;
  const indicator = liveIndicator(opts.indicator, now);
  const notif = indicator ? null : liveNotification(opts.notification, now);

  const next = src.next && src.next.dueAt > now && src.next.dueAt - now <= NEXT_WINDOW_MS
    ? src.next
    : null;

  let line;
  if (indicator) {
    line = { kind: 'indicador', ind: indicator };
  } else if (notif) {
    line = { kind: 'notif', app: notif.app, title: notif.title, body: notif.body };
  } else if (reminders.length) {
    line = reminderLine(reminders, now);
  } else if (standDue) {
    line = { kind: 'levantar', title: 'Hora de levantar', sittingMin: standDue.sittingMin };
  } else if (waterDue) {
    line = { kind: 'agua', title: 'Hora de beber água', ml: waterDue.ml, goalMl: waterDue.goalMl, cupMl: waterDue.cupMl };
  } else if (pulse && !focusRunning) {
    line = { kind: 'player', title: text(p.title), artist: text(p.artist) };
  } else if (focusRunning) {
    const f = src.focus;
    line = { kind: 'foco', mode: f.mode, timer: f.kind, endsAt: f.endsAt, title: f.taskTitle, cycles: f.cycles };
  } else if (next) {
    line = {
      kind: 'proxima', title: next.title, dueAt: next.dueAt, urgency: next.urgency,
      minutes: Math.ceil((next.dueAt - now) / 60000),
    };
  } else {
    line = { kind: 'repouso', playing, done: src.day.done, total: src.day.total };
  }

  let pages = normalizeOrder(opts.order).filter(k => (k === 'agua' ? !!well.summary.water : on[k]));
  if (!pages.length) pages = ['hoje'];

  return {
    line,
    entryPage: pages.includes(ENTRY_PAGE[line.kind]) ? ENTRY_PAGE[line.kind] : pages[0],
    pages,
    raise: reminders.some(r => r.urgency === 'critical'),
    /* Água e levantar sobem por cima das janelas (sem o vermelho do crítico):
       atrás de uma janela maximizada, ninguém veria o aviso. */
    nudge: !!(standDue || waterDue),
    /* Indicador e notificação sobem a ilha por cima de tudo, como o aviso do
       Windows faria (sem roubar o foco). */
    flash: !!(indicator || notif),
    wellness: { due: { water: waterDue, stand: standDue }, summary: well.summary },
    /* o pulso do player aconteceu, mas o foco segurou a linha */
    muted: pulse && focusRunning,
    reminders,
    /* As seções do painel aberto mostram isto mesmo quando não está na linha:
       a próxima tarefa ainda longe, o foco pausado, o progresso do dia. */
    next: src.next,
    focus: on.foco ? src.focus : null,
    day: src.day,
  };
}

module.exports = {
  resolve,
  sanitizeSources,
  sanitizeWellness,
  normalizeSections,
  normalizeOrder,
  sortReminders,
  hhmm,
  PULSE_MS,
  INDICATOR_MS,
  NOTIF_MS,
  NEXT_WINDOW_MS,
  PAGE_ORDER,
};
