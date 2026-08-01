const assert = require('node:assert/strict');
const test = require('node:test');
const {
  calculateAnchoredBounds,
  sanitizeSettings,
} = require('../src/main/config');

test('sanitizeSettings rejects unsafe and out-of-range values', () => {
  const result = sanitizeSettings({
    visible: 0,
    locked: 'yes',
    compact: true,
    showPipControls: false,
    pipControlPosition: 'center',
    opacity: 7,
    anchor: 'somewhere',
    margin: -40,
    bounds: { x: 12.4, y: Number.NaN, width: 10000, height: 1 },
  });

  assert.equal(result.visible, true);
  assert.equal(result.locked, true);
  assert.equal(result.compact, true);
  assert.equal(result.showPipControls, false);
  assert.equal(result.pipControlPosition, 'top-right');
  assert.equal(result.opacity, 1);
  assert.equal(result.anchor, 'bottom-right');
  assert.equal(result.margin, 0);
  assert.deepEqual(result.bounds, { x: 12, y: null, width: 720, height: 76 });
});

test('PiP control preferences accept only supported corners', () => {
  const result = sanitizeSettings({
    showPipControls: true,
    pipControlPosition: 'bottom-left',
  });
  assert.equal(result.showPipControls, true);
  assert.equal(result.pipControlPosition, 'bottom-left');
});

test('calculateAnchoredBounds handles offset monitors', () => {
  const bounds = calculateAnchoredBounds(
    { x: -1920, y: 0, width: 1920, height: 1080 },
    {
      anchor: 'top-right',
      margin: 20,
      bounds: { width: 420, height: 116 },
    },
  );

  assert.deepEqual(bounds, { x: -440, y: 20, width: 420, height: 116 });
});

test('manual bounds remain inside the selected work area', () => {
  const bounds = calculateAnchoredBounds(
    { x: 0, y: 0, width: 1280, height: 720 },
    {
      anchor: 'manual',
      bounds: { x: 5000, y: -100, width: 420, height: 116 },
    },
  );

  assert.deepEqual(bounds, { x: 860, y: 0, width: 420, height: 116 });
});

test('first-run placement fields are sanitized', () => {
  const result = sanitizeSettings({
    onboardingComplete: true,
  });
  assert.equal(result.onboardingComplete, true);
});

test('clock, timer, and alarm preferences are persisted safely', () => {
  const result = sanitizeSettings({
    utilities: {
      showClock: true,
      displayMode: 'separate',
      showTimer: false,
      widgetVisible: true,
      timer: { pausedRemaining: 90, soundEnabled: true },
      alarm: { enabled: true, time: '06:45', soundEnabled: false },
    },
  });
  assert.equal(result.utilities.showClock, true);
  assert.equal(result.utilities.displayMode, 'separate');
  assert.equal(result.utilities.showTimer, false);
  assert.equal(result.utilities.widgetVisible, true);
  assert.equal(result.utilities.timer.pausedRemaining, 90);
  assert.equal(result.utilities.timer.soundEnabled, true);
  assert.equal(result.utilities.alarm.time, '06:45');
  assert.equal(result.utilities.alarm.enabled, true);
});

test('hotkeys use safe accelerators and reject duplicates', () => {
  const result = sanitizeSettings({
    hotkeys: { visibility: 'Ctrl+Shift+P', lock: 'Ctrl+Shift+P', dismissAlert: 'unsafe' },
  });
  assert.equal(result.hotkeys.visibility, 'CommandOrControl+Shift+P');
  assert.equal(result.hotkeys.lock, 'CommandOrControl+Shift+L');
  assert.equal(result.hotkeys.dismissAlert, 'CommandOrControl+Shift+A');
});
