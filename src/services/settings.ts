export const REPORT_EMAIL = 'guilhermecallipo@gmail.com';
export const GITHUB_URL = 'https://github.com/callipog/TuDu';
export const AUTHOR_NAME = 'Guilherme Callipo';

export interface AppSettings {
  version: string;
  startMinimized: boolean;
  openAtLogin: boolean;
  closeToTray: boolean;
  userDataPath: string;
}

/** Ponte segura exposta pelo preload (contextBridge), ou null fora do Electron. */
function bridge() {
  return typeof window !== 'undefined' ? window.tudu ?? null : null;
}

export const settingsService = {
  isElectron(): boolean {
    return !!bridge();
  },

  async get(): Promise<AppSettings> {
    const b = bridge();
    if (!b) {
      return { version: 'web', startMinimized: false, openAtLogin: false, closeToTray: true, userDataPath: '—' };
    }
    return await b.settings.get();
  },

  async setCloseToTray(v: boolean): Promise<boolean> {
    const b = bridge();
    if (!b) return true;
    return await b.settings.setCloseToTray(v);
  },

  async setOpenAtLogin(v: boolean): Promise<boolean> {
    const b = bridge();
    if (!b) return false;
    return await b.settings.setOpenAtLogin(v);
  },

  async setStartMinimized(v: boolean): Promise<boolean> {
    const b = bridge();
    if (!b) return false;
    return await b.settings.setStartMinimized(v);
  },

  async openDataFolder(): Promise<void> {
    await bridge()?.settings.openDataFolder();
  },

  async openExternal(url: string): Promise<void> {
    const b = bridge();
    if (!b) {
      window.open(url, '_blank');
      return;
    }
    await b.settings.openExternal(url);
  },

  async checkUpdates(): Promise<{ status: string; message: string }> {
    const b = bridge();
    if (!b) return { status: 'unavailable', message: 'Atualizações só funcionam no app desktop instalado.' };
    return await b.settings.checkUpdates();
  },

  installUpdate(): void {
    bridge()?.updates.install();
  },

  /** Assina eventos de atualização. Retorna uma função para cancelar a assinatura. */
  onUpdate(handlers: { progress?: (pct: number) => void; downloaded?: (v: string) => void; error?: (msg: string) => void }): () => void {
    const b = bridge();
    if (!b) return () => {};
    const unsubs = [
      handlers.progress ? b.updates.onProgress(handlers.progress) : null,
      handlers.downloaded ? b.updates.onDownloaded(handlers.downloaded) : null,
      handlers.error ? b.updates.onError(handlers.error) : null,
    ];
    return () => unsubs.forEach(u => u?.());
  },

  reportBug(version: string): void {
    const subject = encodeURIComponent('TuDu · Reporte de bug');
    const body = encodeURIComponent(
      `Descreva o problema encontrado:\n\n\n\n---\nVersão: ${version}\nSistema: Windows`
    );
    this.openExternal(`mailto:${REPORT_EMAIL}?subject=${subject}&body=${body}`);
  }
};
