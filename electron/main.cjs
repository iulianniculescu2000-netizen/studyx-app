console.log('[StudyX] Main process starting...');
const { app, BrowserWindow, ipcMain, shell, dialog, Notification, Tray, nativeImage, Menu, session } = require('electron');
const path = require('path');
const fs = require('fs');
const { registerUpdaterIPC } = require('./updater.cjs');

const isDev = !app.isPackaged;

// ── GPU disk-cache suppression ───────────────────────────────────────────────
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');

// ── 1. Dev vs Prod userData isolation ───────────────────────────────────────
if (!app.isPackaged) {
  const devData = path.join(app.getPath('appData'), 'StudyX-Dev');
  app.setPath('userData', devData);
}

let mainWindow = null;
let tray = null;

// ── Helper Functions ────────────────────────────────────────────────────────

const extractPdfText = async (filePath) => {
  const regexFallback = (buffer) => {
    const raw = buffer.toString('latin1');
    const textChunks = [];
    const arrayRe = /\[((?:\([^)]*\)|-?\d+(?:\.\d+)?|\s+)+)\]\s*TJ/g;
    let m;
    while ((m = arrayRe.exec(raw)) !== null) {
      const content = m[1];
      const innerParenRe = /\(([^)]*)\)/g;
      while ((innerParenRe.exec(content)) !== null) {
        let t = RegExp.$1.replace(/\\([0-7]{3})/g, (_, o) => String.fromCharCode(parseInt(o, 8)))
                         .replace(/\\n/g, '\n').replace(/\\r/g, '').replace(/\\\\/g, '\\');
        if (t.trim().length > 0) textChunks.push(t);
      }
    }
    const parenRe = /\(([^)\\]*(?:\\.[^)\\]*)*)\)\s*(?:Tj|'|")/g;
    while ((m = parenRe.exec(raw)) !== null) {
      let t = m[1]
        .replace(/\\([0-7]{3})/g, (_, o) => String.fromCharCode(parseInt(o, 8)))
        .replace(/\\n/g, '\n').replace(/\\r/g, '').replace(/\\\\/g, '\\')
        .replace(/\\(.)/g, '$1');
      if (t.trim().length > 0) textChunks.push(t);
    }
    const hexRe = /<([0-9A-Fa-f]{2,})>/g;
    while ((m = hexRe.exec(raw)) !== null) {
      try {
        const hex = m[1];
        let decoded = '';
        for (let i = 0; i < hex.length; i += 2) {
          const charCode = parseInt(hex.substr(i, 2), 16);
          if (charCode >= 32) decoded += String.fromCharCode(charCode);
        }
        if (decoded.trim().length > 1) textChunks.push(decoded);
      } catch (e) {}
    }
    return textChunks.join(' ').replace(/\s+/g, ' ').trim();
  };

  try {
    const pdfParse = require('pdf-parse');
    const buffer = fs.readFileSync(filePath);
    const options = {
      pagerender: (pageData) => {
        return pageData.getTextContent().then(textContent => {
          let lastY, text = '';
          for (let item of textContent.items) {
            if (lastY === item.transform[5] || !lastY) text += item.str;
            else text += '\n' + item.str;
            lastY = item.transform[5];
          }
          return text;
        });
      }
    };
    const data = await pdfParse(buffer, options);
    const pdfText = data.text.replace(/\s+/g, ' ').trim();
    const fallbackText = regexFallback(buffer);
    const result = pdfText.length > fallbackText.length ? pdfText : fallbackText;
    return result.length > 50 ? result : null;
  } catch (err) {
    try {
      const buffer = fs.readFileSync(filePath);
      const fallback = regexFallback(buffer);
      return fallback.length > 50 ? fallback : null;
    } catch { return null; }
  }
};

const extractDocxText = async (filePath) => {
  try {
    const mammoth = require('mammoth');
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value.trim();
  } catch (e) {
    console.error('Error extracting docx:', e);
    return null;
  }
};

const extractOCRText = async (filePath) => {
  try {
    const { createWorker } = require('tesseract.js');
    const worker = await createWorker('ron');
    const ret = await worker.recognize(filePath);
    await worker.terminate();
    return ret.data.text.trim();
  } catch (e) {
    console.error('OCR Error:', e);
    return null;
  }
};

// ── IPC Handlers Registration ──────────────────────────────────────────────

