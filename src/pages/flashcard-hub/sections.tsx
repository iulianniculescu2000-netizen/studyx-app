import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  Bot,
  Brain,
  Check,
  CheckCircle,
  ChevronDown,
  Circle,
  Clock,
  CreditCard,
  FolderPlus,
  Image as ImageIcon,
  Inbox,
  Loader2,
  Pencil,
  Play,
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

export interface FlashcardDeckSummary {
  accentColor: string;
  due: number;
  masteryPct: number;
  mastered: number;
  quiz: Quiz;
  seen: number;
  total: number;
}

function MasteryRing({ pct, color }: { pct: number; color: string }) {
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pct / 100);

  return (
    <div className="relative w-11 h-11 flex-shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 44 44">
        <circle cx="22" cy="22" r={radius} fill="none" stroke={`${color}28`} strokeWidth="3.5" />
        <motion.circle
          cx="22"
          cy="22"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="3.5"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: 'easeOut', delay: 0.2 }}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[10px] font-bold" style={{ color }}>{pct}%</span>
      </div>
    </div>
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

function FolderTargetSelect({
  folders,
  value,
  theme,
  onChange,
  onCreateFolder,
}: {
  folders: Folder[];
  value: string;
  theme: Theme;
  onChange: (folderId: string) => void;
  onCreateFolder: (name: string, parentId: string | null) => string;
}) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const selectedFolder = folders.find((folder) => folder.id === value);
  const selectedLabel = selectedFolder ? `${selectedFolder.emoji} ${selectedFolder.name}` : 'Neclasificate';
  const options = [
    { id: '__uncategorized__', label: 'Neclasificate', helper: 'Fără folder dedicat' },
    ...folders.map((folder) => ({
      id: folder.id,
      label: `${folder.emoji} ${folderPath(folders, folder)}`,
      helper: 'Salvează aici',
    })),
  ];

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

  const submitNewFolder = () => {
    const name = newName.trim();
    if (!name) return;
    const parentId = selectedFolder ? selectedFolder.id : null;
    const id = onCreateFolder(name, parentId);
    onChange(id);
    setNewName('');
    setCreating(false);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center gap-3 rounded-[14px] border px-3 py-2.5 text-left transition-all"
        style={{
          background: theme.surface2,
          borderColor: open ? `${theme.accent}55` : theme.border,
          color: theme.text,
        }}
      >
        <div className="min-w-0 flex-1">
          <div className="text-[9px] font-black uppercase tracking-[0.18em]" style={{ color: theme.text3 }}>
            Salvează în
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
            <div className="custom-scrollbar max-h-52 overflow-y-auto">
              {options.map((option) => {
                const active = option.id === value;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
                      onChange(option.id);
                      setOpen(false);
                    }}
                    className="flex w-full items-center gap-3 rounded-[14px] px-3 py-2 text-left transition-all"
                    style={{
                      background: active ? `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})` : 'transparent',
                      color: active ? '#fff' : theme.text,
                    }}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-black">{option.label}</div>
                      <div className="mt-0.5 truncate text-[10px]" style={{ color: active ? 'rgba(255,255,255,0.72)' : theme.text3 }}>
                        {option.helper}
                      </div>
                    </div>
                    {active && <Check size={14} />}
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
                    placeholder={selectedFolder ? `Subfolder în ${selectedFolder.name}` : 'Nume folder nou'}
                    className="w-full rounded-[12px] border px-3 py-2 text-xs font-bold outline-none"
                    style={{ background: theme.surface2, borderColor: theme.border, color: theme.text }}
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={submitNewFolder}
                      className="flex-1 rounded-[12px] px-3 py-2 text-[11px] font-black uppercase tracking-wider text-white"
                      style={{ background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})` }}
                    >
                      Creează
                    </button>
                    <button
                      type="button"
                      onClick={() => { setCreating(false); setNewName(''); }}
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
                  className="flex w-full items-center gap-2 rounded-[14px] px-3 py-2 text-left transition-all hover:bg-white/5"
                  style={{ color: theme.accent }}
                >
                  <FolderPlus size={15} />
                  <span className="text-xs font-black">
                    {selectedFolder ? `Subfolder nou în ${selectedFolder.name}` : 'Folder nou'}
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
    const onEsc = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
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
                    onClick={() => { onChange(source.id); setOpen(false); }}
                    className="flex w-full items-center gap-2 rounded-[12px] px-3 py-2 text-left transition-all"
                    style={{
                      background: active ? `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})` : 'transparent',
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

interface SecondaryAction {
  key: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  busy?: boolean;
  onClick: () => void;
}

interface FlashcardHubActionsProps {
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
  totalCards: number;
  totalDue: number;
  totalMastered: number;
  targetFolderId: string;
  librarySources: Array<{ id: string; name: string }>;
  libraryGenerating: boolean;
  onAiCountChange: (count: number) => void;
  onCreateFolder: (name: string, parentId: string | null) => string;
  onCsvImport: () => void;
  onLibraryGenerate: (sourceId: string) => void;
  onMistakeDeckCreate: () => void;
  onPhotoImport: () => void;
  onPdfImport: () => void;
  onQuickDeckCreate: () => void;
  onTargetFolderChange: (folderId: string) => void;
}

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
  totalCards,
  totalDue,
  totalMastered,
  targetFolderId,
  librarySources,
  libraryGenerating,
  onAiCountChange,
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
  const stats = [
    { label: 'Carduri', value: totalCards, icon: <CreditCard size={15} />, color: theme.accent },
    { label: 'Restante', value: totalDue, icon: <Clock size={15} />, color: totalDue > 0 ? theme.warning : theme.success },
    { label: 'Stăpânite', value: totalMastered, icon: <CheckCircle size={15} />, color: theme.success },
  ];

  const secondaryActions: SecondaryAction[] = [
    { key: 'quick', label: 'Deck rapid', icon: <Plus size={17} />, color: theme.accent, onClick: onQuickDeckCreate },
    { key: 'photo', label: 'Import poze', icon: <ImageIcon size={17} />, color: theme.success, busy: photoImporting, onClick: onPhotoImport },
    { key: 'csv', label: 'Import CSV / Anki', icon: <Upload size={17} />, color: theme.accent2, busy: csvImporting, onClick: onCsvImport },
    { key: 'mistakes', label: 'Din greșeli', icon: <Brain size={17} />, color: theme.warning, onClick: onMistakeDeckCreate },
  ];

  return (
    <>
      <motion.div
        data-tutorial="flashcard-hub"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-5 flex flex-wrap items-center gap-x-7 gap-y-3 rounded-2xl px-4 py-3"
        style={{ background: theme.surface, border: `1px solid ${theme.border}` }}
      >
        {stats.map((stat) => (
          <div key={stat.label} className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: `${stat.color}15`, color: stat.color }}>
              {stat.icon}
            </div>
            <div>
              <div className="text-lg font-black leading-none tracking-tight" style={{ color: theme.text }}>{stat.value}</div>
              <div className="text-[10px] font-bold uppercase tracking-wider opacity-50" style={{ color: theme.text }}>{stat.label}</div>
            </div>
          </div>
        ))}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.99 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.06 }}
        className="mb-4 rounded-[24px] p-5"
        style={{
          background: theme.surface,
          border: `1.5px solid ${theme.accent2}40`,
        }}
      >
        <div className="flex items-center gap-2.5 mb-4">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-2xl flex-shrink-0"
            style={{ background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})` }}
          >
            <Bot size={20} className="text-white" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-black tracking-tight" style={{ color: theme.text }}>Generează din curs cu AI</p>
              <Sparkles size={12} style={{ color: theme.accent2 }} />
            </div>
            <p className="text-[11px] font-medium opacity-55" style={{ color: theme.text }}>
              Curs cu poze → carduri foto. Curs cu text → carduri AI. Detectare automată.
            </p>
          </div>
        </div>

        <div className="grid gap-2.5 sm:grid-cols-2">
          <div>
            <div className="text-[9px] font-black uppercase tracking-[0.18em] mb-1" style={{ color: theme.text3 }}>
              Carduri (cursuri cu poze: tot)
            </div>
            <div className="flex p-1 rounded-[14px]" style={{ background: theme.surface2 }}>
              {[10, 25, 50, 100].map((count) => (
                <button
                  key={count}
                  onClick={() => onAiCountChange(count)}
                  className="flex-1 py-2 rounded-lg text-[11px] font-black transition-all"
                  style={{
                    background: aiCount === count ? theme.accent : 'transparent',
                    color: aiCount === count ? '#fff' : theme.text3,
                  }}
                >
                  {count}
                </button>
              ))}
            </div>
          </div>
          <FolderTargetSelect
            folders={folders}
            value={targetFolderId}
            theme={theme}
            onChange={onTargetFolderChange}
            onCreateFolder={onCreateFolder}
          />
        </div>

        <motion.button
          whileHover={{ scale: aiLoading ? 1 : 1.01 }}
          whileTap={{ scale: aiLoading ? 1 : 0.99 }}
          onClick={onPdfImport}
          disabled={aiLoading}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-[16px] py-3.5 text-xs font-black uppercase tracking-widest text-white transition-all"
          style={{
            background: aiLoading ? theme.surface2 : `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})`,
            color: aiLoading ? theme.text3 : '#fff',
          }}
        >
          {aiLoading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              {aiProgress || 'Se procesează...'}
            </>
          ) : (
            <>
              <BookOpen size={16} />
              Selectează PDF curs
            </>
          )}
        </motion.button>

        {hasAI && librarySources.length > 0 && (
          <div className="mt-3 rounded-[16px] border p-3" style={{ borderColor: theme.border, background: theme.surface2 }}>
            <div className="mb-2 flex items-center gap-1.5">
              <Sparkles size={12} style={{ color: theme.accent }} />
              <span className="text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: theme.text3 }}>
                Sau din cursurile din Biblioteca AI
              </span>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <LibrarySourceSelect
                sources={librarySources}
                value={activeLibrarySourceId}
                disabled={libraryGenerating}
                theme={theme}
                onChange={setLibrarySourceId}
              />
              <button
                onClick={() => activeLibrarySourceId && onLibraryGenerate(activeLibrarySourceId)}
                disabled={libraryGenerating || !activeLibrarySourceId}
                className="flex items-center justify-center gap-2 rounded-[12px] px-4 py-2.5 text-[11px] font-black uppercase tracking-wider text-white transition-all disabled:opacity-60"
                style={{ background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})` }}
              >
                {libraryGenerating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                {libraryGenerating ? 'Generez...' : 'Generează carduri'}
              </button>
            </div>
            <p className="mt-2 text-[10px] font-medium opacity-55" style={{ color: theme.text }}>
              Folosește numărul de carduri și folderul alese mai sus. Cardurile acoperă definiții, mecanisme, semne și capcane.
            </p>
          </div>
        )}

        {!hasAI && (
          <p className="mt-2.5 text-center text-[11px] font-medium opacity-55" style={{ color: theme.text }}>
            Cursurile cu poze merg fără cheie AI. Pentru cursuri doar-text, adaugă o cheie în Setări AI.
          </p>
        )}

        <AnimatePresence>
          {aiError && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-3 flex items-start gap-2.5 rounded-2xl border p-3"
              style={{ background: `${theme.danger}08`, borderColor: `${theme.danger}20`, color: theme.danger }}
            >
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              <div className="text-[11px] font-bold leading-relaxed">{aiError}</div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12 }}
        className="mb-8 grid grid-cols-2 gap-2.5 sm:grid-cols-4"
      >
        {secondaryActions.map((action) => (
          <button
            key={action.key}
            onClick={action.onClick}
            disabled={action.busy}
            className="flex flex-col items-center gap-2 rounded-2xl px-3 py-4 text-center transition-all hover:-translate-y-0.5"
            style={{ background: theme.surface, border: `1px solid ${theme.border}` }}
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: `${action.color}15`, color: action.color }}>
              {action.busy ? <Loader2 size={17} className="animate-spin" /> : action.icon}
            </div>
            <span className="text-[11px] font-black tracking-tight" style={{ color: theme.text }}>{action.label}</span>
          </button>
        ))}
      </motion.div>

      <AnimatePresence>
        {(csvError || photoError) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-6 flex items-center gap-2 rounded-xl px-4 py-3 text-xs font-bold"
            style={{ background: `${theme.danger}15`, border: `1px solid ${theme.danger}30`, color: theme.danger }}
          >
            <AlertCircle size={14} />
            {csvError || photoError}
          </motion.div>
        )}
      </AnimatePresence>

      {totalDue > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.16 }}
          className="mb-8 flex flex-col gap-4 rounded-[24px] p-5 sm:flex-row sm:items-center sm:justify-between"
          style={{
            background: `linear-gradient(135deg, ${theme.warning}1E, ${theme.accent}10)`,
            border: `1px solid ${theme.warning}38`,
          }}
        >
          <div className="flex items-center gap-3.5">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-[18px] text-xl flex-shrink-0"
              style={{ background: `${theme.warning}22`, border: `1px solid ${theme.warning}38` }}
            >
              ⚡
            </div>
            <div>
              <p className="font-black text-base leading-tight" style={{ color: theme.text }}>
                {totalDue} {totalDue === 1 ? 'card restant' : 'carduri restante'}
              </p>
              <p className="text-[11px] font-bold uppercase tracking-wider opacity-55 mt-0.5" style={{ color: theme.text }}>
                ~{Math.ceil(totalDue * 0.5)} minute
              </p>
            </div>
          </div>
          <Link
            to="/flashcards/session/all"
            className="flex w-full items-center justify-center gap-2 rounded-2xl px-7 py-3 text-sm font-black text-white transition-all hover:scale-[1.02] sm:w-auto"
            style={{ background: `linear-gradient(135deg, ${theme.warning}, ${theme.accent})` }}
          >
            <Play size={15} fill="white" />
            Recapitulează tot
          </Link>
        </motion.div>
      )}
    </>
  );
}

interface FlashcardDeckGridProps {
  decks: FlashcardDeckSummary[];
  folders: Folder[];
  theme: Theme;
}

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
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)', padding: '2rem 1rem' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ scale: 0.95, y: 24 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        className="w-full max-w-xl rounded-[28px] p-6 shadow-2xl"
        style={{ background: theme.surface, border: `1px solid ${theme.border}` }}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-[15px] font-black" style={{ color: theme.text }}>Editează deck</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl transition-colors"
            style={{ color: theme.text3, background: theme.surface2 }}
          >
            <XIcon size={16} />
          </button>
        </div>

        <div className="mb-5">
          <div className="mb-1.5 text-[9px] font-black uppercase tracking-[0.18em]" style={{ color: theme.text3 }}>
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
          <div className="text-[9px] font-black uppercase tracking-[0.18em]" style={{ color: theme.text3 }}>
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
                <span className="text-[9px] font-black uppercase tracking-wider" style={{ color: theme.text3 }}>
                  {idx + 1}
                </span>
                <button
                  onClick={() => deleteCard(card.id)}
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
          style={{ borderColor: `${theme.accent}44`, color: theme.accent, borderStyle: 'dashed', background: `${theme.accent}08` }}
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
            className="flex-1 rounded-[16px] py-3 text-[11px] font-black uppercase tracking-wider text-white transition-all hover:scale-[1.02]"
            style={{ background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})` }}
          >
            Salvează
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function DeckRow({ deck, theme, index }: { deck: FlashcardDeckSummary; theme: Theme; index: number }) {
  const [editing, setEditing] = useState(false);

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.04 * index, ease: [0.16, 1, 0.3, 1] }}
        whileHover={{ y: -2 }}
        className="relative overflow-hidden rounded-2xl p-4"
        style={{ background: theme.surface, border: `1px solid ${theme.border}` }}
      >
        <div className="absolute inset-y-0 left-0 w-1" style={{ background: deck.accentColor }} />
        <div className="flex flex-col gap-4 sm:ml-1.5 sm:flex-row sm:items-center">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <div className="text-2xl">{deck.quiz.emoji}</div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="truncate text-sm font-black leading-tight" style={{ color: theme.text }}>{deck.quiz.title}</h3>
                </div>
                <p className="mt-0.5 text-[10px] font-black uppercase tracking-wider opacity-45" style={{ color: theme.text }}>
                  {deck.total} carduri
                  {deck.due > 0 && <span style={{ color: theme.warning }}> · {deck.due} restante</span>}
                  {deck.seen === 0 && ' · nou'}
                </p>
              </div>
            </div>
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full" style={{ background: theme.surface2 }}>
              <motion.div
                className="h-full rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${deck.masteryPct}%` }}
                transition={{ duration: 0.9, ease: 'easeOut' }}
                style={{ background: deck.accentColor }}
              />
            </div>
          </div>

          <MasteryRing pct={deck.masteryPct} color={deck.due > 0 ? theme.warning : deck.masteryPct >= 80 ? theme.success : theme.accent} />

          <div className="flex w-full gap-2 sm:w-auto sm:flex-col">
            <Link
              to={`/flashcards/session/${deck.quiz.id}`}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-[11px] font-black uppercase tracking-wider text-white transition-all hover:scale-[1.03] sm:flex-none"
              style={{ background: deck.accentColor, minWidth: 130 }}
            >
              <Play size={11} fill="white" />
              {deck.due > 0 ? 'Recapitulează' : 'Studiază'}
            </Link>
            <div className="flex gap-2">
              <Link
                to={`/flashcards/session/${deck.quiz.id}?mode=all`}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-[11px] font-black uppercase tracking-wider transition-all"
                style={{ background: theme.surface2, color: theme.text2, border: `1px solid ${theme.border2}` }}
              >
                <Circle size={9} />
                Vezi
              </Link>
              <button
                onClick={() => setEditing(true)}
                className="flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-[11px] font-black uppercase tracking-wider transition-all hover:scale-[1.03]"
                style={{ background: theme.surface2, color: theme.text3, border: `1px solid ${theme.border}` }}
                title="Editează cardurile"
              >
                <Pencil size={12} />
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      <AnimatePresence>
        {editing && (
          <EditDeckModal quiz={deck.quiz} theme={theme} onClose={() => setEditing(false)} />
        )}
      </AnimatePresence>
    </>
  );
}

