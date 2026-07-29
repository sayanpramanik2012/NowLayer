(function exposeTimeline(root) {
  function projectPosition(media = {}, now = Date.now()) {
    const duration = Math.max(0, Number(media.duration) || 0);
    const basePosition = Math.max(0, Number(media.position) || 0);
    const sampledAt = Number(media.sampledAt);
    const playing = String(media.status).toLowerCase() === 'playing';
    const elapsed = playing && Number.isFinite(sampledAt)
      ? Math.max(0, (now - sampledAt) / 1000)
      : 0;
    const projected = basePosition + elapsed;
    return duration > 0 ? Math.min(duration, projected) : projected;
  }

  const api = Object.freeze({ projectPosition });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.nowLayerTimeline = api;
}(typeof window === 'undefined' ? globalThis : window));
