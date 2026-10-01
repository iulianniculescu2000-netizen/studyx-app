# StudyX — stare curentă și predare (2026-10-01)

Pentru cine (om sau chat nou) reia lucrul. Citește întâi secțiunile 1–3; restul e referință.

## 1. Reguli care nu se negociază
- Versiunea din `package.json` e încă **2.2.0**; lansarea țintă este **v2.3.0**, dar **nu s-a lansat nimic** și nu există tag nou. **Nu crea tag-uri, nu schimba versiunea, nu face merge în `main` și nu lansa fără acordul explicit al utilizatorului.** Un tag `v*` pornește workflow-ul de release.
- Nu face commit sau push decât dacă ți se cere. Push-ul cere autentificare prin Git Credential Manager.
- Android a fost **eliminat definitiv** (cod, workflow, Capacitor).
- Datele aplicației sunt pe profil (`studyx-p-<id>-quizzes|folders|stats|notes|ai` în localStorage și în fișiere pe disc în Electron). Nu modifica formatul fără migrare.
- Comunicare în română, concis. Stil Apple, minimalist, aerisit. **Previzualizare înainte de schimbări mari de interfață.** Când utilizatorul trimite o captură, de obicei e o problemă reală: verifică în browser, nu doar în cod.

## 2. Unde suntem
- Repo: `C:\Users\Iulia\Desktop\TOT\StudyX`, GitHub `iulianniculescu2000-netizen/studyx-app`.
- Ramura de lucru: **`feat/rezidentiat-redesign`**, **împinsă în GitHub** (la scrierea notei, `origin` era la `cf299f8`; ce s-a făcut după e comis local până la următorul push). Ancestori: `main` → `feat/rezidentiat-anki-fix-pierdere-date` → `feat/ui-apple` → `chore/maintenance-2026-09` (aceasta din urmă are 11 commit-uri care nu sunt pe origin ca ramură, dar sunt în GitHub prin ramura de lucru). `preview/apple-birou` e un prototip local vechi, poate fi ștearsă.
- Pentru lansare: PR de pe `feat/rezidentiat-redesign` spre `main`, apoi versiune + tag — **doar cu acordul utilizatorului**.
- Verificat la ultima rulare: `npx tsc -b` curat, `npx eslint .` curat, `npx vitest run` **576 trecute, 1 sărit**, `node scripts/scan-secrets.cjs` ok. Totul a fost testat în teste și în previzualizarea din browser cu **AI simulat**; **nimic nu a fost încercat cu o cheie AI reală** și nici în Electron (`npm run electron:dev`).

## 3. De făcut (ordinea recomandată)
1. **Verificare manuală pe desktop** (`npm run electron:dev`, cu o cheie reală): generarea de flashcarduri din Biblioteca AI și din PDF (progres, notificare, „Mută în”, „Pachet creat parțial” + „Continuă generarea”), panoul „Consum AI” din Setări (headerele de limită ale Groq ajung în renderer?), animația „Restrânge” a barei laterale, ferestrele cu Esc/focus, comanda „fă-mi 5 grile din mielom multiplu” în chatul Rezidențiat (→ Grile › Hematologie), importul unui PDF (pdf.js 6), ambele teme.
2. **Tutoriale 2.3.0** — plan în `docs/PLAN-tutoriale-v2.3.0.md` (motor + registru, onboarding nou, „Ce e nou 2.3.0”, mini-tururi, pas adaptiv despre chei AI gratuite după câte chei are utilizatorul). **Neimplementat**; așteaptă deciziile din secțiunea 10 a planului. F0 (reparațiile rapide) e făcută în mare parte.
3. **Constatări rămase din audit** (confirmate de agenți, neatinse):
   - Rezidențiat: grilele **arhivate** nu au secțiune „Arhivate” și sunt greu de găsit; `?s=` către o specialitate goală cade pe prima; `adoptStrayResidencyQuizzes` pierde progresul din sesiunile „mix” și suprascrie `category`; `TOPIC_RULES` pune „hematom subdural” la Hematologie și „diabet insipid” la Diabet zaharat; `useStudioGeneration` creează un folder gol când numele cerut e ignorat în firul Rezidențiat; `useResidencyBooks` ignoră cărțile din subfoldere; formularele „Folder nou” din Vault au `onBlur={submit}` (de verificat în Electron dacă dublează folderul); tab-ul „Carduri” din disciplină listează toate pachetele AI.
   - AI: `extractJsonArrayLenient` (`jsonExtract.ts`) alege array-ul greșit la răspunsuri trunchiate; `sleepWithCountdown` nu poate fi anulat; sleep-urile de backoff ignoră `abortSignal`.
   - UI: butoanele de folder din bara laterală apar doar la hover; **dublu scroll** în ~17 pagini (`h-full overflow-y-auto` în `.route-scroll-host`, deci `ScrollToTopButton` nu apare); ~10 modale fără `Portal` (GlobalSearch, cititorul din KnowledgeVault, `BookChapterReaderModal`, `QuestionPreviewModal`…) cu `zIndex:1` din `App.tsx`; remediu propus: tokeni z (sidebar 50 / modal 200 / popover 300 / toast 500 / tur 600); `Tutorial` persistă `active/currentStep`; culori „dark” hardcodate pe suprafață albă în Luminos (`QuizResults.tsx`, `Stats.tsx`, `QuizCard.tsx`, `PomodoroTimer.tsx`); text accent mic sub 4.5:1 (token `--accent-text`); overlay-uri `rgba(0,0,0,…)` în loc de `var(--overlay)`; „Golește conversația” fără confirmare.
   - Flashcarduri: starea de reluare se pierde la navigare (e locală în `FlashcardHub`); `isDuplicateFlashcard` poate da fals pozitiv pe fronturi scurte; imaginile PDF sunt inline în quiz (risc de cotă localStorage).
