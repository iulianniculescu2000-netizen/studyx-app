import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import {
  AlertCircle,
  BookOpen,
  Bot,
  Brain,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  CreditCard,
  Flame,
  FolderPlus,
  Image as ImageIcon,
  Layers,
  Loader2,
  Pencil,
  Plus,
  PlusCircle,
  Sparkles,
  Trash2,
  Upload,
  X as XIcon,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Folder, Quiz, Question } from '../../types';
import type { Theme } from '../../theme/themes';
import { useQuizStore } from '../../store/quizStore';
import { useToastStore } from '../../store/toastStore';
import ConfirmDialog from '../../components/ConfirmDialog';
import Portal from '../../components/Portal';

/* ═══════════════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════════════ */

export interface FlashcardDeckSummary {
  accentColor: string;
  due: number;
  masteryPct: number;
  mastered: number;
  quiz: Quiz;
  seen: number;
  total: number;
}

/* ═══════════════════════════════════════════════════════════════════════
   Shared utilities (patterns from Residency.tsx)
   ═══════════════════════════════════════════════════════════════════════ */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="mb-2 px-1 text-[12px] font-medium uppercase tracking-wide"
      style={{ color: 'var(--text3, #86868b)' }}
    >
      {children}
    </h2>
  );
}

function folderPath(folders: Folder[], folder: Folder) {
  const byId = new Map(folders.map((item) => [item.id, item]));
  const names = [folder.name];
  let parent = folder.parentId ? byId.get(folder.parentId) : undefined;
  const guard = new Set([folder.id]);
  while (parent && !guard.has(parent.id)) {
    guard.add(parent.id);
    names.unshift(parent.name);
    parent = parent.parentId ? byId.get(parent.parentId) : undefined;
  }
  return names.join(' / ');
}

