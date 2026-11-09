'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { resolve, sanitizeSources, PULSE_MS } = require('./island-queue.cjs');
const { createIslandHub } = require('./island.cjs');

// Horários montados no fuso local: é nele que a ilha escreve "14:02".
const at = (h, m, s = 0) => new Date(2026, 10, 9, h, m, s).getTime();
const NOW = at(14, 28);
const MIN = 60 * 1000;

const reminder = (id, urgency, firedAt, title = 'Tarefa ' + id) =>
  ({ id: id + ':due:x', taskId: id, title, urgency, firedAt });

const playing = (changedAt, title = 'Noites de Verão') =>
  ({ title, artist: 'Lua Azul', playing: true, trackChangedAt: changedAt });

const runningFocus = { running: true, kind: 'pomodoro', mode: 'work', endsAt: NOW + 17 * MIN, taskTitle: 'Wordmark', cycles: 1 };

// ---------------------------------------------------------------- repouso

test('sem nada acontecendo, a linha é o repouso com o progresso do dia', () => {
  const s = resolve({ sources: { day: { done: 3, total: 7 } }, now: NOW });
  assert.equal(s.line.kind, 'repouso');
  assert.equal(s.line.done, 3);
  assert.equal(s.line.total, 7);
  assert.equal(s.line.playing, false);
  assert.equal(s.entryPage, 'hoje');
  assert.equal(s.raise, false);
});

test('repouso sabe se há música tocando, para trocar a marca pela capa', () => {
  const s = resolve({ sources: {}, player: playing(NOW - 10 * MIN), now: NOW });
  assert.equal(s.line.kind, 'repouso');
  assert.equal(s.line.playing, true);
});

// ------------------------------------------------------ próximo compromisso

test('tarefa a 30 minutos ou menos vira a linha; além disso, não', () => {
  const perto = resolve({ sources: { next: { id: 'a', title: 'Revisar', dueAt: NOW + 20 * MIN } }, now: NOW });
  assert.equal(perto.line.kind, 'proxima');
  assert.equal(perto.line.minutes, 20);
  assert.equal(perto.entryPage, 'hoje');

  const limite = resolve({ sources: { next: { id: 'a', title: 'Revisar', dueAt: NOW + 30 * MIN } }, now: NOW });
  assert.equal(limite.line.kind, 'proxima');

  const longe = resolve({ sources: { next: { id: 'a', title: 'Revisar', dueAt: NOW + 31 * MIN } }, now: NOW });
  assert.equal(longe.line.kind, 'repouso');
});

test('prazo que já passou não é "próximo" — vira lembrete pelo outro caminho', () => {
  const s = resolve({ sources: { next: { id: 'a', title: 'Revisar', dueAt: NOW - MIN } }, now: NOW });
  assert.equal(s.line.kind, 'repouso');
});

// -------------------------------------------------------------------- foco

test('foco rodando ganha do próximo compromisso', () => {
  const s = resolve({
    sources: { focus: runningFocus, next: { id: 'a', title: 'Revisar', dueAt: NOW + 5 * MIN } },
    now: NOW,
  });
  assert.equal(s.line.kind, 'foco');
  assert.equal(s.line.endsAt, NOW + 17 * MIN);
  assert.equal(s.line.title, 'Wordmark');
  assert.equal(s.entryPage, 'foco');
});

test('foco pausado não toma a linha', () => {
  const s = resolve({ sources: { focus: { ...runningFocus, running: false } }, now: NOW });
  assert.equal(s.line.kind, 'repouso');
});

// ------------------------------------------------------------------ player

test('a faixa mudou: o pulso do player aparece por 3 segundos e recua', () => {
  const p = playing(NOW);
  assert.equal(resolve({ sources: {}, player: p, now: NOW }).line.kind, 'player');
  assert.equal(resolve({ sources: {}, player: p, now: NOW + PULSE_MS - 1 }).line.kind, 'player');
  assert.equal(resolve({ sources: {}, player: p, now: NOW + PULSE_MS }).line.kind, 'repouso');
});

test('o pulso passa na frente do próximo compromisso', () => {
  const s = resolve({
    sources: { next: { id: 'a', title: 'Revisar', dueAt: NOW + 5 * MIN } },
    player: playing(NOW),
    now: NOW,
  });
  assert.equal(s.line.kind, 'player');
  assert.equal(s.entryPage, 'player');
});

test('durante o foco o pulso fica silenciado', () => {
  const s = resolve({ sources: { focus: runningFocus }, player: playing(NOW), now: NOW });
  assert.equal(s.line.kind, 'foco');
  assert.equal(s.muted, true);
});

