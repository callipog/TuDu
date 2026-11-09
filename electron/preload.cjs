const { contextBridge, ipcRenderer } = require('electron');

// API mínima e explícita exposta ao renderer (contextIsolation ativo).
// Nada de Node/Electron bruto atravessa esta ponte — apenas canais nomeados.
contextBridge.exposeInMainWorld('tudu', {
  window: {
    minimize: () => ipcRenderer.send('window-minimize'),
    maximize: () => ipcRenderer.send('window-maximize'),
    close: () => ipcRenderer.send('window-close'),
  },

  notify: (title, body) => ipcRenderer.send('show-notification', { title, body }),

  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    setOpenAtLogin: (v) => ipcRenderer.invoke('settings:set-open-at-login', !!v),
    setStartMinimized: (v) => ipcRenderer.invoke('settings:set-start-minimized', !!v),
    setCloseToTray: (v) => ipcRenderer.invoke('settings:set-close-to-tray', !!v),
    openDataFolder: () => ipcRenderer.invoke('settings:open-path'),
    openExternal: (url) => ipcRenderer.invoke('settings:open-external', String(url)),
    checkUpdates: () => ipcRenderer.invoke('settings:check-updates'),
  },

  // Ponte local para agentes de IA. O renderer é quem executa as operações
  // (só ele fala com o IndexedDB); aqui só trafegam pedidos e respostas.
  bridge: {
    status: () => ipcRenderer.invoke('bridge:status'),
    setEnabled: (v) => ipcRenderer.invoke('bridge:set-enabled', !!v),
    setAutoApply: (v) => ipcRenderer.invoke('bridge:set-auto-apply', !!v),
    respond: (message) => ipcRenderer.send('bridge:response', message),
    onRequest: (cb) => {
      const h = (_e, req) => cb(req);
      ipcRenderer.on('bridge:request', h);
      return () => ipcRenderer.removeListener('bridge:request', h);
    },
    onCancel: (cb) => {
      const h = (_e, msg) => cb(msg);
      ipcRenderer.on('bridge:cancel', h);
      return () => ipcRenderer.removeListener('bridge:cancel', h);
    },
  },

  // Anexos gravados em disco (fora do banco).
  files: {
    save: (payload) => ipcRenderer.invoke('files:save', payload),
    remove: (name) => ipcRenderer.invoke('files:delete', String(name ?? '')),
    prune: (used) => ipcRenderer.invoke('files:prune', used),
  },

  // Backup em pasta (serve OneDrive/Google Drive): o renderer monta o JSON,
  // o processo principal grava e faz a rotação das cópias.
  backup: {
    state: () => ipcRenderer.invoke('backup:state'),
    set: (options) => ipcRenderer.invoke('backup:set', options),
    chooseDir: () => ipcRenderer.invoke('backup:choose-dir'),
    write: (json) => ipcRenderer.invoke('backup:write', String(json ?? '')),
    openDir: () => ipcRenderer.invoke('backup:open-dir'),
    list: () => ipcRenderer.invoke('backup:list'),
    read: (name) => ipcRenderer.invoke('backup:read', String(name ?? '')),
  },

  // Captura rápida: a janelinha manda o texto, o app grava e confirma.
  capture: {
    get: () => ipcRenderer.invoke('capture:get'),
    set: (options) => ipcRenderer.invoke('capture:set', options),
    saved: (title) => ipcRenderer.send('capture:saved', String(title ?? '')),
    onText: (cb) => {
      const h = (_e, text) => cb(text);
      ipcRenderer.on('capture:text', h);
      return () => ipcRenderer.removeListener('capture:text', h);
    },
  },

  // Ilha: o renderer publica o retrato das fontes; o processo principal resolve.
  island: {
    publish: (snapshot) => ipcRenderer.send('island:sources', snapshot),
    state: () => ipcRenderer.invoke('island:state'),
    getConfig: () => ipcRenderer.invoke('island:get-config'),
    setConfig: (patch) => ipcRenderer.invoke('island:set-config', patch),
    cycleEnded: () => ipcRenderer.send('island:cycle-ended'),
    // Botões da ilha que mexem em tarefas e no foco: só este renderer sabe fazer.
    onAction: (cb) => {
      const h = (_e, action) => cb(action);
      ipcRenderer.on('island:action', h);
      return () => ipcRenderer.removeListener('island:action', h);
    },
  },

  updates: {
    install: () => ipcRenderer.invoke('update:install'),
    onProgress: (cb) => {
      const h = (_e, pct) => cb(pct);
      ipcRenderer.on('update:progress', h);
      return () => ipcRenderer.removeListener('update:progress', h);
    },
    onDownloaded: (cb) => {
      const h = (_e, version) => cb(version);
      ipcRenderer.on('update:downloaded', h);
      return () => ipcRenderer.removeListener('update:downloaded', h);
    },
    onError: (cb) => {
      const h = (_e, msg) => cb(msg);
      ipcRenderer.on('update:error', h);
      return () => ipcRenderer.removeListener('update:error', h);
    },
  },
});
