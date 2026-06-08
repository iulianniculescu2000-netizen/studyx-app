import { Suspense, lazy, useEffect, useState } from 'react';
import { HashRouter, Navigate, Route, Routes, useLocation as useRouterLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ThemeProvider, useTheme } from './theme/ThemeContext';
import { useUserStore } from './store/userStore';
import { useFocusModeStore } from './store/focusModeStore';
import { useTutorialStore } from './store/tutorialStore';
import { useAIStore } from './store/aiStore';
import { useToastStore } from './store/toastStore';
import { useSaveStatusStore } from './store/saveStatusStore';
import TitleBar from './components/TitleBar';
import WindowControls from './components/WindowControls';
import Sidebar from './components/Sidebar';
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
import { cancelIdleTask, scheduleIdleTask } from './lib/idleTaskScheduler';
import { runStartupHealthCheck } from './lib/startupHealthCheck';
import { useDiagnosticsStore } from './store/diagnosticsStore';
import { getHealthBadgeLabel } from './lib/healthReporter';
import { useRuntimeStore } from './store/runtimeStore';
import { beginStartupSession, completeStartupSession, inspectPreviousStartup } from './lib/startupSessionGuard';
import { useUpdateStore } from './store/updateStore';

const AIChatDrawer = lazy(() => import('./components/AIChatDrawer'));
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

  const [isSwapping, setIsSwapping] = useState(false);
  const [addingProfile, setAddingProfile] = useState(false);

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
    isSwapping,
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
  const location = useRouterLocation();

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

  if (profiles.length === 0 || (addingProfile && !activeProfileId)) {
    return <Welcome onBack={profiles.length > 0 ? () => setAddingProfile(false) : undefined} />;
  }

  if (!activeProfileId) {
    return <ProfileSelect onAddNew={() => setAddingProfile(true)} />;
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
        <main style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          <AppErrorBoundary>
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
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
                  <Route path="/flashcards" element={<RouteView><FlashcardHub /></RouteView>} />
                  <Route path="/flashcards/session/:id" element={<RouteView><FlashcardSession /></RouteView>} />
                  <Route path="/notes" element={<RouteView><Notes /></RouteView>} />
                  <Route path="/settings" element={<RouteView><Settings /></RouteView>} />
                  <Route path="/gamification" element={<RouteView><AIGamification userId={activeProfileId || ''} username={username || ''} /></RouteView>} />
                  <Route path="/analytics" element={<RouteView><AIPredictiveAnalytics userId={activeProfileId} currentLevel={5} subjects={['Medicina', 'Chirurgie']} /></RouteView>} />
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
      <ToastContainer />
      <KeyboardShortcuts />
      {activeProfileId && !splashVisible && (
        <Suspense fallback={null}>
          <Tutorial profileId={activeProfileId} />
          <PomodoroTimer />
        </Suspense>
      )}
    </div>
  );
}

export default function App() {
  const [splashVisible, setSplashVisible] = useState(true);
  const safeStartupEnabled = useRuntimeStore((state) => state.featureFlags.safeStartup);
  const setLowPowerMode = useRuntimeStore((state) => state.setLowPowerMode);
  const setHealthReport = useDiagnosticsStore((state) => state.setHealthReport);
  const addToast = useToastStore((state) => state.addToast);

  useEffect(() => {
    if (safeStartupEnabled) {
      const startupState = inspectPreviousStartup();
      if (startupState.hadUncleanExit) {
        setLowPowerMode(true);
        setHealthReport('degraded', [{
          id: 'unclean-startup',
          label: 'Pornire anterioară incompletă',
          status: 'error',
          detail: 'Ultima sesiune nu s-a închis curat. Am activat mod economisire pentru stabilitate.',
        }]);
        addToast('Am detectat o pornire anterioară incompletă. Activăm un profil mai sigur.', 'warning', 5600);
      }
    }

    beginStartupSession();
    window.electronAPI?.appReady();
    const timer = setTimeout(() => setSplashVisible(false), 720);
    return () => clearTimeout(timer);
  }, [addToast, safeStartupEnabled, setHealthReport, setLowPowerMode]);

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
          <SplashScreen visible={splashVisible} />
          <AppContent splashVisible={splashVisible} />
        </div>
      </ThemeProvider>
    </HashRouter>
  );
}
