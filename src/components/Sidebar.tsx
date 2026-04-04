import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, BookOpen, BarChart3, Flame,
  Plus, Pencil, Trash2, Check, X, RefreshCw, LogOut,
  PanelLeftOpen, StickyNote, CreditCard,
  Download, ArrowDownCircle, RotateCcw, AlertCircle,
  Settings, Brain, Database,
} from 'lucide-react';
import { useTheme } from '../theme/ThemeContext';
import { useUserStore } from '../store/userStore';
import { useFolderStore } from '../store/folderStore';
import { useQuizStore } from '../store/quizStore';
import { useStatsStore } from '../store/statsStore';
import { useUpdateStore } from '../store/updateStore';
import ConfirmDialog from './ConfirmDialog';
import AISettings from './AISettings';
import Portal from './Portal';
import UpdateModal from './UpdateModal';
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

/** Update button — opens the premium UpdateModal */
function UpdateButton({
  collapsed, status, localVersion, downloadPercent, onOpen, theme,
}: {
  collapsed: boolean;
  status: string;
  localVersion: string;
  downloadPercent: number;
  onOpen: () => void;
  theme: any;
}) {
  if (!window.electronAPI?.updaterCheck) return null;

  const hasAction = status === 'available' || status === 'error' || status === 'ready';
  const isDownloading = status === 'downloading';
  const isChecking = status === 'checking';

  let icon: React.ReactNode;
  let color: string = theme.text3;

  if (isChecking) {
    icon = <motion.span animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}><RefreshCw size={14} /></motion.span>;
    color = theme.text3;
  } else if (status === 'up-to-date') {
    icon = <Check size={14} />;
    color = theme.success;
  } else if (status === 'available') {
    icon = <ArrowDownCircle size={14} />;
    color = theme.accent;
  } else if (isDownloading) {
    icon = <Download size={14} />;
    color = theme.accent;
  } else if (status === 'ready') {
    icon = <RotateCcw size={14} />;
    color = theme.success;
  } else if (status === 'error') {
    icon = <AlertCircle size={14} />;
    color = theme.danger;
  } else {
    icon = <Download size={14} />;
    color = theme.text3;
  }

  const label = isChecking ? 'Se verifică...'
    : status === 'up-to-date' ? 'La zi ✓'
    : status === 'available' ? 'Actualizare disponibilă'
    : isDownloading ? `Descărcare ${downloadPercent}%`
    : status === 'ready' ? 'Gata de instalat'
    : status === 'error' ? 'Eroare actualizare'
    : `v${localVersion}`;

  return (
    <Tip label={collapsed ? label : ''}>
      <motion.button
        onClick={onOpen}
        whileHover={{ backgroundColor: `${color}14` }}
        whileTap={{ scale: 0.94 }}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl transition-colors relative"
        style={{ color, justifyContent: collapsed ? 'center' : 'flex-start' }}
      >
        {/* Pulsing dot for actionable states */}
        {hasAction && (
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
        {/* Inline download progress bar */}
        {!collapsed && isDownloading && (
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

// ── Folder Creation Modal ──────────────────────────────────────────────────────
function NewFolderModal({ onClose, onAdd }: { onClose: () => void; onAdd: (name: string, emoji: string, color: QuizColor) => void }) {
  const theme = useTheme();
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('📁');
  const [color, setColor] = useState<QuizColor>('blue');

  const handleCreate = () => {
    if (!name.trim()) return;
    onAdd(name.trim(), emoji, color);
    onClose();
  };

  const canCreate = name.trim().length > 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)',
      }}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 18 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 18 }}
        transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: theme.modalBg,
          borderRadius: 28,
          maxWidth: 420,
          width: '92%',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          border: `1px solid ${theme.border}`,
          boxShadow: '0 36px 100px rgba(0,0,0,0.45)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px 28px 18px', borderBottom: `1px solid ${theme.border}` }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: theme.text }}>Folder nou</h3>
            <p style={{ margin: '3px 0 0', fontSize: 12, color: theme.text3 }}>Organizează-ți grilele în foldere</p>
          </div>
          <motion.button 
            whileHover={{ scale: 1.1, rotate: 90 }}
            whileTap={{ scale: 0.9 }}
            onClick={onClose}
            style={{ color: theme.text3, background: theme.surface2, border: 'none', cursor: 'pointer', padding: 8, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={16} />
          </motion.button>
        </div>

        <div className="flex-1 overflow-y-auto p-7 pt-5 custom-scrollbar" style={{ minHeight: 0 }}>
          {/* Emoji picker */}
          <div style={{ marginBottom: 22 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: theme.text3, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Pictogramă</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {FOLDER_EMOJIS.map((e) => (
                <button key={e} onClick={() => setEmoji(e)}
                  style={{
                    width: 38, height: 38, borderRadius: 11, fontSize: 19,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: emoji === e ? `${theme.accent}22` : theme.surface2,
                    border: `1.5px solid ${emoji === e ? theme.accent + '55' : 'transparent'}`,
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}>
                  {e}
                </button>
              ))}
            </div>
          </div>

          {/* Color picker */}
          <div style={{ marginBottom: 22 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: theme.text3, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Culoare</div>
            <div style={{ display: 'flex', gap: 12, paddingLeft: 4 }}>
              {FOLDER_COLORS.map((c) => (
                <button key={c.id} onClick={() => setColor(c.id)}
                  style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: c.bg, border: 'none', cursor: 'pointer',
                    outline: color === c.id ? `3px solid ${c.bg}` : 'none',
                    outlineOffset: 3,
                    transform: color === c.id ? 'scale(1.15)' : 'scale(1)',
                    transition: 'all 0.15s',
                    boxShadow: color === c.id ? `0 4px 12px ${c.bg}55` : 'none',
                  }} />
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: theme.text3, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Nume folder</div>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              placeholder="Ex: Anatomie, Cardiologie..."
              style={{
                width: '100%', padding: '14px 18px', borderRadius: 16, background: theme.surface2, border: `1px solid ${theme.border}`,
                color: theme.text, outline: 'none', fontSize: 14, fontWeight: 600,
              }} />
          </div>

          <motion.button onClick={handleCreate} disabled={!canCreate}
            whileHover={canCreate ? { scale: 1.02, y: -2 } : {}}
            whileTap={canCreate ? { scale: 0.98 } : {}}
            style={{
              width: '100%', padding: '16px', borderRadius: 18, border: 'none', fontWeight: 900, fontSize: 14,
              textTransform: 'uppercase', letterSpacing: '0.05em',
              cursor: canCreate ? 'pointer' : 'not-allowed', opacity: canCreate ? 1 : 0.5,
              background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})`, color: '#fff',
              boxShadow: `0 12px 30px ${theme.accent}40`,
            }}>Creează Folder</motion.button>
        </div>
      </motion.div>
    </motion.div>
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
  const { streak, getDueQuestions, questionStats } = useStatsStore();
  const [collapsed, toggleCollapsed] = useCollapsed();
  const { status: updateStatus, localVersion, downloadPercent,
    setShowUpdateModal } = useUpdateStore();

  const [showAISettings, setShowAISettings] = useState(false);
  const [editingFolder, setEditingFolder] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const dueCount = getDueQuestions().length;
  const avatarLetter = username?.charAt(0).toUpperCase() ?? '?';

  const totalAnswered = Object.values(questionStats).reduce((a, s) => a + s.timesCorrect + s.timesWrong, 0);
  const medicalRank = totalAnswered > 1000 ? 'MEDIC PRIMAR' : totalAnswered > 500 ? 'MEDIC SPECIALIST' : totalAnswered > 100 ? 'MEDIC REZIDENT' : 'STUDENT MEDICINĂ';

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

  const handleCreateFolder = (name: string, emoji: string, color: QuizColor) => {
    const id = addFolder(name, emoji, color);
    setShowNewFolder(false);
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
      animate={{ width: collapsed ? 64 : 260 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col flex-shrink-0 select-none overflow-hidden"
      style={{
        height: '100vh',
        background: theme.isDark
          ? 'rgba(10,10,12,0.85)'
          : 'rgba(255,255,255,0.75)',
        borderRight: `1px solid ${theme.border}`,
        backdropFilter: 'blur(40px) saturate(160%)',
        WebkitBackdropFilter: 'blur(40px) saturate(160%)',
        position: 'relative',
        zIndex: 50,
      } as any}
    >
      {/* ── Drag region matches TitleBar ── */}
      <div
        style={{
          height: 40,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-start',
          paddingLeft: collapsed ? 0 : 16,
          borderBottom: `1px solid ${theme.border}`,
          WebkitAppRegion: 'drag',
        } as any}
      >
        <div
          className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black text-white flex-shrink-0"
          style={{
            background: `linear-gradient(135deg, ${theme.accent} 0%, ${theme.accent2} 100%)`,
            boxShadow: `0 4px 12px ${theme.accent}40`,
            WebkitAppRegion: 'no-drag',
          } as any}
        >
          SX
        </div>
        {!collapsed && (
          <span
            className="text-[11px] font-black ml-3 tracking-[0.1em] uppercase"
            style={{ color: theme.text, WebkitAppRegion: 'no-drag', opacity: 0.8 } as any}
          >
            StudyX
          </span>
        )}
      </div>

      {/* ── User header (more compact) ── */}
      <div className="p-4 flex-shrink-0" style={{ borderBottom: `1px solid ${theme.border}` }}>
        {collapsed ? (
          <Tip label={username ?? ''}>
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white text-xs mx-auto cursor-pointer shadow-lg"
              style={{ background: `linear-gradient(135deg, ${theme.accent} 0%, ${theme.accent2} 100%)` }}
            >
              {avatarLetter}
            </div>
          </Tip>
        ) : (
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white text-base flex-shrink-0 shadow-lg"
              style={{ background: `linear-gradient(135deg, ${theme.accent} 0%, ${theme.accent2} 100%)` }}
            >
              {avatarLetter}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate leading-tight" style={{ color: theme.text }}>{username}</p>
              {streak.currentStreak > 0 ? (
                <p className="text-[10px] font-bold flex items-center gap-1 mt-0.5" style={{ color: theme.warning }}>
                  <Flame size={10} fill={theme.warning} />
                  {streak.currentStreak} ZILE STREAK
                </p>
              ) : (
                <p className="text-[10px] font-medium opacity-50 mt-0.5" style={{ color: theme.text }}>{medicalRank}</p>
              )}
            </div>
            <button
              onClick={logout}
              className="p-2 rounded-lg transition-all hover:bg-red-500/10"
              style={{ color: theme.text3 }}
            >
              <LogOut size={14} />
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
            <Tip label={`Sesiune zilnică${dueCount > 0 ? ` · ${dueCount} de recapitulat` : ''}`}>
              <NavItem
                to="/daily-review"
                icon={
                  <div className="relative">
                    <Brain size={17} />
                    {dueCount > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full text-[8px] font-bold flex items-center justify-center text-white"
                        style={{ background: theme.accent }}>{dueCount}</span>
                    )}
                  </div>
                }
                label="Sesiune zilnică"
                collapsed
              />
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
            <Tip label="Knowledge Vault (AI)">
              <NavItem to="/vault" icon={<Database size={16} />} label="Biblioteca AI" collapsed={collapsed} />
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
            <NavItem
              to="/daily-review"
              icon={<Brain size={16} />}
              label="Sesiune zilnică"              collapsed={false}
              badge={dueCount > 0 ? (
                <span className="text-xs px-1.5 py-0.5 rounded-full font-semibold"
                  style={{ background: `${theme.accent}28`, color: theme.accent }}>
                  {dueCount}
                </span>
              ) : undefined}
            />
            <div data-tutorial="nav-stats">
              <NavItem to="/stats" icon={<BarChart3 size={16} />} label="Statistici" collapsed={false} />
            </div>
            <div data-tutorial="nav-notes">
              <NavItem to="/notes" icon={<StickyNote size={16} />} label="Notițe" collapsed={false} />
            </div>
            <NavItem to="/vault" icon={<Database size={16} />} label="Biblioteca AI" collapsed={false} />
            <div data-tutorial="nav-flashcards">
              <NavItem
                to="/flashcards"
                icon={<CreditCard size={16} />}
                label="Flashcarduri"
                collapsed={false}
              />
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

      {/* ── Update modal (premium, portal-based) ── */}
      <UpdateModal />

      {/* ── Centered folder creation modal ── */}
      <Portal>
        <AnimatePresence>
          {showNewFolder && (
            <NewFolderModal
              onClose={() => setShowNewFolder(false)}
              onAdd={handleCreateFolder}
            />
          )}
        </AnimatePresence>
      </Portal>

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

        {/* Update button — opens premium UpdateModal */}
        <UpdateButton
          collapsed={collapsed}
          status={updateStatus}
          localVersion={localVersion}
          downloadPercent={downloadPercent}
          onOpen={() => setShowUpdateModal(true)}
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
