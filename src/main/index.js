const path = require('node:path');
const { pathToFileURL } = require('node:url');
const {
  app,
  BrowserWindow,
  clipboard,
  desktopCapturer,
  dialog,
  globalShortcut,
  ipcMain,
  Menu,
  nativeImage,
  screen,
  session,
  Tray,
} = require('electron');
const {
  DEFAULT_SETTINGS,
  DEFAULT_HOTKEYS,
  loadSettings,
  sanitizeSettings,
  saveSettings,
} = require('./config');
const { MediaMonitor } = require('./media-monitor');
const { OverlayManager } = require('./overlay-manager');
const { Timekeeper } = require('./timekeeper');
const {
  findSelectedSource,
  normalizeVideoState,
  toRendererSource,
} = require('./video-capture');

app.setAppUserModelId('com.sayanpramanik.nowlayer');
app.setName('NowLayer');
const smokeTestMode = process.argv.includes('--smoke-test');
if (smokeTestMode) {
  app.setPath('userData', path.join(app.getPath('temp'), 'NowLayer-SmokeTest'));
}

const rendererPath = path.join(__dirname, '..', 'renderer', 'index.html');
const utilityRendererPath = path.join(__dirname, '..', 'utility', 'index.html');
const controlPath = path.join(__dirname, '..', 'control', 'index.html');
const preloadPath = path.join(__dirname, '..', 'preload', 'index.js');
const appIconPath = path.join(__dirname, '..', 'assets', 'app-icon.png');
const scriptsPath = app.isPackaged
  ? path.join(process.resourcesPath, 'scripts')
  : path.join(__dirname, '..', '..', 'scripts');

const mediaMonitor = new MediaMonitor({
  monitorScript: path.join(scriptsPath, 'media-monitor.ps1'),
  actionScript: path.join(scriptsPath, 'media-action.ps1'),
});
const overlayManager = new OverlayManager({
  app,
  BrowserWindow,
  screen,
  rendererPath,
  utilityRendererPath,
  preloadPath,
});

let settingsPath = '';
let settingsSaveTimer = null;
let mediaState = mediaMonitor.lastState;
let shuttingDown = false;
let controlWindow = null;
let tray = null;
let videoState = normalizeVideoState();
let timekeeper = null;

function currentState() {
  const utilities = timekeeper?.getState() ?? overlayManager.settings.utilities;
  return {
    media: mediaState,
    settings: overlayManager.settings,
    platform: overlayManager.getStatus(),
    video: videoState,
    utilities: {
      ...utilities,
      timer: { ...utilities.timer, soundUrl: utilities.timer.soundPath ? pathToFileURL(utilities.timer.soundPath).toString() : '' },
      alarm: { ...utilities.alarm, soundUrl: utilities.alarm.soundPath ? pathToFileURL(utilities.alarm.soundPath).toString() : '' },
    },
    app: {
      name: 'NowLayer',
      version: app.getVersion(),
      isPackaged: app.isPackaged,
      startupEnabled: process.platform === 'win32' ? app.getLoginItemSettings().openAtLogin : false,
      hotkeys: {
        ...overlayManager.settings.hotkeys,
      },
    },
  };
}

async function getRawCaptureSources({ withPreviews = false } = {}) {
  return desktopCapturer.getSources({
    types: ['window'],
    thumbnailSize: withPreviews ? { width: 320, height: 180 } : { width: 0, height: 0 },
    fetchWindowIcons: withPreviews,
  });
}

async function listCaptureSources() {
  const sources = await getRawCaptureSources({ withPreviews: true });
  return sources
    .map(toRendererSource)
    .filter(Boolean)
    .sort((left, right) => left.name.localeCompare(right.name))
    .slice(0, 80);
}

function setVideoState(patch) {
  videoState = normalizeVideoState({
    ...videoState,
    ...patch,
    revision: videoState.revision + 1,
  });
  overlayManager.setVideoMode(videoState.active);
  broadcastState();
  return videoState;
}

function configureDisplayCapture() {
  session.defaultSession.setDisplayMediaRequestHandler(async (_request, callback) => {
    try {
      if (!videoState.active || !videoState.sourceId) {
        callback({});
        return;
      }
      const sources = await getRawCaptureSources();
      const selected = findSelectedSource(sources, videoState.sourceId);
      if (!selected) {
        callback({});
        return;
      }
      callback({ video: selected });
    } catch (error) {
      console.error('[video] Could not resolve the selected capture source:', error);
      callback({});
    }
  }, { useSystemPicker: false });
}

function broadcastState() {
  const state = currentState();
  overlayManager.broadcast('nowlayer:state', state);
  if (controlWindow && !controlWindow.isDestroyed() && !controlWindow.webContents.isDestroyed()) {
    controlWindow.webContents.send('nowlayer:state', state);
  }
}

