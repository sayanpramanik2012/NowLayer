const elements = {
  overlay: document.getElementById('overlay'),
  dragRegion: document.getElementById('dragRegion'),
  videoStage: document.getElementById('videoStage'),
  captureVideo: document.getElementById('captureVideo'),
  videoMessage: document.getElementById('videoMessage'),
  pipControls: document.getElementById('pipControls'),
  pipPlayButton: document.getElementById('pipPlayButton'),
  pipPlayIcon: document.getElementById('pipPlayIcon'),
  artwork: document.getElementById('artwork'),
  artworkImage: document.getElementById('artworkImage'),
  artworkFallback: document.getElementById('artworkFallback'),
  title: document.getElementById('title'),
  subtitle: document.getElementById('subtitle'),
  source: document.getElementById('source'),
  elapsed: document.getElementById('elapsed'),
  duration: document.getElementById('duration'),
  progress: document.getElementById('progress'),
  modeBadge: document.getElementById('modeBadge'),
  lockBadge: document.getElementById('lockBadge'),
  previousButton: document.getElementById('previousButton'),
  playButton: document.getElementById('playButton'),
  playIcon: document.getElementById('playIcon'),
  nextButton: document.getElementById('nextButton'),
  anchorButton: document.getElementById('anchorButton'),
  compactButton: document.getElementById('compactButton'),
  compactIcon: document.getElementById('compactIcon'),
  lockButton: document.getElementById('lockButton'),
  lockIcon: document.getElementById('lockIcon'),
  hideButton: document.getElementById('hideButton'),
  utilityBar: document.getElementById('utilityBar'),
  clockDisplay: document.getElementById('clockDisplay'),
  timerDisplay: document.getElementById('timerDisplay'),
  alertOverlay: document.getElementById('alertOverlay'),
  alertTitle: document.getElementById('alertTitle'),
  alertMessage: document.getElementById('alertMessage'),
  dismissAlertButton: document.getElementById('dismissAlertButton'),
};

const iconPath = '../assets/material-icons.svg';
const anchorCycle = ['bottom-right', 'bottom-left', 'top-left', 'top-right'];
const anchorLabels = {
  'bottom-right': 'BR',
  'bottom-left': 'BL',
  'top-left': 'TL',
  'top-right': 'TR',
  'top-center': 'TC',
  'bottom-center': 'BC',
  'middle-left': 'ML',
  'middle-right': 'MR',
  manual: 'M',
};

let state = null;
let captureStream = null;
let captureRevision = -1;
let captureRequest = 0;
let handledAlertAt = 0;
let alertAudio = null;

function setIcon(element, name) {
  element.setAttribute('href', `${iconPath}#${name}`);
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const whole = Math.floor(seconds);
  const minutes = Math.floor(whole / 60);
  return `${minutes}:${String(whole % 60).padStart(2, '0')}`;
}

function formatCountdown(seconds) {
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

function stopAlertSound() {
  if (alertAudio) {
    alertAudio.pause();
    alertAudio = null;
  }
}

function playDefaultTone(repeat) {
  try {
    const context = new AudioContext();
    const beep = () => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.13, context.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.28);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(); oscillator.stop(context.currentTime + 0.3);
    };
    beep();
    if (repeat) alertAudio = { pause: () => { context.close(); } };
    if (repeat) {
      const id = setInterval(beep, 900);
      alertAudio = { pause: () => { clearInterval(id); context.close(); } };
    } else setTimeout(() => context.close(), 500);
  } catch { /* Browser audio may be unavailable until first interaction. Visual alert still works. */ }
}

function renderUtilities() {
  const utilities = state?.utilities ?? {};
  const timer = utilities.timer ?? {};
  elements.clockDisplay.textContent = utilities.showClock ? new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date()) : '';
  elements.timerDisplay.textContent = timer.active || timer.pausedRemaining ? `T ${formatCountdown(timerRemaining(timer))}` : '';
  elements.overlay.classList.toggle('has-utilities', Boolean(elements.clockDisplay.textContent || elements.timerDisplay.textContent));
}

