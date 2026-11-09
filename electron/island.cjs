'use strict';
/*
 * Hub da ilha no processo principal.
 *
 * Junta as fontes que moram em lugares diferentes — o retrato do renderer
 * (tarefas, foco, lembretes: só ele enxerga o IndexedDB) e, mais adiante, o
 * player, que vem do SMTC do Windows aqui no processo principal — e passa
 * tudo pelo resolvedor.
 *
 * Várias regras dependem do relógio (o pulso de 3s do player, a janela de
 * 30 min do próximo compromisso, o "agora" dos lembretes). Por isso, enquanto
 * houver alguém ouvindo, o hub reavalia a cada segundo — e só avisa quando o
 * resultado muda de fato.
 */

const { resolve } = require('./island-queue.cjs');

function createIslandHub(options) {
  const opts = options || {};
  const getSections = opts.getSections || (() => ({}));
  const now = opts.now || Date.now;
  const tickMs = opts.tickMs || 1000;
  const setTimer = opts.setInterval || setInterval;
  const clearTimer = opts.clearInterval || clearInterval;

  let sources = {};
  let player = null;
  let last = null;
  let lastKey = '';
  let timer = null;
  const listeners = new Set();

  function compute() {
    return resolve({ sources, player, sections: getSections(), now: now() });
  }

  /* Recalcula e, se mudou, entrega para quem estiver ouvindo. */
  function refresh() {
    const state = compute();
    const key = JSON.stringify(state);
    if (key !== lastKey) {
      lastKey = key;
      last = state;
      for (const cb of listeners) {
        try { cb(state); } catch (err) { console.error('island listener', err); }
      }
    }
    return last;
  }

  return {
    /** Retrato vindo do renderer. Já é sanitizado dentro do resolvedor. */
    setSources(raw) {
      sources = raw && typeof raw === 'object' ? raw : {};
      return refresh();
    },

    /** Faixa atual do player (SMTC). `null` quando nada toca. */
    setPlayer(p) {
      player = p && typeof p === 'object' ? p : null;
      return refresh();
    },

    /** Configurações mudaram (seções ligadas/desligadas). */
    refresh,

    /** Estado atual, calculado na hora — para quem acabou de abrir. */
    current() {
      return compute();
    },

    /**
     * Ouve mudanças. O relógio interno só roda enquanto houver ouvinte, então
     * sem a janela da ilha aberta o hub não gasta nada.
     */
    subscribe(cb) {
      // Calcula antes de entrar na lista: assim o novo ouvinte recebe o estado
      // uma vez só, mesmo quando o cálculo também avisa os que já estavam.
      const state = refresh();
      listeners.add(cb);
      if (!timer) timer = setTimer(refresh, tickMs);
      cb(state);
      return () => {
        listeners.delete(cb);
        if (listeners.size === 0 && timer) {
          clearTimer(timer);
          timer = null;
        }
      };
    },

    /** Para testes e encerramento. */
    stop() {
      listeners.clear();
      if (timer) { clearTimer(timer); timer = null; }
    },
  };
}

module.exports = { createIslandHub };
