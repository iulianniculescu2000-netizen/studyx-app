/**
 * generate-guide.cjs
 * Run: node scripts/generate-guide.cjs
 * Output: Desktop/StudyX_Update_Guide.pdf
 *
 * Requires: npm install --save-dev pdfkit   (or run once to generate)
 */
const path = require('path');
const fs = require('fs');

// Try loading pdfkit from multiple locations
let PDFDocument;
const candidates = [
  path.join(__dirname, '..', 'node_modules', 'pdfkit'),
  '/c/tmp/pdf-gen/node_modules/pdfkit',
  'C:/tmp/pdf-gen/node_modules/pdfkit',
  path.join(process.env.LOCALAPPDATA || '', 'Temp', 'pdf-gen', 'node_modules', 'pdfkit'),
  path.join('C:/Users', process.env.USERNAME || 'maria', 'AppData/Local/Temp/pdf-gen/node_modules/pdfkit'),
];
for (const c of candidates) {
  try { PDFDocument = require(c); break; } catch {}
}
if (!PDFDocument) {
  console.error('pdfkit not found. Run: npm install pdfkit (or see script)');
  process.exit(1);
}

// Detect desktop path
const desktopPath = process.env.USERPROFILE
  ? path.join(process.env.USERPROFILE, 'Desktop')
  : path.join(require('os').homedir(), 'Desktop');
const OUTPUT = path.join(desktopPath, 'StudyX_Update_Guide.pdf');

const doc = new PDFDocument({
  size: 'A4',
  margins: { top: 60, bottom: 60, left: 60, right: 60 },
  info: { Title: 'StudyX Update Guide', Author: 'StudyX' },
});

const stream = fs.createWriteStream(OUTPUT);
doc.pipe(stream);

const ACCENT  = '#0A84FF';
const DARK    = '#1A1A2E';
const GRAY    = '#6B7280';
const SUCCESS = '#30D158';
const WARNING = '#FF9F0A';
const DANGER  = '#FF453A';
const W       = 595 - 120; // usable width

// ── Helpers ───────────────────────────────────────────────────────────────────
const h1 = (t) => {
  doc.moveDown(0.5).fontSize(20).fillColor(DARK).font('Helvetica-Bold').text(t, { lineGap: 4 });
  doc.moveDown(0.2);
};
const h2 = (t) => {
  doc.moveDown(0.4).fontSize(13).fillColor(ACCENT).font('Helvetica-Bold').text(t, { lineGap: 3 });
  doc.moveDown(0.15);
};
const body = (t) => {
  doc.fontSize(11).fillColor('#374151').font('Helvetica').text(t, { lineGap: 5, paragraphGap: 3 });
};
const note = (t, color) => {
  doc.moveDown(0.25);
  const y = doc.y;
  doc.rect(60, y, 3, 14).fill(color);
  doc.fontSize(10).fillColor(color).font('Helvetica-Bold').text(t, 70, y, { width: W - 10, lineGap: 3 });
  doc.moveDown(0.3);
};
const code = (t) => {
  doc.moveDown(0.2);
  const y = doc.y;
  const lines = t.split('\n').length;
  const h = lines * 14 + 18;
  doc.rect(60, y, W, h).fill('#1E293B');
  doc.fontSize(9).fillColor('#A5F3FC').font('Courier').text(t, 70, y + 9, { width: W - 20, lineGap: 4 });
  doc.y = y + h + 8;
  doc.x = 60;
  doc.fontSize(11).fillColor('#374151').font('Helvetica');
};
const step = (n, title, desc) => {
  doc.moveDown(0.3);
  const y = doc.y;
  doc.circle(70, y + 7, 8).fill(ACCENT);
  doc.fontSize(9).fillColor('#fff').font('Helvetica-Bold').text(String(n), 66, y + 2.5, { width: 9, align: 'center' });
  doc.fontSize(11.5).fillColor(DARK).font('Helvetica-Bold').text(title, 85, y, { width: W - 25 });
  doc.fontSize(10.5).fillColor('#4B5563').font('Helvetica').text(desc, 85, doc.y, { width: W - 25, lineGap: 4 });
  doc.moveDown(0.3);
};
const div = () => {
  doc.moveDown(0.5);
  doc.moveTo(60, doc.y).lineTo(60 + W, doc.y).stroke('#D1D5DB');
  doc.moveDown(0.5);
};