4. **CI:** pașii inexistenți au fost înlocuiți (`test:run`, `npx playwright test`); e nevoie de o rulare pe GitHub ca să se confirme.
5. **Majore amânate:** `eslint` 10 (cere `eslint-plugin-react-hooks` ≥ 7.1), `typescript` 7, `tesseract.js` 7.
6. **Decizii de produs deschise:** `calcNextReview` (scăderea `eFactor` la lapse, schimbare SM-2 neconfirmată); ~270 de grile lipsă din Lawrence/Kumar (17 teste) și ~25 din `modele-grile` nepotrivite cu PDF-ul; duplicatele din bănci (~7% grile identice: contează la numitorii de progres); sufixele „(pg. 28)” la ~470 de întrebări; **ruterul AI pe sarcini** (ordinea furnizorilor după mărimea cererii, doar pentru cine are mai multe chei) și „Verifică cu alt model” — discutate, neimplementate.

## 4. Ce s-a făcut (pe scurt, fiecare cu fișierele-cheie)
- **Date grile** (sesiunea anterioară): `modele-grile.json` verificat față de PDF (18 chei corectate, 86 de titluri curățate); `lawrence-kumar.json` verificat.
- **Rezidențiat:** pagina redesenată (`src/pages/Residency.tsx`, `ResidencyDiscipline.tsx`, `src/lib/rezidentiatOverview.ts`, `src/components/residency/`); navigare unitară (`rezidentiatRoutes.ts`, redirect în `FolderView.tsx`, cu `?plain=1` pentru foldere goale); grilele AI se plasează singure în Grile › specialitate (`rezidentiatPlacement.ts`); cele rămase fără folder apar la „Alte grile”; gate de hidratare; importul de bancă nu mai dublează rădăcina; numele de folder din chat se potrivește cu folderele existente (`studioChatCommands.ts`).
- **Biblioteca AI:** pagină redesenată (`KnowledgeVault.tsx`); căutare fără diacritice; `isSourceReady` comun (`aiStore.ts`).
- **Pagina Flashcarduri** (`FlashcardHub.tsx`, `flashcard-hub/sections.tsx`): „De repetat azi” (restante + noi, serie), pachete cu editare și **ștergere cu confirmare**, „Creează pachet nou” (AI din curs 10/25/50/100, din greșeli, importuri). Generarea AI nu mai deschide sesiunea: toast + card „Pachet creat” cu „Mută în”; folder implicit = cel din „Salvează în”, altfel sugerat după numele cursului (`src/lib/flashcardPlacement.ts`). Dacă AI-ul pică la mijloc: „Pachet creat parțial” + „Continuă generarea” cu numărătoare (`FlashcardGenerationInterrupted`, `NoNewFlashcardsError` în `groq.ts`); limitele sub ~75 s se așteaptă singure. Text curat la generare și la afișare (`src/lib/flashcardText.ts`: `ş/ţ`→`ș/ț`, fără `**`).
- **Stratul AI** (`src/lib/groq.ts`, `friendlyError.ts`): timeout 90 s, fallback sticky armat o singură dată și doar pentru erori de furnizor, Stop fără trecere pe alt furnizor, 402/405/410 neretentate, 429 fără blocaj de backoff, flux cu timeout pe furnizor, dubluri în același răspuns.
- **Contor de consum:** `src/store/aiUsageStore.ts`, `src/components/AIUsagePanel.tsx` (în Setări AI), `src/lib/ai/rateHeaders.ts`. Tokeni exacți când furnizorul îi raportează, estimați („≈”) pentru fluxul din chat; „limită pe minut” doar dacă furnizorul trimite `x-ratelimit-*`. **Nu există sold total** (furnizorii nu îl expun).
- **Setări AI:** fără Biblioteca AI; select tematic în memorie (`ChatMemoryPanel.tsx`).
- **Date/profil:** `profileStorage.ts` (flush sincron nu mai marchează „scris pe disc”; copia localStorage mai nouă câștigă; nimic nu se salvează pentru un profil nehidratat); `src/store/profileEpoch.ts` (epocă de profil verificată în `vectorStore.ts`, `addKnowledgeSource`, `agent.ts`, `useStudioGeneration.ts`, `AIChatDrawer.tsx`); `reconcileInterruptedIndexing` închide indexările rămase „indexing”.
- **UI:** `useFocusTrap` (Esc, Tab, focus, roluri) pe `ConfirmDialog`, „Folder nou”, modalele de examen, `EditDeckModal`; X încadrat; animația „Restrânge” (în modul `lite` era `duration: 0`); tooltip-uri în portal și `aria-label` pe bara restrânsă; gol de navigare 640–720 px închis; turul: spotlight corect, `role="dialog"`, ←/→/Esc, număr de pași derivat din listă, anchor `flashcard-hub` adăugat, test care păzește anchorii (`src/test/tutorialAnchors.test.ts`).
- **Corecții mai vechi:** butonul „Aspect”, lag la „Folder nou”, raportul „Ce nu știu?” ca markdown, contrast AA în tema luminoasă, `MotionConfig reducedMotion="user"`.

