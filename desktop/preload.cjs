const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('colorRemoverDesktopUpdater', {
  checkForUpdates: () => ipcRenderer.invoke('desktop-updater:check'),
  installUpdate: () => ipcRenderer.invoke('desktop-updater:install'),
  onUpdateEvent: (callback) => {
    if (typeof callback !== 'function') return () => {};

    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('desktop-updater:event', listener);

    return () => {
      ipcRenderer.removeListener('desktop-updater:event', listener);
    };
  },
});
