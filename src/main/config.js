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

const DEFAULT_SETTINGS = Object.freeze({
  onboardingComplete: false,
  visible: true,
  locked: true,
  compact: false,
  showPipControls: true,
  pipControlPosition: 'top-right',
  opacity: 0.94,
  anchor: 'bottom-right',
  margin: 24,
  bounds: {
    x: null,
    y: null,
    width: 420,
    height: 116,
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

  return {
    onboardingComplete: candidate.onboardingComplete === true,
    visible: candidate.visible !== false,
    locked: candidate.locked !== false,
    compact: candidate.compact === true,
    showPipControls: candidate.showPipControls !== false,
    pipControlPosition: ALLOWED_PIP_CONTROL_POSITIONS.has(candidate.pipControlPosition)
      ? candidate.pipControlPosition
      : DEFAULT_SETTINGS.pipControlPosition,
    opacity: clamp(finiteOr(candidate.opacity, DEFAULT_SETTINGS.opacity), 0.45, 1),
    anchor: ALLOWED_ANCHORS.has(candidate.anchor)
      ? candidate.anchor
      : DEFAULT_SETTINGS.anchor,
    margin: clamp(
      Math.round(finiteOr(candidate.margin, DEFAULT_SETTINGS.margin)),
      0,
      96,
    ),
    bounds: {
      x: Number.isFinite(sourceBounds.x) ? Math.round(sourceBounds.x) : null,
      y: Number.isFinite(sourceBounds.y) ? Math.round(sourceBounds.y) : null,
      width,
      height,
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
  calculateAnchoredBounds,
  loadSettings,
  sanitizeSettings,
  saveSettings,
};
