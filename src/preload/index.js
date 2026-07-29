const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('nowLayer', Object.freeze({
  getState: () => ipcRenderer.invoke('nowlayer:get-state'),
  setSetting: (key, value) => ipcRenderer.invoke('nowlayer:set-setting', key, value),
  mediaAction: (action) => ipcRenderer.invoke('nowlayer:media-action', action),
  listCaptureSources: () => ipcRenderer.invoke('nowlayer:list-capture-sources'),
  setCaptureSource: (sourceId) => ipcRenderer.invoke('nowlayer:set-capture-source', sourceId),
  stopCapture: () => ipcRenderer.invoke('nowlayer:stop-capture'),
  reportVideoError: (message) => ipcRenderer.invoke('nowlayer:video-error', message),
  copyDiagnostics: () => ipcRenderer.invoke('nowlayer:copy-diagnostics'),
  resetSettings: () => ipcRenderer.invoke('nowlayer:reset-settings'),
  onState: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('nowlayer:state', listener);
    return () => ipcRenderer.removeListener('nowlayer:state', listener);
  },
}));
