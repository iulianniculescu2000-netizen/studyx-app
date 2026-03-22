#!/usr/bin/env node
/**
 * scripts/prepare-update.cjs
 *
 * Pregătește un update StudyX pentru publicare pe GitHub.
 *
 * Utilizare:
 *   node scripts/prepare-update.cjs
 *
 * Output:
 *   - version.json gata de copiat în repo-ul studyx-updates
 *   - Lista fișierelor ce trebuie încărcate pe GitHub
 *   - Instrucțiuni pas cu pas
 */
'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT   = path.join(__dirname, '..');
const PKG    = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8'));
const REPO   = 'iulianniculescu2000-netizen/studyx-updates';
const BRANCH = 'main';
const TODAY  = new Date().toISOString().split('T')[0];

// ── Verifică că dist/ există ─────────────────────────────────────────────────
if (!fs.existsSync(path.join(ROOT, 'dist', 'assets', 'index.js'))) {
  console.error('\n❌  dist/ nu există sau e incomplet. Rulează mai întâi:\n');
  console.error('       npm run build\n');
  process.exit(1);
}

// ── Fișierele care se actualizează la fiecare build ──────────────────────────
// De obicei DOAR index.js și index.css se schimbă (codul aplicației).
// Librăriile mari (jspdf, html2canvas, recharts) se schimbă rar.
const ALWAYS_UPDATE = [
  'dist/assets/index.js',
  'dist/assets/index.css',
];

// Fișiere vendor — le includem doar dacă s-au schimbat față de ultima dată
const VENDOR_FILES = [
  'dist/assets/typeof.js',
  'dist/assets/purify.es.min.js',
  'dist/assets/index.es.js',
  'dist/assets/html2canvas.js',
  'dist/assets/jspdf.es.min.js',
];

function fileSize(relPath) {
  try {
    const s = fs.statSync(path.join(ROOT, relPath)).size;
    return s > 1024 * 1024
      ? `${(s / 1024 / 1024).toFixed(1)} MB`
      : `${(s / 1024).toFixed(1)} KB`;
  } catch { return '?'; }
}

// ── Construiește lista de fișiere pentru update ──────────────────────────────
const updateFiles = ALWAYS_UPDATE
  .filter(f => fs.existsSync(path.join(ROOT, f)))
  .map(f => ({
    path: f,
    url: `https://raw.githubusercontent.com/${REPO}/${BRANCH}/files/${f}`,
  }));

// ── Generează version.json ───────────────────────────────────────────────────
const manifest = {
  version:     PKG.version,
  releaseDate: TODAY,
  changes: [
    'Actualizare StudyX',
  ],
  files: updateFiles,
};

// ── Output ───────────────────────────────────────────────────────────────────
console.log('\n' + '═'.repeat(62));
console.log('  📦  StudyX — Pregătire Update v' + PKG.version);
console.log('═'.repeat(62));

console.log('\n① Conținut version.json  (editează "changes" dacă vrei)\n');
console.log(JSON.stringify(manifest, null, 2));

console.log('\n' + '─'.repeat(62));
console.log('\n② Fișiere de copiat în  studyx-updates/files/\n');
updateFiles.forEach(f => {
  console.log(`   ${f.path.padEnd(36)} ${fileSize(f.path)}`);
});

console.log('\n   Opțional (doar dacă s-au schimbat librăriile):\n');
VENDOR_FILES.forEach(f => {
  if (fs.existsSync(path.join(ROOT, f))) {
    console.log(`   ${f.padEnd(36)} ${fileSize(f)}`);
  }
});

console.log('\n' + '─'.repeat(62));
console.log('\n③ Pași de urmat în repo-ul  ' + REPO + ':\n');
console.log('   1.  Copiază fișierele din dist/assets/ → files/dist/assets/');
console.log('   2.  Înlocuiește version.json cu conținutul de mai sus');
console.log('   3.  git add .');
console.log('   4.  git commit -m "release: v' + PKG.version + '"');
console.log('   5.  git push');
console.log('\n   ✅  Utilizatorii vor vedea update-ul la următoarea verificare!\n');
console.log('═'.repeat(62) + '\n');
