#!/usr/bin/env node
/*
 * Compila o helper nativo (native/tudu-helper) e confere se o Windows deixa
 * ele rodar.
 *
 * O Controle Inteligente de Aplicativos do Windows 11 decide por arquivo: um
 * .exe sem assinatura pode ser barrado numa compilação e liberado na seguinte.
 * Depois de compilar, este script roda `tudu-helper.exe battery`. Se o Windows
 * barrar, recompila com uma variação (TUDU_BUILD_SALT, uma constante que não
 * muda nada no comportamento) — no máximo MAX_TRIES vezes.
 *
 * Se nenhuma passar, o build não falha: o app usa a reserva em PowerShell
 * (electron/native-helper.cjs). A solução definitiva é assinar o .exe.
 */
'use strict';
const { spawnSync } = require('child_process');
const path = require('path');

const MAX_TRIES = 6;
const root = path.join(__dirname, '..');
const manifest = path.join(root, 'native', 'tudu-helper', 'Cargo.toml');
const exe = path.join(root, 'native', 'tudu-helper', 'target', 'release', 'tudu-helper.exe');

function build(salt) {
  const env = { ...process.env };
  if (salt) env.TUDU_BUILD_SALT = salt; else delete env.TUDU_BUILD_SALT;
  const r = spawnSync(process.execPath,
    [path.join(__dirname, 'cargo-sac.cjs'), 'cargo', 'build', '--release', '--manifest-path', manifest],
    { stdio: 'inherit', env });
  return r.status === 0;
}

function runs() {
  const r = spawnSync(exe, ['battery'], { encoding: 'utf8', timeout: 10000, windowsHide: true });
  return !r.error && r.status === 0 && /"t":"battery"/.test(r.stdout || '');
}

if (process.platform !== 'win32') {
  console.log('[build-native] fora do Windows: nada a fazer.');
  process.exit(0);
}

let salt = process.env.TUDU_BUILD_SALT || '';
for (let i = 1; i <= MAX_TRIES; i++) {
  if (!build(salt)) process.exit(1);
  if (runs()) {
    console.log(`[build-native] helper ok${salt ? ` (variação ${salt})` : ''}`);
    process.exit(0);
  }
  salt = String(Date.now());
  console.warn(`[build-native] o Windows barrou o helper; recompilando com variação (${i + 1}/${MAX_TRIES})`);
}
console.warn('[build-native] o Windows continua barrando o helper: o app vai usar a reserva em PowerShell.');
process.exit(0);
