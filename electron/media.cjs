'use strict';
/*
 * Player da ilha: conversa com o controle de mídia do Windows (SMTC) por meio
 * de um PowerShell filho (media-helper.ps1). Sem módulo nativo para compilar.
 *
 * O script vai por -EncodedCommand, não por -File: no app empacotado ele mora
 * dentro do app.asar, que o Node lê mas o PowerShell não enxerga.
 *
 * Se o PowerShell faltar ou o WinRT recusar, o player simplesmente não existe
 * — a ilha segue funcionando sem ele.
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const MAX_RESTARTS = 3;
const RESTART_WINDOW_MS = 60_000;

/** Lê o que o helper escreve: uma linha JSON por evento. Puro, para testar. */
function parseLine(line) {
  const s = String(line || '').trim();
  if (!s || s[0] !== '{') return null;
  try {
    const msg = JSON.parse(s);
    return msg && typeof msg === 'object' && typeof msg.t === 'string' ? msg : null;
  } catch {
    return null;
  }
}

/**
 * Funde um evento no estado do player. Devolve o estado novo, ou o mesmo
 * objeto quando nada mudou. `trackChangedAt` marca a troca de faixa, que é o
 * que acende o pulso de 3s na ilha — a primeira faixa vista ao abrir não conta,
 * senão a ilha "anunciaria" uma música que já estava tocando.
 */
function applyMessage(prev, msg, now) {
  if (!msg) return prev;
  if (msg.t === 'state') {
    if (!msg.active) return prev && prev.active === false ? prev : { active: false };
    const track = `${msg.title || ''}|${msg.artist || ''}`;
    const before = prev && prev.active ? `${prev.title || ''}|${prev.artist || ''}` : null;
    const changed = before !== null && before !== track;
    const sameTrack = before === track;
    return {
      active: true,
      app: String(msg.app || ''),
      title: String(msg.title || ''),
      artist: String(msg.artist || ''),
      playing: !!msg.playing,
      position: Number(msg.position) || 0,
      duration: Number(msg.duration) || 0,
      updatedAt: Number(msg.updatedAt) || now,
      // A capa da faixa anterior não serve para a nova; a certa vem logo atrás.
      art: sameTrack ? prev.art : null,
      trackChangedAt: changed ? now : (sameTrack ? prev.trackChangedAt : null),
    };
  }
  if (msg.t === 'art') {
    // O helper manda a capa logo depois do estado da faixa a que ela pertence.
    if (!prev || !prev.active || `${prev.title}|${prev.artist}` !== msg.track) return prev;
    const data = typeof msg.data === 'string' && msg.data.startsWith('data:image/') ? msg.data : null;
    return data === prev.art ? prev : { ...prev, art: data };
  }
  return prev;
}

/** O que a fila de prioridade precisa saber (sem a capa, que é pesada). */
function forQueue(p) {
  if (!p || !p.active) return null;
  return { title: p.title, artist: p.artist, playing: p.playing, trackChangedAt: p.trackChangedAt };
}

/** O que a janela da ilha desenha. */
function forIsland(p) {
  if (!p || !p.active) return null;
  return {
    title: p.title, artist: p.artist, playing: p.playing, app: p.app,
    position: p.position, duration: p.duration, updatedAt: p.updatedAt, art: p.art,
  };
}

function createMediaBridge({ onChange, log = console } = {}) {
  let child = null;
  let state = null;
  let wanted = false;
  let available = process.platform === 'win32';
  const restarts = [];
  let buffer = '';

  function emit(next) {
    if (next === state) return;
    state = next;
    if (onChange) onChange(state);
  }

  function start() {
    wanted = true;
    if (!available || child) return;
    let script;
    try {
      script = fs.readFileSync(path.join(__dirname, 'media-helper.ps1'), 'utf-8');
    } catch (err) {
      log.error('media: script ausente', err);
      available = false;
      return;
    }
    const encoded = Buffer.from(script, 'utf16le').toString('base64');
    try {
      child = spawn('powershell.exe',
        ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded],
        { windowsHide: true, stdio: ['pipe', 'pipe', 'ignore'] });
    } catch (err) {
      log.error('media: não deu para abrir o PowerShell', err);
      available = false;
      child = null;
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
          log.warn('media: indisponível —', msg.message);
          available = false;
          continue;
        }
        emit(applyMessage(state, msg, Date.now()));
      }
    });
    child.on('error', err => {
      log.warn('media: PowerShell falhou', err && err.message);
      available = false;
    });
    child.on('exit', () => {
      child = null;
      buffer = '';
      emit(null);
      if (!wanted || !available) return;
      // Caiu sozinho: tenta de novo, mas não em laço.
      const now = Date.now();
      while (restarts.length && now - restarts[0] > RESTART_WINDOW_MS) restarts.shift();
      if (restarts.length >= MAX_RESTARTS) {
        log.warn('media: desisti depois de várias quedas seguidas');
        return;
      }
      restarts.push(now);
      setTimeout(() => { if (wanted) start(); }, 2000);
    });
  }

  function stop() {
    wanted = false;
    if (child) {
      try { child.stdin.end(); } catch { /* ignore */ }
      const c = child;
      setTimeout(() => { try { c.kill(); } catch { /* ignore */ } }, 1500);
    }
    emit(null);
  }

  function command(cmd) {
    if (!child || !['toggle', 'next', 'prev', 'pause'].includes(cmd)) return false;
    try { child.stdin.write(cmd + '\n'); return true; } catch { return false; }
  }

  return { start, stop, command, current: () => state, isAvailable: () => available };
}

module.exports = { createMediaBridge, parseLine, applyMessage, forQueue, forIsland };
