import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, BookOpen, BarChart3, Flame,
  Plus, Pencil, Trash2, Check, X, RefreshCw, LogOut,
  PanelLeftOpen, StickyNote, CreditCard,
  Download, ArrowDownCircle, RotateCcw, AlertCircle,
  Settings,
} from 'lucide-react';
import { useTheme } from '../theme/ThemeContext';
import { useUserStore } from '../store/userStore';
import { useFolderStore } from '../store/folderStore';
import { useQuizStore } from '../store/quizStore';
import { useStatsStore } from '../store/statsStore';
import { useUpdateStore } from '../store/updateStore';
import ConfirmDialog from './ConfirmDialog';
import AISettings from './AISettings';
import type { QuizColor } from '../types';

const FOLDER_COLORS: { id: QuizColor; bg: string }[] = [
  { id: 'blue', bg: '#0A84FF' }, { id: 'purple', bg: '#5E5CE6' },
  { id: 'green', bg: '#30D158' }, { id: 'orange', bg: '#FF9F0A' },
  { id: 'pink', bg: '#FF375F' }, { id: 'red', bg: '#FF453A' }, { id: 'teal', bg: '#5AC8FA' },
];
const FOLDER_EMOJIS = ['📁', '📚', '🧠', '💡', '🔬', '🌍', '💻', '❤️', '🦴', '💊', '⚗️', '🧪', '📋', '🎯', '⚡', '🏥'];

function useCollapsed() {
  const [collapsed, setCollapsed] = useState(() =>
    localStorage.getItem('sidebar-collapsed') === 'true'
  );
  const toggle = () => setCollapsed((c) => {
    localStorage.setItem('sidebar-collapsed', String(!c));
    return !c;
  });
  return [collapsed, toggle] as const;
}

/** Tooltip shown on collapsed sidebar items */
function Tip({ label, children }: { label: string; children: React.ReactNode }) {
  const [show, setShow] = useState(false);
  const theme = useTheme();
  return (
    <div className="relative" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, x: -6, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -4, scale: 0.95 }}
            transition={{ duration: 0.13 }}
            className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap z-50 pointer-events-none"
            style={{
              background: theme.isDark ? 'rgba(30,30,36,0.98)' : 'rgba(255,255,255,0.98)',
              border: `1px solid ${theme.border2}`,
              color: theme.text,
              boxShadow: '0 8px 24px rgba(0,0,0,0.22)',
            }}>
            {label}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Premium update panel — shown above the version button */
