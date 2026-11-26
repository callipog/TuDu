/**
 * Avisos sonoros do modo foco.
 *
 * Os tons são sintetizados na hora (Web Audio) em vez de virem de arquivos:
 * não há asset para empacotar no Electron nem caminho para quebrar no build,
 * e o resultado é o que se pede — algo curto e discreto, no espírito das
 * notificações de celular, não um alarme.
 */

export type Cue = 'start' | 'pause' | 'finish' | 'sino' | 'gota' | 'digital';

/** Opções de som do fim do foco. `acorde` é o `finish` de sempre. */
export type EndSound = 'acorde' | 'sino' | 'gota' | 'digital' | 'nenhum';
export const END_SOUNDS: EndSound[] = ['acorde', 'sino', 'gota', 'digital', 'nenhum'];
export const END_SOUND_LABEL: Record<EndSound, string> = {
  acorde: 'Acorde', sino: 'Sino', gota: 'Gota', digital: 'Digital', nenhum: 'Sem som',
};

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext ?? (window as any).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) {
    try { ctx = new Ctor(); } catch { return null; }
  }
  // O contexto nasce suspenso até um gesto do usuário; todo cue nosso parte de
  // um clique (ou de um timer que começou com um), então retomar aqui basta.
  if (ctx.state === 'suspended') ctx.resume().catch(() => { /* ignore */ });
  return ctx;
}

/** Uma nota com envelope suave — sem clique no ataque nem no corte. */
function nota(ac: AudioContext, freq: number, atraso: number, duracao: number, volume: number, tipo: OscillatorType = 'sine') {
  const t0 = ac.currentTime + atraso;
  const osc = ac.createOscillator();
  const gain = ac.createGain();

  osc.type = tipo;
  osc.frequency.setValueAtTime(freq, t0);

  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(volume, t0 + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duracao);

  osc.connect(gain);
  gain.connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + duracao + 0.02);
}

// Notas da escala (Hz): A5, C#6, E6, F#5.
const CUES: Record<Cue, { freq: number; em: number; dur: number; vol: number; tipo?: OscillatorType }[]> = {
  // Subindo: "começou".
  start: [
    { freq: 880.0, em: 0, dur: 0.13, vol: 0.16 },
    { freq: 1108.7, em: 0.1, dur: 0.18, vol: 0.14 },
  ],
  // Uma nota grave e curta: "segurou".
  pause: [
    { freq: 740.0, em: 0, dur: 0.16, vol: 0.12 },
  ],
  // Três notas resolvendo: "fechou".
  finish: [
    { freq: 880.0, em: 0, dur: 0.16, vol: 0.16 },
    { freq: 1108.7, em: 0.13, dur: 0.16, vol: 0.15 },
    { freq: 1318.5, em: 0.26, dur: 0.34, vol: 0.15 },
  ],
  // Sino: a fundamental com um harmônico, soando por mais tempo.
  sino: [
    { freq: 1046.5, em: 0, dur: 1.4, vol: 0.16 },
    { freq: 2093.0, em: 0, dur: 0.9, vol: 0.05 },
    { freq: 1046.5, em: 0.55, dur: 1.2, vol: 0.12 },
  ],
  // Gota: duas notas curtas descendo, bem discreto.
  gota: [
    { freq: 1568.0, em: 0, dur: 0.12, vol: 0.14 },
    { freq: 1174.7, em: 0.09, dur: 0.22, vol: 0.12 },
  ],
  // Digital: três bipes iguais, de relógio.
  digital: [
    { freq: 1760, em: 0, dur: 0.08, vol: 0.05, tipo: 'square' },
    { freq: 1760, em: 0.16, dur: 0.08, vol: 0.05, tipo: 'square' },
    { freq: 1760, em: 0.32, dur: 0.08, vol: 0.05, tipo: 'square' },
  ],
};

/** Som do fim do foco (`acorde` = o `finish` de sempre). */
export function playEndSound(s: EndSound) {
  if (s === 'nenhum') return;
  playCue(s === 'acorde' ? 'finish' : s);
}

export function playCue(cue: Cue) {
  const ac = getCtx();
  if (!ac) return;
  try {
    for (const n of CUES[cue]) nota(ac, n.freq, n.em, n.dur, n.vol, n.tipo);
  } catch { /* som nunca deve derrubar o timer */ }
}