// ── COVER ─────────────────────────────────────────────────────────────────────
doc.rect(0, 0, 595, 200).fill(DARK);
doc.fontSize(32).fillColor('#fff').font('Helvetica-Bold').text('StudyX', 60, 62, { characterSpacing: 2 });
doc.fontSize(13).fillColor(ACCENT).font('Helvetica').text('Ghid Complet: Creare si Publicare Update-uri', 60, 106, { width: W });
doc.fontSize(10).fillColor('#9CA3AF').text('v1.0  |  Martie 2026', 60, 133);
doc.rect(60, 153, 50, 4).fill(ACCENT);
doc.rect(118, 153, 20, 4).fill('#5E5CE6');
doc.rect(146, 153, 10, 4).fill(SUCCESS);

doc.y = 220; doc.x = 60;
doc.fontSize(12).fillColor('#374151').font('Helvetica').text(
  'Acest ghid iti explica pas cu pas cum sa creezi si sa publici update-uri pentru aplicatia StudyX — atat actualizari de sistem (cod), cat si pachete de continut (grile). Citeste in ordine si totul va functiona perfect.',
  { lineGap: 6 }
);
div();

// ── SECTION 1 ─────────────────────────────────────────────────────────────────
h1('1. Cele doua tipuri de update');
doc.fontSize(12).fillColor(DARK).font('Helvetica-Bold').text('Tip A — Update de Sistem (Cod)');
body('Actualizeaza codul aplicatiei: bug fix-uri, functii noi, imbunatatiri vizuale.\nUtilizatorul descarca si instaleaza din Centrul de Actualizari. Necesita repornire a aplicatiei.');
doc.moveDown(0.4);
doc.fontSize(12).fillColor(DARK).font('Helvetica-Bold').text('Tip B — Update de Continut (Grile)');
body('Adauga un pachet de grile pentru o materie (ex: Dermatologie, Cardiologie).\nInstalarea creeaza automat un folder cu numele materiei si importa toate grilele in el.\nNU necesita repornire. Rollback automat disponibil din Setari.');
div();

// ── SECTION 2 ─────────────────────────────────────────────────────────────────
h1('2. Update de Sistem (Cod)');

h2('Pas 1 — Obtine un GitHub Personal Access Token');
step(1, 'Deschide GitHub.com si logeaza-te', 'Mergi pe github.com si intra in contul tau GitHub.');
step(2, 'Deschide Settings', 'Click pe poza ta de profil (dreapta sus) → Settings → Developer settings (jos in stanga).');
step(3, 'Genereaza token nou', 'Personal Access Tokens → Tokens (classic) → "Generate new token (classic)".\nNume: studyx-deploy | Expirare: No expiration\nBifeaza: toata sectiunea "repo" (toate sub-optiunile).\nApasa "Generate token".');
step(4, 'Salveaza token-ul IMEDIAT', 'Token-ul apare O SINGURA DATA. Copiaza-l si salveaza-l intr-un Notepad sau gestionar de parole.\nDaca il pierzi, trebuie sa generezi unul nou.');
note('IMPORTANT: Nu da niciodata token-ul altcuiva. Este echivalentul parolei tale de GitHub.', WARNING);

h2('Pas 2 — Configureaza token-ul in proiect');
body('Deschide fisierul .env.local din radacina proiectului StudyX si adauga:');
code('GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx\nGITHUB_REPO=mariaiuliana19/studyx-updates');

h2('Pas 3 — Creeaza si publica update-ul');
body('Deschide orice AI (Claude, ChatGPT, Cursor, Gemini) si spune-i:');
code('"Rezolva [descrierea bug-ului] in fisierul [cale/fisier.tsx].\nDupa ce faci modificarile, ruleaza:\n  node scripts/deploy-update.cjs 2.0.5 \'Titlul schimbarii\' \'Descriere optionala\'\nAsigura-te ca build-ul trece fara erori inainte de deploy."');

body('SAU, daca vrei tu sa faci deploy manual, deschide PowerShell in directorul proiectului:');
code('node scripts/deploy-update.cjs 2.0.5 "Fix bug quiz" "Animatii imbunatatite"');
body('Parametri: [versiunea_noua] [titlu1] [titlu2] ...\nPoata lua oricati parametri de descriere.');

note('Ce face scriptul automat: modifica versiunea in package.json, ruleaza npm run build, urca fisierele JS/CSS pe GitHub, actualizeaza version.json cu changelog-ul.', SUCCESS);
div();

