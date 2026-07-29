const assert = require('node:assert/strict');
const test = require('node:test');
const { projectPosition } = require('../src/shared/media-timeline');

test('playing media position advances from its synchronization time', () => {
  const position = projectPosition({
    status: 'Playing',
    position: 3,
    duration: 260,
    sampledAt: 1_000,
  }, 16_000);
  assert.equal(position, 18);
});

test('paused media position remains fixed', () => {
  const position = projectPosition({
    status: 'Paused',
    position: 18,
    duration: 260,
    sampledAt: 1_000,
  }, 20_000);
  assert.equal(position, 18);
});

test('projected position never exceeds the duration', () => {
  const position = projectPosition({
    status: 'Playing',
    position: 258,
    duration: 260,
    sampledAt: 1_000,
  }, 20_000);
  assert.equal(position, 260);
});
