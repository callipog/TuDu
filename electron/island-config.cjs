'use strict';
/*
 * Configuração da ilha e geometria da janela. Puro, para testar sem Electron.
 *
 * A janela tem tamanho fixo — o do painel aberto, mais folga para a sombra e o
 * alfinete. A pílula cresce lá dentro, por CSS, e a parte transparente deixa o
 * clique passar (setIgnoreMouseEvents). Redimensionar a janela a cada estado
 * daria tremida; assim ela só se move quando a posição muda.
 */

const POSITIONS = ['tl', 'tc', 'tr', 'cl', 'cr', 'bl', 'bc', 'br'];
const SECTIONS = ['player', 'foco', 'lembretes', 'captura'];

const DEFAULTS = Object.freeze({
  enabled: true,
  position: 'tc',
  pinned: false,
  hoverOpen: true,
  raiseCritical: true,
  pauseAtCycleEnd: true,
  sections: Object.freeze({ player: true, foco: true, lembretes: true, captura: true }),
});

/* Janela: painel aberto (358 × 156) + alfinete dos dois lados + sombra. */
const WINDOW_W = 460;
const WINDOW_H = 210;

function bool(v, fallback) {
  return typeof v === 'boolean' ? v : fallback;
}

/** Completa o que faltar com o padrão e descarta o que não tiver a forma certa. */
function normalizeIslandConfig(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const sec = src.sections && typeof src.sections === 'object' ? src.sections : {};
  const sections = {};
  for (const k of SECTIONS) sections[k] = bool(sec[k], DEFAULTS.sections[k]);
  return {
    enabled: bool(src.enabled, DEFAULTS.enabled),
    position: POSITIONS.includes(src.position) ? src.position : DEFAULTS.position,
    pinned: bool(src.pinned, DEFAULTS.pinned),
    hoverOpen: bool(src.hoverOpen, DEFAULTS.hoverOpen),
    raiseCritical: bool(src.raiseCritical, DEFAULTS.raiseCritical),
    pauseAtCycleEnd: bool(src.pauseAtCycleEnd, DEFAULTS.pauseAtCycleEnd),
    sections,
  };
}

/** Aplica um patch vindo da tela de Configurações sobre a configuração atual. */
function mergeIslandConfig(current, patch) {
  const base = normalizeIslandConfig(current);
  const p = patch && typeof patch === 'object' ? patch : {};
  return normalizeIslandConfig({
    ...base,
    ...p,
    sections: { ...base.sections, ...(p.sections && typeof p.sections === 'object' ? p.sections : {}) },
  });
}

/**
 * Onde a janela da ilha fica dentro da área útil do monitor (sem a barra de
 * tarefas). A janela encosta na borda escolhida; o respiro até a borda e a
 * sombra ficam por conta do CSS, dentro dela.
 */
function islandBounds(position, workArea, size) {
  const w = (size && size.width) || WINDOW_W;
  const h = (size && size.height) || WINDOW_H;
  const wa = workArea;
  const pos = POSITIONS.includes(position) ? position : DEFAULTS.position;
  const v = pos[0];
  const hz = pos[1];

  let x;
  if (hz === 'l') x = wa.x;
  else if (hz === 'r') x = wa.x + wa.width - w;
  else x = wa.x + Math.round((wa.width - w) / 2);

  let y;
  if (v === 't') y = wa.y;
  else if (v === 'b') y = wa.y + wa.height - h;
  else y = wa.y + Math.round((wa.height - h) / 2);

  return { x, y, width: w, height: h };
}

/**
 * A ilha deve furar as janelas agora? Fixada, sempre. Fora isso, só com um
 * lembrete crítico pendente — e só se a pessoa não desligou isso.
 */
function shouldBeOnTop(config, state) {
  const c = normalizeIslandConfig(config);
  if (c.pinned) return true;
  return !!(c.raiseCritical && state && state.raise);
}

module.exports = {
  normalizeIslandConfig,
  mergeIslandConfig,
  islandBounds,
  shouldBeOnTop,
  POSITIONS,
  DEFAULTS,
  WINDOW_W,
  WINDOW_H,
};
