const elements = { widget: document.getElementById('widget'), clock: document.getElementById('clock'), timer: document.getElementById('timer'), timerLabel: document.getElementById('timerLabel'), alert: document.getElementById('alert') };
let state = null;

function formatDuration(seconds) {
  const value = Math.max(0, Math.round(Number(seconds) || 0));
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const remainder = value % 60;
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}` : `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

function remaining(timer) { return timer?.active && timer.endAt > Date.now() ? Math.ceil((timer.endAt - Date.now()) / 1000) : (timer?.pausedRemaining || 0); }

function render(nextState) {
  if (!nextState) return;
  state = nextState;
  const utilities = state.utilities || {};
  const timer = utilities.timer || {};
  elements.clock.textContent = utilities.showClock ? new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date()) : '--:--';
  elements.timer.textContent = formatDuration(remaining(timer));
  elements.timerLabel.textContent = timer.active ? 'COUNTDOWN' : 'TIMER';
  elements.alert.hidden = !utilities.alert;
  elements.widget.classList.toggle('is-locked', state.settings?.locked !== false);
}

setInterval(() => { if (state) render(state); }, 250);
window.nowLayer.onState(render);
window.nowLayer.getState().then(render).catch(console.error);
