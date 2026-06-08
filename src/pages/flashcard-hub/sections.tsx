import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
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
  FileText,
  ImagePlus,
  Loader2,
  Play,
  Plus,
  Sparkles,
  Upload,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Folder, Quiz } from '../../types';
import type { Theme } from '../../theme/themes';

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
  const radius = 20;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pct / 100);

  return (
    <div className="relative w-12 h-12 flex-shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 48 48">
        <circle cx="24" cy="24" r={radius} fill="none" stroke={`${color}28`} strokeWidth="3.5" />
        <motion.circle
          cx="24"
          cy="24"
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
}: {
  folders: Folder[];
  value: string;
  theme: Theme;
  onChange: (folderId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selectedFolder = folders.find((folder) => folder.id === value);
  const selectedLabel = selectedFolder ? `${selectedFolder.emoji} ${selectedFolder.name}` : 'Neclasificate';
  const options = [
    { id: '__uncategorized__', label: 'Neclasificate', helper: 'Fara folder dedicat' },
    ...folders.map((folder) => ({
      id: folder.id,
      label: `${folder.emoji} ${folderPath(folders, folder)}`,
      helper: 'Salveaza aici',
    })),
  ];

  useEffect(() => {
    if (!open) return undefined;
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center gap-3 rounded-[16px] border px-3.5 py-3 text-left transition-all"
        style={{
          background: theme.surface2,
          borderColor: open ? `${theme.accent}55` : theme.border,
          color: theme.text,
          boxShadow: open ? `0 0 0 1px ${theme.accent}18, 0 12px 24px rgba(0,0,0,0.12)` : 'none',
        }}
      >
        <div className="min-w-0 flex-1">
          <div className="text-[9px] font-black uppercase tracking-[0.18em]" style={{ color: theme.text3 }}>
            Folder tinta
          </div>
          <div className="mt-0.5 truncate text-xs font-black">
            {selectedLabel}
          </div>
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
            className="absolute left-0 right-0 top-[calc(100%+0.45rem)] z-40 rounded-[20px] border p-1.5 shadow-2xl"
            style={{
              background: theme.isDark ? 'rgba(20,24,30,0.98)' : 'rgba(255,255,255,0.98)',
              borderColor: theme.border,
              backdropFilter: 'blur(18px) saturate(160%)',
            }}
          >
            <div className="custom-scrollbar max-h-56 overflow-y-auto">
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
                    className="flex w-full items-center gap-3 rounded-[16px] px-3 py-2.5 text-left transition-all"
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface FlashcardHubActionsProps {
  aiCount: number;
  aiError: string;
  aiLoading: boolean;
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
  onAiCountChange: (count: number) => void;
  onCsvImport: () => void;
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
  onAiCountChange,
  onCsvImport,
  onMistakeDeckCreate,
  onPhotoImport,
  onPdfImport,
  onQuickDeckCreate,
  onTargetFolderChange,
}: FlashcardHubActionsProps) {
  const stats = [
    { label: 'Total carduri', value: totalCards, icon: <CreditCard size={18} />, color: theme.accent },
    { label: 'De recapitulat', value: totalDue, icon: <Clock size={18} />, color: totalDue > 0 ? theme.warning : theme.success },
    { label: 'Stăpânite', value: totalMastered, icon: <CheckCircle size={18} />, color: theme.success },
  ];

  return (
    <>
      <motion.div
        data-tutorial="flashcard-hub"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        className="grid grid-cols-1 gap-3 mb-8 sm:grid-cols-3 sm:gap-4"
      >
        {stats.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 + index * 0.05 }}
            whileHover={{ y: -2, boxShadow: `0 8px 24px ${stat.color}15` }}
            className="rounded-2xl p-4 relative overflow-hidden"
            style={{ background: theme.surface, border: `1px solid ${theme.border}` }}
          >
            <div
              className="absolute top-0 left-0 w-20 h-20 rounded-full pointer-events-none"
              style={{ background: `radial-gradient(circle at top left, ${stat.color}15, transparent 70%)` }}
            />
            <div className="flex items-center gap-3 mb-2 relative">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${stat.color}15`, color: stat.color }}>
                {stat.icon}
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider opacity-60" style={{ color: theme.text }}>
                {stat.label}
              </span>
            </div>
            <div className="text-2xl font-black tracking-tighter relative" style={{ color: theme.text }}>{stat.value}</div>
          </motion.div>
        ))}
      </motion.div>

      {hasAI && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="mb-8 p-5 rounded-[28px] relative overflow-hidden"
          style={{
            background: `linear-gradient(135deg, ${theme.accent2}15, ${theme.accent}08)`,
            border: `1px solid ${theme.accent2}30`,
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
          }}
        >
          <div className="absolute top-0 right-0 w-40 h-40 rounded-full blur-[60px] pointer-events-none" style={{ background: `${theme.accent2}25` }} />

          <div className="relative flex flex-col md:flex-row md:items-center gap-6">
            <div
              className="w-16 h-16 rounded-3xl flex items-center justify-center flex-shrink-0 shadow-2xl transition-transform hover:rotate-6"
              style={{ background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})`, boxShadow: `0 12px 24px ${theme.accent}40` }}
            >
              <Bot size={32} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70" style={{ color: theme.accent2 }}>
                  AI Flashcard Generator
                </span>
                <div className="w-1 h-1 rounded-full opacity-30" style={{ background: theme.accent2 }} />
                <Sparkles size={12} className="animate-pulse" style={{ color: theme.accent2 }} />
              </div>
              <p className="text-xl font-black tracking-tight leading-tight" style={{ color: theme.text }}>
                Transformă cursul în carduri instant
              </p>
              <p className="text-sm font-medium opacity-50 mt-1.5 leading-relaxed" style={{ color: theme.text }}>
                Încarcă un PDF și AI-ul va extrage inteligent conceptele cheie pentru tine.
              </p>
            </div>

            <div className="flex flex-col gap-3.5 flex-shrink-0 min-w-[200px]">
              <div className="flex p-1 rounded-[14px] glass-panel border border-white/5" style={{ background: theme.surface2 }}>
                {[10, 25, 50, 100].map((count) => (
                  <button
                    key={count}
                    onClick={() => onAiCountChange(count)}
                    className="flex-1 py-2 rounded-lg text-[10px] font-black transition-all relative overflow-hidden"
                    style={{
                      background: aiCount === count ? theme.accent : 'transparent',
                      color: aiCount === count ? '#fff' : theme.text3,
                    }}
                  >
                    {aiCount === count && (
                      <motion.div layoutId="active-ai-n" className="absolute inset-0 z-0" style={{ background: theme.accent }} />
                    )}
                    <span className="relative z-10">{count}</span>
                  </button>
                ))}
              </div>
              <FolderTargetSelect
                folders={folders}
                value={targetFolderId}
                theme={theme}
                onChange={onTargetFolderChange}
              />
              <motion.button
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={onPdfImport}
                disabled={aiLoading}
                className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-[18px] font-black text-xs uppercase tracking-widest text-white shadow-2xl transition-all"
                style={{
                  background: aiLoading ? theme.surface2 : `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})`,
                  boxShadow: aiLoading ? 'none' : `0 12px 30px ${theme.accent}40`,
                }}
              >
                {aiLoading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Se analizează...
                  </>
                ) : (
                  <>
                    <FileText size={16} />
                    Selectează PDF
                  </>
                )}
              </motion.button>
            </div>
          </div>

          <AnimatePresence>
            {aiError && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-5 flex items-start gap-3 p-4 rounded-2xl border backdrop-blur-sm"
                style={{ background: `${theme.danger}08`, borderColor: `${theme.danger}20`, color: theme.danger }}
              >
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <div className="text-[11px] font-bold leading-relaxed">{aiError}</div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.23 }}
        className="mb-5 grid gap-3 rounded-3xl p-4 sm:grid-cols-[minmax(0,1fr)_240px]"
        style={{ background: theme.surface, border: `1px solid ${theme.border}` }}
      >
        <div>
          <p className="text-sm font-black uppercase tracking-wider" style={{ color: theme.text }}>Destinație pentru importuri</p>
          <p className="text-xs font-medium opacity-60 mt-1" style={{ color: theme.text }}>
            PDF-urile, pozele și CSV-urile se salvează direct în folderul ales.
          </p>
        </div>
        <FolderTargetSelect
          folders={folders}
          value={targetFolderId}
          theme={theme}
          onChange={onTargetFolderChange}
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="mb-5 rounded-3xl p-5 group transition-all hover:translate-y-[-2px]"
        style={{ background: theme.surface, border: `1px solid ${theme.border}`, boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110" style={{ background: `${theme.accent}15`, color: theme.accent }}>
            <Plus size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black uppercase tracking-wider" style={{ color: theme.text }}>Deck rapid</p>
            <p className="text-xs font-medium opacity-60 mt-1" style={{ color: theme.text }}>
              Creeaza instant un set scurt de carduri pentru verificarea fluxului de studiu.
            </p>
          </div>
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
            onClick={onQuickDeckCreate}
            className="flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3 text-xs font-black uppercase tracking-[0.14em] text-white sm:w-auto"
            style={{ background: `linear-gradient(135deg, ${theme.accent}, ${theme.success})`, boxShadow: `0 10px 24px ${theme.accent}24` }}
          >
            <Plus size={14} />
            Creeaza
          </motion.button>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.27 }}
        className="mb-8 rounded-3xl p-5 group transition-all hover:translate-y-[-2px]"
        style={{ background: theme.surface, border: `1px solid ${theme.border}`, boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110" style={{ background: `${theme.accent2}15`, color: theme.accent2 }}>
            <Upload size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black uppercase tracking-wider" style={{ color: theme.text }}>Import Anki / CSV</p>
            <p className="text-xs font-medium opacity-60 mt-1" style={{ color: theme.text }}>
              Încarcă seturile tale existente din alte aplicații.
            </p>
          </div>
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={onCsvImport}
            disabled={csvImporting}
            className="flex w-full items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold transition-all sm:w-auto"
            style={{
              background: csvImporting ? theme.surface2 : `${theme.accent2}15`,
              color: csvImporting ? theme.text3 : theme.accent2,
              border: `1px solid ${theme.accent2}30`,
            }}
          >
            {csvImporting ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Importare...
              </>
            ) : (
              <>
                <Upload size={14} />
                Alege fișier
              </>
            )}
          </motion.button>
        </div>
        <AnimatePresence>
          {csvError && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mt-4 flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-bold"
              style={{ background: `${theme.danger}15`, border: `1px solid ${theme.danger}30`, color: theme.danger }}
            >
              <AlertCircle size={14} />
              {csvError}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.27 }}
        className="mb-8 rounded-3xl p-5 group transition-all hover:translate-y-[-2px]"
        style={{ background: theme.surface, border: `1px solid ${theme.border}`, boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110" style={{ background: `${theme.success}15`, color: theme.success }}>
            <ImagePlus size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black uppercase tracking-wider" style={{ color: theme.text }}>Import poze / PDF foto</p>
            <p className="text-xs font-medium opacity-60 mt-1" style={{ color: theme.text }}>
              Creeaza carduri vizuale din imagini sau din paginile unui PDF.
            </p>
          </div>
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={onPhotoImport}
            disabled={photoImporting}
            className="flex w-full items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold transition-all sm:w-auto"
            style={{
              background: photoImporting ? theme.surface2 : `${theme.success}15`,
              color: photoImporting ? theme.text3 : theme.success,
              border: `1px solid ${theme.success}30`,
            }}
          >
            {photoImporting ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Procesez...
              </>
            ) : (
              <>
                <ImagePlus size={14} />
                Alege poze
              </>
            )}
          </motion.button>
        </div>
        <AnimatePresence>
          {photoError && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mt-4 flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-bold"
              style={{ background: `${theme.danger}15`, border: `1px solid ${theme.danger}30`, color: theme.danger }}
            >
              <AlertCircle size={14} />
              {photoError}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.28 }}
        className="mb-8 rounded-3xl p-5 group transition-all hover:translate-y-[-2px]"
        style={{ background: theme.surface, border: `1px solid ${theme.border}`, boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110" style={{ background: `${theme.warning}15`, color: theme.warning }}>
            <Brain size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black uppercase tracking-wider" style={{ color: theme.text }}>Smart Flashcards din greșeli</p>
            <p className="text-xs font-medium opacity-60 mt-1" style={{ color: theme.text }}>
              Transformă greșelile tale recente în carduri scurte, clare și foarte utile pentru fixare.
            </p>
          </div>
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
            onClick={onMistakeDeckCreate}
            className="flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3 text-xs font-black uppercase tracking-[0.14em] text-white sm:w-auto"
            style={{ background: `linear-gradient(135deg, ${theme.warning}, ${theme.accent})`, boxShadow: `0 10px 24px ${theme.warning}30` }}
          >
            <Sparkles size={14} />
            Generează
          </motion.button>
        </div>
      </motion.div>

      {totalDue > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
          className="mb-10 p-5 rounded-[28px] flex flex-col sm:flex-row sm:items-center justify-between gap-5"
          style={{
            background: `linear-gradient(135deg, ${theme.warning}22, ${theme.accent}12)`,
            border: `1px solid ${theme.warning}40`,
            boxShadow: `0 12px 32px ${theme.warning}12`,
          }}
        >
          <div className="flex items-center gap-4">
            <motion.div
              animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }}
              transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
              className="w-14 h-14 rounded-[20px] flex items-center justify-center text-2xl flex-shrink-0"
              style={{ background: `${theme.warning}25`, border: `1px solid ${theme.warning}40` }}
            >
              ⚡
            </motion.div>
            <div>
              <p className="font-black text-lg leading-tight" style={{ color: theme.text }}>
                {totalDue} {totalDue === 1 ? 'card' : 'carduri'} restante
              </p>
              <p className="text-xs font-bold uppercase tracking-wider opacity-60 mt-1" style={{ color: theme.text }}>
                Timp estimat: ~{Math.ceil(totalDue * 0.5)} minute
              </p>
            </div>
          </div>
          <Link
            to="/flashcards/session/all"
            className="flex w-full items-center justify-center gap-2 rounded-2xl px-8 py-3.5 text-sm font-black text-white shadow-xl transition-all hover:scale-[1.03] active:scale-[0.98] sm:w-auto"
            style={{ background: `linear-gradient(135deg, ${theme.warning}, ${theme.accent})`, boxShadow: `0 8px 20px ${theme.warning}40` }}
          >
            <Play size={16} fill="white" className="animate-pulse" />
            Recapitulează tot
          </Link>
        </motion.div>
      )}
    </>
  );
}

