/**
 * StudyX Updater v2 — robust, professional update system
 *
 * Fixes vs v1:
 *  - Proper User-Agent on all requests
 *  - Cache-busting on manifest fetch (prevents CDN stale cache)
 *  - Socket destroyed on timeout (no leaked connections)
 *  - Protocol auto-detected on each redirect hop
 *  - Retry logic (2 attempts per file)
 *  - Gzip decompression support
 *  - Progress reported per-file + overall
 *  - Detailed error messages sent to renderer
 *  - File size validation after download
 *  - Atomic write with .tmp + rename/copy fallback
 */

const { ipcMain, app } = require('electron');
const https = require('https');
const http = require('http');
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

// ── Configuration ──────────────────────────────────────────────────────────────
const MANIFEST_URL = 'https://raw.githubusercontent.com/iulianniculescu2000-netizen/studyx-updates/main/version.json';
const USER_AGENT = 'StudyX-Updater/2.0 (Electron; Windows)';
const CONNECT_TIMEOUT_MS = 20000;
const DOWNLOAD_TIMEOUT_MS = 90000;
const MAX_RETRIES = 2;

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Compare semver strings. Returns true if remote > local. */
function isNewerVersion(local, remote) {
  const parse = (v) => v.replace(/^v/, '').split('.').map(Number);
  const [la, lb, lc] = parse(local);
  const [ra, rb, rc] = parse(remote);
  if (ra !== la) return ra > la;
  if (rb !== lb) return rb > lb;
  return rc > lc;
}

/** Get the right http/https module for a URL */
function getProtocol(url) {
  return url.startsWith('https') ? https : http;
}

/** Fetch text from a URL, following redirects, with proper timeout and User-Agent */
function fetchText(url, attempt = 0) {
  return new Promise((resolve, reject) => {
    // Cache-bust: append timestamp so CDN doesn't return stale manifest
    const finalUrl = url.includes('?') ? `${url}&_ts=${Date.now()}` : `${url}?_ts=${Date.now()}`;

    const protocol = getProtocol(finalUrl);
    const req = protocol.get(finalUrl, {
      timeout: CONNECT_TIMEOUT_MS,
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json, text/plain',
        'Cache-Control': 'no-cache',
        'Accept-Encoding': 'gzip, deflate',
      },
    }, (res) => {
      // Follow redirects (up to 5 hops)
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        if (attempt >= 5) { reject(new Error('Prea multe redirecturi')); return; }
        res.resume(); // Consume response to free socket
        fetchText(res.headers.location, attempt + 1).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`Server a returnat ${res.statusCode} pentru manifest`));
        return;
      }

      // Handle gzip/deflate response
      let stream = res;
      const encoding = res.headers['content-encoding'];
      if (encoding === 'gzip') stream = res.pipe(zlib.createGunzip());
      else if (encoding === 'deflate') stream = res.pipe(zlib.createInflate());

      let data = '';
      stream.on('data', (chunk) => (data += chunk));
      stream.on('end', () => resolve(data));
      stream.on('error', reject);
    });

    req.on('timeout', () => {
      req.destroy(new Error('Conexiunea a expirat (timeout manifest)'));
    });
    req.on('error', (err) => {
      reject(new Error(`Eroare rețea manifest: ${err.message}`));
    });
  });
}

/**
 * Download a URL to a destination file.
 * Reports progress (0-100) via onProgress(percent, bytesReceived, totalBytes).
 * Retries up to MAX_RETRIES times on failure.
 */
