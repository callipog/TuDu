#!/usr/bin/env node
/*
 * Roda um comando de build do Rust (cargo ou tauri) contornando o Controle
 * Inteligente de Aplicativos do Windows 11 ("Smart App Control").
 *
 * O SAC às vezes barra um build-script recém-compilado (os error 4551: "Uma
 * política de Controle de Aplicativo bloqueou este arquivo"). Recompilar esse
 * build-script gera um binário novo que costuma passar. Este script detecta o
 * bloqueio, apaga só a pasta do build-script barrado e tenta de novo — no
 * máximo MAX_TRIES vezes, para nunca entrar em laço.
 *
 * Uso: node scripts/cargo-sac.cjs <comando> [args...]
 *   ex.: node scripts/cargo-sac.cjs cargo build --release --manifest-path native/tudu-helper/Cargo.toml
 */
'use strict';
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const MAX_TRIES = 8;
const [cmd, ...args] = process.argv.slice(2);
if (!cmd) {
  console.error('uso: node scripts/cargo-sac.cjs <comando> [args...]');
  process.exit(2);
}

// "could not execute process `C:\...\build\serde_core-abc123\build-script-build` (never executed)"
const BLOCKED = /could not execute process `([^`]+[\\/]build[\\/][^\\/`]+)[\\/]build-script-[^`]+`[\s\S]*?(?:os error 4551|Controle de Aplicativo|Application Control)/g;

for (let i = 1; i <= MAX_TRIES; i++) {
  const r = spawnSync(cmd, args, { shell: true, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  process.stdout.write(r.stdout || '');
  process.stderr.write(r.stderr || '');
  if (r.status === 0) process.exit(0);

  const out = (r.stdout || '') + (r.stderr || '');
  const dirs = [...out.matchAll(BLOCKED)].map(m => m[1]);
  if (!dirs.length) process.exit(r.status || 1);   // falhou por outro motivo

  for (const d of new Set(dirs)) {
    // Só apaga pastas de build-script dentro de um target/ — nada fora disso.
    const abs = path.resolve(d);
    if (!/[\\/]target[\\/].+[\\/]build[\\/][^\\/]+$/.test(abs)) {
      console.error(`[cargo-sac] caminho inesperado, não apago: ${abs}`);
      process.exit(1);
    }
    console.error(`[cargo-sac] o Windows barrou ${path.basename(abs)}; recompilando (tentativa ${i + 1}/${MAX_TRIES})`);
    fs.rmSync(abs, { recursive: true, force: true });
  }
}
console.error('[cargo-sac] o Windows continuou barrando depois de várias tentativas.');
process.exit(1);
