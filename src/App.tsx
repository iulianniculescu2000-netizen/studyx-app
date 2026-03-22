import { useState, useEffect, useRef } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ThemeProvider } from './theme/ThemeContext';
import { useUserStore } from './store/userStore';
import { useFocusModeStore } from './store/focusModeStore';
import { useTutorialStore } from './store/tutorialStore';
import { saveProfileData, loadProfileData } from './store/profileStorage';
import { useQuizStore } from './store/quizStore';
import { useFolderStore } from './store/folderStore';
import { useStatsStore } from './store/statsStore';
import { useNotesStore } from './store/notesStore';
import TitleBar from './components/TitleBar';
import WindowControls from './components/WindowControls';
import Sidebar from './components/Sidebar';
import AnimatedBackground from './components/AnimatedBackground';
import GlobalSearch from './components/GlobalSearch';
import ToastContainer from './components/ToastContainer';
import Welcome from './pages/Welcome';
import ProfileSelect from './pages/ProfileSelect';
import Dashboard from './pages/Dashboard';
import QuizList from './pages/QuizList';
import QuizDetail from './pages/QuizDetail';
import QuizCreate from './pages/QuizCreate';
import QuizPlay from './pages/QuizPlay';
import QuizResults from './pages/QuizResults';
import FolderView from './pages/FolderView';
import Stats from './pages/Stats';
import ReviewMode from './pages/ReviewMode';
import FlashcardHub from './pages/FlashcardHub';
import FlashcardSession from './pages/FlashcardSession';
import Notes from './pages/Notes';
import Settings from './pages/Settings';
import KeyboardShortcuts from './components/KeyboardShortcuts';
import Tutorial from './components/Tutorial';
import PomodoroTimer from './components/PomodoroTimer';
import SplashScreen from './components/SplashScreen';
import { useAutoBackup } from './hooks/useAutoBackup';

// Route depth for directional transitions (deeper = slide from right)
const ROUTE_DEPTH: Record<string, number> = {
  '/': 0,
  '/quizzes': 1,
  '/stats': 1,
  '/review': 1,
  '/flashcards': 1,
  '/notes': 1,
  '/settings': 1,
};
function getDepth(path: string) {
  if (ROUTE_DEPTH[path] !== undefined) return ROUTE_DEPTH[path];
  if (path.startsWith('/play/')) return 3;
  if (path.startsWith('/results/')) return 4;
  if (path.startsWith('/quiz/')) return 2;
  if (path.startsWith('/folder/')) return 2;
  if (path.startsWith('/flashcards/')) return 2;
  if (path === '/create') return 2;
  return 1;
}

