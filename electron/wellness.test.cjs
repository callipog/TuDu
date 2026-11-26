'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const W = require('./wellness.cjs');

const MIN = 60000;
const T0 = new Date(2026, 10, 26, 9, 0, 0).getTime();
const ON = { water: { enabled: true, goalMl: 1000, everyMin: 60, cupMl: 250 }, stand: { enabled: true, afterMin: 50 } };

test('sem nada salvo, os dois lembretes vêm desligados', () => {
  const c = W.normalizeWellnessConfig(undefined);
  assert.equal(c.water.enabled, false);
  assert.equal(c.stand.enabled, false);
  assert.equal(c.water.goalMl, 2000);
});

test('valores fora da faixa são presos nos limites', () => {
  const c = W.normalizeWellnessConfig({ water: { goalMl: 99999, everyMin: 1, cupMl: 'x' }, stand: { afterMin: 2 } });
  assert.equal(c.water.goalMl, 6000);
  assert.equal(c.water.everyMin, 10);
  assert.equal(c.water.cupMl, 250);
  assert.equal(c.stand.afterMin, 10);
});

test('merge mexe só no que veio no patch', () => {
  const c = W.mergeWellnessConfig(ON, { water: { cupMl: 500 } });
  assert.equal(c.water.cupMl, 500);
  assert.equal(c.water.goalMl, 1000);
  assert.equal(c.stand.enabled, true);
});

test('água: avisa quando passa o intervalo, e não antes', () => {
  const st = W.normalizeWellnessState(null, T0);
  assert.equal(W.due(ON, st, T0 + 59 * MIN, 0).water, null);
  assert.deepEqual(W.due(ON, st, T0 + 60 * MIN, 0).water, { ml: 0, goalMl: 1000, cupMl: 250 });
});

test('água: beber zera o intervalo e soma o copo', () => {
  let st = W.normalizeWellnessState(null, T0);
  st = W.drink(st, T0 + 60 * MIN, 250);
  assert.equal(st.water.ml, 250);
  assert.equal(W.due(ON, st, T0 + 100 * MIN, 0).water, null);
  assert.ok(W.due(ON, st, T0 + 120 * MIN, 0).water);
});

test('água: meta batida, sem mais avisos', () => {
  let st = W.normalizeWellnessState(null, T0);
  for (let i = 0; i < 4; i++) st = W.drink(st, T0, 250);
  assert.equal(W.due(ON, st, T0 + 300 * MIN, 0).water, null);
});

test('água: adiar segura o aviso pelo tempo pedido', () => {
  let st = W.normalizeWellnessState(null, T0);
  st = W.snooze(st, T0 + 60 * MIN, 'water', 10);
  assert.equal(W.due(ON, st, T0 + 65 * MIN, 0).water, null);
  assert.ok(W.due(ON, st, T0 + 70 * MIN, 0).water);
});

test('água: o dia vira e o contador zera', () => {
  let st = W.drink(W.normalizeWellnessState(null, T0), T0, 750);
  const amanha = T0 + 24 * 60 * MIN;
  st = W.normalizeWellnessState(st, amanha);
  assert.equal(st.water.ml, 0);
  assert.equal(st.water.lastAt, amanha);
});

test('desfazer o copo não deixa negativo', () => {
  let st = W.drink(W.normalizeWellnessState(null, T0), T0, 250);
  st = W.undrink(st, T0, 500);
  assert.equal(st.water.ml, 0);
});

test('levantar: avisa depois do tempo sentado', () => {
  const st = W.normalizeWellnessState(null, T0);
  assert.equal(W.due(ON, st, T0 + 49 * MIN, 0).stand, null);
  assert.deepEqual(W.due(ON, st, T0 + 50 * MIN, 0).stand, { sittingMin: 50 });
});

test('levantar: ficar ocioso 5 min conta como ter levantado', () => {
  let st = W.normalizeWellnessState(null, T0);
  st = W.tick(st, T0 + 40 * MIN, W.IDLE_RESET_MIN * 60);
  assert.equal(st.stand.sittingSince, T0 + 40 * MIN);
  assert.equal(W.due(ON, st, T0 + 80 * MIN, 0).stand, null);
});

test('levantar: "levantei" recomeça a contagem', () => {
  let st = W.normalizeWellnessState(null, T0);
  st = W.stood(st, T0 + 55 * MIN);
  assert.equal(W.due(ON, st, T0 + 60 * MIN, 0).stand, null);
});

test('com o computador ocioso ninguém é avisado', () => {
  const st = W.normalizeWellnessState(null, T0);
  const d = W.due(ON, st, T0 + 120 * MIN, 120);
  assert.equal(d.water, null);
  assert.equal(d.stand, null);
});

test('desligado não avisa', () => {
  const st = W.normalizeWellnessState(null, T0);
  const d = W.due({}, st, T0 + 500 * MIN, 0);
  assert.equal(d.water, null);
  assert.equal(d.stand, null);
});
