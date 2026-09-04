const elements = { widget: document.getElementById('widget'), clock: document.getElementById('clock'), timer: document.getElementById('timer'), timerLabel: document.getElementById('timerLabel'), alert: document.getElementById('alert'), analogClock: document.getElementById('analogClock'), hourHand: document.getElementById('hourHand'), minuteHand: document.getElementById('minuteHand'), secondHand: document.getElementById('secondHand') };
let state = null;

function formatDuration(seconds) {
  const value = Math.max(0, Math.round(Number(seconds) || 0));
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const remainder = value % 60;
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}` : `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

function remaining(timer) { return timer?.active && timer.endAt > Date.now() ? Math.ceil((timer.endAt - Date.now()) / 1000) : (timer?.pausedRemaining || 0); }

function renderClock(utilities) {
  const now = new Date();
  elements.clock.textContent = utilities.showClock ? new Intl.DateTimeFormat(undefined, {
    hour: 'numeric', minute: '2-digit', ...(utilities.showSeconds ? { second: '2-digit' } : {}), hour12: !utilities.use24Hour,
  }).format(now) : '';
  const seconds = now.getSeconds();
  const minutes = now.getMinutes() + seconds / 60;
  const hours = (now.getHours() % 12) + minutes / 60;
  elements.hourHand.style.transform = `translateX(-50%) rotate(${hours * 30}deg)`;
  elements.minuteHand.style.transform = `translateX(-50%) rotate(${minutes * 6}deg)`;
  elements.secondHand.style.transform = `translateX(-50%) rotate(${seconds * 6}deg)`;
  elements.secondHand.hidden = utilities.showSeconds !== true;
  elements.analogClock.setAttribute('aria-label', elements.clock.textContent || 'Analog clock');
}

function render(nextState) {
  if (!nextState) return;
  state = nextState;
  const utilities = state.utilities || {};
  const timer = utilities.timer || {};
  document.documentElement.style.setProperty('--clock-opacity', String(utilities.clockOpacity ?? 0.94));
  document.documentElement.style.setProperty('--timer-opacity', String(utilities.timerOpacity ?? 0.94));
  renderClock(utilities);
  elements.timer.textContent = formatDuration(remaining(timer));
  elements.timerLabel.textContent = timer.active ? 'COUNTDOWN' : 'TIMER';
  elements.alert.hidden = !utilities.alert;
  elements.widget.classList.toggle('clock-only', utilities.showClock && utilities.showTimer === false);
  elements.widget.classList.toggle('timer-only', !utilities.showClock && utilities.showTimer !== false);
  elements.widget.classList.toggle('is-analog', utilities.showClock && utilities.clockStyle === 'analog');
  elements.widget.classList.toggle('is-locked', state.settings?.locked !== false);
}

setInterval(() => { if (state) render(state); }, 250);
window.nowLayer.onState(render);
window.nowLayer.getState().then(render).catch(console.error);
