(() => {
  const switches = [...document.querySelectorAll('[data-home-toggle]')];
  const summary = document.getElementById('homeSummary');
  const message = document.getElementById('homeMessage');
  const dialog = document.getElementById('homeVideoDialog');
  const sourceSelect = document.getElementById('homeVideoSource');
  const applyVideo = document.getElementById('homeVideoApply');
  let current = null;
  function render(state) {
    current = state;
    const settings = state.settings || {}, utilities = state.utilities || settings.utilities || {};
    const flags = {
      media: settings.mediaEnabled !== false && !state.video?.active,
      performance: settings.performance?.enabled === true,
      video: state.video?.active === true,
      clock: utilities.showClock === true && utilities.widgetVisible !== false,
      timer: utilities.showTimer !== false && utilities.widgetVisible !== false,
      alarm: utilities.alarm?.enabled === true,
    };
    for (const input of switches) input.checked = flags[input.dataset.homeToggle];
    const count = Object.values(flags).filter(Boolean).length;
    summary.textContent = `${count} features enabled${settings.visible === false ? ' · overlays hidden' : ''}. Overlays return when you switch back to your game.`;
    document.getElementById('homeAlarmDetail').textContent = `Daily at ${utilities.alarm?.time || '07:00'} · customize time and sound`;
    document.getElementById('homeTimerDetail').textContent = utilities.timer?.active ? 'Counting down · hiding the widget keeps the timer running' : 'Ready when you are · set a countdown in customization';
  }
  async function showOverlays() {
    if (current?.settings?.visible === false) await window.nowLayer.setSetting('visible', true);
  }
  async function chooseVideo() {
    dialog.showModal();
    sourceSelect.replaceChildren();
    applyVideo.disabled = true;
    document.getElementById('homeVideoStatus').textContent = 'Looking for open windows…';
    const sources = await window.nowLayer.listCaptureSources();
    if (!dialog.open) return;
    for (const source of sources) {
      const option = document.createElement('option'); option.value = source.id; option.textContent = source.name; sourceSelect.append(option);
    }
    document.getElementById('homeVideoStatus').textContent = sources.length ? 'Keep the selected window open and not minimized.' : 'No windows found. Open your video player and try again.';
    applyVideo.disabled = sources.length === 0;
  }
  for (const input of switches) input.addEventListener('change', async () => {
    const enabled = input.checked, key = input.dataset.homeToggle;
    input.disabled = true; message.textContent = '';
    try {
      if (key === 'video' && enabled) { await chooseVideo(); return; }
      if (enabled && key !== 'alarm') await showOverlays();
      if (key === 'media') {
        if (enabled && current.video?.active) await window.nowLayer.stopCapture();
        await window.nowLayer.setSetting('mediaEnabled', enabled);
      } else if (key === 'video') await window.nowLayer.stopCapture();
      else if (key === 'performance') await window.nowLayer.setSetting('performance', { enabled });
      else if (key === 'alarm') await window.nowLayer.setSetting('utilities', { alarm: { enabled } });
      else await window.nowLayer.setSetting('utilities', { [key === 'clock' ? 'showClock' : 'showTimer']: enabled, ...(enabled ? { widgetVisible: true, displayMode: 'separate' } : {}) });
    } catch (error) { message.textContent = error.message; }
    finally { input.disabled = false; render(await window.nowLayer.getState()); }
  });
  applyVideo.addEventListener('click', async () => {
    applyVideo.disabled = true;
    try { await window.nowLayer.setCaptureSource(sourceSelect.value); await showOverlays(); dialog.close(); }
    catch (error) { document.getElementById('homeVideoStatus').textContent = error.message; }
    finally { applyVideo.disabled = false; render(await window.nowLayer.getState()); }
  });
  document.getElementById('homeVideoCancel').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => { if (current) render(current); });
  for (const button of document.querySelectorAll('[data-home-view]')) button.addEventListener('click', () => {
    document.querySelector(`.nav-button[data-view="${button.dataset.homeView}"]`)?.click();
  });
  window.nowLayer.onState(render);
  window.nowLayer.getState().then(render).catch(error => { message.textContent = error.message; });
})();
