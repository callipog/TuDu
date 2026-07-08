const { app, BrowserWindow, Menu, Tray, Notification, ipcMain, nativeImage, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const isDev = process.env.NODE_ENV === 'development';

// Auto-update (só funciona em builds empacotados e publicados no GitHub Releases).
let autoUpdater = null;
if (!isDev) {
  try {
    autoUpdater = require('electron-updater').autoUpdater;
    autoUpdater.autoDownload = true;
  } catch (err) {
    console.error('electron-updater indisponível', err);
  }
}

// Necessário para que os toasts do Windows apareçam com o nome/ícone corretos.
const APP_ID = 'com.tudu.app';
app.setName('TuDu');
if (process.platform === 'win32') {
  app.setAppUserModelId(APP_ID);
}

const iconPath = isDev
  ? path.join(__dirname, '../public/icon.png')
  : path.join(__dirname, '../dist/icon.png');

const settingsPath = path.join(app.getPath('userData'), 'settings.json');

function readSettings() {
  try {
    const raw = fs.readFileSync(settingsPath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return { startMinimized: false };
  }
}

function writeSettings(patch) {
  const current = readSettings();
  const next = { ...current, ...patch };
  try {
    fs.writeFileSync(settingsPath, JSON.stringify(next, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to write settings', err);
  }
  return next;
}

let mainWindow = null;
let tray = null;
app.isQuitting = false;

function createWindow(startHidden) {
  mainWindow = new BrowserWindow({
    width: 1500,
    height: 780,
    title: 'TuDu',
    icon: iconPath,
    show: false,
    frame: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      devTools: false
    }
  });

  mainWindow.maximize();
  mainWindow.setMenu(null);

  mainWindow.once('ready-to-show', () => {
    if (!startHidden) mainWindow.show();
  });

  // Fechar a janela: esconde na bandeja se "Fechar para a bandeja" estiver ativo;
  // caso contrário, encerra o app por completo.
  mainWindow.on('close', (event) => {
    const closeToTray = readSettings().closeToTray !== false; // default: true
    if (!app.isQuitting && closeToTray) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

function showWindow() {
  if (!mainWindow) {
    createWindow(false);
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

async function runUpdateCheck() {
  if (isDev || !autoUpdater) {
    return { status: 'unavailable', message: 'Atualizações automáticas só funcionam no app instalado.' };
  }
  try {
    const result = await autoUpdater.checkForUpdates();
    const latest = result?.updateInfo?.version;
    if (latest && latest !== app.getVersion()) {
      return { status: 'available', message: `Nova versão ${latest} encontrada. Baixando…` };
    }
    return { status: 'latest', message: 'Você já está na versão mais recente.' };
  } catch (err) {
    return { status: 'error', message: 'Não foi possível verificar atualizações.' };
  }
}

function notifyUpdate(result) {
  if (!Notification.isSupported()) return;
  new Notification({ title: 'TuDu · Atualizações', body: result.message, icon: iconPath }).show();
}

function createTray() {
  let image = nativeImage.createFromPath(iconPath);
  if (!image.isEmpty()) {
    image = image.resize({ width: 16, height: 16 });
  }
  tray = new Tray(image.isEmpty() ? iconPath : image);
  tray.setToolTip('TuDu');

  const contextMenu = Menu.buildFromTemplate([
    // Cabeçalho estético (não clicável): LOGO + nome do app.
    { label: 'TuDu', icon: image.isEmpty() ? undefined : image, enabled: false },
    { type: 'separator' },
    { label: 'Abrir TuDu', click: () => showWindow() },
    { label: 'Verificar atualizações', click: () => runUpdateCheck().then(notifyUpdate) },
    { type: 'separator' },
    {
      label: 'Sair de vez',
      click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);
  tray.on('double-click', () => showWindow());
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);

  const settings = readSettings();
  const startHidden = !!settings.startMinimized || process.argv.includes('--hidden');

  createWindow(startHidden);
  createTray();

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

  // "Fechar" na barra de título esconde na bandeja (via evento close acima).
  ipcMain.on('window-close', (event) => {
    const webWindow = BrowserWindow.fromWebContents(event.sender);
    if (webWindow) webWindow.close();
  });

  // Dispara um popup nativo do Windows.
  ipcMain.on('show-notification', (_event, { title, body }) => {
    if (!Notification.isSupported()) return;
    const notification = new Notification({
      title: title || 'TuDu',
      body: body || '',
      icon: iconPath
    });
    notification.on('click', () => showWindow());
    notification.show();
  });

  // ---- Configurações ----

  ipcMain.handle('settings:get', () => {
    const s = readSettings();
    const loginItem = app.getLoginItemSettings();
    return {
      version: app.getVersion(),
      startMinimized: !!s.startMinimized,
      openAtLogin: loginItem.openAtLogin,
      closeToTray: s.closeToTray !== false,
      userDataPath: app.getPath('userData')
    };
  });

  ipcMain.handle('settings:set-close-to-tray', (_event, closeToTray) => {
    writeSettings({ closeToTray: !!closeToTray });
    return !!closeToTray;
  });

  ipcMain.handle('settings:set-open-at-login', (_event, openAtLogin) => {
    const s = readSettings();
    app.setLoginItemSettings({
      openAtLogin: !!openAtLogin,
      path: process.execPath,
      args: s.startMinimized ? ['--hidden'] : []
    });
    return app.getLoginItemSettings().openAtLogin;
  });

  ipcMain.handle('settings:set-start-minimized', (_event, startMinimized) => {
    writeSettings({ startMinimized: !!startMinimized });
    // Mantém os args do login em sincronia (se já estiver ligado no boot).
    const loginItem = app.getLoginItemSettings();
    if (loginItem.openAtLogin) {
      app.setLoginItemSettings({
        openAtLogin: true,
        path: process.execPath,
        args: startMinimized ? ['--hidden'] : []
      });
    }
    return !!startMinimized;
  });

  ipcMain.handle('settings:open-path', (_event, targetPath) => {
    return shell.openPath(targetPath || app.getPath('userData'));
  });

  ipcMain.handle('settings:open-external', (_event, url) => {
    return shell.openExternal(url);
  });

  ipcMain.handle('settings:check-updates', () => runUpdateCheck());

  // Verifica atualizações em segundo plano ao abrir (produção).
  if (autoUpdater) {
    autoUpdater.checkForUpdatesAndNotify().catch(() => {});
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow(false);
    } else {
      showWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // Se "Fechar para a bandeja" estiver desativado, encerra de vez.
  // Caso contrário, mantém rodando na bandeja (notificações continuam).
  const closeToTray = readSettings().closeToTray !== false;
  if (!closeToTray) app.quit();
});

app.on('before-quit', () => {
  app.isQuitting = true;
});
