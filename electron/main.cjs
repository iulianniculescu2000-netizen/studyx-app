console.log('[StudyX] Main process starting...');
const { app, BrowserWindow, ipcMain, shell, dialog, Notification, Tray, nativeImage, Menu, session } = require('electron');
const path = require('path');
const fs = require('fs');
const fsp = require('fs').promises;
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
let isQuitting = false;

// ── Helper Functions ────────────────────────────────────────────────────────

const extractPdfText = async (filePath) => {
  // Optimized: Use a promise to keep UI responsive
  return new Promise(async (resolve) => {
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
      return textChunks.join(' ').replace(/\s+/g, ' ').trim();
    };

    try {
      const pdfParse = require('pdf-parse');
      const buffer = await fsp.readFile(filePath);
      pdfParse(buffer).then(data => {
        const pdfText = data.text.replace(/\s+/g, ' ').trim();
        const fallbackText = regexFallback(buffer);
        const result = pdfText.length > fallbackText.length ? pdfText : fallbackText;
        resolve(result.length > 10 ? result : null);
      }).catch(() => {
        const fallback = regexFallback(buffer);
        resolve(fallback.length > 10 ? fallback : null);
      });
    } catch (err) {
      resolve(null);
    }
  });
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
  
  // Custom close button click
  ipcMain.on('win:close', () => {
    mainWindow?.close();
  });

  // Final exit after data is saved
  ipcMain.on('win:destroy', () => {
    isQuitting = true;
    mainWindow?.close();
  });

  ipcMain.handle('win:isMaximized', () => mainWindow?.isMaximized() ?? false);

  // File import IPCs
  ipcMain.handle('dialog:openJson', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'JSON Files', extensions: ['json'] }],
    });
    if (result.canceled) return null;
    const contents = await Promise.all(result.filePaths.map(async (p) => ({
      name: path.basename(p),
      content: await fsp.readFile(p, 'utf-8'),
    })));
    return contents;
  });

  ipcMain.handle('dialog:saveFile', async (_, { defaultPath, content }) => {
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (result.canceled || !result.filePath) return false;
    await fsp.writeFile(result.filePath, content, 'utf-8');
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

  ipcMain.handle('pdf:readPath', async (_, filePath) => {
    if (!filePath || !filePath.toLowerCase().endsWith('.pdf')) return null;
    try {
      await fsp.access(filePath);
      return extractPdfText(filePath);
    } catch { return null; }
  });

  ipcMain.handle('dialog:openDocx', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [{ name: 'Word Documents', extensions: ['docx'] }],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return extractDocxText(result.filePaths[0]);
  });

  ipcMain.handle('docx:readPath', async (_, filePath) => {
    if (!filePath || !filePath.toLowerCase().endsWith('.docx')) return null;
    try {
      await fsp.access(filePath);
      return extractDocxText(filePath);
    } catch { return null; }
  });

  ipcMain.handle('dialog:openOCRImage', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp', 'bmp'] }],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return extractOCRText(result.filePaths[0]);
  });

  ipcMain.handle('image:readOCR', async (_, filePath) => {
    const validExts = ['.jpg', '.jpeg', '.png', '.webp', '.bmp'];
    const ext = path.extname(filePath).toLowerCase();
    if (!filePath || !validExts.includes(ext)) return null;
    try {
      await fsp.access(filePath);
      return extractOCRText(filePath);
    } catch { return null; }
  });

  ipcMain.handle('dialog:openText', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [
        { name: 'Text Files', extensions: ['txt', 'md', 'markdown'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return fsp.readFile(result.filePaths[0], 'utf-8');
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
    const buffer = await fsp.readFile(filePath);
    return `data:${mime};base64,${buffer.toString('base64')}`;
  });

  // Settings & System
  ipcMain.handle('win:setContentProtection', (_, enabled) => {
    mainWindow?.setContentProtection(enabled);
    return true;
  });

  ipcMain.handle('app:setHardwareAccel', async (_, enabled) => {
    const settingsPath = path.join(app.getPath('userData'), 'settings.json');
    let settings = {};
    try { 
      const data = await fsp.readFile(settingsPath, 'utf-8');
      settings = JSON.parse(data); 
    } catch {}
    settings.hardwareAccel = enabled;
    await fsp.writeFile(settingsPath, JSON.stringify(settings), 'utf-8');
    return true;
  });

  ipcMain.handle('app:getSettings', async () => {
    const settingsPath = path.join(app.getPath('userData'), 'settings.json');
    try { 
      const data = await fsp.readFile(settingsPath, 'utf-8');
      return JSON.parse(data); 
    } catch { return {}; }
  });

  ipcMain.handle('app:hardReset', async () => {
    try {
      await session.defaultSession.clearStorageData();
      const ud = app.getPath('userData');
      const entries = await fsp.readdir(ud);
      for (const entry of entries) {
        const full = path.join(ud, entry);
        if (entry === 'settings.json') continue;
        try {
          const stat = await fsp.stat(full);
          if (stat.isDirectory()) await fsp.rm(full, { recursive: true, force: true });
          else await fsp.unlink(full);
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
    await fsp.writeFile(result.filePath, content, 'utf-8');
    return true;
  });

  ipcMain.handle('app:autoBackup', async (_, { data }) => {
    try {
      const backupDir = path.join(app.getPath('documents'), 'StudyX-Backups');
      await fsp.mkdir(backupDir, { recursive: true });
      const files = await fsp.readdir(backupDir);
      const existing = files.filter(f => f.startsWith('studyx-backup-')).sort();
      while (existing.length >= 10) {
        const toDelete = existing.shift();
        if (toDelete) await fsp.unlink(path.join(backupDir, toDelete));
      }
      const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const filePath = path.join(backupDir, `studyx-backup-${dateStr}.json`);
      await fsp.writeFile(filePath, data, 'utf-8');
      return { success: true, path: filePath };
    } catch (e) { return { success: false, error: e.message }; }
  });

  // Persistent Disk Storage for Profiles (Fixes 5MB LocalStorage limit)
  ipcMain.handle('storage:save', async (_, { profileId, namespace, data }) => {
    try {
      const safeId = profileId.replace(/[^a-z0-9_-]/gi, '_');
      const safeNs = namespace.replace(/[^a-z0-9_-]/gi, '_');
      const serialized = JSON.stringify(data);
      // Increased limit to 500MB for large image-heavy quiz sets
      if (serialized.length > 500 * 1024 * 1024) throw new Error('Data too large (>500MB)');
      const storageDir = path.join(app.getPath('userData'), 'profiles', safeId);
      await fsp.mkdir(storageDir, { recursive: true });
      const filePath = path.join(storageDir, `${safeNs}.json`);
      await fsp.writeFile(filePath, serialized, 'utf-8');
      return true;
    } catch (err) {
      console.error('[Storage] Save error:', err);
      return false;
    }
  });

  ipcMain.handle('storage:load', async (_, { profileId, namespace }) => {
    try {
      const safeId = profileId.replace(/[^a-z0-9_-]/gi, '_');
      const safeNs = namespace.replace(/[^a-z0-9_-]/gi, '_');
      const filePath = path.join(app.getPath('userData'), 'profiles', safeId, `${safeNs}.json`);
      try {
        const data = await fsp.readFile(filePath, 'utf-8');
        return JSON.parse(data);
      } catch {
        return null;
      }
    } catch (err) {
      console.error('[Storage] Load error:', err);
      return null;
    }
  });

  ipcMain.once('app:ready', () => mainWindow?.show());
}

// ── Main Functions ───────────────────────────────────────────────────────────

function createWindow() {
  const icoPath = path.join(__dirname, '../public/icon.ico');
  const pngPath = path.join(__dirname, '../public/icon.png');
  const iconPath = fs.existsSync(icoPath) ? icoPath : (fs.existsSync(pngPath) ? pngPath : undefined);

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
    icon: iconPath,
    show: false,
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
    mainWindow.webContents.on('console-message', (_, level, message, line, sourceId) => {
      if (level >= 2) console.error(`[Renderer] ${message} (${sourceId}:${line})`);
    });
    setTimeout(() => { if (mainWindow && !mainWindow.isVisible()) mainWindow.show(); }, 3000);
  } else {
    const overlayHtml = path.join(app.getPath('userData'), 'app-overlay', 'files', 'dist', 'index.html');
    const loadPath = fs.existsSync(overlayHtml) ? overlayHtml : path.join(__dirname, '../dist/index.html');
    mainWindow.loadFile(loadPath);
  }

  mainWindow.on('maximize', () => mainWindow?.webContents.send('win:maximized', true));
  mainWindow.on('unmaximize', () => mainWindow?.webContents.send('win:maximized', false));
  
  // Handle window close: allow renderer to save state first
  mainWindow.on('close', (e) => {
    if (mainWindow && !isQuitting) {
      e.preventDefault();
      mainWindow.webContents.send('app:request-close');
    }
  });

  registerUpdaterIPC(mainWindow);
}

function scheduleDailyReminder() {
  if (!Notification.isSupported()) return;
  const checkAndNotify = async () => {
    const today = new Date().toISOString().split('T')[0];
    const stored = path.join(app.getPath('userData'), 'last-notified.txt');
    let lastNotified = '';
    try { 
      lastNotified = (await fsp.readFile(stored, 'utf-8')).trim(); 
    } catch {}
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
      `).then(async (lastStudy) => {
        if (lastStudy !== today) {
          new Notification({
            title: '📚 StudyX — Ai studiat azi?',
            body: 'Nu uita să-ți faci sesiunea de grile de azi! Menține streak-ul! 🔥',
          }).show();
          try { await fsp.writeFile(stored, today); } catch {}
        }
      }).catch(() => {});
    }
  };
  setTimeout(checkAndNotify, 5000);
  setInterval(checkAndNotify, 60 * 60 * 1000);
}

// ── App Lifecycle ────────────────────────────────────────────────────────────

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    const ud = app.getPath('userData');
    const sentinelPath = path.join(ud, '.first-run');
    try {
      await fsp.access(sentinelPath);
    } catch {
      // First run or file missing
      try { await session.defaultSession.clearStorageData(); } catch {}
      try { await fsp.mkdir(ud, { recursive: true }); } catch {}
      await fsp.writeFile(sentinelPath, new Date().toISOString());
    }
    registerIpcHandlers();
    createWindow();
    scheduleDailyReminder();
    try {
      const trayIcon = nativeImage.createFromPath(path.join(__dirname, '../public/icon.ico')).resize({ width: 16, height: 16 });
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

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
