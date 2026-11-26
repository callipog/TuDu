'use strict';
/*
 * Notificações de outros apps na ilha (WhatsApp, Discord, e-mail...).
 *
 * O helper nativo (native-helper.cjs, modo "notifications") lê a central de
 * notificações do Windows e avisa cada notificação nova. Aqui elas passam pelo
 * filtro — as do próprio TuDu ficam de fora (os lembretes já moram na ilha) e
 * os apps silenciados pela pessoa também — e viram uma linha de 6s na ilha.
 * Funciona inclusive com o "Não incomodar" do Windows ligado: o aviso não pula
 * na tela, mas a notificação continua indo para a central.
 *
 * O texto nunca é gravado: só passa para a ilha. O que fica salvo é a lista de
 * apps que já mandaram notificação (para a tela de Configurações).
 */

const { spawnHelper, parseLine } = require('./native-helper.cjs');

const MAX_RESTARTS = 3;
const RESTART_WINDOW_MS = 60_000;
const MAX_APPS = 40;
const OWN_APP_IDS = ['com.tudu.app'];
const OWN_NAMES = ['tudu'];

const DEFAULTS = Object.freeze({ enabled: false, muted: Object.freeze([]) });

function cleanName(v) {
  return typeof v === 'string' ? v.trim().slice(0, 60) : '';
}

function normalizeNotificationsConfig(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const muted = [];
  for (const m of Array.isArray(src.muted) ? src.muted : []) {
    const n = cleanName(m);
    if (n && !muted.includes(n) && muted.length < MAX_APPS) muted.push(n);
  }
  return { enabled: typeof src.enabled === 'boolean' ? src.enabled : DEFAULTS.enabled, muted };
}

/** É do próprio TuDu? (lembretes e avisos dele já aparecem na ilha) */
function isOwn(msg) {
  const id = String(msg.appId || '').toLowerCase();
  const name = String(msg.app || '').trim().toLowerCase();
  return OWN_APP_IDS.some(x => id === x || id.endsWith('\\' + x)) || OWN_NAMES.includes(name) || /\\tudu\.exe$/i.test(id);
}

/**
 * Converte a mensagem do helper na notificação que a ilha mostra, ou null.
 * `now`: o instante em que chegou (o horário de criação vem do Windows e pode
 * estar adiantado ou atrasado; a ilha conta os 6s a partir de agora).
 */
function toNotification(msg, cfg, now) {
  if (!msg || msg.t !== 'notif') return null;
  const c = normalizeNotificationsConfig(cfg);
  if (!c.enabled) return null;
  const app = cleanName(msg.app);
  if (!app || isOwn(msg)) return null;
  if (c.muted.some(m => m.toLowerCase() === app.toLowerCase())) return null;
  const title = typeof msg.title === 'string' ? msg.title.slice(0, 120) : '';
  const body = typeof msg.body === 'string' ? msg.body.slice(0, 160) : '';
  if (!title && !body) return null;
  return { app, title, body, at: now };
}

/** Lista de apps conhecidos, com o novo no começo (sem repetir, no máximo 40). */
function rememberApp(list, app) {
  const n = cleanName(app);
  const atual = Array.isArray(list) ? list.filter(x => typeof x === 'string') : [];
  if (!n || atual.some(x => x.toLowerCase() === n.toLowerCase())) return atual;
  return [n, ...atual].slice(0, MAX_APPS);
}

function createNotificationsBridge({ onNotification, onApp, onAccess, log = console } = {}) {
  let child = null;
  let wanted = false;
  let available = process.platform === 'win32';
  let cfg = normalizeNotificationsConfig(null);
  const restarts = [];
  let buffer = '';

  function configure(next) {
    cfg = normalizeNotificationsConfig(next);
  }

  function start() {
    wanted = true;
    if (!available || child) return;
    try {
      child = spawnHelper('notifications');
    } catch (err) {
      log.error('notificações: não deu para abrir o helper', err && err.message);
      child = null;
      retry();
      return;
    }
    child.stdout.setEncoding('utf-8');
    child.stdout.on('data', chunk => {
      buffer += chunk;
      let nl;
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const msg = parseLine(buffer.slice(0, nl));
        buffer = buffer.slice(nl + 1);
        if (!msg) continue;
        if (msg.t === 'error') {
          log.warn('notificações: indisponível —', msg.access || msg.message);
          available = false;
          if (onAccess) onAccess(msg.access || 'unavailable');
          continue;
        }
        if (msg.t === 'ready') { if (onAccess) onAccess('allowed'); continue; }
        if (msg.t !== 'notif') continue;
        if (!isOwn(msg) && onApp) onApp(cleanName(msg.app));
        const n = toNotification(msg, cfg, Date.now());
        if (n && onNotification) onNotification(n);
      }
    });
    child.on('error', err => log.warn('notificações: helper falhou', err && err.message));
    child.on('exit', () => {
      child = null;
      buffer = '';
      retry();
    });
  }

  function retry() {
    if (!wanted || !available) return;
    const now = Date.now();
    while (restarts.length && now - restarts[0] > RESTART_WINDOW_MS) restarts.shift();
    if (restarts.length >= MAX_RESTARTS) { log.warn('notificações: desisti depois de várias quedas seguidas'); return; }
    restarts.push(now);
    setTimeout(() => { if (wanted) start(); }, 2000);
  }

  function stop() {
    wanted = false;
    if (child) {
      try { child.stdin.end(); } catch { /* ignore */ }
      const c = child;
      setTimeout(() => { try { c.kill(); } catch { /* ignore */ } }, 1500);
    }
  }

  return { start, stop, configure, isAvailable: () => available };
}

module.exports = { createNotificationsBridge, normalizeNotificationsConfig, toNotification, rememberApp, isOwn, DEFAULTS };
