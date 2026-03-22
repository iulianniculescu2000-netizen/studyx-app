#!/usr/bin/env node
/**
 * scripts/publish-update.cjs — StudyX Auto-Publisher
 *
 * Comenzi:
 *   node scripts/publish-update.cjs --setup               → configurare token GitHub
 *   node scripts/publish-update.cjs                       → publică update (patch)
 *   node scripts/publish-update.cjs minor "Ce s-a schimbat"
 *   node scripts/publish-update.cjs major "Release major"
 *
 * Sau prin npm:
 *   npm run publish-update
 *   npm run publish-update -- minor "Funcționalitate nouă"
 *
 * Ce face automat:
 *   1. Incrementează versiunea în package.json
 *   2. Buildează aplicația (npm run build)
 *   3. Detectează fișierele schimbate față de ultimul update (hash MD5)
 *   4. Crează repo-ul GitHub dacă nu există
 *   5. Uploadează DOAR fișierele schimbate via Git Data API (suportă >1MB)
 *   6. Actualizează version.json în repo
 *   7. Salvează hashurile locale pentru comparare viitoare
 */
'use strict';

const https    = require('https');
const fs       = require('fs');
const path     = require('path');
const crypto   = require('crypto');
const readline = require('readline');
const { execSync } = require('child_process');

// ── Paths ─────────────────────────────────────────────────────────────────────
const ROOT        = path.join(__dirname, '..');
const CONFIG_FILE = path.join(ROOT, '.update-config.json');
const HASHES_FILE = path.join(ROOT, '.update-hashes.json');
const PKG_FILE    = path.join(ROOT, 'package.json');

// ── Repo GitHub pentru updates ────────────────────────────────────────────────
const UPDATES_OWNER = 'iulianniculescu2000-netizen';
const UPDATES_REPO  = 'studyx-updates';
const UPDATES_BRANCH = 'main';

