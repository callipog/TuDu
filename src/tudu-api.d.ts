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
      updates: {
        install: () => Promise<void>;
        onProgress: (cb: (pct: number) => void) => () => void;
        onDownloaded: (cb: (version: string) => void) => () => void;
        onError: (cb: (msg: string) => void) => () => void;
      };
    };
  }
}
