const fs = require('node:fs');

const ALLOWED_ANCHORS = new Set([
  'top-left',
  'top-center',
  'top-right',
  'middle-left',
  'middle-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
  'manual',
]);

const ALLOWED_PIP_CONTROL_POSITIONS = new Set([
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right',
]);

const DEFAULT_HOTKEYS = Object.freeze({
  visibility: 'CommandOrControl+Shift+M',
  lock: 'CommandOrControl+Shift+L',
  dismissAlert: 'CommandOrControl+Shift+A',
});

function sanitizeHotkey(value, fallback) {
  const candidate = String(value || '').trim().replace(/^Ctrl\+/i, 'CommandOrControl+');
  if (candidate.length < 3 || candidate.length > 64) return fallback;
  if (!/^(?:(?:CommandOrControl|Alt|Shift)\+)+(?:[A-Z0-9]|F(?:[1-9]|1[0-2]))$/i.test(candidate)) return fallback;
  return candidate;
}

function sanitizeHotkeys(candidate = {}) {
  const result = {
    visibility: sanitizeHotkey(candidate.visibility, DEFAULT_HOTKEYS.visibility),
    lock: sanitizeHotkey(candidate.lock, DEFAULT_HOTKEYS.lock),
    dismissAlert: sanitizeHotkey(candidate.dismissAlert, DEFAULT_HOTKEYS.dismissAlert),
  };
  const used = new Set();
  for (const key of Object.keys(result)) {
    if (used.has(result[key].toLowerCase())) result[key] = DEFAULT_HOTKEYS[key];
    used.add(result[key].toLowerCase());
  }
  return result;
}

const DEFAULT_SETTINGS = Object.freeze({
  onboardingComplete: false,
  visible: true,
  mediaEnabled: true,
  locked: true,
  compact: false,
  showPipControls: true,
  pipControlPosition: 'top-right',
  opacity: 0.94,
  mediaOpacity: 0.94,
  videoOpacity: 1,
  anchor: 'bottom-right',
  margin: 24,
  hotkeys: DEFAULT_HOTKEYS,
  performance: require('./performance-settings').normalizePerformance(),
  utilities: {
    showClock: false,
    showTimer: true,
    widgetVisible: true,
    displayMode: 'embedded',
    timer: { active: false, endAt: 0, pausedRemaining: 0, soundEnabled: false, soundPath: '' },
    alarm: { enabled: false, time: '07:00', soundEnabled: false, soundPath: '', lastFiredMinute: '' },
  },
  bounds: {
    x: null,
    y: null,
    width: 420,
    height: 116,
  },
  pipBounds: {
    width: 480,
    height: 270,
  },
  utilityBounds: {
    x: null,
    y: null,
  },
});

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function finiteOr(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

function sanitizeSettings(candidate = {}) {
  const sourceBounds = candidate.bounds ?? {};
  const width = clamp(
    Math.round(finiteOr(sourceBounds.width, DEFAULT_SETTINGS.bounds.width)),
    300,
    720,
  );
  const requestedHeight = candidate.compact ? 76 : 116;
  const height = requestedHeight;
  const legacyOpacity = clamp(finiteOr(candidate.opacity, DEFAULT_SETTINGS.opacity), 0.3, 1);
  const pipSource = candidate.pipBounds ?? {};
  const pipWidth = clamp(Math.round(finiteOr(pipSource.width, DEFAULT_SETTINGS.pipBounds.width)), 320, 960);
  const pipHeight = Math.round(pipWidth * 9 / 16);
  const utilitySource = candidate.utilityBounds ?? {};

  return {
    onboardingComplete: candidate.onboardingComplete === true,
    visible: candidate.visible !== false,
    mediaEnabled: candidate.mediaEnabled !== false,
    locked: candidate.locked !== false,
    compact: candidate.compact === true,
    showPipControls: candidate.showPipControls !== false,
    pipControlPosition: ALLOWED_PIP_CONTROL_POSITIONS.has(candidate.pipControlPosition)
      ? candidate.pipControlPosition
      : DEFAULT_SETTINGS.pipControlPosition,
    opacity: legacyOpacity,
    mediaOpacity: clamp(finiteOr(candidate.mediaOpacity, legacyOpacity), 0.3, 1),
    videoOpacity: clamp(finiteOr(candidate.videoOpacity, DEFAULT_SETTINGS.videoOpacity), 0.3, 1),
    anchor: ALLOWED_ANCHORS.has(candidate.anchor)
      ? candidate.anchor
      : DEFAULT_SETTINGS.anchor,
    margin: clamp(
      Math.round(finiteOr(candidate.margin, DEFAULT_SETTINGS.margin)),
      0,
      96,
    ),
    hotkeys: sanitizeHotkeys(candidate.hotkeys),
    performance: require('./performance-settings').normalizePerformance(candidate.performance),
    utilities: require('./timekeeper').normalizeUtilities(candidate.utilities),
    bounds: {
      x: Number.isFinite(sourceBounds.x) ? Math.round(sourceBounds.x) : null,
      y: Number.isFinite(sourceBounds.y) ? Math.round(sourceBounds.y) : null,
      width,
      height,
    },
    pipBounds: { width: pipWidth, height: pipHeight },
    utilityBounds: {
      x: Number.isFinite(utilitySource.x) ? Math.round(utilitySource.x) : null,
      y: Number.isFinite(utilitySource.y) ? Math.round(utilitySource.y) : null,
    },
  };
}

function loadSettings(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return sanitizeSettings(JSON.parse(raw));
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.warn('[settings] Falling back to defaults:', error.message);
    }
    return sanitizeSettings(DEFAULT_SETTINGS);
  }
}

function saveSettings(filePath, settings) {
  const clean = sanitizeSettings(settings);
  const temporaryPath = `${filePath}.tmp`;
  fs.writeFileSync(temporaryPath, `${JSON.stringify(clean, null, 2)}\n`, 'utf8');
  fs.renameSync(temporaryPath, filePath);
  return clean;
}

function calculateAnchoredBounds(workArea, settings, dimensions = null) {
  const clean = sanitizeSettings(settings);
  const width = dimensions?.width ?? clean.bounds.width;
  const height = dimensions?.height ?? clean.bounds.height;
  const margin = clean.margin;
  const left = workArea.x + margin;
  const centerX = workArea.x + Math.round((workArea.width - width) / 2);
  const right = workArea.x + workArea.width - width - margin;
  const top = workArea.y + margin;
  const centerY = workArea.y + Math.round((workArea.height - height) / 2);
  const bottom = workArea.y + workArea.height - height - margin;

  const coordinates = {
    'top-left': [left, top],
    'top-center': [centerX, top],
    'top-right': [right, top],
    'middle-left': [left, centerY],
    'middle-right': [right, centerY],
    'bottom-left': [left, bottom],
    'bottom-center': [centerX, bottom],
    'bottom-right': [right, bottom],
  };

  const manual = [
    finiteOr(clean.bounds.x, right),
    finiteOr(clean.bounds.y, bottom),
  ];
  const [requestedX, requestedY] = coordinates[clean.anchor] ?? manual;

  return {
    x: clamp(requestedX, workArea.x, workArea.x + workArea.width - width),
    y: clamp(requestedY, workArea.y, workArea.y + workArea.height - height),
    width,
    height,
  };
}

module.exports = {
  ALLOWED_ANCHORS,
  ALLOWED_PIP_CONTROL_POSITIONS,
  DEFAULT_SETTINGS,
  DEFAULT_HOTKEYS,
  calculateAnchoredBounds,
  loadSettings,
  sanitizeSettings,
  sanitizeHotkeys,
  saveSettings,
};
