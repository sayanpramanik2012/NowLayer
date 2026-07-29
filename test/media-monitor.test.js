const assert = require('node:assert/strict');
const test = require('node:test');
const { normalizeMediaState } = require('../src/main/media-monitor');

test('normalizeMediaState creates a safe renderer payload', () => {
  const state = normalizeMediaState({
    available: true,
    title: 42,
    artist: null,
    source: 'Spotify.exe',
    status: 'Playing',
    position: -12,
    duration: 240,
    artwork: { unexpected: true },
    controls: { next: true, previous: 1, playPause: true },
  });

  assert.equal(state.available, true);
  assert.equal(state.title, '42');
  assert.equal(state.artist, '');
  assert.equal(state.position, 0);
  assert.equal(state.duration, 240);
  assert.equal(Number.isFinite(state.sampledAt), true);
  assert.equal(state.artwork, '');
  assert.deepEqual(state.controls, {
    previous: false,
    playPause: true,
    next: true,
  });
});

test('normalizeMediaState clamps position to duration', () => {
  const state = normalizeMediaState({ position: 90, duration: 30 });
  assert.equal(state.position, 30);
});

test('normalizeMediaState bounds untrusted media strings and artwork', () => {
  const state = normalizeMediaState({
    title: 't'.repeat(1000),
    error: 'e'.repeat(2000),
    artwork: 'a'.repeat(3_000_001),
  });
  assert.equal(state.title.length, 512);
  assert.equal(state.error.length, 1024);
  assert.equal(state.artwork, '');
});
