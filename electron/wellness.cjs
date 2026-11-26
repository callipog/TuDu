'use strict';
/*
 * Lembretes de bem-estar: beber água e levantar da cadeira.
 *
 * Moram no processo principal porque não dependem do banco de tarefas e
 * precisam do tempo ocioso do sistema (powerMonitor) — só aqui ele existe.
 * Este módulo é puro: recebe configuração, estado e o instante, e devolve o
 * estado novo. O main.cjs só faz a fiação (relógio, settings.json, ilha).
 *
 * Regras:
 *   Água      — avisa a cada `everyMin` desde o último copo (ou desde que o dia
 *               começou a ser contado), até bater a meta do dia. Vira o dia,
 *               zera o contador.
 *   Levantar  — conta o tempo sentado em uso contínuo. Ficar ocioso por
 *               IDLE_RESET_MIN (ou travar a tela) conta como ter levantado.
 *   Ninguém é avisado com o computador ocioso: o lembrete espera a pessoa
 *   voltar, senão ela acharia uma fila de avisos velhos.
 */

const IDLE_RESET_MIN = 5;
const SNOOZE_MIN = 10;

const DEFAULTS = Object.freeze({
  water: Object.freeze({ enabled: false, goalMl: 2000, everyMin: 60, cupMl: 250, sound: true }),
  stand: Object.freeze({ enabled: false, afterMin: 50, sound: true }),
});

function int(v, fallback, min, max) {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}
function bool(v, fallback) {
  return typeof v === 'boolean' ? v : fallback;
}

function normalizeWellnessConfig(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const w = src.water && typeof src.water === 'object' ? src.water : {};
  const s = src.stand && typeof src.stand === 'object' ? src.stand : {};
  const d = DEFAULTS;
  return {
    water: {
      enabled: bool(w.enabled, d.water.enabled),
      goalMl: int(w.goalMl, d.water.goalMl, 250, 6000),
      everyMin: int(w.everyMin, d.water.everyMin, 10, 240),
      cupMl: int(w.cupMl, d.water.cupMl, 50, 1000),
      sound: bool(w.sound, d.water.sound),
    },
    stand: {
      enabled: bool(s.enabled, d.stand.enabled),
      afterMin: int(s.afterMin, d.stand.afterMin, 10, 180),
      sound: bool(s.sound, d.stand.sound),
    },
  };
}

function mergeWellnessConfig(current, patch) {
  const base = normalizeWellnessConfig(current);
  const p = patch && typeof patch === 'object' ? patch : {};
  return normalizeWellnessConfig({
    water: { ...base.water, ...(p.water && typeof p.water === 'object' ? p.water : {}) },
    stand: { ...base.stand, ...(p.stand && typeof p.stand === 'object' ? p.stand : {}) },
  });
}

/** "2026-11-26" no fuso da máquina: o dia que a pessoa vive, não o UTC. */
function dayKey(ms) {
  const d = new Date(ms);
  const p = (n) => (n < 10 ? '0' : '') + n;
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

function finite(v) {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/** Estado salvo (settings.json → wellnessState). Vira o dia aqui. */
function normalizeWellnessState(raw, now) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const w = src.water && typeof src.water === 'object' ? src.water : {};
  const s = src.stand && typeof src.stand === 'object' ? src.stand : {};
  const today = dayKey(now);
  const sameDay = w.day === today;
  return {
    water: {
      day: today,
      ml: sameDay ? Math.max(0, finite(w.ml) || 0) : 0,
      // Dia novo: a contagem do intervalo parte de agora, não de ontem à noite.
      lastAt: sameDay && finite(w.lastAt) !== null ? Math.min(w.lastAt, now) : now,
      snoozeUntil: sameDay ? finite(w.snoozeUntil) : null,
    },
    stand: {
      sittingSince: finite(s.sittingSince) !== null ? Math.min(s.sittingSince, now) : now,
      snoozeUntil: finite(s.snoozeUntil),
    },
  };
}

/**
 * Avança o relógio: vira o dia e trata ociosidade.
 * @param {number} idleSec segundos sem teclado/mouse (powerMonitor)
 */
function tick(state, now, idleSec) {
  const st = normalizeWellnessState(state, now);
  const idle = Math.max(0, finite(idleSec) || 0);
  if (idle >= IDLE_RESET_MIN * 60) {
    // Longe do computador = levantou. A contagem recomeça quando voltar.
    st.stand.sittingSince = now;
    st.stand.snoozeUntil = null;
  }
  return st;
}

/** Quais lembretes estão valendo agora. Ocioso, nenhum. */
function due(config, state, now, idleSec) {
  const c = normalizeWellnessConfig(config);
  const st = state;
  const away = (finite(idleSec) || 0) >= 60;

  const w = c.water;
  const waterDue = !away && w.enabled && st.water.ml < w.goalMl
    && now >= st.water.lastAt + w.everyMin * 60000
    && (!st.water.snoozeUntil || now >= st.water.snoozeUntil);

  const s = c.stand;
  const sittingMin = Math.max(0, Math.floor((now - st.stand.sittingSince) / 60000));
  const standDue = !away && s.enabled && sittingMin >= s.afterMin
    && (!st.stand.snoozeUntil || now >= st.stand.snoozeUntil);

  return {
    water: waterDue ? { ml: st.water.ml, goalMl: w.goalMl, cupMl: w.cupMl } : null,
    stand: standDue ? { sittingMin } : null,
  };
}

/** Bebeu um copo (ou outra quantidade). Zera o intervalo. */
function drink(state, now, ml) {
  const st = normalizeWellnessState(state, now);
  st.water.ml = Math.min(20000, st.water.ml + Math.max(0, Math.round(ml) || 0));
  st.water.lastAt = now;
  st.water.snoozeUntil = null;
  return st;
}

/** Desfaz o último copo, para o clique errado. */
function undrink(state, now, ml) {
  const st = normalizeWellnessState(state, now);
  st.water.ml = Math.max(0, st.water.ml - Math.max(0, Math.round(ml) || 0));
  return st;
}

function snooze(state, now, which, minutes) {
  const st = normalizeWellnessState(state, now);
  const until = now + (minutes || SNOOZE_MIN) * 60000;
  if (which === 'water') st.water.snoozeUntil = until;
  if (which === 'stand') st.stand.snoozeUntil = until;
  return st;
}

/** Levantou: a contagem do tempo sentado recomeça. */
function stood(state, now) {
  const st = normalizeWellnessState(state, now);
  st.stand.sittingSince = now;
  st.stand.snoozeUntil = null;
  return st;
}

/** O que a ilha e a tela de Configurações mostram, mesmo sem aviso valendo. */
function summary(config, state, now) {
  const c = normalizeWellnessConfig(config);
  return {
    water: c.water.enabled
      ? { ml: state.water.ml, goalMl: c.water.goalMl, cupMl: c.water.cupMl, lastAt: state.water.lastAt }
      : null,
    stand: c.stand.enabled
      ? { sittingMin: Math.max(0, Math.floor((now - state.stand.sittingSince) / 60000)), afterMin: c.stand.afterMin }
      : null,
  };
}

module.exports = {
  normalizeWellnessConfig,
  mergeWellnessConfig,
  normalizeWellnessState,
  tick,
  due,
  drink,
  undrink,
  snooze,
  stood,
  summary,
  dayKey,
  DEFAULTS,
  IDLE_RESET_MIN,
  SNOOZE_MIN,
};