interface FlashcardDeckGridProps {
  decks: FlashcardDeckSummary[];
  theme: Theme;
}

export function FlashcardDeckGrid({ decks, theme }: FlashcardDeckGridProps) {
  if (decks.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2 }}
        className="text-center py-20 rounded-3xl"
        style={{ background: theme.surface, border: `1px solid ${theme.border}` }}
      >
        <div className="text-5xl mb-4">🃏</div>
        <h3 className="text-lg font-semibold mb-2" style={{ color: theme.text }}>Nicio grilă încă</h3>
        <p className="text-sm mb-6" style={{ color: theme.text3 }}>
          Creează sau importă o grilă pentru a începe studiul cu flashcarduri.
        </p>
        <Link
          to="/create"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-semibold text-white"
          style={{ background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})` }}
        >
          <BookOpen size={15} />
          Creează o grilă
        </Link>
      </motion.div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold" style={{ color: theme.text }}>Deck-urile tale</h2>
        <span className="text-sm" style={{ color: theme.text3 }}>{decks.length} {decks.length === 1 ? 'deck' : 'deck-uri'}</span>
      </div>
      <div className="grid grid-cols-1 gap-3">
        {decks.map((deck, index) => (
          <motion.div
            key={deck.quiz.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + index * 0.05, ease: [0.16, 1, 0.3, 1] }}
            whileHover={{ y: -2, transition: { duration: 0.2 } }}
            className="rounded-3xl p-5 relative overflow-hidden"
            style={{
              background: theme.surface,
              border: `1px solid ${theme.border}`,
              boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
            }}
          >
            <div className="absolute inset-y-0 left-0 w-1.5" style={{ background: deck.accentColor }} />

            <div className="flex flex-col gap-5 sm:ml-2 sm:flex-row sm:items-center">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3.5 mb-2">
                  <div className="text-3xl filter drop-shadow-sm">{deck.quiz.emoji}</div>
                  <div className="min-w-0">
                    <h3 className="font-black text-base leading-tight truncate" style={{ color: theme.text }}>
                      {deck.quiz.title}
                    </h3>
                    <p className="text-[10px] font-black uppercase tracking-wider opacity-50 mt-0.5" style={{ color: theme.text }}>
                      {deck.quiz.category} · {deck.total} carduri
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-3 mt-3 sm:flex-row sm:items-center">
                  <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: theme.surface2 }}>
                    <motion.div
                      className="h-full rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${deck.masteryPct}%` }}
                      transition={{ duration: 1, ease: 'easeOut', delay: 0.3 + index * 0.05 }}
                      style={{ background: deck.accentColor }}
                    />
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {deck.due > 0 && (
                      <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg" style={{ background: `${theme.warning}20`, color: theme.warning }}>
                        {deck.due} restante
                      </span>
                    )}
                    {deck.seen === 0 && (
                      <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg" style={{ background: theme.surface2, color: theme.text3 }}>
                        Nou
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <MasteryRing pct={deck.masteryPct} color={deck.due > 0 ? theme.warning : deck.masteryPct >= 80 ? theme.success : theme.accent} />

              <div className="flex w-full flex-col gap-2 sm:w-auto">
                <Link
                  to={`/flashcards/session/${deck.quiz.id}`}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-2.5 text-xs font-black uppercase tracking-wider text-white shadow-lg transition-all hover:scale-[1.05] active:scale-[0.95] sm:w-auto"
                  style={{ background: deck.accentColor, boxShadow: `0 8px 20px ${deck.accentColor}40`, minWidth: 140 }}
                >
                  <Play size={12} fill="white" />
                  {deck.due > 0 ? 'Recapitulează' : 'Studiază'}
                </Link>
                <Link
                  to={`/flashcards/session/${deck.quiz.id}?mode=all`}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-2.5 text-xs font-black uppercase tracking-wider transition-all hover:bg-white/10 active:scale-[0.98] sm:w-auto"
                  style={{ background: theme.surface2, color: theme.text2, border: `1px solid ${theme.border2}` }}
                >
                  <Circle size={10} />
                  Previzualizare
                </Link>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
