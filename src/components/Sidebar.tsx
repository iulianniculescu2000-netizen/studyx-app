import ThemeModeSwitcher from './ThemeModeSwitcher';
import { lazy, Suspense, useId, useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap';
import type { DragEvent } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, BookOpen, BarChart3, Flame,
  Plus, Pencil, Trash2, Check, X, RefreshCw, LogOut,
  PanelLeftOpen, StickyNote, CreditCard,
  Download, ArrowDownCircle, RotateCcw, AlertCircle,
  Settings, Brain, Database, Stethoscope, Trophy, TrendingUp,
} from 'lucide-react';
import { useTheme } from '../theme/ThemeContext';
import { useUserStore } from '../store/userStore';
import { useFolderStore } from '../store/folderStore';
import { useNewFolderDialog } from '../store/newFolderDialogStore';
import { useQuizStore } from '../store/quizStore';
import { useStatsStore } from '../store/statsStore';
import { useUpdateStore } from '../store/updateStore';
import { useToastStore } from '../store/toastStore';
import { useViewportProfile } from '../hooks/useViewportProfile';
import { useAdaptiveMotion } from '../hooks/useAdaptiveMotion';
import ConfirmDialog from './ConfirmDialog';
import Portal from './Portal';
import Logo from './Logo';
import ThemedSelect from './ThemedSelect';
import { isFlashcardDeck } from '../lib/deckKind';
import { isRezidentiatQuiz } from '../lib/rezidentiatBank';
import { isRezidentiatRootFolder } from '../lib/rezidentiatRoot';
import { suggestFolderAppearance } from '../lib/folderAppearance';
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

/**
 * IconChip \u2014 the reusable pictogram unit for nav items: a small glass slot,
 * tinted per category from the app's own folder-color palette (`FOLDER_COLORS`)
 * instead of a new color system. Nudged off-axis at rest, settles upright and
 * pops slightly on hover; active items get a soft hue-tinted glow instead of a
 * solid fill, so the accent doesn't fight the per-item color underneath.
 * Items with no `hue` (e.g. Settings) render as a neutral, un-tilted slot \u2014
 * content is colorful, tools stay quiet.
 */
