import { useState, useEffect, useRef, Component, Suspense, lazy, type ErrorInfo } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ThemeProvider, useTheme } from './theme/ThemeContext';
import { useUserStore } from './store/userStore';
import { useFocusModeStore } from './store/focusModeStore';
import { useTutorialStore } from './store/tutorialStore';
import { saveProfileData, loadProfileData, saveProfileNamespace } from './store/profileStorage';
import { useQuizStore } from './store/quizStore';
import { useFolderStore } from './store/folderStore';
import { useStatsStore } from './store/statsStore';
import { useNotesStore } from './store/notesStore';
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
import { useLocation as useRouterLocation } from 'react-router-dom';
import { ArrowUp } from 'lucide-react';

const AIChatDrawer = lazy(() => import('./components/AIChatDrawer'));
const GlobalSearch = lazy(() => import('./components/GlobalSearch'));
const Tutorial = lazy(() => import('./components/Tutorial'));
const PomodoroTimer = lazy(() => import('./components/PomodoroTimer'));

const Dashboard = lazy(() => import('./pages/Dashboard'));
const QuizList = lazy(() => import('./pages/QuizList'));
const QuizDetail = lazy(() => import('./pages/QuizDetail'));
const QuizCreate = lazy(() => import('./pages/QuizCreate'));
const QuizPlay = lazy(() => import('./pages/QuizPlay'));
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

function ScrollToTop() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const getScrollHost = () => document.querySelector('.route-scroll-host') as HTMLElement | null;
    const host = getScrollHost();
    const handler = () => setVisible((host?.scrollTop ?? 0) > 400);
    host?.addEventListener('scroll', handler, { passive: true });
    handler();
    return () => host?.removeEventListener('scroll', handler);
  }, []);

  if (!visible) return null;
  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.5, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.5, y: 20 }}
      onClick={() => {
        const host = document.querySelector('.route-scroll-host') as HTMLElement | null;
        host?.scrollTo({ top: 0, behavior: 'smooth' });
      }}
      className="fixed bottom-8 right-8 w-12 h-12 rounded-full z-[100] flex items-center justify-center text-white shadow-2xl transition-transform hover:scale-110 active:scale-95"
      style={{ background: 'var(--accent)', boxShadow: '0 8px 32px var(--accent-glow)' }}
    >
      <ArrowUp size={20} strokeWidth={3} />
    </motion.button>
  );
}

function TitleManager() {
  const location = useRouterLocation();
  const { quizzes } = useQuizStore();
  const { streak } = useStatsStore();

  useEffect(() => {
    let title = 'StudyX';
    let icon = '⚡';
    const path = location.pathname;

    if (path === '/') { title = 'StudyX — Dashboard'; icon = '🏠'; }
    else if (path === '/quizzes') { title = 'StudyX — Grilele Mele'; icon = '📖'; }
    else if (path.startsWith('/quiz/')) {
      const id = path.split('/')[2];
      const quiz = quizzes.find(q => q.id === id);
      if (quiz) { title = `StudyX — ${quiz.title}`; icon = '📝'; }
    }
    else if (path.startsWith('/play/')) {
      const id = path.split('/')[2];
      const quiz = quizzes.find(q => q.id === id);
      if (quiz) { title = `Rezolvă — ${quiz.title}`; icon = '🧠'; }
    }
    else if (path === '/review') { title = 'StudyX — Recapitulare'; icon = '🔄'; }
    else if (path === '/daily-review') { title = 'StudyX — Sesiune Zilnică'; icon = '🔥'; }
    else if (path === '/stats') { title = 'StudyX — Statistici'; icon = '📊'; }
    else if (path === '/vault') { title = 'StudyX — Biblioteca AI'; icon = '🏛️'; }
    else if (path === '/settings') { title = 'StudyX — Setări'; icon = '⚙️'; }

    // If streak is high, override icon with fire regardless of page
    if (streak.currentStreak >= 3) icon = '🔥';

    document.title = title;
    
    // Dynamic Favicon
    const canvas = document.createElement('canvas');
    canvas.height = 64; canvas.width = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Draw a rounded dark background like the logo
      ctx.fillStyle = '#0F0F12';
      const r = 14;
      ctx.beginPath();
      ctx.moveTo(r, 0); ctx.lineTo(64-r, 0); ctx.quadraticCurveTo(64, 0, 64, r);
      ctx.lineTo(64, 64-r); ctx.quadraticCurveTo(64, 64, 64-r, 64);
      ctx.lineTo(r, 64); ctx.quadraticCurveTo(0, 64, 0, 64-r);
      ctx.lineTo(0, r); ctx.quadraticCurveTo(0, 0, r, 0);
      ctx.fill();

      ctx.font = '42px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(icon, 32, 35);
      
      const link = document.querySelector("link[rel*='icon']") as HTMLLinkElement || document.createElement('link');
      link.type = 'image/x-icon';
      link.rel = 'shortcut icon';
      link.href = canvas.toDataURL();
      document.getElementsByTagName('head')[0].appendChild(link);
    }
  }, [location, quizzes, streak.currentStreak]);

  return null;
}