function createControlWindow({ show = true } = {}) {
  if (controlWindow && !controlWindow.isDestroyed()) {
    if (show) {
      controlWindow.show();
      controlWindow.focus();
    }
    return controlWindow;
  }

  const window = new BrowserWindow({
    width: 940,
    height: 680,
    minWidth: 760,
    minHeight: 560,
    title: 'NowLayer Control Center',
    icon: appIconPath,
    backgroundColor: '#0b0b10',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: !app.isPackaged,
    },
  });
  controlWindow = window;
  window.loadFile(controlPath);
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.once('ready-to-show', () => {
    if (show) window.show();
  });
  window.on('close', (event) => {
    if (shuttingDown) return;
    event.preventDefault();
    window.hide();
  });
  window.on('closed', () => {
    if (controlWindow === window) controlWindow = null;
  });
  return window;
}

function createTrayImage() {
  const appIcon = nativeImage.createFromPath(appIconPath);
  if (!appIcon.isEmpty()) return appIcon.resize({ width: 16, height: 16 });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><rect width="32" height="32" rx="9" fill="#ff4f64"/><path d="M9 23V9h3l8 9V9h3v14h-3l-8-9v9z" fill="white"/></svg>`;
  const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  return nativeImage.createFromDataURL(dataUrl).resize({ width: 16, height: 16 });
}

function updateTrayMenu() {
  if (!tray) return;
  const settings = overlayManager.settings;
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open NowLayer', click: () => createControlWindow({ show: true }) },
    { type: 'separator' },
    {
      label: settings.visible ? 'Hide overlay' : 'Show overlay',
      click: () => overlayManager.toggleVisible(),
    },
    {
      label: settings.locked ? 'Unlock interaction' : 'Lock interaction',
      click: () => overlayManager.toggleLocked(),
    },
    { type: 'separator' },
    { label: 'Quit NowLayer', click: () => app.quit() },
  ]));
}

function createTray() {
  if (tray) return tray;
  tray = new Tray(createTrayImage());
  tray.setToolTip('NowLayer');
  tray.on('click', () => createControlWindow({ show: true }));
  tray.on('double-click', () => createControlWindow({ show: true }));
  updateTrayMenu();
  return tray;
}

function scheduleSettingsSave(settings) {
  if (!settingsPath || shuttingDown) return;
  if (settingsSaveTimer) clearTimeout(settingsSaveTimer);
  settingsSaveTimer = setTimeout(() => {
    settingsSaveTimer = null;
    try {
      overlayManager.settings = saveSettings(settingsPath, settings);
    } catch (error) {
      console.error('[settings] Could not save settings:', error);
    }
  }, 150);
}

overlayManager.on('settings-changed', (settings) => {
  scheduleSettingsSave(settings);
  updateTrayMenu();
  broadcastState();
});
overlayManager.on('status', broadcastState);
mediaMonitor.on('state', (state) => {
  mediaState = state;
  broadcastState();
});
mediaMonitor.on('diagnostic', (message) => {
  console.warn(`[media] ${message}`);
});

ipcMain.handle('nowlayer:get-state', () => currentState());

ipcMain.handle('nowlayer:set-setting', (_event, key, value) => {
  const allowed = new Set([
    'onboardingComplete',
    'visible',
    'locked',
    'compact',
    'showPipControls',
    'pipControlPosition',
    'opacity',
    'anchor',
    'utilities',
    'hotkeys',
  ]);
  if (!allowed.has(key)) throw new Error('Unsupported setting.');
  if (key === 'utilities') {
    timekeeper.update(value);
    return overlayManager.settings;
  }
  if (key === 'hotkeys') {
    const requested = sanitizeSettings({ ...overlayManager.settings, hotkeys: value }).hotkeys;
    const previous = overlayManager.settings.hotkeys;
    if (!registerDesktopHotkeys(requested)) {
      registerDesktopHotkeys(previous);
      throw new Error('That shortcut is unavailable. Choose another combination.');
    }
    return overlayManager.updateSettings({ hotkeys: requested });
  }
  return overlayManager.updateSettings({ [key]: value });
});

ipcMain.handle('nowlayer:timer-start', (_event, seconds) => timekeeper.startTimer(seconds));
ipcMain.handle('nowlayer:timer-pause', () => timekeeper.pauseTimer());
ipcMain.handle('nowlayer:timer-reset', () => timekeeper.resetTimer());
ipcMain.handle('nowlayer:alert-dismiss', () => timekeeper.dismissAlert());
ipcMain.handle('nowlayer:choose-alert-sound', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Choose alert sound',
    properties: ['openFile'],
    filters: [{ name: 'Audio', extensions: ['mp3', 'wav', 'ogg', 'm4a', 'aac'] }],
  });
  if (result.canceled || !result.filePaths[0]) return null;
  const filePath = result.filePaths[0];
  return { path: filePath, url: pathToFileURL(filePath).toString() };
});

ipcMain.handle('nowlayer:set-startup', (_event, enabled) => {
  if (process.platform !== 'win32') return false;
  app.setLoginItemSettings({ openAtLogin: enabled === true, openAsHidden: false });
  return app.getLoginItemSettings().openAtLogin;
});

ipcMain.handle('nowlayer:media-action', async (_event, action) => {
  return mediaMonitor.performAction(action);
});

ipcMain.handle('nowlayer:list-capture-sources', async () => listCaptureSources());

ipcMain.handle('nowlayer:set-capture-source', async (_event, sourceId) => {
  const sources = await getRawCaptureSources();
  const selected = findSelectedSource(sources, sourceId);
  if (!selected || /nowlayer/i.test(selected.name)) throw new Error('That window is no longer available.');
  return setVideoState({
    active: true,
    sourceId: selected.id,
    sourceName: selected.name,
    error: '',
  });
});

ipcMain.handle('nowlayer:stop-capture', () => setVideoState({
  active: false,
  sourceId: '',
  sourceName: '',
  error: '',
}));

ipcMain.handle('nowlayer:video-error', (_event, message) => {
  videoState = normalizeVideoState({ ...videoState, error: message });
  broadcastState();
  return videoState;
});

ipcMain.handle('nowlayer:copy-diagnostics', () => {
  const state = currentState();
  const diagnostics = {
    nowLayerVersion: state.app.version,
    packaged: state.app.isPackaged,
    platform: state.platform,
    media: {
      available: state.media.available,
      source: state.media.source,
      status: state.media.status,
      error: state.media.error,
    },
    settings: state.settings,
    electron: process.versions.electron,
    chromium: process.versions.chrome,
    node: process.versions.node,
    windows: process.getSystemVersion(),
  };
  clipboard.writeText(JSON.stringify(diagnostics, null, 2));
  return true;
});

ipcMain.handle('nowlayer:reset-settings', () => {
  const defaults = sanitizeSettings(DEFAULT_SETTINGS);
  timekeeper?.update(defaults.utilities);
  overlayManager.setSettings(defaults);
  scheduleSettingsSave(defaults);
  updateTrayMenu();
  broadcastState();
  return overlayManager.settings;
});

function registerDesktopHotkeys(hotkeys = DEFAULT_HOTKEYS) {
  globalShortcut.unregisterAll();
  const visibilityRegistered = globalShortcut.register(hotkeys.visibility, () => {
    overlayManager.toggleVisible();
  });
  const lockRegistered = globalShortcut.register(hotkeys.lock, () => {
    overlayManager.toggleLocked();
  });
  const dismissRegistered = globalShortcut.register(hotkeys.dismissAlert, () => timekeeper.dismissAlert());
  if (!visibilityRegistered || !lockRegistered || !dismissRegistered) {
    console.warn('[hotkey] One or more shortcuts are already in use.');
    globalShortcut.unregisterAll();
    return false;
  }
  return true;
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    createControlWindow({ show: true });
  });

  app.whenReady().then(() => {
    configureDisplayCapture();
    settingsPath = path.join(app.getPath('userData'), 'settings.json');
    const loadedSettings = loadSettings(settingsPath);
    overlayManager.setSettings(smokeTestMode
      ? { ...loadedSettings, visible: false, onboardingComplete: true }
      : loadedSettings);
    timekeeper = new Timekeeper(overlayManager.settings.utilities);
    timekeeper.on('change', (utilities) => {
      overlayManager.updateSettings({ utilities });
      broadcastState();
    });
    // Persist the clean startup state so a timer cannot be resurrected next time.
    overlayManager.updateSettings({ utilities: timekeeper.getState() });
    timekeeper.start();
    overlayManager.createDesktopWindow();
    if (!smokeTestMode) createTray();
    createControlWindow({ show: !smokeTestMode });
    registerDesktopHotkeys(overlayManager.settings.hotkeys);
    mediaMonitor.start();

    if (smokeTestMode) {
      setTimeout(() => {
        console.info('[smoke] Standalone runtime initialized successfully.');
        app.quit();
      }, 2500);
    }

    app.on('activate', () => {
      createControlWindow({ show: true });
    });
  });
}

app.on('before-quit', () => {
  shuttingDown = true;
  if (settingsSaveTimer) clearTimeout(settingsSaveTimer);
  if (settingsPath && !smokeTestMode) {
    try { saveSettings(settingsPath, overlayManager.settings); } catch { /* best effort */ }
  }
  mediaMonitor.stop();
  timekeeper?.stop();
  globalShortcut.unregisterAll();
  overlayManager.dispose();
  if (tray) tray.destroy();
  tray = null;
});

app.on('window-all-closed', () => {
  // NowLayer remains available from the system tray.
});
