(function (root) {
  const layouts = Object.freeze({
    strip: Object.freeze({ width: 560, height: 34 }),
    compact: Object.freeze({ width: 360, height: 64 }),
    detailed: Object.freeze({ width: 300, height: 140 }),
  });
  const themes = Object.freeze(['graphite', 'midnight', 'minimal']);
  const metricKeys = Object.freeze(['fps', 'frameTime', 'cpu', 'cpuTemp', 'gpu', 'gpuTemp', 'ram', 'vram']);
  const defaultMetrics = Object.freeze({ fps: true, frameTime: false, cpu: true, cpuTemp: false, gpu: true, gpuTemp: true, ram: true, vram: true });
  function metricCount(metrics = defaultMetrics) {
    return Math.max(1, metricKeys.filter(key => metrics[key] !== false).length);
  }
  function dimensions(layout, metrics = defaultMetrics) {
    const selected = Object.hasOwn(layouts, layout) ? layout : 'strip';
    const count = metricCount(metrics);
    if (selected === 'strip') return { width: Math.min(700, Math.max(260, 26 + count * 74)), height: 34 };
    if (selected === 'compact') return { width: 360, height: count > 4 ? 92 : 64 };
    return { width: 300, height: 48 + Math.ceil(count / 2) * 42 };
  }
  const api = { layouts, themes, metricKeys, defaultMetrics, metricCount, dimensions };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.NowLayerPerformanceLayout = api;
})(typeof window !== 'undefined' ? window : globalThis);
