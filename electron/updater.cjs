/**
 * StudyX updater.
 *
 * Supports two delivery modes:
 * - overlay: updates dist assets in userData/app-overlay
 * - installer: downloads the full installer for packaged builds
 */

const { ipcMain, app, shell } = require('electron');
const https = require('https');
const http = require('http');
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MANIFEST_URL = 'https://raw.githubusercontent.com/iulianniculescu2000-netizen/studyx-updates/main/version.json';
const HISTORY_URL = 'https://raw.githubusercontent.com/iulianniculescu2000-netizen/studyx-updates/main/version-history.json';
const USER_AGENT = 'StudyX-Updater/3.0 (Electron; Windows)';
const CONNECT_TIMEOUT_MS = 20000;
const DOWNLOAD_TIMEOUT_MS = 90000;
const MAX_RETRIES = 2;

function resolveRedirectUrl(baseUrl, location) {
  try {
    return new URL(location, baseUrl).toString();
  } catch {
    return location;
  }
}

function isNewerVersion(local, remote) {
  const parse = (v) => String(v || '0.0.0').replace(/^v/, '').split('.').map(Number);
  const [la = 0, lb = 0, lc = 0] = parse(local);
  const [ra = 0, rb = 0, rc = 0] = parse(remote);
  if (ra !== la) return ra > la;
  if (rb !== lb) return rb > lb;
  return rc > lc;
}

function compareVersion(a, b) {
  const parse = (v) => String(v || '0.0.0').replace(/^v/, '').split('.').map(Number);
  const [a1 = 0, a2 = 0, a3 = 0] = parse(a);
  const [b1 = 0, b2 = 0, b3 = 0] = parse(b);
  if (a1 !== b1) return a1 < b1 ? -1 : 1;
  if (a2 !== b2) return a2 < b2 ? -1 : 1;
  if (a3 !== b3) return a3 < b3 ? -1 : 1;
  return 0;
}

function getProtocol(url) {
  return url.startsWith('https') ? https : http;
}

function fetchText(url, attempt = 0) {
  return new Promise((resolve, reject) => {
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
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        if (attempt >= 5) {
          reject(new Error('Prea multe redirecturi'));
          return;
        }
        res.resume();
        fetchText(resolveRedirectUrl(finalUrl, res.headers.location), attempt + 1).then(resolve).catch(reject);
        return;
      }

      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`Serverul a returnat ${res.statusCode}`));
        return;
      }

      let stream = res;
      const encoding = res.headers['content-encoding'];
      if (encoding === 'gzip') stream = res.pipe(zlib.createGunzip());
      else if (encoding === 'deflate') stream = res.pipe(zlib.createInflate());

      let data = '';
      stream.on('data', (chunk) => { data += chunk; });
      stream.on('end', () => resolve(data));
      stream.on('error', reject);
    });

    req.on('timeout', () => req.destroy(new Error('Conexiunea a expirat')));
    req.on('error', (err) => reject(new Error(`Eroare retea: ${err.message}`)));
  });
}

async function fetchJson(url) {
  return JSON.parse(await fetchText(url));
}

