'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('./stickies.cjs');

const AREA = { x: 0, y: 0, width: 1920, height: 1032 };

test('lista salva: tira lixo e repetidos, completa o tamanho', () => {
  const l = S.normalizeStickies([{ taskId: 'a' }, { taskId: 'a', x: 5 }, null, { x: 1 }, { taskId: 'b', w: 10, onTop: false }]);
  assert.equal(l.length, 2);
  assert.deepEqual(l[0], { taskId: 'a', x: null, y: null, w: S.DEFAULT_W, h: S.DEFAULT_H, onTop: true, collapsed: false });
  assert.equal(l[1].w, S.MIN_W);
  assert.equal(l[1].onTop, false);
});

test('upsert troca o que já existe e acrescenta o novo', () => {
  let l = S.upsertSticky([], { taskId: 'a' });
  l = S.upsertSticky(l, { taskId: 'a', x: 100, y: 50 });
  l = S.upsertSticky(l, { taskId: 'b' });
  assert.equal(l.length, 2);
  assert.equal(l[0].x, 100);
  assert.deepEqual(S.removeSticky(l, 'a').map(s => s.taskId), ['b']);
});

test('posição salva vale se ainda couber num monitor', () => {
  const s = S.normalizeSticky({ taskId: 'a', x: 300, y: 200 });
  assert.deepEqual(S.stickyBounds(s, [AREA], 0), { x: 300, y: 200, width: S.DEFAULT_W, height: S.DEFAULT_H });
});

test('monitor que sumiu: o card volta para o canto da tela principal', () => {
  const s = S.normalizeSticky({ taskId: 'a', x: 3000, y: 200 });
  const b = S.stickyBounds(s, [AREA], 0);
  assert.equal(b.x, 1920 - S.DEFAULT_W - 24);
  assert.equal(b.y, 24);
});

test('cards novos abrem em cascata; recolhido tem só a altura do cabeçalho', () => {
  const s = S.normalizeSticky({ taskId: 'a', collapsed: true });
  const b0 = S.stickyBounds(s, [AREA], 0), b1 = S.stickyBounds(s, [AREA], 1);
  assert.equal(b1.y - b0.y, 28);
  assert.equal(b0.height, S.COLLAPSED_H);
});
