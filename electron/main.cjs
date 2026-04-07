console.log('[StudyX] Main process starting...');
const { app, BrowserWindow, ipcMain, shell, dialog, Notification, Tray, nativeImage, Menu, session, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const fsp = require('fs').promises;
const { fork } = require('child_process');
const { registerUpdaterIPC } = require('./updater.cjs');

const isDev = !app.isPackaged;
const sharedUserDataPath = path.join(app.getPath('appData'), 'StudyX');
const legacyDevUserDataPath = path.join(app.getPath('appData'), 'StudyX-Dev');

app.setPath('userData', sharedUserDataPath);
app.setAppUserModelId('com.studyx.app');

// ── GPU disk-cache suppression ───────────────────────────────────────────────
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');

// ── 1. Dev vs Prod userData isolation ───────────────────────────────────────
let mainWindow = null;
let tray = null;
let isQuitting = false;
let saveWindowStateTimer = null;
async function pathExists(targetPath) {
  try {
    await fsp.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function getDirectorySize(targetPath) {
  if (!(await pathExists(targetPath))) return 0;
  const entries = await fsp.readdir(targetPath, { withFileTypes: true });
  let total = 0;
  for (const entry of entries) {
    const fullPath = path.join(targetPath, entry.name);
    if (entry.isDirectory()) total += await getDirectorySize(fullPath);
    else {
      try {
        const stat = await fsp.stat(fullPath);
        total += stat.size;
      } catch {}
    }
  }
  return total;
}

async function profileDataScore(baseDir) {
  const profilesDir = path.join(baseDir, 'profiles');
  if (!(await pathExists(profilesDir))) return 0;
  const entries = await fsp.readdir(profilesDir, { withFileTypes: true });
  const profileDirs = entries.filter((entry) => entry.isDirectory()).length;
  const profileBytes = await getDirectorySize(profilesDir);
  return profileDirs * 1000000 + profileBytes;
}

async function copyRecursive(sourceDir, targetDir) {
  await fsp.mkdir(targetDir, { recursive: true });
  const entries = await fsp.readdir(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      await copyRecursive(sourcePath, targetPath);
    } else {
      await fsp.copyFile(sourcePath, targetPath);
    }
  }
}

async function migrateLegacyUserData() {
  if (!(await pathExists(legacyDevUserDataPath))) return;

  const currentScore = await profileDataScore(sharedUserDataPath);
  const legacyScore = await profileDataScore(legacyDevUserDataPath);
  if (legacyScore <= currentScore) return;

  const importantEntries = [
    '.first-run',
    'Local Storage',
    'Session Storage',
    'WebStorage',
    'IndexedDB',
    'profiles',
    'Preferences',
    'Local State',
    'settings.json',
    'last-notified.txt',
  ];

  await fsp.mkdir(sharedUserDataPath, { recursive: true });
  for (const entry of importantEntries) {
    const sourcePath = path.join(legacyDevUserDataPath, entry);
    const targetPath = path.join(sharedUserDataPath, entry);
    if (!(await pathExists(sourcePath))) continue;

    if (await pathExists(targetPath)) {
      try {
        const stat = await fsp.stat(targetPath);
        if (stat.isDirectory()) await fsp.rm(targetPath, { recursive: true, force: true });
        else await fsp.unlink(targetPath);
      } catch {}
    }

    const sourceStat = await fsp.stat(sourcePath);
    if (sourceStat.isDirectory()) await copyRecursive(sourcePath, targetPath);
    else await fsp.copyFile(sourcePath, targetPath);
  }

  console.log('[StudyX] Migrated richer data set from legacy StudyX-Dev storage.');
}

async function writeJsonAtomically(filePath, serialized) {
  const tempPath = `${filePath}.tmp`;
  await fsp.writeFile(tempPath, serialized, 'utf-8');
  await fsp.rename(tempPath, filePath);
}

async function markCorruptFile(filePath) {
  try {
    const corruptPath = `${filePath}.corrupt-${Date.now()}`;
    await fsp.rename(filePath, corruptPath);
    console.warn(`[Storage] Marked corrupt file: ${corruptPath}`);
  } catch (err) {
    console.error('[Storage] Failed to mark corrupt file:', err);
  }
}

function getAppIconPath() {
  const icoPath = path.join(__dirname, '../public/icon.ico');
  const pngPath = path.join(__dirname, '../public/icon.png');
  if (fs.existsSync(icoPath)) return icoPath;
  if (fs.existsSync(pngPath)) return pngPath;
  return undefined;
}

function getWindowStatePath() {
  return path.join(app.getPath('userData'), 'window-state.json');
}

function getAdaptiveWindowMetrics() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const area = primaryDisplay.workArea;
  const margin = Math.max(20, Math.round(Math.min(area.width, area.height) * 0.03));
  const width = Math.max(820, Math.min(1440, area.width - margin * 2));
  const height = Math.max(620, Math.min(920, area.height - margin * 2));

  return {
    width,
    height,
    x: area.x + Math.round((area.width - width) / 2),
    y: area.y + Math.round((area.height - height) / 2),
    shouldMaximize: area.width < 1360 || area.height < 820,
  };
}

function clampBoundsToDisplay(bounds) {
  const fallback = getAdaptiveWindowMetrics();
  const targetBounds = bounds ?? fallback;
  const display = screen.getDisplayMatching({
    x: targetBounds.x ?? fallback.x,
    y: targetBounds.y ?? fallback.y,
    width: targetBounds.width ?? fallback.width,
    height: targetBounds.height ?? fallback.height,
  });
  const area = display.workArea;
  const width = Math.max(720, Math.min(targetBounds.width ?? fallback.width, area.width));
  const height = Math.max(520, Math.min(targetBounds.height ?? fallback.height, area.height));
  const x = Math.min(Math.max(targetBounds.x ?? fallback.x, area.x), area.x + area.width - width);
  const y = Math.min(Math.max(targetBounds.y ?? fallback.y, area.y), area.y + area.height - height);

  return { x, y, width, height };
}

function readWindowState() {
  try {
    if (!fs.existsSync(getWindowStatePath())) return null;
    const raw = fs.readFileSync(getWindowStatePath(), 'utf-8');
    const parsed = JSON.parse(raw);
    return clampBoundsToDisplay(parsed);
  } catch {
    return null;
  }
}

function getBundledVersion() {
  try {
    return app.getVersion?.() || '1.0.0';
  } catch {
    try {
      const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf-8'));
      return packageJson.version || '1.0.0';
    } catch {
      return '1.0.0';
    }
  }
}

function compareVersionParts(a, b) {
  const parse = (value) => String(value || '0.0.0').replace(/^v/, '').split('.').map((part) => Number(part) || 0);
  const [a1 = 0, a2 = 0, a3 = 0] = parse(a);
  const [b1 = 0, b2 = 0, b3 = 0] = parse(b);
  if (a1 !== b1) return a1 - b1;
  if (a2 !== b2) return a2 - b2;
  return a3 - b3;
}

function getPreferredRendererEntry() {
  const bundledHtml = path.join(__dirname, '../dist/index.html');
  const overlayRoot = path.join(app.getPath('userData'), 'app-overlay');
  const overlayHtml = path.join(overlayRoot, 'files', 'dist', 'index.html');
  const overlayManifest = path.join(overlayRoot, 'manifest.json');

  if (!fs.existsSync(overlayHtml) || !fs.existsSync(overlayManifest)) {
    return bundledHtml;
  }

  try {
    const manifest = JSON.parse(fs.readFileSync(overlayManifest, 'utf-8'));
    const overlayVersion = manifest?.version;
    const bundledVersion = getBundledVersion();
    if (!overlayVersion || compareVersionParts(overlayVersion, bundledVersion) < 0) {
      return bundledHtml;
    }
    return overlayHtml;
  } catch {
    return bundledHtml;
  }
}

function persistWindowState(win) {
  try {
    if (!win || win.isDestroyed() || win.isMinimized() || win.isMaximized()) return;
    const bounds = clampBoundsToDisplay(win.getBounds());
    fs.writeFileSync(getWindowStatePath(), JSON.stringify(bounds), 'utf-8');
  } catch (err) {
    console.error('[WindowState] Failed to persist bounds:', err);
  }
}

function scheduleWindowStateSave(win) {
  if (saveWindowStateTimer) clearTimeout(saveWindowStateTimer);
  saveWindowStateTimer = setTimeout(() => persistWindowState(win), 180);
}

function ensureWindowFitsDisplay(win) {
  if (!win || win.isDestroyed() || win.isMaximized() || win.isMinimized()) return;
  const nextBounds = clampBoundsToDisplay(win.getBounds());
  const current = win.getBounds();
  const changed = current.x !== nextBounds.x
    || current.y !== nextBounds.y
    || current.width !== nextBounds.width
    || current.height !== nextBounds.height;
  if (changed) win.setBounds(nextBounds);
}

// ── Helper Functions ────────────────────────────────────────────────────────

const PDF_JOB_TIMEOUT_MS = 12000;
let pdfQueue = Promise.resolve();

function queuePdfJob(task) {
  const job = pdfQueue.then(task, task);
  pdfQueue = job.then(() => undefined, () => undefined);
  return job;
}

function runPdfWorker(payload, timeoutMs = PDF_JOB_TIMEOUT_MS) {
  return new Promise((resolve) => {
    const workerPath = path.join(__dirname, 'pdf-worker.cjs');
    const child = fork(workerPath, { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
    let settled = false;

    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      child.removeAllListeners('message');
      child.removeAllListeners('error');
      child.removeAllListeners('exit');
      try {
        if (child.connected) child.disconnect();
      } catch {}
      resolve(typeof result === 'string' && result.trim().length > 0 ? result : null);
    };

    const timeout = setTimeout(() => {
      console.warn('[PDF] Worker timed out and will be terminated.');
      try {
        child.kill();
      } catch {}
      finish(null);
    }, timeoutMs);

    child.on('message', (message) => {
      if (!message || typeof message !== 'object') return;
      if (message.type === 'result') {
        finish(message.text ?? null);
        return;
      }
      if (message.type === 'log') {
        console.warn(message.message);
        return;
      }
      if (message.type === 'error') {
        console.error('[PDF] Worker failed:', message.message);
        finish(null);
      }
    });

    child.on('error', (error) => {
      console.error('[PDF] Worker process error:', error);
      finish(null);
    });

    child.on('exit', (code, signal) => {
      if (!settled && code !== 0) {
        console.warn(`[PDF] Worker exited unexpectedly (code=${code}, signal=${signal}).`);
      }
      finish(null);
    });

    try {
      child.send(payload);
    } catch (error) {
      console.error('[PDF] Failed to start worker job:', error);
      try {
        child.kill();
      } catch {}
      finish(null);
    }
  });
}

const extractPdfText = async (filePath) => {
  return queuePdfJob(async () => {
    try {
      await fsp.access(filePath);
      return await runPdfWorker({ filePath });
    } catch {
      return null;
    }
  });
};

const extractPdfTextFromBuffer = async (buffer) => {
  if (!buffer || buffer.length === 0) return null;
  return queuePdfJob(() => runPdfWorker({ bufferBase64: buffer.toString('base64') }));
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

let ocrWorkerPromise = null;
let ocrQueue = Promise.resolve();

async function getOCRWorker() {
  if (!ocrWorkerPromise) {
    const { createWorker } = require('tesseract.js');
    ocrWorkerPromise = createWorker('ron');
  }
  return ocrWorkerPromise;
}

async function runOCRJob(filePath) {
  const worker = await getOCRWorker();
  const result = await worker.recognize(filePath);
  return result?.data?.text?.trim() || null;
}

const extractOCRText = async (filePath) => {
  const job = ocrQueue.then(async () => {
    try {
      return await runOCRJob(filePath);
    } catch (e) {
      console.error('OCR Error:', e);
      return null;
    }
  });

  ocrQueue = job.then(() => undefined, () => undefined);
  return job;
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

  ipcMain.handle('pdf:readBuffer', async (_, bufferLike) => {
    try {
      const buffer = Buffer.isBuffer(bufferLike)
        ? bufferLike
        : bufferLike instanceof Uint8Array
          ? Buffer.from(bufferLike)
          : bufferLike instanceof ArrayBuffer
            ? Buffer.from(bufferLike)
            : Array.isArray(bufferLike)
              ? Buffer.from(bufferLike)
              : null;
      if (!buffer || buffer.length === 0) return null;

      return await extractPdfTextFromBuffer(buffer);
    } catch (err) {
      console.error('[PDF] Invalid buffer payload:', err);
      return null;
    }
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
      await writeJsonAtomically(filePath, serialized);
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
      } catch (err) {
        if (err instanceof SyntaxError) {
          await markCorruptFile(filePath);
          return { __corrupt: true, __namespace: safeNs };
        }
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
  const iconPath = getAppIconPath();
  const adaptiveMetrics = getAdaptiveWindowMetrics();
  const savedBounds = readWindowState();
  const initialBounds = savedBounds ?? {
    x: adaptiveMetrics.x,
    y: adaptiveMetrics.y,
    width: adaptiveMetrics.width,
    height: adaptiveMetrics.height,
  };

  mainWindow = new BrowserWindow({
    ...initialBounds,
    minWidth: 720,
    minHeight: 520,
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
    const loadPath = getPreferredRendererEntry();
    mainWindow.loadFile(loadPath);
  }

  mainWindow.once('ready-to-show', () => {
    if (!savedBounds && adaptiveMetrics.shouldMaximize) {
      mainWindow?.maximize();
    }
  });
  mainWindow.on('maximize', () => mainWindow?.webContents.send('win:maximized', true));
  mainWindow.on('unmaximize', () => mainWindow?.webContents.send('win:maximized', false));
  mainWindow.on('resize', () => scheduleWindowStateSave(mainWindow));
  mainWindow.on('move', () => scheduleWindowStateSave(mainWindow));
  mainWindow.on('blur', () => persistWindowState(mainWindow));
  
  // Handle window close: allow renderer to save state first
  mainWindow.on('close', (e) => {
    if (mainWindow && !isQuitting) {
      e.preventDefault();
      mainWindow.webContents.send('app:request-close');
    }
  });

  screen.on('display-metrics-changed', () => ensureWindowFitsDisplay(mainWindow));
  screen.on('display-added', () => ensureWindowFitsDisplay(mainWindow));
  screen.on('display-removed', () => ensureWindowFitsDisplay(mainWindow));

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
    await migrateLegacyUserData();
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
      const trayIcon = nativeImage.createFromPath(getAppIconPath() || '').resize({ width: 16, height: 16 });
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
app.on('before-quit', async () => {
  try {
    if (ocrWorkerPromise) {
      const worker = await ocrWorkerPromise;
      await worker.terminate();
      ocrWorkerPromise = null;
    }
  } catch {}
});
