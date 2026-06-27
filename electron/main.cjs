const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');
const isDev = process.env.NODE_ENV === 'development';

function createWindow() {
  const win = new BrowserWindow({
    width: 1500,
    height: 780,
    title: 'TuDu',
    icon: path.join(__dirname, '../public/icon.png'),
    frame: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      devTools: false
    }
  });

  win.maximize();
  win.setMenu(null);

  if (isDev) {
    win.loadURL('http://localhost:3000');
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createWindow();

  ipcMain.on('window-minimize', (event) => {
    const webWindow = BrowserWindow.fromWebContents(event.sender);
    if (webWindow) webWindow.minimize();
  });

  ipcMain.on('window-maximize', (event) => {
    const webWindow = BrowserWindow.fromWebContents(event.sender);
    if (webWindow) {
      if (webWindow.isMaximized()) {
        webWindow.unmaximize();
      } else {
        webWindow.maximize();
      }
    }
  });

  ipcMain.on('window-close', (event) => {
    const webWindow = BrowserWindow.fromWebContents(event.sender);
    if (webWindow) webWindow.close();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