## 5. Cum se verifică
`npx tsc -b` · `npx eslint .` · `npx vitest run` · `npx vite build` · `node scripts/scan-secrets.cjs` · `node scripts/verify-runtime.cjs`.

## 6. Capcane (Windows și proiect)
- `npm` pică cu `EBUSY` dacă rulează `electron:dev`: oprește-l înainte de update. Dacă testele pică cu `LRUCache is not a constructor`, rulează `npm install`.
- `allowScripts` din `package.json` fixează versiuni exacte (electron, core-js…): aliniază-le după update.
- Commit-uri locale: `git -c user.name=StudyX -c user.email=studyx@local.dev commit …` (git nu are identitate globală).
- **Scripturi de patch:** ghilimelele și backslash-urile se strică în `node -e` și în heredoc-uri prin instrumentul Bash. Scrie scriptul ca fișier cu instrumentul Write și rulează-l; verifică fiecare înlocuire (`includes`) înainte să scrii fișierul.
- **Vitest:** `src/test/setup.ts` instalează **timere false global**. Cod cu `setTimeout` (limitatorul de cereri din `groq.ts`, numărători) cere `vi.advanceTimersByTimeAsync`; starea de modul a limitatorului cere `vi.resetModules()` per test (vezi `src/lib/groqFlashcards.test.ts`).
- **TypeScript:** `erasableSyntaxOnly` interzice parameter properties (`constructor(private x)`); `eslint-plugin-react-hooks` v7 interzice `Date.now()` în randare, reasignări în randare și `setState` sincron în efecte.
- **Previzualizare în browser:** serverul de pe 5173 poate fi al utilizatorului sau al sesiunii; dacă `preview_start` zice „port în uz”, folosește `navigate` pe `http://localhost:5173`. Panoul **nu desenează frame-uri** până nu ceri o captură (animațiile și tranzițiile de rută par blocate); un viewport emulat mai mare decât panoul taie captura. Profilul local al previzualizării e separat și gol; pentru AI folosește `fetch` simulat și o cheie falsă `gsk_…`, nu o cheie reală. Stările se pot seta din consolă cu `await import('/src/store/…ts')`.
- ESLint ignoră unele fișiere din `src/lib/ai/` (avertisment „ignored”); rulează `npx eslint .` pentru verdictul real.

## 7. Cum începi un chat nou
Lipește asta:

> Reiau lucrul la StudyX (`C:\Users\Iulia\Desktop\TOT\StudyX`, ramura `feat/rezidentiat-redesign`). Citește `docs/HANDOFF.md` (secțiunile 1–3), `docs/PLAN-tutoriale-v2.3.0.md` și, dacă urmează lansare sau update de dependențe, `docs/MAINTENANCE.md`, rulează `git status` și `npx tsc -b`, apoi propune-mi primul pas. Nu lansa, nu crea tag-uri, nu face commit sau push fără să-ți cer.

## 8. Preferințe ale utilizatorului
Română, concis; stil Apple, aerisit, cu detalii fine; previzualizare înainte de schimbări mari de UI; nu lansează versiuni fără să spună; îi plac organizarea clară (disciplină → specialitate) și comportamentul „inteligent” (iconițe, plasări automate, sugestii de folder). Preferă să discute ideile mari înainte să le implementăm („hai să discutăm înainte”).
