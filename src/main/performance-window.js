const { EventEmitter } = require('node:events');
const { calculateAnchoredBounds } = require('./config');
const { dimensions } = require('../shared/performance-layout');

class PerformanceWindow extends EventEmitter {
  constructor({ app, BrowserWindow, screen, rendererPath, preloadPath }) {
    super();
    Object.assign(this, { app, BrowserWindow, screen, rendererPath, preloadPath });
    this.window = null;
    this.positioning = false;
    this.positionKey = '';
  }
  apply(settings) {
    this.settings = settings;
    const config = settings.performance;
    if (!config.enabled || !settings.visible) {
      const previous = this.window;
      this.window = null;
      if (previous && !previous.isDestroyed()) previous.destroy();
      return;
    }
    const size = dimensions(config.layout, config.metrics);
    if (!this.window) {
      const window = new this.BrowserWindow({
        ...size, title: 'NowLayer Performance', frame: false, transparent: true,
        backgroundColor: '#00000000', resizable: false, movable: true, focusable: !settings.locked,
        show: false, skipTaskbar: true, alwaysOnTop: true, hasShadow: false,
        fullscreenable: false, maximizable: false, minimizable: false,
        webPreferences: { preload: this.preloadPath, contextIsolation: true, nodeIntegration: false, sandbox: true, devTools: !this.app.isPackaged },
      });
      this.window = window;
      this.positionKey = '';
      window.loadFile(this.rendererPath);
      window.once('ready-to-show', () => this.apply(this.settings));
      window.on('moved', () => {
        if (this.positioning || window.isDestroyed()) return;
        const [x, y] = window.getPosition();
        this.emit('position', { anchor: 'manual', x, y });
      });
      window.on('closed', () => { if (this.window === window) this.window = null; });
      window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    }
    const window = this.window;
    const display = this.screen.getDisplayNearestPoint({ x: config.x ?? 0, y: config.y ?? 0 });
    const bounds = calculateAnchoredBounds(display.workArea, {
      ...settings, anchor: config.anchor, bounds: { x: config.x, y: config.y, width: size.width },
    }, size);
    const key = JSON.stringify(bounds);
    if (key !== this.positionKey) {
      this.positionKey = key;
      this.positioning = true;
      window.setBounds(bounds, false);
      setImmediate(() => { this.positioning = false; });
    }
    window.setAlwaysOnTop(true, 'screen-saver');
    window.setIgnoreMouseEvents(settings.locked, { forward: true });
    window.setFocusable(!settings.locked);
    if (this.suppressed) window.hide(); else window.showInactive();
  }
  setSuppressed(value) { this.suppressed = value === true; if (this.settings) this.apply(this.settings); }
  broadcast(channel, value) {
    const window = this.window;
    if (window && !window.isDestroyed() && !window.webContents.isDestroyed()) window.webContents.send(channel, value);
  }
  dispose() { this.window?.destroy(); this.window = null; }
}

module.exports = { PerformanceWindow };
