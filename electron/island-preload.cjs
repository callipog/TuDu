const { contextBridge, ipcRenderer } = require('electron');

// Ponte mínima da janela da ilha. Ela não enxerga o banco nem o Node: recebe o
// estado já resolvido pelo processo principal e devolve só pedidos nomeados.
function listen(channel) {
  return (cb) => {
    const h = (_e, data) => cb(data);
    ipcRenderer.on(channel, h);
    return () => ipcRenderer.removeListener(channel, h);
  };
}

contextBridge.exposeInMainWorld('tuduIsland', {
  init: () => ipcRenderer.invoke('island:init'),
  onState: listen('island:state'),
  onConfig: listen('island:config'),
  onPlayer: listen('island:player'),
  onSaved: listen('island:saved'),
  /** O mouse está sobre a pílula? Fora dela o clique atravessa a janela. */
  hit: (over) => ipcRenderer.send('island:hit', !!over),
  action: (payload) => ipcRenderer.send('island:action', payload),
});