function renderAlert(alert, utilities) {
  const active = Boolean(alert);
  elements.alertOverlay.hidden = !active;
  if (!active) { stopAlertSound(); return; }
  const isAlarm = alert.kind === 'alarm';
  elements.alertTitle.textContent = isAlarm ? 'Alarm' : 'Timer finished';
  elements.alertMessage.textContent = isAlarm ? `It is ${utilities.alarm?.time || 'time'}. Ctrl + Shift + A dismisses.` : 'Time is up. Ctrl + Shift + A dismisses.';
  if (alert.raisedAt && alert.raisedAt !== handledAlertAt) {
    handledAlertAt = alert.raisedAt;
    if (alert.soundEnabled) {
      stopAlertSound();
      if (alert.soundPath && (isAlarm ? utilities.alarm?.soundUrl : utilities.timer?.soundUrl)) {
        alertAudio = new Audio(isAlarm ? utilities.alarm.soundUrl : utilities.timer.soundUrl);
        alertAudio.loop = isAlarm;
        alertAudio.play().catch(() => playDefaultTone(isAlarm));
      } else playDefaultTone(isAlarm);
    }
  }
}

function friendlySource(sourceName) {
  const value = String(sourceName || '').toLowerCase();
  if (value.includes('spotify')) return 'SPOTIFY';
  if (value.includes('chrome')) return 'CHROME';
  if (value.includes('msedge')) return 'EDGE';
  if (value.includes('firefox')) return 'FIREFOX';
  if (value.includes('vlc')) return 'VLC';
  const firstPart = String(sourceName || '').split(/[.!/\\]/).filter(Boolean).at(-1);
  return (firstPart || 'NOWLAYER').slice(0, 14).toUpperCase();
}

function updateLiveTimeline() {
  const media = state?.media ?? {};
  const position = window.nowLayerTimeline.projectPosition(media);
  elements.elapsed.textContent = formatTime(position);
  elements.duration.textContent = formatTime(media.duration);
  const percent = media.duration > 0 ? Math.min(100, (position / media.duration) * 100) : 0;
  elements.progress.style.width = `${percent}%`;
}

elements.artworkImage.addEventListener('load', () => {
  elements.artwork.classList.add('has-image');
});
elements.artworkImage.addEventListener('error', () => {
  elements.artwork.classList.remove('has-image');
});

function stopCaptureStream() {
  const previous = captureStream;
  captureStream = null;
  elements.captureVideo.srcObject = null;
  for (const track of previous?.getTracks?.() ?? []) track.stop();
}

async function synchronizeVideo(videoState) {
  const shouldCapture = videoState?.active === true;
  if (!shouldCapture) {
    captureRequest += 1;
    captureRevision = -1;
    stopCaptureStream();
    return;
  }
  // One attempt per selection. A failed capture waits for an explicit reselect
  // instead of retrying on every media metadata update.
  if (captureRevision === videoState.revision) return;

  const requestId = ++captureRequest;
  captureRevision = videoState.revision;
  stopCaptureStream();
  elements.videoMessage.textContent = `Connecting to ${videoState.sourceName || 'the selected window'}...`;
  elements.videoStage.classList.remove('has-video');

  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      audio: false,
      video: { frameRate: { ideal: 30, max: 30 } },
    });
    if (requestId !== captureRequest) {
      for (const track of stream.getTracks()) track.stop();
      return;
    }
    captureStream = stream;
    elements.captureVideo.srcObject = stream;
    await elements.captureVideo.play();
    elements.videoStage.classList.add('has-video');
    const [track] = stream.getVideoTracks();
    track.addEventListener('ended', () => {
      if (captureStream !== stream) return;
      captureStream = null;
      elements.videoStage.classList.remove('has-video');
      elements.videoMessage.textContent = 'The captured window is no longer available.';
      window.nowLayer.reportVideoError('The selected video window closed or stopped sharing.');
    }, { once: true });
  } catch (error) {
    if (requestId !== captureRequest) return;
    captureStream = null;
    elements.videoStage.classList.remove('has-video');
    elements.videoMessage.textContent = 'Video capture could not start. Choose the window again.';
    window.nowLayer.reportVideoError(error?.message || 'Video capture could not start.');
  }
}

