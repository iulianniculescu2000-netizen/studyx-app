# Plan: tutorialele și turul interactiv pentru StudyX 2.3.0

Stare (2026-10-01): **implementat** (fazele F0–F4, comise local în `feat/rezidentiat-redesign`); F5 parțial: verificat în previzualizarea din browser, nu și în Electron sau cu Playwright. Detaliile sunt în `docs/HANDOFF.md`, secțiunea 4. Decizii luate pe propunerile din secțiunea 10. Textul de mai jos e planul inițial.

## 1. Ce vrem
- Un student nou ajunge în 2–3 minute la primul lucru util (o grilă jucată, un pachet de carduri, AI activat), nu la o prezentare de 22 de ecrane.
- Un student existent vede **doar ce s-a schimbat** în 2.3.0, cu trimitere directă la funcția nouă.
- AI-ul și cheile gratuite sunt explicate **adaptiv**: după câte chei are deja utilizatorul (0, 1 sau mai multe), nu cu același text pentru toți.
- Turul poate fi reluat oricând, pe pagina unde ești (nu doar din Setări), și nu se strică când interfața se schimbă.

## 2. Ce există acum (inventar, cu probleme găsite)

| Piesă | Fișier | Stare |
|---|---|---|
| Tur interactiv cu spotlight, 22 de pași, pornește automat la fiecare profil nou | `src/components/Tutorial.tsx`, `src/store/tutorialStore.ts`, `src/hooks/useTutorialBootstrap.ts` | Conținut din 2.1/2.2: nu știe de Rezidențiat redesenat, hubul de Flashcarduri nou, Studio ca panou, generarea cu notificare |
| „Ce e nou” cu mini-demo-uri animate | `src/components/WhatsNewTour.tsx` (`WHATS_NEW_VERSION = '2.2.0'`, cheie `…-v22b`) | 6 slide-uri 2.2; cheia de „văzut” e legată de versiune, deci pentru 2.3.0 trebuie conținut nou |
| Tur Rezidențiat, 6 slide-uri | `src/components/RezidentiatTutorial.tsx` (cheie `…rezidentiat:v2`) | Descrie pagina veche, înainte de redesenare |
| Fâșia „Știai că” | `src/components/dashboard/DashboardTipStrip.tsx` | Funcționează; se poate folosi pentru descoperire continuă |
| Reluare din Setări | `src/pages/Settings.tsx` (rândul „Tutorial”) | Pornește mereu turul complet de la 0 |

Probleme concrete găsite în `Tutorial.tsx`:
1. **Anchor lipsă:** pasul `flashcard_session` țintește `[data-tutorial="flashcard-hub"]`, care nu există în nicio pagină, deci pasul cade tăcut pe card centrat.
2. **Două surse de adevăr:** `TOTAL_STEPS = 22` e hard-codat separat de `STEPS` și de uniunea `TutorialStepId`; un pas adăugat fără să le sincronizezi rupe sfârșitul turului.
3. **Clic pe fundalul întunecat avansează turul** (și la ultimul pas îl încheie): un clic greșit și pierzi tot.
4. **Fără accesibilitate:** niciun `role="dialog"`, fără navigare cu tastatura (←/→/Esc), fără gestionarea focusului.
5. **Pasul de AI se contrazice:** titlul spune „cele trei chei”, textul vorbește despre patru furnizori și cifre de limită hard-codate („1.000.000 tokeni/zi”, „~1 miliard/lună”) care se schimbă fără să știm.
6. **Nu e interactiv:** doar luminează și navighează singur; utilizatorul nu face nimic.
7. **Se termină o dată pe profil:** un student care a terminat turul 2.2 nu vede niciodată nimic din 2.3.0.

## 3. Principii
1. **Date, nu cod:** pașii sunt definiții într-un registru; motorul e unul singur.
2. **Scurt:** onboarding de ~10 pași, restul în mini-tururi pe pagină.
3. **Adaptiv:** pașii pot avea condiții (ex. „arată doar dacă nu ai niciun pachet de carduri”).
4. **„Fă tu” unde contează:** 3–4 pași cer o acțiune reală (detectată), restul doar luminează. Mereu cu „Sari peste”.
5. **Nu promite ce nu e adevărat:** textul despre AI spune exact ce face aplicația azi.
6. **Rezistent la schimbări:** un test verifică automat că fiecare țintă a unui pas există într-o pagină.

