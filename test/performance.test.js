const assert = require('node:assert/strict');
const test = require('node:test');
const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');
const { normalizePerformance } = require('../src/main/performance-settings');
const { sanitizeSettings } = require('../src/main/config');
const { PerformanceMonitor, FrameAccumulator, cpuTotals, cpuUsage, parseCsv, parseNvidia, parseSensors } = require('../src/main/performance-monitor');
const { dimensions } = require('../src/shared/performance-layout');
const { PerformanceWindow } = require('../src/main/performance-window');

test('performance preferences survive old settings and reject invalid executable inputs', () => {
  assert.equal(sanitizeSettings({}).performance.enabled, false);
  assert.equal(sanitizeSettings({ performance: { enabled: true } }).performance.layout, 'strip');
  assert.equal(normalizePerformance({ layout: 'invalid', theme: 'invalid' }).theme, 'graphite');
  assert.equal(normalizePerformance({ layout: '__proto__' }).layout, 'strip');
  assert.equal(normalizePerformance({ layout: 'compact', theme: 'minimal' }).layout, 'compact');
  assert.equal(normalizePerformance(null).enabled, false);
  const settings = normalizePerformance({ enabled: true, presentMonPath: 'C:\\Tools\\PresentMon.exe', processName: 'My Game.exe', opacity: 0, x: 120.6 });
  assert.equal(settings.presentMonPath, undefined);
  assert.equal(settings.processName, 'My Game.exe');
  assert.equal(settings.opacity, .3);
  assert.equal(settings.x, 121);
  for (const invalid of ['game', '--help.exe', 'C:\\Game\\game.exe', 'game.exe\n--help', 'x/../game.exe']) {
    assert.equal(normalizePerformance({ processName: invalid }).processName, '');
  }
  assert.equal(normalizePerformance({ presentMonPath: 'cmd.exe' }).presentMonPath, undefined);
});

test('CPU usage uses system-wide time deltas and handles zero/reset intervals', () => {
  const first = cpuTotals([{ times: { user: 20, sys: 10, idle: 70 } }, { times: { user: 10, sys: 10, idle: 80 } }]);
  assert.deepEqual(first, { total: 200, idle: 150 });
  assert.equal(cpuUsage(first, { total: 400, idle: 200 }), 75);
  assert.equal(cpuUsage(first, first), null);
  assert.equal(cpuUsage(first, { total: 100, idle: 50 }), null);
});

test('NVIDIA CSV preserves device identity, zero readings, and unsupported fields', () => {
  assert.deepEqual(parseCsv('"My, GPU", "quoted ""name""", 0'), ['My, GPU', 'quoted "name"', '0']);
  const gpus = parseNvidia('GPU-abc, NVIDIA RTX, 0, 45, 2048, 8192\nGPU-def, NVIDIA Other, [N/A], [Not Supported], N/A, 4096');
  assert.equal(gpus[0].usage, 0);
  assert.equal(gpus[0].memoryUsedMb, 2048);
  assert.equal(gpus[1].usage, null);
  assert.equal(gpus[1].temperature, null);
  assert.deepEqual(parseNvidia('NVIDIA-SMI failed'), []);
});

test('hardware sensors stay attached to their own GPU and prefer CPU package temperature', () => {
  const data = parseSensors({ hardware: [{ Identifier: '/gpu-amd/0', Name: 'AMD card', HardwareType: 'GpuAmd' }], sensors: [
    { Parent: '/amdcpu/0', Name: 'Core #1', SensorType: 'Temperature', Value: 80 },
    { Parent: '/amdcpu/0', Name: 'Core (Tctl/Tdie)', SensorType: 'Temperature', Value: 65 },
    { Parent: '/gpu-amd/0', Name: 'GPU Core', SensorType: 'Load', Value: 99 },
    { Parent: '/gpu-amd/1', Name: 'GPU Core', SensorType: 'Temperature', Value: 90 },
  ] });
  assert.equal(data.cpuTemperature, 65);
  assert.equal(data.gpus[0].usage, 99);
  assert.equal(data.gpus[0].temperature, null);
  assert.deepEqual(parseSensors(), { cpuTemperature: null, gpus: [] });
});