function ResourceRow({
  icon,
  title,
  detail,
  onClick,
  busy,
  first,
  iconBg,
  iconColor,
  theme,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
  onClick: () => void;
  busy?: boolean;
  first?: boolean;
  iconBg: string;
  iconColor: string;
  theme: Theme;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="fine-row flex w-full items-center gap-3 px-4 py-3 text-left disabled:opacity-60"
      style={{ borderRadius: 0, borderTop: first ? undefined : '1px solid var(--hairline)' }}
    >
      <div
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px]"
        style={{ background: iconBg, color: iconColor }}
      >
        {busy ? <Loader2 size={18} className="animate-spin" /> : icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-semibold" style={{ color: theme.text }}>
          {title}
        </div>
        <div className="truncate text-[12px]" style={{ color: theme.text3 }}>
          {detail}
        </div>
      </div>
      <ChevronRight size={16} style={{ color: theme.text3 }} />
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   FolderTargetSelect (preserved)
   ═══════════════════════════════════════════════════════════════════════ */

export function FolderTargetSelect({
  folders,
  value,
  theme,
  label = 'Salvează în',
  onChange,
  onCreateFolder,
}: {
  folders: Folder[];
  value: string;
  theme: Theme;
  label?: string;
  onChange: (folderId: string) => void;
  onCreateFolder: (name: string, parentId: string | null) => string;
}) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [browseParentId, setBrowseParentId] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const selectedFolder = folders.find((folder) => folder.id === value);
  const selectedLabel = selectedFolder ? `${selectedFolder.emoji} ${selectedFolder.name}` : 'Neclasificate';
  const browseFolder = browseParentId ? folders.find((folder) => folder.id === browseParentId) : undefined;
  const childFolders = folders
    .filter((folder) => (folder.parentId ?? null) === browseParentId)
    .sort((a, b) => a.name.localeCompare(b.name));
  const childCount = (folderId: string) => folders.filter((folder) => folder.parentId === folderId).length;

  useEffect(() => {
    if (!open) return undefined;
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setCreating(false);
      }
    };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [open]);

  const toggleOpen = () => {
    if (open) {
      setOpen(false);
      return;
    }
    setBrowseParentId(null);
    setCreating(false);
    setOpen(true);
  };

  const submitNewFolder = () => {
    const name = newName.trim();
    if (!name) return;
    const id = onCreateFolder(name, browseParentId);
    onChange(id);
    setNewName('');
    setCreating(false);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={toggleOpen}
        className="flex w-full items-center gap-3 rounded-[14px] border px-3 py-2.5 text-left transition-all"
        style={{
          background: theme.surface2,
          borderColor: open ? `${theme.accent}55` : theme.border,
          color: theme.text,
        }}
      >
        <div className="min-w-0 flex-1">
          <div className="text-[9px] font-black uppercase tracking-[0.18em]" style={{ color: theme.text3 }}>
            {label}
          </div>
          <div className="mt-0.5 truncate text-xs font-black">{selectedLabel}</div>
        </div>
        <motion.div animate={{ rotate: open ? 180 : 0 }} style={{ color: theme.text3 }}>
          <ChevronDown size={15} />
        </motion.div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.16 }}
            className="absolute left-0 right-0 top-[calc(100%+0.45rem)] z-40 rounded-[18px] border p-1.5 shadow-2xl"
            style={{
              background: theme.isDark ? 'rgba(20,24,30,0.98)' : 'rgba(255,255,255,0.98)',
              borderColor: theme.border,
              backdropFilter: 'blur(18px) saturate(160%)',
            }}
          >
            {browseFolder && (
              <button
                type="button"
                onClick={() => setBrowseParentId(browseFolder.parentId ?? null)}
                className="mb-1 flex w-full items-center gap-2 rounded-[12px] px-2 py-1.5 text-left transition-all hover:bg-[var(--hover-fill)]"
                style={{ color: theme.text3 }}
              >
                <ChevronDown size={13} className="rotate-90" />
                <span className="truncate text-[11px] font-black">{folderPath(folders, browseFolder)}</span>
              </button>
            )}

            <div className="custom-scrollbar max-h-52 overflow-y-auto">
              {(() => {
                const hereId = browseFolder ? browseFolder.id : '__uncategorized__';
                const hereLabel = browseFolder ? `${browseFolder.emoji} ${browseFolder.name}` : 'Neclasificate';
                const hereActive = hereId === value;
                return (
                  <button
                    type="button"
                    onClick={() => {
                      onChange(hereId);
                      setOpen(false);
                    }}
                    className="flex w-full items-center gap-3 rounded-[14px] px-3 py-2 text-left transition-all"
                    style={{
                      background: hereActive ? theme.accent : 'transparent',
                      color: hereActive ? '#fff' : theme.text,
                    }}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-black">{hereLabel}</div>
                      <div
                        className="mt-0.5 truncate text-[10px]"
                        style={{ color: hereActive ? 'rgba(255,255,255,0.72)' : theme.text3 }}
                      >
                        Salvează aici
                      </div>
                    </div>
                    {hereActive && <Check size={14} />}
                  </button>
                );
              })()}

              {childFolders.map((folder) => {
                const active = folder.id === value;
                const subCount = childCount(folder.id);
                return (
                  <button
                    key={folder.id}
                    type="button"
                    onClick={() => setBrowseParentId(folder.id)}
                    className="flex w-full items-center gap-3 rounded-[14px] px-3 py-2 text-left transition-all hover:bg-[var(--hover-fill)]"
                    style={{
                      background: active ? `${theme.accent}1c` : 'transparent',
                      color: theme.text,
                    }}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-black">
                        {folder.emoji} {folder.name}
                      </div>
                      <div className="mt-0.5 truncate text-[10px]" style={{ color: theme.text3 }}>
                        {subCount > 0
                          ? `${subCount} ${subCount === 1 ? 'subfolder' : 'subfoldere'}`
                          : 'Deschide'}
                      </div>
                    </div>
                    {active && <Check size={14} style={{ color: theme.accent }} />}
                    <ChevronDown size={14} className="-rotate-90" style={{ color: theme.text3 }} />
                  </button>
                );
              })}
            </div>

            <div className="mt-1 border-t pt-1.5" style={{ borderColor: theme.border }}>
              {creating ? (
                <div className="flex flex-col gap-2 p-1.5">
                  <input
                    autoFocus
                    value={newName}
                    onChange={(event) => setNewName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') submitNewFolder();
                      if (event.key === 'Escape') setCreating(false);
                    }}
                    placeholder={browseFolder ? `Subfolder în ${browseFolder.name}` : 'Nume folder nou'}
                    className="w-full rounded-[12px] border px-3 py-2 text-xs font-bold outline-none"
                    style={{ background: theme.surface2, borderColor: theme.border, color: theme.text }}
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={submitNewFolder}
                      className="flex-1 rounded-[12px] px-3 py-2 text-[11px] font-black uppercase tracking-wider text-white"
                      style={{ background: theme.accent }}
                    >
                      Creează
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCreating(false);
                        setNewName('');
                      }}
                      className="rounded-[12px] px-3 py-2 text-[11px] font-black"
                      style={{ background: theme.surface2, color: theme.text3 }}
                    >
                      Anulează
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setCreating(true)}
                  className="flex w-full items-center gap-2 rounded-[14px] px-3 py-2 text-left transition-all hover:bg-[var(--hover-fill)]"
                  style={{ color: theme.accent }}
                >
                  <FolderPlus size={15} />
                  <span className="text-xs font-black">
                    {browseFolder ? `Subfolder nou în ${browseFolder.name}` : 'Folder nou'}
                  </span>
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   LibrarySourceSelect (preserved)
   ═══════════════════════════════════════════════════════════════════════ */

