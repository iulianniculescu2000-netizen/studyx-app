#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const PKG = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8'));
const REPO = 'iulianniculescu2000-netizen/studyx-updates';
const BRANCH = 'main';
const TODAY = new Date().toISOString().split('T')[0];

function walkFiles(baseDir, relDir = '') {
  const currentDir = path.join(baseDir, relDir);
  const entries = fs.readdirSync(currentDir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relPath = path.join(relDir, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(baseDir, relPath));
    else files.push(relPath.replace(/\\/g, '/'));
  }
  return files;
}

function fileSizeBytes(filePath) {
  return fs.statSync(filePath).size;
}

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function findInstallerArtifact(expectedVersion = '') {
  const releaseDir = path.join(ROOT, 'release');
  if (!fs.existsSync(releaseDir)) return null;

  const candidates = walkFiles(releaseDir)
    .filter((file) => file.toLowerCase().endsWith('.exe'))
    .filter((file) => /studyx/i.test(path.basename(file)))
    .filter((file) => !/unins/i.test(path.basename(file)))
    .filter((file) => !expectedVersion || path.basename(file).includes(expectedVersion));

  if (candidates.length === 0) return null;

  const ranked = candidates
    .map((file) => {
      const abs = path.join(releaseDir, file);
      return { file, abs, size: fileSizeBytes(abs) };
    })
    .sort((left, right) => right.size - left.size);

  return ranked[0];
}

const distDir = path.join(ROOT, 'dist');
if (!fs.existsSync(path.join(distDir, 'assets', 'index.js'))) {
  console.error('\nMissing dist/. Run "npm run build" first.\n');
  process.exit(1);
}

const updateFiles = walkFiles(distDir).map((relPath) => ({
  path: `dist/${relPath}`,
  url: `https://raw.githubusercontent.com/${REPO}/${BRANCH}/files/dist/${relPath}`,
}));

const installer = findInstallerArtifact(PKG.version);
const manifest = {
  version: PKG.version,
  latestVersion: PKG.version,
  releaseDate: TODAY,
  changes: ['StudyX update'],
  files: updateFiles,
  ...(installer
    ? {
        installer: {
          fileName: path.basename(installer.file),
          url: `https://raw.githubusercontent.com/${REPO}/${BRANCH}/files/installers/${PKG.version}/${path.basename(installer.file)}`,
          sha256: sha256(installer.abs),
          size: installer.size,
        },
      }
    : {}),
};

console.log('\n==============================================================');
console.log(` StudyX update manifest v${PKG.version}`);
console.log('==============================================================\n');
console.log(JSON.stringify(manifest, null, 2));
console.log('\nFiles to publish:');
for (const file of updateFiles) {
  const abs = path.join(ROOT, file.path);
  console.log(` - ${file.path} (${Math.round(fileSizeBytes(abs) / 1024)} KB)`);
}

if (installer) {
  console.log(` - installer: release/${installer.file} (${(installer.size / 1024 / 1024).toFixed(2)} MB)`);
} else {
  console.log(' - installer: not found (manifest will stay overlay-only)');
}

console.log('\nNext steps:');
console.log(' 1. Copy dist files to studyx-updates/files/dist/');
if (installer) console.log(` 2. Copy installer to studyx-updates/files/installers/${PKG.version}/`);
console.log(` 3. Save manifest to studyx-updates/manifests/${PKG.version}.json`);
console.log(' 4. Update version.json and version-history.json');
console.log(' 5. Commit and push the release repo\n');
