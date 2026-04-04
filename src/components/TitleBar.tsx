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
      readOCRPath: (path: string) => Promise<string | null>;
      openPdfFile: () => Promise<string | null>;
      readPdfPath: (path: string) => Promise<string | null>;
      openDocxFile: () => Promise<string | null>;
      readDocxPath: (path: string) => Promise<string | null>;
      openTextFile: () => Promise<string | null>;
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
        position: 'relative',
        background: theme.navBg,
        backdropFilter: 'blur(30px) saturate(150%)',
        WebkitBackdropFilter: 'blur(30px) saturate(150%)',
        borderBottom: `1px solid ${theme.border}`,
        transition: 'background 0.3s ease',
      } as any}
    >
      {/* 
       * Bulletproof Drag Zone:
       * Positioned to never overlap clickable elements like GlobalSearch
       */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          bottom: 0,
          right: 138, // Leave space for window controls (46 * 3)
          WebkitAppRegion: 'drag',
          zIndex: 0,
        } as any}
      />

      <div
        className="flex items-center w-full"
        style={{ position: 'relative', zIndex: 1 }}
      >
        {/* Left: Page Title — width matches Sidebar collapse/expand states indirectly */}
        <div className="flex items-center pl-4 overflow-hidden" style={{ minWidth: 140, WebkitAppRegion: 'no-drag' } as any}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={pageTitle}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="text-[11px] font-bold uppercase tracking-[0.12em] truncate"
              style={{ color: theme.text3 }}
            >
              {pageTitle}
            </motion.span>
          </AnimatePresence>
        </div>

        {/* Center: Search — higher z-index to ensure clickability */}
        <div className="flex-1 flex items-center justify-center px-4" style={{ WebkitAppRegion: 'no-drag' } as any}>
          <GlobalSearchTrigger />
        </div>

        {/* Right: Window Controls area — must be absolutely NO-DRAG */}
        <div style={{ minWidth: 138, flexShrink: 0, WebkitAppRegion: 'no-drag' } as any} />
      </div>
    </div>
  );
}