function LibrarySourceSelect({
  sources,
  value,
  disabled,
  theme,
  onChange,
}: {
  sources: Array<{ id: string; name: string }>;
  value: string;
  disabled?: boolean;
  theme: Theme;
  onChange: (sourceId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = sources.find((source) => source.id === value);

  useEffect(() => {
    if (!open) return undefined;
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('mousedown', close);
    window.addEventListener('keydown', onEsc);
    return () => {
      window.removeEventListener('mousedown', close);
      window.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative flex-1">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center gap-2 rounded-[12px] border px-3 py-2.5 text-left transition-all disabled:opacity-60"
        style={{
          background: theme.surface,
          borderColor: open ? `${theme.accent}55` : theme.border,
          color: theme.text,
        }}
      >
        <span className="min-w-0 flex-1 truncate text-xs font-bold">
          {selected?.name ?? 'Alege un curs'}
        </span>
        <motion.div animate={{ rotate: open ? 180 : 0 }} style={{ color: theme.text3 }}>
          <ChevronDown size={14} />
        </motion.div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.16 }}
            className="absolute left-0 right-0 top-[calc(100%+0.4rem)] z-40 rounded-[16px] border p-1.5 shadow-2xl"
            style={{
              background: theme.isDark ? 'rgba(20,24,30,0.98)' : 'rgba(255,255,255,0.98)',
              borderColor: theme.border,
              backdropFilter: 'blur(18px) saturate(160%)',
            }}
          >
            <div className="custom-scrollbar max-h-52 overflow-y-auto">
              {sources.map((source) => {
                const active = source.id === value;
                return (
                  <button
                    key={source.id}
                    type="button"
                    onClick={() => {
                      onChange(source.id);
                      setOpen(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-[12px] px-3 py-2 text-left transition-all"
                    style={{
                      background: active ? theme.accent : 'transparent',
                      color: active ? '#fff' : theme.text,
                    }}
                  >
                    <span className="min-w-0 flex-1 truncate text-xs font-bold">{source.name}</span>
                    {active && <Check size={14} />}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   GeneratedDeckCard — confirmation after an AI deck is created
   Says where the cards went and lets the user move them right there.
   ═══════════════════════════════════════════════════════════════════════ */

export interface GeneratedDeckInfo {
  id: string;
  title: string;
  count: number;
  folderId: string | null;
  /** True when the folder was picked from the course name rather than by the user. */
  suggested: boolean;
  /** Set when the AI stopped before reaching the requested count; the deck keeps what was made. */
  interrupted?: {
    requested: number;
    reason: string;
    /** Seconds the provider asked to wait, when it said so. */
    waitSeconds: number | null;
    /** Distinguishes one interruption from the next, so the countdown restarts. */
    at: number;
  };
}

/** "40 s" under a minute and a half, else whole minutes. */
function formatWaitShort(seconds: number) {
  return seconds < 90 ? `${seconds} s` : `${Math.ceil(seconds / 60)} min`;
}

/**
 * "Continuă generarea" with a countdown while the provider's limit resets.
 * The parent keys it by the interruption, so every new wait starts a new count.
 */
function ResumeButton({
  waitSeconds,
  busy,
  progress,
  theme,
  onResume,
}: {
  waitSeconds: number | null;
  busy: boolean;
  progress: string;
  theme: Theme;
  onResume: () => void;
}) {
  // Waits longer than five minutes (a daily limit) are not worth counting down: let the user decide.
  const [left, setLeft] = useState(() => (waitSeconds !== null && waitSeconds <= 300 ? Math.ceil(waitSeconds) + 1 : 0));
  const counting = left > 0;

  useEffect(() => {
    if (!counting) return undefined;
    const timer = setInterval(() => setLeft((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [counting]);

  return (
    <button
      type="button"
      onClick={onResume}
      disabled={busy || counting}
      className="press-feedback mt-3 flex w-full items-center justify-center gap-2 rounded-full py-2.5 text-[13.5px] font-semibold text-white transition-[filter] duration-300 hover:brightness-110 disabled:opacity-60"
      style={{ background: theme.accent }}
    >
      {busy && <Loader2 size={15} className="animate-spin" />}
      {busy ? progress || 'Generez...' : counting ? `Continuă în ${formatWaitShort(left)}` : 'Continuă generarea'}
    </button>
  );
}

export function GeneratedDeckCard({
  info,
  folders,
  theme,
  resuming,
  progress,
  onMove,
  onCreateFolder,
  onStart,
  onResume,
  onDismiss,
}: {
  info: GeneratedDeckInfo;
  folders: Folder[];
  theme: Theme;
  resuming: boolean;
  progress: string;
  onMove: (folderId: string) => void;
  onCreateFolder: (name: string, parentId: string | null) => string;
  onStart: () => void;
  onResume: () => void;
  onDismiss: () => void;
}) {
  const folder = info.folderId ? folders.find((item) => item.id === info.folderId) ?? null : null;
  const where = folder ? `${folder.emoji} ${folderPath(folders, folder)}` : 'Neclasificate';
  const { interrupted } = info;
  const tone = interrupted ? theme.warning : theme.success;

  return (
    <motion.section
      role="status"
      aria-label={interrupted ? 'Pachet creat parțial' : 'Pachet creat'}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="rounded-2xl p-4"
      style={{ background: theme.surface, border: `1px solid ${tone}45` }}
    >
      <div className="flex items-start gap-3">
        <div
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px]"
          style={{ background: `${tone}18`, color: tone }}
        >
          {interrupted ? <Clock size={18} /> : <Check size={18} />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[14.5px] font-semibold" style={{ color: theme.text }}>
            {interrupted
              ? `Pachet creat parțial · ${info.count} din ${interrupted.requested} carduri`
              : `Pachet creat · ${cardsLabel(info.count)}`}
          </div>
          <div className="truncate text-[12.5px]" style={{ color: theme.text3 }}>
            {info.title}
          </div>
          <div className="mt-1 text-[12.5px]" style={{ color: theme.text2 }}>
            Salvat în <span className="font-semibold">{where}</span>
            {info.suggested && (
              <span style={{ color: theme.text3 }}> · ales după numele cursului</span>
            )}
          </div>
          {interrupted && (
            <div className="mt-1.5 text-[12.5px] leading-relaxed" style={{ color: theme.text3 }}>
              {interrupted.reason} Cardurile de până acum sunt salvate; poți continua de unde a rămas.
            </div>
          )}
        </div>
        <button
          type="button"
          aria-label="Închide"
          onClick={onDismiss}
          className="press-feedback flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full transition-colors"
          style={{ background: theme.surface2, color: theme.text2 }}
        >
          <XIcon size={15} />
        </button>
      </div>

      <div className="mt-3">
        <FolderTargetSelect
          label="Mută în"
          folders={folders}
          value={info.folderId ?? '__uncategorized__'}
          theme={theme}
          onChange={onMove}
          onCreateFolder={onCreateFolder}
        />
      </div>

      {interrupted && (
        <ResumeButton
          key={interrupted.at}
          waitSeconds={interrupted.waitSeconds}
          busy={resuming}
          progress={progress}
          theme={theme}
          onResume={onResume}
        />
      )}

      <button
        type="button"
        onClick={onStart}
        className="press-feedback mt-3 flex w-full items-center justify-center rounded-full py-2.5 text-[13.5px] font-semibold transition-[filter] duration-300 hover:brightness-110"
        style={interrupted ? { background: theme.surface2, color: theme.text } : { background: theme.accent, color: '#fff' }}
      >
        Începe repetarea
      </button>
    </motion.section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   ReviewHeroCard — "De repetat azi"
   Counts exactly what "Începe repetarea" serves: due cards + never-seen cards.
   ═══════════════════════════════════════════════════════════════════════ */

/** "1 card", "9 carduri", "20 de carduri" — Romanian number agreement. */
function cardsLabel(count: number) {
  if (count === 1) return '1 card';
  const rest = count % 100;
  return rest === 0 || rest >= 20 ? `${count} de carduri` : `${count} carduri`;
}

export function ReviewHeroCard({
  totalDue,
  totalFresh,
  totalCards,
  totalMastered,
  streak,
  theme,
}: {
  totalDue: number;
  totalFresh: number;
  totalCards: number;
  totalMastered: number;
  streak: number;
  theme: Theme;
}) {
  if (totalCards === 0) return null;
  const toStudy = totalDue + totalFresh;
  const masteryPct = Math.round((totalMastered / totalCards) * 100);
  const estimatedMinutes = Math.max(1, Math.ceil(toStudy * 0.5));
  const breakdown = [
    totalDue > 0 ? `${totalDue} ${totalDue === 1 ? 'restantă' : 'restante'}` : '',
    totalFresh > 0 ? `${totalFresh} ${totalFresh === 1 ? 'nou' : 'noi'}` : '',
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.04 }}
      aria-label="De repetat azi"
      className="rounded-2xl px-5 py-5"
      style={{ background: theme.surface, border: '1px solid var(--hairline)' }}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[12px] font-medium uppercase tracking-wide" style={{ color: theme.text3 }}>
          De repetat azi
        </h2>
        {streak > 0 && (
          <span
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-medium"
            style={{ background: `${theme.warning}14`, color: theme.text2 }}
          >
            <Flame size={13} style={{ color: theme.warning }} />
            {streak} {streak === 1 ? 'zi' : 'zile'} la rând
          </span>
        )}
      </div>

      {toStudy === 0 ? (
        <div className="mt-3 flex items-center gap-3">
          <div
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[12px]"
            style={{ background: `${theme.success}18`, color: theme.success }}
          >
            <Check size={20} />
          </div>
          <div>
            <div className="text-[17px] font-semibold" style={{ color: theme.text }}>
              La zi!
            </div>
            <div className="text-[13px]" style={{ color: theme.text3 }}>
              Nu ai nimic de repetat acum.
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-2 flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
          <div className="min-w-0">
            <div
              className="text-[28px] font-semibold leading-tight tracking-tight"
              style={{ color: theme.text }}
            >
              {cardsLabel(toStudy)}
            </div>
            <div className="mt-0.5 text-[13px]" style={{ color: theme.text3 }}>
              ~{estimatedMinutes} min{breakdown ? ` · ${breakdown}` : ''}
            </div>
          </div>
          <Link
            to="/flashcards/session/all"
            className="press-feedback w-full rounded-full px-6 py-2.5 text-center text-[14px] font-semibold text-white transition-[filter] duration-300 hover:brightness-110 sm:w-auto"
            style={{ background: theme.accent }}
          >
            Începe repetarea
          </Link>
        </div>
      )}

      <div className="mt-4">
        <div
          role="progressbar"
          aria-label="Cărți stăpânite"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={masteryPct}
          className="h-1 overflow-hidden rounded-full"
          style={{ background: 'var(--fill-subtle, rgba(0,0,0,0.05))' }}
        >
          <motion.div
            className="h-full rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${masteryPct}%` }}
            transition={{ duration: 0.8, ease: 'easeOut', delay: 0.15 }}
            style={{ background: theme.success }}
          />
        </div>
        <div className="mt-1.5 text-[11.5px]" style={{ color: theme.text3 }}>
          {totalMastered} din {totalCards} stăpânite · {masteryPct}%
        </div>
      </div>
    </motion.section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   FlashcardHubActions — "Creează pachet nou"
   Two cards for the main paths (AI from a course, from mistakes), then a
   compact list for imports and the quick demo deck.
   ═══════════════════════════════════════════════════════════════════════ */

export interface FlashcardHubActionsProps {
  aiCount: number;
  aiError: string;
  aiLoading: boolean;
  aiProgress: string;
  csvError: string;
  csvImporting: boolean;
  hasAI: boolean;
  folders: Folder[];
  photoError: string;
  photoImporting: boolean;
  theme: Theme;
  targetFolderId: string;
  librarySources: Array<{ id: string; name: string }>;
  libraryGenerating: boolean;
  onAiCountChange: (count: number) => void;
  onAnkiImport: () => void;
  onCreateFolder: (name: string, parentId: string | null) => string;
  onCsvImport: () => void;
  onLibraryGenerate: (sourceId: string) => void;
  onMistakeDeckCreate: () => void;
  onPhotoImport: () => void;
  onPdfImport: () => void;
  onQuickDeckCreate: () => void;
  onTargetFolderChange: (folderId: string) => void;
}

const AI_COUNTS = [10, 25, 50, 100];

export function FlashcardHubActions({
  aiCount,
  aiError,
  aiLoading,
  aiProgress,
  csvError,
  csvImporting,
  hasAI,
  folders,
  photoError,
  photoImporting,
  theme,
  targetFolderId,
  librarySources,
  libraryGenerating,
  onAiCountChange,
  onAnkiImport,
  onCreateFolder,
  onCsvImport,
  onLibraryGenerate,
  onMistakeDeckCreate,
  onPhotoImport,
  onPdfImport,
  onQuickDeckCreate,
  onTargetFolderChange,
}: FlashcardHubActionsProps) {
  const [librarySourceId, setLibrarySourceId] = useState('');
  const activeLibrarySourceId = librarySources.some((source) => source.id === librarySourceId)
    ? librarySourceId
    : librarySources[0]?.id ?? '';
  const cardStyle = { background: theme.surface, border: '1px solid var(--hairline)' };
  const busy = aiLoading || libraryGenerating;

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.14 }}
    >
      <SectionLabel>CREEAZĂ PACHET NOU</SectionLabel>

      {/* Error banner — right under the title so a failed run is never off-screen */}
      <AnimatePresence>
        {(aiError || csvError || photoError) && (
          <motion.div
            role="alert"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mb-3 flex items-start gap-2.5 rounded-2xl border p-3"
            style={{
              background: `${theme.danger}08`,
              borderColor: `${theme.danger}20`,
              color: theme.danger,
            }}
          >
            <AlertCircle size={15} className="mt-0.5 shrink-0" />
            <div className="text-[12px] font-medium leading-relaxed">
              {aiError || csvError || photoError}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mb-3">
        <FolderTargetSelect
          folders={folders}
          value={targetFolderId}
          theme={theme}
          onChange={onTargetFolderChange}
          onCreateFolder={onCreateFolder}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {/* ── AI din curs ── */}
        <div className="flex flex-col rounded-2xl p-4" style={cardStyle}>
          <div className="flex items-center gap-3">
            <div
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px]"
              style={{ background: `${theme.accent}14`, color: theme.accent }}
            >
              {busy ? <Loader2 size={18} className="animate-spin" /> : <Bot size={18} />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[14px] font-semibold" style={{ color: theme.text }}>
                  AI din curs
                </span>
                <Sparkles size={12} style={{ color: theme.accent2 }} />
              </div>
              <div className="truncate text-[12px]" style={{ color: theme.text3 }}>
                {busy ? aiProgress || 'Se procesează...' : 'Din PDF-ul cursului tău'}
              </div>
            </div>
          </div>

          <div className="mt-4">
            <div className="mb-1.5 text-[11.5px]" style={{ color: theme.text3 }}>
              Câte carduri
            </div>
            <div className="flex rounded-full p-0.5" style={{ background: theme.surface2 }}>
              {AI_COUNTS.map((count) => (
                <button
                  key={count}
                  type="button"
                  aria-pressed={aiCount === count}
                  onClick={() => onAiCountChange(count)}
                  className="flex-1 rounded-full py-1.5 text-[12.5px] font-semibold transition-colors"
                  style={{
                    background: aiCount === count ? theme.accent : 'transparent',
                    color: aiCount === count ? '#fff' : theme.text2,
                  }}
                >
                  {count}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[11px]" style={{ color: theme.text3 }}>
              Cursurile cu poze se importă întregi.
            </p>
          </div>

          <button
            type="button"
            onClick={onPdfImport}
            disabled={busy}
            className="press-feedback mt-4 flex w-full items-center justify-center gap-2 rounded-full py-2.5 text-[13px] font-semibold text-white transition-[filter] duration-300 hover:brightness-110 disabled:opacity-60"
            style={{ background: theme.accent }}
          >
            <BookOpen size={15} />
            Alege PDF-ul cursului
          </button>

          {hasAI && librarySources.length > 0 && (
            <div className="mt-4 pt-3" style={{ borderTop: '1px solid var(--hairline)' }}>
              <div className="mb-2 text-[11.5px]" style={{ color: theme.text3 }}>
                Sau din Biblioteca AI
              </div>
              <div className="flex flex-col gap-2">
                <LibrarySourceSelect
                  sources={librarySources}
                  value={activeLibrarySourceId}
                  disabled={libraryGenerating}
                  theme={theme}
                  onChange={setLibrarySourceId}
                />
                <button
                  type="button"
                  onClick={() => activeLibrarySourceId && onLibraryGenerate(activeLibrarySourceId)}
                  disabled={libraryGenerating || !activeLibrarySourceId}
                  className="press-feedback flex items-center justify-center gap-2 rounded-full py-2 text-[12.5px] font-semibold transition-colors disabled:opacity-60"
                  style={{ background: theme.surface2, color: theme.text }}
                >
                  {libraryGenerating ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Sparkles size={14} style={{ color: theme.accent }} />
                  )}
                  {libraryGenerating ? 'Generez...' : 'Generează din bibliotecă'}
                </button>
              </div>
            </div>
          )}

          {!hasAI && (
            <p className="mt-3 text-[11px]" style={{ color: theme.text3 }}>
              Cursurile cu poze merg fără cheie AI. Pentru text, adaugă o cheie în Setări AI.
            </p>
          )}
        </div>

        {/* ── Din greșeli ── */}
        <div className="flex flex-col rounded-2xl p-4" style={cardStyle}>
          <div className="flex items-center gap-3">
            <div
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px]"
              style={{ background: `${theme.warning}14`, color: theme.warning }}
            >
              <Brain size={18} />
            </div>
            <div className="min-w-0">
              <div className="text-[14px] font-semibold" style={{ color: theme.text }}>
                Din greșeli
              </div>
              <div className="truncate text-[12px]" style={{ color: theme.text3 }}>
                Din ce ai greșit repetat
              </div>
            </div>
          </div>
          <p className="mt-4 text-[12.5px] leading-relaxed" style={{ color: theme.text3 }}>
            Pentru fiecare întrebare pe care ai greșit-o de mai multe ori primești 2 carduri, ca să le
            fixezi în memorie.
          </p>
          <button
            type="button"
            onClick={onMistakeDeckCreate}
            className="press-feedback mt-auto flex w-full items-center justify-center gap-2 rounded-full py-2.5 text-[13px] font-semibold transition-colors"
            style={{ background: theme.surface2, color: theme.text, marginTop: '1rem' }}
          >
            Creează pachetul
          </button>
        </div>
      </div>

      {/* ── Importuri și pachet rapid ── */}
      <div className="mt-3 overflow-hidden rounded-2xl" style={cardStyle}>
        <ResourceRow
          first
          icon={<ImageIcon size={18} />}
          title="Import poze"
          detail="JPG, PNG, WEBP sau PDF scanat"
          iconBg={`${theme.success}14`}
          iconColor={theme.success}
          theme={theme}
          busy={photoImporting}
          onClick={onPhotoImport}
        />
        <ResourceRow
          icon={<Upload size={18} />}
          title="Import CSV"
          detail="CSV, TSV — o linie per card"
          iconBg={`${theme.accent2}14`}
          iconColor={theme.accent2}
          theme={theme}
          busy={csvImporting}
          onClick={onCsvImport}
        />
        <ResourceRow
          icon={<Layers size={18} />}
          title="Import Anki (.apkg)"
          detail="Deck-uri Anki exportate"
          iconBg={`${theme.accent}14`}
          iconColor={theme.accent}
          theme={theme}
          onClick={onAnkiImport}
        />
        <ResourceRow
          icon={<Plus size={18} />}
          title="Pachet rapid"
          detail="6 carduri demo pentru test"
          iconBg={`${theme.accent}14`}
          iconColor={theme.accent}
          theme={theme}
          onClick={onQuickDeckCreate}
        />
      </div>
    </motion.section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   EditDeckModal (preserved)
   ═══════════════════════════════════════════════════════════════════════ */

function EditDeckModal({
  quiz,
  theme,
  onClose,
}: {
  quiz: Quiz;
  theme: Theme;
  onClose: () => void;
}) {
  const updateQuiz = useQuizStore((state) => state.updateQuiz);
  const dialogRef = useFocusTrap(true, onClose);
  const titleId = useId();
  const [title, setTitle] = useState(quiz.title);
  const [cards, setCards] = useState<Array<{ id: string; front: string; back: string }>>(() =>
    quiz.questions.map((q) => ({
      id: q.id,
      front: q.text,
      back: q.options.find((o) => o.isCorrect)?.text ?? q.options[0]?.text ?? '',
    })),
  );

  const updateCard = (id: string, field: 'front' | 'back', value: string) => {
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, [field]: value } : c)));
  };

  const addCard = () => {
    const id = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
    setCards((prev) => [...prev, { id, front: '', back: '' }]);
  };

  const deleteCard = (id: string) => {
    setCards((prev) => prev.filter((c) => c.id !== id));
  };

  const save = () => {
    const updatedQuestions: Question[] = cards
      .filter((c) => c.front.trim() || c.back.trim())
      .map((card) => {
        const original = quiz.questions.find((q) => q.id === card.id);
        if (original) {
          return {
            ...original,
            text: card.front.trim() || original.text,
            options: original.options.map((opt) =>
              opt.isCorrect ? { ...opt, text: card.back.trim() || opt.text } : opt,
            ),
          };
        }
        const optId = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
        return {
          id: card.id,
          text: card.front.trim() || 'Întrebare',
          options: [{ id: optId, text: card.back.trim() || 'Răspuns', isCorrect: true }],
          difficulty: 'medium' as const,
          tags: [],
          explanation: '',
        };
      });
    updateQuiz(quiz.id, { title: title.trim() || quiz.title, questions: updatedQuestions });
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-start justify-center overflow-y-auto"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)', padding: '2rem 1rem' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        initial={{ scale: 0.95, y: 24 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        className="glass-panel premium-shadow w-full max-w-xl rounded-[28px] p-6"
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 id={titleId} className="text-[15px] font-black" style={{ color: theme.text }}>
            Editează deck
          </h2>
          <button
            onClick={onClose}
            aria-label="Închide"
            className="flex h-8 w-8 items-center justify-center rounded-xl transition-colors"
            style={{ color: theme.text3, background: theme.surface2 }}
          >
            <XIcon size={16} />
          </button>
        </div>

        <div className="mb-5">
          <div
            className="mb-1.5 text-[9px] font-black uppercase tracking-[0.18em]"
            style={{ color: theme.text3 }}
          >
            Titlu deck
          </div>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-[16px] border px-4 py-3 text-sm font-bold outline-none focus:ring-2"
            style={{
              background: theme.surface2,
              borderColor: theme.border,
              color: theme.text,
            }}
          />
        </div>

        <div className="mb-1.5 flex items-center justify-between">
          <div
            className="text-[9px] font-black uppercase tracking-[0.18em]"
            style={{ color: theme.text3 }}
          >
            Carduri · {cards.length}
          </div>
        </div>

        <div className="mb-4 flex max-h-[50vh] flex-col gap-2.5 overflow-y-auto pr-1">
          {cards.map((card, idx) => (
            <div
              key={card.id}
              className="rounded-[18px] border p-3.5"
              style={{ background: theme.surface2, borderColor: theme.border }}
            >
              <div className="mb-2 flex items-center justify-between">
                <span
                  className="text-[9px] font-black uppercase tracking-wider"
                  style={{ color: theme.text3 }}
                >
                  {idx + 1}
                </span>
                <button
                  onClick={() => deleteCard(card.id)}
                  aria-label="Șterge cardul"
                  className="flex h-6 w-6 items-center justify-center rounded-lg transition-colors hover:bg-red-500/15"
                  style={{ color: theme.danger }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
              <textarea
                value={card.front}
                onChange={(e) => updateCard(card.id, 'front', e.target.value)}
                placeholder="Față — întrebare / concept"
                rows={2}
                className="mb-2 w-full resize-none rounded-[12px] border px-3 py-2 text-[13px] font-medium outline-none focus:ring-1"
                style={{ background: theme.surface, borderColor: theme.border, color: theme.text }}
              />
              <textarea
                value={card.back}
                onChange={(e) => updateCard(card.id, 'back', e.target.value)}
                placeholder="Spate — răspuns / explicație"
                rows={2}
                className="w-full resize-none rounded-[12px] border px-3 py-2 text-[13px] font-medium outline-none focus:ring-1"
                style={{ background: theme.surface, borderColor: theme.border, color: theme.text }}
              />
            </div>
          ))}
        </div>

        <button
          onClick={addCard}
          className="mb-5 flex w-full items-center justify-center gap-2 rounded-[16px] border py-2.5 text-[11px] font-black uppercase tracking-wider transition-all hover:scale-[1.01]"
          style={{
            borderColor: `${theme.accent}44`,
            color: theme.accent,
            borderStyle: 'dashed',
            background: `${theme.accent}08`,
          }}
        >
          <PlusCircle size={14} />
          Card nou
        </button>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-[16px] py-3 text-[11px] font-black uppercase tracking-wider transition-all"
            style={{ background: theme.surface2, color: theme.text3 }}
          >
            Anulează
          </button>
          <button
            onClick={save}
            disabled={cards.every((card) => !card.front.trim() && !card.back.trim())}
            title="Un pachet are nevoie de cel puțin un card"
            className="flex-1 rounded-[16px] py-3 text-[11px] font-black uppercase tracking-wider text-white transition-all hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
            style={{ background: theme.accent }}
          >
            Salvează
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   DeckRow + FlashcardDeckGrid — "Pachetele tale"
   Row-based list; edit and delete sit beside the link, never inside it.
   ═══════════════════════════════════════════════════════════════════════ */

function DeckRow({
  deck,
  theme,
  index,
  first,
  onEdit,
  onDelete,
}: {
  deck: FlashcardDeckSummary;
  theme: Theme;
  index: number;
  first?: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const ringColor =
    deck.due > 0 ? theme.warning : deck.masteryPct >= 80 ? theme.success : theme.accent;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.04 * index, ease: [0.16, 1, 0.3, 1] }}
      className="fine-row flex items-center"
      style={{ borderTop: first ? undefined : '1px solid var(--hairline)' }}
    >
      <Link
        to={`/flashcards/session/${deck.quiz.id}`}
        className="flex min-w-0 flex-1 items-center gap-3 py-3.5 pl-4 pr-2 text-left"
      >
        <div className="flex-shrink-0 text-xl">{deck.quiz.emoji}</div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-semibold" style={{ color: theme.text }}>
            {deck.quiz.title}
          </div>
          <div className="mt-0.5 flex items-center gap-2">
            <span className="text-[12px]" style={{ color: theme.text3 }}>
              {deck.total} carduri
            </span>
            {deck.due > 0 && (
              <span className="text-[12px] font-medium" style={{ color: theme.warning }}>
                · {deck.due} {deck.due === 1 ? 'restantă' : 'restante'}
              </span>
            )}
            {deck.seen === 0 && (
              <span className="text-[12px] font-medium" style={{ color: theme.accent }}>
                · nou
              </span>
            )}
          </div>
          <div
            className="mt-2 h-1 overflow-hidden rounded-full"
            style={{ background: 'var(--fill-subtle, rgba(0,0,0,0.05))' }}
          >
            <motion.div
              className="h-full rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${deck.masteryPct}%` }}
              transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 + index * 0.04 }}
              style={{ background: ringColor }}
            />
          </div>
          <div className="mt-1 text-[11px]" style={{ color: theme.text3 }}>
            {deck.masteryPct}% stăpânit
          </div>
        </div>
      </Link>

      <div className="flex flex-shrink-0 items-center gap-0.5 pr-3">
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Editează pachetul ${deck.quiz.title}`}
          title="Editează"
          className="press-feedback flex h-8 w-8 items-center justify-center rounded-lg"
          style={{ color: theme.text3 }}
        >
          <Pencil size={14} />
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Șterge pachetul ${deck.quiz.title}`}
          title="Șterge"
          className="press-feedback flex h-8 w-8 items-center justify-center rounded-lg"
          style={{ color: theme.text3 }}
        >
          <Trash2 size={14} />
        </button>
        <ChevronRight size={16} aria-hidden style={{ color: theme.text3 }} />
      </div>
    </motion.div>
  );
}

interface FlashcardDeckGridProps {
  decks: FlashcardDeckSummary[];
  folders: Folder[];
  theme: Theme;
}

export function FlashcardDeckGrid({ decks, folders, theme }: FlashcardDeckGridProps) {
  const deleteQuiz = useQuizStore((state) => state.deleteQuiz);
  const addToast = useToastStore((state) => state.addToast);
  const [editingDeck, setEditingDeck] = useState<Quiz | null>(null);
  // Kept after closing so the dialog text does not blank out while it fades.
  const [deleteTarget, setDeleteTarget] = useState<Quiz | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const groups = useMemo(() => {
    const byId = new Map(folders.map((folder) => [folder.id, folder]));
    const map = new Map<string, { name: string; emoji: string; decks: FlashcardDeckSummary[] }>();

    for (const deck of decks) {
      const folder = deck.quiz.folderId ? byId.get(deck.quiz.folderId) : undefined;
      const key = folder ? folder.id : '__uncategorized__';
      if (!map.has(key)) {
        map.set(key, {
          name: folder ? folderPath(folders, folder) : 'Neclasificate',
          emoji: folder ? folder.emoji : '',
          decks: [],
        });
      }
      map.get(key)!.decks.push(deck);
    }

    const sorted = Array.from(map.entries())
      .map(([id, group]) => ({ id, ...group }))
      .sort((a, b) => {
        if (a.id === '__uncategorized__') return 1;
        if (b.id === '__uncategorized__') return -1;
        return a.name.localeCompare(b.name);
      });

    // Offset per group so the entrance stagger continues across groups.
    return sorted.map((group, index) => ({
      ...group,
      startIndex: sorted.slice(0, index).reduce((sum, previous) => sum + previous.decks.length, 0),
    }));
  }, [decks, folders]);

  const askDelete = (quiz: Quiz) => {
    setDeleteTarget(quiz);
    setDeleteOpen(true);
  };

  const confirmDelete = () => {
    if (deleteTarget) {
      deleteQuiz(deleteTarget.id);
      addToast(`Pachetul „${deleteTarget.title}" a fost șters.`, 'success');
    }
    setDeleteOpen(false);
  };

  const overlays = (
    <>
      <Portal>
        <AnimatePresence>
          {editingDeck && (
            <EditDeckModal quiz={editingDeck} theme={theme} onClose={() => setEditingDeck(null)} />
          )}
        </AnimatePresence>
      </Portal>
      <ConfirmDialog
        open={deleteOpen}
        title={`Ștergi pachetul „${deleteTarget?.title ?? ''}"?`}
        description={`Cele ${deleteTarget?.questions.length ?? 0} carduri din pachet dispar. Acțiunea nu poate fi anulată.`}
        confirmLabel="Șterge pachetul"
        cancelLabel="Anulează"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteOpen(false)}
      />
    </>
  );

  if (decks.length === 0) {
    return (
      <>
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.12 }}
          className="rounded-2xl px-5 py-14 text-center"
          style={{ background: theme.surface, border: '1px solid var(--hairline)' }}
        >
          <div className="mb-3 text-4xl">🃏</div>
          <h3 className="mb-1.5 text-[16px] font-semibold" style={{ color: theme.text }}>
            Niciun pachet încă
          </h3>
          <p className="text-[13px]" style={{ color: theme.text3 }}>
            Încarcă un curs PDF sau creează un pachet rapid mai jos.
          </p>
        </motion.div>
        {overlays}
      </>
    );
  }

  return (
    <section>
      <SectionLabel>PACHETELE TALE</SectionLabel>
      <div className="flex flex-col gap-5">
        {groups.map((group) => (
          <div key={group.id}>
            {groups.length > 1 && (
              <div className="mb-1.5 flex items-center gap-2 px-1">
                {group.id === '__uncategorized__' ? (
                  <CreditCard size={13} style={{ color: theme.text3 }} />
                ) : (
                  <span className="text-sm">{group.emoji}</span>
                )}
                <span
                  className="text-[12px] font-semibold"
                  style={{
                    color: group.id === '__uncategorized__' ? theme.text3 : theme.text,
                  }}
                >
                  {group.name}
                </span>
                <span className="text-[11px]" style={{ color: theme.text3 }}>
                  · {group.decks.length}
                </span>
              </div>
            )}
            <div
              className="overflow-hidden rounded-2xl"
              style={{ background: theme.surface, border: '1px solid var(--hairline)' }}
            >
              {group.decks.map((deck, idx) => (
                <DeckRow
                  key={deck.quiz.id}
                  deck={deck}
                  theme={theme}
                  index={group.startIndex + idx}
                  first={idx === 0}
                  onEdit={() => setEditingDeck(deck.quiz)}
                  onDelete={() => askDelete(deck.quiz)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      {overlays}
    </section>
  );
}
