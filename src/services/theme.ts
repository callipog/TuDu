export type Theme = 'dark' | 'light' | 'system';

const THEME_KEY = 'tudu_theme';
const mql = typeof window !== 'undefined' && window.matchMedia
  ? window.matchMedia('(prefers-color-scheme: light)')
  : null;

function resolve(theme: Theme): 'dark' | 'light' {
  if (theme === 'system') return mql?.matches ? 'light' : 'dark';
  return theme;
}

export const themeService = {
  get(): Theme {
    try {
      const v = localStorage.getItem(THEME_KEY);
      if (v === 'light' || v === 'dark' || v === 'system') return v;
    } catch { /* ignore */ }
    return 'dark';
  },

  apply(theme: Theme) {
    document.documentElement.classList.toggle('light', resolve(theme) === 'light');
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
