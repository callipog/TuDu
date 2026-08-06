export {};

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
      updates: {
        install: () => Promise<void>;
        onProgress: (cb: (pct: number) => void) => () => void;
        onDownloaded: (cb: (version: string) => void) => () => void;
        onError: (cb: (msg: string) => void) => () => void;
      };
    };
  }
}
