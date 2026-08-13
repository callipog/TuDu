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
      updates: {
        install: () => Promise<void>;
        onProgress: (cb: (pct: number) => void) => () => void;
        onDownloaded: (cb: (version: string) => void) => () => void;
        onError: (cb: (msg: string) => void) => () => void;
      };
    };
  }
}