function registerIpcHandlers() {
  // Window controls
  ipcMain.on('win:minimize', () => mainWindow?.minimize());
  ipcMain.on('win:maximize', () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize();
    else mainWindow?.maximize();
  });
  ipcMain.on('win:close', () => mainWindow?.close());
  ipcMain.handle('win:isMaximized', () => mainWindow?.isMaximized() ?? false);

  // File import IPCs
  ipcMain.handle('dialog:openJson', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'JSON Files', extensions: ['json'] }],
    });
    if (result.canceled) return null;
    return result.filePaths.map((p) => ({
      name: path.basename(p),
      content: fs.readFileSync(p, 'utf-8'),
    }));
  });

  ipcMain.handle('dialog:saveFile', async (_, { defaultPath, content }) => {
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (result.canceled || !result.filePath) return false;
    fs.writeFileSync(result.filePath, content, 'utf-8');
    return true;
  });

  ipcMain.handle('dialog:openPdf', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return extractPdfText(result.filePaths[0]);
  });

  ipcMain.handle('pdf:readPath', async (_, filePath) => extractPdfText(filePath));

  ipcMain.handle('dialog:openDocx', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [{ name: 'Word Documents', extensions: ['docx'] }],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return extractDocxText(result.filePaths[0]);
  });

  ipcMain.handle('docx:readPath', async (_, filePath) => extractDocxText(filePath));

  ipcMain.handle('dialog:openOCRImage', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp', 'bmp'] }],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return extractOCRText(result.filePaths[0]);
  });

  ipcMain.handle('image:readOCR', async (_, filePath) => extractOCRText(filePath));

  ipcMain.handle('dialog:openText', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [
        { name: 'Text Files', extensions: ['txt', 'md', 'markdown'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return fs.readFileSync(result.filePaths[0], 'utf-8');
  });

  // Base64 image import
  ipcMain.handle('dialog:openImage', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'] }],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    const filePath = result.filePaths[0];
    const ext = path.extname(filePath).toLowerCase().slice(1);
    const mimeMap = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp' };
    const mime = mimeMap[ext] || 'image/jpeg';
    return `data:${mime};base64,${fs.readFileSync(filePath).toString('base64')}`;
  });

  // Settings & System
  ipcMain.handle('win:setContentProtection', (_, enabled) => {
    mainWindow?.setContentProtection(enabled);
    return true;
  });

  ipcMain.handle('app:setHardwareAccel', (_, enabled) => {
    const settingsPath = path.join(app.getPath('userData'), 'settings.json');
    let settings = {};
    try { settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8')); } catch {}
    settings.hardwareAccel = enabled;
    fs.writeFileSync(settingsPath, JSON.stringify(settings), 'utf-8');
    return true;
  });

  ipcMain.handle('app:getSettings', () => {
    const settingsPath = path.join(app.getPath('userData'), 'settings.json');
    try { return JSON.parse(fs.readFileSync(settingsPath, 'utf-8')); } catch { return {}; }
  });

  ipcMain.handle('app:hardReset', async () => {
    try {
      await session.defaultSession.clearStorageData();
      const ud = app.getPath('userData');
      for (const entry of fs.readdirSync(ud)) {
        const full = path.join(ud, entry);
        if (entry === 'settings.json') continue; // Optional: keep settings or wipe them too
        try {
          const stat = fs.statSync(full);
          if (stat.isDirectory()) fs.rmSync(full, { recursive: true, force: true });
          else fs.unlinkSync(full);
        } catch {}
      }
    } catch (e) { console.warn('[StudyX] Hard reset error:', e); }
    app.relaunch();
    app.quit();
    return true;
  });

  ipcMain.handle('dialog:saveCsv', async (_, { defaultPath, content }) => {
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath,
      filters: [{ name: 'CSV', extensions: ['csv'] }],
    });
    if (result.canceled || !result.filePath) return false;
    fs.writeFileSync(result.filePath, content, 'utf-8');
    return true;
  });

  ipcMain.handle('app:autoBackup', async (_, { data }) => {
    try {
      const backupDir = path.join(app.getPath('documents'), 'StudyX-Backups');
      fs.mkdirSync(backupDir, { recursive: true });
      const existing = fs.readdirSync(backupDir).filter(f => f.startsWith('studyx-backup-')).sort();
      while (existing.length >= 10) fs.unlinkSync(path.join(backupDir, existing.shift()));
      const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const filePath = path.join(backupDir, `studyx-backup-${dateStr}.json`);
      fs.writeFileSync(filePath, data, 'utf-8');
      return { success: true, path: filePath };
    } catch (e) { return { success: false, error: e.message }; }
  });

  ipcMain.once('app:ready', () => mainWindow?.show());
}

// ── Main Functions ───────────────────────────────────────────────────────────

