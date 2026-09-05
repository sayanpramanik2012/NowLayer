(() => {
  const metricIds = { fps: 'metricFps', frameTime: 'metricFrameTime', cpu: 'metricCpu', cpuTemp: 'metricCpuTemp', gpu: 'metricGpu', gpuTemp: 'metricGpuTemp', ram: 'metricRam', vram: 'metricVram' };
  const ids = ['performanceLayout', 'performanceTheme', 'performancePreview', 'performancePreviewLabel', 'performanceOpacity', 'performanceOpacityValue', 'performanceEnabled', 'performanceAnchor', 'performanceGpu', 'performanceUpdateRate', 'performanceFps', 'performanceFrameTime', 'performanceCpu', 'performanceCpuTemp', 'performanceGpuUsage', 'performanceGpuTemp', 'performanceRam', 'performanceVram', 'performanceStatus', 'performanceGpuSource', 'performanceProcess', 'savePerformanceProcess', 'fixFpsPermission', 'performanceMessage', ...Object.values(metricIds)];
  const ui = Object.fromEntries(ids.map(id => [id, document.getElementById(id)]));
  const preview = window.NowLayerPerformanceView.mount(ui.performancePreview);
  let config = {}, latest = null, gpuOptions = '';
  const format = (number, suffix = '', digits = 0) => Number.isFinite(number) ? `${number.toFixed(digits)}${suffix}` : 'n/a';
  function friendlyFpsStatus(status) {
    const value = String(status || 'Waiting for performance data.');
    if (/access denied|administrative privileges|Performance Log Users|stopped/i.test(value)) return 'FPS needs one Windows permission. Select “Fix FPS access” below, approve Windows, then sign out and back in.';
    if (/\.exe$/i.test(value)) return `FPS target: ${value}`;
    return value.split(/\r?\n/)[0].slice(0, 180);
  }

  function renderMetrics(stats) {
    latest = stats;
    const data = stats && Date.now() - stats.sampledAt < 4000 ? stats : {};
    const example = !Number.isFinite(data.cpuUsage);
    preview.configure(config);
    preview.render(example ? { sampledAt: Date.now(), fps: 144, frameTime: 6.9, cpuUsage: 32, cpuTemperature: 58, gpu: { usage: 87, temperature: 67, memoryUsedMb: 4096 }, ramUsedGb: 12.4, ramTotalGb: 32 } : data, example);
    const size = window.NowLayerPerformanceLayout.dimensions(config.layout, config.metrics);
    ui.performancePreviewLabel.textContent = `${example ? 'Example' : 'Live'} preview · ${size.width} × ${size.height} · actual size (scroll if needed)`;
    ui.performanceFps.textContent = format(data.fps);
    ui.performanceFrameTime.textContent = Number.isFinite(data.frameTime) ? format(data.frameTime, ' ms', 1) : 'No frames';
    ui.performanceCpu.textContent = format(data.cpuUsage, '%');
    ui.performanceCpuTemp.textContent = Number.isFinite(data.cpuTemperature) ? format(data.cpuTemperature, ' °C') : 'Temperature unavailable';
    ui.performanceGpuUsage.textContent = format(data.gpu?.usage, '%');
    ui.performanceGpuTemp.textContent = Number.isFinite(data.gpu?.temperature) ? format(data.gpu.temperature, ' °C') : 'Temperature unavailable';
    ui.performanceRam.textContent = `${format(data.ramUsedGb, '', 1)} / ${format(data.ramTotalGb, ' GiB', 1)}`;
    ui.performanceVram.textContent = Number.isFinite(data.gpu?.memoryUsedMb) ? `${format(data.gpu.memoryUsedMb / 1024, '', 1)} / ${format(Number.isFinite(data.gpu.memoryTotalMb) ? data.gpu.memoryTotalMb / 1024 : null, ' GiB VRAM', 1)}` : 'VRAM unavailable';
    ui.performanceStatus.textContent = friendlyFpsStatus(data.fpsStatus);
    ui.performanceGpuSource.textContent = data.gpu ? `${data.gpu.name} · ${data.gpu.source}` : 'GPU unavailable. Check the selected adapter and sensor provider.';
    const choices = [['', 'Automatic'], ...(data.gpus || []).map(gpu => [gpu.id, `${gpu.name} · ${gpu.source}`])];
    if (config.gpuId && !choices.some(([id]) => id === config.gpuId)) choices.push([config.gpuId, 'Selected GPU (unavailable)']);
    const key = JSON.stringify(choices);
    if (gpuOptions !== key) {
      gpuOptions = key;
      ui.performanceGpu.replaceChildren(...choices.map(([id, name]) => {
        const option = document.createElement('option'); option.value = id; option.textContent = name; return option;
      }));
    }
    ui.performanceGpu.value = config.gpuId || '';
  }
  function renderState(state) {
    config = state.settings?.performance || {};
    if (document.activeElement !== ui.performanceOpacity) ui.performanceOpacity.value = String(Math.round((config.opacity ?? .94) * 100));
    ui.performanceOpacityValue.textContent = `${ui.performanceOpacity.value}%`;
    ui.performanceLayout.value = config.layout || 'strip';
    ui.performanceTheme.value = config.theme || 'graphite';
    ui.performanceOpacity.disabled = config.theme === 'minimal';
    ui.performanceOpacity.title = config.theme === 'minimal' ? 'The Minimal HUD has no background.' : '';
    ui.performanceEnabled.checked = config.enabled === true;
    ui.performanceAnchor.value = config.anchor || 'top-left';
    ui.performanceUpdateRate.value = config.updateRate || 'efficient';
    for (const [key, id] of Object.entries(metricIds)) ui[id].checked = config.metrics?.[key] !== false;
    if (document.activeElement !== ui.performanceProcess) ui.performanceProcess.value = config.processName || '';
    if (!state.settings?.visible && config.enabled) ui.performanceMessage.textContent = 'Monitoring paused: show the overlay to resume.';
    else if (ui.performanceMessage.textContent.startsWith('Monitoring paused:')) ui.performanceMessage.textContent = '';
    renderMetrics(state.performance);
  }
  async function update(patch) {
    try {
      const settings = await window.nowLayer.setSetting('performance', patch);
      config = settings.performance;
      ui.performanceMessage.textContent = '';
    } catch (error) { ui.performanceMessage.textContent = error.message; }
  }
  ui.performanceLayout.addEventListener('change', () => update({ layout: ui.performanceLayout.value }));
  ui.performanceTheme.addEventListener('change', () => update({ theme: ui.performanceTheme.value }));
  ui.performanceOpacity.addEventListener('input', () => { ui.performanceOpacityValue.textContent = `${ui.performanceOpacity.value}%`; });
  ui.performanceOpacity.addEventListener('change', () => update({ opacity: Number(ui.performanceOpacity.value) / 100 }));
  ui.performanceEnabled.addEventListener('change', () => update({ enabled: ui.performanceEnabled.checked }));
  ui.performanceAnchor.addEventListener('change', () => update({ anchor: ui.performanceAnchor.value }));
  ui.performanceGpu.addEventListener('change', () => update({ gpuId: ui.performanceGpu.value }));
  ui.performanceUpdateRate.addEventListener('change', () => update({ updateRate: ui.performanceUpdateRate.value }));
  for (const [key, id] of Object.entries(metricIds)) ui[id].addEventListener('change', () => {
    const metrics = { ...(config.metrics || {}), [key]: ui[id].checked };
    if (!Object.values(metrics).some(Boolean)) {
      ui[id].checked = true;
      ui.performanceMessage.textContent = 'Keep at least one reading visible.';
      return;
    }
    update({ metrics });
  });
  ui.savePerformanceProcess.addEventListener('click', () => {
    const name = ui.performanceProcess.value.trim();
    if (name && (!/^[^\\/:*?"<>|\x00-\x1f]+\.exe$/i.test(name) || name.startsWith('-'))) {
      ui.performanceMessage.textContent = 'Enter an executable name such as game.exe, without a folder path.'; return;
    }
    update({ processName: name });
  });
  ui.fixFpsPermission.addEventListener('click', async () => {
    ui.fixFpsPermission.disabled = true;
    ui.performanceMessage.textContent = 'Waiting for Windows administrator approval…';
    try {
      await window.nowLayer.requestFpsPermission();
      ui.performanceMessage.textContent = 'FPS access was enabled. Sign out of Windows and back in, then turn Performance off and on.';
    } catch (error) {
      ui.performanceMessage.textContent = error.message || 'Windows could not enable FPS access. Try again with an administrator account.';
    } finally {
      ui.fixFpsPermission.disabled = false;
    }
  });
  window.nowLayer.onState(renderState);
  window.nowLayer.onPerformance(renderMetrics);
  window.nowLayer.getState().then(renderState).catch(console.error);
  setInterval(() => { if (latest && Date.now() - latest.sampledAt >= 4000) renderMetrics(latest); }, 1000);
})();
