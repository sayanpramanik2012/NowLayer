/* Shared by the actual overlay and its Control Center preview. */
window.NowLayerPerformanceView = {
  mount(container) {
    container.classList.add('nl-performance');
    container.innerHTML = '<div class="nl-heading"><span>PERFORMANCE</span><span data-metric="live"></span></div><div class="nl-metrics">'
      + '<section><small>FPS</small><strong data-metric="fps">—</strong><span data-metric="frame">— ms</span></section>'
      + '<section><small>CPU</small><strong data-metric="cpu">—</strong><span data-metric="cpuTemp">—°C</span></section>'
      + '<section><small>GPU</small><strong data-metric="gpu">—</strong><span data-metric="gpuTemp">—°C</span></section>'
      + '<section><small>RAM</small><strong data-metric="ram">—</strong><span data-metric="vram">VRAM —</span></section></div>';
    const fields = Object.fromEntries([...container.querySelectorAll('[data-metric]')].map(el => [el.dataset.metric, el]));
    const format = (value, suffix = '', digits = 0) => Number.isFinite(value) ? `${value.toFixed(digits)}${suffix}` : `—${suffix}`;
    return {
      configure(settings = {}) {
        const model = window.NowLayerPerformanceLayout;
        const layout = Object.hasOwn(model.layouts, settings.layout) ? settings.layout : 'strip';
        container.dataset.layout = layout;
        container.dataset.theme = model.themes.includes(settings.theme) ? settings.theme : 'graphite';
        const size = model.dimensions(layout);
        container.style.width = `${size.width}px`;
        container.style.height = `${size.height}px`;
        container.style.setProperty('--nl-opacity', String(settings.opacity ?? .94));
      },
      render(data, example = false) {
        const fresh = data && Date.now() - data.sampledAt < 4000;
        const stats = fresh ? data : {};
        fields.live.textContent = example ? 'EXAMPLE' : fresh && Number.isFinite(stats.cpuUsage) ? 'LIVE' : 'WAITING';
        fields.fps.textContent = format(stats.fps);
        fields.frame.textContent = format(stats.frameTime, 'ms', 1);
        fields.cpu.textContent = format(stats.cpuUsage, '%');
        fields.cpuTemp.textContent = format(stats.cpuTemperature, '°C');
        fields.gpu.textContent = format(stats.gpu?.usage, '%');
        fields.gpuTemp.textContent = format(stats.gpu?.temperature, '°C');
        fields.ram.textContent = format(stats.ramUsedGb, 'G', 1);
        fields.ram.title = `${format(stats.ramUsedGb, ' GiB', 1)} / ${format(stats.ramTotalGb, ' GiB', 1)}`;
        fields.vram.textContent = `VRAM ${format(Number.isFinite(stats.gpu?.memoryUsedMb) ? stats.gpu.memoryUsedMb / 1024 : null, 'G', 1)}`;
        container.title = [stats.gpu?.name, stats.fpsStatus, 'G = GiB. Missing readings show —. Setup details are in Control Center → Performance.'].filter(Boolean).join('\n');
      },
    };
  },
};
