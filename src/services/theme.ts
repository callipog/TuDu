export type Theme = 'dark' | 'light' | 'sepia' | 'system';

const THEME_KEY = 'tudu_theme';
const mql = typeof window !== 'undefined' && window.matchMedia
  ? window.matchMedia('(prefers-color-scheme: light)')
  : null;

function resolve(theme: Theme): 'dark' | 'light' | 'sepia' {
  if (theme === 'system') return mql?.matches ? 'light' : 'dark';
  return theme;
}

export const themeService = {
  get(): Theme {
    try {
      const v = localStorage.getItem(THEME_KEY);
      if (v === 'light' || v === 'dark' || v === 'sepia' || v === 'system') return v;
    } catch { /* ignore */ }
    return 'dark';
  },

  apply(theme: Theme) {
    const resolved = resolve(theme);
    // Sépia herda todo o remapeamento do modo claro (.light) e adiciona
    // por cima seus tons quentes (.sepia).
    // Obs.: a classe usa prefixo `theme-` porque `sepia` sozinho colide com o
    // utilitário do Tailwind `.sepia` (filter: sepia(100%)), que tingiria a tela.
    document.documentElement.classList.toggle('light', resolved === 'light' || resolved === 'sepia');
    document.documentElement.classList.toggle('theme-sepia', resolved === 'sepia');
  },

  set(theme: Theme) {
    try { localStorage.setItem(THEME_KEY, theme); } catch { /* ignore */ }
    this.apply(theme);
  },

  /** Aplica o tema salvo e passa a seguir o SO quando o modo é 'system'. */
  init() {
    this.apply(this.get());
    mql?.addEventListener?.('change', () => {
      if (this.get() === 'system') this.apply('system');
    });
  }
};
