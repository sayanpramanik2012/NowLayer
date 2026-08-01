const { EventEmitter } = require('node:events');
const { calculateAnchoredBounds, sanitizeSettings } = require('./config');

class OverlayManager extends EventEmitter {
  constructor({ app, BrowserWindow, screen, rendererPath, utilityRendererPath, preloadPath }) {
    super();
    this.app = app;
    this.BrowserWindow = BrowserWindow;
    this.screen = screen;
    this.rendererPath = rendererPath;
    this.utilityRendererPath = utilityRendererPath;
    this.preloadPath = preloadPath;
    this.settings = sanitizeSettings();
    this.desktopWindow = null;
    this.utilityWindow = null;
    this.positioningWindow = false;
    this.videoMode = false;
    this.status = {
      mode: 'standalone',
      runtime: 'Electron',
      alwaysOnTop: true,
      message: 'Standalone always-on-top overlay is active.',
    };
  }

  setSettings(settings) {
    this.settings = sanitizeSettings(settings);
    this.applySettings();
  }

  createDesktopWindow() {
    if (this.desktopWindow && !this.desktopWindow.isDestroyed()) {
      return this.desktopWindow;
    }

    const bounds = this.getDesktopBounds();
    const window = new this.BrowserWindow({
      ...bounds,
      title: 'NowLayer',
      frame: false,
      transparent: true,
      backgroundColor: '#00000000',
      resizable: false,
      movable: true,
      focusable: !this.settings.locked,
      show: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      hasShadow: false,
      fullscreenable: false,
      maximizable: false,
      minimizable: false,
      webPreferences: {
        preload: this.preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        devTools: !this.app.isPackaged,
      },
    });

    this.desktopWindow = window;
    this.keepOnTop();
    window.loadFile(this.rendererPath);

    window.once('ready-to-show', () => {
      this.applySettings();
      if (this.settings.visible) window.showInactive();
    });

    window.on('moved', () => {
      if (this.positioningWindow || window.isDestroyed()) return;
      const [x, y] = window.getPosition();
      this.settings = sanitizeSettings({
        ...this.settings,
        anchor: 'manual',
        bounds: { ...this.settings.bounds, x, y },
      });
      this.emit('settings-changed', this.settings);
    });

    window.on('resized', () => {
      if (!this.videoMode || this.settings.locked || window.isDestroyed()) return;
      const [rawWidth] = window.getSize();
      const width = Math.min(960, Math.max(320, Math.round(rawWidth)));
      const height = Math.round(width * 9 / 16);
      this.settings = sanitizeSettings({
        ...this.settings,
        pipBounds: { width, height },
      });
      this.emit('settings-changed', this.settings);
    });

    window.on('closed', () => {
      if (this.desktopWindow === window) this.desktopWindow = null;
    });

    return window;
  }

  createUtilityWindow() {
    if (this.utilityWindow && !this.utilityWindow.isDestroyed()) return this.utilityWindow;
    if (!this.utilityRendererPath) return null;
    const requested = this.settings.utilityBounds || {};
    const display = this.screen.getDisplayNearestPoint({ x: Number.isFinite(requested.x) ? requested.x : 0, y: Number.isFinite(requested.y) ? requested.y : 0 });
    const dimensions = this.getUtilityDimensions();
    const x = Number.isFinite(requested.x) ? requested.x : display.workArea.x + display.workArea.width - dimensions.width - 24;
    const y = Number.isFinite(requested.y) ? requested.y : display.workArea.y + 24;
    const bounds = {
      ...dimensions,
      x: Math.min(display.workArea.x + display.workArea.width - dimensions.width, Math.max(display.workArea.x, x)),
      y: Math.min(display.workArea.y + display.workArea.height - dimensions.height, Math.max(display.workArea.y, y)),
    };
    const window = new this.BrowserWindow({
      ...bounds,
      title: 'NowLayer Time & Timer',
      frame: false,
      transparent: true,
      backgroundColor: '#00000000',
      resizable: false,
      movable: true,
      focusable: !this.settings.locked,
      show: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      hasShadow: false,
      fullscreenable: false,
      maximizable: false,
      minimizable: false,
      webPreferences: { preload: this.preloadPath, contextIsolation: true, nodeIntegration: false, sandbox: true, devTools: !this.app.isPackaged },
    });
    this.utilityWindow = window;
    this.keepUtilityOnTop();
    window.loadFile(this.utilityRendererPath);
    window.once('ready-to-show', () => this.applyUtilityWindow());
    window.on('moved', () => {
      if (window.isDestroyed()) return;
      const [x, y] = window.getPosition();
      this.settings = sanitizeSettings({ ...this.settings, utilityBounds: { x, y } });
      this.emit('settings-changed', this.settings);
    });
    window.on('closed', () => { if (this.utilityWindow === window) this.utilityWindow = null; });
    return window;
  }

  keepOnTop() {
    const window = this.desktopWindow;
    if (!window || window.isDestroyed()) return;
    window.setAlwaysOnTop(true, 'screen-saver');
    if (typeof window.setVisibleOnAllWorkspaces === 'function') {
      window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    }
  }

  keepUtilityOnTop() {
    const window = this.utilityWindow;
    if (!window || window.isDestroyed()) return;
    window.setAlwaysOnTop(true, 'screen-saver');
    if (typeof window.setVisibleOnAllWorkspaces === 'function') window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  }