test('música pausada não pulsa', () => {
  const s = resolve({ sources: {}, player: { ...playing(NOW), playing: false }, now: NOW });
  assert.equal(s.line.kind, 'repouso');
  assert.equal(s.line.playing, false);
});

// --------------------------------------------------------------- lembretes

test('lembrete vencido ganha de tudo, inclusive do foco e do pulso', () => {
  const s = resolve({
    sources: { focus: runningFocus, reminders: [reminder('a', 'medium', NOW)] },
    player: playing(NOW),
    now: NOW,
  });
  assert.equal(s.line.kind, 'lembrete');
  assert.equal(s.entryPage, 'lembretes');
});

test('um lembrete só: título e "agora"; depois de um minuto, o horário', () => {
  const fresco = resolve({ sources: { reminders: [reminder('a', 'medium', NOW - 30 * 1000, 'Ligar')] }, now: NOW });
  assert.equal(fresco.line.title, 'Ligar');
  assert.equal(fresco.line.meta, 'agora');

  const antigo = resolve({ sources: { reminders: [reminder('a', 'medium', at(14, 2), 'Ligar')] }, now: NOW });
  assert.equal(antigo.line.meta, '14:02');
});

test('só o crítico pede para furar as janelas', () => {
  const comum = resolve({ sources: { reminders: [reminder('a', 'high', NOW)] }, now: NOW });
  assert.equal(comum.raise, false);

  const critico = resolve({ sources: { reminders: [reminder('a', 'critical', NOW)] }, now: NOW });
  assert.equal(critico.raise, true);
  assert.equal(critico.line.critical, true);
});

test('vários comuns: quantos estão esperando e desde quando', () => {
  const s = resolve({
    sources: { reminders: [reminder('a', 'low', at(14, 10)), reminder('b', 'medium', at(14, 2)), reminder('c', 'high', at(14, 20))] },
    now: NOW,
  });
  assert.equal(s.line.title, '3 lembretes esperando');
  assert.equal(s.line.meta, 'desde 14:02');
  assert.equal(s.raise, false);
});

test('com um crítico no meio, a linha nomeia o crítico e soma os outros', () => {
  const s = resolve({
    sources: {
      reminders: [
        reminder('a', 'medium', at(14, 25)),
        reminder('b', 'critical', at(14, 5), 'Revisar notas da 1.11'),
        reminder('c', 'low', at(14, 27)),
      ],
    },
    now: NOW,
  });
  assert.equal(s.line.title, 'Revisar notas da 1.11');
  assert.equal(s.line.meta, '+2');
  assert.equal(s.raise, true);
});

test('críticos sempre na frente; dentro de cada grupo, o mais recente primeiro', () => {
  const s = resolve({
    sources: {
      reminders: [
        reminder('a', 'medium', at(14, 1)),
        reminder('b', 'critical', at(14, 2)),
        reminder('c', 'medium', at(14, 9)),
        reminder('d', 'critical', at(14, 8)),
      ],
    },
    now: NOW,
  });
  assert.deepEqual(s.reminders.map(r => r.taskId), ['d', 'b', 'c', 'a']);
});

// ---------------------------------------------------------------- seções

test('as setas andam só pelas seções ligadas, sempre na mesma ordem', () => {
  assert.deepEqual(resolve({ now: NOW }).pages, ['hoje', 'player', 'foco', 'lembretes', 'captura']);
  const s = resolve({ sections: { player: false, captura: false }, now: NOW });
  assert.deepEqual(s.pages, ['hoje', 'foco', 'lembretes']);
});

test('"hoje" é a base e não desliga', () => {
  const s = resolve({ sections: { hoje: false }, now: NOW });
  assert.equal(s.pages[0], 'hoje');
});

test('seção desligada sai da fila: lembretes desligados não aparecem nem sobem', () => {
  const s = resolve({
    sources: { reminders: [reminder('a', 'critical', NOW)] },
    sections: { lembretes: false },
    now: NOW,
  });
  assert.equal(s.line.kind, 'repouso');
  assert.equal(s.raise, false);
  assert.deepEqual(s.reminders, []);
});

test('player desligado: sem pulso e o repouso não mostra capa', () => {
  const s = resolve({ sources: {}, player: playing(NOW), sections: { player: false }, now: NOW });
  assert.equal(s.line.kind, 'repouso');
  assert.equal(s.line.playing, false);
});

test('foco desligado: o timer não toma a linha nem silencia o player', () => {
  const s = resolve({ sources: { focus: runningFocus }, player: playing(NOW), sections: { foco: false }, now: NOW });
  assert.equal(s.line.kind, 'player');
  assert.equal(s.muted, false);
});

// ------------------------------------------------------------ sanitização