function render(nextState) {
  if (!nextState) return;
  state = nextState;
  const media = state.media ?? {};
  const settings = state.settings ?? {};
  const platform = state.platform ?? {};
  const video = state.video ?? {};
  const utilities = state.utilities ?? {};
  const available = media.available === true;
  const playing = String(media.status).toLowerCase() === 'playing';

  elements.overlay.classList.toggle('is-locked', settings.locked !== false);
  elements.overlay.classList.toggle('is-compact', settings.compact === true && video.active !== true);
  elements.overlay.classList.toggle('is-video', video.active === true);
  elements.overlay.classList.toggle(
    'show-pip-controls',
    video.active === true && settings.showPipControls !== false,
  );
  elements.overlay.classList.toggle('is-playing', playing);
  elements.overlay.classList.toggle('no-media', !available);
  document.documentElement.style.setProperty('--panel-opacity', String(settings.opacity ?? 0.94));

  elements.title.textContent = available ? (media.title || 'Untitled media') : 'Nothing playing';
  elements.subtitle.textContent = available
    ? (media.artist || media.albumTitle || 'Media session active')
    : 'Start media in Spotify, Chrome, or another app';
  elements.source.textContent = friendlySource(media.source);
  elements.source.title = media.source || 'NowLayer';
  updateLiveTimeline();

  elements.modeBadge.textContent = 'ON-TOP';
  elements.modeBadge.title = platform.message || 'Overlay mode';
  elements.lockBadge.textContent = settings.locked === false ? 'UNLOCKED' : 'LOCKED';
  setIcon(elements.lockIcon, settings.locked === false ? 'lock-open' : 'lock');
  setIcon(elements.compactIcon, settings.compact ? 'add' : 'remove');
  setIcon(elements.playIcon, playing ? 'pause' : 'play');
  setIcon(elements.pipPlayIcon, playing ? 'pause' : 'play');
  elements.pipControls.dataset.position = settings.pipControlPosition || 'top-right';
  elements.anchorButton.textContent = anchorLabels[settings.anchor] || 'BR';
  renderUtilities();
  renderAlert(utilities.alert, utilities);

  elements.previousButton.disabled = !available || media.controls?.previous !== true;
  elements.playButton.disabled = !available || media.controls?.playPause !== true;
  elements.pipPlayButton.disabled = !available || media.controls?.playPause !== true;
  elements.nextButton.disabled = !available || media.controls?.next !== true;

  if (available && media.artwork) {
    if (elements.artworkImage.src !== media.artwork) {
      elements.artwork.classList.remove('has-image');
      elements.artworkImage.src = media.artwork;
    } else if (elements.artworkImage.complete && elements.artworkImage.naturalWidth > 0) {
      elements.artwork.classList.add('has-image');
    }
  } else {
    elements.artworkImage.removeAttribute('src');
    elements.artwork.classList.remove('has-image');
    const initial = (media.title || 'N').trim().charAt(0).toUpperCase();
    elements.artworkFallback.textContent = initial || 'N';
  }

  synchronizeVideo(video);
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

elements.previousButton.addEventListener('click', () => mediaAction('previous'));
elements.playButton.addEventListener('click', () => mediaAction('play-pause'));
elements.pipPlayButton.addEventListener('click', () => mediaAction('play-pause'));
elements.nextButton.addEventListener('click', () => mediaAction('next'));
elements.lockButton.addEventListener('click', () => setSetting('locked', !state.settings.locked));
elements.compactButton.addEventListener('click', () => setSetting('compact', !state.settings.compact));
elements.hideButton.addEventListener('click', () => setSetting('visible', false));
elements.anchorButton.addEventListener('click', () => {
  const currentIndex = anchorCycle.indexOf(state.settings.anchor);
  const nextAnchor = anchorCycle[(currentIndex + 1 + anchorCycle.length) % anchorCycle.length];
  setSetting('anchor', nextAnchor);
});
elements.dismissAlertButton.addEventListener('click', async () => {
  try { await window.nowLayer.dismissAlert(); } catch (error) { console.error('Could not dismiss alert:', error); }
});
window.addEventListener('beforeunload', stopCaptureStream);
window.addEventListener('beforeunload', stopAlertSound);
setInterval(() => { updateLiveTimeline(); renderUtilities(); }, 250);
window.nowLayer.onState(render);
window.nowLayer.getState().then(render).catch((error) => {
  console.error('Could not load initial state:', error);
});
