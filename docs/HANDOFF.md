# StudyX — stare curentă și predare (2026-09-30, seara)

Nota asta e pentru cine (om sau chat nou) reia lucrul. Versiunea din `package.json` e încă **2.2.0**; lansarea țintă este **v2.3.0**, dar **nu s-a lansat nimic** și nu există niciun tag nou. Nu crea tag-uri și nu lansa fără acordul utilizatorului.
Android a fost **eliminat definitiv** (cod, workflow, Capacitor): nu se mai livrează.

## Ramuri
```
main
 └─ feat/rezidentiat-anki-fix-pierdere-date   (în GitHub)
     └─ feat/ui-apple
         └─ chore/maintenance-2026-09          (local: 11 commit-uri înaintea originului, NEÎMPINSE)
             └─ feat/rezidentiat-redesign      (ramura de lucru, 112 commit-uri față de main, doar locală)
```
Ramura curentă: **`feat/rezidentiat-redesign`**, arbore de lucru curat la momentul scrierii. Nimic din ce e mai jos nu e împins în GitHub; push-ul cere autentificare prin Git Credential Manager. `preview/apple-birou` e un prototip local vechi (poate fi ștearsă).
Pentru lansare: PR de pe `feat/rezidentiat-redesign` spre `main`, apoi versiune + tag (doar cu acord).

## Ce s-a făcut în sesiunea asta (pe scurt)
- **Date grile:** `modele-grile.json` comparat cu PDF-ul (2142 din 2174 verificate): 18 chei greșite corectate, 86 de titluri de secțiune lipite de întrebări curățate. `lawrence-kumar.json` verificat față de cheia din PDF (toate cele 2041 consecvente). Lipsesc ~270 de grile din cartea Lawrence/Kumar (17 teste întregi); nu au fost refăcute.
- **Pagina Rezidențiat** redesenată (stil Apple): `src/pages/Residency.tsx` (ecran principal) + `src/pages/ResidencyDiscipline.tsx` (`/rezidentiat/:folderId`, cu `?s=` pentru specialitate). Logica: `src/lib/rezidentiatOverview.ts`, componente în `src/components/residency/`.
- **Biblioteca AI** redesenată: `src/pages/KnowledgeVault.tsx`.
- **Navigare unitară:** folderele din arborele Rezidențiat se deschid pe paginile noi (`src/lib/rezidentiatRoutes.ts`, redirect în `FolderView.tsx`).
- **Grilele generate de AI** merg automat în `Rezidențiat › Grile › <specialitate>` (`src/lib/rezidentiatPlacement.ts`): după capitol, carte sau subiect liber (mielom → Hematologie). Folderul se creează abia după succes. Grilele rătăcite în rădăcina Rezidențiat se mută singure în „Grile” la deschiderea paginii. Eticheta `rezidentiat` se pune doar la plasare, nu pentru orice set în format de examen.
- **AI/chat:** comenzi în română înțelese corect (`src/lib/ai/studioChatCommands.ts` + teste), erori prietenoase (`src/lib/ai/friendlyError.ts`), 429 cu reset lung nu mai blochează coada, Stop nu mai salvează generarea la retry, Studio ca panou alăturat pe ferestre late.
- **Alte corecții:** butonul „Aspect” (fiecare clic schimbă vizibil), lag la „Folder nou” (`newFolderDialogStore.ts`), raportul „Ce nu știu?” randat ca markdown, contrast AA pe tema luminoasă, meniul „⋯” din Biblioteca AI, acțiuni accesibile la tastatură/touch, `MotionConfig reducedMotion="user"`.

