'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { toIndicator, normalizeIndicatorsConfig, parseLine } = require('./indicators.cjs');

test('desligado por padrão, com todos os tipos marcados', () => {
  const c = normalizeIndicatorsConfig(undefined);
  assert.equal(c.enabled, false);
  assert.equal(c.hideOsd, false);
  assert.deepEqual(c.show, { volume: true, brightness: true, keys: true, mic: true, media: true });
});

test('leitura inicial não vira indicador: a ilha não anuncia o que já estava', () => {
  assert.equal(toIndicator({ t: 'volume', level: 0.5, init: true }, null, null, 1), null);
});

test('volume e brilho viram nível de 0 a 1', () => {
  assert.deepEqual(toIndicator({ t: 'volume', level: 0.42, muted: false }, null, null, 5), { kind: 'volume', level: 0.42, muted: false, at: 5 });
  assert.equal(toIndicator({ t: 'brightness', level: 7 }, null, null, 5).level, 1);
});

test('teclas: diz qual mudou', () => {
  const antes = { caps: false, num: true };
  assert.deepEqual(toIndicator({ t: 'keys', caps: true, num: true }, antes, null, 1), { kind: 'caps', on: true, at: 1 });
  assert.deepEqual(toIndicator({ t: 'keys', caps: false, num: false }, antes, null, 1), { kind: 'num', on: false, at: 1 });
});

test('tipo desmarcado nas Configurações não aparece', () => {
  const show = { volume: false, brightness: true, keys: true, mic: true, media: true };
  assert.equal(toIndicator({ t: 'volume', level: 0.3 }, null, show, 1), null);
  assert.ok(toIndicator({ t: 'mic', muted: true }, null, show, 1));
});

test('linha quebrada do helper é ignorada', () => {
  assert.equal(parseLine('lixo'), null);
  assert.equal(parseLine('{"sem":"t"}'), null);
  assert.deepEqual(parseLine('{"t":"mic","muted":true}'), { t: 'mic', muted: true });
});
