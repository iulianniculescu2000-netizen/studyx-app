# StudyX — stare curentă și predare (2026-09-30)

Nota asta e pentru cine (om sau chat nou) reia lucrul. Versiunea în `package.json` este încă **2.2.0**; lansarea țintă este **v2.3.0**, dar **nu s-a lansat nimic** și nu s-a creat niciun tag.
Atenție: nu crea tag-uri fără acordul utilizatorului.

## Ramuri (toate pornesc una din alta)
```
main
 └─ feat/rezidentiat-anki-fix-pierdere-date   (în GitHub; date rezidențiat, fix-uri, chat AI cu memorie)
     └─ feat/ui-apple                          (interfață Apple: teme Luminos/Întunecat/Automat, interacțiuni fine)
         └─ chore/maintenance-2026-09          (dependențe, securitate, Electron 44, pdf.js 6, Gemini 3.8, CI, ghid) ← ramura cea mai nouă, conține tot
```
`feat/rezidentiat-redesign` (din `chore/maintenance-2026-09`): pagina Rezidențiat redesenată (discipline → specialități, ecran `/rezidentiat/:folderId`); nu e împinsă în GitHub.
`preview/apple-birou` e doar un prototip local (nu e în GitHub); poate fi ștearsă.
Nu s-a făcut merge în `main`. Pentru lansare: PR de pe `chore/maintenance-2026-09` spre `main`, apoi versiune + tag.

## Ce s-a făcut (rezumat)
- **Rezidențiat/date:** carduri Kumar recompuse din PDF (552, capitole corecte, id-uri stabile); butonul „Începe" nu pierde progresul (`mergeBuiltInDeck`); `scripts/buildKumarFlashcards.mjs` (rulabil din nou); `knowledge_db.jsonl` scos din repo (ignorat).
- **Chat AI:** memorie conversațională (`src/ai/chatMemory*.ts`, panou în Setări AI), rezumat salvat per fir, recap „Unde am rămas", verificare automată a răspunsurilor cu doze/praguri, ecran complet ca panou de sticlă (`Ctrl+Shift+F`).
- **Interfață:** două teme Apple + Automat (`src/theme/themes.ts`, `src/store/themeStore.ts`, `ThemeModeSwitcher`), fără flash la pornire (script în `index.html`), Study Coach compact cu rezumat, clase `.fine-row/.fine-card/.fine-chip`, tokeni `--hover-fill/--fill-subtle/--hairline/--overlay/--skeleton/--glass-sheen`.
- **Mentenanță:** vulnerabilități 23 → 3 (0 în producție), Electron 41 → 44, pdf.js 5 → 6 (API nou: `loadingTask.destroy()`), `vitest` 5 etc., model Google implicit `gemini-3.8-flash`, CI pe Node 22/24. Vezi `docs/MAINTENANCE.md`.

## Încă de făcut (fără ordine strictă)
1. **Verificare manuală pe desktop** (`npm run electron:dev`): ambele teme, culoarea ferestrei la pornire, importul unui PDF (pdf.js 6), chatul pe ecran complet.
2. **Android:** eliminat complet (cod, workflow, Capacitor); nu se mai livrează.
3. **Interacțiuni fine:** aplicate în `QuizPlay`, `ReviewMode`, `DailyReview`, `quiz-create`, `Notes`. Contrastul stărilor corect/greșit pe tema luminoasă a fost corectat (succes/pericol/avertisment întunecate în `themes.ts`, ≥4.5:1).
4. **Pachete amânate:** componente Apple noi (tooltip global, dropdown cu tastatură), scrollbar macOS, tranziții suplimentare, listă de conversații în chat (aplicația are doar două fire: General și Rezidențiat).
6. **Majore amânate:** `eslint` 10 (cere `eslint-plugin-react-hooks` ≥ 7.1 → 32 de erori de stil), `typescript` 7, `tesseract.js` 7.
7. **Decizii de produs deschise:** `calcNextReview` (scăderea `eFactor` la lapse, schimbare SM-2 neconfirmată), `ReviewMode` (răspunsul se înregistrează la notare; ieșirea înainte de notare acum salvează rezultatul real), verificarea băncilor `lawrence-kumar.json`/`modele-grile.json` (~4200 de grile) față de PDF-urile din `Rezidentiat/Grile`.
8. **Necomise, locale:** `scripts/fixStoreEncoding.js`, `injectBanner*.js`, `reparseFlashcards.js`, `testExtractPdf*.js`, `test_kumar.txt` (unelte de unică folosință; de șters sau comis).

## Cum se verifică
`npx tsc -b` · `npx eslint .` · `npx vitest run` · `npx vite build` · `node scripts/scan-secrets.cjs` · `node scripts/verify-runtime.cjs`. La ultima verificare toate treceau (483 de teste).

## Capcane de mediu (Windows)
- `npm` pică cu `EBUSY` dacă rulează `electron:dev` (blochează `node_modules/electron`): oprește-l înainte de update.
- `allowScripts` din `package.json` fixează versiuni exacte (electron, core-js…): aliniază-le după update.
- Commit-urile locale folosesc identitatea `StudyX <studyx@local.dev>` (git nu are identitate globală); push-ul cere autentificare prin Git Credential Manager (fereastră de conectare).
- În scripturi Node scrise prin heredoc de shell, backslash-urile din regex se pierd: scrie scripturile ca fișiere sau folosește editorul.

## Preferințe ale utilizatorului
Comunicare în română, răspunsuri concise; stil vizual Apple, minimalist, cu detalii fine; nu lansează versiuni fără să spună; vrea să vadă preview-uri înainte de schimbări mari.
