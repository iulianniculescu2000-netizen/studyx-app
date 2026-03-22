const { app, BrowserWindow, ipcMain, shell, dialog, Notification, Tray, nativeImage, Menu, session } = require('electron');
const path = require('path');
const fs = require('fs');
const { registerUpdaterIPC } = require('./updater.cjs');

const isDev = !app.isPackaged;

// ── GPU disk-cache suppression ───────────────────────────────────────────────
// Prevents "Unable to move the cache: Access is denied" (0x5) errors that
// appear when the OS or another process temporarily holds the GPU shader-cache
// directory lock.  These are harmless but pollute the console.
// Must be called before app.whenReady().
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');

// ── 1. Dev vs Prod userData isolation ───────────────────────────────────────
// Must be called before app.whenReady() and before any app.getPath('userData') call
if (!app.isPackaged) {
  const devData = path.join(app.getPath('appData'), 'StudyX-Dev');
  app.setPath('userData', devData);
}

let mainWindow = null;
let tray = null;

function createWindow() {
  // Resolve icon path — works both in dev and in packaged builds
  const iconPath = path.join(__dirname, '../public/icon.png');

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 880,
    minWidth: 1000,
    minHeight: 660,
    frame: false,
    backgroundColor: '#1a1a2e', // near-black purple — matches Obsidian theme bg, hides flash
    titleBarStyle: 'hidden',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    show: false,
  });

  // Show window only after React signals readiness (eliminates white flash)
  ipcMain.once('app:ready', () => mainWindow?.show());
  // Fallback: show after 4s if app:ready never fires (e.g. blank-page crash)
  setTimeout(() => { if (mainWindow && !mainWindow.isVisible()) mainWindow.show(); }, 4000);

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Window state IPC
  ipcMain.on('win:minimize', () => mainWindow?.minimize());
  ipcMain.on('win:maximize', () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize();
    else mainWindow?.maximize();
  });
  ipcMain.on('win:close', () => mainWindow?.close());
  ipcMain.handle('win:isMaximized', () => mainWindow?.isMaximized() ?? false);

  mainWindow.on('maximize', () => mainWindow?.webContents.send('win:maximized', true));
  mainWindow.on('unmaximize', () => mainWindow?.webContents.send('win:maximized', false));

  // Minimize to tray on close
  mainWindow.on('close', (e) => {
    if (tray) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  // File import IPC
  ipcMain.handle('dialog:openJson', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'JSON Files', extensions: ['json'] }],
    });
    if (result.canceled) return null;
    const files = result.filePaths.map((p) => ({
      name: path.basename(p),
      content: fs.readFileSync(p, 'utf-8'),
    }));
    return files;
  });

  // Save file dialog — for backup export
  ipcMain.handle('dialog:saveFile', async (_, { defaultPath, content }) => {
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (result.canceled || !result.filePath) return false;
    fs.writeFileSync(result.filePath, content, 'utf-8');
    return true;
  });

  // PDF import IPC — returns extracted text content using pdf-parse
  ipcMain.handle('dialog:openPdf', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    const filePath = result.filePaths[0];
    try {
      const pdfParse = require('pdf-parse');
      const buffer = fs.readFileSync(filePath);
      const data = await pdfParse(buffer);
      const text = data.text.replace(/\s+/g, ' ').trim();
      return text.length > 100 ? text : null;
    } catch (err) {
      // Fallback: regex extraction for encrypted/unusual PDFs
      const buffer = fs.readFileSync(filePath);
      const raw = buffer.toString('latin1');
      const textChunks = [];
      const parenRe = /\(([^)\\]{1,500})\)\s*(?:Tj|TJ|'|")/g;
      let m;
      while ((m = parenRe.exec(raw)) !== null) {
        const t = m[1].replace(/\\n/g, '\n').replace(/\\r/g, '').replace(/\\\\/g, '\\').replace(/\\([0-7]{3})/g, (_, o) => String.fromCharCode(parseInt(o, 8)));
        if (t.trim().length > 2) textChunks.push(t);
      }
      const text = textChunks.join(' ').replace(/\s+/g, ' ').trim();
      return text.length > 100 ? text : null;
    }
  });

  // Image import IPC — returns base64 data URL
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
    const data = fs.readFileSync(filePath);
    return `data:${mime};base64,${data.toString('base64')}`;
  });

  // Screenshot protection toggle
  ipcMain.handle('win:setContentProtection', (_, enabled) => {
    mainWindow?.setContentProtection(enabled);
    return true;
  });

  // Hardware acceleration setting (stored in userData, applied on next launch)
  ipcMain.handle('app:setHardwareAccel', (_, enabled) => {
    const settingsPath = path.join(app.getPath('userData'), 'settings.json');
    let settings = {};
    try { settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8')); } catch {}
    settings.hardwareAccel = enabled;
    fs.writeFileSync(settingsPath, JSON.stringify(settings), 'utf-8');
    return true;
  });

  // Get current settings
  ipcMain.handle('app:getSettings', () => {
    const settingsPath = path.join(app.getPath('userData'), 'settings.json');
    try { return JSON.parse(fs.readFileSync(settingsPath, 'utf-8')); } catch { return {}; }
  });

  // ── 4. Hard Reset — wipe all app data and relaunch ───────────────────────
  ipcMain.handle('app:hardReset', async () => {
    try {
      // Clear renderer localStorage / IndexedDB / cache
      await mainWindow?.webContents.session.clearStorageData({
        storages: ['localstorage', 'indexdb', 'cookies', 'cachestorage', 'shadercache'],
      });
      // Remove userData directory contents (settings, sentinel, etc.)
      const ud = app.getPath('userData');
      for (const entry of fs.readdirSync(ud)) {
        const full = path.join(ud, entry);
        try {
          const stat = fs.statSync(full);
          if (stat.isDirectory()) fs.rmSync(full, { recursive: true, force: true });
          else fs.unlinkSync(full);
        } catch {}
      }
    } catch (e) {
      console.warn('[StudyX] Hard reset cleanup error:', e);
    }
    app.relaunch();
    app.quit();
    return true;
  });

  // Save file as CSV (for Anki export)
  ipcMain.handle('dialog:saveCsv', async (_, { defaultPath, content }) => {
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath,
      filters: [{ name: 'CSV', extensions: ['csv'] }],
    });
    if (result.canceled || !result.filePath) return false;
    fs.writeFileSync(result.filePath, content, 'utf-8');
    return true;
  });

  // ── Auto-Backup: write a dated JSON snapshot to Documents/StudyX-Backups ──
  ipcMain.handle('app:autoBackup', async (_, { data }) => {
    try {
      const docsPath = app.getPath('documents');
      const backupDir = path.join(docsPath, 'StudyX-Backups');
      fs.mkdirSync(backupDir, { recursive: true });

      // Keep only the latest 10 backups (rotating)
      const existing = fs.readdirSync(backupDir)
        .filter(f => f.startsWith('studyx-backup-') && f.endsWith('.json'))
        .sort();
      while (existing.length >= 10) {
        try { fs.unlinkSync(path.join(backupDir, existing.shift())); } catch {}
      }

      const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const filePath = path.join(backupDir, `studyx-backup-${dateStr}.json`);
      fs.writeFileSync(filePath, data, 'utf-8');

      return { success: true, path: filePath };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
}

// Daily study reminder — fires once per day if user hasn't studied
function scheduleDailyReminder() {
  if (!Notification.isSupported()) return;

  const checkAndNotify = () => {
    const today = new Date().toISOString().split('T')[0];
    const stored = app.getPath('userData') + '/last-notified.txt';
    let lastNotified = '';
    try { lastNotified = fs.readFileSync(stored, 'utf-8').trim(); } catch {}
    if (lastNotified === today) return;

    // Read localStorage from renderer to check last study date
    if (mainWindow) {
      mainWindow.webContents.executeJavaScript(`
        (() => {
          try {
            const stats = JSON.parse(localStorage.getItem('studyx-stats') || '{}');
            return stats?.state?.streak?.lastStudyDate ?? '';
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

  // Check 5s after launch then every hour
  setTimeout(checkAndNotify, 5000);
  setInterval(checkAndNotify, 60 * 60 * 1000);
}

// Apply hardware acceleration setting from previous session
try {
  const settingsPath = path.join(app.getPath('userData'), 'settings.json');
  const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
  if (settings.hardwareAccel === false) {
    app.disableHardwareAcceleration();
  }
} catch {}

app.whenReady().then(async () => {
  // ── 3. First-run check — wipe stale renderer storage on fresh install ──────
  const sentinelPath = path.join(app.getPath('userData'), '.first-run');
  if (!fs.existsSync(sentinelPath)) {
    try {
      await session.defaultSession.clearStorageData({
        storages: ['localstorage', 'indexdb', 'cookies', 'cachestorage'],
      });
    } catch (e) {
      console.warn('[StudyX] First-run clear failed:', e);
    }
    fs.mkdirSync(app.getPath('userData'), { recursive: true });
    fs.writeFileSync(sentinelPath, new Date().toISOString());
  }

  createWindow();
  scheduleDailyReminder();
  registerUpdaterIPC(mainWindow);

  // System tray
  try {
    const trayIconPath = path.join(__dirname, '../public/icon.png');
    if (!fs.existsSync(trayIconPath)) throw new Error('icon.png not found');
    const trayIcon = nativeImage.createFromPath(trayIconPath).resize({ width: 16, height: 16 });
    tray = new Tray(trayIcon);
    const contextMenu = Menu.buildFromTemplate([
      { label: 'Deschide StudyX', click: () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } } },
      { type: 'separator' },
      { label: 'Închide', click: () => app.quit() },
    ]);
    tray.setToolTip('StudyX');
    tray.setContextMenu(contextMenu);
    tray.on('click', () => { if (mainWindow) { if (mainWindow.isVisible()) mainWindow.hide(); else mainWindow.show(); } });
  } catch {}
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
