(function (root) {
  const layouts = Object.freeze({
    strip: Object.freeze({ width: 560, height: 34 }),
    compact: Object.freeze({ width: 360, height: 64 }),
    detailed: Object.freeze({ width: 300, height: 140 }),
  });
  const themes = Object.freeze(['graphite', 'midnight', 'minimal']);
  function dimensions(layout) { return Object.hasOwn(layouts, layout) ? layouts[layout] : layouts.strip; }
  const api = { layouts, themes, dimensions };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.NowLayerPerformanceLayout = api;
})(typeof window !== 'undefined' ? window : globalThis);
