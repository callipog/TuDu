'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeNotificationsConfig, toNotification, rememberApp, isOwn } = require('./notifications.cjs');

const msg = (o) => ({ t: 'notif', id: 1, app: 'WhatsApp', appId: '5319275A.WhatsAppDesktop_cv1g1gvanyjgm!App', title: 'Ana', body: 'Chego em 5 min', at: 1, ...o });

test('desligado por padrão: nada passa', () => {
  assert.equal(normalizeNotificationsConfig(undefined).enabled, false);
  assert.equal(toNotification(msg(), undefined, 100), null);
});

test('ligado: vira notificação da ilha contada a partir de agora', () => {
  const n = toNotification(msg(), { enabled: true }, 500);
  assert.deepEqual(n, { app: 'WhatsApp', title: 'Ana', body: 'Chego em 5 min', at: 500 });
});

test('apps silenciados ficam de fora (sem diferenciar maiúsculas)', () => {
  assert.equal(toNotification(msg(), { enabled: true, muted: ['whatsapp'] }, 1), null);
  assert.ok(toNotification(msg({ app: 'Discord' }), { enabled: true, muted: ['WhatsApp'] }, 1));
});

test('notificações do próprio TuDu nunca aparecem', () => {
  assert.equal(isOwn(msg({ app: 'TuDu', appId: 'com.tudu.app' })), true);
  assert.equal(isOwn(msg({ app: 'Electron', appId: String.raw`C:\TuDu\TuDu.exe` })), true);
  assert.equal(toNotification(msg({ app: 'TuDu', appId: 'com.tudu.app' }), { enabled: true }, 1), null);
  assert.equal(isOwn(msg()), false);
});

test('sem app ou sem texto é ignorado; lista de apps sem repetir', () => {
  assert.equal(toNotification(msg({ app: '' }), { enabled: true }, 1), null);
  assert.equal(toNotification(msg({ title: '', body: '' }), { enabled: true }, 1), null);
  let l = rememberApp([], 'Discord');
  l = rememberApp(l, 'WhatsApp');
  l = rememberApp(l, 'discord');
  assert.deepEqual(l, ['WhatsApp', 'Discord']);
  assert.equal(normalizeNotificationsConfig({ muted: ['a', 'a', 7, ''] }).muted.length, 1);
});