test('FPS filters the selected game, separates swap chains, and expires missing frames', () => {
  const frames = new FrameAccumulator('my game.exe');
  frames.add('Application,ProcessID,SwapChainAddress,MsBetweenPresents');
  frames.add('other.exe,1,0x1,1');
  frames.add('my game.exe,2,0x1,10');
  frames.add('my game.exe,2,0x1,30');
  frames.add('my game.exe,2,0x2,1');
  frames.add('my game.exe,2,0x1,NA');
  frames.add('my game.exe,2,0x1,0');
  assert.deepEqual(frames.sample(), { fps: 50, frameTime: 20 });
  assert.deepEqual(frames.sample(), { fps: null, frameTime: null });
});

function fakeChild() {
  const child = new EventEmitter();
  child.stdout = new PassThrough(); child.stderr = new PassThrough(); child.killed = false;
  child.kill = () => { child.killed = true; child.emit('close', 0); };
  return child;
}

test('monitor does not spawn when disabled, cleans owned processes, and rejects late results', () => {
  const children = [], executions = [];
  const monitor = new PerformanceMonitor({ sensorScript: 'sensors.ps1', presentMonPath: 'C:\\Bundled\\PresentMon.exe', platform: 'win32',
    spawnProcess: (file, args) => { const child = fakeChild(); children.push({ file, args, child }); return child; },
    execute: (file, args, options, callback) => { const child = fakeChild(); executions.push({ file, args, options, callback, child }); return child; },
  });
  monitor.configure({ enabled: false });
  assert.equal(children.length, 0);
  monitor.configure({ enabled: true, presentMonPath: 'C:\\Tools\\PresentMon.exe', processName: 'game.exe' });
  assert.equal(children.length, 2);
  const originalChildren = children.length;
  monitor.configure({ ...monitor.settings, opacity: .5, x: 200, layout: 'compact', theme: 'midnight' });
  assert.equal(children.length, originalChildren, 'presentation changes must not restart collection');
  const query = executions.find(call => call.file === 'nvidia-smi.exe');
  monitor.stop();
  assert.ok(children.every(({ child }) => child.killed));
  assert.equal(query.child.killed, true);
  query.callback(null, 'GPU-late, NVIDIA, 90, 60, 10, 100');
  assert.equal(monitor.lastState.gpu, null);
  const cleanup = executions.find(call => call.args.includes('--terminate_existing_session'));
  assert.ok(cleanup.args.includes(children[0].args.at(-1)));
  assert.equal(monitor.timer, null);
});

test('stale providers and missing selected adapters cannot display another GPU or old values', () => {
  const monitor = new PerformanceMonitor({ sensorScript: '', platform: 'linux' });
  monitor.configure({ enabled: true, gpuId: 'missing' });
  monitor.nvidia = [{ id: 'GPU-other', usage: 70 }]; monitor.nvidiaAt = Date.now();
  monitor.sensors = { cpuTemperature: 90, gpus: [] }; monitor.sensorAt = Date.now() - 10_000;
  monitor.tick();
  assert.equal(monitor.lastState.gpu, null);
  assert.equal(monitor.lastState.cpuTemperature, null);
  monitor.stop();
});

