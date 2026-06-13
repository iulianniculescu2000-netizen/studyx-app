import { lazy, Suspense, useState, useEffect, useMemo } from 'react';
import type { DragEvent } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, BookOpen, BarChart3, Flame,
  Plus, Pencil, Trash2, Check, X, RefreshCw, LogOut,
  PanelLeftOpen, StickyNote, CreditCard,
  Download, ArrowDownCircle, RotateCcw, AlertCircle,
  Settings, Brain, Database, MessageSquare, Sparkles,
} from 'lucide-react';
import { useTheme } from '../theme/ThemeContext';
import { useUserStore } from '../store/userStore';
import { useFolderStore } from '../store/folderStore';
import { useQuizStore } from '../store/quizStore';
import { useStatsStore } from '../store/statsStore';
import { useUpdateStore } from '../store/updateStore';
import { useAIStore } from '../store/aiStore';
import { useUIStore } from '../store/uiStore';
import { useToastStore } from '../store/toastStore';
import { useViewportProfile } from '../hooks/useViewportProfile';
import ConfirmDialog from './ConfirmDialog';
import Portal from './Portal';
import Logo from './Logo';
import type { QuizColor } from '../types';

const AISettings = lazy(() => import('./AISettings'));
const UpdateModal = lazy(() => import('./UpdateModal'));

const FOLDER_COLORS: { id: QuizColor; bg: string }[] = [
  { id: 'blue', bg: '#0A84FF' }, { id: 'purple', bg: '#5E5CE6' },
  { id: 'green', bg: '#30D158' }, { id: 'orange', bg: '#FF9F0A' },
  { id: 'pink', bg: '#FF375F' }, { id: 'red', bg: '#FF453A' }, { id: 'teal', bg: '#5AC8FA' },
];
const FOLDER_EMOJIS = ['\u{1F4C1}', '\u{1F4DA}', '\u{1F9E0}', '\u{1F4A1}', '\u{1F52C}', '\u{1F30D}', '\u{1F4BB}', '\u2764\uFE0F', '\u{1F9B4}', '\u{1F48A}', '\u2695\uFE0F', '\u{1F9EA}', '\u{1F4CB}', '\u{1F3AF}', '\u26A1', '\u{1F3E5}'];
const QUIZ_DRAG_MIME = 'application/x-studyx-quiz-id';

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

