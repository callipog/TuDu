const { app, BrowserWindow, Menu, Tray, Notification, ipcMain, nativeImage, shell, globalShortcut, dialog, protocol, net } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

// Precisa ser declarado antes do app ficar pronto: é assim que o renderer
// consegue exibir os anexos sem carregar o arquivo inteiro em memória.
protocol.registerSchemesAsPrivileged([
  { scheme: 'tudu-file', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }
]);
const bridge = require('./bridge.cjs');
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

const DEFAULT_CAPTURE_SHORTCUT = 'Control+Shift+Space';

let mainWindow = null;
let splash = null;
let tray = null;
let captureWindow = null;
let captureShortcut = null;
let splashStart = 0;
let splashWatchdog = null;
let revealed = false;
const MIN_SPLASH_MS = 1100;
// Rede de segurança: se a janela principal não avisar que está pronta (já
// aconteceu logo depois de uma atualização), o splash cai sozinho.
const MAX_SPLASH_MS = 12000;
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
  if (splashWatchdog) {
    clearTimeout(splashWatchdog);
    splashWatchdog = null;
  }
  if (splash && !splash.isDestroyed()) {
    splash.destroy();
  }
  splash = null;
}

function createWindow(startHidden) {
  revealed = false;
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

  // Fecha o splash e mostra a janela. Idempotente: pode ser chamado por
  // qualquer um dos gatilhos abaixo, vale o primeiro.
  const reveal = () => {
    if (revealed) return;
    revealed = true;
    // Garante um tempo mínimo de splash para não "piscar".
    const elapsed = Date.now() - splashStart;
    const wait = Math.max(0, MIN_SPLASH_MS - elapsed);
    setTimeout(() => {
      closeSplash();
      if (!startHidden && mainWindow && !mainWindow.isDestroyed()) mainWindow.show();
    }, wait);
  };

  // Janela visível => splash nunca deve sobrar por cima dela.
  mainWindow.on('show', closeSplash);
  mainWindow.once('ready-to-show', reveal);
  // 'ready-to-show' pode não chegar (visto após atualizar o app): o splash
  // ficava eternamente carregando por cima. Estes gatilhos garantem a saída.
  mainWindow.webContents.once('did-finish-load', reveal);
  mainWindow.webContents.on('did-fail-load', reveal);
  mainWindow.webContents.on('render-process-gone', reveal);
  if (splash) splashWatchdog = setTimeout(reveal, MAX_SPLASH_MS);

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

/* ---- Anexos em disco -------------------------------------------------------
   Antes os arquivos viravam base64 dentro do IndexedDB: uma imagem de 2 MB
   custava ~2,7 MB no banco e era lida junto da tarefa em toda carga. Agora o
   binário mora em userData/attachments e a tarefa guarda só o nome do arquivo,
   servido pelo protocolo tudu-file:// (que só enxerga essa pasta). */

function attachmentsDir() {
  return path.join(app.getPath('userData'), 'attachments');
}

/** Nome seguro: sem separador de caminho, sem "..", com extensão simples. */
function safeAttachmentName(name) {
  return /^[A-Za-z0-9._-]{1,120}$/.test(name) && !name.includes('..') ? name : null;
}

/* ---- Backup em pasta -------------------------------------------------------
   O banco vive no renderer (IndexedDB), então quem monta o JSON é ele; aqui só
   gravamos em disco, com rotação. A pasta pode ser uma do OneDrive ou do Google
   Drive — o próprio serviço de nuvem cuida de levar o arquivo embora. */

const BACKUP_PREFIX = 'tudu-backup-';

/** Pastas de nuvem que existem nesta máquina, para oferecer de atalho. */
function detectCloudFolders() {
  const home = app.getPath('home');
  const candidatos = [
    { id: 'onedrive', label: 'OneDrive', dir: process.env.OneDrive || process.env.OneDriveConsumer || path.join(home, 'OneDrive') },
    { id: 'onedrive-business', label: 'OneDrive (empresa)', dir: process.env.OneDriveCommercial },
    { id: 'gdrive', label: 'Google Drive', dir: path.join(home, 'Meu Drive') },
    { id: 'gdrive-en', label: 'Google Drive', dir: path.join(home, 'My Drive') },
    { id: 'gdrive-stream', label: 'Google Drive (G:)', dir: 'G:\\Meu Drive' },
    { id: 'gdrive-stream-en', label: 'Google Drive (G:)', dir: 'G:\\My Drive' },
  ];

  const vistos = new Set();
  const achados = [];
  for (const c of candidatos) {
    if (!c.dir || vistos.has(c.label)) continue;
    try {
      if (fs.existsSync(c.dir) && fs.statSync(c.dir).isDirectory()) {
        vistos.add(c.label);
        achados.push({ id: c.id, label: c.label, dir: path.join(c.dir, 'TuDu') });
      }
    } catch { /* pasta inacessível: ignora */ }
  }
  return achados;
}

function backupState() {
  const s = readSettings();
  const dir = s.backupDir || path.join(app.getPath('userData'), 'backups');
  let last = null;
  let count = 0;
  try {
    const arquivos = fs.readdirSync(dir).filter(f => f.startsWith(BACKUP_PREFIX) && f.endsWith('.json'));
    count = arquivos.length;
    if (count > 0) {
      const mais = arquivos
        .map(f => ({ f, t: fs.statSync(path.join(dir, f)).mtimeMs }))
        .sort((a, b) => b.t - a.t)[0];
      last = new Date(mais.t).toISOString();
    }
  } catch { /* pasta ainda não existe */ }

  return {
    enabled: s.autoBackupEnabled !== false, // padrão: ligado
    dir,
    keep: Number(s.backupKeep) > 0 ? Number(s.backupKeep) : 7,
    lastAt: last,
    count,
    clouds: detectCloudFolders(),
  };
}

/** Grava o JSON e apaga as cópias que passaram do limite. */
function writeBackup(json) {
  const state = backupState();
  fs.mkdirSync(state.dir, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const file = path.join(state.dir, `${BACKUP_PREFIX}${stamp}.json`);
  fs.writeFileSync(file, json, 'utf-8');

  // Rotação: mantém apenas as N mais recentes.
  try {
    const antigos = fs.readdirSync(state.dir)
      .filter(f => f.startsWith(BACKUP_PREFIX) && f.endsWith('.json'))
      .map(f => ({ f, t: fs.statSync(path.join(state.dir, f)).mtimeMs }))
      .sort((a, b) => b.t - a.t)
      .slice(state.keep);
    antigos.forEach(({ f }) => fs.unlinkSync(path.join(state.dir, f)));
  } catch (err) {
    console.error('Falha ao rotacionar backups', err);
  }

  writeSettings({ lastBackupAt: new Date().toISOString() });
  return { file, dir: state.dir };
}

/* ---- Captura rápida --------------------------------------------------------
   Uma janelinha sem moldura que aparece por cima de qualquer aplicativo. Ela não
   fala com o banco: manda o texto para a janela principal (a única que enxerga o
   IndexedDB), que cria a tarefa e devolve a confirmação. */

function createCaptureWindow() {
  captureWindow = new BrowserWindow({
    width: 560,
    height: 108,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    show: false,
    center: true,
    webPreferences: {
      preload: path.join(__dirname, 'capture-preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      devTools: false
    }
  });

  captureWindow.loadFile(path.join(__dirname, 'capture.html'));
  captureWindow.setVisibleOnAllWorkspaces(true);
  captureWindow.on('blur', () => hideCapture());
  captureWindow.on('closed', () => { captureWindow = null; });
}

function hideCapture() {
  if (captureWindow && !captureWindow.isDestroyed() && captureWindow.isVisible()) {
    captureWindow.hide();
  }
}

function toggleCapture() {
  // Sem janela principal não há onde gravar a tarefa.
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow(true);
  }
  if (!captureWindow || captureWindow.isDestroyed()) createCaptureWindow();
  if (captureWindow.isVisible()) {
    hideCapture();
    return;
  }
  // Um pouco acima do centro: é onde o olho já está.
  const { workArea } = require('electron').screen.getDisplayNearestPoint(
    require('electron').screen.getCursorScreenPoint()
  );
  const [w, h] = captureWindow.getSize();
  captureWindow.setBounds({
    x: Math.round(workArea.x + (workArea.width - w) / 2),
    y: Math.round(workArea.y + workArea.height * 0.24),
    width: w,
    height: h
  });
  captureWindow.webContents.send('capture:reset');
  captureWindow.show();
  captureWindow.focus();
}

/** (Re)registra o atalho global. Devolve o que foi aplicado, para a interface. */
function applyCaptureShortcut() {
  const s = readSettings();
  const enabled = s.quickCaptureEnabled !== false; // padrão: ligado
  const accelerator = s.captureShortcut || DEFAULT_CAPTURE_SHORTCUT;

  if (captureShortcut) {
    globalShortcut.unregister(captureShortcut);
    captureShortcut = null;
  }
  if (!enabled) return { enabled: false, accelerator, registered: false };

  let registered = false;
  try {
    registered = globalShortcut.register(accelerator, () => toggleCapture());
  } catch {
    registered = false;
  }
  if (registered) captureShortcut = accelerator;
  return { enabled: true, accelerator, registered };
}

function showWindow() {
  if (!mainWindow) {
    createWindow(false);
    return;
  }
  // Pediram a janela explicitamente: o splash não tem mais o que fazer.
  revealed = true;
  closeSplash();
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

// ---- Ponte local para agentes de IA (MCP) ----
// Desligada por padrão: abrir uma porta, mesmo local, é opt-in consciente.

const bridgeDeps = {
  userDataPath: app.getPath('userData'),
  getVersion: () => app.getVersion(),
  sendToRenderer: (channel, data) => sendUpdate(channel, data),
  isRendererReady: () => !!mainWindow && !mainWindow.isDestroyed() && !mainWindow.webContents.isLoading(),
  focusWindow: () => showWindow(),
};

function startBridgeIfEnabled() {
  const s = readSettings();
  if (s.bridgeEnabled) bridge.start({ ...bridgeDeps, port: s.bridgePort });
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
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.isQuitting = true;
  app.quit();
}
app.on('second-instance', () => showWindow());

app.whenReady().then(() => {
  // Instância perdedora do lock (acontece na reabertura logo após atualizar):
  // não pode criar splash/janela, senão sobra um splash órfão na tela.
  if (!gotTheLock) return;
  Menu.setApplicationMenu(null);

  // Serve os anexos gravados em disco — e nada além deles.
  protocol.handle('tudu-file', (request) => {
    try {
      const nome = decodeURIComponent(new URL(request.url).pathname).replace(/^\/+/, '');
      const seguro = safeAttachmentName(nome);
      if (!seguro) return new Response('', { status: 400 });
      const alvo = path.join(attachmentsDir(), seguro);
      if (path.dirname(path.resolve(alvo)) !== path.resolve(attachmentsDir())) {
        return new Response('', { status: 403 });
      }
      if (!fs.existsSync(alvo)) return new Response('', { status: 404 });
      return net.fetch(pathToFileURL(alvo).toString());
    } catch {
      return new Response('', { status: 400 });
    }
  });

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

  // ---- Anexos em disco ----

  ipcMain.handle('files:save', (_event, payload) => {
    try {
      const ext = String(payload?.ext ?? '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8);
      const nome = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}${ext ? '.' + ext : ''}`;
      const seguro = safeAttachmentName(nome);
      if (!seguro) throw new Error('Nome inválido');
      const dir = attachmentsDir();
      fs.mkdirSync(dir, { recursive: true });
      const buffer = Buffer.from(String(payload?.base64 ?? ''), 'base64');
      if (buffer.length === 0) throw new Error('Arquivo vazio');
      fs.writeFileSync(path.join(dir, seguro), buffer);
      return { ok: true, file: seguro, size: buffer.length };
    } catch (err) {
      return { ok: false, error: String(err && err.message ? err.message : err) };
    }
  });

  ipcMain.handle('files:delete', (_event, name) => {
    const seguro = safeAttachmentName(String(name ?? ''));
    if (!seguro) return false;
    try {
      fs.unlinkSync(path.join(attachmentsDir(), seguro));
      return true;
    } catch {
      return false;
    }
  });

  // Apaga anexos que nenhuma tarefa referencia mais (tarefa excluída de vez).
  ipcMain.handle('files:prune', (_event, usados) => {
    const manter = new Set(Array.isArray(usados) ? usados.filter(n => safeAttachmentName(String(n))) : []);
    let removidos = 0;
    try {
      for (const f of fs.readdirSync(attachmentsDir())) {
        if (!manter.has(f)) {
          fs.unlinkSync(path.join(attachmentsDir(), f));
          removidos++;
        }
      }
    } catch { /* pasta ainda não existe */ }
    return removidos;
  });

  // ---- Backup em pasta ----

  ipcMain.handle('backup:state', () => backupState());

  ipcMain.handle('backup:set', (_event, options) => {
    const patch = {};
    if (typeof options?.enabled === 'boolean') patch.autoBackupEnabled = options.enabled;
    if (typeof options?.dir === 'string' && options.dir.trim()) patch.backupDir = options.dir.trim();
    if (Number(options?.keep) > 0) patch.backupKeep = Math.min(60, Math.round(Number(options.keep)));
    writeSettings(patch);
    return backupState();
  });

  // Escolha da pasta: só por diálogo nativo — o renderer nunca dita um caminho.
  ipcMain.handle('backup:choose-dir', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Pasta para os backups do TuDu',
      properties: ['openDirectory', 'createDirectory'],
      defaultPath: backupState().dir,
    });
    if (result.canceled || !result.filePaths[0]) return backupState();
    writeSettings({ backupDir: result.filePaths[0] });
    return backupState();
  });

  ipcMain.handle('backup:write', (_event, json) => {
    try {
      const texto = String(json ?? '');
      if (texto.length < 2) throw new Error('Conteúdo vazio');
      const { file, dir } = writeBackup(texto);
      return { ok: true, file, dir, state: backupState() };
    } catch (err) {
      return { ok: false, error: String(err && err.message ? err.message : err) };
    }
  });

  ipcMain.handle('backup:open-dir', () => {
    const dir = backupState().dir;
    fs.mkdirSync(dir, { recursive: true });
    return shell.openPath(dir);
  });

  // Restauração: lê um backup da pasta e devolve o JSON para o renderer aplicar.
  ipcMain.handle('backup:list', () => {
    const dir = backupState().dir;
    try {
      return fs.readdirSync(dir)
        .filter(f => f.startsWith(BACKUP_PREFIX) && f.endsWith('.json'))
        .map(f => {
          const st = fs.statSync(path.join(dir, f));
          return { name: f, size: st.size, at: new Date(st.mtimeMs).toISOString() };
        })
        .sort((a, b) => b.at.localeCompare(a.at));
    } catch {
      return [];
    }
  });

  ipcMain.handle('backup:read', (_event, name) => {
    // Só nomes gerados por nós, e sempre dentro da pasta de backup.
    const seguro = String(name ?? '');
    if (!/^tudu-backup-[\w-]+\.json$/.test(seguro)) return null;
    const dir = backupState().dir;
    const alvo = path.join(dir, seguro);
    if (path.dirname(path.resolve(alvo)) !== path.resolve(dir)) return null;
    try {
      return fs.readFileSync(alvo, 'utf-8');
    } catch {
      return null;
    }
  });

  // ---- Captura rápida ----

  ipcMain.on('capture:close', () => hideCapture());

  ipcMain.on('capture:submit', (_event, text) => {
    const limpo = String(text ?? '').slice(0, 500).trim();
    if (!limpo) return;
    if (!mainWindow || mainWindow.isDestroyed()) createWindow(true);
    mainWindow.webContents.send('capture:text', limpo);
  });

  // O renderer confirma que gravou; a janelinha mostra e some.
  ipcMain.on('capture:saved', (_event, title) => {
    if (captureWindow && !captureWindow.isDestroyed() && captureWindow.isVisible()) {
      captureWindow.webContents.send('capture:saved', String(title ?? '').slice(0, 120));
      setTimeout(hideCapture, 900);
    }
  });

  ipcMain.handle('capture:get', () => {
    const s = readSettings();
    return {
      enabled: s.quickCaptureEnabled !== false,
      accelerator: s.captureShortcut || DEFAULT_CAPTURE_SHORTCUT,
      registered: !!captureShortcut,
      defaultAccelerator: DEFAULT_CAPTURE_SHORTCUT
    };
  });

  ipcMain.handle('capture:set', (_event, options) => {
    const patch = {};
    if (typeof options?.enabled === 'boolean') patch.quickCaptureEnabled = options.enabled;
    if (typeof options?.accelerator === 'string' && options.accelerator.trim()) {
      patch.captureShortcut = options.accelerator.trim().slice(0, 60);
    }
    writeSettings(patch);
    const result = applyCaptureShortcut();
    return { ...result, defaultAccelerator: DEFAULT_CAPTURE_SHORTCUT };
  });

  // ---- Ponte local (MCP) ----

  ipcMain.handle('bridge:status', () => ({
    ...bridge.getState(),
    enabled: !!readSettings().bridgeEnabled,
    autoApply: !!readSettings().bridgeAutoApply,
    token: bridge.getState().running ? bridge.getToken() : null,
  }));

  ipcMain.handle('bridge:set-enabled', (_event, enabled) => {
    writeSettings({ bridgeEnabled: !!enabled });
    const result = enabled
      ? bridge.start({ ...bridgeDeps, port: readSettings().bridgePort })
      : bridge.stop();
    return { ...result, enabled: !!enabled, token: enabled ? bridge.getToken() : null };
  });

  ipcMain.handle('bridge:set-auto-apply', (_event, autoApply) => {
    writeSettings({ bridgeAutoApply: !!autoApply });
    return !!autoApply;
  });

  // Resposta do renderer a uma operação pedida pela ponte.
  ipcMain.on('bridge:response', (_event, message) => bridge.resolveFromRenderer(message));

  startBridgeIfEnabled();
  applyCaptureShortcut();

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
  bridge.stop();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