class ErrorBoundary extends Component<{ children: React.ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, color: 'white', background: '#800', position: 'fixed', inset: 0, zIndex: 9999, overflow: 'auto' }}>
          <h1>Ceva nu a mers bine.</h1>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{this.state.error?.stack || this.state.error?.message}</pre>
          <button onClick={() => window.location.reload()} style={{ padding: '10px 20px', marginTop: 20 }}>Reîncarcă aplicația</button>
        </div>
      );
    }
    return this.props.children;
  }
}

function PageWrapper({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      style={{ height: '100%', width: '100%', overflow: 'auto' }}
      className="custom-scrollbar route-scroll-host"
    >
      {children}
    </motion.div>
  );
}

function RouteFallback() {
  return (
    <div className="flex h-full w-full items-center justify-center px-6">
      <div
        className="glass-panel premium-shadow max-w-sm rounded-[28px] px-6 py-5 text-center"
        style={{ color: 'var(--text-secondary)' }}
      >
        <div
          className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-white/12 border-t-[var(--accent)]"
          aria-hidden="true"
        />
        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          Pregatim ecranul...
        </p>
      </div>
    </div>
  );
}

function RouteView({ children }: { children: React.ReactNode }) {
  return (
    <PageWrapper>
      <Suspense fallback={<RouteFallback />}>{children}</Suspense>
    </PageWrapper>
  );
}

