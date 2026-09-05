const os = require('node:os');
const { EventEmitter } = require('node:events');
const { execFile, spawn } = require('node:child_process');
const readline = require('node:readline');
const { normalizePerformance } = require('./performance-settings');

function numberOrNull(value, max = Infinity) {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number <= max ? number : null;
}

function cpuTotals(cpus) {
  return cpus.reduce((sum, cpu) => ({
    idle: sum.idle + cpu.times.idle,
    total: sum.total + Object.values(cpu.times).reduce((a, b) => a + b, 0),
  }), { idle: 0, total: 0 });
}

function cpuUsage(previous, current) {
  const total = current.total - previous.total;
  const idle = current.idle - previous.idle;
  return total > 0 && idle >= 0 && idle <= total ? 100 * (1 - idle / total) : null;
}

function parseCsv(line) {
  const fields = [];
  let value = '', quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') { value += '"'; i += 1; }
      else quoted = !quoted;
    } else if (char === ',' && !quoted) { fields.push(value.trim()); value = ''; }
    else value += char;
  }
  fields.push(value.trim());
  return fields;
}

function parseNvidia(stdout) {
  return stdout.trim().split(/\r?\n/).filter(Boolean).flatMap((line) => {
    const [uuid, name, usage, temperature, used, total] = parseCsv(line);
    if (!uuid?.startsWith('GPU-') || !name) return [];
    return [{ id: uuid, name, usage: numberOrNull(usage, 100), temperature: numberOrNull(temperature, 150),
      memoryUsedMb: numberOrNull(used), memoryTotalMb: numberOrNull(total), source: 'NVIDIA' }];
  });
}