/** Update button - opens the premium UpdateModal */
function UpdateButton({
  collapsed, status, localVersion, downloadPercent, onOpen, theme,
}: {
  collapsed: boolean;
  status: string;
  localVersion: string;
  downloadPercent: number;
  onOpen: () => void;
  theme: import('../theme/themes').Theme;
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
    : status === 'up-to-date' ? 'La zi'
    : status === 'available' ? 'Actualizare disponibilă'
    : isDownloading ? `Descărcare ${downloadPercent}%`
    : status === 'ready' ? 'Gata de instalat'
    : status === 'error' ? 'Eroare actualizare'
    : `v${localVersion}`;

  return (
    <Tip label={collapsed ? label : ''}>
      <motion.button
        onClick={onOpen}
        aria-label={label}
        whileHover={{ backgroundColor: `${color}14` }}
        whileTap={{ scale: 0.94 }}
        className="press-feedback w-full flex items-center gap-2 px-3 py-2 rounded-xl transition-colors relative"
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

function buildFolderPath(folders: Array<{ id: string; name: string; parentId?: string | null }>, folderId: string) {
  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  const names: string[] = [];
  let current = byId.get(folderId);
  const guard = new Set<string>();

  while (current && !guard.has(current.id)) {
    guard.add(current.id);
    names.unshift(current.name);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }

  return names.join(' / ');
}

// Folder creation modal
function NewFolderModal({
  folders,
  initialParentId = null,
  onClose,
  onAdd,
}: {
  folders: Array<{ id: string; name: string; emoji: string; parentId?: string | null }>;
  initialParentId?: string | null;
  onClose: () => void;
  onAdd: (name: string, emoji: string, color: QuizColor, parentId?: string | null) => void;
}) {
  const theme = useTheme();
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('\u{1F4C1}');
  const [color, setColor] = useState<QuizColor>('blue');
  const [parentId, setParentId] = useState<string>(initialParentId ?? '__root__');

  const handleCreate = () => {
    if (!name.trim()) return;
    onAdd(name.trim(), emoji, color, parentId === '__root__' ? null : parentId);
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
        background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(10px)',
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
          boxShadow: '0 36px 100px rgba(0,0,0,0.32)',
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
            aria-label="Inchide dialogul"
            className="press-feedback"
            style={{ color: theme.text3, background: theme.surface2, border: 'none', cursor: 'pointer', padding: 8, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={16} />
          </motion.button>
        </div>

        <div className="flex-1 overflow-y-auto p-7 pt-5 custom-scrollbar" style={{ minHeight: 0 }}>
          {/* Emoji picker */}
          <div style={{ marginBottom: 22 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: theme.text3, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Pictograma</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {FOLDER_EMOJIS.map((e) => (
                <button key={e} onClick={() => setEmoji(e)}
                  aria-label={`Alege pictograma ${e}`}
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
                  aria-label={`Alege culoarea ${c.id}`}
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

          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: theme.text3, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>În interiorul</div>
            <select
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              style={{
                width: '100%', padding: '13px 16px', borderRadius: 16, background: theme.surface2,
                border: `1px solid ${theme.border}`, color: theme.text, outline: 'none',
                fontSize: 13, fontWeight: 700,
              }}
            >
              <option value="__root__">Folder principal</option>
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.emoji} {buildFolderPath(folders, folder.id)}
                </option>
              ))}
            </select>
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
            }}>Creează folder</motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/** Active nav indicator - colored left bar */
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
          whileHover={{ x: collapsed ? 0 : 4, scale: 1.02 }}
          whileTap={{ scale: 0.96 }}
          transition={{ type: "spring", stiffness: 400, damping: 17 }}
          className="relative flex items-center transition-all press-feedback"
          style={{
            gap: collapsed ? 0 : 10,
            padding: collapsed ? '10px' : '6px 10px',
            justifyContent: collapsed ? 'center' as const : 'flex-start' as const,
            background: isActive ? `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})` : 'transparent',
            color: isActive ? '#ffffff' : theme.text2,
            fontSize: 14,
            fontWeight: isActive ? 700 : 500,
            cursor: 'pointer',
            borderRadius: '12px',
            boxShadow: isActive ? `0 10px 22px ${theme.accent}24` : 'none',
          }}
          onMouseEnter={(e) => {
            if (!isActive) {
              e.currentTarget.style.background = theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';
            }
          }}
          onMouseLeave={(e) => {
            if (!isActive) {
              e.currentTarget.style.background = 'transparent';
            }
          }}
        >
          {/* Active indicator bar */}
          {isActive && (
            <motion.div
              layoutId="nav-active-indicator"
              className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-6 rounded-full"
              style={{ background: theme.accent, boxShadow: `0 0 10px ${theme.accent}60` }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
            />
          )}
          <span style={{ flexShrink: 0, filter: isActive ? `drop-shadow(0 0 8px ${theme.accent}40)` : 'none' }}>
            {icon}
          </span>
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
  const compact = typeof window !== 'undefined' && (window.innerHeight < 820 || window.innerWidth < 1240);
  const { username, logout } = useUserStore();
  const { folders, addFolder, updateFolder, deleteFolder } = useFolderStore();
  const { quizzes, bulkDeleteQuizzes, moveToFolder } = useQuizStore();
  const { streak, getDueQuestions, getWeakQuestions, questionStats } = useStatsStore();
  const aiReady = useAIStore((state) => state.hasKey);
  const knowledgeSourceCount = useAIStore((state) => state.knowledgeSources.length);
  const setChatOpen = useUIStore((state) => state.setChatOpen);
  const addToast = useToastStore((state) => state.addToast);
  const [storedCollapsed, toggleCollapsed] = useCollapsed();
  const { mobile } = useViewportProfile();
  const collapsed = mobile || storedCollapsed;
  const { status: updateStatus, localVersion, downloadPercent,
    setShowUpdateModal } = useUpdateStore();

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);

  const [showAISettings, setShowAISettings] = useState(false);
  const [editingFolder, setEditingFolder] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderParentId, setNewFolderParentId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  const dueCount = getDueQuestions().length;
  const weakCount = getWeakQuestions(8).length;
  const avatarLetter = username?.charAt(0).toUpperCase() ?? '?';

  const totalAnswered = Object.values(questionStats).reduce((a, s) => a + s.timesCorrect + s.timesWrong, 0);
  const medicalRank = totalAnswered > 1000 ? 'MEDIC PRIMAR' : totalAnswered > 500 ? 'MEDIC SPECIALIST' : totalAnswered > 100 ? 'MEDIC REZIDENT' : 'STUDENT LA MEDICINĂ';
  const activeQuizCount = useMemo(() => quizzes.filter(q => !q.archived).length, [quizzes]);
  const newQuizCount = useMemo(() => quizzes.filter(q => now - q.createdAt < 86400000 * 2).length, [quizzes, now]);
  const uncategorizedCount = useMemo(() => quizzes.filter(q => !q.folderId).length, [quizzes]);
  const folderQuizCount = useMemo(() => {
    const counts = new Map<string, number>();
    for (const quiz of quizzes) {
      if (!quiz.folderId) continue;
      counts.set(quiz.folderId, (counts.get(quiz.folderId) ?? 0) + 1);
    }
    return counts;
  }, [quizzes]);

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

  const handleCreateFolder = (name: string, emoji: string, color: QuizColor, parentId?: string | null) => {
    const id = addFolder(name, emoji, color, parentId);
    setShowNewFolder(false);
    setNewFolderParentId(null);
    navigate(`/folder/${id}`);
  };

  const handleRenameFolder = (id: string) => {
    if (!editName.trim()) return;
    updateFolder(id, { name: editName.trim() });
    setEditingFolder(null);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    const toDelete = new Set([deleteTarget.id]);
    let changed = true;
    while (changed) {
      changed = false;
      folders.forEach((folder) => {
        if (folder.parentId && toDelete.has(folder.parentId) && !toDelete.has(folder.id)) {
          toDelete.add(folder.id);
          changed = true;
        }
      });
    }
    const quizIdsToDelete = quizzes
      .filter(q => q.folderId && toDelete.has(q.folderId))
      .map(q => q.id);
    if (quizIdsToDelete.length > 0) {
      bulkDeleteQuizzes(quizIdsToDelete);
    }
    deleteFolder(deleteTarget.id);
    setDeleteTarget(null);
  };

  const getDraggedQuizId = (event: DragEvent<HTMLElement>) => (
    event.dataTransfer.getData(QUIZ_DRAG_MIME) || event.dataTransfer.getData('text/plain')
  );

  const isQuizDrag = (event: DragEvent<HTMLElement>) => (
    Array.from(event.dataTransfer.types).includes(QUIZ_DRAG_MIME)
  );

  const handleFolderDragOver = (event: DragEvent<HTMLElement>, targetFolderId: string | null) => {
    if (!isQuizDrag(event)) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'move';
    setDropTargetId(targetFolderId ?? '__uncategorized__');
  };

  const handleFolderDragLeave = (event: DragEvent<HTMLElement>) => {
    if (!isQuizDrag(event)) return;
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return;
    setDropTargetId(null);
  };

  const handleFolderDrop = (event: DragEvent<HTMLElement>, targetFolderId: string | null) => {
    if (!isQuizDrag(event)) return;
    event.preventDefault();
    event.stopPropagation();
    setDropTargetId(null);

    const quizId = getDraggedQuizId(event);
    const quiz = quizzes.find((item) => item.id === quizId);
    if (!quiz) return;

    const nextFolderId = targetFolderId ?? null;
    if ((quiz.folderId ?? null) === nextFolderId) {
      addToast('Grila este deja in folderul ales.', 'info', 2200);
      return;
    }

    moveToFolder(quiz.id, nextFolderId);
    const folderName = nextFolderId
      ? folders.find((folder) => folder.id === nextFolderId)?.name ?? 'folder'
      : 'Neclasificate';
    addToast(`Am mutat "${quiz.title}" in ${folderName}.`, 'success', 2600);
  };

  const openCoachChat = () => {
    setChatOpen(true);
    window.dispatchEvent(new CustomEvent('studyx:ai-prompt', {
      detail: {
        open: true,
        mode: weakCount > 0 ? 'test' : 'summarize',
        resetConversation: true,
        prompt: weakCount > 0
          ? 'Ajută-mă cu un plan clar pentru punctele mele slabe și începe cu un mini-test scurt pe tema cea mai vulnerabilă.'
          : 'Fă-mi un plan clar și scurt pentru studiul de azi, în funcție de progresul meu și de ce merită repetat acum.',
      },
    }));
  };

  const visibleFolders = useMemo(() => {
    const byParent = new Map<string, typeof folders>();
    folders.forEach((folder) => {
      const key = folder.parentId ?? '__root__';
      byParent.set(key, [...(byParent.get(key) ?? []), folder]);
    });

    const walk = (parentId: string, depth: number): Array<{ folder: typeof folders[number]; depth: number }> => (
      (byParent.get(parentId) ?? []).flatMap((folder) => [
        { folder, depth },
        ...walk(folder.id, depth + 1),
      ])
    );

    return walk('__root__', 0);
  }, [folders]);

  return (
    <motion.div
      animate={{ width: collapsed ? 64 : compact ? 242 : 260 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="studyx-sidebar flex flex-col flex-shrink-0 select-none overflow-hidden glass-panel"
      style={{
        height: '100dvh',
        borderRight: `0.5px solid ${theme.border}`,
        position: 'relative',
        zIndex: 50,
        background: collapsed ? theme.navBg : `linear-gradient(180deg, ${theme.navBg}, color-mix(in srgb, ${theme.surface} 88%, transparent))`,
      } as React.CSSProperties}
    >
      {/* Drag region matches TitleBar */}
      <div
        style={{
          height: compact ? 42 : 48,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-start',
          paddingLeft: collapsed ? 0 : compact ? 12 : 16,
          borderBottom: `1px solid ${theme.border}`,
          WebkitAppRegion: 'drag',
        } as React.CSSProperties & { WebkitAppRegion: string }}
      >
        <Logo size={24} className="flex-shrink-0" />
        {!collapsed && (
          <span
            className="text-base font-black ml-3 tracking-tighter"
            style={{ color: theme.text, WebkitAppRegion: 'no-drag' } as React.CSSProperties & { WebkitAppRegion: string }}
          >
            Study<span style={{ color: theme.accent }}>X</span>
          </span>
        )}
      </div>

      {/* User header */}
      <div className={`${compact ? 'p-3' : 'p-4'} flex-shrink-0`} style={{ borderBottom: `1px solid ${theme.border}` }}>
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
          <div className="luxe-card flex items-center gap-3 rounded-[24px] px-3.5 py-3.5">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white text-base flex-shrink-0 shadow-lg"
              style={{ background: `linear-gradient(135deg, ${theme.accent} 0%, ${theme.accent2} 100%)` }}
            >
              {avatarLetter}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate leading-tight" style={{ color: theme.text }}>{username}</p>
              {streak.currentStreak > 0 ? (
                <p className={`flex items-center gap-1 mt-0.5 secondary-label ${streak.currentStreak >= 3 ? 'animate-streak-fire' : ''}`} style={{ color: theme.warning }}>
                  <Flame size={10} fill={streak.currentStreak >= 3 ? theme.warning : 'none'} />
                  {streak.currentStreak} {streak.currentStreak === 1 ? 'ZI' : 'ZILE'} STREAK
                </p>
              ) : (
                <p className="mt-0.5 secondary-label" style={{ opacity: 0.8 }}>{medicalRank}</p>
              )}
            </div>
            <button
              onClick={logout}
              aria-label="Schimba utilizatorul"
              className="p-2 rounded-lg transition-all hover:bg-red-500/10"
              style={{ color: theme.text3 }}
            >
              <LogOut size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div
        data-tutorial="sidebar"
        role="navigation"
        aria-label="Navigare principala"
        className={`flex-1 overflow-y-auto ${compact ? 'px-1.5 pb-1.5 pt-1.5' : 'px-2 pb-2 pt-2'} space-y-0.5 overflow-x-hidden`}
      >
        {!collapsed && (
          <div className="mb-3 px-1">
            <div
              className="editorial-hero luxe-card rounded-[26px] px-4 py-4"
              style={{
                background: theme.isDark
                  ? 'linear-gradient(135deg, rgba(90,136,255,0.12), rgba(255,255,255,0.03))'
                  : 'linear-gradient(135deg, rgba(255,255,255,0.92), rgba(245,249,253,0.82))',
                border: `1px solid ${theme.border}`,
              }}
            >
              <div className="mb-2 flex items-center justify-between gap-3">
                <div>
                  <div className="secondary-label font-black tracking-[0.18em]" style={{ color: theme.text3 }}>
                    STUDY PULSE
                  </div>
                  <div className="mt-1 text-sm font-bold leading-tight" style={{ color: theme.text }}>
                    {dueCount > 0
                      ? `${dueCount} itemi așteaptă recapitularea de azi`
                      : weakCount > 0
                        ? 'Poți transforma punctele slabe în progres rapid'
                        : 'Ritmul arată bine. Păstrează consistența.'}
                  </div>
                </div>
                <div
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[16px]"
                  style={{ background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})`, boxShadow: `0 14px 24px ${theme.accent}28` }}
                >
                  <Sparkles size={16} color="#fff" />
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <span className="premium-chip rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em]" style={{ color: theme.text3 }}>
                  {streak.currentStreak} {streak.currentStreak === 1 ? 'zi' : 'zile'} streak
                </span>
                <span className="premium-chip rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em]" style={{ color: theme.text3 }}>
                  {weakCount} puncte slabe
                </span>
                <span className="premium-chip rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em]" style={{ color: theme.text3 }}>
                  {knowledgeSourceCount} surse AI
                </span>
              </div>

              <div className={`mt-4 grid gap-2 ${compact ? 'grid-cols-1' : 'grid-cols-2'}`}>
                <button
                  onClick={openCoachChat}
                  className="premium-card-hover press-feedback flex items-center justify-center gap-2 rounded-[18px] px-3 py-3 text-[11px] font-black uppercase tracking-[0.14em] text-white"
                  style={{
                    background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})`,
                    boxShadow: `0 14px 26px ${theme.accent}26`,
                  }}
                >
                  <MessageSquare size={14} />
                  {aiReady ? 'Coach AI' : 'Start AI'}
                </button>
                <button
                  onClick={() => navigate('/vault')}
                  className="premium-card-hover press-feedback flex items-center justify-center gap-2 rounded-[18px] px-3 py-3 text-[11px] font-black uppercase tracking-[0.14em]"
                  style={{ background: theme.surface2, border: `1px solid ${theme.border}`, color: theme.text }}
                >
                  <Database size={14} />
                  Vault
                </button>
              </div>
            </div>
          </div>
        )}

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
            <Tip label={`Sesiune zilnică${dueCount > 0 ? ` - ${dueCount} de recapitulat` : ""}`}>
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
            <Tip label="Biblioteca AI">
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
                <div className="flex gap-1.5 items-center">
                  {newQuizCount > 0 && (
                    <span className="w-2 h-2 rounded-full" style={{ background: theme.accent, boxShadow: `0 0 8px ${theme.accent}` }} title="Grile noi" />
                  )}
                  <span className="text-xs px-1.5 py-0.5 rounded-full"
                    style={{ background: theme.surface2, color: theme.text3 }}>
                    {activeQuizCount}
                  </span>
                </div>
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
              label="Sesiune zilnică"
              collapsed={false}
              badge={dueCount > 0 ? (
                <span className="text-xs px-1.5 py-0.5 rounded-full font-semibold"
                  style={{ background: `${theme.accent}28`, color: theme.accent }}>
                  {dueCount}
                </span>
              ) : undefined}
            />
            <div data-tutorial="nav-stats"><NavItem to="/stats" icon={<BarChart3 size={16} />} label="Statistici" collapsed={false} /></div>
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
            <div data-tutorial="nav-settings">
              <NavItem to="/settings" icon={<Settings size={16} />} label="Setări" collapsed={false} />
            </div>

            {/* Folders section */}
            <div data-tutorial="sidebar-folders" className="pt-4 pb-1">
              <div className="flex items-center justify-between px-1 mb-1.5">
                <span className="secondary-label">
                  Foldere
                </span>
                <button
                  onClick={() => {
                    setNewFolderParentId(null);
                    setShowNewFolder(true);
                  }}
                  aria-label="Creeaza folder"
                  className="p-1 rounded-lg transition-all press-feedback"
                  style={{ color: theme.text3 }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = theme.accent)}
                  onMouseLeave={(e) => (e.currentTarget.style.color = theme.text3)}
                >
                  <Plus size={13} />
                </button>
              </div>


              <div className="space-y-0.5">
                {(() => {
                  const count = uncategorizedCount;
                  const isDropTarget = dropTargetId === '__uncategorized__';
                  return count > 0 ? (
                    <NavLink to="/folder/null" style={{ textDecoration: 'none', display: 'block' }}>
                      {({ isActive }) => (
                        <motion.div
                          data-testid="folder-drop-target"
                          data-folder-id="__uncategorized__"
                          onDragOver={(event) => handleFolderDragOver(event, null)}
                          onDragEnter={(event) => handleFolderDragOver(event, null)}
                          onDragLeave={handleFolderDragLeave}
                          onDrop={(event) => handleFolderDrop(event, null)}
                          className="relative flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-colors press-feedback"
                          style={{
                            background: isDropTarget ? `${theme.accent}24` : isActive ? `${theme.accent}16` : 'transparent',
                            color: isActive ? theme.accent : theme.text2,
                            boxShadow: isDropTarget ? `inset 0 0 0 1px ${theme.accent}55` : 'none',
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
                          <span>{"\u{1F4CB}"}</span>
                          <span className="flex-1 truncate">Neclasificate</span>
                          <span className="text-xs px-1.5 py-0.5 rounded-full"
                            style={{ background: theme.surface2, color: theme.text3 }}>{count}</span>
                        </motion.div>
                      )}
                    </NavLink>
                  ) : null;
                })()}

                {visibleFolders.map(({ folder, depth }) => {
                  const count = folderQuizCount.get(folder.id) ?? 0;
                  const colorHex = FOLDER_COLORS.find(c => c.id === folder.color)?.bg ?? '#0A84FF';
                  const childCount = folders.filter((candidate) => candidate.parentId === folder.id).length;
                  const isDropTarget = dropTargetId === folder.id;

                  if (editingFolder === folder.id) {
                    return (
                      <div key={folder.id} className="flex items-center gap-1 py-1" style={{ paddingLeft: 8 + depth * 14 }}>
                        <span>{folder.emoji}</span>
                        <input autoFocus type="text" value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleRenameFolder(folder.id); if (e.key === 'Escape') setEditingFolder(null); }}
                          className="flex-1 bg-transparent text-sm rounded px-1"
                          style={{ color: theme.text, outline: `1px solid ${theme.accent}`, border: 'none' }} />
                        <button
                          onClick={() => handleRenameFolder(folder.id)}
                          aria-label="Salveaza numele folderului"
                          className="p-1"
                          style={{ color: theme.success }}
                        >
                          <Check size={12} />
                        </button>
                        <button
                          onClick={() => setEditingFolder(null)}
                          aria-label="Anuleaza redenumirea folderului"
                          className="p-1"
                          style={{ color: theme.text3 }}
                        >
                          <X size={12} />
                        </button>
                      </div>
                    );
                  }

                  return (
                    <NavLink key={folder.id} to={`/folder/${folder.id}`} style={{ textDecoration: 'none', display: 'block' }}>
                      {({ isActive }) => (
                        <div className="group relative">
                          <motion.div
                            data-testid="folder-drop-target"
                            data-folder-id={folder.id}
                            onDragOver={(event) => handleFolderDragOver(event, folder.id)}
                            onDragEnter={(event) => handleFolderDragOver(event, folder.id)}
                            onDragLeave={handleFolderDragLeave}
                            onDrop={(event) => handleFolderDrop(event, folder.id)}
                            initial={{ opacity: 0, scale: 0.85, x: -10 }}
                            animate={{ opacity: 1, scale: 1, x: 0 }}
                            transition={{ type: 'spring', stiffness: 380, damping: 22 }}
                            className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-colors press-feedback"
                            style={{
                              background: isDropTarget ? `${colorHex}24` : isActive ? `${theme.accent}16` : 'transparent',
                              color: isActive ? theme.accent : theme.text2,
                              paddingRight: 36,
                              paddingLeft: 12 + depth * 14,
                              boxShadow: isDropTarget ? `inset 0 0 0 1px ${colorHex}66` : 'none',
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
                            {depth > 0 && (
                              <span className="text-[10px] opacity-40" style={{ color: theme.text3 }}>└</span>
                            )}
                            <span className="flex-1 truncate">{folder.name}</span>
                            {childCount > 0 && !count && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full"
                                style={{ background: theme.surface2, color: theme.text3 }}>
                                {childCount}
                              </span>
                            )}
                            {count > 0 && (
                              <span className="text-xs px-1.5 py-0.5 rounded-full"
                                style={{ background: `${colorHex}22`, color: colorHex }}>
                                {count}
                              </span>
                            )}
                          </motion.div>
                          {/* Edit/delete shown on hover */}
                          <div className="absolute right-2 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-0.5 rounded-lg px-1 py-0.5"
                            style={{ background: theme.isDark ? 'rgba(0,0,0,0.75)' : 'rgba(255,255,255,0.92)' }}>
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                setNewFolderParentId(folder.id);
                                setShowNewFolder(true);
                              }}
                              aria-label={`Creeaza subfolder in ${folder.name}`}
                              className="p-1 rounded hover:opacity-80" style={{ color: theme.accent }}>
                              <Plus size={11} />
                            </button>
                            <button
                              onClick={(e) => { e.preventDefault(); setEditingFolder(folder.id); setEditName(folder.name); }}
                              aria-label={`Redenumeste folderul ${folder.name}`}
                              className="p-1 rounded hover:opacity-80" style={{ color: theme.text3 }}>
                              <Pencil size={11} />
                            </button>
                            <button
                              onClick={(e) => { e.preventDefault(); setDeleteTarget({ id: folder.id, name: folder.name }); }}
                              aria-label={`Sterge folderul ${folder.name}`}
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
        description="Grilele din el vor fi șterse definitiv împreună cu folderul. Această acțiune nu poate fi anulată."
        confirmLabel="Șterge folderul" cancelLabel="Anulează" variant="danger"
        onConfirm={confirmDelete} onCancel={() => setDeleteTarget(null)}
      />

      <Suspense fallback={null}>
        <AISettings open={showAISettings} onClose={() => setShowAISettings(false)} />
      </Suspense>

      {/* Update modal */}
      <Suspense fallback={null}>
        <UpdateModal />
      </Suspense>

      {/* Centered folder creation modal */}
      <Portal>
        <AnimatePresence>
          {showNewFolder && (
            <NewFolderModal
              folders={folders}
              initialParentId={newFolderParentId}
              onClose={() => {
                setShowNewFolder(false);
                setNewFolderParentId(null);
              }}
              onAdd={handleCreateFolder}
            />
          )}
        </AnimatePresence>
      </Portal>

      {/* Bottom: version + collapse */}
      <div className="p-2 flex-shrink-0 space-y-1" style={{ borderTop: `1px solid ${theme.border}` }}>
        {/* Logout (collapsed only) */}
        {collapsed && (
          <Tip label="Schimbă utilizatorul">
            <button onClick={logout}
              aria-label="Schimba utilizatorul"
              className="w-full flex items-center justify-center p-2.5 rounded-xl transition-all press-feedback"
              style={{ color: theme.text3 }}
              onMouseEnter={(e) => (e.currentTarget.style.color = theme.danger)}
              onMouseLeave={(e) => (e.currentTarget.style.color = theme.text3)}>
              <LogOut size={15} />
            </button>
          </Tip>
        )}

        {/* Update button */}
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
            aria-label={collapsed ? 'Extinde sidebar' : 'Restrange sidebar'}
            whileHover={{ backgroundColor: `${theme.accent}12` }}
            whileTap={{ scale: 0.94 }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm press-feedback"
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
