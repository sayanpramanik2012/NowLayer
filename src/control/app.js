const elements = {
  navButtons: [...document.querySelectorAll('[data-view]')],
  panels: [...document.querySelectorAll('[data-view-panel]')],
  welcomeCard: document.getElementById('welcomeCard'),
  finishOnboardingButton: document.getElementById('finishOnboardingButton'),
  visibilityButton: document.getElementById('visibilityButton'),
  sidebarDot: document.getElementById('sidebarDot'),
  sidebarStatus: document.getElementById('sidebarStatus'),
  mediaStatus: document.getElementById('mediaStatus'),
  mediaDetail: document.getElementById('mediaDetail'),
  overlayStatus: document.getElementById('overlayStatus'),
  overlayDetail: document.getElementById('overlayDetail'),
  inputStatus: document.getElementById('inputStatus'),
  inputDetail: document.getElementById('inputDetail'),
  controlArtwork: document.getElementById('controlArtwork'),
  controlArtworkImage: document.getElementById('controlArtworkImage'),
  controlArtworkFallback: document.getElementById('controlArtworkFallback'),
  controlTitle: document.getElementById('controlTitle'),
  controlArtist: document.getElementById('controlArtist'),
  quickPrevious: document.getElementById('quickPrevious'),
  quickPlay: document.getElementById('quickPlay'),
  quickPlayIcon: document.getElementById('quickPlayIcon'),
  quickNext: document.getElementById('quickNext'),
  refreshSourcesButton: document.getElementById('refreshSourcesButton'),
  stopCaptureButton: document.getElementById('stopCaptureButton'),
  captureStatus: document.getElementById('captureStatus'),
  captureDetail: document.getElementById('captureDetail'),
  sourceLoading: document.getElementById('sourceLoading'),
  sourceEmpty: document.getElementById('sourceEmpty'),
  sourceGrid: document.getElementById('sourceGrid'),
  anchorButtons: [...document.querySelectorAll('[data-anchor]')],
  positionLabel: document.getElementById('positionLabel'),
  previewTitle: document.getElementById('previewTitle'),
  previewArtist: document.getElementById('previewArtist'),
  visibleToggle: document.getElementById('visibleToggle'),
  lockedToggle: document.getElementById('lockedToggle'),
  compactToggle: document.getElementById('compactToggle'),
  pipControlsToggle: document.getElementById('pipControlsToggle'),
  pipControlPositionSelect: document.getElementById('pipControlPositionSelect'),
  opacitySlider: document.getElementById('opacitySlider'),
  opacityValue: document.getElementById('opacityValue'),
  resetButton: document.getElementById('resetButton'),
  copyDiagnosticsButton: document.getElementById('copyDiagnosticsButton'),
  copyConfirmation: document.getElementById('copyConfirmation'),
  versionDiagnostic: document.getElementById('versionDiagnostic'),
  runtimeDiagnostic: document.getElementById('runtimeDiagnostic'),
  windowDiagnostic: document.getElementById('windowDiagnostic'),
  sourceDiagnostic: document.getElementById('sourceDiagnostic'),
  errorPanel: document.getElementById('errorPanel'),
  mediaError: document.getElementById('mediaError'),
  clockToggle: document.getElementById('clockToggle'),
  utilityDisplayMode: document.getElementById('utilityDisplayMode'),
  startupToggle: document.getElementById('startupToggle'),
  timerReadout: document.getElementById('timerReadout'),
  timerMinutes: document.getElementById('timerMinutes'),
  timerSeconds: document.getElementById('timerSeconds'),
  timerStartButton: document.getElementById('timerStartButton'),
  timerPauseButton: document.getElementById('timerPauseButton'),
  timerResetButton: document.getElementById('timerResetButton'),
  timerSoundToggle: document.getElementById('timerSoundToggle'),
  timerSoundButton: document.getElementById('timerSoundButton'),
  timerSoundLabel: document.getElementById('timerSoundLabel'),
  alarmReadout: document.getElementById('alarmReadout'),
  alarmTime: document.getElementById('alarmTime'),
  alarmEnabledToggle: document.getElementById('alarmEnabledToggle'),
  alarmSoundToggle: document.getElementById('alarmSoundToggle'),
  alarmSoundButton: document.getElementById('alarmSoundButton'),
  alarmSoundLabel: document.getElementById('alarmSoundLabel'),
  dismissActiveAlertButton: document.getElementById('dismissActiveAlertButton'),
};

