'use strict';
/*
 * Cards fixados na área de trabalho ("sticky notes").
 *
 * Cada card é uma janelinha própria que carrega o mesmo app (?sticky=<id>):
 * mesma origem, mesmo IndexedDB — a janela lê e grava a tarefa direto no
 * banco, e o Dexie avisa as outras janelas quando algo muda.
 *
 * Aqui fica só o que é puro (lista salva no settings.json e geometria), para
 * testar sem Electron. A fiação das janelas mora no main.cjs.
 */

const DEFAULT_W = 264;
const DEFAULT_H = 320;
const MIN_W = 220;
const MIN_H = 120;
/** Recolhido: só o cabeçalho com o título. */
const COLLAPSED_H = 40;
const MAX_STICKIES = 20;

function finite(v) {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function normalizeSticky(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const taskId = typeof raw.taskId === 'string' ? raw.taskId.trim().slice(0, 100) : '';
  if (!taskId) return null;
  return {
    taskId,
    x: finite(raw.x),
    y: finite(raw.y),
    w: Math.max(MIN_W, Math.round(finite(raw.w) || DEFAULT_W)),
    h: Math.max(MIN_H, Math.round(finite(raw.h) || DEFAULT_H)),
    onTop: raw.onTop !== false,
    collapsed: raw.collapsed === true,
  };
}

/** Lista salva: sem repetidos, sem lixo, com teto. */
function normalizeStickies(raw) {
  const out = [];
  const seen = new Set();
  for (const r of Array.isArray(raw) ? raw : []) {
    const s = normalizeSticky(r);
    if (!s || seen.has(s.taskId)) continue;
    seen.add(s.taskId);
    out.push(s);
    if (out.length >= MAX_STICKIES) break;
  }
  return out;
}

/** Troca (ou acrescenta) um card na lista. */
function upsertSticky(list, patch) {
  const base = normalizeStickies(list);
  const i = base.findIndex(s => s.taskId === patch.taskId);
  const merged = normalizeSticky({ ...(i >= 0 ? base[i] : {}), ...patch });
  if (!merged) return base;
  if (i >= 0) base[i] = merged;
  else base.push(merged);
  return normalizeStickies(base);
}

function removeSticky(list, taskId) {
  return normalizeStickies(list).filter(s => s.taskId !== taskId);
}

/**
 * Onde abrir a janela. Posição salva vale se ainda couber em algum monitor
 * (o notebook pode ter perdido o monitor externo); senão, empilha os cards
 * novos no canto direito da área útil, em cascata.
 */
function stickyBounds(s, workAreas, index) {
  const h = s.collapsed ? COLLAPSED_H : s.h;
  const areas = Array.isArray(workAreas) && workAreas.length ? workAreas : [{ x: 0, y: 0, width: 1280, height: 720 }];
  if (s.x !== null && s.y !== null) {
    const visivel = areas.some(a =>
      s.x + 40 > a.x && s.x < a.x + a.width - 40 && s.y >= a.y - 4 && s.y < a.y + a.height - 30);
    if (visivel) return { x: Math.round(s.x), y: Math.round(s.y), width: s.w, height: h };
  }
  const a = areas[0];
  const off = (index || 0) % 8;
  return {
    x: a.x + a.width - s.w - 24 - off * 18,
    y: a.y + 24 + off * 28,
    width: s.w,
    height: h,
  };
}

module.exports = {
  normalizeSticky,
  normalizeStickies,
  upsertSticky,
  removeSticky,
  stickyBounds,
  DEFAULT_W,
  DEFAULT_H,
  MIN_W,
  MIN_H,
  COLLAPSED_H,
  MAX_STICKIES,
};