## De făcut (ordinea recomandată)
1. **Pagina Flashcarduri (`src/pages/FlashcardHub.tsx`, `src/pages/flashcard-hub/sections.tsx`):** utilizatorul a aprobat direcția din previzualizare, dar **nu s-a implementat**. Structura dorită: sus cardul „De repetat azi” (număr de carduri, timp estimat, buton „Începe repetarea”, progres, serie); apoi „Pachetele tale” (listă cu progres); apoi „Creează pachet nou” (AI din curs cu 10/25/50/100 și din greșeli ca două carduri; import poze/CSV/Anki și pachet rapid ca listă compactă). Aerisit, stil Apple, ca `Residency.tsx`. Se arată întâi o previzualizare, apoi se construiește.
2. **Risc de pierdere de date în Electron** (`src/store/profileStorage.ts`): `flushProfileDataSync` actualizează cache-ul, apoi `saveProfileData` iese devreme (`serialized === cache`) fără să scrie pe disc, iar la repornire `read()` preferă discul și ignoră copia mai nouă din localStorage. Modificările din ultimele secunde (minimizare, schimbare de profil) pot dispărea. Nevoie de test cu `electronAPI` simulat. Legat: o generare AI pornită pe un profil și terminată după schimbarea profilului adaugă grilele în alt profil.
3. **Verificare manuală pe desktop** (`npm run electron:dev`), în special: cardul „Alte grile” a dispărut din pagina Rezidențiat după mutarea automată; comanda „fă-mi 5 grile din mielom multiplu” în chatul Rezidențiat ajunge în Grile › Hematologie; Studio în chat (coloană lângă mesaje); ambele teme; importul unui PDF (pdf.js 6).
4. **Dublu scroll în ~17 pagini** (`h-full overflow-y-auto` în interiorul `.route-scroll-host`, deci `ScrollToTopButton` nu apare niciodată) și **~10 ferestre modale fără `Portal`** (GlobalSearch, cititorul din KnowledgeVault, `BookChapterReaderModal`, `QuestionPreviewModal`, ecranele din flashcard-hub etc.), prinse sub `zIndex:1` din `App.tsx` și deci sub bara laterală. Remediu propus: un set de tokeni z (sidebar 50 / modal 200 / popover 300 / toast 500 / tur 600) și mutarea modalelor în `Portal`.
5. **Alte constatări ale auditului, încă neatinse:** culori „dark” hardcodate pe suprafață albă în Luminos (`QuizResults.tsx`, `Stats.tsx`, `QuizCard.tsx`, `Tutorial.tsx`, `PomodoroTimer.tsx`); text accent mic pe alb sub 4.5:1 (nevoie de token `--accent-text`); overlay-uri cu `rgba(0,0,0,…)` în loc de `var(--overlay)`; gate de hidratare pentru paginile Rezidențiat (înainte de hidratare apar mesaje „gol”); arhivarea unei grile Rezidențiat o face inaccesibilă (nu există listă „Arhivate”); ștergerea unui folder din chat lasă grilele fără folder; căutarea din Biblioteca AI nu ignoră diacriticele; `BookShelf` tratează `indexStatus` lipsă ca eroare; „Golește conversația” fără confirmare; tab-ul „Carduri” din disciplină listează toate pachetele AI, nu doar ale disciplinei.
6. **CI:** pașii inexistenți au fost înlocuiți (`test:run`, `npx playwright test`); e nevoie de o rulare pe GitHub ca să se confirme.
7. **Majore amânate:** `eslint` 10 (cere `eslint-plugin-react-hooks` ≥ 7.1), `typescript` 7, `tesseract.js` 7.
8. **Decizii de produs deschise:** `calcNextReview` (scăderea `eFactor` la lapse, schimbare SM-2 neconfirmată); cele ~270 de grile lipsă din Lawrence/Kumar și ~25 din `modele-grile` nepotrivite automat cu PDF-ul; duplicatele din bănci (~7% grile identice: contează la numitorii de progres); sufixele „(pg. 28)” rămase la ~470 de întrebări.

## Cum se verifică
`npx tsc -b` · `npx eslint .` · `npx vitest run` (la ultima verificare: 534 trecute, 1 sărit) · `npx vite build` · `node scripts/scan-secrets.cjs` · `node scripts/verify-runtime.cjs`.

## Capcane de mediu (Windows)
- `npm` pică cu `EBUSY` dacă rulează `electron:dev` (blochează `node_modules/electron`): oprește-l înainte de update. Dacă testele pică cu `LRUCache is not a constructor`, rulează `npm install` (arborele `node_modules` se strică uneori).
- `allowScripts` din `package.json` fixează versiuni exacte (electron, core-js…): aliniază-le după update.
- Commit-urile locale folosesc identitatea `StudyX <studyx@local.dev>` (git nu are identitate globală): `git -c user.name=StudyX -c user.email=studyx@local.dev commit …`.
- În scripturile Python/Node scrise prin heredoc de shell, ghilimelele și backslash-urile se strică: scrie scripturile ca fișiere (instrumentul Write) și rulează-le.
- Serverul de dezvoltare de pe portul 5173 poate fi al utilizatorului (`electron:dev`), deci previzualizarea în browser folosește un profil local separat (gol): grilele trebuie importate din pagina Rezidențiat („De adăugat”) ca să vezi datele.
- Datele aplicației sunt pe profil (`studyx-p-<id>-quizzes|folders|stats` în localStorage și în fișiere pe disc în Electron); nu modifica formatul fără migrare.

## Preferințe ale utilizatorului
Comunicare în română, răspunsuri concise; stil vizual Apple, minimalist, aerisit, cu detalii fine; vrea să vadă **previzualizări înainte de schimbări mari de interfață**; nu lansează versiuni fără să spună; îi plac organizarea clară (disciplină → specialitate) și comportamentul „inteligent” (iconițe și plasări automate). Când raportează o problemă cu o captură, e de obicei o problemă reală de grafică sau de logică: verifică în browser, nu doar în cod.