function downloadFile(url, destPath, onProgress, attempt = 0) {
  return new Promise((resolve, reject) => {
    const tmpPath = `${destPath}.studyx.tmp`;

    const doDownload = (targetUrl, hop = 0) => {
      const protocol = getProtocol(targetUrl);
      const req = protocol.get(targetUrl, {
        timeout: DOWNLOAD_TIMEOUT_MS,
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': '*/*',
          'Accept-Encoding': 'identity',
          'Cache-Control': 'no-cache',
        },
      }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          if (hop >= 5) {
            reject(new Error('Prea multe redirecturi la download'));
            return;
          }
          res.resume();
          doDownload(resolveRedirectUrl(targetUrl, res.headers.location), hop + 1);
          return;
        }

        if (res.statusCode !== 200) {
          res.resume();
          reject(new Error(`Serverul a returnat ${res.statusCode} pentru ${path.basename(destPath)}`));
          return;
        }

        const total = parseInt(res.headers['content-length'] || '0', 10);
        let received = 0;
        fs.mkdirSync(path.dirname(tmpPath), { recursive: true });
        const file = fs.createWriteStream(tmpPath);

        res.on('data', (chunk) => {
          received += chunk.length;
          if (onProgress) {
            const percent = total > 0 ? Math.round((received / total) * 100) : -1;
            onProgress(percent, received, total);
          }
        });

        res.on('error', (err) => {
          file.destroy();
          fs.unlink(tmpPath, () => {});
          reject(new Error(`Eroare stream: ${err.message}`));
        });

        res.pipe(file);

        file.on('finish', () => {
          file.close(() => {
            let stat;
            try {
              stat = fs.statSync(tmpPath);
            } catch (err) {
              reject(new Error(`Fisierul descarcat lipseste: ${err.message}`));
              return;
            }

            if (stat.size < 100) {
              fs.unlink(tmpPath, () => {});
              reject(new Error(`Fisier descarcat invalid (${stat.size} bytes)`));
              return;
            }

            fs.rename(tmpPath, destPath, (renameErr) => {
              if (!renameErr) {
                resolve(stat.size);
                return;
              }

              try {
                fs.copyFileSync(tmpPath, destPath);
                fs.unlinkSync(tmpPath);
                resolve(stat.size);
              } catch (copyErr) {
                reject(new Error(`Nu s-a putut scrie fisierul: ${copyErr.message}`));
              }
            });
          });
        });

        file.on('error', (err) => {
          res.destroy();
          fs.unlink(tmpPath, () => {});
          reject(new Error(`Eroare scriere fisier: ${err.message}`));
        });
      });

      req.on('timeout', () => req.destroy(new Error('Download expirat')));
      req.on('error', (err) => {
        fs.unlink(tmpPath, () => {});
        if (attempt < MAX_RETRIES - 1) {
          setTimeout(() => {
            downloadFile(url, destPath, onProgress, attempt + 1).then(resolve).catch(reject);
          }, 1500 * (attempt + 1));
        } else {
          reject(new Error(`Descarcarea a esuat dupa ${MAX_RETRIES} incercari: ${err.message}`));
        }
      });
    };

    doDownload(url);
  });
}

function getAppRoot() {
  return app.isPackaged ? path.join(process.resourcesPath, 'app') : path.join(__dirname, '..');
}

function getOverlayRoot() {
  return path.join(app.getPath('userData'), 'app-overlay');
}

function getInstallerDownloadDir() {
  return path.join(app.getPath('userData'), 'installer-updates');
}

function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const sourcePath = path.join(src, entry.name);
    const targetPath = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDirSync(sourcePath, targetPath);
    else fs.copyFileSync(sourcePath, targetPath);
  }
}

function sanitizeDownloadName(name, fallbackName) {
  const clean = String(name || fallbackName || 'StudyX-Setup.exe').replace(/[^a-z0-9._ -]/gi, '_').trim();
  return clean.toLowerCase().endsWith('.exe') ? clean : `${clean}.exe`;
}

function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

function normalizeManifest(rawManifest) {
  const manifest = rawManifest && typeof rawManifest === 'object' ? rawManifest : {};
  const installer = manifest.installer && typeof manifest.installer === 'object' ? manifest.installer : null;
  const delivery = app.isPackaged && installer?.url ? 'installer' : 'overlay';
  return {
    version: manifest.version,
    latestVersion: manifest.latestVersion ?? manifest.version,
    releaseDate: manifest.releaseDate ?? '',
    changes: Array.isArray(manifest.changes) ? manifest.changes : [],
    files: Array.isArray(manifest.files) ? manifest.files : [],
    contentUpdates: Array.isArray(manifest.contentUpdates) ? manifest.contentUpdates : [],
    installer,
    delivery,
  };
}

function getLocalVersion() {
  try {
    const overlayManifest = path.join(getOverlayRoot(), 'manifest.json');
    if (fs.existsSync(overlayManifest)) {
      const manifest = JSON.parse(fs.readFileSync(overlayManifest, 'utf-8'));
      if (manifest.version) return manifest.version;
    }
  } catch {}

  try {
    const packageJson = JSON.parse(fs.readFileSync(path.join(getAppRoot(), 'package.json'), 'utf-8'));
    return packageJson.version || '1.0.0';
  } catch {
    return '1.0.0';
  }
}

let mainWindowRef = null;

function sendToRenderer(event, data) {
  try {
    if (mainWindowRef && !mainWindowRef.isDestroyed()) {
      mainWindowRef.webContents.send(event, data);
    }
  } catch {}
}

async function downloadInstaller(manifest) {
  const installer = manifest?.installer;
  if (!installer?.url) throw new Error('Manifestul nu contine installerul complet.');

  const downloadDir = getInstallerDownloadDir();
  const fileName = sanitizeDownloadName(
    installer.fileName,
    path.basename(new URL(installer.url).pathname) || `StudyX-Setup-${manifest.version || 'latest'}.exe`,
  );
  const destPath = path.join(downloadDir, fileName);

  fs.mkdirSync(downloadDir, { recursive: true });

  await downloadFile(installer.url, destPath, (percent, received, total) => {
    sendToRenderer('updater:progress', {
      percent: percent > 0 ? percent : 50,
      file: fileName,
      received,
      total,
    });
  });

  if (installer.sha256) {
    const hash = await sha256File(destPath);
    if (hash.toLowerCase() !== String(installer.sha256).toLowerCase()) {
      try { fs.unlinkSync(destPath); } catch {}
      throw new Error('Verificarea de integritate a installerului a esuat.');
    }
  }

  sendToRenderer('updater:progress', { percent: 100, file: fileName, received: -1, total: -1 });
  return { mode: 'installer', path: destPath, fileName };
}

async function downloadOverlay(manifest) {
  const files = Array.isArray(manifest?.files) ? manifest.files : [];
  if (files.length === 0) throw new Error('Manifestul nu contine fisiere de actualizat.');

  const overlayRoot = getOverlayRoot();
  const overlayDist = path.join(overlayRoot, 'files', 'dist');
  const installDist = path.join(getAppRoot(), 'dist');
  const sentinelPath = path.join(overlayRoot, '.bootstrap-ok');

  if ((!fs.existsSync(overlayDist) || !fs.existsSync(sentinelPath)) && fs.existsSync(installDist)) {
    sendToRenderer('updater:progress', { percent: 2, file: 'Pregatire overlay...', received: 0, total: 0 });
    try {
      if (fs.existsSync(overlayRoot)) fs.rmSync(overlayRoot, { recursive: true, force: true });
      copyDirSync(installDist, overlayDist);
      fs.writeFileSync(sentinelPath, 'OK', 'utf-8');
    } catch (err) {
      throw new Error(`Nu s-a putut crea overlay-ul local: ${err.message}`);
    }
  }

  let completed = 0;
  for (const file of files) {
    const safePath = path.normalize(file.path).replace(/^(\.\.[/\\])+/, '');
    const overlayFilesRoot = path.join(overlayRoot, 'files');
    const destPath = path.join(overlayFilesRoot, safePath);
    if (!destPath.startsWith(overlayFilesRoot)) {
      throw new Error(`Cale invalida in manifest: ${file.path}`);
    }

    try {
      await downloadFile(file.url, destPath, (percent, received, total) => {
        const overall = Math.round(((completed + (percent > 0 ? percent / 100 : 0.5)) / files.length) * 90) + 5;
        sendToRenderer('updater:progress', {
          percent: Math.min(overall, 97),
          file: path.basename(file.path),
          received,
          total,
        });
      });
      completed += 1;
      sendToRenderer('updater:progress', {
        percent: Math.round((completed / files.length) * 90) + 5,
        file: path.basename(file.path),
        received: -1,
        total: -1,
      });
    } catch (err) {
      throw new Error(`Eroare la ${path.basename(file.path)}: ${err.message}`);
    }
  }

  try {
    fs.writeFileSync(
      path.join(overlayRoot, 'manifest.json'),
      JSON.stringify({ version: manifest.version, files: manifest.files }, null, 2),
      'utf-8',
    );
  } catch (err) {
    throw new Error(`Nu s-a putut salva manifestul local: ${err.message}`);
  }

  sendToRenderer('updater:progress', { percent: 100, file: 'Gata!', received: -1, total: -1 });
  return { mode: 'overlay' };
}

function registerUpdaterIPC(mainWindow) {
  mainWindowRef = mainWindow;

  try { ipcMain.removeHandler('updater:check'); } catch {}
  try { ipcMain.removeHandler('updater:download'); } catch {}
  try { ipcMain.removeHandler('updater:restart'); } catch {}
  try { ipcMain.removeHandler('updater:getVersion'); } catch {}
  try { ipcMain.removeHandler('updater:install-downloaded'); } catch {}

  ipcMain.handle('updater:check', async () => {
    const localVersion = getLocalVersion();
    try {
      const history = await fetchJson(HISTORY_URL);
      const entries = Array.isArray(history?.versions) ? history.versions : [];
      const versions = entries
        .filter((entry) => entry && typeof entry.version === 'string' && typeof entry.manifestUrl === 'string')
        .sort((left, right) => compareVersion(left.version, right.version));

      if (versions.length > 0) {
        const latest = versions[versions.length - 1];
        const next = versions.find((entry) => compareVersion(localVersion, entry.version) < 0);
        if (!next) {
          return {
            hasUpdate: false,
            version: localVersion,
            latestVersion: latest.version,
            releaseDate: '',
            changes: [],
            localVersion,
            files: [],
            contentUpdates: [],
            delivery: 'overlay',
            isSequential: true,
            stepsRemaining: 0,
          };
        }

        const manifest = normalizeManifest(await fetchJson(next.manifestUrl));
        return {
          hasUpdate: true,
          version: manifest.version ?? next.version,
          latestVersion: latest.version,
          releaseDate: manifest.releaseDate,
          changes: manifest.changes,
          localVersion,
          files: manifest.files,
          contentUpdates: manifest.contentUpdates,
          installer: manifest.installer,
          delivery: manifest.delivery,
          isSequential: true,
          stepsRemaining: versions.filter((entry) => compareVersion(localVersion, entry.version) < 0).length,
        };
      }

      const manifest = normalizeManifest(await fetchJson(MANIFEST_URL));
      if (!manifest.version) throw new Error('Manifest invalid - lipseste campul version');
      const hasUpdate = isNewerVersion(localVersion, manifest.version);
      return {
        hasUpdate,
        version: manifest.version,
        latestVersion: manifest.latestVersion,
        releaseDate: manifest.releaseDate,
        changes: manifest.changes,
        localVersion,
        files: manifest.files,
        contentUpdates: manifest.contentUpdates,
        installer: manifest.installer,
        delivery: manifest.delivery,
        isSequential: false,
        stepsRemaining: hasUpdate ? 1 : 0,
      };
    } catch (err) {
      throw new Error(`Nu s-a putut contacta serverul de actualizari: ${err.message}`);
    }
  });

  ipcMain.handle('updater:download', async (_, manifest) => {
    if (manifest?.delivery === 'installer' || (app.isPackaged && manifest?.installer?.url)) {
      return downloadInstaller(manifest);
    }
    return downloadOverlay(manifest);
  });

  ipcMain.handle('updater:restart', () => {
    app.relaunch();
    app.quit();
  });

  ipcMain.handle('updater:getVersion', () => getLocalVersion());

  ipcMain.handle('updater:install-downloaded', async (_, installerPath) => {
    if (!installerPath || typeof installerPath !== 'string') {
      throw new Error('Calea catre installer lipseste.');
    }

    const normalized = path.normalize(installerPath);
    const root = path.normalize(getInstallerDownloadDir());
    if (!normalized.startsWith(root)) {
      throw new Error('Installer invalid.');
    }

    const openError = await shell.openPath(normalized);
    if (openError) {
      throw new Error(`Installerul nu a putut fi lansat: ${openError}`);
    }

    return true;
  });
}

module.exports = { registerUpdaterIPC };