function parseSensors(data = {}) {
  const sensors = Array.isArray(data.sensors) ? data.sensors : [];
  const hardware = Array.isArray(data.hardware) ? data.hardware : [];
  const temperatures = sensors.filter(s => s.SensorType === 'Temperature' && /\/(?:intelcpu|amdcpu)\//i.test(s.Parent || ''));
  const packages = temperatures.filter(s => /package|tctl|tdie/i.test(s.Name || ''));
  const values = (packages.length ? packages : temperatures).map(s => numberOrNull(s.Value, 150)).filter(v => v !== null);
  const gpus = hardware.filter(h => /^Gpu/i.test(h.HardwareType || '')).map(h => {
    const own = sensors.filter(s => s.Parent === h.Identifier);
    const find = (type, names, max) => numberOrNull(own.find(s => s.SensorType === type && names.test(s.Name || ''))?.Value, max);
    return { id: h.Identifier, name: h.Name, source: 'Libre Hardware Monitor',
      usage: find('Load', /^GPU Core$|^D3D 3D$/, 100), temperature: find('Temperature', /^GPU Core$|^GPU Temperature$/, 150),
      memoryUsedMb: find('SmallData', /^GPU Memory Used$|^D3D Dedicated Memory Used$/),
      memoryTotalMb: find('SmallData', /^GPU Memory Total$/) };
  });
  return { cpuTemperature: values.length ? Math.max(...values) : null, gpus };
}

// Keep each swap chain separate: summing them would inflate a game's FPS.
class FrameAccumulator {
  constructor(processName = '') { this.header = []; this.chains = new Map(); this.setTarget(processName); }
  setTarget(name = '', pid = null) {
    name = name.toLowerCase();
    if (this.processName !== name || this.processId !== pid) this.chains.clear();
    this.processName = name; this.processId = pid;
  }
  add(line) {
    const fields = parseCsv(line.replace(/^\uFEFF/, ''));
    if (fields.includes('Application') && fields.includes('MsBetweenPresents')) { this.header = fields; return; }
    if (!this.header.length) return;
    const get = key => fields[this.header.indexOf(key)];
    if (!this.processName || get('Application')?.toLowerCase() !== this.processName) return;
    if (this.processId !== null && Number(get('ProcessID')) !== this.processId) return;
    const interval = numberOrNull(get('MsBetweenPresents'), 60_000);
    if (!interval) return;
    const key = `${get('ProcessID')}:${get('SwapChainAddress')}`;
    if (!this.chains.has(key) && this.chains.size >= 64) return;
    const chain = this.chains.get(key) || { count: 0, duration: 0 };
    chain.count += 1;
    chain.duration += interval;
    this.chains.set(key, chain);
  }
  sample() {
    const busiest = [...this.chains.values()].sort((a, b) => b.count - a.count)[0];
    this.chains.clear();
    return busiest ? { fps: 1000 * busiest.count / busiest.duration, frameTime: busiest.duration / busiest.count } : { fps: null, frameTime: null };
  }
}

class PerformanceMonitor extends EventEmitter {
  constructor({ sensorScript, presentMonPath = '', platform = process.platform, spawnProcess = spawn, execute = execFile, system = os }) {
    super();
    Object.assign(this, { sensorScript, presentMonPath, platform, spawnProcess, execute, system });
    this.settings = normalizePerformance();
    this.timer = null;
    this.sensorChild = null;
    this.presentChild = null;
    this.nvidiaChild = null;
    this.generation = 0;
    this.lastState = this.emptyState();
  }
  emptyState() {
    return { cpuUsage: null, cpuTemperature: null, ramUsedGb: null, ramTotalGb: null, gpus: [], gpu: null,
      fps: null, frameTime: null, fpsStatus: 'Enable performance monitoring to start.', sampledAt: Date.now() };
  }
  configure(settings) {
    const next = normalizePerformance(settings);
    const restart = !this.timer || next.processName !== this.settings.processName;
    this.settings = next;
    if (!next.enabled) { if (this.timer) this.stop(); return; }
    if (!restart) return;
    this.stop();
    this.previousCpu = cpuTotals(this.system.cpus());
    this.sensors = { cpuTemperature: null, gpus: [] };
    this.nvidia = [];
    this.sensorAt = 0;
    this.nvidiaAt = 0;
    this.nextSensorAttempt = 0;
    this.nextNvidiaAttempt = 0;
    this.frames = new FrameAccumulator(next.processName);
    this.fpsStatus = this.platform !== 'win32' ? 'Game FPS requires Windows.'
      : !this.presentMonPath ? 'Bundled FPS helper is missing. Reinstall NowLayer.'
        : next.processName ? 'Waiting for game frames.' : 'Switch to your game to show FPS.';
    if (this.platform === 'win32' && this.presentMonPath) this.startPresentMon();
    this.timer = setInterval(() => this.tick(), 1000);
    this.tick();
  }
  startPresentMon() {
    this.presentSession = { executable: this.presentMonPath, name: `NowLayer-${process.pid}-${this.generation}` };
    const child = this.spawnProcess(this.presentMonPath, [
      ...(this.settings.processName ? ['--process_name', this.settings.processName] : ['--exclude', 'NowLayer.exe', '--exclude', 'electron.exe']), '--output_stdout', '--no_console_stats', '--v1_metrics',
      '--session_name', this.presentSession.name,
    ], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    this.presentChild = child;
    const lines = readline.createInterface({ input: child.stdout });
    lines.on('line', line => { if (this.presentChild === child) this.frames.add(line); });
    let detail = '';
    child.stderr.on('data', buffer => { detail = (detail + buffer.toString()).slice(-512); });
    child.on('error', error => { if (this.presentChild === child) this.fpsStatus = `FPS capture could not start: ${error.message}`; });
    child.on('close', code => {
      lines.close();
      if (this.presentChild !== child) return;
      this.presentChild = null;
      this.frames.chains.clear();
      this.fpsStatus = `FPS capture stopped (${code ?? 'launch error'}). Check Windows Performance Log Users permissions; toggle monitoring to retry.${detail ? ` ${detail.trim()}` : ''}`;
    });
  }
  startSensors(now) {
    this.nextSensorAttempt = now + 15_000;
    const child = this.spawnProcess('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', this.sensorScript],
      { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    this.sensorChild = child;
    this.sensorStartedAt = now;
    const lines = readline.createInterface({ input: child.stdout });
    lines.on('line', line => {
      if (this.sensorChild !== child) return;
      try {
        const data = JSON.parse(line);
        this.sensors = parseSensors(data); this.sensorAt = Date.now();
        if (!this.settings.processName) this.updateForeground(data);
      } catch { /* Ignore non-JSON diagnostics. */ }
    });
    child.stderr.on('data', () => {});
    child.on('error', () => {});
    child.on('close', () => {
      lines.close();
      if (this.sensorChild === child) { this.sensorChild = null; this.sensorAt = 0; }
    });
  }
  updateForeground(data) {
    const name = String(data.foregroundProcessName || '');
    if (/^(NowLayer|electron)\.exe$/i.test(name)) return;
    const pid = Number(data.foregroundProcessId);
    const valid = Number.isSafeInteger(pid) && pid > 0 && name && !/^(explorer|dwm|ShellExperienceHost|StartMenuExperienceHost)\.exe$/i.test(name);
    this.frames.setTarget(valid ? name : '', valid ? pid : null);
  }
  pollNvidia(now) {
    this.nextNvidiaAttempt = now + 2000;
    const generation = this.generation;
    this.nvidiaChild = this.execute('nvidia-smi.exe', [
      '--query-gpu=uuid,name,utilization.gpu,temperature.gpu,memory.used,memory.total', '--format=csv,noheader,nounits',
    ], { windowsHide: true, timeout: 1500, maxBuffer: 64 * 1024, encoding: 'utf8' }, (error, stdout) => {
      if (generation !== this.generation) return;
      this.nvidiaChild = null;
      this.nvidia = error ? [] : parseNvidia(stdout);
      this.nvidiaAt = Date.now();
      if (error) this.nextNvidiaAttempt = Date.now() + 30_000;
    });
  }
  tick() {
    const now = Date.now();
    if (this.platform === 'win32') {
      if (this.sensorChild && now - Math.max(this.sensorAt, this.sensorStartedAt) > 10_000) {
        const child = this.sensorChild; this.sensorChild = null; child.kill();
      }
      if (!this.sensorChild && now >= this.nextSensorAttempt) this.startSensors(now);
      if (!this.nvidiaChild && now >= this.nextNvidiaAttempt) this.pollNvidia(now);
    }
    const cpu = cpuTotals(this.system.cpus());
    const sensors = now - this.sensorAt < 6000 ? this.sensors : { cpuTemperature: null, gpus: [] };
    const nvidia = now - this.nvidiaAt < 6000 ? this.nvidia : [];
    // Prefer NVML for NVIDIA cards; preserve LHM's AMD/Intel cards and stable IDs.
    const gpus = [...nvidia, ...sensors.gpus.filter(gpu => !nvidia.length || !/nvidia/i.test(gpu.id) || gpu.id === this.settings.gpuId)];
    const gpu = (this.settings.gpuId ? gpus.find(item => item.id === this.settings.gpuId) : gpus[0]) || null;
    if (!this.settings.processName && now - this.sensorAt >= 6000) this.frames.setTarget('');
    const frames = this.frames.sample();
    const total = this.system.totalmem();
    this.lastState = {
      cpuUsage: cpuUsage(this.previousCpu, cpu), cpuTemperature: sensors.cpuTemperature,
      ramUsedGb: (total - this.system.freemem()) / 1024 ** 3, ramTotalGb: total / 1024 ** 3,
      gpus, gpu, ...frames, fpsStatus: frames.fps !== null ? this.frames.processName : this.fpsStatus, sampledAt: now,
    };
    this.previousCpu = cpu;
    this.emit('state', this.lastState);
  }
  stop() {
    this.generation += 1;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    for (const key of ['sensorChild', 'presentChild', 'nvidiaChild']) {
      const child = this[key]; this[key] = null; child?.kill();
    }
    // Terminating a Windows process does not necessarily stop its ETW session.
    // Clean up only our uniquely named session; never stop another capture.
    if (this.presentSession) {
      const { executable, name } = this.presentSession;
      this.presentSession = null;
      this.execute(executable, ['--session_name', name, '--terminate_existing_session'],
        { windowsHide: true, timeout: 2000, maxBuffer: 16 * 1024 }, () => {});
    }
    this.lastState = this.emptyState();
    this.emit('state', this.lastState);
  }
}

module.exports = { PerformanceMonitor, FrameAccumulator, cpuTotals, cpuUsage, parseCsv, parseNvidia, parseSensors, numberOrNull };