function IconChip({
  icon, hue, active, size,
}: {
  icon: React.ReactNode; hue?: string; active: boolean; size: number;
}) {
  const theme = useTheme();
  const { calmMotion } = useAdaptiveMotion();

  const colorStyle: React.CSSProperties = hue ? {
    background: active
      ? `color-mix(in srgb, ${hue} 30%, var(--fill-subtle))`
      : `color-mix(in srgb, ${hue} 14%, var(--fill-subtle))`,
    border: `1px solid color-mix(in srgb, ${hue} ${active ? 55 : 24}%, transparent)`,
    color: active ? hue : `color-mix(in srgb, ${hue} 68%, ${theme.text2})`,
    boxShadow: active
      ? `inset 0 1px 0 var(--glass-highlight), 0 6px 14px color-mix(in srgb, ${hue} 32%, transparent)`
      : 'inset 0 1px 0 var(--glass-highlight)',
  } : {
    background: active ? theme.surface2 : 'transparent',
    border: `1px solid ${active ? theme.border2 : 'transparent'}`,
    color: active ? theme.text : theme.text3,
  };

  return (
    <motion.span
      initial={calmMotion ? false : { scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1, rotate: 0 }}
      whileHover={calmMotion ? undefined : hue ? { scale: 1.06, y: -1 } : { scale: 1.04 }}
      transition={calmMotion ? { duration: 0 } : { duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="flex items-center justify-center accent-shadow-hover"
      style={{ width: size, height: size, flexShrink: 0, borderRadius: hue ? '11px 9px 12px 8px' : '10px', ...colorStyle }}
    >
      {icon}
    </motion.span>
  );
}

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

/** Tooltip shown on collapsed sidebar items. Drawn in a portal: the sidebar is overflow-hidden and would clip it. */
function Tip({ label, children }: { label: string; children: React.ReactNode }) {
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);
  const theme = useTheme();
  const { calmMotion } = useAdaptiveMotion();
  const show = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setAnchor({ x: rect.right + 12, y: rect.top + rect.height / 2 });
  };
  return (
    <div className="relative" onMouseEnter={show} onMouseLeave={() => setAnchor(null)}>
      {children}
      {label && (
        <Portal>
          <AnimatePresence>
            {anchor && (
              <motion.div
                initial={calmMotion ? { opacity: 0 } : { opacity: 0, x: -4, scale: 0.96 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={calmMotion ? { opacity: 0 } : { opacity: 0, x: -2, scale: 0.98 }}
                transition={calmMotion ? { duration: 0.12 } : { duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className="fixed rounded-xl px-3 py-1.5 text-xs font-medium whitespace-nowrap pointer-events-none"
                role="tooltip"
                style={{
                  left: anchor.x,
                  top: anchor.y,
                  transform: 'translateY(-50%)',
                  zIndex: 600,
                  background: theme.isDark ? 'rgba(30,30,36,0.98)' : 'rgba(255,255,255,0.98)',
                  border: `1px solid ${theme.border2}`,
                  color: theme.text,
                  boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
                }}
              >
                {label}
              </motion.div>
            )}
          </AnimatePresence>
        </Portal>
      )}
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
  const { calmMotion } = useAdaptiveMotion();
  if (!window.electronAPI?.updaterCheck) return null;

  const hasAction = status === 'available' || status === 'error' || status === 'ready';
  const isDownloading = status === 'downloading';
  const isChecking = status === 'checking';

  let icon: React.ReactNode;
  let color: string = theme.text3;

  if (isChecking) {
    icon = calmMotion
      ? <span><RefreshCw size={14} /></span>
      : <motion.span animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}><RefreshCw size={14} /></motion.span>;
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
      <button
        onClick={onOpen}
        aria-label={label}
        className="press-feedback w-full flex items-center gap-2 px-3 py-2 rounded-xl transition-colors hover:bg-[var(--hover-fill)] relative"
        style={{ color, justifyContent: collapsed ? 'center' : 'flex-start' }}
      >
        {/* Pulsing dot for actionable states */}
        {hasAction && (
          <motion.div
            className="absolute top-1.5 right-2 w-1.5 h-1.5 rounded-full glow-pulse"
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
            <motion.div className="h-full progress-fill-anim" style={{ background: theme.accent }}
              animate={{ width: `${downloadPercent}%` }}
            />
          </div>
        )}
      </button>
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
  const dialogRef = useFocusTrap(true, onClose);
  const titleId = useId();
  // A drag that starts inside the panel (selecting the typed name) and ends on the backdrop is not a click on it.
  const pressStartedOnBackdrop = useRef(false);
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('\u{1F4C1}');
  const [color, setColor] = useState<QuizColor>('blue');
  const [parentId, setParentId] = useState<string>(initialParentId ?? '__root__');
  // Until the user picks an icon/color themselves, mirror a name-aware suggestion.
  const [appearanceTouched, setAppearanceTouched] = useState(false);

  const handleNameChange = (value: string) => {
    setName(value);
    if (!appearanceTouched && value.trim()) {
      const suggestion = suggestFolderAppearance(value);
      setEmoji(suggestion.emoji);
      setColor(suggestion.color);
    }
  };

  // Always show the active emoji in the grid so a smart suggestion (e.g. ❤️) is highlighted.
  const emojiOptions = Array.from(new Set([emoji, ...FOLDER_EMOJIS]));

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
      onMouseDown={(e) => { pressStartedOnBackdrop.current = e.target === e.currentTarget; }}
      onClick={(e) => { if (e.target === e.currentTarget && pressStartedOnBackdrop.current) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        // Dim only: the panel inside already blurs its own backdrop. A second, nested
        // blur on this full-screen layer was re-rendered every frame of the open animation.
        background: 'rgba(0,0,0,0.5)',
      }}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 12 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 8 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        className="premium-modal"
        style={{
          borderRadius: 28,
          maxWidth: 420,
          width: '92%',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px 28px 18px', borderBottom: `1px solid ${theme.border}` }}>
          <div>
            <h3 id={titleId} style={{ margin: 0, fontSize: 18, fontWeight: 800, color: theme.text }}>Folder nou</h3>
            <p style={{ margin: '3px 0 0', fontSize: 12, color: theme.text3 }}>Organizează-ți grilele în foldere</p>
          </div>
          <button 
            onClick={onClose}
            aria-label="Inchide dialogul"
            className="press-feedback icon-pop"
            style={{ color: theme.text3, background: theme.surface2, border: 'none', cursor: 'pointer', padding: 8, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-7 pt-5 custom-scrollbar" style={{ minHeight: 0 }}>
          {/* Emoji picker */}
          <div style={{ marginBottom: 22 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: theme.text3, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Pictograma</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {emojiOptions.map((e) => (
                <button key={e} onClick={() => { setEmoji(e); setAppearanceTouched(true); }}
                  aria-label={`Alege pictograma ${e}`}
                  className="press-feedback"
                  style={{
                    width: 38, height: 38, borderRadius: 11, fontSize: 19,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: emoji === e ? `${theme.accent}22` : theme.surface2,
                    border: `1.5px solid ${emoji === e ? theme.accent + '55' : 'transparent'}`,
                    cursor: 'pointer', transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
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
                <button key={c.id} onClick={() => { setColor(c.id); setAppearanceTouched(true); }}
                  aria-label={`Alege culoarea ${c.id}`}
                  className="press-feedback"
                  style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: c.bg, border: 'none', cursor: 'pointer',
                    outline: color === c.id ? `3px solid ${c.bg}` : 'none',
                    outlineOffset: 3,
                    transform: color === c.id ? 'scale(1.1)' : 'scale(1)',
                    transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
                    boxShadow: color === c.id ? `0 6px 16px ${c.bg}44` : 'none',
                  }} />
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: theme.text3, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Nume folder</div>
            <input autoFocus data-autofocus value={name} onChange={(e) => handleNameChange(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              placeholder="Ex: Anatomie, Cardiologie..."
              className="focus-ring-premium"
              style={{
                width: '100%', padding: '14px 18px', borderRadius: 16, background: theme.surface2, border: `1px solid ${theme.border}`,
                color: theme.text, outline: 'none', fontSize: 14, fontWeight: 600,
              }} />
          </div>

          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: theme.text3, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>În interiorul</div>
            <ThemedSelect
              value={parentId}
              onChange={setParentId}
              options={[
                { value: '__root__', label: 'Folder principal' },
                ...folders.map((folder) => ({
                  value: folder.id,
                  label: `${folder.emoji} ${buildFolderPath(folders, folder.id)}`,
                })),
              ]}
            />
          </div>

          <button onClick={handleCreate} disabled={!canCreate}
            className={`glow-pulse press-feedback ${canCreate ? 'accent-shadow-hover' : ''}`}
            style={{
              width: '100%', padding: '16px', borderRadius: 18, border: 'none', fontWeight: 900, fontSize: 14,
              textTransform: 'uppercase', letterSpacing: '0.05em',
              cursor: canCreate ? 'pointer' : 'not-allowed', opacity: canCreate ? 1 : 0.5,
              background: theme.accent, color: '#fff',
              boxShadow: `0 12px 30px ${theme.accent}30`,
            }}>Creează folder</button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/**
 * Nav row — active state is a soft accent-tinted background, not a solid
 * gradient fill, so it doesn't fight the per-item hue on the icon chip next
 * to it (the chip itself carries the "you are here" signal via its glow).
 */
function NavItem({
  to, icon, label, badge, end, collapsed, hue,
}: {
  to: string; icon: React.ReactNode; label: string; badge?: React.ReactNode;
  end?: boolean; collapsed: boolean; hue?: string;
}) {
  const theme = useTheme();
  const { calmMotion } = useAdaptiveMotion();
  return (
    <NavLink
      to={to}
      end={end}
      aria-label={collapsed ? label : undefined}
      className="rounded-[14px] focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_var(--bg),0_0_0_4px_var(--focus-ring)]"
      style={{ textDecoration: 'none', display: 'block' }}
    >
      {({ isActive }) => (
        <motion.div
          whileHover={calmMotion ? undefined : { x: collapsed ? 0 : 2 }}
          whileTap={calmMotion ? undefined : { scale: 0.97 }}
          transition={calmMotion ? { duration: 0 } : { duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className={`relative flex items-center transition-all press-feedback reveal-line ${isActive ? '' : 'hover:bg-[var(--hover-fill)]'}`}
          data-active={isActive}
          style={collapsed ? {
            width: 44,
            height: 44,
            margin: '0 auto',
            justifyContent: 'center',
            background: isActive ? 'var(--accent-soft)' : undefined,
            border: `1px solid ${isActive ? `${theme.accent}40` : 'transparent'}`,
            color: isActive ? theme.text : theme.text3,
            cursor: 'pointer',
            borderRadius: '14px',
            boxShadow: isActive ? `0 4px 18px ${theme.accent}2e` : 'none',
          } : {
            gap: 10,
            padding: '6px 10px',
            justifyContent: 'flex-start' as const,
            background: isActive ? 'var(--accent-soft)' : undefined,
            border: `1px solid ${isActive ? `${theme.accent}30` : 'transparent'}`,
            color: isActive ? theme.text : theme.text2,
            fontSize: 13.5,
            fontWeight: isActive ? 700 : 600,
            cursor: 'pointer',
            borderRadius: '13px',
            boxShadow: isActive ? `0 4px 18px ${theme.accent}26` : 'none',
          }}
        >
          <IconChip icon={icon} hue={hue} active={isActive} size={collapsed ? 30 : 27} />
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

/**
 * Owns the "Folder nou" dialog end to end, subscribed only to its own tiny
 * store, so opening it never re-renders the Sidebar itself.
 */
function NewFolderDialogHost() {
  const open = useNewFolderDialog((state) => state.open);
  const parentId = useNewFolderDialog((state) => state.parentId);
  const hide = useNewFolderDialog((state) => state.hide);
  const folders = useFolderStore((state) => state.folders);
  const addFolder = useFolderStore((state) => state.addFolder);
  const navigate = useNavigate();

  const handleCreate = (name: string, emoji: string, color: QuizColor, targetParentId?: string | null) => {
    const id = addFolder(name, emoji, color, targetParentId);
    hide();
    navigate(`/folder/${id}`);
  };

  return (
    <Portal>
      <AnimatePresence>
        {open && <NewFolderModal folders={folders} initialParentId={parentId} onClose={hide} onAdd={handleCreate} />}
      </AnimatePresence>
    </Portal>
  );
}

export default function Sidebar() {
  const theme = useTheme();
  const { calmMotion } = useAdaptiveMotion();
  const navigate = useNavigate();
  const compact = typeof window !== 'undefined' && (window.innerHeight < 820 || window.innerWidth < 1240);
  const { username, logout } = useUserStore();
  const { folders, updateFolder, deleteFolder } = useFolderStore();
  const { quizzes, bulkDeleteQuizzes, moveToFolder } = useQuizStore();
  const { streak, getDueQuestions, questionStats } = useStatsStore();
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
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  // The two layouts (icons only / full) are separate trees, so the width alone
  // glides while the content pops. Fade the content in as the width settles.
  const rootRef = useRef<HTMLDivElement>(null);
  const lastCollapsedRef = useRef(collapsed);
  useLayoutEffect(() => {
    if (lastCollapsedRef.current === collapsed) return;
    lastCollapsedRef.current = collapsed;
    const root = rootRef.current;
    if (!root || typeof root.animate !== 'function') return;
    const targets = root.querySelectorAll<HTMLElement>(':scope > :not(:first-child), [data-sidebar-fade]');
    targets.forEach((el) => {
      el.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: calmMotion ? 160 : 300,
        delay: calmMotion ? 0 : collapsed ? 140 : 80,
        easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
        fill: 'backwards',
      });
    });
  }, [collapsed, calmMotion]);

  const dueCount = getDueQuestions().length;
  const avatarLetter = username?.charAt(0).toUpperCase() ?? '?';
  // Same "cleared vs. still due today" ratio the Dashboard hero ring shows —
  // reusing it here (smaller) so the two rings read as the same signal, not two.
  const ringTotalToday = Math.max(dueCount, 10);
  const ringCompletedToday = Math.max(0, ringTotalToday - dueCount);
  const ringPercent = Math.round((ringCompletedToday / ringTotalToday) * 100);
  const ringRadius = 13;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset = ringCircumference * (1 - ringPercent / 100);

  const totalAnswered = Object.values(questionStats).reduce((a, s) => a + s.timesCorrect + s.timesWrong, 0);
  const medicalRank = totalAnswered > 1000 ? 'MEDIC PRIMAR' : totalAnswered > 500 ? 'MEDIC SPECIALIST' : totalAnswered > 100 ? 'MEDIC REZIDENT' : 'STUDENT LA MEDICINĂ';
  // Rezidențiat content (real bank + exam-style AI packs) is browsed only from
  // the Rezidențiat page — every sidebar count for "Toate grilele"/folders
  // stays scoped to the year's coursework, matching what QuizList itself shows.
  const activeQuizCount = useMemo(() => quizzes.filter(q => !q.archived && !isFlashcardDeck(q) && !isRezidentiatQuiz(q)).length, [quizzes]);
  const newQuizCount = useMemo(() => quizzes.filter(q => now - q.createdAt < 86400000 * 2 && !isRezidentiatQuiz(q)).length, [quizzes, now]);
  const uncategorizedCount = useMemo(() => quizzes.filter(q => !q.folderId && !isRezidentiatQuiz(q)).length, [quizzes]);
  const folderQuizCount = useMemo(() => {
    const counts = new Map<string, number>();
    for (const quiz of quizzes) {
      if (!quiz.folderId || isRezidentiatQuiz(quiz)) continue;
      counts.set(quiz.folderId, (counts.get(quiz.folderId) ?? 0) + 1);
    }
    return counts;
  }, [quizzes]);

  // Fetch real version number from Electron on mount
  const { setLocalVersion } = useUpdateStore();
  useEffect(() => {
    window.electronAPI?.updaterGetVersion()
      .then((v) => { if (v) setLocalVersion(v); })
      .catch((e) => console.error('[StudyX] Failed to get app version', e));
  }, [setLocalVersion]);

  useEffect(() => {
    const handler = () => setShowAISettings(true);
    window.addEventListener('studyx:open-ai-settings', handler);
    return () => window.removeEventListener('studyx:open-ai-settings', handler);
  }, []);

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

  const visibleFolders = useMemo(() => {
    // The "Rezidențiat" quiz folder holds only content already browsable (and
    // now exclusively so) from the dedicated Rezidențiat page — listing it
    // here too would show a folder whose quiz count reads 0 (folderQuizCount
    // excludes rezidențiat quizzes on purpose), which looks like a bug.
    const regularFolders = folders.filter((folder) => !isRezidentiatRootFolder(folder));
    const byParent = new Map<string, typeof folders>();
    regularFolders.forEach((folder) => {
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
      ref={rootRef}
      animate={{ width: collapsed ? 64 : compact ? 242 : 260 }}
      transition={calmMotion ? { duration: 0.18, ease: 'easeOut' } : { duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="studyx-sidebar flex flex-col flex-shrink-0 select-none overflow-hidden glass-panel"
      style={{
        height: '100dvh',
        borderRight: '1px solid var(--hairline)',
        boxShadow: '6px 0 24px -14px var(--shadow-color)',
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
            data-sidebar-fade
            className="text-base font-black ml-3 tracking-tighter"
            style={{ color: theme.text, WebkitAppRegion: 'no-drag' } as React.CSSProperties & { WebkitAppRegion: string }}
          >
            Study<span style={{ color: theme.accentText }}>X</span>
          </span>
        )}
      </div>

      {/* User header */}
      <div className={`${compact ? 'p-3' : 'p-4'} flex-shrink-0`} style={{ borderBottom: `1px solid ${theme.border}` }}>
        {collapsed ? (
          <Tip label={username ?? ''}>
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white text-xs mx-auto cursor-pointer shadow-lg"
              style={{ background: theme.accent }}
            >
              {avatarLetter}
            </div>
          </Tip>
        ) : (
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white text-base flex-shrink-0 shadow-lg"
              style={{ background: theme.accent }}
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
        {/*
          Replaces the old "Study Pulse" card (gradient hero, 3 chips, 2 buttons)
          that duplicated info already shown twice more in this same sidebar —
          streak in the user row above, due-count as badges on Recapitulare/
          Sesiune zilnică below. One ring, same signal as the Dashboard hero's
          progress ring, click goes straight to today's session.
        */}
        {collapsed ? (
          <Tip label={dueCount > 0 ? `${dueCount} de recapitulat azi` : 'Recapitulări la zi'}>
            <button type="button" onClick={() => navigate('/daily-review')} aria-label="Sesiune zilnica" className="mb-2.5 flex w-full items-center justify-center rounded-2xl p-2 press-feedback" style={{ background: 'var(--accent-soft)', border: `1px solid ${theme.accent}24` }}>
              <svg width={30} height={30} viewBox="0 0 40 40" style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
                <circle cx="20" cy="20" r={ringRadius} fill="none" stroke={theme.surface2} strokeWidth="5" />
                <motion.circle cx="20" cy="20" r={ringRadius} fill="none" stroke={theme.accent2} strokeWidth="5" strokeLinecap="round" strokeDasharray={ringCircumference} initial={false} animate={{ strokeDashoffset: ringOffset }} transition={{ duration: 0.6, ease: 'easeOut' }} />
              </svg>
            </button>
          </Tip>
        ) : (
          <button
            type="button"
            onClick={() => navigate('/daily-review')}
            className="mb-2.5 flex w-full items-center gap-2.5 rounded-2xl px-2.5 py-2 text-left press-feedback"
            style={{ background: 'var(--accent-soft)', border: `1px solid ${theme.accent}24` }}
          >
            <svg width={34} height={34} viewBox="0 0 40 40" style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
              <circle cx="20" cy="20" r={ringRadius} fill="none" stroke={theme.surface2} strokeWidth="5" />
              <motion.circle cx="20" cy="20" r={ringRadius} fill="none" stroke={theme.accent2} strokeWidth="5" strokeLinecap="round" strokeDasharray={ringCircumference} initial={false} animate={{ strokeDashoffset: ringOffset }} transition={{ duration: 0.6, ease: 'easeOut' }} />
            </svg>
            <div className="min-w-0">
              <div className="truncate text-[11.5px] font-bold" style={{ color: theme.text }}>
                {dueCount > 0 ? `${dueCount} de recapitulat` : 'Recapitulări la zi'}
              </div>
              <div className="text-[9.5px] font-semibold" style={{ color: theme.text3 }}>
                {ringPercent}% din azi, gata
              </div>
            </div>
          </button>
        )}

        {collapsed ? (
          <>
            <Tip label="Dashboard">
              <NavItem to="/" icon={<LayoutDashboard size={17} />} label="Dashboard" end collapsed hue="#0A84FF" />
            </Tip>
            <Tip label={`Toate grilele (${activeQuizCount})`}>
              <NavItem to="/quizzes" icon={<BookOpen size={17} />} label="Toate grilele" collapsed hue="#5E5CE6" />
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
                  hue="#FF9F0A"

                />
              </div>
            </Tip>
            <Tip label={`Sesiune zilnică${dueCount > 0 ? ` - ${dueCount} de recapitulat` : ""}`}>
              <div data-tutorial="nav-daily-review">
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
                  hue="#FF375F"
                />
              </div>
            </Tip>
            <Tip label="Statistici">
              <div data-tutorial="nav-stats">
                <NavItem to="/stats" icon={<BarChart3 size={17} />} label="Statistici" collapsed hue="#5AC8FA" />
              </div>
            </Tip>
            <Tip label="Realizări">
              <NavItem to="/gamification" icon={<Trophy size={17} />} label="Realizări" collapsed hue="#FF9F0A" />
            </Tip>
            <Tip label="Perspective AI">
              <NavItem to="/analytics" icon={<TrendingUp size={17} />} label="Perspective AI" collapsed hue="#5E5CE6" />
            </Tip>

            {/* zone divider: Studiu ↑ / Resurse ↓ — a text label wouldn't fit collapsed, so a hairline stands in for it */}
            <div className="my-1.5 mx-3" style={{ height: 1, background: theme.border }} />

            <Tip label="Notițe">
              <div data-tutorial="nav-notes">
                <NavItem to="/notes" icon={<StickyNote size={17} />} label="Notițe" collapsed hue="#30D158" />
              </div>
            </Tip>
            <Tip label="Biblioteca AI">
              <div data-tutorial="nav-vault">
                <NavItem to="/vault" icon={<Database size={16} />} label="Biblioteca AI" collapsed={collapsed} hue="#0A84FF" />
              </div>
            </Tip>
            <Tip label="Rezidențiat">
              <div>
                <NavItem to="/rezidentiat" icon={<Stethoscope size={17} />} label="Rezidențiat" collapsed hue="#FF453A" />
              </div>
            </Tip>
            <Tip label="Flashcarduri">
              <div data-tutorial="nav-flashcards">
                <NavItem to="/flashcards" icon={<CreditCard size={17} />} label="Flashcarduri" collapsed hue="#5E5CE6" />
              </div>
            </Tip>
          </>
        ) : (
          <>
            <div className="mb-1 px-2.5 text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: theme.text3, opacity: 0.55 }}>
              Studiu
            </div>
            <NavItem to="/" icon={<LayoutDashboard size={16} />} label="Dashboard" end collapsed={false} hue="#0A84FF" />
            <NavItem
              to="/quizzes"
              icon={<BookOpen size={16} />}
              label="Toate grilele"
              collapsed={false}
              hue="#5E5CE6"

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
                hue="#FF9F0A"

                badge={dueCount > 0 ? (
                  <span className="text-xs px-1.5 py-0.5 rounded-full font-semibold"
                    style={{ background: `${theme.warning}28`, color: theme.warning }}>
                    {dueCount}
                  </span>
                ) : undefined}
              />
            </div>
            <div data-tutorial="nav-daily-review">
              <NavItem
                to="/daily-review"
                icon={<Brain size={16} />}
                label="Sesiune zilnică"
                collapsed={false}
                hue="#FF375F"

                badge={dueCount > 0 ? (
                  <span className="text-xs px-1.5 py-0.5 rounded-full font-semibold"
                    style={{ background: `${theme.accent}28`, color: theme.accentText }}>
                    {dueCount}
                  </span>
                ) : undefined}
              />
            </div>
            <div data-tutorial="nav-stats"><NavItem to="/stats" icon={<BarChart3 size={16} />} label="Statistici" collapsed={false} hue="#5AC8FA" /></div>
            <NavItem to="/gamification" icon={<Trophy size={16} />} label="Realizări" collapsed={false} hue="#FF9F0A" />
            <NavItem to="/analytics" icon={<TrendingUp size={16} />} label="Perspective AI" collapsed={false} hue="#5E5CE6" />

            <div className="mb-1 mt-4 px-2.5 text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: theme.text3, opacity: 0.55 }}>
              Resurse
            </div>
            <div data-tutorial="nav-notes">
              <NavItem to="/notes" icon={<StickyNote size={16} />} label="Notițe" collapsed={false} hue="#30D158" />
            </div>

            <div data-tutorial="nav-vault">
              <NavItem to="/vault" icon={<Database size={16} />} label="Biblioteca AI" collapsed={false} hue="#0A84FF" />
            </div>
            <NavItem to="/rezidentiat" icon={<Stethoscope size={16} />} label="Rezidențiat" collapsed={false} hue="#FF453A" />
            <div data-tutorial="nav-flashcards">
              <NavItem
                to="/flashcards"
                icon={<CreditCard size={16} />}
                label="Flashcarduri"
                collapsed={false}
                hue="#5E5CE6"

              />
            </div>

            {/* Folders section */}
            <div data-tutorial="sidebar-folders" className="pt-4 pb-1">
              <div className="flex items-center justify-between px-1 mb-1.5">
                <span className="secondary-label">
                  Foldere
                </span>
                <button
                  onClick={() => {
                    useNewFolderDialog.getState().show(null);
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
                            boxShadow: isDropTarget ? `inset 0 0 0 1px ${theme.accent}55` : isActive ? `0 3px 14px ${theme.accent}22` : 'none',
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
                              boxShadow: isDropTarget ? `inset 0 0 0 1px ${colorHex}66` : isActive ? `0 3px 14px ${colorHex}22` : 'none',
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
                          {/* Edit/delete: on hover or keyboard focus, always on touch screens */}
                          <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-0.5 rounded-lg px-1 py-0.5 opacity-0 pointer-events-none transition-opacity group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto [@media(hover:none)]:opacity-100 [@media(hover:none)]:pointer-events-auto"
                            style={{ background: theme.isDark ? 'rgba(0,0,0,0.75)' : 'rgba(255,255,255,0.92)' }}>
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                useNewFolderDialog.getState().show(folder.id);
                              }}
                              aria-label={`Creeaza subfolder in ${folder.name}`}
                              className="p-1 rounded hover:opacity-80" style={{ color: theme.accentText }}>
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
      <NewFolderDialogHost />

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

        {/* Settings — pinned here, separate from the Studiu/Resurse zones above */}
        <div data-tutorial="nav-settings">
          {collapsed ? (
            <Tip label="Setări">
              <NavItem to="/settings" icon={<Settings size={17} />} label="Setări" collapsed />
            </Tip>
          ) : (
            <NavItem to="/settings" icon={<Settings size={16} />} label="Setări" collapsed={false} />
          )}
        </div>

        {/* Update button */}
        <UpdateButton
          collapsed={collapsed}
          status={updateStatus}
          localVersion={localVersion}
          downloadPercent={downloadPercent}
          onOpen={() => setShowUpdateModal(true)}
          theme={theme}
        />

        {/* Aspect: Luminos / Întunecat / Automat */}
        <div className={collapsed ? 'flex justify-center py-1' : 'px-2 py-1'}>
          <ThemeModeSwitcher variant="compact" label={collapsed ? undefined : 'Aspect'} />
        </div>

        {/* Collapse toggle */}
        <Tip label={collapsed ? 'Extinde sidebar' : ''}>
          <motion.button
            onClick={toggleCollapsed}
            aria-label={collapsed ? 'Extinde sidebar' : 'Restrange sidebar'}
            whileHover={{ backgroundColor: `${theme.accent}12` }}
            whileTap={calmMotion ? undefined : { scale: 0.94 }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm press-feedback focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_var(--bg),0_0_0_4px_var(--focus-ring)]"
            style={{ color: theme.text3, justifyContent: collapsed ? 'center' : 'flex-start' }}>
            <motion.span
              animate={{ rotate: collapsed ? 0 : 180 }}
              transition={calmMotion ? { duration: 0 } : { duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
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
