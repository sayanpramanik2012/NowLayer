const { EventEmitter } = require('node:events');

const MAX_TIMER_SECONDS = 24 * 60 * 60;

function clampNumber(value, minimum, maximum, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.round(numeric)));
}

function normalizeClockTime(value) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(value))) return '07:00';
  return String(value);
}

function normalizeSoundPath(value) {
  const path = String(value || '').trim();
  return path.length > 0 && path.length <= 1024 ? path : '';
}

function normalizeUtilities(candidate = {}) {
  const timer = candidate.timer || {};
  const alarm = candidate.alarm || {};
  return {
    showClock: candidate.showClock === true,
    displayMode: candidate.displayMode === 'separate' ? 'separate' : 'embedded',
    timer: {
      active: timer.active === true && Number.isFinite(timer.endAt) && timer.endAt > 0,
      endAt: Number.isFinite(timer.endAt) ? Math.round(timer.endAt) : 0,
      pausedRemaining: clampNumber(timer.pausedRemaining, 0, MAX_TIMER_SECONDS, 0),
      soundEnabled: timer.soundEnabled === true,
      soundPath: normalizeSoundPath(timer.soundPath),
    },
    alarm: {
      enabled: alarm.enabled === true,
      time: normalizeClockTime(alarm.time),
      soundEnabled: alarm.soundEnabled === true,
      soundPath: normalizeSoundPath(alarm.soundPath),
      lastFiredMinute: String(alarm.lastFiredMinute || '').slice(0, 32),
    },
    alert: null,
  };
}

function getTimerRemaining(timer, now = Date.now()) {
  if (timer.active && timer.endAt > now) return Math.ceil((timer.endAt - now) / 1000);
  return clampNumber(timer.pausedRemaining, 0, MAX_TIMER_SECONDS, 0);
}

function minuteKey(date) {
  return [date.getFullYear(), date.getMonth() + 1, date.getDate(), date.getHours(), date.getMinutes()]
    .map((value, index) => (index < 3 ? String(value).padStart(index === 0 ? 4 : 2, '0') : String(value).padStart(2, '0')))
    .join('-');
}

class Timekeeper extends EventEmitter {
  constructor(initialState, { now = () => Date.now() } = {}) {
    super();
    this.now = now;
    this.state = normalizeUtilities(initialState);
    // A countdown is an in-the-moment reminder. Never revive one from a prior
    // process, otherwise an expired saved timer can look like a false alert at launch.
    this.state.timer.active = false;
    this.state.timer.endAt = 0;
    this.state.timer.pausedRemaining = 0;
    this.timerStartedThisSession = false;
    this.interval = null;
  }

  start() {
    if (!this.interval) this.interval = setInterval(() => this.tick(), 250);
  }

  stop() {
    if (this.interval) clearInterval(this.interval);
    this.interval = null;
  }

  getState() {
    return { ...this.state, timer: { ...this.state.timer }, alarm: { ...this.state.alarm } };
  }

  update(patch) {
    this.state = normalizeUtilities({ ...this.state, ...patch, timer: { ...this.state.timer, ...patch.timer }, alarm: { ...this.state.alarm, ...patch.alarm } });
    this.emit('change', this.getState());
    return this.getState();
  }

  startTimer(seconds) {
    const duration = clampNumber(seconds, 1, MAX_TIMER_SECONDS, 60);
    this.timerStartedThisSession = true;
    return this.update({ timer: { active: true, endAt: this.now() + duration * 1000, pausedRemaining: duration } });
  }

  pauseTimer() {
    const remaining = getTimerRemaining(this.state.timer, this.now());
    return this.update({ timer: { active: false, endAt: 0, pausedRemaining: remaining } });
  }

  resetTimer() {
    this.timerStartedThisSession = false;
    return this.update({ timer: { active: false, endAt: 0, pausedRemaining: 0 } });
  }

  dismissAlert() {
    this.state.alert = null;
    this.emit('change', this.getState());
    return this.getState();
  }

  tick() {
    const now = this.now();
    if (this.timerStartedThisSession && this.state.timer.active && this.state.timer.endAt > 0 && this.state.timer.endAt <= now) {
      const timer = { ...this.state.timer, active: false, endAt: 0, pausedRemaining: 0 };
      this.state = { ...this.state, timer, alert: { kind: 'timer', raisedAt: now, soundEnabled: timer.soundEnabled, soundPath: timer.soundPath } };
      this.emit('change', this.getState());
    }
    const date = new Date(now);
    const localTime = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    const key = minuteKey(date);
    if (this.state.alarm.enabled && this.state.alarm.time === localTime && this.state.alarm.lastFiredMinute !== key) {
      const alarm = { ...this.state.alarm, lastFiredMinute: key };
      this.state = { ...this.state, alarm, alert: { kind: 'alarm', raisedAt: now, soundEnabled: alarm.soundEnabled, soundPath: alarm.soundPath } };
      this.emit('change', this.getState());
    }
  }
}

module.exports = { MAX_TIMER_SECONDS, Timekeeper, getTimerRemaining, normalizeClockTime, normalizeUtilities };