function downloadFile(url, destPath, onProgress, attempt = 0) {
  return new Promise((resolve, reject) => {
    const tmpPath = destPath + '.studyx.tmp';

    const doDownload = (targetUrl, hop = 0) => {
      const protocol = getProtocol(targetUrl);
      const req = protocol.get(targetUrl, {
        timeout: DOWNLOAD_TIMEOUT_MS,
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': '*/*',
          'Accept-Encoding': 'identity', // No compression — we want raw bytes
          'Cache-Control': 'no-cache',
        },
      }, (res) => {
        // Follow redirects
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          if (hop >= 5) { reject(new Error('Prea multe redirecturi la download')); return; }
          res.resume();
          doDownload(res.headers.location, hop + 1);
          return;
        }
        if (res.statusCode !== 200) {
          res.resume();
          reject(new Error(`Server a returnat ${res.statusCode} pentru ${path.basename(destPath)}`));
          return;
        }

        const total = parseInt(res.headers['content-length'] || '0', 10);
        let received = 0;

        // Ensure parent directory exists
        try { fs.mkdirSync(path.dirname(tmpPath), { recursive: true }); } catch {}

        const file = fs.createWriteStream(tmpPath);

        res.on('data', (chunk) => {
          received += chunk.length;
          if (onProgress) {
            const pct = total > 0 ? Math.round((received / total) * 100) : -1;
            onProgress(pct, received, total);
          }
        });

        res.on('error', (err) => {
          file.destroy();
          fs.unlink(tmpPath, () => {});
          reject(new Error(`Eroare stream download: ${err.message}`));
        });

        res.pipe(file);

        file.on('finish', () => {
          file.close(() => {
            // Validate: file must have content
            let stat;
            try { stat = fs.statSync(tmpPath); } catch (e) {
              reject(new Error(`Fișierul descărcat lipsește: ${e.message}`));
              return;
            }
            if (stat.size < 100) {
              fs.unlink(tmpPath, () => {});
              reject(new Error(`Fișier descărcat invalid (${stat.size} bytes) — posibil blocat de antivirus`));
              return;
            }

            // Atomic rename (fallback to copy+delete on Windows permission error)
            fs.rename(tmpPath, destPath, (err) => {
              if (err) {
                try {
                  fs.copyFileSync(tmpPath, destPath);
                  fs.unlinkSync(tmpPath);
                  resolve(stat.size);
                } catch (e2) {
                  reject(new Error(`Nu s-a putut scrie fișierul: ${e2.message}. Încearcă să rulezi ca Administrator.`));
                }
              } else {
                resolve(stat.size);
              }
            });
          });
        });

        file.on('error', (err) => {
          res.destroy();
          fs.unlink(tmpPath, () => {});
          reject(new Error(`Eroare scriere fișier: ${err.message}`));
        });
      });

      req.on('timeout', () => {
        req.destroy(new Error('Download expirat (timeout)'));
      });
      req.on('error', (err) => {
        fs.unlink(tmpPath, () => {});
        if (attempt < MAX_RETRIES - 1) {
          // Retry
          setTimeout(() => {
            downloadFile(url, destPath, onProgress, attempt + 1)
              .then(resolve).catch(reject);
          }, 1500 * (attempt + 1));
        } else {
          reject(new Error(`Descărcare eșuată după ${MAX_RETRIES} încercări: ${err.message}`));
        }
      });
    };

    doDownload(url);
  });
}

/** Get the app root (where dist/ and electron/ live) — read-only in Program Files installs. */
function getAppRoot() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'app');
  }
  return path.join(__dirname, '..');
}

/**
 * Overlay dir in writable userData — used instead of app root for updates.
 * Avoids EPERM when app is installed in C:\Program Files\.
 */
function getOverlayRoot() {
  return path.join(app.getPath('userData'), 'app-overlay');
}

/** Recursively copy a directory (read from any location, write to userData). */
function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDirSync(s, d);
    else fs.copyFileSync(s, d);
  }
}

/**
 * Read local version — overlay manifest takes priority over package.json.
 * This ensures the displayed version matches the running code after an in-place update.
 */
function getLocalVersion() {
  try {
    const overlayManifest = path.join(getOverlayRoot(), 'manifest.json');
    if (fs.existsSync(overlayManifest)) {
      const m = JSON.parse(fs.readFileSync(overlayManifest, 'utf-8'));
      if (m.version) return m.version;
    }
  } catch {}
  try {
    const pkgPath = path.join(getAppRoot(), 'package.json');
    return JSON.parse(fs.readFileSync(pkgPath, 'utf-8')).version || '1.0.0';
  } catch {
    return '1.0.0';
  }
}

// ── IPC Handlers ───────────────────────────────────────────────────────────────

let mainWindowRef = null;

function sendToRenderer(event, data) {
  try {
    if (mainWindowRef && !mainWindowRef.isDestroyed()) {
      mainWindowRef.webContents.send(event, data);
    }
  } catch {}
}

function registerUpdaterIPC(mainWindow) {
  mainWindowRef = mainWindow;

  // Remove any previously registered handlers (safety for HMR / reloads)
  try { ipcMain.removeHandler('updater:check'); } catch {}
  try { ipcMain.removeHandler('updater:download'); } catch {}
  try { ipcMain.removeHandler('updater:restart'); } catch {}
  try { ipcMain.removeHandler('updater:getVersion'); } catch {}

  /** Check for updates */
  ipcMain.handle('updater:check', async () => {
    const localVersion = getLocalVersion();
    let raw;
    try {
      raw = await fetchText(MANIFEST_URL);
    } catch (err) {
      throw new Error(`Nu s-a putut contacta serverul de actualizări: ${err.message}`);
    }

    let manifest;
    try {
      manifest = JSON.parse(raw);
    } catch {
      throw new Error('Răspuns invalid de la serverul de actualizări (JSON malformat)');
    }

    if (!manifest.version) {
      throw new Error('Manifest invalid — câmpul "version" lipsește');
    }

    const hasUpdate = isNewerVersion(localVersion, manifest.version);
    return {
      hasUpdate,
      version: manifest.version,
      releaseDate: manifest.releaseDate ?? '',
      changes: manifest.changes ?? [],
      localVersion,
      files: manifest.files ?? [],
    };
  });

  /**
   * Download and stage update files in userData (always writable).
   *
   * Strategy — avoids EPERM on Program Files installs:
   *   1. Bootstrap overlay: copy the entire dist/ from install dir to
   *      userData/app-overlay/files/dist/ (read from any location ✓)
   *   2. Download changed files on top of the overlay (write to userData ✓)
   *   3. Save manifest.json to overlay so getLocalVersion() returns new version
   *
   * On restart, main.cjs loads index.html from the overlay instead of
   * the install directory — no admin rights needed, ever.
   */
  ipcMain.handle('updater:download', async (_, manifest) => {
    const files = manifest.files ?? [];
    if (files.length === 0) throw new Error('Manifestul nu conține fișiere de actualizat');

    const overlayRoot  = getOverlayRoot();
    const overlayDist  = path.join(overlayRoot, 'files', 'dist');
    const installDist  = path.join(getAppRoot(), 'dist');

    // ── Step 1: Bootstrap overlay with full dist/ copy (first update only) ──
    if (!fs.existsSync(overlayDist) && fs.existsSync(installDist)) {
      sendToRenderer('updater:progress', { percent: 2, file: 'Pregătire overlay...', received: 0, total: 0 });
      try { copyDirSync(installDist, overlayDist); } catch (e) {
        throw new Error(`Nu s-a putut crea overlay-ul local: ${e.message}`);
      }
    }

    // ── Step 2: Download changed files into overlay ───────────────────────
    let done = 0;
    for (const file of files) {
      const destPath = path.join(overlayRoot, 'files', file.path);
      try {
        await downloadFile(file.url, destPath, (pct, received, total) => {
          const overall = Math.round(((done + (pct > 0 ? pct / 100 : 0.5)) / files.length) * 90) + 5;
          sendToRenderer('updater:progress', {
            percent: Math.min(overall, 97),
            file: path.basename(file.path),
            received,
            total,
          });
        });
        done++;
        sendToRenderer('updater:progress', {
          percent: Math.round((done / files.length) * 90) + 5,
          file: path.basename(file.path),
          received: -1,
          total: -1,
        });
      } catch (err) {
        throw new Error(`Eroare la ${path.basename(file.path)}: ${err.message}`);
      }
    }

    // ── Step 3: Save overlay manifest (version source of truth) ──────────
    try {
      fs.writeFileSync(
        path.join(overlayRoot, 'manifest.json'),
        JSON.stringify({ version: manifest.version, files: manifest.files }),
        'utf-8',
      );
    } catch (e) {
      throw new Error(`Nu s-a putut salva manifestul local: ${e.message}`);
    }

    sendToRenderer('updater:progress', { percent: 100, file: 'Gata!', received: -1, total: -1 });
    return true;
  });

  /**
   * Restart app — overlay is already in place, main.cjs picks it up automatically.
   * No file-copy needed at this stage (already done during download).
   */
  ipcMain.handle('updater:restart', () => {
    app.relaunch();
    app.quit();
  });

  /** Get local version */
  ipcMain.handle('updater:getVersion', () => getLocalVersion());
}

module.exports = { registerUpdaterIPC };