function UpdatePanel({
  status, manifest, downloadPercent, error,
  onDownload, onApply, onDismiss, onCheck, theme,
}: {
  status: string; manifest: any; downloadPercent: number; error: string | null;
  onDownload: () => void; onApply: () => void; onDismiss: () => void; onCheck: () => void; theme: any;
}) {
  if (status === 'idle' || status === 'checking' || status === 'up-to-date') return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 8, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.97 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="mx-2 mb-2 rounded-2xl overflow-hidden"
        style={{ background: theme.modalBg, border: `1px solid ${theme.border2}`, boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2.5"
          style={{ borderBottom: `1px solid ${theme.border}` }}>
          <div className="flex items-center gap-1.5">
            {status === 'error'
              ? <AlertCircle size={13} style={{ color: theme.danger }} />
              : status === 'ready'
              ? <Check size={13} style={{ color: theme.success }} />
              : status === 'downloading'
              ? <Download size={13} style={{ color: theme.accent }} />
              : <ArrowDownCircle size={13} style={{ color: theme.accent }} />}
            <span className="text-xs font-semibold" style={{
              color: status === 'error' ? theme.danger : status === 'ready' ? theme.success : theme.accent
            }}>
              {status === 'error' ? 'Eroare actualizare' :
               status === 'ready' ? 'Gata de instalat' :
               status === 'downloading' ? 'Se descarcă...' :
               `v${manifest?.version} disponibil`}
            </span>
          </div>
          <button onClick={onDismiss} className="p-1 rounded-lg hover:opacity-70 transition-opacity"
            style={{ color: theme.text3 }}><X size={11} /></button>
        </div>

        {/* Error details */}
        {status === 'error' && error && (
          <div className="px-3 py-2.5">
            <p className="text-[11px] leading-relaxed mb-2.5" style={{ color: theme.text2 }}>
              {error}
            </p>
            <button onClick={onCheck}
              className="w-full py-2 rounded-xl text-xs font-semibold transition-opacity hover:opacity-80"
              style={{ background: `${theme.danger}18`, color: theme.danger, border: `1px solid ${theme.danger}30` }}>
              Încearcă din nou
            </button>
          </div>
        )}

        {/* Available — changelog + download */}
        {status === 'available' && manifest && (
          <div className="px-3 py-2.5">
            {manifest.releaseDate && (
              <p className="text-[10px] mb-1.5" style={{ color: theme.text3 }}>{manifest.releaseDate}</p>
            )}
            {manifest.changes?.length > 0 && (
              <ul className="space-y-1 mb-3">
                {manifest.changes.slice(0, 4).map((c: string, i: number) => (
                  <li key={i} className="flex items-start gap-1.5 text-[11px] leading-relaxed"
                    style={{ color: theme.text2 }}>
                    <span style={{ color: theme.accent, flexShrink: 0, marginTop: 1 }}>▸</span>
                    {c}
                  </li>
                ))}
              </ul>
            )}
            <motion.button onClick={onDownload}
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
              className="w-full py-2.5 rounded-xl text-xs font-semibold text-white flex items-center justify-center gap-1.5"
              style={{ background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})` }}>
              <Download size={12} />Descarcă v{manifest.version}
            </motion.button>
          </div>
        )}

        {/* Downloading — progress bar */}
        {status === 'downloading' && (
          <div className="px-3 py-3">
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-[10px]" style={{ color: theme.text3 }}>Descărcare fișiere...</span>
              <span className="text-[10px] font-semibold tabular-nums" style={{ color: theme.accent }}>{downloadPercent}%</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: theme.surface2 }}>
              <motion.div className="h-full rounded-full"
                style={{ background: `linear-gradient(90deg, ${theme.accent}, ${theme.accent2})` }}
                animate={{ width: `${downloadPercent}%` }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
              />
            </div>
            <p className="text-[10px] mt-1.5 text-center" style={{ color: theme.text3 }}>
              Nu închide aplicația
            </p>
          </div>
        )}

        {/* Ready — restart */}
        {status === 'ready' && (
          <div className="px-3 py-2.5">
            <p className="text-[11px] mb-2.5 text-center" style={{ color: theme.text2 }}>
              Update descărcat cu succes! Repornește pentru a aplica.
            </p>
            <motion.button onClick={onApply}
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
              className="w-full py-2.5 rounded-xl text-xs font-semibold text-white flex items-center justify-center gap-1.5"
              style={{ background: `linear-gradient(135deg, ${theme.success}, ${theme.accent})` }}>
              <RotateCcw size={12} />Repornește acum
            </motion.button>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

/** Update status button shown in the sidebar bottom section */
function UpdateButton({
  collapsed, status, localVersion, manifest, downloadPercent,
  onCheck, onDownload, onApply, theme,
}: {
  collapsed: boolean;
  status: string;
  localVersion: string;
  manifest: any;
  downloadPercent: number;
  onCheck: () => void;
  onDownload: () => void;
  onApply: () => void;
  theme: any;
}) {
  if (!window.electronAPI?.updaterCheck) return null;

  // Compact button icon + color based on status
  let icon: React.ReactNode;
  let color: string = theme.text3;
  let onClick: () => void = onCheck;

  if (status === 'checking') {
    icon = <motion.span animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}><RefreshCw size={14} /></motion.span>;
    color = theme.text3; onClick = () => {};
  } else if (status === 'up-to-date') {
    icon = <Check size={14} />;
    color = theme.success; onClick = () => {};
  } else if (status === 'available') {
    icon = <ArrowDownCircle size={14} />;
    color = theme.accent; onClick = onDownload;
  } else if (status === 'downloading') {
    icon = <Download size={14} />;
    color = theme.accent; onClick = () => {};
  } else if (status === 'ready') {
    icon = <RotateCcw size={14} />;
    color = theme.success; onClick = onApply;
  } else if (status === 'error') {
    icon = <AlertCircle size={14} />;
    color = theme.danger; onClick = onCheck;
  } else {
    icon = <Download size={14} />;
    color = theme.text3; onClick = onCheck;
  }

  const label = status === 'checking' ? 'Se verifică...'
    : status === 'up-to-date' ? 'La zi ✓'
    : status === 'available' ? `v${manifest?.version} disponibil`
    : status === 'downloading' ? `Descărcare ${downloadPercent}%`
    : status === 'ready' ? 'Repornește pentru update'
    : status === 'error' ? 'Eroare — click pentru reîncercare'
    : `v${localVersion}`;

  return (
    <Tip label={collapsed ? label : ''}>
      <motion.button
        onClick={onClick}
        whileHover={{ backgroundColor: `${color}14` }}
        whileTap={{ scale: 0.94 }}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl transition-colors relative"
        style={{ color, justifyContent: collapsed ? 'center' : 'flex-start' }}
      >
        {/* Pulsing dot for available/error */}
        {(status === 'available' || status === 'error' || status === 'ready') && (
          <motion.div
            animate={{ scale: [1, 1.4, 1], opacity: [1, 0.5, 1] }}
            transition={{ duration: 1.8, repeat: Infinity }}
            className="absolute top-1.5 right-2 w-1.5 h-1.5 rounded-full"
            style={{ background: status === 'error' ? theme.danger : status === 'ready' ? theme.success : theme.accent }}
          />
        )}
        {icon}
        {!collapsed && (
          <span className="text-xs truncate flex-1 text-left" style={{ color }}>{label}</span>
        )}
        {/* Download progress bar inline */}
        {!collapsed && status === 'downloading' && (
          <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: theme.surface2 }}>
            <motion.div className="h-full" style={{ background: theme.accent }}
              animate={{ width: `${downloadPercent}%` }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            />
          </div>
        )}
      </motion.button>
    </Tip>
  );
}

/** Active nav indicator — colored left bar */
function NavItem({
  to, icon, label, badge, end, collapsed,
}: {
  to: string; icon: React.ReactNode; label: string; badge?: React.ReactNode;
  end?: boolean; collapsed: boolean;
}) {
  const theme = useTheme();
  return (
    <NavLink to={to} end={end} style={{ textDecoration: 'none', display: 'block' }}>
      {({ isActive }) => (
        <motion.div
          whileHover={{ x: collapsed ? 0 : 2 }}
          transition={{ duration: 0.15 }}
          className="relative flex items-center rounded-xl transition-colors"
          style={{
            gap: collapsed ? 0 : 10,
            padding: collapsed ? '9px' : '8px 12px',
            justifyContent: collapsed ? 'center' as const : 'flex-start' as const,
            background: isActive ? `${theme.accent}16` : 'transparent',
            color: isActive ? theme.accent : theme.text2,
            fontSize: 14,
            fontWeight: isActive ? 600 : 400,
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => {
            if (!isActive) (e.currentTarget as HTMLElement).style.background = `${theme.accent}09`;
          }}
          onMouseLeave={(e) => {
            if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent';
          }}
        >
          {/* Active left accent bar with shimmer */}
          {isActive && (
            <motion.div
              layoutId="nav-active-bar"
              className="absolute left-0 top-1/2 -translate-y-1/2 rounded-full overflow-hidden"
              style={{ width: 3, height: 18, background: theme.accent }}
              transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            >
              <motion.div
                animate={{ y: ['-100%', '200%'] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut', repeatDelay: 0.8 }}
                style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.55)', borderRadius: '50%' }}
              />
            </motion.div>
          )}
          <span style={{ flexShrink: 0 }}>{icon}</span>
          {!collapsed && (
            <>
              <span className="flex-1 truncate">{label}</span>
              {badge}
            </>
          )}
        </motion.div>
      )}
    </NavLink>
  );
}

export default function Sidebar() {
  const theme = useTheme();
  const navigate = useNavigate();
  const { username, logout } = useUserStore();
  const { folders, addFolder, updateFolder, deleteFolder } = useFolderStore();
  const { quizzes, getQuizzesByFolder } = useQuizStore();
  const { streak, getDueQuestions } = useStatsStore();
  const [collapsed, toggleCollapsed] = useCollapsed();
  const { status: updateStatus, localVersion, manifest, downloadPercent, error: updateError,
    checkForUpdate, downloadUpdate, applyUpdate, dismiss: dismissUpdate } = useUpdateStore();

  const [showAISettings, setShowAISettings] = useState(false);
  const [editingFolder, setEditingFolder] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderEmoji, setNewFolderEmoji] = useState('📁');
  const [newFolderColor, setNewFolderColor] = useState<QuizColor>('blue');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const dueCount = getDueQuestions().length;
  const avatarLetter = username?.charAt(0).toUpperCase() ?? '?';

  // Fetch real version number from Electron on mount
  const { setLocalVersion } = useUpdateStore();
  useEffect(() => {
    window.electronAPI?.updaterGetVersion()
      .then((v) => { if (v) setLocalVersion(v); })
      .catch(() => {});
  }, [setLocalVersion]);

  useEffect(() => {
    const handler = () => setShowAISettings(true);
    window.addEventListener('studyx:open-ai-settings', handler);
    return () => window.removeEventListener('studyx:open-ai-settings', handler);
  }, []);

  const handleCreateFolder = () => {
    if (!newFolderName.trim()) return;
    const id = addFolder(newFolderName.trim(), newFolderEmoji, newFolderColor);
    setShowNewFolder(false);
    setNewFolderName('');
    setNewFolderEmoji('📁');
    navigate(`/folder/${id}`);
  };

  const handleRenameFolder = (id: string) => {
    if (!editName.trim()) return;
    updateFolder(id, { name: editName.trim() });
    setEditingFolder(null);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    quizzes.filter(q => q.folderId === deleteTarget.id).forEach(q => {
      useQuizStore.getState().moveToFolder(q.id, null);
    });
    deleteFolder(deleteTarget.id);
    setDeleteTarget(null);
  };

  return (
    <motion.div
      animate={{ width: collapsed ? 60 : 240 }}
      transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
      className="flex flex-col flex-shrink-0 select-none overflow-hidden"
      style={{
        height: '100vh', // Full window height — top to bottom
        background: theme.isDark
          ? 'rgba(0,0,0,0.28)'
          : 'rgba(255,255,255,0.45)',
        borderRight: `1px solid ${theme.border}`,
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        position: 'relative',
        zIndex: 10,
      } as any}
    >
      {/* ── Drag region at the very top (40px — same height as TitleBar) ── */}
      {/* This makes the sidebar's top area draggable to match the TitleBar */}
      <div
        style={{
          height: 40,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-start',
          paddingLeft: collapsed ? 0 : 14,
          paddingRight: collapsed ? 0 : 6,
          borderBottom: `1px solid ${theme.border}`,
          WebkitAppRegion: 'drag',
        } as any}
      >
        {/* App icon — always visible */}
        <div
          className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black text-white flex-shrink-0"
          style={{
            background: `linear-gradient(135deg, ${theme.accent} 0%, ${theme.accent2} 100%)`,
            boxShadow: `0 4px 12px ${theme.accent}40`,
            WebkitAppRegion: 'no-drag',
          } as any}
        >
          S
        </div>
        {!collapsed && (
          <span
            className="text-sm font-bold ml-2.5 tracking-tight"
            style={{ color: theme.text, WebkitAppRegion: 'no-drag' } as any}
          >
            StudyX
          </span>
        )}
      </div>

      {/* ── User header ── */}
      <div className="p-3 flex-shrink-0" style={{ borderBottom: `1px solid ${theme.border}` }}>
        {collapsed ? (
          <Tip label={username ?? ''}>
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white text-sm mx-auto cursor-pointer"
              style={{ background: `linear-gradient(135deg, ${theme.accent} 0%, ${theme.accent2} 100%)` }}
            >
              {avatarLetter}
            </div>
          </Tip>
        ) : (
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white text-sm flex-shrink-0"
              style={{ background: `linear-gradient(135deg, ${theme.accent} 0%, ${theme.accent2} 100%)` }}
            >
              {avatarLetter}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate" style={{ color: theme.text }}>{username}</p>
              {streak.currentStreak > 0 ? (
                <p className="text-xs flex items-center gap-1" style={{ color: theme.warning }}>
                  <Flame size={10} fill={theme.warning} />
                  {streak.currentStreak} zile streak
                </p>
              ) : (
                <p className="text-xs" style={{ color: theme.text3 }}>Bine ai venit!</p>
              )}
            </div>
            <button
              onClick={logout}
              title="Schimbă utilizatorul"
              className="p-1.5 rounded-lg transition-all"
              style={{ color: theme.text3 }}
              onMouseEnter={(e) => (e.currentTarget.style.color = theme.danger)}
              onMouseLeave={(e) => (e.currentTarget.style.color = theme.text3)}
            >
              <LogOut size={13} />
            </button>
          </div>
        )}
      </div>

      {/* ── Nav ── */}
      <div data-tutorial="sidebar" className="flex-1 overflow-y-auto px-2 pb-2 pt-2 space-y-0.5 overflow-x-hidden">
        {collapsed ? (
          <>
            <Tip label="Dashboard">
              <NavItem to="/" icon={<LayoutDashboard size={17} />} label="Dashboard" end collapsed />
            </Tip>
            <Tip label={`Toate grilele (${quizzes.length})`}>
              <NavItem to="/quizzes" icon={<BookOpen size={17} />} label="Toate grilele" collapsed />
            </Tip>
            <Tip label={`Recapitulare${dueCount > 0 ? ` (${dueCount})` : ''}`}>
              <div data-tutorial="nav-review">
                <NavItem
                  to="/review"
                  icon={
                    <div className="relative">
                      <RefreshCw size={17} />
                      {dueCount > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full text-[8px] font-bold flex items-center justify-center text-white"
                          style={{ background: theme.warning }}>{dueCount}</span>
                      )}
                    </div>
                  }
                  label="Recapitulare"
                  collapsed
                />
              </div>
            </Tip>
            <Tip label="Statistici">
              <div data-tutorial="nav-stats">
                <NavItem to="/stats" icon={<BarChart3 size={17} />} label="Statistici" collapsed />
              </div>
            </Tip>
            <Tip label="Notițe">
              <div data-tutorial="nav-notes">
                <NavItem to="/notes" icon={<StickyNote size={17} />} label="Notițe" collapsed />
              </div>
            </Tip>
            <Tip label="Flashcarduri">
              <div data-tutorial="nav-flashcards">
                <NavItem to="/flashcards" icon={<CreditCard size={17} />} label="Flashcarduri" collapsed />
              </div>
            </Tip>
            <Tip label="Setări">
              <div>
                <NavItem to="/settings" icon={<Settings size={17} />} label="Setări" collapsed />
              </div>
            </Tip>
          </>
        ) : (
          <>
            <NavItem to="/" icon={<LayoutDashboard size={16} />} label="Dashboard" end collapsed={false} />
            <NavItem
              to="/quizzes"
              icon={<BookOpen size={16} />}
              label="Toate grilele"
              collapsed={false}
              badge={
                <span className="text-xs px-1.5 py-0.5 rounded-full"
                  style={{ background: theme.surface2, color: theme.text3 }}>
                  {quizzes.filter(q => !q.archived).length}
                </span>
              }
            />
            <div data-tutorial="nav-review">
              <NavItem
                to="/review"
                icon={<RefreshCw size={16} />}
                label="Recapitulare"
                collapsed={false}
                badge={dueCount > 0 ? (
                  <span className="text-xs px-1.5 py-0.5 rounded-full font-semibold"
                    style={{ background: `${theme.warning}28`, color: theme.warning }}>
                    {dueCount}
                  </span>
                ) : undefined}
              />
            </div>
            <div data-tutorial="nav-stats">
              <NavItem to="/stats" icon={<BarChart3 size={16} />} label="Statistici" collapsed={false} />
            </div>
            <div data-tutorial="nav-notes">
              <NavItem to="/notes" icon={<StickyNote size={16} />} label="Notițe" collapsed={false} />
            </div>
            <div data-tutorial="nav-flashcards">
              <NavItem to="/flashcards" icon={<CreditCard size={16} />} label="Flashcarduri" collapsed={false} />
            </div>
            <div>
              <NavItem to="/settings" icon={<Settings size={16} />} label="Setări" collapsed={false} />
            </div>

            {/* Folders section */}
            <div data-tutorial="sidebar-folders" className="pt-4 pb-1">
              <div className="flex items-center justify-between px-1 mb-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: theme.text3 }}>
                  Foldere
                </span>
                <button
                  onClick={() => setShowNewFolder(true)}
                  className="p-1 rounded-lg transition-all"
                  style={{ color: theme.text3 }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = theme.accent)}
                  onMouseLeave={(e) => (e.currentTarget.style.color = theme.text3)}
                >
                  <Plus size={13} />
                </button>
              </div>

              <AnimatePresence>
                {showNewFolder && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-2 overflow-hidden rounded-2xl p-3 space-y-2"
                    style={{ background: theme.surface, border: `1px solid ${theme.border}` }}>
                    <div className="flex gap-1 flex-wrap">
                      {FOLDER_EMOJIS.slice(0, 8).map((e) => (
                        <button key={e} onClick={() => setNewFolderEmoji(e)}
                          className="w-7 h-7 rounded-lg text-base flex items-center justify-center transition-all"
                          style={{
                            background: newFolderEmoji === e ? `${theme.accent}22` : theme.surface2,
                            border: `1px solid ${newFolderEmoji === e ? theme.accent + '50' : 'transparent'}`,
                          }}>
                          {e}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-1">
                      {FOLDER_COLORS.map((c) => (
                        <button key={c.id} onClick={() => setNewFolderColor(c.id)}
                          className="w-5 h-5 rounded-full transition-all"
                          style={{ background: c.bg, outline: newFolderColor === c.id ? `2px solid ${theme.text}` : 'none', outlineOffset: 2 }} />
                      ))}
                    </div>
                    <input
                      autoFocus type="text" placeholder="Nume folder..." value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleCreateFolder(); if (e.key === 'Escape') setShowNewFolder(false); }}
                      className="w-full bg-transparent text-sm px-2 py-1.5 rounded-lg"
                      style={{ color: theme.text, outline: 'none', border: `1px solid ${theme.border}` }}
                    />
                    <div className="flex gap-1">
                      <button
                        onClick={handleCreateFolder}
                        className="flex-1 py-1.5 rounded-xl text-xs font-semibold text-white"
                        style={{ background: theme.accent }}>
                        <Check size={12} className="inline mr-1" />Creează
                      </button>
                      <button
                        onClick={() => setShowNewFolder(false)}
                        className="px-3 py-1.5 rounded-xl text-xs"
                        style={{ background: theme.surface2, color: theme.text3 }}>
                        <X size={12} />
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="space-y-0.5">
                {(() => {
                  const count = getQuizzesByFolder(null).length;
                  return count > 0 ? (
                    <NavLink to="/folder/null" style={{ textDecoration: 'none', display: 'block' }}>
                      {({ isActive }) => (
                        <motion.div
                          className="relative flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-colors"
                          style={{
                            background: isActive ? `${theme.accent}16` : 'transparent',
                            color: isActive ? theme.accent : theme.text2,
                          }}
                          onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = `${theme.accent}09`; }}
                          onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                        >
                          {isActive && (
                            <motion.div layoutId="nav-active-bar"
                              className="absolute left-0 top-1/2 -translate-y-1/2 rounded-full"
                              style={{ width: 3, height: 16, background: theme.accent }}
                              transition={{ duration: 0.25 }} />
                          )}
                          <span>📋</span>
                          <span className="flex-1 truncate">Neclasificate</span>
                          <span className="text-xs px-1.5 py-0.5 rounded-full"
                            style={{ background: theme.surface2, color: theme.text3 }}>{count}</span>
                        </motion.div>
                      )}
                    </NavLink>
                  ) : null;
                })()}

                {folders.map((folder) => {
                  const count = getQuizzesByFolder(folder.id).length;
                  const colorHex = FOLDER_COLORS.find(c => c.id === folder.color)?.bg ?? '#0A84FF';

                  if (editingFolder === folder.id) {
                    return (
                      <div key={folder.id} className="flex items-center gap-1 px-2 py-1">
                        <span>{folder.emoji}</span>
                        <input autoFocus type="text" value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleRenameFolder(folder.id); if (e.key === 'Escape') setEditingFolder(null); }}
                          className="flex-1 bg-transparent text-sm rounded px-1"
                          style={{ color: theme.text, outline: `1px solid ${theme.accent}`, border: 'none' }} />
                        <button onClick={() => handleRenameFolder(folder.id)} className="p-1" style={{ color: theme.success }}><Check size={12} /></button>
                        <button onClick={() => setEditingFolder(null)} className="p-1" style={{ color: theme.text3 }}><X size={12} /></button>
                      </div>
                    );
                  }

                  return (
                    <NavLink key={folder.id} to={`/folder/${folder.id}`} style={{ textDecoration: 'none', display: 'block' }}>
                      {({ isActive }) => (
                        <div className="group relative">
                          <motion.div
                            initial={{ opacity: 0, scale: 0.85, x: -10 }}
                            animate={{ opacity: 1, scale: 1, x: 0 }}
                            transition={{ type: 'spring', stiffness: 380, damping: 22 }}
                            className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-colors"
                            style={{
                              background: isActive ? `${theme.accent}16` : 'transparent',
                              color: isActive ? theme.accent : theme.text2,
                              paddingRight: 36,
                            }}
                            onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = `${theme.accent}09`; }}
                            onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                          >
                            {isActive && (
                              <motion.div layoutId="nav-active-bar"
                                className="absolute left-0 top-1/2 -translate-y-1/2 rounded-full"
                                style={{ width: 3, height: 16, background: theme.accent }}
                                transition={{ duration: 0.25 }} />
                            )}
                            <span className="text-base leading-none flex-shrink-0">{folder.emoji}</span>
                            <span className="flex-1 truncate">{folder.name}</span>
                            {count > 0 && (
                              <span className="text-xs px-1.5 py-0.5 rounded-full"
                                style={{ background: `${colorHex}22`, color: colorHex }}>
                                {count}
                              </span>
                            )}
                          </motion.div>
                          {/* Edit/delete — shown on hover */}
                          <div className="absolute right-2 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-0.5 rounded-lg px-1 py-0.5"
                            style={{ background: theme.isDark ? 'rgba(0,0,0,0.75)' : 'rgba(255,255,255,0.92)' }}>
                            <button
                              onClick={(e) => { e.preventDefault(); setEditingFolder(folder.id); setEditName(folder.name); }}
                              className="p-1 rounded hover:opacity-80" style={{ color: theme.text3 }}>
                              <Pencil size={11} />
                            </button>
                            <button
                              onClick={(e) => { e.preventDefault(); setDeleteTarget({ id: folder.id, name: folder.name }); }}
                              className="p-1 rounded hover:opacity-80" style={{ color: theme.danger }}>
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </div>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        title={`Ștergi folderul "${deleteTarget?.name}"?`}
        description="Grilele din el vor rămâne neclasificate. Această acțiune nu poate fi anulată."
        confirmLabel="Șterge folderul" cancelLabel="Anulează" variant="danger"
        onConfirm={confirmDelete} onCancel={() => setDeleteTarget(null)}
      />

      <AISettings open={showAISettings} onClose={() => setShowAISettings(false)} />

      {/* ── Bottom: version + collapse ── */}
      <div className="p-2 flex-shrink-0 space-y-1" style={{ borderTop: `1px solid ${theme.border}` }}>
        {/* Logout (collapsed only) */}
        {collapsed && (
          <Tip label="Schimbă utilizatorul">
            <button onClick={logout}
              className="w-full flex items-center justify-center p-2.5 rounded-xl transition-all"
              style={{ color: theme.text3 }}
              onMouseEnter={(e) => (e.currentTarget.style.color = theme.danger)}
              onMouseLeave={(e) => (e.currentTarget.style.color = theme.text3)}>
              <LogOut size={15} />
            </button>
          </Tip>
        )}

        {/* Update panel — shown above button when action needed */}
        {!collapsed && (
          <UpdatePanel
            status={updateStatus}
            manifest={manifest}
            downloadPercent={downloadPercent}
            error={updateError}
            onCheck={checkForUpdate}
            onDownload={downloadUpdate}
            onApply={applyUpdate}
            onDismiss={dismissUpdate}
            theme={theme}
          />
        )}

        {/* Update button */}
        <UpdateButton
          collapsed={collapsed}
          status={updateStatus}
          localVersion={localVersion}
          manifest={manifest}
          downloadPercent={downloadPercent}
          onCheck={checkForUpdate}
          onDownload={downloadUpdate}
          onApply={applyUpdate}
          theme={theme}
        />

        {/* Collapse toggle */}
        <Tip label={collapsed ? 'Extinde sidebar' : ''}>
          <motion.button
            onClick={toggleCollapsed}
            whileHover={{ backgroundColor: `${theme.accent}12` }}
            whileTap={{ scale: 0.94 }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm"
            style={{ color: theme.text3, justifyContent: collapsed ? 'center' : 'flex-start' }}>
            <motion.span
              animate={{ rotate: collapsed ? 0 : 180 }}
              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
              style={{ display: 'flex' }}>
              <PanelLeftOpen size={15} />
            </motion.span>
            {!collapsed && <span style={{ color: theme.text3 }}>Restrânge</span>}
          </motion.button>
        </Tip>
      </div>
    </motion.div>
  );
}