// ── Fișierele distribuite cu aplicația ────────────────────────────────────────
const DIST_FILES = [
  'dist/assets/index.js',
  'dist/assets/index.css',
  'dist/assets/typeof.js',
  'dist/assets/purify.es.js',
  'dist/assets/index.es.js',
  'dist/assets/html2canvas.js',
  'dist/assets/jspdf.es.min.js',
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function log(msg)   { console.log(`  ${msg}`); }
function ok(msg)    { console.log(`  ✅  ${msg}`); }
function info(msg)  { console.log(`  ℹ️   ${msg}`); }
function warn(msg)  { console.log(`  ⚠️   ${msg}`); }
function err(msg)   { console.error(`  ❌  ${msg}`); }
function sep()      { console.log('  ' + '─'.repeat(58)); }

function readPkg()  { return JSON.parse(fs.readFileSync(PKG_FILE, 'utf-8')); }
function savePkg(p) { fs.writeFileSync(PKG_FILE, JSON.stringify(p, null, 2) + '\n', 'utf-8'); }

function bumpVersion(version, type) {
  const [maj, min, pat] = version.split('.').map(Number);
  if (type === 'major') return `${maj + 1}.0.0`;
  if (type === 'minor') return `${maj}.${min + 1}.0`;
  return `${maj}.${min}.${pat + 1}`;
}

function md5(filePath) {
  return crypto.createHash('md5').update(fs.readFileSync(filePath)).digest('hex');
}

function loadHashes() {
  try { return JSON.parse(fs.readFileSync(HASHES_FILE, 'utf-8')); } catch { return {}; }
}

function saveHashes(h) {
  fs.writeFileSync(HASHES_FILE, JSON.stringify(h, null, 2), 'utf-8');
}

// ─────────────────────────────────────────────────────────────────────────────
// GitHub API (raw https — fără dependențe externe)
// ─────────────────────────────────────────────────────────────────────────────

function githubRequest(method, endpoint, token, body = null) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'api.github.com',
      path:     `/repos/${UPDATES_OWNER}/${UPDATES_REPO}${endpoint}`,
      method,
      headers: {
        'User-Agent':    'StudyX-Publisher/1.0',
        'Authorization': `token ${token}`,
        'Accept':        'application/vnd.github.v3+json',
        'Content-Type':  'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => {
        try {
          const json = data ? JSON.parse(data) : {};
          if (res.statusCode >= 400) {
            reject(new Error(`GitHub API ${res.statusCode}: ${json.message || data}`));
          } else {
            resolve(json);
          }
        } catch {
          reject(new Error(`GitHub API parse error: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(60000, () => req.destroy(new Error('GitHub API timeout')));
    if (payload) req.write(payload);
    req.end();
  });
}

function githubUser(token) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.github.com',
      path: '/user',
      method: 'GET',
      headers: {
        'User-Agent': 'StudyX-Publisher/1.0',
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    }, (res) => {
      let d = '';
      res.on('data', c => (d += c));
      res.on('end', () => {
        try {
          const j = JSON.parse(d);
          if (res.statusCode === 200) resolve(j);
          else reject(new Error(j.message || `HTTP ${res.statusCode}`));
        } catch { reject(new Error(d)); }
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => req.destroy(new Error('timeout')));
    req.end();
  });
}

function createRepo(token) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      name: UPDATES_REPO,
      description: 'StudyX — update manifest și fișiere',
      private: false,
      auto_init: true,
    });
    const req = https.request({
      hostname: 'api.github.com',
      path: '/user/repos',
      method: 'POST',
      headers: {
        'User-Agent': 'StudyX-Publisher/1.0',
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    }, (res) => {
      let d = '';
      res.on('data', c => (d += c));
      res.on('end', () => {
        try {
          const j = JSON.parse(d);
          if (res.statusCode === 201) resolve(j);
          else if (res.statusCode === 422) resolve({ already_exists: true });
          else reject(new Error(j.message || `HTTP ${res.statusCode}`));
        } catch { reject(new Error(d)); }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// ── Git Data API — suportă fișiere de orice dimensiune ────────────────────────

async function getRef(token) {
  return githubRequest('GET', `/git/ref/heads/${UPDATES_BRANCH}`, token);
}

async function getCommit(token, sha) {
  return githubRequest('GET', `/git/commits/${sha}`, token);
}

async function createBlob(token, content) {
  // content = Buffer sau string
  const encoded = Buffer.isBuffer(content)
    ? content.toString('base64')
    : Buffer.from(content).toString('base64');
  return githubRequest('POST', '/git/blobs', token, {
    content:  encoded,
    encoding: 'base64',
  });
}

async function createTree(token, baseTreeSha, treeItems) {
  return githubRequest('POST', '/git/trees', token, {
    base_tree: baseTreeSha,
    tree:      treeItems,
  });
}

async function createCommit(token, message, treeSha, parentSha) {
  return githubRequest('POST', '/git/commits', token, {
    message,
    tree:    treeSha,
    parents: [parentSha],
  });
}

async function updateRef(token, commitSha) {
  return githubRequest('PATCH', `/git/refs/heads/${UPDATES_BRANCH}`, token, {
    sha:   commitSha,
    force: false,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Setup — configurare interactivă token
// ─────────────────────────────────────────────────────────────────────────────

async function runSetup() {
  console.log('\n' + '═'.repeat(62));
  console.log('  🔧  StudyX Publisher — Configurare inițială');
  console.log('═'.repeat(62) + '\n');

  console.log('  Ai nevoie de un GitHub Personal Access Token cu');
  console.log('  permisiunile:  repo  (full control of private repositories)\n');
  console.log('  Cum îl obții:');
  console.log('  1. Mergi la https://github.com/settings/tokens/new');
  console.log('  2. Bifează "repo" (sau "public_repo" pentru repo public)');
  console.log('  3. Copiază token-ul generat\n');

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q) => new Promise(res => rl.question(q, res));

  const token = (await ask('  Paste token GitHub: ')).trim();
  rl.close();

  if (!token) { err('Token gol. Ieșire.'); process.exit(1); }

  process.stdout.write('\n  Verific token...');
  try {
    const user = await githubUser(token);
    console.log(` ✅  Autentificat ca: ${user.login}`);
  } catch (e) {
    console.log('');
    err(`Token invalid: ${e.message}`);
    process.exit(1);
  }

  const config = { token, owner: UPDATES_OWNER, repo: UPDATES_REPO };
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
  ok(`Config salvat în .update-config.json`);

  console.log('\n  Creez repo-ul GitHub studyx-updates...');
  try {
    const result = await createRepo(token);
    if (result.already_exists) {
      info('Repo-ul există deja — OK');
    } else {
      ok(`Repo creat: https://github.com/${UPDATES_OWNER}/${UPDATES_REPO}`);
    }
  } catch (e) {
    warn(`Nu s-a putut crea repo-ul: ${e.message}`);
    info('Continuă manual la github.com/new cu numele "studyx-updates" (public)');
  }

  console.log('\n' + '═'.repeat(62));
  console.log('  ✅  Setup complet! Acum rulează:');
  console.log('       npm run publish-update');
  console.log('═'.repeat(62) + '\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Publish — fluxul principal
// ─────────────────────────────────────────────────────────────────────────────

async function runPublish(bumpType, changeMsg) {
  console.log('\n' + '═'.repeat(62));
  console.log('  🚀  StudyX Publisher');
  console.log('═'.repeat(62));

  // ── 1. Citim config ──────────────────────────────────────────────────────
  let token;
  try {
    if (process.env.GITHUB_TOKEN) {
      token = process.env.GITHUB_TOKEN;
      info('Token din variabila GITHUB_TOKEN');
    } else {
      const cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
      token = cfg.token;
    }
    if (!token) throw new Error('Token lipsă');
  } catch {
    err('Token GitHub negăsit. Rulează mai întâi:');
    err('  node scripts/publish-update.cjs --setup');
    process.exit(1);
  }

  // ── 2. Bump versiune ─────────────────────────────────────────────────────
  const pkg        = readPkg();
  const oldVersion = pkg.version;
  const newVersion = bumpVersion(oldVersion, bumpType);
  pkg.version      = newVersion;
  savePkg(pkg);
  sep();
  ok(`Versiune: ${oldVersion} → ${newVersion}  (${bumpType})`);

  // ── 3. Build ──────────────────────────────────────────────────────────────
  log('Build aplicație...');
  try {
    execSync('npm run build', { cwd: ROOT, stdio: 'pipe' });
    ok('Build reușit');
  } catch (e) {
    err('Build eșuat:');
    console.error(e.stdout?.toString());
    console.error(e.stderr?.toString());
    pkg.version = oldVersion;
    savePkg(pkg);
    process.exit(1);
  }

  // ── 4. Detectare fișiere schimbate ───────────────────────────────────────
  const oldHashes = loadHashes();
  const newHashes = {};
  const changed   = [];

  for (const rel of DIST_FILES) {
    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs)) continue;
    const hash = md5(abs);
    newHashes[rel] = hash;
    if (oldHashes[rel] !== hash) changed.push(rel);
  }

  sep();
  if (changed.length === 0) {
    warn('Niciun fișier schimbat față de ultimul update.');
    info('Forțez includerea index.js și index.css...');
    ['dist/assets/index.js', 'dist/assets/index.css'].forEach(f => {
      if (fs.existsSync(path.join(ROOT, f)) && !changed.includes(f)) changed.push(f);
    });
  }

  changed.forEach(f => {
    const size = (fs.statSync(path.join(ROOT, f)).size / 1024).toFixed(1);
    log(`  📄  ${f}  (${size} KB)`);
  });

  // ── 5. Verifică / crează repo GitHub ────────────────────────────────────
  sep();
  log('Conectez la GitHub...');
  let ref;
  try {
    ref = await getRef(token);
    ok(`Repo găsit: github.com/${UPDATES_OWNER}/${UPDATES_REPO}`);
  } catch (e) {
    if (e.message.includes('404') || e.message.includes('Not Found')) {
      log('Repo inexistent — îl creez...');
      await createRepo(token);
      // Așteptăm GitHub să inițializeze repo-ul
      await new Promise(r => setTimeout(r, 3000));
      ref = await getRef(token);
      ok(`Repo creat: github.com/${UPDATES_OWNER}/${UPDATES_REPO}`);
    } else {
      throw e;
    }
  }

  // ── 6. Upload fișiere via Git Data API ────────────────────────────────────
  sep();
  log('Uploading fișiere...');

  const headSha   = ref.object.sha;
  const commit    = await getCommit(token, headSha);
  const baseTree  = commit.tree.sha;

  const treeItems = [];

  // Adaugă fișierele dist/ schimbate
  for (const rel of changed) {
    const abs     = path.join(ROOT, rel);
    const content = fs.readFileSync(abs);
    process.stdout.write(`     ${rel.padEnd(42)}`);
    const blob = await createBlob(token, content);
    treeItems.push({
      path: `files/${rel}`,
      mode: '100644',
      type: 'blob',
      sha:  blob.sha,
    });
    console.log(' ✓');
  }

  // Adaugă version.json
  const versionJson = JSON.stringify({
    version:     newVersion,
    releaseDate: new Date().toISOString().split('T')[0],
    changes:     [changeMsg],
    files: changed.map(rel => ({
      path: rel,
      url:  `https://raw.githubusercontent.com/${UPDATES_OWNER}/${UPDATES_REPO}/${UPDATES_BRANCH}/files/${rel}`,
    })),
  }, null, 2);

  process.stdout.write(`     version.json${' '.repeat(28)}`);
  const vBlob = await createBlob(token, Buffer.from(versionJson));
  treeItems.push({ path: 'version.json', mode: '100644', type: 'blob', sha: vBlob.sha });
  console.log(' ✓');

  // ── 7. Commit & push ─────────────────────────────────────────────────────
  sep();
  log('Creez commit...');
  const newTree   = await createTree(token, baseTree, treeItems);
  const newCommit = await createCommit(
    token,
    `release: v${newVersion}\n\n${changeMsg}`,
    newTree.sha,
    headSha,
  );
  await updateRef(token, newCommit.sha);
  ok(`Commit publicat: ${newCommit.sha.slice(0, 7)}`);

  // ── 8. Salvează hashurile ─────────────────────────────────────────────────
  saveHashes(newHashes);

  // ── 9. Done ───────────────────────────────────────────────────────────────
  sep();
  console.log(`\n  🎉  Update v${newVersion} publicat cu succes!\n`);
  console.log(`  📎  https://github.com/${UPDATES_OWNER}/${UPDATES_REPO}`);
  console.log(`  📎  Manifest: https://raw.githubusercontent.com/${UPDATES_OWNER}/${UPDATES_REPO}/${UPDATES_BRANCH}/version.json`);
  console.log(`\n  Utilizatorii vor vedea notificarea la următoarea verificare.\n`);
  console.log('═'.repeat(62) + '\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Entry point
// ─────────────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);

if (args.includes('--setup') || args.includes('setup')) {
  runSetup().catch(e => { err(e.message); process.exit(1); });
} else {
  const BUMP_TYPES = ['patch', 'minor', 'major'];
  const bumpArg    = args.find(a => BUMP_TYPES.includes(a)) ?? 'patch';
  const msgArg     = args.find(a => !BUMP_TYPES.includes(a) && !a.startsWith('--')) ?? 'Actualizare StudyX';

  runPublish(bumpArg, msgArg).catch(e => {
    err(e.message);
    process.exit(1);
  });
}
