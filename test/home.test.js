const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const { sanitizeSettings } = require('../src/main/config');

test('Home switches update independent preferences and select video without navigating away', async () => {
  const ids = new Map();
  function element() {
    return { listeners: {}, dataset: {}, options: [], addEventListener(name, fn) { this.listeners[name] = fn; },
      replaceChildren() { this.options = []; }, append(option) { this.options.push(option); this.value ||= option.value; },
      showModal() { this.open = true; }, close() { this.open = false; this.listeners.close?.(); } };
  }
  function byId(id) { if (!ids.has(id)) ids.set(id, element()); return ids.get(id); }
  const switches = ['media', 'performance', 'video', 'clock', 'timer', 'alarm'].map(key => Object.assign(element(), { dataset: { homeToggle: key } }));
  let state = { settings: sanitizeSettings({ visible: false, mediaEnabled: false }), video: { active: false } };
  state.utilities = state.settings.utilities;
  let subscriber;
  const publish = () => subscriber?.(structuredClone(state));
  const api = {
    getState: async () => structuredClone(state), onState: fn => { subscriber = fn; },
    setSetting: async (key, patch) => {
      if (['utilities', 'performance'].includes(key)) {
        const previous = state.settings[key];
        state.settings[key] = { ...previous, ...patch, ...(patch.alarm ? { alarm: { ...previous.alarm, ...patch.alarm } } : {}) };
      } else state.settings[key] = patch;
      state.utilities = state.settings.utilities; publish(); return state.settings;
    },
    listCaptureSources: async () => [{ id: 'window:1:0', name: 'My video' }],
    setCaptureSource: async id => { state.video = { active: true, sourceId: id }; publish(); },
    stopCapture: async () => { state.video = { active: false }; publish(); },
  };
  vm.runInNewContext(fs.readFileSync(require.resolve('../src/control/home.js'), 'utf8'), {
    window: { nowLayer: api }, document: { getElementById: byId, createElement: element,
      querySelectorAll: selector => selector === '[data-home-toggle]' ? switches : [], querySelector: () => null },
  });
  await Promise.resolve();
  async function toggle(key, value) {
    const input = switches.find(item => item.dataset.homeToggle === key); input.checked = value; await input.listeners.change();
    assert.equal(input.disabled, false);
  }
  await toggle('performance', true);
  assert.equal(state.settings.visible, true);
  assert.equal(state.settings.performance.enabled, true);
  assert.equal(state.settings.mediaEnabled, false);
  await toggle('clock', true);
  assert.equal(state.utilities.showClock, true);
  assert.equal(state.utilities.displayMode, 'separate');
  await toggle('alarm', true);
  assert.equal(state.utilities.alarm.enabled, true);
  assert.equal(state.utilities.alarm.time, '07:00');
  await toggle('video', true);
  assert.equal(byId('homeVideoDialog').open, true);
  assert.equal(state.video.active, false);
  await byId('homeVideoApply').listeners.click();
  assert.equal(state.video.sourceId, 'window:1:0');
  assert.equal(byId('homeVideoDialog').open, false);
  await toggle('media', true);
  assert.equal(state.video.active, false);
  assert.equal(state.settings.mediaEnabled, true);
  assert.equal(state.settings.performance.enabled, true);
});
