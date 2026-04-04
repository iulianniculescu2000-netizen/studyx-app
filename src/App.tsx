import { useState, useEffect, useRef, Component, type ErrorInfo } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
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

class ErrorBoundary extends Component<{ children: React.ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: any) {
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

function AppContent() {
  const activeProfileId = useUserStore((s) => s.activeProfileId);
  const username = useUserStore((s) => s.username);
  const { isCompleted, startTutorial, _hasHydrated } = useTutorialStore();
  const { addKnowledgeSource } = useAIStore();
  const { addToast } = useToastStore();

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
        let type: any = 'txt';
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
    const prev = prevProfileIdRef.current;
    if (prev && prev !== activeProfileId) saveProfileData(prev);
    if (activeProfileId && activeProfileId !== prev) loadProfileData(activeProfileId);
    prevProfileIdRef.current = activeProfileId;
  }, [activeProfileId]);

  useEffect(() => {
    if (!activeProfileId) return;
    let timer: any;
    const save = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        try { saveProfileData(activeProfileId); } catch (e) {}
      }, 600);
    };
    const u1 = useQuizStore.subscribe(save);
    const u2 = useFolderStore.subscribe(save);
    const u3 = useStatsStore.subscribe(save);
    const u4 = useNotesStore.subscribe(save);
    return () => { clearTimeout(timer); u1(); u2(); u3(); u4(); };
  }, [activeProfileId]);

  useEffect(() => {
    const handler = () => { if (activeProfileId) try { saveProfileData(activeProfileId); } catch {} };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [activeProfileId]);

  useEffect(() => {
    if (!_hasHydrated || !activeProfileId || isCompleted(activeProfileId)) return;
    const timer = setTimeout(() => startTutorial(), 1200);
    return () => clearTimeout(timer);
  }, [_hasHydrated, activeProfileId]);

  const focusMode = useFocusModeStore((s) => s.focusMode);
  const theme = useTheme();


  if (!username) return <Welcome />;
  if (!activeProfileId || addingProfile) {
    return <ProfileSelect onAddNew={() => setAddingProfile(true)} />;
  }

  return (
    <div className={`flex flex-1 overflow-hidden ${theme.isDark ? 'dark' : ''}`}>
      <AnimatedBackground />
      <DropzoneOverlay onFilesDropped={handleGlobalDrop} />
      
      {!focusMode && <Sidebar />}
      
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 1, overflow: 'hidden' }}>
        {!focusMode && <TitleBar />}
        <GlobalSearch />
        <main style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          <ErrorBoundary>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/quizzes" element={<QuizList />} />
              <Route path="/quiz/:id" element={<QuizDetail />} />
              <Route path="/folder/:id" element={<FolderView />} />
              <Route path="/create" element={<QuizCreate />} />
              <Route path="/play/:id" element={<QuizPlay />} />
              <Route path="/results/:id" element={<QuizResults />} />
              <Route path="/stats" element={<Stats />} />
              <Route path="/review" element={<ReviewMode />} />
              <Route path="/daily-review" element={<DailyReview />} />
              <Route path="/vault" element={<KnowledgeVault />} />
              <Route path="/flashcards" element={<FlashcardHub />} />
              <Route path="/flashcards/session/:id" element={<FlashcardSession />} />
              <Route path="/notes" element={<Notes />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </ErrorBoundary>
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
    window.electronAPI?.appReady();
    const t = setTimeout(() => setSplashVisible(false), 700);
    return () => clearTimeout(t);
  }, []);

  return (
    <HashRouter>
      <ThemeProvider>
        <div className="h-screen w-screen flex flex-col overflow-hidden bg-[#1a1a2e]">
          <WindowControls />
          <SplashScreen visible={splashVisible} />
          <AppContent />
        </div>
      </ThemeProvider>
    </HashRouter>
  );
}
