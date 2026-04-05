import { useState, useEffect, useRef, Component, type ErrorInfo } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import AIChatDrawer from './components/AIChatDrawer';
import { ThemeProvider, useTheme } from './theme/ThemeContext';
import { useUserStore } from './store/userStore';
import { useFocusModeStore } from './store/focusModeStore';
import { useTutorialStore } from './store/tutorialStore';
import { saveProfileData, loadProfileData } from './store/profileStorage';
import { useQuizStore } from './store/quizStore';
import { useFolderStore } from './store/folderStore';
import { useStatsStore } from './store/statsStore';
import { useNotesStore } from './store/notesStore';
import { useAIStore } from './store/aiStore';
import { useToastStore } from './store/toastStore';
import TitleBar from './components/TitleBar';
import WindowControls from './components/WindowControls';
import Sidebar from './components/Sidebar';
import AnimatedBackground from './components/AnimatedBackground';
import GlobalSearch from './components/GlobalSearch';
import ToastContainer from './components/ToastContainer';
import DropzoneOverlay from './components/DropzoneOverlay';
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
import DailyReview from './pages/DailyReview';
import FlashcardHub from './pages/FlashcardHub';
import KnowledgeVault from './pages/KnowledgeVault';
import FlashcardSession from './pages/FlashcardSession';
import Notes from './pages/Notes';
import Settings from './pages/Settings';
import KeyboardShortcuts from './components/KeyboardShortcuts';
import Tutorial from './components/Tutorial';
import PomodoroTimer from './components/PomodoroTimer';
import SplashScreen from './components/SplashScreen';
import { useAutoBackup } from './hooks/useAutoBackup';
import { parsePDF } from './ai/pdfParser';
import { parseDocx } from './ai/docxParser';
import { parseImageOCR } from './ai/ocrParser';
import { useLocation as useRouterLocation } from 'react-router-dom';
import { ArrowUp } from 'lucide-react';

function ScrollToTop() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const handler = () => setVisible(window.scrollY > 400);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  if (!visible) return null;
  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.5, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.5, y: 20 }}
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
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
      className="custom-scrollbar"
    >
      {children}
    </motion.div>
  );
}

function AppContent({ splashVisible }: { splashVisible: boolean }) {
  const profiles = useUserStore((s) => s.profiles);
  const activeProfileId = useUserStore((s) => s.activeProfileId);
  const username = useUserStore((s) => s.username);
  const { isCompleted, startTutorial, _hasHydrated } = useTutorialStore();
  const { addKnowledgeSource } = useAIStore();
  const { addToast } = useToastStore();

  const [isSwapping, setIsSwapping] = useState(false);
  const [addingProfile, setAddingProfile] = useState(false);
  const prevProfileIdRef = useRef<string | null>(null);

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
        if (isPdf) { text = await parsePDF(file); type = 'pdf'; }
        else if (isDocx) { text = await parseDocx(file); type = 'docx'; }
        else if (isImage) { text = await parseImageOCR(file); type = 'image'; }
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
      }
    };

    swapProfile();
  }, [activeProfileId, addToast, isSwapping]); 

  useEffect(() => {
    if (!activeProfileId) return;
    let timer: ReturnType<typeof setTimeout>;
    const save = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        try { saveProfileData(activeProfileId); } catch (err) {
          console.error('[App] Auto-save error:', err);
        }
      }, 600);
    };
    const u1 = useQuizStore.subscribe(save);
    const u2 = useFolderStore.subscribe(save);
    const u3 = useStatsStore.subscribe(save);
    const u4 = useNotesStore.subscribe(save);
    return () => { clearTimeout(timer); u1(); u2(); u3(); u4(); };
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
    // Auto-start tutorial for new profiles
    if (!_hasHydrated || !activeProfileId || addingProfile || !username || splashVisible) return;
    if (isCompleted(activeProfileId)) return;
    
    const timer = setTimeout(() => {
      // Re-verify conditions after delay
      const state = useTutorialStore.getState();
      if (!state.active && !state.isCompleted(activeProfileId)) {
        console.log('[Tutorial] Auto-starting tutorial...');
        startTutorial();
      }
    }, 1500);
    
    return () => clearTimeout(timer);
  }, [_hasHydrated, activeProfileId, addingProfile, username, splashVisible, isCompleted, startTutorial]);

  const focusMode = useFocusModeStore((s) => s.focusMode);
  const theme = useTheme();
  const location = useRouterLocation();


  useEffect(() => {
    if (username && activeProfileId && addingProfile) {
      setAddingProfile(false);
    }
  }, [username, activeProfileId, addingProfile]);

  if (!username || addingProfile) {
    return <Welcome onBack={profiles.length > 0 ? () => setAddingProfile(false) : undefined} />;
  }

  if (!activeProfileId) {
    return <ProfileSelect onAddNew={() => setAddingProfile(true)} />;
  }


  return (
    <div className={`flex flex-1 overflow-hidden ${theme.isDark ? 'dark' : ''}`}>
      <TitleManager />
      <ScrollToTop />
      <AnimatedBackground />
      <DropzoneOverlay onFilesDropped={handleGlobalDrop} />
      
      {!focusMode && <Sidebar />}
      
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 1, overflow: 'hidden' }}>
        {!focusMode && <TitleBar />}
        <GlobalSearch />
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
                  <Route path="/" element={<PageWrapper><Dashboard /></PageWrapper>} />
                  <Route path="/quizzes" element={<PageWrapper><QuizList /></PageWrapper>} />
                  <Route path="/quiz/:id" element={<PageWrapper><QuizDetail /></PageWrapper>} />
                  <Route path="/folder/:id" element={<PageWrapper><FolderView /></PageWrapper>} />
                  <Route path="/create" element={<PageWrapper><QuizCreate /></PageWrapper>} />
                  <Route path="/play/:id" element={<PageWrapper><QuizPlay /></PageWrapper>} />
                  <Route path="/results/:id" element={<PageWrapper><QuizResults /></PageWrapper>} />
                  <Route path="/stats" element={<PageWrapper><Stats /></PageWrapper>} />
                  <Route path="/review" element={<PageWrapper><ReviewMode /></PageWrapper>} />
                  <Route path="/daily-review" element={<PageWrapper><DailyReview /></PageWrapper>} />
                  <Route path="/vault" element={<PageWrapper><KnowledgeVault /></PageWrapper>} />
                  <Route path="/flashcards" element={<PageWrapper><FlashcardHub /></PageWrapper>} />
                  <Route path="/flashcards/session/:id" element={<PageWrapper><FlashcardSession /></PageWrapper>} />
                  <Route path="/notes" element={<PageWrapper><Notes /></PageWrapper>} />
                  <Route path="/settings" element={<PageWrapper><Settings /></PageWrapper>} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </motion.div>
            </AnimatePresence>
          </ErrorBoundary>
        </main>
      </div>
      {!splashVisible && <AIChatDrawer />}
      <ToastContainer />
      <KeyboardShortcuts />
      {activeProfileId && !addingProfile && !splashVisible && (
        <>
          <Tutorial profileId={activeProfileId} />
          <PomodoroTimer />
        </>
      )}
    </div>
  );
}

export default function App() {
  const [splashVisible, setSplashVisible] = useState(true);
  useEffect(() => {
    window.electronAPI?.appReady();
    const t = setTimeout(() => setSplashVisible(false), 2500);
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
