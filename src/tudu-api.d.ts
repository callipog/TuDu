import type { IslandSnapshot } from './services/islandSnapshot';

export {};

/** Estado do backup automático em pasta. */
interface BackupState {
  enabled: boolean;
  dir: string;
  keep: number;
  lastAt: string | null;
  count: number;
  /** Pastas de nuvem detectadas na máquina (OneDrive, Google Drive). */
  clouds: { id: string; label: string; dir: string }[];
}

/** Configuração da ilha (settings.json → island). */
export interface IslandConfig {
  enabled: boolean;
  position: 'tl' | 'tc' | 'tr' | 'cl' | 'cr' | 'bl' | 'bc' | 'br';
  pinned: boolean;
  hoverOpen: boolean;
  raiseCritical: boolean;
  pauseAtCycleEnd: boolean;
  sections: { player: boolean; foco: boolean; lembretes: boolean; captura: boolean };
  /** Notebook (mostra a bateria) ou PC de mesa. Só leitura. */
  hasBattery: boolean;
}

/** Pedido de um botão da ilha para a janela principal. */
export interface IslandAction {
  type: 'task-complete' | 'task-snooze' | 'task-open' | 'focus';
  op: string;
  taskId: string;
  id: string;
}

/** Estado do atalho global de captura rápida. */
interface CaptureConfig {
  enabled: boolean;
  accelerator: string;
  registered: boolean;
  defaultAccelerator: string;
}

// Tipagem da ponte segura exposta pelo preload do Electron (contextBridge).
declare global {
  interface Window {
    tudu?: {
      window: {
        minimize: () => void;
        maximize: () => void;
        close: () => void;
      };
      notify: (title: string, body: string) => void;
      settings: {
        get: () => Promise<{
          version: string;
          startMinimized: boolean;
          openAtLogin: boolean;
          closeToTray: boolean;
          userDataPath: string;
        }>;
        setOpenAtLogin: (v: boolean) => Promise<boolean>;
        setStartMinimized: (v: boolean) => Promise<boolean>;
        setCloseToTray: (v: boolean) => Promise<boolean>;
        openDataFolder: () => Promise<string>;
        openExternal: (url: string) => Promise<void>;
        checkUpdates: () => Promise<{ status: string; message: string }>;
      };
      bridge: {
        status: () => Promise<{
          running: boolean;
          port: number | null;
          error: string | null;
          enabled: boolean;
          autoApply: boolean;
          token: string | null;
          credentialsPath: string | null;
        }>;
        setEnabled: (v: boolean) => Promise<{ running: boolean; port: number | null; error: string | null; enabled: boolean; token: string | null }>;
        setAutoApply: (v: boolean) => Promise<boolean>;
        respond: (message: { id: string; ok: boolean; data?: unknown; error?: string; status?: number }) => void;
        onRequest: (cb: (req: { id: string; kind: string; payload: any }) => void) => () => void;
        onCancel: (cb: (msg: { id: string }) => void) => () => void;
      };
      files: {
        save: (payload: { base64: string; ext?: string }) => Promise<{ ok: boolean; file?: string; size?: number; error?: string }>;
        remove: (name: string) => Promise<boolean>;
        prune: (used: string[]) => Promise<number>;
      };
      backup: {
        state: () => Promise<BackupState>;
        set: (options: { enabled?: boolean; dir?: string; keep?: number }) => Promise<BackupState>;
        chooseDir: () => Promise<BackupState>;
        write: (json: string) => Promise<{ ok: boolean; file?: string; dir?: string; state?: BackupState; error?: string }>;
        openDir: () => Promise<string>;
        list: () => Promise<{ name: string; size: number; at: string }[]>;
        read: (name: string) => Promise<string | null>;
      };
      capture: {
        get: () => Promise<CaptureConfig>;
        set: (options: { enabled?: boolean; accelerator?: string }) => Promise<CaptureConfig>;
        saved: (title: string) => void;
        onText: (cb: (text: string) => void) => () => void;
      };
      island: {
        publish: (snapshot: IslandSnapshot) => void;
        /** Estado resolvido pela fila de prioridade (electron/island-queue.cjs). */
        state: () => Promise<unknown>;
        getConfig: () => Promise<IslandConfig>;
        setConfig: (patch: Partial<Omit<IslandConfig, 'sections' | 'hasBattery'>> & { sections?: Partial<IslandConfig['sections']> }) => Promise<IslandConfig>;
        cycleEnded: () => void;
        onAction: (cb: (action: IslandAction) => void) => () => void;
      };
      updates: {
        install: () => Promise<void>;
        onProgress: (cb: (pct: number) => void) => () => void;
        onDownloaded: (cb: (version: string) => void) => () => void;
        onError: (cb: (msg: string) => void) => () => void;
      };
    };
  }
}