## 4. Arhitectură propusă
- Folder nou `src/tutorial/`:
  - `types.ts`: `TourStep` (`id`, `title`, `body`, `target?`, `route?`, `placement?`, `when?: (ctx) => boolean`, `completeWhen?`, `body` poate fi funcție de context pentru textul adaptiv).
  - `tours/onboarding.ts`, `tours/whatsNew230.ts`, `tours/residency.ts`, `tours/flashcards.ts`, `tours/vault.ts`: conținutul.
  - `TourEngine.tsx`: spotlight, poziționare, tastatură, focus; refolosește partea bună din `useSpotlight`/`getTooltipStyle` (au deja rezolvate fereastră îngustă, ținte în afara ecranului, anti-tremur).
  - `useTourContext.ts`: citește starea (câte chei AI, există pachete, există grile, profil nou sau existent, pagina curentă).
- `tutorialStore` devine versionat: `seen: Record<tourId, versiune>` în loc de `completedProfiles`. Migrare: profilurile din `completedProfiles` primesc `onboarding: '2.2'`, deci **nu** revăd onboardingul, dar văd „Noutăți 2.3.0”.
- `TOTAL_STEPS` dispare: lungimea vine din registru.
- Anchorii `data-tutorial` rămân convenția; se adaugă pe paginile noi (Rezidențiat, hubul de Flashcarduri, cardul „Pachet creat”, selectorul AI).

## 5. Conținut propus

### 5.1 Onboarding (utilizator nou, ~10 pași)
1. Bun venit (ce e StudyX, o propoziție).
2. Bara laterală: Studiu / Resurse / Foldere; „Restrânge” funcționează.
3. **Fă tu:** creează sau importă prima grilă (detectat când apare o grilă).
4. Moduri de joc (Studiu, Examen, Cronometrat, Rezidențiat), compact.
5. Flashcarduri: cardul „De repetat azi”, pachetele, „Creează pachet nou”.
6. Repetare spațiată: un exemplu, nu teorie (cardul „Greu/Bine/Ușor”).
7. Biblioteca AI: încarci un curs, AI-ul îl indexează.
8. **AI-ul tău, gratuit** (vezi 5.4): pas adaptiv.
9. Chat și agent: o comandă exemplu („fă-mi 5 grile din mielom multiplu”).
10. Căutare Ctrl+K, scurtături `?`, backup.
- **Ies:** Notițe, Pomodoro, profiluri, statistici (devin mini-tururi sau „Știai că”, nu pași obligatorii).

### 5.2 „Ce e nou în 2.3.0” (utilizator existent, 6 slide-uri + salt la funcție)
1. **Rezidențiat redesenat:** discipline → specialități; grilele generate de AI intră singure în Grile › specialitate.
2. **Flashcarduri:** „De repetat azi”, ștergere pachete, notificare „generate în folderul X” cu „Mută în”, continuare după limită, text curățat (diacritice, fără `**`).
3. **Biblioteca AI redesenată.**
4. **Chat:** comenzi în română înțelese corect, erori prietenoase, Studio ca panou lateral.
5. **Interfață:** contrast mai bun în tema Luminos, „Aspect”, mișcare redusă respectată, bara laterală animată.
6. **Mai multe chei AI = rezerve automate** (cu trimitere la 5.4).
- Fiecare slide are buton „Arată-mi” care duce la pagina respectivă și pornește mini-turul ei.
- Nu intră în tur: eliminarea Android (se spune în notele de lansare, nu aici).

### 5.3 Mini-tururi pe pagină (buton „?” în antet)
- **Rezidențiat** (rescris pe pagina nouă), **Flashcarduri** (hubul nou, inclusiv cardul „Pachet creat” după prima generare), **Biblioteca AI** (încărcare → indexare → folosire).
- Pornesc o singură dată la prima vizită după update, apoi doar la cerere.

