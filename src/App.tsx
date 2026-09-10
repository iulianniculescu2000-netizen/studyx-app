import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { HashRouter, Navigate, Route, Routes, useLocation as useRouterLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ThemeProvider, useTheme } from './theme/ThemeContext';
import { useUserStore } from './store/userStore';
import { useFocusModeStore } from './store/focusModeStore';
import { useTutorialStore } from './store/tutorialStore';
import { useAIStore } from './store/aiStore';
import { useQuizStore } from './store/quizStore';
import { useStatsStore } from './store/statsStore';
import { useToastStore } from './store/toastStore';
import { useSaveStatusStore } from './store/saveStatusStore';
import TitleBar from './components/TitleBar';
import WindowControls from './components/WindowControls';
import Sidebar from './components/Sidebar';
import MobileNav from './components/MobileNav';
import { useViewportProfile } from './hooks/useViewportProfile';
import AnimatedBackground from './components/AnimatedBackground';
import ToastContainer from './components/ToastContainer';
import DropzoneOverlay from './components/DropzoneOverlay';
import Welcome from './pages/Welcome';
import ProfileSelect from './pages/ProfileSelect';
import KeyboardShortcuts from './components/KeyboardShortcuts';
import SplashScreen from './components/SplashScreen';
import { useAutoBackup } from './hooks/useAutoBackup';
import ScrollToTopButton from './components/app/ScrollToTopButton';
import TitleManager from './components/app/TitleManager';
import { AppErrorBoundary, RouteView } from './components/app/RouteShell';
import { useProfileLifecycle } from './hooks/useProfileLifecycle';
import { useTutorialBootstrap } from './hooks/useTutorialBootstrap';
import { useAdaptiveMotion } from './hooks/useAdaptiveMotion';
import { cancelIdleTask, scheduleIdleTask } from './lib/idleTaskScheduler';
import { runStartupHealthCheck } from './lib/startupHealthCheck';
import { useDiagnosticsStore } from './store/diagnosticsStore';
import { getHealthBadgeLabel } from './lib/healthReporter';
import { useRuntimeStore } from './store/runtimeStore';
import { beginStartupSession, completeStartupSession, inspectPreviousStartup } from './lib/startupSessionGuard';
import { useUpdateStore } from './store/updateStore';
import { migrateLegacyUserMemory } from './ai/UserProfile';
import { checkModelAvailability } from './lib/ai/modelHealing';
import { checkForNativeUpdate } from './lib/nativeUpdateCheck';

const AIChatDrawer = lazy(() => import('./components/AIChatDrawer'));
const WhatsNewTour = lazy(() => import('./components/WhatsNewTour'));
const GlobalSearch = lazy(() => import('./components/GlobalSearch'));
const Tutorial = lazy(() => import('./components/Tutorial'));
const PomodoroTimer = lazy(() => import('./components/PomodoroTimer'));

const Dashboard = lazy(() => import('./pages/Dashboard'));
const QuizList = lazy(() => import('./pages/QuizList'));
const QuizDetail = lazy(() => import('./pages/QuizDetail'));
const QuizCreate = lazy(() => import('./pages/QuizCreate'));
const QuizPlay = lazy(() => import('./pages/quiz-play/QuizPlayRefactored'));
const QuizResults = lazy(() => import('./pages/QuizResults'));
const FolderView = lazy(() => import('./pages/FolderView'));
const Stats = lazy(() => import('./pages/Stats'));
const ReviewMode = lazy(() => import('./pages/ReviewMode'));
const DailyReview = lazy(() => import('./pages/DailyReview'));
const FlashcardHub = lazy(() => import('./pages/FlashcardHub'));
const KnowledgeVault = lazy(() => import('./pages/KnowledgeVault'));
const Residency = lazy(() => import('./pages/Residency'));
const FlashcardSession = lazy(() => import('./pages/FlashcardSession'));
const Notes = lazy(() => import('./pages/Notes'));
const Settings = lazy(() => import('./pages/Settings'));
const AIGamification = lazy(() => import('./components/gamification/AIGamificationRefactored'));
const AIPredictiveAnalytics = lazy(() => import('./components/analytics/AIPredictiveRefactored'));

