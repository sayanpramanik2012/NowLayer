const assert = require('node:assert/strict');
const test = require('node:test');
const { OverlayManager } = require('../src/main/overlay-manager');

function createManager() {
  const app = { isPackaged: false };
  const screen = {
    getDisplayNearestPoint: () => ({
      workArea: { x: 0, y: 0, width: 1920, height: 1080 },
    }),
  };
  return new OverlayManager({
    app,
    BrowserWindow: class {},
    screen,
    rendererPath: 'renderer.html',
    preloadPath: 'preload.js',
  });
}

function attachWindow(manager) {
  const calls = {
    alwaysOnTop: [],
    focusable: [],
    ignore: [],
    sizes: [],
    bounds: [],
    showInactive: 0,
    hide: 0,
    moveTop: 0,
    resizable: [],
    aspectRatios: [],
  };
  manager.desktopWindow = {
    webContents: { isDestroyed: () => false, send: () => {} },
    isDestroyed: () => false,
    getSize: () => [420, 116],
    setAlwaysOnTop: (...args) => calls.alwaysOnTop.push(args),
    setVisibleOnAllWorkspaces: () => {},
    setFocusable: (...args) => calls.focusable.push(args),
    setIgnoreMouseEvents: (...args) => calls.ignore.push(args),
    setSize: (...args) => calls.sizes.push(args),
    setResizable: (...args) => calls.resizable.push(args),
    setAspectRatio: (...args) => calls.aspectRatios.push(args),
    setMinimumSize: () => {},
    setMaximumSize: () => {},
    setBounds: (...args) => calls.bounds.push(args),
    showInactive: () => { calls.showInactive += 1; },
    hide: () => { calls.hide += 1; },
    moveTop: () => { calls.moveTop += 1; },
  };
  return calls;
}

test('reports a standalone always-on-top runtime', () => {
  const manager = createManager();
  assert.deepEqual(manager.getStatus(), {
    mode: 'standalone',
    runtime: 'Electron',
    alwaysOnTop: true,
    message: 'Standalone always-on-top overlay is active.',
    requestedInputMode: 'click-through',
  });
});

test('compact locked mode is topmost, click-through, and non-focusable', () => {
  const manager = createManager();
  const calls = attachWindow(manager);
  manager.setSettings({ compact: true, locked: true, visible: true });

  assert.deepEqual(calls.alwaysOnTop.at(-1), [true, 'screen-saver']);
  assert.deepEqual(calls.ignore.at(-1), [true, { forward: true }]);
  assert.deepEqual(calls.focusable.at(-1), [false]);
  assert.deepEqual(calls.sizes.at(-1), [420, 76, false]);
  assert.equal(calls.bounds.at(-1)[0].height, 76);
  assert.equal(calls.showInactive, 1);
});

test('unlocking makes the overlay interactive without taking focus immediately', () => {
  const manager = createManager();
  const calls = attachWindow(manager);
  manager.updateSettings({ locked: false });

  assert.deepEqual(calls.ignore.at(-1), [false, { forward: true }]);
  assert.deepEqual(calls.focusable.at(-1), [true]);
  assert.equal(calls.showInactive, 1);
  assert.equal(calls.moveTop, 1);
  assert.equal(manager.getStatus().requestedInputMode, 'interactive');
});

test('video mode resizes the overlay to a 16:9 PiP surface', () => {
  const manager = createManager();
  const calls = attachWindow(manager);
  manager.setVideoMode(true);

  assert.deepEqual(manager.getTargetDimensions(), { width: 480, height: 270 });
  assert.deepEqual(calls.sizes.at(-1), [480, 270, false]);
  assert.equal(calls.bounds.at(-1)[0].width, 480);
  assert.equal(calls.bounds.at(-1)[0].height, 270);
  assert.deepEqual(calls.resizable.at(-1), [false]);
  assert.deepEqual(calls.aspectRatios.at(-1), [16 / 9]);
});

test('unlocked video PiP is resizable and uses the saved 16:9 size', () => {
  const manager = createManager();
  const calls = attachWindow(manager);
  manager.updateSettings({ locked: false, pipBounds: { width: 640, height: 1 } });
  manager.setVideoMode(true);

  assert.deepEqual(manager.getTargetDimensions(), { width: 640, height: 360 });
  assert.deepEqual(calls.resizable.at(-1), [true]);
  assert.deepEqual(calls.sizes.at(-1), [640, 360, false]);
});

test('separate time widget follows the same game-safe click-through mode', () => {
  const manager = createManager();
  attachWindow(manager);
  const calls = { ignore: [], focusable: [], showInactive: 0, alwaysOnTop: [] };
  manager.utilityWindow = {
    isDestroyed: () => false,
    setAlwaysOnTop: (...args) => calls.alwaysOnTop.push(args),
    setVisibleOnAllWorkspaces: () => {},
    setIgnoreMouseEvents: (...args) => calls.ignore.push(args),
    setFocusable: (...args) => calls.focusable.push(args),
    showInactive: () => { calls.showInactive += 1; },
    moveTop: () => {},
    webContents: { isDestroyed: () => false, send: () => {} },
  };
  manager.updateSettings({ utilities: { displayMode: 'separate', showClock: true } });

  assert.deepEqual(calls.alwaysOnTop.at(-1), [true, 'screen-saver']);
  assert.deepEqual(calls.ignore.at(-1), [true, { forward: true }]);
  assert.deepEqual(calls.focusable.at(-1), [false]);
  assert.equal(calls.showInactive, 1);
});
