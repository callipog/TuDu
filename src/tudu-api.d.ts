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

export type IslandSectionId = 'hoje' | 'player' | 'foco' | 'lembretes' | 'agua' | 'captura';

/** Configuração da ilha (settings.json → island). */
export interface IslandConfig {
  enabled: boolean;
  position: 'tl' | 'tc' | 'tr' | 'cl' | 'cr' | 'bl' | 'bc' | 'br';
  /** floating: pílula solta. drop: grudada na borda, como um entalhe do monitor. */
  shape: 'floating' | 'drop';
  /** A posição que vale (na gota, cl/cr sobem para o topo). Só leitura. */
  effectivePosition: IslandConfig['position'];
  pinned: boolean;
  hoverOpen: boolean;
  raiseCritical: boolean;
  pauseAtCycleEnd: boolean;
  sections: { hoje: boolean; player: boolean; foco: boolean; lembretes: boolean; captura: boolean };
  /** Ordem das seções nas setas e nos pontinhos. */
  order: IslandSectionId[];
  /** Na gota: parada, fica como entalhe em vez de virar o fio. */
  alwaysVisible: boolean;
  /** Tema próprio da ilha, independente do app. */
  theme: 'dark' | 'light' | 'system';
  /** Sem transparência nem animações. */
  lite: boolean;
  /** Indicadores no lugar do aviso do Windows. */
  indicators: {
    enabled: boolean;
    /** Tenta esconder o aviso nativo do Windows (não funciona em todas as versões). */
    hideOsd: boolean;
    show: { volume: boolean; brightness: boolean; keys: boolean; mic: boolean; media: boolean };
  };
  /** null: ainda não deu para saber; false: esta versão do Windows não deixa esconder o aviso. Só leitura. */
  osdHideable: boolean | null;
  /** Notebook (mostra a bateria) ou PC de mesa. Só leitura. */
  hasBattery: boolean;
}

/** Card fixado na área de trabalho (settings.json → stickies). */
export interface StickyState {
  taskId: string;
  x: number | null;
  y: number | null;
  w: number;
  h: number;
  onTop: boolean;
  collapsed: boolean;
}

/** Lembretes de água e de levantar (settings.json → wellness). */
export interface WellnessConfig {
  water: { enabled: boolean; goalMl: number; everyMin: number; cupMl: number; sound: boolean };
  stand: { enabled: boolean; afterMin: number; sound: boolean };
}

/** Configuração + o que já rolou hoje (copos, tempo sentado). */
export interface WellnessInfo {
  config: WellnessConfig;
  summary: {
    water: { ml: number; goalMl: number; cupMl: number; lastAt: number } | null;
    stand: { sittingMin: number; afterMin: number } | null;
  };
}

export type WellnessPatch = { water?: Partial<WellnessConfig['water']>; stand?: Partial<WellnessConfig['stand']> };

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
          saveMemory: boolean;
          saveMemoryActive: boolean;
          userDataPath: string;
        }>;
        setOpenAtLogin: (v: boolean) => Promise<boolean>;
        setStartMinimized: (v: boolean) => Promise<boolean>;
        setCloseToTray: (v: boolean) => Promise<boolean>;
        setSaveMemory: (v: boolean) => Promise<boolean>;
        relaunch: () => Promise<void>;
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
      sticky?: {
        open: (taskId: string) => void;
        init: () => Promise<StickyState | null>;
        set: (patch: { onTop?: boolean; collapsed?: boolean }) => Promise<StickyState | null>;
        close: () => void;
        openInApp: () => void;
        onShowTask: (cb: (taskId: string) => void) => () => void;
      };
      wellness: {
        get: () => Promise<WellnessInfo>;
        setConfig: (patch: WellnessPatch) => Promise<WellnessInfo>;
        action: (payload: { type: 'water-drink' | 'water-undo' | 'water-snooze' | 'stand-done' | 'stand-snooze'; ml?: number }) => Promise<WellnessInfo>;
      };
      island: {
        publish: (snapshot: IslandSnapshot) => void;
        /** Estado resolvido pela fila de prioridade (electron/island-queue.cjs). */
        state: () => Promise<unknown>;
        getConfig: () => Promise<IslandConfig>;
        setConfig: (patch: Partial<Omit<IslandConfig, 'sections' | 'hasBattery' | 'effectivePosition' | 'indicators' | 'osdHideable'>> & {
          sections?: Partial<IslandConfig['sections']>;
          indicators?: Partial<Omit<IslandConfig['indicators'], 'show'>> & { show?: Partial<IslandConfig['indicators']['show']> };
        }) => Promise<IslandConfig>;
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