// ── SECTION 3 ─────────────────────────────────────────────────────────────────
h1('3. Update de Continut (Grile)');

h2('Pas 1 — Genereaza grilele cu AI');
body('Trimite urmatorul mesaj catre ChatGPT, Claude sau Gemini (adapteaza materia):');
code('Genereaza 20 grile de DERMATOLOGIE pentru examen Rezidentiat Romania.\nFormat JSON (respecta EXACT structura de mai jos):\n{\n  "subject": "Dermatologie",\n  "emoji": "pill",\n  "color": "pink",\n  "quizzes": [{\n    "title": "Dermatologie - Set 1",\n    "description": "Grile fundamentale",\n    "questions": [{\n      "id": "derm-001",\n      "text": "Intrebarea?",\n      "options": [\n        { "text": "Varianta A - corecta", "isCorrect": true },\n        { "text": "Varianta B", "isCorrect": false },\n        { "text": "Varianta C", "isCorrect": false },\n        { "text": "Varianta D", "isCorrect": false }\n      ],\n      "explanation": "De ce A este corect."\n    }]\n  }]\n}');

note('TIP: Poti cere si 50-100 grile deodata. Poti face mai multe "quizzes" in acelasi fisier (set 1, set 2, etc).', SUCCESS);

h2('Pas 2 — Urca JSON-ul pe GitHub');
step(1, 'Deschide repository-ul studyx-updates', 'Mergi pe github.com/mariaiuliana19/studyx-updates');
step(2, 'Creeaza fisierul nou', 'Click "Add file" → "Create new file".\nIn campul de nume scrie: content/dermatologie.json\n(bara / creeaza folderul automat)');
step(3, 'Lipeste JSON-ul', 'Copiaza tot continutul JSON generat de AI si lipeste-l in editorul GitHub.');
step(4, 'Salveaza', 'Scroll jos → "Commit new file" → Click butonul verde.');
step(5, 'Obtine URL-ul raw', 'Deschide fisierul pe GitHub → Click butonul "Raw" (dreapta sus) → Copiaza URL-ul din bara browserului.\nArata asa: https://raw.githubusercontent.com/mariaiuliana19/studyx-updates/main/content/dermatologie.json');

h2('Pas 3 — Adauga pack-ul in version.json');
body('Deschide version.json din repository-ul studyx-updates (sau creeaza-l). Structura completa:');
code('{\n  "version": "2.0.5",\n  "releaseDate": "28 Martie 2026",\n  "changes": ["Fix bug quiz"],\n  "files": [],\n  "contentUpdates": [\n    {\n      "id": "derm-2024",\n      "title": "Dermatologie - 85 grile",\n      "subject": "Dermatologie",\n      "description": "Grile complete pentru Rezidentiat",\n      "emoji": "pill",\n      "color": "pink",\n      "questionCount": 85,\n      "quizCount": 3,\n      "url": "https://raw.githubusercontent.com/mariaiuliana19/studyx-updates/main/content/dermatologie.json",\n      "publishedAt": "2026-03-28"\n    }\n  ]\n}');

body('Campuri importante:\n  id: cod unic scurt, fara spatii (ex: derm-2024, cardio-2025)\n  color: blue | purple | green | orange | pink | red | teal\n  url: URL-ul raw al fisierului JSON de pe GitHub\n  emoji: numele emoji (fara ":"), ex: stethoscope, pill, bone, heart');
div();

// ── SECTION 4 ─────────────────────────────────────────────────────────────────
h1('4. Rollback — Revenire in caz de probleme');
body('Inainte de fiecare instalare de pack de continut, aplicatia salveaza automat un snapshot complet.\nDaca ceva merge prost dupa instalare:');
doc.moveDown(0.3);
step(1, 'Deschide Setari din StudyX', 'Click pe iconita Settings din sidebar.');
step(2, 'Sectiunea "Actualizari & Rollback"', 'Vei vedea un badge "Disponibil" daca exista un snapshot de rollback.');
step(3, 'Click "Revenire la backup anterior"', 'Confirma → toate grilele si folderele revin la starea de dinainte de instalare.');
note('ATENTIE: Rollback-ul pentru update-uri de SISTEM (cod) nu este disponibil din aplicatie. Daca o versiune noua are probleme, reinstaleaza manual versiunea anterioara.', DANGER);
div();