const iconPath = '../assets/material-icons.svg';
const anchorNames = {
  'top-left': 'Top left',
  'top-center': 'Top center',
  'top-right': 'Top right',
  'middle-left': 'Middle left',
  'middle-right': 'Middle right',
  'bottom-left': 'Bottom left',
  'bottom-center': 'Bottom center',
  'bottom-right': 'Bottom right',
  manual: 'Custom position',
};

let state = null;
let opacityCommitTimer = null;
let captureSources = [];
let sourcesLoaded = false;
let renderedSelectedSourceId = null;

elements.controlArtworkImage.addEventListener('load', () => {
  elements.controlArtwork.classList.add('has-image');
});
elements.controlArtworkImage.addEventListener('error', () => {
  elements.controlArtwork.classList.remove('has-image');
});

function setIcon(element, name) {
  element.setAttribute('href', `${iconPath}#${name}`);
}

function selectView(viewName) {
  for (const button of elements.navButtons) {
    button.classList.toggle('is-active', button.dataset.view === viewName);
  }
  for (const panel of elements.panels) {
    panel.classList.toggle('is-active', panel.dataset.viewPanel === viewName);
  }
  if (viewName === 'video' && !sourcesLoaded) loadCaptureSources();
}

function friendlySource(source) {
  const value = String(source || '').toLowerCase();
  if (value.includes('spotify')) return 'Spotify';
  if (value.includes('chrome')) return 'Google Chrome';
  if (value.includes('msedge')) return 'Microsoft Edge';
  if (value.includes('firefox')) return 'Firefox';
  if (value.includes('vlc')) return 'VLC';
  return String(source || 'None');
}

function formatDuration(seconds) {
  const safe = Math.max(0, Math.round(Number(seconds) || 0));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const remainder = safe % 60;
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}` : `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

function timerRemaining(timer) {
  if (timer?.active && timer.endAt > Date.now()) return Math.ceil((timer.endAt - Date.now()) / 1000);
  return Number(timer?.pausedRemaining) || 0;
}

async function updateUtilities(patch) {
  const utilities = state?.utilities ?? { timer: {}, alarm: {} };
  return setSetting('utilities', {
    ...utilities,
    ...patch,
    timer: { ...utilities.timer, ...patch.timer },
    alarm: { ...utilities.alarm, ...patch.alarm },
  });
}

function renderCaptureSources() {
  elements.sourceGrid.replaceChildren();
  elements.sourceEmpty.hidden = captureSources.length > 0;
  const selectedId = state?.video?.sourceId;
  for (const source of captureSources) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'source-card';
    card.classList.toggle('is-selected', source.id === selectedId);
    card.setAttribute('aria-label', `Show ${source.name} in video PiP`);

    const preview = document.createElement('span');
    preview.className = 'source-preview';
    if (source.thumbnail) {
      const image = document.createElement('img');
      image.src = source.thumbnail;
      image.alt = '';
      preview.append(image);
    } else {
      const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      icon.setAttribute('class', 'material-icon');
      const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
      use.setAttribute('href', `${iconPath}#video`);
      icon.append(use);
      preview.append(icon);
    }

    const label = document.createElement('span');
    label.className = 'source-name';
    label.textContent = source.name;
    const action = document.createElement('span');
    action.className = 'source-action';
    action.textContent = source.id === selectedId ? 'Showing now' : 'Show in overlay';
    card.append(preview, label, action);
    card.addEventListener('click', () => chooseCaptureSource(source, card));
    elements.sourceGrid.append(card);
  }
  renderedSelectedSourceId = selectedId || '';
}

