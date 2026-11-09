// Aparência das colunas do board (Kanban): o brilho da borda e o arredondamento.
// Mesmo desenho do themeService: o valor vive no localStorage, e `apply` só
// escreve um atributo e duas variáveis no <html> — quem desenha é o index.css.
// Assim nenhuma classe é montada em runtime (o scanner do Tailwind não as veria).

export type BoardGlow = 'none' | 'halo' | 'inner' | 'gradient' | 'double' | 'focus';
export type BoardRadius = 16 | 15 | 14 | 12;

export const BOARD_GLOWS: { id: BoardGlow; label: string; hint: string }[] = [
  { id: 'none',     label: 'Sem brilho',  hint: 'Só a borda tingida. É como o board sempre foi.' },
  { id: 'halo',     label: 'Halo',        hint: 'A cor da etapa vaza suave para fora da coluna.' },
  { id: 'inner',    label: 'Luz interna', hint: 'A borda acende para dentro, sem invadir o fundo.' },
  { id: 'gradient', label: 'Degradê',     hint: 'Borda viva no topo, apagando até a base.' },
  { id: 'double',   label: 'Duplo',       hint: 'Halo e luz interna somados. O mais presente.' },
  { id: 'focus',    label: 'Só no foco',  hint: 'Acende ao passar o mouse ou arrastar um card.' },
];

export const BOARD_RADII: BoardRadius[] = [16, 15, 14, 12];

const DEFAULT_GLOW: BoardGlow = 'none';
const DEFAULT_RADIUS: BoardRadius = 16;

const GLOW_KEY = 'tudu_board_glow';
const RADIUS_KEY = 'tudu_board_radius';

function isGlow(v: unknown): v is BoardGlow {
  return BOARD_GLOWS.some(g => g.id === v);
}

function isRadius(v: unknown): v is BoardRadius {
  return (BOARD_RADII as number[]).includes(Number(v));
}

export const boardStyleService = {
  getGlow(): BoardGlow {
    try {
      const v = localStorage.getItem(GLOW_KEY);
      if (isGlow(v)) return v;
    } catch { /* ignore */ }
    return DEFAULT_GLOW;
  },

  getRadius(): BoardRadius {
    try {
      const v = Number(localStorage.getItem(RADIUS_KEY));
      if (isRadius(v)) return v as BoardRadius;
    } catch { /* ignore */ }
    return DEFAULT_RADIUS;
  },

  apply() {
    const el = document.documentElement;
    const radius = this.getRadius();
    el.dataset.boardGlow = this.getGlow();
    el.style.setProperty('--board-radius', `${radius}px`);
    // O card fica dois pixels mais fechado que a coluna: encaixado, não concêntrico.
    el.style.setProperty('--board-card-radius', `${Math.max(8, radius - 2)}px`);
  },

  setGlow(glow: BoardGlow) {
    try { localStorage.setItem(GLOW_KEY, glow); } catch { /* ignore */ }
    this.apply();
  },

  setRadius(radius: BoardRadius) {
    try { localStorage.setItem(RADIUS_KEY, String(radius)); } catch { /* ignore */ }
    this.apply();
  },

  init() {
    this.apply();
  },
};