// ── SECTION 5 ─────────────────────────────────────────────────────────────────
h1('5. Probleme frecvente si solutii');
const issues = [
  ['Eroare 401 Unauthorized la deploy script', 'Token-ul GitHub e expirat sau nu are permisiunile corecte.\nSolutie: Genereaza un token nou pe GitHub cu permisiunea "repo" bifata complet si actualizeaza .env.local.'],
  ['Eroare 404 la URL-ul de continut', 'URL-ul nu este cel "raw".\nSolutie: Pe GitHub deschide fisierul → click "Raw" → copiaza URL-ul din bara browserului.'],
  ['JSON invalid, pack-ul nu se instaleaza', 'Eroare de sintaxa in fisierul JSON.\nSolutie: Copiaza JSON-ul si valideaza-l la jsonlint.com. Erori frecvente: virgula extra dupa ultimul element, ghilimele lipsa.'],
  ['Pack-ul nu apare in Centrul de Actualizari', 'contentUpdates din version.json nu este completat corect.\nSolutie: Verifica structura version.json. In aplicatie deschide Centrul de Actualizari si apasa iconita Refresh.'],
  ['Folderul nu se creeaza automat', 'Campul "subject" din JSON nu este corect.\nSolutie: Verifica ca "subject" din fisierul de continut si din version.json sunt identice. Folderul se creeaza cu exact acel text.'],
];

for (const [prob, sol] of issues) {
  doc.rect(60, doc.y, W, 1).fill('#E5E7EB');
  doc.moveDown(0.3);
  doc.fontSize(11).fillColor(DANGER).font('Helvetica-Bold').text('Problema: ' + prob, { lineGap: 3 });
  doc.fontSize(10.5).fillColor('#374151').font('Helvetica').text('Solutie: ' + sol, 68, doc.y, { width: W - 8, lineGap: 4 });
  doc.moveDown(0.4);
}
div();

// ── CHEAT SHEET PAGE ──────────────────────────────────────────────────────────
doc.addPage();
doc.rect(0, 0, 595, 110).fill(DARK);
doc.fontSize(24).fillColor('#fff').font('Helvetica-Bold').text('Cheat Sheet', 60, 35);
doc.fontSize(12).fillColor(ACCENT).font('Helvetica').text('Referinta rapida — tot ce ai nevoie pe o singura pagina', 60, 67);
doc.y = 130; doc.x = 60;

h2('Update Sistem (Cod)');
code('node scripts/deploy-update.cjs [versiune] "[titlu]" "[descriere2]"');
body('Exemplu: node scripts/deploy-update.cjs 2.0.6 "Fix quiz" "Animatii noi"');

h2('Update Continut (Grile)');
body('1. Genereaza JSON cu grile (cu ChatGPT/Claude/Gemini)\n2. Urca pe GitHub: content/[materie].json\n3. Adauga entry in version.json -> contentUpdates[]\n4. Utilizatorii instaleaza din Centrul de Actualizari\n5. Folderul se creeaza automat cu numele din campul "subject"');

h2('Obtine GitHub Token');
body('github.com → poza profil → Settings → Developer settings\n→ Personal Access Tokens → Tokens (classic) → Generate new token\n→ Bifeaza: repo (toata sectiunea) → Generate → Copiaza → Salveaza in .env.local');

h2('Rollback Continut');
body('StudyX → Setari → Actualizari & Rollback → "Revenire la backup anterior"\n(Disponibil doar dupa instalarea unui pack de continut din aplicatie)');

h2('Culorile disponibile pentru folder');
body('blue | purple | green | orange | pink | red | teal');

h2('Format emoji in JSON');
body('Fara doua puncte. Exemple corecte: stethoscope, pill, bone, heart, brain, syringe, dna\nGreseala frecventa: ":pill:" (gresit) vs "pill" (corect)');

doc.moveDown(1.5);
doc.rect(60, doc.y, W, 1).fill(ACCENT);
doc.moveDown(0.5);
doc.fontSize(9).fillColor(GRAY).text(
  'StudyX Update Guide v1.0  |  Generat: ' + new Date().toLocaleDateString('ro-RO'),
  { align: 'center' }
);

doc.end();
stream.on('finish', () => {
  console.log('PDF generat cu succes!');
  console.log('Locatie: ' + OUTPUT);
});
stream.on('error', (e) => console.error('Eroare:', e.message));
