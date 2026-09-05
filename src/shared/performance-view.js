/* Shared by the actual overlay and its Control Center preview. */
window.NowLayerPerformanceView = {
  mount(container) {
    container.classList.add('nl-performance');
    container.innerHTML = '<div class="nl-heading"><span>PERFORMANCE</span><span data-live></span></div><div class="nl-metrics"></div>';
    const metricsHost = container.querySelector('.nl-metrics');
    const live = container.querySelector('[data-live]');
    const definitions = {
      fps: ['FPS', data => data.fps, '', 0], frameTime: ['FRAME', data => data.frameTime, 'ms', 1],
      cpu: ['CPU', data => data.cpuUsage, '%', 0], cpuTemp: ['CPU TEMP', data => data.cpuTemperature, '°C', 0],
      gpu: ['GPU', data => data.gpu?.usage, '%', 0], gpuTemp: ['GPU TEMP', data => data.gpu?.temperature, '°C', 0],
      ram: ['RAM', data => data.ramUsedGb, 'G', 1],
      vram: ['VRAM', data => Number.isFinite(data.gpu?.memoryUsedMb) ? data.gpu.memoryUsedMb / 1024 : null, 'G', 1],
    };
    let fields = {};
    let signature = '';
    return {
      configure(settings = {}) {
        const model = window.NowLayerPerformanceLayout;
        const layout = Object.hasOwn(model.layouts, settings.layout) ? settings.layout : 'strip';
        const metricSettings = settings.metrics || model.defaultMetrics;
        const nextSignature = model.metricKeys.filter(key => metricSettings[key] !== false).join(',');
        if (nextSignature !== signature) {
          signature = nextSignature;
          fields = {};
          metricsHost.replaceChildren(...nextSignature.split(',').filter(Boolean).map(key => {
            const section = document.createElement('section');
            section.dataset.metric = key;
            const label = document.createElement('small');
            label.textContent = definitions[key][0];
            const value = document.createElement('strong');
            value.textContent = 'n/a';
            section.append(label, value);
            fields[key] = { section, value };
            return section;
          }));
        }
        container.dataset.layout = layout;
        container.dataset.theme = model.themes.includes(settings.theme) ? settings.theme : 'graphite';
        const size = model.dimensions(layout, metricSettings);
        container.style.width = `${size.width}px`;
        container.style.height = `${size.height}px`;
        container.style.setProperty('--nl-opacity', String(settings.opacity ?? .94));
      },
      render(data, example = false) {
        const fresh = data && Date.now() - data.sampledAt < 5000;
        const stats = fresh ? data : {};
        live.textContent = example ? 'EXAMPLE' : fresh && Number.isFinite(stats.cpuUsage) ? 'LIVE' : 'WAITING';
        const spoken = [];
        for (const [key, field] of Object.entries(fields)) {
          const [label, read, suffix, digits] = definitions[key];
          const value = read(stats);
          const available = Number.isFinite(value);
          field.value.textContent = available ? `${value.toFixed(digits)}${suffix}` : 'n/a';
          field.section.classList.toggle('is-missing', !available);
          spoken.push(`${label} ${available ? field.value.textContent : 'unavailable'}`);
        }
        // Diagnostics belong in Control Center. A title creates a large native tooltip over the game.
        container.removeAttribute('title');
        container.setAttribute('aria-label', `Performance. ${spoken.join(', ')}`);
      },
    };
  },
};
