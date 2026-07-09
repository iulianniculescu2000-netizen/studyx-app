# 🗺️ StudyX — Inventar complet de funcții

> **Versiune:** 1.0.5
> **Tip:** Aplicație desktop (Electron + React + Vite + TypeScript) pentru studenți la medicină — grile, flashcarduri, notițe, asistent AI.
> **Generat:** 16 iunie 2026

Legendă status: ✅ Complet · ⚠️ Parțial / cosmetic · 🛠️ De aliniat

---

## 1. 📚 Quiz-uri / Grile (nucleul aplicației)

| Funcție | Status | Locație |
|---|---|---|
| Listă grile cu căutare (titlu/descriere/subiect) | ✅ | `src/pages/QuizList.tsx` |
| Creare grilă manuală (întrebări, opțiuni, explicații, tag-uri) | ✅ | `src/pages/QuizCreate.tsx` |
| Generare grile din text/AI | ✅ | `src/pages/quiz-create/sections.tsx` |
| Import grile (JSON/fișier) | ✅ | `src/components/ImportQuizButton.tsx` |
| Joc grilă (play) cu progres, scor, notițe per întrebare | ✅ | `src/pages/quiz-play/QuizPlayRefactored.tsx` |
| Rezultate grilă | ✅ | `src/pages/QuizResults.tsx` |
| Detalii grilă + căutare în întrebări | ✅ | `src/pages/QuizDetail.tsx` |
| Pin / Arhivare / Duplicare / Ștergere | ✅ | `src/store/quizStore.ts` |
| Operații bulk (ștergere/mutare multiplă) | ✅ | `src/store/quizStore.ts` |
| Imagini în întrebări (extracție din PDF) | ✅ | `src/components/QuizImage.tsx`, `src/lib/imageProcessing.ts` |
| Cleanup imagini orfane | ✅ | `src/store/quizStore.ts` |

## 2. 🗂️ Bibliotecă / Foldere

| Funcție | Status | Locație |
|---|---|---|
| Foldere + subfoldere reale recursive | ✅ (v1.0.5) | `src/store/folderStore.ts` |
| Mutare grile între foldere | ✅ | `src/store/quizStore.ts` |
| Personalizare folder (emoji, culoare) | ✅ | `src/lib/folderAppearance.ts` |
| Knowledge Vault (bibliotecă de documente) | ✅ | `src/pages/KnowledgeVault.tsx` |
| FolderView cu subfoldere | ✅ | `src/pages/FolderView.tsx` |

## 3. 🎴 Flashcarduri

| Funcție | Status | Locație |
|---|---|---|
| Hub flashcarduri | ✅ | `src/pages/FlashcardHub.tsx` |
| Creare/editare carduri (față/spate) | ✅ | `src/pages/Flashcard.tsx` |
| Sesiune de studiu flashcard | ✅ | `src/pages/FlashcardSession.tsx` |
| Imagini în flashcarduri (smart extraction, IndexedDB) | ✅ (v1.0.4/1.0.5) | `src/lib/flashcardImageStore.ts` |
| Generare flashcarduri din notițe (AI) | ✅ | `src/lib/ai/agent.ts` |

## 4. 📝 Notițe

| Funcție | Status | Locație |
|---|---|---|
| Editor notițe cu căutare | ✅ | `src/pages/Notes.tsx`, `src/store/notesStore.ts` |

## 5. 🔁 Repetiție spațiată / Review

| Funcție | Status | Locație |
|---|---|---|
| Daily Review (întrebări scadente) | ✅ | `src/pages/DailyReview.tsx` |
| Review Mode (întrebări slabe) | ✅ | `src/pages/ReviewMode.tsx` |
| Algoritm scadențe (`getDueQuestions`, `getWeakQuestions`) | ✅ | `src/store/statsStore.ts` |
| Studiu adaptiv | ✅ | `src/lib/adaptiveStudy.ts` |

## 6. 🤖 Asistent AI

