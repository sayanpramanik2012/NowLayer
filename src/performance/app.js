const widget = document.getElementById('widget');
const view = window.NowLayerPerformanceView.mount(widget);
let latest = null;
function render(data) { latest = data; view.render(data); }
function settings(state) {
  widget.classList.toggle('is-locked', state.settings?.locked !== false);
  view.configure(state.settings?.performance);
}
window.nowLayer.onPerformance(render);
window.nowLayer.onState(settings);
window.nowLayer.getState().then(state => { settings(state); render(state.performance); }).catch(console.error);
setInterval(() => { if (latest && Date.now() - latest.sampledAt >= 4000) render(latest); }, 1000);
