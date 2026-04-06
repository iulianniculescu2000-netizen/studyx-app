import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { useTheme } from '../theme/ThemeContext';
import GlobalSearchTrigger from './GlobalSearchTrigger';
import { useSaveStatusStore } from '../store/saveStatusStore';

declare global {
  interface Window {
    electronAPI?: {
      minimize: () => void;
      maximize: () => void;
      close: () => void;
      destroy: () => void;
      isMaximized: () => Promise<boolean>;
      onMaximized: (cb: (v: boolean) => void) => () => void;
      appReady: () => void;
      autoBackup: (data: string) => Promise<{ success: boolean; path?: string; error?: string }>;
      isElectron: boolean;
      updaterCheck: () => Promise<unknown>;
      updaterDownload: (manifest: unknown) => Promise<unknown>;
      updaterRestart: () => void;
      updaterInstallDownloaded: (installerPath?: string) => Promise<boolean>;
      updaterGetVersion: () => Promise<string>;
      onUpdateProgress: (cb: (data: { percent: number; file: string }) => void) => () => void;
      openJsonFiles: () => Promise<{ name: string; content: string }[] | null>;
      openImageFile: () => Promise<string | null>;
      readOCRPath: (path: string) => Promise<string | null>;
      openPdfFile: () => Promise<string | null>;
      readPdfPath: (path: string) => Promise<string | null>;
      readPdfBuffer: (buffer: Uint8Array) => Promise<string | null>;
      openDocxFile: () => Promise<string | null>;
      readDocxPath: (path: string) => Promise<string | null>;
      openTextFile: () => Promise<string | null>;
      saveFile: (opts: { defaultPath: string; content: string }) => Promise<boolean>;
      saveCsvFile: (opts: { defaultPath: string; content: string }) => Promise<boolean>;
      setContentProtection: (enabled: boolean) => Promise<void>;
      setHardwareAccel: (enabled: boolean) => Promise<void>;
      getSettings: () => Promise<{ hardwareAccel?: boolean }>;
      hardReset: () => Promise<void>;
      storageSave: (profileId: string, namespace: string, data: unknown) => Promise<boolean>;
      storageLoad: (profileId: string, namespace: string) => Promise<unknown>;
      onAppClose: (cb: () => void) => () => void;
    };
  }
}

const isElectron = typeof window !== 'undefined' && !!window.electronAPI?.isElectron;

const PAGE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/quizzes': 'Grile',
  '/stats': 'Statistici',
  '/review': 'Recapitulare',
  '/flashcards': 'Flashcarduri',
  '/notes': 'Notite',
  '/settings': 'Setari',
  '/create': 'Grila noua',
};

function getPageTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  if (pathname.startsWith('/quiz/')) return 'Detalii grila';
  if (pathname.startsWith('/play/')) return 'Rezolva';
  if (pathname.startsWith('/results/')) return 'Rezultate';
  if (pathname.startsWith('/folder/')) return 'Folder';
  if (pathname.startsWith('/flashcards/')) return 'Sesiune';
  return 'StudyX';
}

export default function TitleBar() {
  const theme = useTheme();
  const location = useLocation();
  const { phase, message } = useSaveStatusStore();
  const compact = typeof window !== 'undefined' && (window.innerHeight < 860 || window.innerWidth < 1260);
  const ultraCompact = typeof window !== 'undefined' && (window.innerHeight < 760 || window.innerWidth < 1080);

  useEffect(() => {
    if (!window.electronAPI?.onMaximized) return;
    const unsub = window.electronAPI.onMaximized(() => {});
    window.electronAPI.isMaximized().catch(() => {});
    return () => unsub();
  }, []);

  if (!isElectron) return null;

  const pageTitle = getPageTitle(location.pathname);

  return (
    <div
      className="flex items-center select-none flex-shrink-0 apple-titlebar"
      style={{
        height: ultraCompact ? 34 : compact ? 38 : 42,
        position: 'relative',
        transition: 'background 0.3s ease',
      } as React.CSSProperties}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          bottom: 0,
          right: 150,
          WebkitAppRegion: 'drag',
          zIndex: 0,
        } as React.CSSProperties & { WebkitAppRegion: string }}
      />

      <div className="flex items-center w-full" style={{ position: 'relative', zIndex: 1 }}>
        <div
          className="flex items-center overflow-hidden"
          style={{ minWidth: ultraCompact ? 110 : compact ? 144 : 188, paddingLeft: compact ? 16 : 20, WebkitAppRegion: 'no-drag' } as React.CSSProperties & { WebkitAppRegion: string }}
        >
          <div className="flex min-w-0 flex-col">
            <span className="text-[9px] font-black uppercase tracking-[0.18em]" style={{ color: theme.text3 }}>
              StudyX Workspace
            </span>
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={pageTitle}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="truncate text-[13px] font-black tracking-[-0.03em]"
                style={{ color: theme.text }}
              >
                {pageTitle}
              </motion.span>
            </AnimatePresence>
          </div>
        </div>

        <div
          className="flex-1 flex items-center justify-center px-4"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties & { WebkitAppRegion: string }}
        >
          <div style={{ width: ultraCompact ? '100%' : 'auto', maxWidth: ultraCompact ? 220 : 320 }}>
            <GlobalSearchTrigger />
          </div>
        </div>

        <div
          className="flex items-center justify-end gap-2 pr-3"
          style={{ minWidth: ultraCompact ? 136 : compact ? 192 : 236, WebkitAppRegion: 'no-drag' } as React.CSSProperties & { WebkitAppRegion: string }}
        >
          <AnimatePresence mode="wait">
            {phase !== 'idle' && (
              <motion.div
                key={phase}
                initial={{ opacity: 0, y: -6, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.96 }}
                className="rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em]"
                style={{
                  background: phase === 'error'
                    ? `${theme.danger}16`
                    : phase === 'saving' || phase === 'recovering'
                      ? `${theme.warning}14`
                      : `${theme.success}14`,
                  color: phase === 'error'
                    ? theme.danger
                    : phase === 'saving' || phase === 'recovering'
                      ? theme.warning
                      : theme.success,
                  border: `1px solid ${phase === 'error'
                    ? `${theme.danger}35`
                    : phase === 'saving' || phase === 'recovering'
                      ? `${theme.warning}35`
                      : `${theme.success}35`}`,
                  maxWidth: ultraCompact ? 112 : compact ? 132 : 168,
                  boxShadow: `inset 0 1px 0 rgba(255,255,255,0.08), 0 10px 18px ${theme.isDark ? 'rgba(0,0,0,0.16)' : 'rgba(26,33,56,0.08)'}`,
                }}
              >
                <span className="truncate block">{ultraCompact ? message.replace(/^salv/i, 'ok') : message}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div style={{ minWidth: ultraCompact ? 132 : 150, flexShrink: 0, WebkitAppRegion: 'no-drag' } as React.CSSProperties & { WebkitAppRegion: string }} />
      </div>
    </div>
  );
}
