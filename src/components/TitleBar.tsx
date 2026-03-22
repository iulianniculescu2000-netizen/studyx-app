import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { useTheme } from '../theme/ThemeContext';
import { GlobalSearchTrigger } from './GlobalSearch';

// Extend Window type globally for Electron API
declare global {
  interface Window {
    electronAPI?: {
      // Window controls
      minimize: () => void;
      maximize: () => void;
      close: () => void;
      isMaximized: () => Promise<boolean>;
      onMaximized: (cb: (v: boolean) => void) => () => void;
      // App lifecycle
      appReady: () => void;
      autoBackup: (data: string) => Promise<{ success: boolean; path?: string; error?: string }>;
      isElectron: boolean;
      // Updater
      updaterCheck: () => Promise<any>;
      updaterDownload: (manifest: any) => Promise<boolean>;
      updaterRestart: () => void;
      updaterGetVersion: () => Promise<string>;
      onUpdateProgress: (cb: (data: { percent: number; file: string }) => void) => () => void;
      // File dialogs
      openJsonFiles: () => Promise<{ name: string; content: string }[] | null>;
      openImageFile: () => Promise<string | null>;
      openPdfFile: () => Promise<string | null>;
      saveFile: (opts: { defaultPath: string; content: string }) => Promise<boolean>;
      saveCsvFile: (opts: { defaultPath: string; content: string }) => Promise<boolean>;
      // Settings
      setContentProtection: (enabled: boolean) => Promise<void>;
      setHardwareAccel: (enabled: boolean) => Promise<void>;
      getSettings: () => Promise<{ hardwareAccel?: boolean }>;
      hardReset: () => Promise<void>;
    };
  }
}

export const isElectron = typeof window !== 'undefined' && !!window.electronAPI?.isElectron;

// Human-readable page titles per route
const PAGE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/quizzes': 'Grile',
  '/stats': 'Statistici',
  '/review': 'Recapitulare',
  '/flashcards': 'Flashcarduri',
  '/notes': 'Notițe',
  '/settings': 'Setări',
  '/create': 'Grilă nouă',
};

function getPageTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  if (pathname.startsWith('/quiz/')) return 'Detalii grilă';
  if (pathname.startsWith('/play/')) return 'Rezolvă';
  if (pathname.startsWith('/results/')) return 'Rezultate';
  if (pathname.startsWith('/folder/')) return 'Folder';
  if (pathname.startsWith('/flashcards/')) return 'Sesiune';
  return 'StudyX';
}

export default function TitleBar() {
  const theme = useTheme();
  const location = useLocation();

  if (!isElectron) return null;

  const pageTitle = getPageTitle(location.pathname);

  return (
    <div
      className="flex items-center select-none flex-shrink-0"
      style={{
        height: 40,
        background: theme.navBg,
        backdropFilter: 'blur(30px)',
        WebkitBackdropFilter: 'blur(30px)',
        borderBottom: `1px solid ${theme.border}`,
        WebkitAppRegion: 'drag',
      } as React.CSSProperties & { WebkitAppRegion: string; WebkitBackdropFilter: string }}
    >
      {/* ── Left: animated page title ─────────────────────────────────── */}
      <div
        className="flex items-center pl-4"
        style={{
          minWidth: 120,
          WebkitAppRegion: 'no-drag',
        } as React.CSSProperties & { WebkitAppRegion: string }}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={pageTitle}
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            transition={{ duration: 0.16, ease: [0.4, 0, 0.2, 1] }}
            className="text-xs font-semibold tracking-wide truncate"
            style={{ color: theme.text2 }}
          >
            {pageTitle}
          </motion.span>
        </AnimatePresence>
      </div>

      {/* ── Center: global search ──────────────────────────────────────── */}
      <div
        className="flex-1 flex items-center justify-center"
        style={{
          WebkitAppRegion: 'no-drag',
        } as React.CSSProperties & { WebkitAppRegion: string }}
      >
        <GlobalSearchTrigger />
      </div>

      {/* ── Right: spacer to avoid overlapping WindowControls overlay ──── */}
      <div style={{ minWidth: 148, flexShrink: 0 }} />
    </div>
  );
}
