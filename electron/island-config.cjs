'use strict';
/*
 * Configuração da ilha e geometria da janela. Puro, para testar sem Electron.
 *
 * A janela tem tamanho fixo — o do painel aberto, mais folga para a sombra e o
 * alfinete. A pílula cresce lá dentro, por CSS, e a parte transparente deixa o
 * clique passar (setIgnoreMouseEvents). Redimensionar a janela a cada estado
 * daria tremida; assim ela só se move quando a posição muda.
 */

const { normalizeIndicatorsConfig } = require('./indicators.cjs');

const POSITIONS = ['tl', 'tc', 'tr', 'cl', 'cr', 'bl', 'bc', 'br'];
const SECTIONS = ['hoje', 'player', 'foco', 'lembretes', 'captura'];
/* floating: a pílula solta, com respiro até a borda.
   drop: grudada na borda, como um entalhe do monitor; parada, vira um fio. */
const SHAPES = ['floating', 'drop'];
const THEMES = ['dark', 'light', 'system'];
const ORDERABLE = ['hoje', 'player', 'foco', 'lembretes', 'agua', 'captura'];

const DEFAULTS = Object.freeze({
  enabled: true,
  position: 'tc',
  shape: 'floating',
  /* Na gota: parada, continua como entalhe em vez de virar o fio. */
  alwaysVisible: false,
  /* Tema próprio da ilha (independe do app) e modo leve (sem transparência nem animação). */
  theme: 'dark',
  lite: false,
  pinned: false,
  hoverOpen: true,
  raiseCritical: true,
  pauseAtCycleEnd: true,
  sections: Object.freeze({ hoje: true, player: true, foco: true, lembretes: true, captura: true }),
  order: Object.freeze(ORDERABLE.slice()),
});

function order(v) {
  const seen = new Set();
  const out = [];
  for (const k of Array.isArray(v) ? v : []) if (ORDERABLE.includes(k) && !seen.has(k)) { seen.add(k); out.push(k); }
  for (const k of ORDERABLE) if (!seen.has(k)) out.push(k);
  return out;
}

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
    shape: SHAPES.includes(src.shape) ? src.shape : DEFAULTS.shape,
    alwaysVisible: bool(src.alwaysVisible, DEFAULTS.alwaysVisible),
    theme: THEMES.includes(src.theme) ? src.theme : DEFAULTS.theme,
    lite: bool(src.lite, DEFAULTS.lite),
    order: order(src.order),
    indicators: normalizeIndicatorsConfig(src.indicators),
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
  const ind = p.indicators && typeof p.indicators === 'object' ? p.indicators : {};
  return normalizeIslandConfig({
    ...base,
    ...p,
    indicators: { ...base.indicators, ...ind, show: { ...base.indicators.show, ...(ind.show && typeof ind.show === 'object' ? ind.show : {}) } },
    sections: { ...base.sections, ...(p.sections && typeof p.sections === 'object' ? p.sections : {}) },
  });
}

/**
 * Posição que vale de fato. A gota só existe grudada numa borda de cima ou de
 * baixo: as posições do meio da tela (cl/cr) sobem para o topo. A escolhida
 * fica salva, para voltar a valer se a pessoa trocar para flutuante.
 */
function effectivePosition(config) {
  const c = normalizeIslandConfig(config);
  if (c.shape === 'drop' && c.position[0] === 'c') return 't' + c.position[1];
  return c.position;
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
  // Água e levantar: escondido atrás de uma janela, o aviso não adianta nada.
  if (state && (state.nudge || state.flash)) return true;
  return !!(c.raiseCritical && state && state.raise);
}

module.exports = {
  normalizeIslandConfig,
  mergeIslandConfig,
  islandBounds,
  shouldBeOnTop,
  effectivePosition,
  POSITIONS,
  SHAPES,
  DEFAULTS,
  WINDOW_W,
  WINDOW_H,
};