export function FlashcardDeckGrid({ decks, folders, theme }: FlashcardDeckGridProps) {
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

    return Array.from(map.entries())
      .map(([id, group]) => ({ id, ...group }))
      .sort((a, b) => {
        if (a.id === '__uncategorized__') return 1;
        if (b.id === '__uncategorized__') return -1;
        return a.name.localeCompare(b.name);
      });
  }, [decks, folders]);

  if (decks.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2 }}
        className="rounded-3xl py-16 text-center"
        style={{ background: theme.surface, border: `1px solid ${theme.border}` }}
      >
        <div className="mb-3 text-5xl">🃏</div>
        <h3 className="mb-2 text-lg font-semibold" style={{ color: theme.text }}>Niciun deck încă</h3>
        <p className="mb-6 text-sm" style={{ color: theme.text3 }}>
          Încarcă un curs PDF sau creează un deck rapid pentru a începe.
        </p>
        <Link
          to="/create"
          className="inline-flex items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-semibold text-white"
          style={{ background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})` }}
        >
          <BookOpen size={15} />
          Creează o grilă
        </Link>
      </motion.div>
    );
  }

  const orderIndex = new Map<string, number>();
  let counter = 0;
  for (const group of groups) {
    for (const deck of group.decks) {
      orderIndex.set(deck.quiz.id, counter);
      counter += 1;
    }
  }

  return (
    <div className="flex flex-col gap-7">
      {groups.map((group) => (
        <div key={group.id}>
          <div className="mb-2.5 flex items-center gap-2 px-1">
            {group.id === '__uncategorized__'
              ? <Inbox size={14} style={{ color: theme.text3 }} />
              : <span className="text-sm">{group.emoji}</span>}
            <h2 className="text-[13px] font-black tracking-tight" style={{ color: group.id === '__uncategorized__' ? theme.text3 : theme.text }}>
              {group.name}
            </h2>
            <span className="text-[11px] font-bold opacity-45" style={{ color: theme.text }}>
              {group.decks.length} {group.decks.length === 1 ? 'deck' : 'deck-uri'}
            </span>
          </div>
          <div className="flex flex-col gap-2.5">
            {group.decks.map((deck) => (
              <DeckRow key={deck.quiz.id} deck={deck} theme={theme} index={orderIndex.get(deck.quiz.id) ?? 0} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
