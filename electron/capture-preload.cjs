const { contextBridge, ipcRenderer } = require('electron');

// Ponte mínima da janela de captura rápida: ela só sabe mandar um texto,
// fechar a si mesma e receber a confirmação de que a tarefa foi gravada.
contextBridge.exposeInMainWorld('tuduCapture', {
  submit: (text) => ipcRenderer.send('capture:submit', String(text).slice(0, 500)),
  close: () => ipcRenderer.send('capture:close'),
  onReset: (cb) => {
    ipcRenderer.on('capture:reset', () => cb());
  },
  onSaved: (cb) => {
    ipcRenderer.on('capture:saved', (_e, title) => cb(title));
  },
});
