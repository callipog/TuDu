'use strict';
/*
 * Ponte nativa com o Windows (native/tudu-helper, em Rust). Um único .exe com
 * vários modos — media, desktop, indicators, battery — que conversa por linhas
 * JSON no stdout e comandos no stdin. Substitui os helpers em PowerShell, que
 * custavam ~100 MB de RAM cada; o nativo fica em 1–3 MB.
 *
 * Reserva: o Controle Inteligente de Aplicativos do Windows 11 ("Smart App
 * Control") pode barrar um .exe sem assinatura. Por isso, antes do primeiro
 * uso, o helper é testado uma vez (modo "battery", que responde e sai). Se o
 * Windows barrar, os mesmos modos rodam pelos scripts PowerShell antigos
 * (assinados pela Microsoft): mais pesados, mas nada quebra.
 *
 * No app instalado o .exe vai em resources/ (extraResources: fora do app.asar,
 * onde o Windows consegue executá-lo). Em desenvolvimento, sai direto do
 * target/release do cargo.
 */

const fs = require('fs');
const path = require('path');
const { spawn, spawnSync, execFile } = require('child_process');

const EXE = 'tudu-helper.exe';
const SCRIPTS = { media: 'media-helper.ps1', desktop: 'desktop-helper.ps1', indicators: 'indicators-helper.ps1' };

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

let probe;        // { native: boolean, battery: object|null }
/**
 * O Windows deixa o helper nativo rodar? Testa uma vez (~30 ms) e guarda.
 * Devolve também a resposta do modo battery, que serve para a ilha.
 */
function nativeProbe() {
  if (probe) return probe;
  const exe = helperPath();
  if (!exe) { probe = { native: false, battery: null, reason: 'ausente' }; return probe; }
  let r;
  try {
    r = spawnSync(exe, ['battery'], { windowsHide: true, timeout: 5000, encoding: 'utf8' });
  } catch (err) {
    r = { error: err };
  }
  const msg = !r.error && r.status === 0 ? parseLine(String(r.stdout || '').split('\n')[0]) : null;
  probe = msg
    ? { native: true, battery: msg }
    : { native: false, battery: null, reason: (r.error && (r.error.code || r.error.message)) || `saiu com ${r.status}` };
  return probe;
}

/** Está usando o nativo (true) ou a reserva em PowerShell (false)? */
function usingNative() {
  return nativeProbe().native;
}

function spawnPowerShell(mode) {
  const file = SCRIPTS[mode];
  if (!file) throw new Error('modo sem reserva: ' + mode);
  // -EncodedCommand e não -File: no app empacotado o script mora dentro do
  // app.asar, que o Node lê mas o PowerShell não enxerga.
  const script = fs.readFileSync(path.join(__dirname, file), 'utf-8');
  const encoded = Buffer.from(script, 'utf16le').toString('base64');
  return spawn('powershell.exe',
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded],
    { windowsHide: true, stdio: ['pipe', 'pipe', 'ignore'] });
}

/** Abre o helper num modo de longa duração (stdin/stdout em pipe). Pode lançar. */
function spawnHelper(mode) {
  if (process.platform !== 'win32') throw new Error('só no Windows');
  if (usingNative()) {
    return spawn(helperPath(), [mode], { windowsHide: true, stdio: ['pipe', 'pipe', 'ignore'] });
  }
  return spawnPowerShell(mode);
}

/** O PC tem bateria? Pelo nativo (já respondido no teste) ou pelo PowerShell. */
function askBattery() {
  return new Promise(resolve => {
    if (process.platform !== 'win32') return resolve(null);
    const p = nativeProbe();
    if (p.native) return resolve(p.battery);
    execFile('powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', '[bool](Get-CimInstance Win32_Battery)'],
      { windowsHide: true, timeout: 15000 },
      (err, stdout) => resolve({ t: 'battery', present: !err && /true/i.test(String(stdout)) }));
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

module.exports = { helperPath, nativeProbe, usingNative, spawnHelper, askBattery, parseLine };
