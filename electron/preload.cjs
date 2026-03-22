const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  minimize: () => ipcRenderer.send('win:minimize'),
  maximize: () => ipcRenderer.send('win:maximize'),
  close: () => ipcRenderer.send('win:close'),
  isMaximized: () => ipcRenderer.invoke('win:isMaximized'),
  onMaximized: (cb) => {
    ipcRenderer.on('win:maximized', (_, v) => cb(v));
    return () => ipcRenderer.removeAllListeners('win:maximized');
  },
  // File dialogs
  openJsonFiles: () => ipcRenderer.invoke('dialog:openJson'),
  openImageFile: () => ipcRenderer.invoke('dialog:openImage'),
  openPdfFile: () => ipcRenderer.invoke('dialog:openPdf'),
  saveFile: (opts) => ipcRenderer.invoke('dialog:saveFile', opts),
  // Updater
  updaterCheck: () => ipcRenderer.invoke('updater:check'),
  updaterDownload: (manifest) => ipcRenderer.invoke('updater:download', manifest),
  updaterRestart: () => ipcRenderer.invoke('updater:restart'),
  updaterGetVersion: () => ipcRenderer.invoke('updater:getVersion'),
  onUpdateProgress: (cb) => {
    const handler = (_, data) => cb(data);
    ipcRenderer.on('updater:progress', handler);
    return () => ipcRenderer.removeListener('updater:progress', handler);
  },
  // Content protection (exam mode screenshot block)
  setContentProtection: (enabled) => ipcRenderer.invoke('win:setContentProtection', enabled),
  // App settings
  setHardwareAccel: (enabled) => ipcRenderer.invoke('app:setHardwareAccel', enabled),
  getSettings: () => ipcRenderer.invoke('app:getSettings'),
  // CSV export (Anki)
  saveCsvFile: (opts) => ipcRenderer.invoke('dialog:saveCsv', opts),
  // Hard reset (wipe all data + relaunch)
  hardReset: () => ipcRenderer.invoke('app:hardReset'),
  // Signal Electron that React is ready (used to avoid white flash on startup)
  appReady: () => ipcRenderer.send('app:ready'),
  // Auto-backup: write all app data to Documents/StudyX-Backups
  autoBackup: (data) => ipcRenderer.invoke('app:autoBackup', { data }),
  isElectron: true,
});