function createWindow() {
  const iconPath = path.join(__dirname, '../public/icon.png');

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 880,
    minWidth: 1000,
    minHeight: 660,
    frame: false,
    backgroundColor: '#1a1a2e',
    titleBarStyle: 'hidden',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    show: false,
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
    mainWindow.webContents.on('console-message', (_, level, message, line, sourceId) => {
      if (level >= 2) console.error(`[Renderer] ${message} (${sourceId}:${line})`);
    });
    // Fallback: show window after 3s even if app:ready never fires
    setTimeout(() => { if (mainWindow && !mainWindow.isVisible()) mainWindow.show(); }, 3000);
  } else {
    const overlayHtml = path.join(app.getPath('userData'), 'app-overlay', 'files', 'dist', 'index.html');
    const loadPath = fs.existsSync(overlayHtml) ? overlayHtml : path.join(__dirname, '../dist/index.html');
    mainWindow.loadFile(loadPath);
  }

  mainWindow.on('maximize', () => mainWindow?.webContents.send('win:maximized', true));
  mainWindow.on('unmaximize', () => mainWindow?.webContents.send('win:maximized', false));
  mainWindow.on('close', () => { app.quit(); });

  // Re-register updater IPC for the new window
  registerUpdaterIPC(mainWindow);
}

function scheduleDailyReminder() {
  if (!Notification.isSupported()) return;
  const checkAndNotify = () => {
    const today = new Date().toISOString().split('T')[0];
    const stored = path.join(app.getPath('userData'), 'last-notified.txt');
    let lastNotified = '';
    try { lastNotified = fs.readFileSync(stored, 'utf-8').trim(); } catch {}
    if (lastNotified === today) return;

    if (mainWindow) {
      mainWindow.webContents.executeJavaScript(`
        (() => {
          try {
            const activeRaw = localStorage.getItem('studyx-user');
            const activeState = activeRaw ? JSON.parse(activeRaw)?.state ?? JSON.parse(activeRaw) : null;
            const profileId = activeState?.activeProfileId;
            if (profileId) {
              const perProfileRaw = localStorage.getItem(\`studyx-p-\${profileId}-stats\`);
              if (perProfileRaw) {
                const perProfile = JSON.parse(perProfileRaw);
                return perProfile?.streak?.lastStudyDate ?? perProfile?.state?.streak?.lastStudyDate ?? '';
              }
            }
            return '';
          } catch { return ''; }
        })()
      `).then(lastStudy => {
        if (lastStudy !== today) {
          new Notification({
            title: '📚 StudyX — Ai studiat azi?',
            body: 'Nu uita să-ți faci sesiunea de grile de azi! Menține streak-ul! 🔥',
          }).show();
          fs.writeFileSync(stored, today);
        }
      }).catch(() => {});
    }
  };
  setTimeout(checkAndNotify, 5000);
  setInterval(checkAndNotify, 60 * 60 * 1000);
}

// ── App Lifecycle ────────────────────────────────────────────────────────────

// Apply hardware acceleration
try {
  const settingsPath = path.join(app.getPath('userData'), 'settings.json');
  if (JSON.parse(fs.readFileSync(settingsPath, 'utf-8')).hardwareAccel === false) {
    app.disableHardwareAcceleration();
  }
} catch {}

// Single instance lock
if (!app.requestSingleInstanceLock()) {
  console.log('[StudyX] Another instance is already running, quitting...');
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.focus(); }
  });

  app.whenReady().then(async () => {
    // First-run cleanup
    const ud = app.getPath('userData');
    const sentinelPath = path.join(ud, '.first-run');
    if (!fs.existsSync(sentinelPath)) {
      try { await session.defaultSession.clearStorageData(); } catch {}
      if (!fs.existsSync(ud)) fs.mkdirSync(ud, { recursive: true });
      fs.writeFileSync(sentinelPath, new Date().toISOString());
    }

    console.log('[StudyX] App is ready, registering handlers and creating window...');
    registerIpcHandlers();
    createWindow();
    scheduleDailyReminder();

    // Tray
    try {
      const trayIcon = nativeImage.createFromPath(path.join(__dirname, '../public/icon.png')).resize({ width: 16, height: 16 });
      tray = new Tray(trayIcon);
      tray.setContextMenu(Menu.buildFromTemplate([
        { label: 'Deschide StudyX', click: () => mainWindow?.show() },
        { type: 'separator' },
        { label: 'Închide', click: () => app.quit() },
      ]));
      tray.on('click', () => mainWindow?.show());
    } catch {}
  });
}

app.on('window-all-closed', () => { 
  console.log('[StudyX] All windows closed, quitting app...');
  if (process.platform !== 'darwin') app.quit(); 
});
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
