const path = require('node:path');

function normalizePerformance(value = {}) {
  value = value && typeof value === 'object' ? value : {};
  const executable = typeof value.presentMonPath === 'string' ? value.presentMonPath : '';
  const game = typeof value.processName === 'string' ? value.processName.trim() : '';
  return {
    enabled: value.enabled === true,
    opacity: Number.isFinite(value.opacity) ? Math.min(1, Math.max(.3, value.opacity)) : .94,
    anchor: ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'manual'].includes(value.anchor) ? value.anchor : 'top-left',
    x: Number.isFinite(value.x) ? Math.round(value.x) : null,
    y: Number.isFinite(value.y) ? Math.round(value.y) : null,
    gpuId: typeof value.gpuId === 'string' ? value.gpuId.slice(0, 256) : '',
    presentMonPath: executable.length <= 1024 && path.win32.isAbsolute(executable) && /\.exe$/i.test(executable) && !/[\0\r\n]/.test(executable) ? executable : '',
    processName: game.length <= 260 && /^[^\\/:*?"<>|\x00-\x1f]+\.exe$/i.test(game) && !game.startsWith('-') ? game : '',
  };
}

module.exports = { normalizePerformance };