/** Smooth page transition wrapper with directional slide */
function PT({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const depth = getDepth(location.pathname);
  // useRef instead of module-level mutable variable (prevents React purity violations)
  const prevDepthRef = useRef(depth);
  const dir = depth >= prevDepthRef.current ? 1 : -1;
  prevDepthRef.current = depth;

  return (
    <motion.div
      initial={{ opacity: 0, x: dir * 28 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: dir * -20 }}
      transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
      style={{ height: '100%' }}
    >
      {children}
    </motion.div>
  );
}

function AppContent() {
  const activeProfileId = useUserStore((s) => s.activeProfileId);
  const profiles = useUserStore((s) => s.profiles);
  const username = useUserStore((s) => s.username);
  const location = useLocation();
  const { isCompleted, startTutorial, _hasHydrated } = useTutorialStore();

  const [addingProfile, setAddingProfile] = useState(false);
  const prevProfileIdRef = useRef<string | null>(null);

  // Weekly auto-backup to Documents/StudyX-Backups (Electron only)
  useAutoBackup(activeProfileId ?? null);

  // ── Per-profile data isolation ──────────────────────────────────────
  useEffect(() => {
    const prev = prevProfileIdRef.current;

    if (prev && prev !== activeProfileId) {
      // Save data for the profile we're leaving
      saveProfileData(prev);
    }

    if (activeProfileId && activeProfileId !== prev) {
      // Load data for the new active profile
      loadProfileData(activeProfileId);
    }

    prevProfileIdRef.current = activeProfileId;
  }, [activeProfileId]);

  // Auto-save on every store change (debounced via subscribe)
  useEffect(() => {
    if (!activeProfileId) return;

    let timer: ReturnType<typeof setTimeout>;
    const save = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        try { saveProfileData(activeProfileId); } catch (e) { console.warn('[StudyX] Auto-save failed', e); }
      }, 600);
    };

    const u1 = useQuizStore.subscribe(save);
    const u2 = useFolderStore.subscribe(save);
    const u3 = useStatsStore.subscribe(save);
    const u4 = useNotesStore.subscribe(save);

    return () => {
      clearTimeout(timer);
      u1(); u2(); u3(); u4();
    };
  }, [activeProfileId]);

  // Save on tab close
  useEffect(() => {
    const handler = () => {
      if (activeProfileId) try { saveProfileData(activeProfileId); } catch {}
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [activeProfileId]);

  // ── Tutorial auto-start for new profiles ───────────────────────────
  useEffect(() => {
    if (!_hasHydrated) return;          // wait for persist to rehydrate
    if (!activeProfileId) return;
    if (isCompleted(activeProfileId)) return;
    const timer = setTimeout(() => startTutorial(), 1200);
    return () => clearTimeout(timer);
  }, [activeProfileId, _hasHydrated]); // re-run when profile changes OR hydration completes

  // Reset addingProfile flag when a profile becomes active
  useEffect(() => {
    if (activeProfileId) setAddingProfile(false);
  }, [activeProfileId]);

  // Focus mode — Escape to exit
  const { focusMode } = useFocusModeStore();
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && focusMode) {
        useFocusModeStore.getState().setFocusMode(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [focusMode]);

  // ── Tutorial callbacks with profileId ─────────────────────────────
  // Expose profile-aware skip/complete to Tutorial via store override
  // (Tutorial calls skipTutorial/completeTutorial with profileId internally)

  // No active profile
  if (!activeProfileId) {
    if (profiles.length === 0 || addingProfile) {
      return (
        <Welcome
          onBack={profiles.length > 0 && addingProfile ? () => setAddingProfile(false) : undefined}
        />
      );
    }
    return <ProfileSelect onAddNew={() => setAddingProfile(true)} />;
  }

  if (!username) return null;

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <AnimatedBackground />
      {!focusMode && <Sidebar />}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', position: 'relative', zIndex: 1 }}>
        {!focusMode && <TitleBar />}
        <GlobalSearch />
        <main style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          <AnimatePresence mode="wait" initial={false}>
            <Routes location={location} key={location.pathname}>
              <Route path="/" element={<PT><Dashboard /></PT>} />
              <Route path="/quizzes" element={<PT><QuizList /></PT>} />
              <Route path="/folder/:id" element={<PT><FolderView /></PT>} />
              <Route path="/quiz/:id" element={<PT><QuizDetail /></PT>} />
              <Route path="/create" element={<PT><QuizCreate /></PT>} />
              <Route path="/play/:id" element={<PT><QuizPlay /></PT>} />
              <Route path="/results/:id" element={<PT><QuizResults /></PT>} />
              <Route path="/stats" element={<PT><Stats /></PT>} />
              <Route path="/review" element={<PT><ReviewMode /></PT>} />
              <Route path="/flashcards" element={<PT><FlashcardHub /></PT>} />
              <Route path="/flashcards/session/:id" element={<PT><FlashcardSession /></PT>} />
              <Route path="/notes" element={<PT><Notes /></PT>} />
              <Route path="/settings" element={<PT><Settings /></PT>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AnimatePresence>
        </main>
      </div>
      <ToastContainer />
      <KeyboardShortcuts />
      <Tutorial profileId={activeProfileId} />
      <PomodoroTimer />
    </div>
  );
}

export default function App() {
  const [splashVisible, setSplashVisible] = useState(true);

  useEffect(() => {
    // Signal Electron to show the window — eliminates white/black flash
    window.electronAPI?.appReady();
    // Minimum splash display: 700ms so it feels intentional rather than a flicker
    const t = setTimeout(() => setSplashVisible(false), 700);
    return () => clearTimeout(t);
  }, []);

  return (
    <HashRouter>
      <ThemeProvider>
        <WindowControls />
        <SplashScreen visible={splashVisible} />
        <AppContent />
      </ThemeProvider>
    </HashRouter>
  );
}
