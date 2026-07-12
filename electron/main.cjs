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
    autoUpdater.autoInstallOnAppQuit = true;
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
let splash = null;
let tray = null;
let splashStart = 0;
const MIN_SPLASH_MS = 1100;
app.isQuitting = false;

function createSplash() {
  splash = new BrowserWindow({
    width: 340,
    height: 400,
    frame: false,
    resizable: false,
    movable: false,
    center: true,
    show: true,
    skipTaskbar: true,
    alwaysOnTop: true,
    backgroundColor: '#09090b',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      devTools: false
    }
  });
  splash.loadFile(path.join(__dirname, 'splash.html'));
  splashStart = Date.now();

  // Injeta o ícone real do app (base64) para não depender de caminho relativo.
  splash.webContents.on('did-finish-load', () => {
    try {
      const b64 = fs.readFileSync(iconPath).toString('base64');
      splash.webContents.executeJavaScript(
        `(function(){var el=document.getElementById('app-logo');var fb=document.getElementById('logo-fallback');` +
        `if(el){el.src='data:image/png;base64,${b64}';el.style.display='block';}if(fb){fb.style.display='none';}})();`
      ).catch(() => {});
    } catch (e) { /* mantém o fallback */ }
  });
}

function closeSplash() {
  if (splash && !splash.isDestroyed()) {
    splash.destroy();
  }
  splash = null;
}

function createWindow(startHidden) {
  mainWindow = new BrowserWindow({
    width: 1500,
    height: 780,
    title: 'TuDu',
    icon: iconPath,
    show: false,
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      devTools: false
    }
  });

  // Bloqueia navegação para fora do app e abertura de novas janelas.
  // Links http(s) legítimos abrem no navegador padrão.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const current = mainWindow.webContents.getURL();
    if (url !== current) event.preventDefault();
  });

  mainWindow.maximize();
  mainWindow.setMenu(null);

  mainWindow.once('ready-to-show', () => {
    // Garante um tempo mínimo de splash para não "piscar".
    const elapsed = Date.now() - splashStart;
    const wait = Math.max(0, MIN_SPLASH_MS - elapsed);
    setTimeout(() => {
      closeSplash();
      if (!startHidden) mainWindow.show();
    }, wait);
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

function sendUpdate(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
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

// Garante uma única instância do app; abrir de novo apenas foca a janela.
if (!app.requestSingleInstanceLock()) {
  app.isQuitting = true;
  app.quit();
}
app.on('second-instance', () => showWindow());

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);

  const settings = readSettings();
  const startHidden = !!settings.startMinimized || process.argv.includes('--hidden');

  if (!startHidden) createSplash();
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

  // Dispara um popup nativo do Windows (entrada sanitizada e limitada).
  ipcMain.on('show-notification', (_event, payload) => {
    if (!Notification.isSupported()) return;
    const title = String(payload?.title ?? 'TuDu').slice(0, 128);
    const body = String(payload?.body ?? '').slice(0, 512);
    const notification = new Notification({ title, body, icon: iconPath });
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

  // Abre somente a pasta de dados do app (não aceita caminho arbitrário do renderer).
  ipcMain.handle('settings:open-path', () => {
    return shell.openPath(app.getPath('userData'));
  });

  // Abre apenas URLs http(s)/mailto — nunca file:, cmd, etc.
  ipcMain.handle('settings:open-external', (_event, url) => {
    try {
      const parsed = new URL(String(url));
      if (!['https:', 'http:', 'mailto:'].includes(parsed.protocol)) return;
      return shell.openExternal(parsed.href);
    } catch {
      return; // URL inválida: ignora
    }
  });

  ipcMain.handle('settings:check-updates', () => runUpdateCheck());

  ipcMain.handle('update:install', () => {
    if (autoUpdater) {
      app.isQuitting = true;
      autoUpdater.quitAndInstall();
    }
  });

  // Eventos do updater: reportam progresso e prontidão para a interface.
  if (autoUpdater) {
    autoUpdater.on('download-progress', (p) => sendUpdate('update:progress', Math.round(p.percent)));
    autoUpdater.on('update-downloaded', (info) => {
      sendUpdate('update:downloaded', info.version);
      notifyUpdate({ message: `Versão ${info.version} baixada. Reinicie para instalar.` });
    });
    autoUpdater.on('error', (err) => sendUpdate('update:error', String(err && err.message ? err.message : err)));

    // Verifica atualizações em segundo plano ao abrir (produção).
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
