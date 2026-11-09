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
 *   1. lembrete vencido e não resolvido   — fica até ser resolvido
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
const NEXT_WINDOW_MS = 30 * 60 * 1000;
const FRESH_MS = 60 * 1000; // até aqui um lembrete é "agora"; depois, o horário

const URGENCIES = ['low', 'medium', 'high', 'critical'];
const MAX_TEXT = 200;
const MAX_REMINDERS = 50;

/* Seções na ordem das setas. "hoje" é a base e não desliga. */
const PAGE_ORDER = ['hoje', 'player', 'foco', 'lembretes', 'captura'];
const TOGGLEABLE = ['player', 'foco', 'lembretes', 'captura'];

/* Ao abrir a ilha, em que seção ela entra conforme a linha que estava no ar. */
const ENTRY_PAGE = {
  lembrete: 'lembretes',
  player: 'player',
  foco: 'foco',
  proxima: 'hoje',
  repouso: 'hoje',
};

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
      endsAt: finite(src.focus.endsAt),
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
  const on = { hoje: true };
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
  const playing = on.player && !!(p && p.playing && text(p.title));
  const changedAt = playing ? finite(p.trackChangedAt) : null;
  const pulse = changedAt !== null && now >= changedAt && now - changedAt < PULSE_MS;

  const next = src.next && src.next.dueAt > now && src.next.dueAt - now <= NEXT_WINDOW_MS
    ? src.next
    : null;

  let line;
  if (reminders.length) {
    line = reminderLine(reminders, now);
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

  return {
    line,
    entryPage: ENTRY_PAGE[line.kind],
    pages: PAGE_ORDER.filter(k => on[k]),
    raise: reminders.some(r => r.urgency === 'critical'),
    /* o pulso do player aconteceu, mas o foco segurou a linha */
    muted: pulse && focusRunning,
    reminders,
  };
}

module.exports = {
  resolve,
  sanitizeSources,
  normalizeSections,
  sortReminders,
  hhmm,
  PULSE_MS,
  NEXT_WINDOW_MS,
  PAGE_ORDER,
};
