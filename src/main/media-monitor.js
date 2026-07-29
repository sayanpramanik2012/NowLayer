const { EventEmitter } = require('node:events');
const { execFile, spawn } = require('node:child_process');
const readline = require('node:readline');

const ALLOWED_ACTIONS = new Set(['play-pause', 'next', 'previous']);

class MediaMonitor extends EventEmitter {
  constructor({ monitorScript, actionScript }) {
    super();
    this.monitorScript = monitorScript;
    this.actionScript = actionScript;
    this.child = null;
    this.intentionalStop = false;
    this.restartTimer = null;
    this.restartAttempts = 0;
    this.lastState = {
      available: false,
      title: '',
      artist: '',
      albumTitle: '',
      source: '',
      status: 'Closed',
      position: 0,
      duration: 0,
      sampledAt: Date.now(),
      artwork: '',
      controls: { previous: false, playPause: false, next: false },
    };
  }

  start() {
    if (this.child) return;
    this.intentionalStop = false;

    const child = spawn(
      'powershell.exe',
      [
        '-NoLogo',
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        this.monitorScript,
      ],
      { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] },
    );
    this.child = child;

    const lines = readline.createInterface({ input: child.stdout });
    lines.on('line', (line) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      try {
        this.lastState = normalizeMediaState(JSON.parse(trimmed));
        this.restartAttempts = 0;
        this.emit('state', this.lastState);
      } catch (error) {
        this.emit('diagnostic', `Ignored malformed media update: ${error.message}`);
      }
    });

    child.stderr.on('data', (buffer) => {
      const message = buffer.toString('utf8').trim();
      if (message) this.emit('diagnostic', message);
    });

    child.on('error', (error) => {
      this.emit('diagnostic', `Media monitor failed to start: ${error.message}`);
    });

    child.on('exit', (code) => {
      if (this.child === child) this.child = null;
      lines.close();
      if (!this.intentionalStop) {
        this.emit('diagnostic', `Media monitor exited with code ${code}; restarting.`);
        this.scheduleRestart();
      }
    });
  }

  scheduleRestart() {
    if (this.restartTimer || this.intentionalStop) return;
    const delay = Math.min(15000, 1000 * 2 ** this.restartAttempts);
    this.restartAttempts += 1;
    this.restartTimer = setTimeout(() => {
      this.restartTimer = null;
      this.start();
    }, delay);
  }

  stop() {
    this.intentionalStop = true;
    if (this.restartTimer) clearTimeout(this.restartTimer);
    this.restartTimer = null;
    if (this.child) {
      this.child.kill();
      this.child = null;
    }
  }

  performAction(action) {
    if (!ALLOWED_ACTIONS.has(action)) {
      return Promise.reject(new Error('Unsupported media action.'));
    }

    return new Promise((resolve, reject) => {
      execFile(
        'powershell.exe',
        [
          '-NoLogo',
          '-NoProfile',
          '-NonInteractive',
          '-ExecutionPolicy',
          'Bypass',
          '-File',
          this.actionScript,
          '-Action',
          action,
        ],
        { windowsHide: true, timeout: 5000, encoding: 'utf8' },
        (error, stdout, stderr) => {
          if (error) {
            reject(new Error(stderr.trim() || error.message));
            return;
          }
          try {
            resolve(JSON.parse(stdout.trim() || '{"success":true}'));
          } catch {
            resolve({ success: true });
          }
        },
      );
    });
  }
}

function normalizeMediaState(state = {}) {
  const duration = Math.max(0, Number(state.duration) || 0);
  const position = Math.min(duration || Infinity, Math.max(0, Number(state.position) || 0));
  const now = Date.now();
  const candidateSampledAt = Number(state.sampledAt);
  const sampledAt = Number.isFinite(candidateSampledAt)
    && candidateSampledAt > 0
    && candidateSampledAt <= now + 300_000
    ? candidateSampledAt
    : now;
  return {
    available: state.available === true,
    title: limitedString(state.title, 512),
    artist: limitedString(state.artist, 512),
    albumTitle: limitedString(state.albumTitle, 512),
    source: limitedString(state.source, 512),
    status: limitedString(state.status ?? 'Closed', 64),
    position,
    duration,
    sampledAt,
    artwork: typeof state.artwork === 'string' && state.artwork.length <= 3_000_000
      ? state.artwork
      : '',
    controls: {
      previous: state.controls?.previous === true,
      playPause: state.controls?.playPause === true,
      next: state.controls?.next === true,
    },
    error: limitedString(state.error, 1024),
  };
}

function limitedString(value, maximumLength) {
  return String(value ?? '').slice(0, maximumLength);
}

module.exports = { MediaMonitor, normalizeMediaState };