test('performance window stays click-through, respects visibility and retains dragged placement', () => {
  class Window extends EventEmitter {
    constructor(options) { super(); this.options = options; this.webContents = { isDestroyed: () => false, send() {}, setWindowOpenHandler() {} }; }
    isDestroyed() { return false; } loadFile() {} setBounds(bounds) { this.bounds = bounds; }
    setAlwaysOnTop() {} setIgnoreMouseEvents(value) { this.ignored = value; }
    setFocusable(value) { this.focusable = value; } showInactive() { this.visible = true; }
    hide() { this.visible = false; } destroy() {} getPosition() { return [450, 100]; }
  }
  const manager = new PerformanceWindow({ app: {}, BrowserWindow: Window, screen: { getDisplayNearestPoint: () => ({ workArea: { x: 0, y: 0, width: 1920, height: 1080 } }) } });
  const settings = sanitizeSettings({ performance: { enabled: true } });
  manager.apply(settings);
  assert.equal(manager.window.bounds.height, 34);
  assert.equal(manager.window.bounds.width, 560);
  manager.apply({ ...settings, performance: { ...settings.performance, layout: 'compact', anchor: 'bottom-right' } });
  assert.equal(manager.window.bounds.height, 64);
  assert.equal(manager.window.bounds.y, 1080 - 24 - 64);
  assert.deepEqual(dimensions('detailed'), { width: 300, height: 140 });
  assert.equal(manager.window.ignored, true);
  assert.equal(manager.window.focusable, false);
  assert.equal(manager.window.visible, true);
  manager.apply({ ...settings, visible: false });
  assert.equal(manager.window.visible, false);
  manager.apply({ ...settings, locked: false });
  assert.equal(manager.window.ignored, false);
  manager.positioning = false;
  let position;
  manager.on('position', value => { position = value; });
  manager.window.emit('moved');
  assert.deepEqual(position, { anchor: 'manual', x: 450, y: 100 });
  manager.dispose();
});

test('Windows sensor helper parses under Windows PowerShell', { skip: process.platform !== 'win32' }, () => {
  const { execFileSync } = require('node:child_process');
  const path = require('node:path');
  const script = path.resolve(__dirname, '../scripts/performance-sensors.ps1').replace(/'/g, "''");
  execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `$tokens=$null; $errors=$null; [System.Management.Automation.Language.Parser]::ParseFile('${script}', [ref]$tokens, [ref]$errors) | Out-Null; if ($errors.Count) { $errors | Out-String | Write-Error; exit 1 }`], { timeout: 10000 });
});

test('automatic FPS changes PID atomically and never merges same-named processes', () => {
  const frames = new FrameAccumulator();
  frames.add('Application,ProcessID,SwapChainAddress,MsBetweenPresents');
  frames.add('game.exe,10,a,10');
  assert.equal(frames.sample().fps, null);
  frames.setTarget('game.exe', 10);
  frames.add('game.exe,10,a,10');
  frames.setTarget('game.exe', 11);
  frames.add('game.exe,10,a,10');
  frames.add('game.exe,11,a,20');
  assert.equal(frames.sample().fps, 50);
  frames.setTarget('');
  frames.add('game.exe,11,a,20');
  assert.equal(frames.sample().fps, null);
});

test('foreground capture keeps game while Control Center is focused and clears desktop/stale targets', () => {
  const monitor = new PerformanceMonitor({ sensorScript: '', platform: 'linux' });
  monitor.configure({ enabled: true });
  try {
    monitor.updateForeground({ foregroundProcessId: 12, foregroundProcessName: 'Game.exe' });
    monitor.updateForeground({ foregroundProcessId: 13, foregroundProcessName: 'NowLayer.exe' });
    assert.equal(monitor.frames.processId, 12);
    monitor.updateForeground({ foregroundProcessId: 14, foregroundProcessName: 'explorer.exe' });
    assert.equal(monitor.frames.processName, '');
    monitor.updateForeground({ foregroundProcessId: 12, foregroundProcessName: 'Game.exe' });
    monitor.sensorAt = Date.now() - 7000;
    monitor.tick();
    assert.equal(monitor.frames.processName, '');
  } finally { monitor.stop(); }
});

test('Windows build includes the pinned standalone FPS helper and license', { skip: process.platform !== 'win32' }, () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const { execFileSync } = require('node:child_process');
  const { SHA256, destination, digest } = require('../scripts/prepare-presentmon');
  assert.equal(digest(fs.readFileSync(destination)), SHA256);
  assert.match(fs.readFileSync(path.join(path.dirname(destination), 'LICENSE.txt'), 'utf8'), /Permission is hereby granted/);
  const help = execFileSync(destination, ['--help'], { encoding: 'utf8', timeout: 10000 });
  assert.match(help, /v1_metrics/);
  assert.match(help, /process_name/);
});