function AppContent({ splashVisible }: { splashVisible: boolean }) {
  const profiles = useUserStore((state) => state.profiles);
  const activeProfileId = useUserStore((state) => state.activeProfileId);
  const pendingTutorialProfileId = useUserStore((state) => state.pendingTutorialProfileId);
  const clearPendingTutorialProfile = useUserStore((state) => state.clearPendingTutorialProfile);
  const username = useUserStore((state) => state.username);
  const addKnowledgeSource = useAIStore((state) => state.addKnowledgeSource);
  const addToast = useToastStore((state) => state.addToast);
  const setHealthReport = useDiagnosticsStore((state) => state.setHealthReport);
  const checkForUpdate = useUpdateStore((state) => state.checkForUpdate);
  const setShowUpdateModal = useUpdateStore((state) => state.setShowUpdateModal);
  const updateStatus = useUpdateStore((state) => state.status);
  const safeStartupEnabled = useRuntimeStore((state) => state.featureFlags.safeStartup);
  const resetSaveStatus = useSaveStatusStore((state) => state.reset);
  const startTutorial = useTutorialStore((state) => state.startTutorial);
  const hasHydrated = useTutorialStore((state) => state._hasHydrated);

  const [, setIsSwapping] = useState(false);
  const [addingProfile, setAddingProfile] = useState(false);

  // Real inputs for AIPredictiveAnalytics — it used to always get a hardcoded
  // `currentLevel={5}` and `subjects={['Medicina', 'Chirurgie']}` regardless
  // of who was actually using it. Same level formula AIGamification already
  // computes from real activity, and the subjects the user has actually
  // studied (most-answered categories first), not two fixed placeholders.
  const predictiveQuizzes = useQuizStore((state) => state.quizzes);
  const predictiveSessions = useQuizStore((state) => state.sessions);
  const predictiveStreak = useStatsStore((state) => state.streak);
  const predictiveLevel = useMemo(
    () => Math.max(1, Math.floor((predictiveQuizzes.length + predictiveSessions.length + predictiveStreak.longestStreak) / 4) + 1),
    [predictiveQuizzes.length, predictiveSessions.length, predictiveStreak.longestStreak],
  );
  const predictiveSubjects = useMemo(() => {
    const counts = new Map<string, number>();
    for (const quiz of predictiveQuizzes) {
      if (!quiz.category) continue;
      counts.set(quiz.category, (counts.get(quiz.category) ?? 0) + 1);
    }
    const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([category]) => category);
    return ranked.length > 0 ? ranked.slice(0, 5) : ['Medicina'];
  }, [predictiveQuizzes]);

  const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number, message: string) => {
    let timeoutId: ReturnType<typeof window.setTimeout>;
    try {
      return await Promise.race<T>([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = window.setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
      ]);
    } finally {
      window.clearTimeout(timeoutId!);
    }
  };

  const handleGlobalDrop = async (files: File[]) => {
    if (!activeProfileId) return;

    for (const file of files) {
      const name = file.name.toLowerCase();
      const isPdf = name.endsWith('.pdf');
      const isDocx = name.endsWith('.docx');
      const isImage = /\.(jpe?g|png|webp|bmp)$/i.test(name);
      const isTxt = /\.(txt|md)$/i.test(name);

      if (!isPdf && !isDocx && !isImage && !isTxt) {
        addToast(`Format neacceptat: ${file.name}`, 'error');
        continue;
      }

      addToast(`Procesăm: ${file.name}...`, 'info', 2000);

      try {
        let text = '';
        let type: import('./store/aiStore').AIKnowledgeSourceType = 'txt';

        if (isPdf) {
          const { parsePDF } = await import('./ai/pdfParser');
          text = await withTimeout(parsePDF(file), 20000, `Importul PDF pentru ${file.name} a expirat.`);
          type = 'pdf';
        } else if (isDocx) {
          const { parseDocx } = await import('./ai/docxParser');
          text = await withTimeout(parseDocx(file), 15000, `Importul DOCX pentru ${file.name} a expirat.`);
          type = 'docx';
        } else if (isImage) {
          const { parseImageOCR } = await import('./ai/ocrParser');
          text = await withTimeout(parseImageOCR(file), 60000, `OCR-ul pentru ${file.name} a expirat.`);
          type = 'image';
        } else {
          text = await withTimeout(file.text(), 10000, `Citirea fisierului ${file.name} a expirat.`);
        }

        if (text.trim().length < 20) {
          addToast(`Conținut insuficient în ${file.name}`, 'warning');
          continue;
        }

        await withTimeout(
          addKnowledgeSource(file.name, text, type),
          20000,
          `Indexarea pentru ${file.name} s-a blocat. Incearca din nou dupa restart.`,
        );
        addToast(`"${file.name}" adăugat cu succes în Biblioteca AI.`, 'success');
      } catch {
        addToast(`Eroare la procesarea ${file.name}`, 'error');
      }
    }
  };

  useAutoBackup(activeProfileId ?? null);

  // One-time port of the legacy userMemory.ts IndexedDB record (study patterns, rolling
  // aggregates) into the unified AI profile. No-op after the first run (guarded internally
  // by schemaVersion) and safe to fire on every mount.
  useEffect(() => {
    if (!activeProfileId) return;
    void migrateLegacyUserMemory(activeProfileId);
  }, [activeProfileId]);

  // Reclaim flashcard images whose deck no longer exists. Deletion is deferred
  // for undoable removals, and this was never called at all, so pictures from
  // deleted decks used to sit in IndexedDB forever.
  useEffect(() => {
    if (!activeProfileId) return;
    const timer = window.setTimeout(() => useQuizStore.getState().cleanupOrphanImages(), 8000);
    return () => window.clearTimeout(timer);
  }, [activeProfileId]);

  // Auto-check for updates 10s after startup (packaged builds only)
  useEffect(() => {
    if (!window.electronAPI?.updaterCheck) return;
    if (updateStatus !== 'idle') return;
    const timer = window.setTimeout(async () => {
      await checkForUpdate();
      if (useUpdateStore.getState().status === 'available') {
        addToast('Actualizare disponibilă pentru StudyX!', 'info', 6000);
        // Show the update modal after a short delay so the toast is visible first
        window.setTimeout(() => setShowUpdateModal(true), 1200);
      }
    }, 10000);
    return () => window.clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useProfileLifecycle({
    activeProfileId,
    setIsSwapping,
    resetSaveStatus,
    addToast,
  });

  useTutorialBootstrap({
    activeProfileId,
    pendingTutorialProfileId,
    clearPendingTutorialProfile,
    username: username ?? '',
    splashVisible,
    addingProfile,
    hasHydrated,
    startTutorial,
  });

  const focusMode = useFocusModeStore((state) => state.focusMode);
  const theme = useTheme();
  const { mobile } = useViewportProfile();
  const location = useRouterLocation();
  const { calmMotion } = useAdaptiveMotion();

  useEffect(() => {
    const scrollHost = document.querySelector('.route-scroll-host');
    if (scrollHost instanceof HTMLElement) {
      scrollHost.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, [location.pathname]);

  useEffect(() => {
    if (username && activeProfileId && addingProfile) {
      setAddingProfile(false);
    }
  }, [username, activeProfileId, addingProfile]);

  useEffect(() => {
    if (!safeStartupEnabled || splashVisible) return;
    const handle = scheduleIdleTask(() => {
      void runStartupHealthCheck().then((report) => {
        setHealthReport(report.status, report.checks);
        if (report.status !== 'healthy') {
          addToast(`${getHealthBadgeLabel(report.status)}. Vezi secțiunea de stabilitate din Setări.`, 'warning', 5200);
        }
      }).catch((error) => {
        setHealthReport('degraded', [{
          id: 'startup-health-check',
          label: 'Startup health check',
          status: 'error',
          detail: error instanceof Error ? error.message : 'Startup health check failed.',
        }]);
      });
    }, { dedupeKey: 'startup-health-check', timeoutMs: 1600 });

    return () => cancelIdleTask(handle);
  }, [addToast, safeStartupEnabled, setHealthReport, splashVisible]);

  useEffect(() => {
    if (splashVisible) return;
    // Proactive layer of model self-healing (see lib/ai/modelHealing.ts): asks
    // the configured provider which models are still live and swaps away from
    // one it has quietly deprecated/decommissioned before the user's next AI
    // request would have failed on it. Throttled to once/day internally.
    const handle = scheduleIdleTask(() => { void checkModelAvailability(); }, {
      dedupeKey: 'model-availability-check',
      timeoutMs: 2000,
    });
    return () => cancelIdleTask(handle);
  }, [splashVisible]);

  useEffect(() => {
    if (splashVisible) return;
    // No-op outside the native Android shell (see nativeUpdateCheck.ts) —
    // Electron has its own auto-updater, this is the Android counterpart.
    const handle = scheduleIdleTask(() => { void checkForNativeUpdate(); }, {
      dedupeKey: 'native-update-check',
      timeoutMs: 2000,
    });
    return () => cancelIdleTask(handle);
  }, [splashVisible]);

  // Welcome/ProfileSelect mount immediately, hidden behind the splash, so
  // their data reads happen during the splash's visible window rather than
  // janking the reveal. But that also means their entrance animations finish
  // playing out of sight — remounting them the instant the splash clears
  // (key flips) replays that entrance fresh, so avatars/cards actually pop in
  // as the splash fades instead of just sitting there already-settled.
  const revealKey = splashVisible ? 'pre-splash' : 'post-splash';

  if (profiles.length === 0 || (addingProfile && !activeProfileId)) {
    return <Welcome key={revealKey} onBack={profiles.length > 0 ? () => setAddingProfile(false) : undefined} />;
  }

  if (!activeProfileId) {
    return <ProfileSelect key={revealKey} onAddNew={() => setAddingProfile(true)} />;
  }

  return (
    <div className={`flex flex-1 overflow-hidden ${theme.isDark ? 'dark' : ''}`}>
      {!splashVisible && <TitleManager />}
      <ScrollToTopButton />
      {!splashVisible && <AnimatedBackground />}
      <DropzoneOverlay onFilesDropped={handleGlobalDrop} />

      {!focusMode && <Sidebar />}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 1, overflow: 'hidden' }}>
        {!focusMode && <TitleBar />}
        <Suspense fallback={null}>
          <GlobalSearch />
        </Suspense>
        {/* 58px clears the bottom tab bar; the rest clears the floating AI-chat
            and Pomodoro buttons docked above it (AIChatDrawer/PomodoroTimer),
            which otherwise sit on top of a page's own last row of content —
            e.g. the "Mod economisire" toggle in Settings. */}
        <main style={{ flex: 1, overflow: 'hidden', position: 'relative', paddingBottom: mobile && !focusMode ? 'calc(166px + env(safe-area-inset-bottom, 0px))' : undefined }}>
          <AppErrorBoundary>
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={calmMotion ? false : { opacity: 0, y: 12, scale: 0.992 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={calmMotion ? undefined : { opacity: 0, y: -8, scale: 0.997 }}
                // A physics spring (vs. the previous fixed-duration ease) lets each
                // page transition settle at its own natural pace instead of always
                // taking exactly 220ms — reads as fluid glass motion rather than a
                // mechanical fade. Damping stays high enough that it settles
                // cleanly with no visible overshoot/bounce.
                transition={calmMotion ? { duration: 0 } : { type: 'spring', stiffness: 300, damping: 30, mass: 0.9 }}
                style={{ height: '100%' }}
              >
                <Routes location={location}>
                  <Route path="/" element={<RouteView><Dashboard /></RouteView>} />
                  <Route path="/quizzes" element={<RouteView><QuizList /></RouteView>} />
                  <Route path="/quiz/:id" element={<RouteView><QuizDetail /></RouteView>} />
                  <Route path="/folder/:id" element={<RouteView><FolderView /></RouteView>} />
                  <Route path="/create" element={<RouteView><QuizCreate /></RouteView>} />
                  <Route path="/play/:id" element={<RouteView><QuizPlay /></RouteView>} />
                  <Route path="/results/:id" element={<RouteView><QuizResults /></RouteView>} />
                  <Route path="/stats" element={<RouteView><Stats /></RouteView>} />
                  <Route path="/review" element={<RouteView><ReviewMode /></RouteView>} />
                  <Route path="/daily-review" element={<RouteView><DailyReview /></RouteView>} />
                  <Route path="/vault" element={<RouteView><KnowledgeVault /></RouteView>} />
                  <Route path="/rezidentiat" element={<RouteView><Residency /></RouteView>} />
                  <Route path="/flashcards" element={<RouteView><FlashcardHub /></RouteView>} />
                  <Route path="/flashcards/session/:id" element={<RouteView><FlashcardSession /></RouteView>} />
                  <Route path="/notes" element={<RouteView><Notes /></RouteView>} />
                  <Route path="/settings" element={<RouteView><Settings /></RouteView>} />
                  <Route path="/gamification" element={<RouteView><AIGamification userId={activeProfileId || ''} username={username || ''} /></RouteView>} />
                  <Route path="/analytics" element={<RouteView><AIPredictiveAnalytics userId={activeProfileId} currentLevel={predictiveLevel} subjects={predictiveSubjects} /></RouteView>} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </motion.div>
            </AnimatePresence>
          </AppErrorBoundary>
        </main>
      </div>
      {!splashVisible && (
        <Suspense fallback={null}>
          <AIChatDrawer />
        </Suspense>
      )}
      {mobile && !focusMode && !splashVisible && <MobileNav />}
      <ToastContainer />
      <KeyboardShortcuts />
      {activeProfileId && !splashVisible && (
        <Suspense fallback={null}>
          <Tutorial profileId={activeProfileId} />
          <PomodoroTimer />
          <WhatsNewTour />
        </Suspense>
      )}
    </div>
  );
}

export default function App() {
  const [splashVisible, setSplashVisible] = useState(true);
  const safeStartupEnabled = useRuntimeStore((state) => state.featureFlags.safeStartup);
  const setLowPowerModeForThisSessionOnly = useRuntimeStore((state) => state.setLowPowerModeForThisSessionOnly);
  const setHealthReport = useDiagnosticsStore((state) => state.setHealthReport);
  const addToast = useToastStore((state) => state.addToast);
  const { calmMotion } = useAdaptiveMotion();
  // A splash that vanishes the instant the JS bundle finishes evaluating reads
  // as a stutter, not a launch — the heaviest mount work (store hydration,
  // route matching) lands in the same frame as the fade-out. Giving it a real
  // felt duration (still snappy under reduced-motion/low-power) lets that work
  // finish underneath the splash instead of janking the reveal.
  const splashDurationMs = calmMotion ? 650 : 2200;

  useEffect(() => {
    if (safeStartupEnabled) {
      const startupState = inspectPreviousStartup();
      if (startupState.hadUncleanExit) {
        setLowPowerModeForThisSessionOnly();
        setHealthReport('degraded', [{
          id: 'unclean-startup',
          label: 'Pornire anterioară incompletă',
          status: 'error',
          detail: 'Ultima sesiune nu s-a închis curat. Am activat mod economisire pentru stabilitate.',
        }]);
        addToast('Am detectat o pornire anterioară incompletă. Activăm un profil mai sigur pentru sesiunea asta.', 'warning', 5600);
      }
    }

    beginStartupSession();
    window.electronAPI?.appReady();
    const timer = setTimeout(() => setSplashVisible(false), splashDurationMs);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- splashDurationMs is fixed for the lifetime of this mount (calmMotion doesn't change mid-boot)
  }, [addToast, safeStartupEnabled, setHealthReport, setLowPowerModeForThisSessionOnly]);

  useEffect(() => {
    if (splashVisible) return;
    const timer = window.setTimeout(() => completeStartupSession(), 600);
    return () => window.clearTimeout(timer);
  }, [splashVisible]);

  return (
    <HashRouter>
      <ThemeProvider>
        <div className="flex h-screen w-screen flex-col overflow-hidden" style={{ background: 'transparent' }}>
          <WindowControls />
          <SplashScreen visible={splashVisible} durationMs={splashDurationMs} />
          <AppContent splashVisible={splashVisible} />
        </div>
      </ThemeProvider>
    </HashRouter>
  );
}