async function loadCaptureSources() {
  elements.sourceLoading.hidden = false;
  elements.sourceEmpty.hidden = true;
  elements.refreshSourcesButton.disabled = true;
  try {
    captureSources = await window.nowLayer.listCaptureSources();
    sourcesLoaded = true;
    renderCaptureSources();
  } catch (error) {
    captureSources = [];
    elements.sourceGrid.replaceChildren();
    elements.sourceEmpty.textContent = `Could not list windows: ${error.message}`;
    elements.sourceEmpty.hidden = false;
  } finally {
    elements.sourceLoading.hidden = true;
    elements.refreshSourcesButton.disabled = false;
  }
}

async function chooseCaptureSource(source, button) {
  button.disabled = true;
  const previousLabel = button.querySelector('.source-action');
  if (previousLabel) previousLabel.textContent = 'Starting...';
  try {
    const video = await window.nowLayer.setCaptureSource(source.id);
    render({ ...state, video });
  } catch (error) {
    elements.captureStatus.textContent = 'Could not start PiP';
    elements.captureDetail.textContent = error.message;
    button.disabled = false;
    if (previousLabel) previousLabel.textContent = 'Try again';
  }
}

function render(nextState) {
  if (!nextState) return;
  state = nextState;
  const media = state.media ?? {};
  const settings = state.settings ?? {};
  const platform = state.platform ?? {};
  const appInfo = state.app ?? {};
  const video = state.video ?? {};
  const utilities = state.utilities ?? { timer: {}, alarm: {} };
  const available = media.available === true;
  const playing = String(media.status).toLowerCase() === 'playing';

  elements.welcomeCard.hidden = settings.onboardingComplete === true;
  elements.visibilityButton.textContent = settings.visible === false ? 'Show overlay' : 'Hide overlay';
  elements.visibleToggle.checked = settings.visible !== false;
  elements.lockedToggle.checked = settings.locked !== false;
  elements.compactToggle.checked = settings.compact === true;
  elements.pipControlsToggle.checked = settings.showPipControls !== false;
  elements.pipControlPositionSelect.value = settings.pipControlPosition || 'top-right';
  elements.pipControlPositionSelect.disabled = settings.showPipControls === false;
  const opacityPercent = Math.round((settings.opacity ?? 0.94) * 100);
  if (document.activeElement !== elements.opacitySlider) elements.opacitySlider.value = String(opacityPercent);
  elements.opacityValue.textContent = `${opacityPercent}%`;
  elements.clockToggle.checked = utilities.showClock === true;
  elements.utilityDisplayMode.value = utilities.displayMode || 'embedded';
  elements.startupToggle.checked = appInfo.startupEnabled === true;
  elements.timerReadout.textContent = formatDuration(timerRemaining(utilities.timer));
  elements.timerPauseButton.disabled = utilities.timer?.active !== true;
  elements.timerSoundToggle.checked = utilities.timer?.soundEnabled === true;
  elements.timerSoundLabel.textContent = utilities.timer?.soundPath ? utilities.timer.soundPath.split(/[\\/]/).at(-1) : 'Default tone';
  elements.alarmTime.value = utilities.alarm?.time || '07:00';
  elements.alarmEnabledToggle.checked = utilities.alarm?.enabled === true;
  elements.alarmSoundToggle.checked = utilities.alarm?.soundEnabled === true;
  elements.alarmSoundLabel.textContent = utilities.alarm?.soundPath ? utilities.alarm.soundPath.split(/[\\/]/).at(-1) : 'Default tone';
  elements.alarmReadout.textContent = utilities.alarm?.enabled ? `Daily at ${utilities.alarm.time}` : 'Off';
  elements.dismissActiveAlertButton.hidden = !utilities.alert;

  elements.mediaStatus.textContent = available ? (playing ? 'Playing now' : 'Media paused') : 'Waiting for media';
  elements.mediaDetail.textContent = available
    ? `${media.title || 'Untitled'} - ${friendlySource(media.source)}`
    : (media.error ? 'Media bridge needs attention' : 'Open Spotify, a browser, or another player');
  elements.overlayStatus.textContent = 'Always-on-top active';
  elements.overlayDetail.textContent = platform.message || 'Standalone overlay ready';
  elements.inputStatus.textContent = settings.locked === false ? 'Overlay interaction active' : 'Click-through locked';
  elements.inputDetail.textContent = settings.locked === false
    ? 'Overlay owns the mouse - lock it before playing'
    : 'Mouse input goes to the app underneath';
  elements.sidebarDot.classList.add('is-ready');
  elements.sidebarStatus.textContent = 'Standalone overlay active';

  elements.controlTitle.textContent = available ? (media.title || 'Untitled media') : 'Nothing playing';
  elements.controlArtist.textContent = available
    ? (media.artist || media.albumTitle || friendlySource(media.source))
    : 'Start media to test NowLayer';
  elements.previewTitle.textContent = elements.controlTitle.textContent;
  elements.previewArtist.textContent = elements.controlArtist.textContent;
  elements.quickPrevious.disabled = !available || media.controls?.previous !== true;
  elements.quickPlay.disabled = !available || media.controls?.playPause !== true;
  elements.quickNext.disabled = !available || media.controls?.next !== true;
  setIcon(elements.quickPlayIcon, playing ? 'pause' : 'play');

  if (available && media.artwork) {
    if (elements.controlArtworkImage.src !== media.artwork) {
      elements.controlArtwork.classList.remove('has-image');
      elements.controlArtworkImage.src = media.artwork;
    } else if (elements.controlArtworkImage.complete && elements.controlArtworkImage.naturalWidth > 0) {
      elements.controlArtwork.classList.add('has-image');
    }
  } else {
    elements.controlArtworkImage.removeAttribute('src');
    elements.controlArtwork.classList.remove('has-image');
    elements.controlArtworkFallback.textContent = (media.title || 'N').trim().charAt(0).toUpperCase() || 'N';
  }

  elements.captureStatus.textContent = video.active ? 'PiP active' : 'Not active';
  elements.captureDetail.textContent = video.active
    ? (video.error || `Showing ${video.sourceName || 'the selected window'}`)
    : 'Choose a browser or video-player window below.';
  elements.stopCaptureButton.hidden = !video.active;
  if (sourcesLoaded && renderedSelectedSourceId !== (video.sourceId || '')) renderCaptureSources();

  for (const button of elements.anchorButtons) {
    button.classList.toggle('is-selected', button.dataset.anchor === settings.anchor);
  }
  elements.positionLabel.textContent = `Selected: ${anchorNames[settings.anchor] || 'Bottom right'}`;

  elements.versionDiagnostic.textContent = `v${appInfo.version || '1.0.0'}${appInfo.isPackaged ? '' : ' (development)'}`;
  elements.runtimeDiagnostic.textContent = platform.runtime || 'Electron';
  elements.windowDiagnostic.textContent = platform.alwaysOnTop ? 'Always on top' : 'Standard';
  elements.sourceDiagnostic.textContent = friendlySource(media.source);
  elements.errorPanel.hidden = !media.error;
  elements.mediaError.textContent = media.error || '';
}

