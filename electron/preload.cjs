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
