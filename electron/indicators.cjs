'use strict';
/*
 * Indicadores da ilha: volume, microfone mudo, Caps/Num Lock e brilho.
 *
 * O helper nativo (native-helper.cjs, modo "indicators") lê o Windows e
 * escreve uma linha JSON por mudança. Aqui viram "flashes" curtos na ilha, no
 * lugar do aviso do Windows. Mesmo esquema do player (media.cjs): reinício
 * limitado se cair, e sem o helper a ilha só fica sem indicadores.
 */

const { spawnHelper, parseLine } = require('./native-helper.cjs');

const MAX_RESTARTS = 3;
const RESTART_WINDOW_MS = 60_000;
/** Quanto tempo o indicador fica na ilha depois da última mudança. */
const FLASH_MS = 1600;

const KINDS = ['volume', 'brightness', 'keys', 'mic', 'media'];

const DEFAULTS = Object.freeze({
  enabled: false,
  hideOsd: false,
  show: Object.freeze({ volume: true, brightness: true, keys: true, mic: true, media: true }),
});

function bool(v, f) { return typeof v === 'boolean' ? v : f; }

function normalizeIndicatorsConfig(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const sh = src.show && typeof src.show === 'object' ? src.show : {};
  const show = {};
  for (const k of KINDS) show[k] = bool(sh[k], DEFAULTS.show[k]);
  return { enabled: bool(src.enabled, DEFAULTS.enabled), hideOsd: bool(src.hideOsd, DEFAULTS.hideOsd), show };
}

function level(v) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;
}

/**
 * Converte uma mensagem do helper no indicador que a ilha desenha, ou null.
 * Leituras iniciais (`init`) não viram indicador: a ilha não anuncia o estado
 * que já estava ao abrir. Para teclas, diz qual mudou comparando com antes.
 */
function toIndicator(msg, prevKeys, show, now) {
  if (!msg || msg.init) return null;
  const s = show || DEFAULTS.show;
  if (msg.t === 'volume' && s.volume) return { kind: 'volume', level: level(msg.level), muted: !!msg.muted, at: now };
  if (msg.t === 'brightness' && s.brightness) return { kind: 'brightness', level: level(msg.level), at: now };
  if (msg.t === 'mic' && s.mic) return { kind: 'mic', muted: !!msg.muted, at: now };
  if (msg.t === 'keys' && s.keys) {
    const p = prevKeys || {};
    if (!!msg.caps !== !!p.caps) return { kind: 'caps', on: !!msg.caps, at: now };
    if (!!msg.num !== !!p.num) return { kind: 'num', on: !!msg.num, at: now };
  }
  return null;
}

function createIndicatorsBridge({ onIndicator, onOsd, log = console } = {}) {
  let child = null;
  let wanted = false;
  let available = process.platform === 'win32';
  let show = DEFAULTS.show;
  let hideOsd = false;
  let keys = null;
  let osdFound = null;
  const restarts = [];
  let buffer = '';

  function send(line) {
    if (!child) return;
    try { child.stdin.write(line + '\n'); } catch { /* ignore */ }
  }

  function configure(cfg) {
    const c = normalizeIndicatorsConfig(cfg);
    show = c.show;
    if (c.hideOsd !== hideOsd) { hideOsd = c.hideOsd; send('hideosd ' + (hideOsd ? 1 : 0)); }
  }

  function start() {
    wanted = true;
    if (!available || child) return;
    try {
      child = spawnHelper('indicators');
    } catch (err) {
      log.error('indicadores: não deu para abrir o helper', err && err.message);
      child = null;
      retry();
      return;
    }
    if (hideOsd) send('hideosd 1');

    child.stdout.setEncoding('utf-8');
    child.stdout.on('data', chunk => {
      buffer += chunk;
      let nl;
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const msg = parseLine(buffer.slice(0, nl));
        buffer = buffer.slice(nl + 1);
        if (!msg) continue;
        if (msg.t === 'error') { log.warn('indicadores: indisponível —', msg.message); available = false; continue; }
        if (msg.t === 'osd') { osdFound = !!msg.found; if (onOsd) onOsd(osdFound); continue; }
        const ind = toIndicator(msg, keys, show, Date.now());
        if (msg.t === 'keys') keys = { caps: !!msg.caps, num: !!msg.num };
        if (ind && onIndicator) onIndicator(ind);
      }
    });
    child.on('error', err => log.warn('indicadores: helper falhou', err && err.message));
    child.on('exit', () => {
      child = null;
      buffer = '';
      keys = null;
      retry();
    });
  }

  function retry() {
    if (!wanted || !available) return;
    const now = Date.now();
    while (restarts.length && now - restarts[0] > RESTART_WINDOW_MS) restarts.shift();
    if (restarts.length >= MAX_RESTARTS) { log.warn('indicadores: desisti depois de várias quedas seguidas'); return; }
    restarts.push(now);
    setTimeout(() => { if (wanted) start(); }, 2000);
  }

  function stop() {
    wanted = false;
    if (child) {
      // Fechar o stdin encerra o helper; se o aviso estava escondido, devolve antes.
      if (hideOsd) send('hideosd 0');
      try { child.stdin.end(); } catch { /* ignore */ }
      const c = child;
      setTimeout(() => { try { c.kill(); } catch { /* ignore */ } }, 1500);
    }
  }

  return { start, stop, configure, osdFound: () => osdFound, isAvailable: () => available };
}

module.exports = { createIndicatorsBridge, normalizeIndicatorsConfig, toIndicator, parseLine, FLASH_MS, DEFAULTS };