  applySettings() {
    const window = this.desktopWindow;
    if (!window || window.isDestroyed()) return;

    const dimensions = this.getTargetDimensions();
    this.keepOnTop();
    window.setIgnoreMouseEvents(this.settings.locked, { forward: true });
    if (typeof window.setFocusable === 'function') window.setFocusable(!this.settings.locked);
    if (typeof window.setResizable === 'function') window.setResizable(this.videoMode && !this.settings.locked);
    if (typeof window.setMinimumSize === 'function') window.setMinimumSize(this.videoMode ? 320 : 300, this.videoMode ? 180 : 76);
    if (typeof window.setMaximumSize === 'function') window.setMaximumSize(this.videoMode ? 960 : 720, this.videoMode ? 540 : 116);
    if (typeof window.setAspectRatio === 'function') window.setAspectRatio(this.videoMode ? 16 / 9 : 0);

    const currentSize = typeof window.getSize === 'function'
      ? window.getSize()
      : [0, 0];
    if (currentSize[0] !== dimensions.width || currentSize[1] !== dimensions.height) {
      window.setSize(dimensions.width, dimensions.height, false);
    }
    this.positionDesktopWindow();

    if (!this.settings.visible) {
      window.hide();
    } else {
      window.showInactive();
      if (typeof window.moveTop === 'function') window.moveTop();
    }

    this.broadcast('nowlayer:settings', this.settings);
    this.applyUtilityWindow();
  }

  applyUtilityWindow() {
    const utilities = this.settings.utilities || {};
    const timer = utilities.timer || {};
    const shouldShow = utilities.displayMode === 'separate' && utilities.widgetVisible !== false
      && (utilities.showClock || utilities.showTimer !== false);
    if (!shouldShow) {
      if (this.utilityWindow && !this.utilityWindow.isDestroyed()) this.utilityWindow.hide();
      return;
    }
    const window = this.createUtilityWindow();
    if (!window || window.isDestroyed()) return;
    const dimensions = this.getUtilityDimensions();
    if (typeof window.setSize === 'function') window.setSize(dimensions.width, dimensions.height, false);
    this.keepUtilityOnTop();
    window.setIgnoreMouseEvents(this.settings.locked, { forward: true });
    if (typeof window.setFocusable === 'function') window.setFocusable(!this.settings.locked);
    window.showInactive();
    if (typeof window.moveTop === 'function') window.moveTop();
  }

  updateSettings(patch) {
    this.settings = sanitizeSettings({
      ...this.settings,
      ...patch,
      bounds: { ...this.settings.bounds, ...(patch.bounds ?? {}) },
      pipBounds: { ...this.settings.pipBounds, ...(patch.pipBounds ?? {}) },
      utilityBounds: { ...this.settings.utilityBounds, ...(patch.utilityBounds ?? {}) },
    });
    this.applySettings();
    this.emit('settings-changed', this.settings);
    return this.settings;
  }

  setVideoMode(active) {
    this.videoMode = active === true;
    this.applySettings();
  }

  toggleVisible() {
    return this.updateSettings({ visible: !this.settings.visible });
  }

  toggleLocked() {
    return this.updateSettings({ locked: !this.settings.locked });
  }

  showDesktopWindow() {
    if (!this.settings.visible) return;
    const window = this.createDesktopWindow();
    if (!window.isDestroyed()) {
      this.keepOnTop();
      window.showInactive();
      if (typeof window.moveTop === 'function') window.moveTop();
    }
  }

  hideDesktopWindow() {
    if (this.desktopWindow && !this.desktopWindow.isDestroyed()) this.desktopWindow.hide();
  }

  positionDesktopWindow() {
    const window = this.desktopWindow;
    if (!window || window.isDestroyed()) return;
    const bounds = this.getDesktopBounds();
    this.positioningWindow = true;
    window.setBounds(bounds, false);
    setImmediate(() => { this.positioningWindow = false; });
  }

  getDesktopBounds() {
    const display = this.screen.getDisplayNearestPoint({
      x: Number.isFinite(this.settings.bounds.x) ? this.settings.bounds.x : 0,
      y: Number.isFinite(this.settings.bounds.y) ? this.settings.bounds.y : 0,
    });
    const dimensions = this.getTargetDimensions();
    return calculateAnchoredBounds(display.workArea, this.settings, dimensions);
  }

  getTargetDimensions() {
    if (this.videoMode) return { ...this.settings.pipBounds };
    return {
      width: this.settings.bounds.width,
      height: this.settings.compact ? 76 : 116,
    };
  }

  getUtilityDimensions() {
    const utilities = this.settings.utilities || {};
    const analog = utilities.showClock && utilities.clockStyle === 'analog';
    const onePanel = (utilities.showClock && utilities.showTimer === false)
      || (!utilities.showClock && utilities.showTimer !== false);
    return {
      width: analog ? (utilities.showTimer === false ? 132 : 270) : (onePanel ? 172 : 242),
      height: analog ? 132 : 68,
    };
  }

  broadcast(channel, payload) {
    for (const window of [this.desktopWindow, this.utilityWindow]) {
      if (!window || window.isDestroyed() || window.webContents.isDestroyed()) continue;
      window.webContents.send(channel, payload);
    }
  }

  getStatus() {
    return {
      ...this.status,
      requestedInputMode: this.settings.locked ? 'click-through' : 'interactive',
    };
  }

  dispose() {
    if (this.desktopWindow && !this.desktopWindow.isDestroyed()) this.desktopWindow.destroy();
    this.desktopWindow = null;
    if (this.utilityWindow && !this.utilityWindow.isDestroyed()) this.utilityWindow.destroy();
    this.utilityWindow = null;
  }
}

module.exports = { OverlayManager };
