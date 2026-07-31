const assert = require('node:assert/strict');
const test = require('node:test');
const { Timekeeper, getTimerRemaining, normalizeClockTime, normalizeUtilities } = require('../src/main/timekeeper');

test('utility preferences reject malformed alarm values and unsafe timer values', () => {
  const utilities = normalizeUtilities({
    showClock: true,
    timer: { active: true, endAt: 0, pausedRemaining: 999999, soundPath: 'x'.repeat(1200) },
    alarm: { enabled: true, time: '99:99', soundPath: 'C:\\sound.wav' },
  });
  assert.equal(utilities.showClock, true);
  assert.equal(utilities.timer.active, false);
  assert.equal(utilities.timer.pausedRemaining, 86400);
  assert.equal(utilities.timer.soundPath, '');
  assert.equal(utilities.alarm.time, '07:00');
  assert.equal(utilities.alarm.soundPath, 'C:\\sound.wav');
  assert.equal(normalizeClockTime('23:59'), '23:59');
});

test('timer finishes exactly once and produces a visual alert', () => {
  let now = 1_000;
  const keeper = new Timekeeper({}, { now: () => now });
  keeper.startTimer(2);
  assert.equal(getTimerRemaining(keeper.getState().timer, now), 2);
  now = 3_000;
  keeper.tick();
  const state = keeper.getState();
  assert.equal(state.timer.active, false);
  assert.equal(state.timer.pausedRemaining, 0);
  assert.equal(state.alert.kind, 'timer');
  keeper.dismissAlert();
  assert.equal(keeper.getState().alert, null);
});

test('daily alarm raises only once during its matching minute', () => {
  const time = new Date(2026, 7, 1, 7, 30, 5).getTime();
  const keeper = new Timekeeper({ alarm: { enabled: true, time: '07:30' } }, { now: () => time });
  keeper.tick();
  const first = keeper.getState();
  assert.equal(first.alert.kind, 'alarm');
  keeper.dismissAlert();
  keeper.tick();
  assert.equal(keeper.getState().alert, null);
});
