const elements = Object.fromEntries(['widget', 'liveStatus', 'fps', 'frameTime', 'cpu', 'cpuTemp', 'gpu', 'gpuTemp', 'ram', 'vram', 'source'].map(id => [id, document.getElementById(id)]));
const value = (number, suffix = '', digits = 0) => Number.isFinite(number) ? `${number.toFixed(digits)}${suffix}` : '—';
let latest = null;

function render(data) {
  latest = data;
  const fresh = data && Date.now() - data.sampledAt < 4000;
  const stats = fresh ? data : {};
  elements.liveStatus.textContent = fresh && Number.isFinite(stats.cpuUsage) ? 'LIVE' : 'WAITING';
  elements.fps.textContent = value(stats.fps);
  elements.frameTime.textContent = Number.isFinite(stats.frameTime) ? value(stats.frameTime, ' ms', 1) : 'No frames';
  elements.cpu.textContent = value(stats.cpuUsage, '%');
  elements.cpuTemp.textContent = Number.isFinite(stats.cpuTemperature) ? value(stats.cpuTemperature, ' °C') : 'Temp unavailable';
  elements.gpu.textContent = value(stats.gpu?.usage, '%');
  elements.gpuTemp.textContent = Number.isFinite(stats.gpu?.temperature) ? value(stats.gpu.temperature, ' °C') : 'Temp unavailable';
  elements.ram.textContent = value(stats.ramUsedGb, '', 1);
  elements.ram.title = `${value(stats.ramUsedGb, ' GiB', 1)} / ${value(stats.ramTotalGb, ' GiB', 1)}`;
  elements.vram.textContent = Number.isFinite(stats.gpu?.memoryUsedMb) ? `${value(stats.gpu.memoryUsedMb / 1024, 'G', 1)} VRAM` : 'GiB · VRAM unavailable';
  elements.source.textContent = stats.fpsStatus || 'Waiting for performance data';
  elements.source.title = [stats.fpsStatus, stats.gpu?.name].filter(Boolean).join(' · ');
}
function settings(state) {
  elements.widget.classList.toggle('is-locked', state.settings?.locked !== false);
  document.documentElement.style.setProperty('--opacity', String(state.settings?.performance?.opacity ?? .94));
}
window.nowLayer.onPerformance(render);
window.nowLayer.onState(settings);
window.nowLayer.getState().then(state => { settings(state); render(state.performance); }).catch(console.error);
setInterval(() => { if (latest && Date.now() - latest.sampledAt >= 4000) render(latest); }, 1000);