async function setSetting(key, value) {
  try {
    const settings = await window.nowLayer.setSetting(key, value);
    render({ ...state, settings });
  } catch (error) {
    console.error(`Could not update ${key}:`, error);
  }
}

async function mediaAction(action) {
  try {
    await window.nowLayer.mediaAction(action);
  } catch (error) {
    console.error(`Media action ${action} failed:`, error);
  }
}

for (const button of elements.navButtons) {
  button.addEventListener('click', () => selectView(button.dataset.view));
}
for (const button of elements.anchorButtons) {
  button.addEventListener('click', () => setSetting('anchor', button.dataset.anchor));
}

elements.finishOnboardingButton.addEventListener('click', () => setSetting('onboardingComplete', true));
elements.visibilityButton.addEventListener('click', () => setSetting('visible', state?.settings?.visible === false));
elements.visibleToggle.addEventListener('change', () => setSetting('visible', elements.visibleToggle.checked));
elements.lockedToggle.addEventListener('change', () => setSetting('locked', elements.lockedToggle.checked));
elements.compactToggle.addEventListener('change', () => setSetting('compact', elements.compactToggle.checked));
elements.pipControlsToggle.addEventListener('change', () => {
  setSetting('showPipControls', elements.pipControlsToggle.checked);
});
elements.pipControlPositionSelect.addEventListener('change', () => {
  setSetting('pipControlPosition', elements.pipControlPositionSelect.value);
});
elements.opacitySlider.addEventListener('input', () => {
  elements.opacityValue.textContent = `${elements.opacitySlider.value}%`;
  if (opacityCommitTimer) clearTimeout(opacityCommitTimer);
  opacityCommitTimer = setTimeout(() => {
    setSetting('opacity', Number(elements.opacitySlider.value) / 100);
  }, 80);
});
elements.clockToggle.addEventListener('change', () => updateUtilities({ showClock: elements.clockToggle.checked }));
elements.utilityDisplayMode.addEventListener('change', () => updateUtilities({ displayMode: elements.utilityDisplayMode.value }));
elements.startupToggle.addEventListener('change', async () => {
  try {
    const enabled = await window.nowLayer.setStartup(elements.startupToggle.checked);
    render({ ...state, app: { ...state.app, startupEnabled: enabled } });
  } catch (error) { console.error('Could not update Windows startup:', error); }
});
elements.timerStartButton.addEventListener('click', async () => {
  const seconds = Number(elements.timerMinutes.value || 0) * 60 + Number(elements.timerSeconds.value || 0);
  if (seconds < 1) { elements.timerReadout.textContent = 'Choose at least 1 second'; return; }
  await window.nowLayer.startTimer(seconds);
});
elements.timerPauseButton.addEventListener('click', () => window.nowLayer.pauseTimer());
elements.timerResetButton.addEventListener('click', () => window.nowLayer.resetTimer());
elements.timerSoundToggle.addEventListener('change', () => updateUtilities({ timer: { soundEnabled: elements.timerSoundToggle.checked } }));
elements.alarmEnabledToggle.addEventListener('change', () => updateUtilities({ alarm: { enabled: elements.alarmEnabledToggle.checked } }));
elements.alarmTime.addEventListener('change', () => updateUtilities({ alarm: { time: elements.alarmTime.value } }));
elements.alarmSoundToggle.addEventListener('change', () => updateUtilities({ alarm: { soundEnabled: elements.alarmSoundToggle.checked } }));
elements.timerSoundButton.addEventListener('click', async () => {
  const result = await window.nowLayer.chooseAlertSound();
  if (result) updateUtilities({ timer: { soundPath: result.path } });
});
elements.alarmSoundButton.addEventListener('click', async () => {
  const result = await window.nowLayer.chooseAlertSound();
  if (result) updateUtilities({ alarm: { soundPath: result.path } });
});
elements.dismissActiveAlertButton.addEventListener('click', () => window.nowLayer.dismissAlert());
elements.quickPrevious.addEventListener('click', () => mediaAction('previous'));
elements.quickPlay.addEventListener('click', () => mediaAction('play-pause'));
elements.quickNext.addEventListener('click', () => mediaAction('next'));
elements.refreshSourcesButton.addEventListener('click', loadCaptureSources);
elements.stopCaptureButton.addEventListener('click', async () => {
  try {
    const video = await window.nowLayer.stopCapture();
    render({ ...state, video });
  } catch (error) {
    elements.captureDetail.textContent = `Could not stop PiP: ${error.message}`;
  }
});
elements.copyDiagnosticsButton.addEventListener('click', async () => {
  try {
    await window.nowLayer.copyDiagnostics();
    elements.copyConfirmation.textContent = 'Diagnostics copied to the clipboard.';
    setTimeout(() => { elements.copyConfirmation.textContent = ''; }, 2500);
  } catch (error) {
    elements.copyConfirmation.textContent = `Could not copy diagnostics: ${error.message}`;
  }
});
elements.resetButton.addEventListener('click', async () => {
  if (!window.confirm('Reset NowLayer position and behavior to the defaults?')) return;
  try {
    const settings = await window.nowLayer.resetSettings();
    render({ ...state, settings });
  } catch (error) {
    console.error('Could not reset settings:', error);
  }
});

window.nowLayer.onState(render);
window.nowLayer.getState().then(render).catch((error) => {
  console.error('Could not load NowLayer state:', error);
});
setInterval(() => {
  if (state?.utilities?.timer) elements.timerReadout.textContent = formatDuration(timerRemaining(state.utilities.timer));
}, 250);
