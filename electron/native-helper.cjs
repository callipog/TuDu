'use strict';
/*
 * Ponte nativa com o Windows (native/tudu-helper, em Rust). Um único .exe com
 * vários modos — media, desktop, indicators, battery — que conversa por linhas
 * JSON no stdout e comandos no stdin. Substitui os antigos helpers em
 * PowerShell, que custavam ~100 MB de RAM cada; o nativo fica em 1–3 MB.
 *
 * No app instalado o .exe vai em resources/ (extraResources: fora do app.asar,
 * onde o Windows consegue executá-lo). Em desenvolvimento, sai direto do
 * target/release do cargo.
 */

const fs = require('fs');
const path = require('path');
const { spawn, execFile } = require('child_process');

const EXE = 'tudu-helper.exe';

let cached;
/** Caminho do helper, ou null quando ele não existe (ex.: fora do Windows). */
function helperPath() {
  if (cached !== undefined) return cached;
  const candidates = [
    process.resourcesPath && path.join(process.resourcesPath, EXE),
    path.join(__dirname, '..', 'native', 'tudu-helper', 'target', 'release', EXE),
  ].filter(Boolean);
  cached = process.platform === 'win32' ? candidates.find(p => fs.existsSync(p)) || null : null;
  return cached;
}

/** Abre o helper num modo de longa duração (stdin/stdout em pipe). Pode lançar. */
function spawnHelper(mode) {
  const exe = helperPath();
  if (!exe) throw new Error('tudu-helper.exe ausente');
  return spawn(exe, [mode], { windowsHide: true, stdio: ['pipe', 'pipe', 'ignore'] });
}

/** Roda um modo de resposta única e devolve a primeira linha JSON (ou null). */
function askHelper(mode, timeout = 5000) {
  return new Promise(resolve => {
    const exe = helperPath();
    if (!exe) return resolve(null);
    execFile(exe, [mode], { windowsHide: true, timeout }, (err, stdout) => {
      if (err) return resolve(null);
      const line = String(stdout || '').split('\n').find(l => l.trim().startsWith('{'));
      try { resolve(line ? JSON.parse(line) : null); } catch { resolve(null); }
    });
  });
}

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

module.exports = { helperPath, spawnHelper, askHelper, parseLine };
