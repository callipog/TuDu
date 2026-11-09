'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeIslandConfig, mergeIslandConfig, islandBounds, shouldBeOnTop, DEFAULTS } = require('./island-config.cjs');
const { parseLine, applyMessage, forQueue, forIsland } = require('./media.cjs');

// ------------------------------------------------------------ configuração

test('sem nada salvo, a ilha vem ligada, no topo central, com tudo ativo', () => {
  const c = normalizeIslandConfig(undefined);
  assert.equal(c.enabled, true);
  assert.equal(c.position, 'tc');
  assert.equal(c.pinned, false);
  assert.equal(c.hoverOpen, true);
  assert.equal(c.raiseCritical, true);
  assert.deepEqual(c.sections, { player: true, foco: true, lembretes: true, captura: true });
});

test('valor fora do esperado volta para o padrão', () => {
  const c = normalizeIslandConfig({ enabled: 'sim', position: 'meio', sections: { player: 0, foco: false } });
  assert.equal(c.enabled, DEFAULTS.enabled);
  assert.equal(c.position, 'tc');
  assert.equal(c.sections.player, true);
  assert.equal(c.sections.foco, false);
});

test('patch das Configurações mexe só no que veio, inclusive dentro das seções', () => {
  const atual = { enabled: true, position: 'br', sections: { player: false, foco: true, lembretes: true, captura: true } };
  const c = mergeIslandConfig(atual, { sections: { captura: false } });
  assert.equal(c.position, 'br');
  assert.deepEqual(c.sections, { player: false, foco: true, lembretes: true, captura: false });
});

// ---------------------------------------------------------- posição na tela

const wa = { x: 0, y: 0, width: 1920, height: 1040 }; // tela cheia sem a barra de tarefas
const size = { width: 460, height: 210 };

test('cada posição encosta na borda certa da área útil', () => {
  assert.deepEqual(islandBounds('tl', wa, size), { x: 0, y: 0, width: 460, height: 210 });
  assert.deepEqual(islandBounds('tc', wa, size), { x: 730, y: 0, width: 460, height: 210 });
  assert.deepEqual(islandBounds('tr', wa, size), { x: 1460, y: 0, width: 460, height: 210 });
  assert.deepEqual(islandBounds('cl', wa, size), { x: 0, y: 415, width: 460, height: 210 });
  assert.deepEqual(islandBounds('cr', wa, size), { x: 1460, y: 415, width: 460, height: 210 });
  assert.deepEqual(islandBounds('bl', wa, size), { x: 0, y: 830, width: 460, height: 210 });
  assert.deepEqual(islandBounds('bc', wa, size), { x: 730, y: 830, width: 460, height: 210 });
  assert.deepEqual(islandBounds('br', wa, size), { x: 1460, y: 830, width: 460, height: 210 });
});

test('respeita a área útil de monitor deslocado (barra de tarefas no topo, segundo monitor)', () => {
  const outro = { x: 1920, y: 48, width: 2560, height: 1392 };
  assert.deepEqual(islandBounds('tc', outro, size), { x: 1920 + 1050, y: 48, width: 460, height: 210 });
  assert.deepEqual(islandBounds('br', outro, size), { x: 1920 + 2100, y: 48 + 1182, width: 460, height: 210 });
});

// ------------------------------------------------------- furar as janelas

test('fixada fica sempre por cima; solta, só com lembrete crítico', () => {
  assert.equal(shouldBeOnTop({ pinned: true }, { raise: false }), true);
  assert.equal(shouldBeOnTop({}, { raise: false }), false);
  assert.equal(shouldBeOnTop({}, { raise: true }), true);
  assert.equal(shouldBeOnTop({ raiseCritical: false }, { raise: true }), false);
  assert.equal(shouldBeOnTop({}, null), false);
});

// ------------------------------------------------------------------ player

test('linhas do helper: só JSON com tipo passa', () => {
  assert.deepEqual(parseLine('{"t":"ready"}'), { t: 'ready' });
  assert.equal(parseLine(''), null);
  assert.equal(parseLine('Aviso do PowerShell'), null);
  assert.equal(parseLine('{"sem":"tipo"}'), null);
  assert.equal(parseLine('{quebrado'), null);
});

const st = (title, extra) => ({ t: 'state', active: true, title, artist: 'Lua Azul', playing: true, position: 10, duration: 200, updatedAt: 1000, app: 'Spotify.exe', ...extra });

test('a primeira faixa vista não conta como troca; a seguinte sim', () => {
  let p = applyMessage(null, st('Noites de Verão'), 5000);
  assert.equal(p.trackChangedAt, null);
  p = applyMessage(p, st('Noites de Verão', { position: 20 }), 6000);
  assert.equal(p.trackChangedAt, null);
  p = applyMessage(p, st('Outra Faixa'), 7000);
  assert.equal(p.trackChangedAt, 7000);
  p = applyMessage(p, st('Outra Faixa', { playing: false }), 8000);
  assert.equal(p.trackChangedAt, 7000);
});

test('a capa entra na faixa certa e cai quando a faixa troca', () => {
  let p = applyMessage(null, st('A'), 1);
  p = applyMessage(p, { t: 'art', track: 'A|Lua Azul', data: 'data:image/png;base64,AAA' }, 2);
  assert.equal(p.art, 'data:image/png;base64,AAA');
  // capa de outra faixa não gruda
  assert.equal(applyMessage(p, { t: 'art', track: 'B|Lua Azul', data: 'data:image/png;base64,BBB' }, 3).art, 'data:image/png;base64,AAA');
  // só imagem em data URL
  assert.equal(applyMessage(p, { t: 'art', track: 'A|Lua Azul', data: 'https://x/y.png' }, 3).art, null);
  p = applyMessage(p, st('B'), 4);
  assert.equal(p.art, null);
});

test('sem sessão de mídia, o player some da fila e da ilha', () => {
  const p = applyMessage(applyMessage(null, st('A'), 1), { t: 'state', active: false }, 2);
  assert.equal(forQueue(p), null);
  assert.equal(forIsland(p), null);
});

test('a fila recebe o mínimo; a janela recebe a capa e o tempo', () => {
  const p = applyMessage(null, st('A'), 1);
  assert.deepEqual(Object.keys(forQueue(p)).sort(), ['artist', 'playing', 'title', 'trackChangedAt']);
  assert.equal(forIsland(p).duration, 200);
  assert.equal(forIsland(p).app, 'Spotify.exe');
});