| Funcție | Status | Locație |
|---|---|---|
| Chat AI (drawer) cu thread conversațional | ✅ | `src/components/AIChatDrawer.tsx` |
| Streaming răspunsuri + markdown | ✅ | `src/ai/AIEngine.ts` |
| Detectare intenție (intent router) | ✅ | `src/lib/ai/intentRouter.ts` |
| Agent cu tool-uri (creare folder, generare pachet grile, flashcarduri, plan studiu, mutare/redenumire/ștergere, rezumat document) | ✅ | `src/lib/ai/agent.ts` |
| Undo pentru acțiuni agent + retry („mai încearcă") | ✅ (v1.0.5) | `src/lib/ai/agent.ts` |
| Generare hint / mnemonic / explicații opțiuni greșite | ✅ | `src/ai/AIEngine.ts` |
| Generare din „banca de greșeli" | ✅ | `src/ai/AIEngine.ts` (`generateFromMistakeBank`) |
| Plan de studiu (subfolder-aware) | ✅ | `src/lib/ai/agent.ts` |
| Procesare documente: PDF, DOCX, OCR | ✅ | `src/ai/pdfParser.ts`, `src/ai/docxParser.ts`, `src/ai/ocrParser.ts` |
| RAG: chunking, embeddings, vector store, retriever | ✅ | `src/ai/retriever.ts`, `src/ai/vectorStore.ts`, `src/ai/chunker.ts` |
| Provideri: Groq (Llama 4, vision) + Google Gemini | ✅ (v1.0.5) | `src/lib/groq.ts` |
| Setări AI (chei API per-provider) | ✅ | `src/components/AISettings.tsx` |
| Rate limiting / governor cereri | ✅ | `src/lib/aiRequestGovernor.ts` |
| Generare în loturi (batch) | ✅ | `src/lib/ai/batchQuizGeneration.ts` |

## 7. 📊 Statistici & Analytics

| Funcție | Status | Locație |
|---|---|---|
| Stats overview, trend acuratețe, grafic activitate, heatmap, radar categorii | ✅ | `src/components/stats/` |
| Analytics predictiv (predicții examen, lacune, căi de studiu) — pe date reale | ✅ | `src/components/analytics/AIPredictiveRefactored.tsx` |

## 8. 🎮 Gamification

| Funcție | Status | Locație |
|---|---|---|
| Achievements (din statistici reale) | ✅ | `src/components/gamification/AIGamificationAchievements.tsx` |
| Challenges (zilnice/săptămânale) | ✅ | `src/components/gamification/AIGamificationChallenges.tsx` |
| Stats utilizator (puncte, nivel, streak) | ✅ | `src/components/gamification/AIGamificationStats.tsx` |
| Leaderboard → „Tu vs. Tine" | ✅ (rezolvat) — înlocuit cu comparație pe date reale (azi/ieri/media săptămânii/cel mai bun), fără competitori ficțiuni | `src/components/gamification/AIGamificationSelfComparison.tsx` |

## 9. 🏠 Dashboard & Navigare

| Funcție | Status | Locație |
|---|---|---|
| Dashboard (carduri stat, progres azi, AI study buddy) | ✅ | `src/pages/Dashboard.tsx` |
| Sidebar / Navbar / TitleBar (custom window controls) | ✅ | `src/components/` |
| Căutare globală (Cmd+K) | ✅ | `src/components/GlobalSearch.tsx` |
| Scurtături tastatură | ✅ | `src/hooks/useKeyboardShortcuts.tsx` |
| Profiluri multiple (select/creare) | ✅ | `src/pages/ProfileSelect.tsx` |
| Welcome / onboarding | ✅ | `src/pages/Welcome.tsx` |

## 10. 🧰 Productivitate

| Funcție | Status | Locație |
|---|---|---|
| Pomodoro Timer | ✅ | `src/components/PomodoroTimer.tsx` |
| Focus Mode | ✅ | `src/store/focusModeStore.ts` |
| Tutorial / What's New tour | ✅ | `src/components/Tutorial.tsx`, `src/components/WhatsNewTour.tsx` |
| Notificări desktop | ✅ | `src/lib/desktopNotify.ts` |
| Study Coach | ✅ | `src/lib/studyCoach.ts` |

## 11. 💾 Date, backup, sistem

| Funcție | Status | Locație |
|---|---|---|
| Export / import backup | ✅ | `src/components/BackupExport.tsx` |
| Auto-backup | ✅ | `src/hooks/useAutoBackup.ts` |
| Stocare IndexedDB | ✅ | `src/lib/idb.ts` |
| Mod offline + service worker | ✅ | `src/lib/offline/`, `src/utils/serviceWorker.ts` |
| Health check pornire + rollback + guard sesiune | ✅ | `src/lib/startupHealthCheck.ts`, `src/lib/rollback.ts` |
| Optimizare performanță (device tier, motion adaptiv, memory profiler) | ✅ | `src/lib/deviceTier.ts`, `src/hooks/usePerformanceOptimizer.ts` |
| Auto-update (Electron updater, manifest GitHub) | ✅ | `electron/updater.cjs`, `src/components/UpdateModal.tsx` |

## 12. 🎨 UI / Accesibilitate

- Splash screen, animated background, magnetic buttons, premium select/tooltip — ✅
- ErrorBoundary global + per-rută — ✅
- Theme toggle (dark/light), skeleton loaders, toast notifications — ✅
- Componente accesibile + focus trap — ✅
- Storybook stories pentru câteva componente — ✅

## 13. 🧪 Testare / Build / Dev

- Vitest (unit) + smoke tests (boot, diagnostics, storage) — ✅
- Playwright (E2E) — ✅
- Lighthouse CI, bundle analyzer, security scan (secrete) — ✅
- Pipeline electron-builder + publish release — ✅

---

## ⚠️ Incomplete / De atenție

1. **🛠️ Inconsistență versiune** — `version.json` = `1.0.3`, dar `package.json` = `1.0.5`. Auto-update-ul citește `version.json` → clienții pot să nu vadă update-ul corect. De aliniat.

2. **Suprapunere organizare** — `KnowledgeVault` / `FolderView` / `Notes` au funcționalități parțial suprapuse. Nimic stricat, dar zonă de simplificat.

---

## 🧭 Rute aplicație (HashRouter)

| Rută | Pagină |
|---|---|
| `/` | Dashboard |
| `/quizzes` | Listă grile |
| `/quiz/:id` | Detalii grilă |
| `/folder/:id` | Folder |
| `/create` | Creare grilă |
| `/play/:id` | Joc grilă |
| `/results/:id` | Rezultate |
| `/stats` | Statistici |
| `/review` | Review mode |
| `/daily-review` | Review zilnic |
| `/vault` | Knowledge Vault |
| `/flashcards` | Hub flashcarduri |
| `/flashcards/session/:id` | Sesiune flashcard |
| `/notes` | Notițe |
| `/settings` | Setări |
| `/gamification` | Gamification |
| `/analytics` | Analytics predictiv |
