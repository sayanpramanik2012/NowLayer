const { layouts, themes, metricKeys, defaultMetrics } = require('../shared/performance-layout');

function normalizePerformance(value = {}) {
  value = value && typeof value === 'object' ? value : {};
  const game = typeof value.processName === 'string' ? value.processName.trim() : '';
  const requestedMetrics = value.metrics && typeof value.metrics === 'object' ? value.metrics : {};
  const metrics = Object.fromEntries(metricKeys.map(key => [key,
    typeof requestedMetrics[key] === 'boolean' ? requestedMetrics[key] : defaultMetrics[key]]));
  if (!Object.values(metrics).some(Boolean)) Object.assign(metrics, defaultMetrics);
  return {
    enabled: value.enabled === true,
    layout: Object.hasOwn(layouts, value.layout) ? value.layout : 'strip',
    theme: themes.includes(value.theme) ? value.theme : 'graphite',
    metrics,
    updateRate: value.updateRate === 'responsive' ? 'responsive' : 'efficient',
    opacity: Number.isFinite(value.opacity) ? Math.min(1, Math.max(.3, value.opacity)) : .94,
    anchor: ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'manual'].includes(value.anchor) ? value.anchor : 'top-left',
    x: Number.isFinite(value.x) ? Math.round(value.x) : null,
    y: Number.isFinite(value.y) ? Math.round(value.y) : null,
    gpuId: typeof value.gpuId === 'string' ? value.gpuId.slice(0, 256) : '',
    processName: game.length <= 260 && /^[^\\/:*?"<>|\x00-\x1f]+\.exe$/i.test(game) && !game.startsWith('-') ? game : '',
  };
}

module.exports = { normalizePerformance };
