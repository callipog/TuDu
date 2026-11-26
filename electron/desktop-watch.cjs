'use strict';
/*
 * Vigia da área de trabalho: o helper nativo (native-helper.cjs, modo
 * "desktop") deixa a ilha por cima enquanto a área de trabalho estiver em
 * primeiro plano — o Win+D não minimiza as janelas, ele põe a área de trabalho
 * na frente delas, e a ilha ficava escondida atrás.
 *
 * Se algo falhar, a ilha só perde este truque.
 */

const { spawnHelper, parseLine } = require('./native-helper.cjs');

/** HWND da janela, como número decimal. */
function hwndOf(win) {
  const buf = win.getNativeWindowHandle();
  return buf.length >= 8 ? buf.readBigUInt64LE(0).toString() : String(buf.readUInt32LE(0));
}

function createDesktopWatch({ onChange, log = console } = {}) {
  let child = null;
  let available = process.platform === 'win32';
  let target = null;
  let auto = true;
  let onDesktop = false;
  let buffer = '';
  let restarts = 0;

  function send(line) {
    if (!child) return;
    try { child.stdin.write(line + '\n'); } catch { /* ignore */ }
  }

  function start() {
    if (!available || child) return;
    try {
      child = spawnHelper('desktop');
    } catch (err) {
      log.error('desktop: não deu para abrir o helper', err && err.message);
      child = null;
      // O antivírus às vezes segura o .exe um instante: tenta de novo, poucas vezes.
      if (target && restarts < 3) { restarts++; setTimeout(() => { if (target) start(); }, 2000); }
      return;
    }
    send(`pid ${process.pid}`);
    send(`auto ${auto ? 1 : 0}`);
    if (target) send(`hwnd ${target}`);

    child.stdout.setEncoding('utf-8');
    child.stdout.on('data', chunk => {
      buffer += chunk;
      let nl;
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const msg = parseLine(buffer.slice(0, nl));
        buffer = buffer.slice(nl + 1);
        if (!msg) continue;
        if (msg.t === 'error') { log.warn('desktop: indisponível —', msg.message); available = false; continue; }
        if (msg.t === 'desktop') {
          onDesktop = !!msg.on;
          if (onChange) onChange(onDesktop, msg.cls);
        }
      }
    });
    child.on('error', err => log.warn('desktop: helper falhou', err && err.message));
    const me = child;
    child.on('exit', () => {
      if (child !== me) return;   // parado de propósito, ou já trocado por outro
      child = null;
      buffer = '';
      onDesktop = false;
      if (!available || !target || restarts >= 3) return;
      restarts++;
      setTimeout(() => { if (target) start(); }, 2000);
    });
  }

  /** Aponta para a janela da ilha (ou null para parar). */
  function setTarget(win) {
    if (!win) { target = null; stop(); return; }
    target = hwndOf(win);
    start();
    send(`hwnd ${target}`);
  }

  /** false enquanto o TuDu já força a ilha por cima (alfinete, lembrete crítico). */
  function setAuto(on) {
    if (auto === !!on) return;
    auto = !!on;
    send(`auto ${auto ? 1 : 0}`);
  }

  function stop() {
    const c = child;
    child = null;
    onDesktop = false;
    if (c) {
      try { c.stdin.end(); } catch { /* ignore */ }
      setTimeout(() => { try { c.kill(); } catch { /* ignore */ } }, 1500);
    }
  }

  return { setTarget, setAuto, stop, isOnDesktop: () => onDesktop };
}

module.exports = { createDesktopWatch };