### 5.4 Pasul „AI-ul tău, gratuit” (cerința pentru partea smart)
Conținutul se alege după câte chei salvate sunt în `aiStore.providerKeys`:
- **0 chei:** „Fără AI merg grilele, flashcardurile și repetarea. Cu AI primești generare de carduri/grile, chat și agent. Durează ~2 minute: alegi un furnizor, faci cont (fără card), copiezi cheia.” Butoane: deschide pagina furnizorului (linkurile sunt deja în `AISettings.tsx`) și un câmp „lipește cheia aici” cu **testare** prin `validateApiKey`, cu ✓ sau eroarea explicată.
- **1 cheie:** „Ai {furnizor}. Merge, dar limita gratuită pe minut se atinge repede la cursuri mari. Adaugă o a doua cheie (Gemini, Cerebras sau Mistral): când prima e plină, StudyX trece singur pe următoarea.” Buton „Adaugă încă o cheie”.
- **2 sau mai multe:** „Ai rezerve active” cu bife per furnizor; fără insistență.
- Reguli de text: **fără cifre de limită hard-codate** (se schimbă); trimitere la pagina furnizorului pentru limitele curente.
- Adevărul tehnic de respectat: trecerea automată pe următorul furnizor există în `groq.ts`; **reluarea** unei generări întrerupte există acum doar în Flashcarduri (hub), nu peste tot. Textul spune exact asta.
- Confidențialitate, o propoziție: cheile rămân pe dispozitiv; textul cursurilor merge la furnizorul ales când folosești AI; unele planuri gratuite pot folosi datele la antrenare, deci verifică termenii.
- Aceeași componentă se montează și în **Setări → Asistent AI**, ca „Ghid chei”, ca să nu existe două texte care divergă.
- Legătură cu ideea de „contor de limită”: când va exista, pasul arată starea live pe furnizor în loc de text.

## 6. Interactivitate (cum detectăm „fă tu”)
- `completeWhen` e un predicat peste stări deja existente: număr de grile/pachete, rută, cheie validă. Fără handlere noi în aplicație.
- Dacă utilizatorul nu face acțiunea, „Sari peste” avansează; niciun pas nu blochează.
- Clic pe fundal **nu** mai avansează; doar butoanele și tastele.

## 7. Accesibilitate și robustețe
- `role="dialog"`, `aria-labelledby`, focus mutat în card și readus la închidere; ←/→/Enter/Esc; indicator „Pas 3 din 10”.
- Respectă `prefers-reduced-motion` (aplicația are deja `MotionConfig reducedMotion="user"`) și modul de performanță „lite”.
- Contrast verificat în ambele teme; fereastră îngustă: card centrat (logica există).
- Z-index: se aliniază cu jetoanele propuse în `HANDOFF.md` (tur peste modale, sub nimic).
- Țintă lipsă: cardul se centrează și pașii care depind de ea se marchează în test, nu rămân tăcuți.

## 8. Faze (în ordine; fiecare se poate livra separat)
| Fază | Conținut | Efort |
|---|---|---|
| F0 | Reparații rapide în turul actual: anchorul lipsă, `TOTAL_STEPS` din `STEPS.length`, titlul pasului AI, scos avansarea la clic pe fundal | ~0,5 zi |
| F1 | Motor + registru + store versionat + tastatură/a11y + test care verifică ținte și id-uri | 1,5–2 zile |
| F2 | Onboarding nou (5.1) + pasul AI adaptiv (5.4) + „Ghid chei” în Setări | 1–1,5 zile |
| F3 | „Ce e nou 2.3.0” (5.2) + migrarea utilizatorilor existenți | 1 zi |
| F4 | Mini-tururi Rezidențiat, Flashcarduri, Biblioteca AI (5.3) + buton „?” | 1 zi |
| F5 | Verificare: parcurs Playwright (Luminos/Întunecat, fereastră îngustă, mod „lite”), capturi, note în `HANDOFF.md` | 0,5–1 zi |

Total orientativ: **5–7 zile de lucru.** Se arată o previzualizare a cardului de tur (stil Apple, ca pagina Rezidențiat) înainte de F2.

## 9. Verificare
- Unit: fiecare `target` din registru există ca `data-tutorial` în cod; id-urile pașilor sunt unice; `when`/`completeWhen` nu aruncă erori pe stări goale.
- Unit: migrarea `completedProfiles` → `seen` păstrează „nu mai pornesc onboardingul” pentru profilurile vechi.
- E2E (Playwright, deja în proiect): parcurge onboardingul și „Noutăți 2.3.0”, cu tastatura și cu mouse-ul, în ambele teme.
- Manual pe `npm run electron:dev`: profil nou, profil vechi, fereastră îngustă, fără cheie AI, cu o cheie, cu două.

## 10. Decizii de luat (propunerile mele între paranteze)
1. Un singur tur lung sau tururi scurte pe pagini? (**scurte + onboarding de ~10 pași**)
2. Studenții existenți văd doar „Noutăți 2.3.0” sau și onboardingul complet? (**doar noutăți; onboardingul îl pot relua din Setări**)
3. Câți pași „fă tu”? (**3–4**, restul doar spotlight)
4. Câmp de cheie + testare chiar în tur? (**da**, cu linkuri directe către furnizori)
5. Păstrăm cifre de limită în text? (**nu**; trimitere la pagina furnizorului)
6. Calendar: ordinea F0 → F1 → F2…, iar lansarea 2.3.0 rămâne decizia ta.