function AppContent({ splashVisible }: { splashVisible: boolean }) {
  const profiles = useUserStore((s) => s.profiles);
  const activeProfileId = useUserStore((s) => s.activeProfileId);
  const pendingTutorialProfileId = useUserStore((s) => s.pendingTutorialProfileId);
  const clearPendingTutorialProfile = useUserStore((s) => s.clearPendingTutorialProfile);
  const username = useUserStore((s) => s.username);
  const { isCompleted, startTutorial, _hasHydrated } = useTutorialStore();
  const addKnowledgeSource = useAIStore((state) => state.addKnowledgeSource);
  const addToast = useToastStore((state) => state.addToast);
  const resetSaveStatus = useSaveStatusStore((s) => s.reset);

  const [isSwapping, setIsSwapping] = useState(false);
  const [addingProfile, setAddingProfile] = useState(false);
  const prevProfileIdRef = useRef<string | null>(null);
  const saveTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const tutorialArmedProfileRef = useRef<string | null>(null);

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
          text = await parsePDF(file);
          type = 'pdf';
        }
        else if (isDocx) {
          const { parseDocx } = await import('./ai/docxParser');
          text = await parseDocx(file);
          type = 'docx';
        }
        else if (isImage) {
          const { parseImageOCR } = await import('./ai/ocrParser');
          text = await parseImageOCR(file);
          type = 'image';
        }
        else { text = await file.text(); }
        if (text.trim().length < 20) {
          addToast(`Conținut insuficient în ${file.name}`, 'warning');
          continue;
        }
        await addKnowledgeSource(file.name, text, type);
        addToast(`"${file.name}" adăugat cu succes în Biblioteca AI.`, 'success');
      } catch (err) {
        console.error(err);
        addToast(`Eroare la procesarea ${file.name}`, 'error');
      }
    }
  };

  useAutoBackup(activeProfileId ?? null);

  useEffect(() => {
    const swapProfile = async () => {
      const current = activeProfileId;
      const prev = prevProfileIdRef.current;
      
      if (prev === current) return;
      if (isSwapping) return; // Prevent overlapping swaps

      setIsSwapping(true);
      try {
        if (prev) {
          // Explicitly save the previous profile state before switching
          await saveProfileData(prev);
          console.log(`[App] Saved profile: ${prev}`);
        }
        
        if (current) {
          // Load the new profile state
          await loadProfileData(current);
          console.log(`[App] Loaded profile: ${current}`);
        }
        
        prevProfileIdRef.current = current;
      } catch (err) {
        console.error('[App] Profile swap failed:', err);
        addToast('Eroare la schimbarea profilului.', 'error');
      } finally {
        setIsSwapping(false);
        resetSaveStatus();
      }
    };

    swapProfile();
  }, [activeProfileId, addToast, isSwapping, resetSaveStatus]); 

  useEffect(() => {
    if (!activeProfileId) return;
    const scheduleSave = (namespace: 'quizzes' | 'folders' | 'stats' | 'notes') => {
      const key = `${activeProfileId}:${namespace}`;
      const existing = saveTimersRef.current[key];
      if (existing) clearTimeout(existing);

      saveTimersRef.current[key] = setTimeout(() => {
        void saveProfileNamespace(activeProfileId, namespace).catch((err) => {
          console.error(`[App] Auto-save error for ${namespace}:`, err);
        }).finally(() => {
          delete saveTimersRef.current[key];
        });
      }, namespace === 'stats' ? 900 : 1400);
    };

    const flushPending = async () => {
      const namespaces: Array<'quizzes' | 'folders' | 'stats' | 'notes'> = ['quizzes', 'folders', 'stats', 'notes'];
      namespaces.forEach((namespace) => {
        const key = `${activeProfileId}:${namespace}`;
        const timer = saveTimersRef.current[key];
        if (timer) {
          clearTimeout(timer);
          delete saveTimersRef.current[key];
        }
      });
      await saveProfileData(activeProfileId);
    };

    const u1 = useQuizStore.subscribe(() => scheduleSave('quizzes'));
    const u2 = useFolderStore.subscribe(() => scheduleSave('folders'));
    const u3 = useStatsStore.subscribe(() => scheduleSave('stats'));
    const u4 = useNotesStore.subscribe(() => scheduleSave('notes'));
    return () => {
      u1();
      u2();
      u3();
      u4();
      void flushPending();
    };
  }, [activeProfileId]);

  useEffect(() => {
    if (!window.electronAPI?.onAppClose) return;
    const unsub = window.electronAPI.onAppClose(async () => {
      if (activeProfileId) {
        try { 
          await saveProfileData(activeProfileId); 
        } catch (err) {
          console.error('[App] Failed to save profile during close:', err);
        }
      }
      window.electronAPI?.destroy();
    });
    return () => unsub();
  }, [activeProfileId]);

  useEffect(() => {
    if (!_hasHydrated || !activeProfileId || !username || splashVisible) return;

    const tutorialState = useTutorialStore.getState();
    if (tutorialState.isCompleted(activeProfileId)) {
      tutorialArmedProfileRef.current = activeProfileId;
      clearPendingTutorialProfile(activeProfileId);
      return;
    }
    if (tutorialArmedProfileRef.current === activeProfileId && tutorialState.active) return;

    const delay = pendingTutorialProfileId === activeProfileId ? 220 : (addingProfile ? 350 : 1200);
    const timer = setTimeout(() => {
      const state = useTutorialStore.getState();
      if (!state.active && !state.isCompleted(activeProfileId)) {
        tutorialArmedProfileRef.current = activeProfileId;
        console.log('[Tutorial] Auto-starting tutorial...');
        startTutorial();
        clearPendingTutorialProfile(activeProfileId);
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [_hasHydrated, activeProfileId, addingProfile, username, splashVisible, isCompleted, startTutorial, pendingTutorialProfileId, clearPendingTutorialProfile]);

  useEffect(() => {
    if (!_hasHydrated || !activeProfileId || pendingTutorialProfileId !== activeProfileId || splashVisible) return;

    const raf = window.requestAnimationFrame(() => {
      const nested = window.requestAnimationFrame(() => {
        const state = useTutorialStore.getState();
        if (!state.active && !state.isCompleted(activeProfileId)) {
          tutorialArmedProfileRef.current = activeProfileId;
          state.resetTutorial();
          state.startTutorial();
          clearPendingTutorialProfile(activeProfileId);
        }
      });
      return () => window.cancelAnimationFrame(nested);
    });

    return () => window.cancelAnimationFrame(raf);
  }, [_hasHydrated, activeProfileId, pendingTutorialProfileId, splashVisible, clearPendingTutorialProfile]);

  const focusMode = useFocusModeStore((s) => s.focusMode);
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

  // If no profiles at all, show Welcome
  if (profiles.length === 0 || (addingProfile && !activeProfileId)) {
    return <Welcome onBack={profiles.length > 0 ? () => setAddingProfile(false) : undefined} />;
  }

  // If not logged in, show ProfileSelect
  if (!activeProfileId) {
    return <ProfileSelect onAddNew={() => setAddingProfile(true)} />;
  }


  return (
    <div className={`flex flex-1 overflow-hidden ${theme.isDark ? 'dark' : ''}`}>
      {!splashVisible && <TitleManager />}
      <ScrollToTop />
      {!splashVisible && <AnimatedBackground />}
      <DropzoneOverlay onFilesDropped={handleGlobalDrop} />
      
      {!focusMode && <Sidebar />}
      
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 1, overflow: 'hidden' }}>
        {!focusMode && <TitleBar />}
        <Suspense fallback={null}>
          <GlobalSearch />
        </Suspense>
        <main style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          <ErrorBoundary>
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
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </motion.div>
            </AnimatePresence>
          </ErrorBoundary>
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
  useEffect(() => {
    window.electronAPI?.appReady();
    const t = setTimeout(() => setSplashVisible(false), 720);
    return () => clearTimeout(t);
  }, []);

  return (
    <HashRouter>
      <ThemeProvider>
        <div className="h-screen w-screen flex flex-col overflow-hidden" style={{ background: 'transparent' }}>
          <WindowControls />
          <SplashScreen visible={splashVisible} />
          <AppContent splashVisible={splashVisible} />
        </div>
      </ThemeProvider>
    </HashRouter>
  );
}