test('o retrato que chega por IPC é limpo antes de chegar às regras', () => {
  const src = sanitizeSources({
    reminders: [
      { id: 'ok', taskId: 't', title: 'Válido', urgency: 'critical', firedAt: NOW },
      { id: 'sem-titulo', taskId: 't', title: '   ', urgency: 'low', firedAt: NOW },
      { id: 'sem-hora', taskId: 't', title: 'X', urgency: 'low', firedAt: 'ontem' },
      { id: 'urg', taskId: 't', title: 'Y', urgency: 'URGENTE', firedAt: NOW },
      null,
      'lixo',
    ],
    next: { title: 'Sem prazo' },
    day: { done: 9, total: 4 },
  });
  assert.deepEqual(src.reminders.map(r => r.id), ['ok', 'urg']);
  assert.equal(src.reminders[1].urgency, 'medium');
  assert.equal(src.next, null);
  assert.deepEqual(src.day, { done: 4, total: 4 });
});

test('textos longos são cortados e lixo no topo não derruba nada', () => {
  const src = sanitizeSources({ reminders: [{ id: 'a', taskId: 'a', title: 'x'.repeat(500), urgency: 'low', firedAt: NOW }] });
  assert.equal(src.reminders[0].title.length, 200);
  assert.doesNotThrow(() => resolve({ sources: 'não é objeto', player: 42, sections: null, now: NOW }));
  assert.doesNotThrow(() => resolve());
});

// -------------------------------------------------------------------- hub

function fakeClock(start) {
  let t = start;
  let tick = null;
  return {
    now: () => t,
    advance(ms) { t += ms; if (tick) tick(); },
    setInterval: fn => { tick = fn; return 1; },
    clearInterval: () => { tick = null; },
    get running() { return tick !== null; },
  };
}

test('hub: só avisa quando o estado muda de fato', () => {
  const clock = fakeClock(NOW);
  const hub = createIslandHub({ now: clock.now, setInterval: clock.setInterval, clearInterval: clock.clearInterval });
  const vistos = [];
  hub.subscribe(s => vistos.push(s.line.kind));
  assert.deepEqual(vistos, ['repouso']);

  hub.setSources({ day: { done: 0, total: 0 } }); // mesmo resultado: nada novo
  assert.deepEqual(vistos, ['repouso']);

  hub.setSources({ reminders: [reminder('a', 'low', NOW)] });
  assert.deepEqual(vistos, ['repouso', 'lembrete']);
  hub.stop();
});

test('hub: o relógio interno vence o pulso do player sem ninguém mandar nada', () => {
  const clock = fakeClock(NOW);
  const hub = createIslandHub({ now: clock.now, setInterval: clock.setInterval, clearInterval: clock.clearInterval });
  const vistos = [];
  hub.subscribe(s => vistos.push(s.line.kind));
  hub.setPlayer(playing(NOW));
  clock.advance(1000);
  clock.advance(1000);
  clock.advance(1000);
  assert.deepEqual(vistos, ['repouso', 'player', 'repouso']);
  hub.stop();
});

test('hub: sem ouvintes o relógio para', () => {
  const clock = fakeClock(NOW);
  const hub = createIslandHub({ now: clock.now, setInterval: clock.setInterval, clearInterval: clock.clearInterval });
  const parar = hub.subscribe(() => {});
  assert.equal(clock.running, true);
  parar();
  assert.equal(clock.running, false);
});

test('hub: seções vêm das configurações a cada cálculo', () => {
  let sections = {};
  const hub = createIslandHub({ getSections: () => sections, now: () => NOW });
  hub.setSources({ reminders: [reminder('a', 'critical', NOW)] });
  assert.equal(hub.current().line.kind, 'lembrete');
  sections = { lembretes: false };
  assert.equal(hub.current().line.kind, 'repouso');
});

// ------------------------------------------------ dados das seções abertas

test('as seções recebem próxima, foco e dia mesmo fora da linha', () => {
  const s = resolve({
    sources: {
      next: { id: 'a', title: 'Longe', dueAt: NOW + 3 * 60 * MIN },
      focus: { ...runningFocus, running: false, leftMs: 5 * MIN, totalMs: 25 * MIN },
      day: { done: 1, total: 4 },
    },
    now: NOW,
  });
  assert.equal(s.line.kind, 'repouso');
  assert.equal(s.next.title, 'Longe');
  assert.equal(s.focus.leftMs, 5 * MIN);
  assert.equal(s.focus.totalMs, 25 * MIN);
  assert.deepEqual(s.day, { done: 1, total: 4 });
});

test('foco desligado também some do painel', () => {
  const s = resolve({ sources: { focus: runningFocus }, sections: { foco: false }, now: NOW });
  assert.equal(s.focus, null);
});
