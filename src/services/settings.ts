export const REPORT_EMAIL = 'guilhermecallipo@gmail.com';
export const GITHUB_URL = 'https://github.com/callipog/Tudu';
export const AUTHOR_NAME = 'Guilherme Callipo';

export interface AppSettings {
  version: string;
  startMinimized: boolean;
  openAtLogin: boolean;
  closeToTray: boolean;
  userDataPath: string;
}

function ipc(): any | null {
  if (typeof window !== 'undefined' && (window as any).require) {
    try {
      return (window as any).require('electron').ipcRenderer;
    } catch {
      return null;
    }
  }
  return null;
}

export const settingsService = {
  isElectron(): boolean {
    return !!ipc();
  },

  async get(): Promise<AppSettings> {
    const r = ipc();
    if (!r) {
      return { version: 'web', startMinimized: false, openAtLogin: false, closeToTray: true, userDataPath: '—' };
    }
    return await r.invoke('settings:get');
  },

  async setCloseToTray(v: boolean): Promise<boolean> {
    const r = ipc();
    if (!r) return true;
    return await r.invoke('settings:set-close-to-tray', v);
  },

  async setOpenAtLogin(v: boolean): Promise<boolean> {
    const r = ipc();
    if (!r) return false;
    return await r.invoke('settings:set-open-at-login', v);
  },

  async setStartMinimized(v: boolean): Promise<boolean> {
    const r = ipc();
    if (!r) return false;
    return await r.invoke('settings:set-start-minimized', v);
  },

  async openPath(p: string): Promise<void> {
    const r = ipc();
    if (!r) return;
    await r.invoke('settings:open-path', p);
  },

  async openExternal(url: string): Promise<void> {
    const r = ipc();
    if (!r) {
      window.open(url, '_blank');
      return;
    }
    await r.invoke('settings:open-external', url);
  },

  async checkUpdates(): Promise<{ status: string; message: string }> {
    const r = ipc();
    if (!r) return { status: 'unavailable', message: 'Atualizações só funcionam no app desktop instalado.' };
    return await r.invoke('settings:check-updates');
  },

  installUpdate(): void {
    const r = ipc();
    if (r) r.invoke('update:install');
  },

  /** Assina eventos de atualização. Retorna uma função para cancelar a assinatura. */
  onUpdate(handlers: { progress?: (pct: number) => void; downloaded?: (v: string) => void; error?: (msg: string) => void }): () => void {
    const r = ipc();
    if (!r) return () => {};
    const onProgress = (_e: any, pct: number) => handlers.progress?.(pct);
    const onDownloaded = (_e: any, v: string) => handlers.downloaded?.(v);
    const onError = (_e: any, msg: string) => handlers.error?.(msg);
    r.on('update:progress', onProgress);
    r.on('update:downloaded', onDownloaded);
    r.on('update:error', onError);
    return () => {
      r.removeListener('update:progress', onProgress);
      r.removeListener('update:downloaded', onDownloaded);
      r.removeListener('update:error', onError);
    };
  },

  reportBug(version: string): void {
    const subject = encodeURIComponent('TuDu · Reporte de bug');
    const body = encodeURIComponent(
      `Descreva o problema encontrado:\n\n\n\n---\nVersão: ${version}\nSistema: Windows`
    );
    this.openExternal(`mailto:${REPORT_EMAIL}?subject=${subject}&body=${body}`);
  }
};
