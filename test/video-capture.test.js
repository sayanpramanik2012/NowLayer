const assert = require('node:assert/strict');
const test = require('node:test');
const {
  findSelectedSource,
  normalizeVideoState,
  toRendererSource,
} = require('../src/main/video-capture');

function fakeImage(data, empty = false) {
  return {
    isEmpty: () => empty,
    toDataURL: () => data,
  };
}

test('capture sources are safe for the renderer and exclude NowLayer windows', () => {
  const source = toRendererSource({
    id: 'window:123:0',
    name: 'YouTube - Google Chrome',
    thumbnail: fakeImage('data:image/png;base64,preview'),
    appIcon: fakeImage('data:image/png;base64,icon'),
  });
  assert.deepEqual(source, {
    id: 'window:123:0',
    name: 'YouTube - Google Chrome',
    thumbnail: 'data:image/png;base64,preview',
    appIcon: 'data:image/png;base64,icon',
  });
  assert.equal(toRendererSource({ id: 'window:2:0', name: 'NowLayer Control Center' }), null);
});

test('capture selection only accepts an enumerated source id', () => {
  const sources = [{ id: 'window:1:0' }, { id: 'window:2:0' }];
  assert.equal(findSelectedSource(sources, 'window:2:0'), sources[1]);
  assert.equal(findSelectedSource(sources, 'window:3:0'), null);
  assert.equal(findSelectedSource(sources, ''), null);
});

test('video state strips control characters and rejects unsafe state values', () => {
  const state = normalizeVideoState({
    active: 'yes',
    sourceId: 'window:\u00001:0',
    sourceName: 'Video\u0007 title',
    revision: -4,
    error: 'failed\u0000',
  });
  assert.deepEqual(state, {
    active: false,
    sourceId: 'window:1:0',
    sourceName: 'Video title',
    revision: 0,
    error: 'failed',
  });
});
