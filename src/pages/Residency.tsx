import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { BookOpen, ChevronDown, ChevronRight, Download, FolderTree, Loader2, MessageCircle, Plus, Sparkles, Stethoscope } from 'lucide-react';
import { useTheme } from '../theme/ThemeContext';
import { useAIStore, type AIKnowledgeSource } from '../store/aiStore';
import { useUIStore } from '../store/uiStore';
import { useQuizStore } from '../store/quizStore';
import { useFolderStore } from '../store/folderStore';
import { useStatsStore } from '../store/statsStore';
import { useToastStore } from '../store/toastStore';
import { useAdaptiveMotion } from '../hooks/useAdaptiveMotion';
import { useSourceChapters } from '../hooks/useSourceChapters';
import { dispatchDiscussChapter, dispatchGenerateFromChapter } from '../lib/ai/chapterEvents';
import { importRezidentiatBank, isBankImported, isRezidentiatQuiz, REZIDENTIAT_BANKS, type RezidentiatBankInfo } from '../lib/rezidentiatBank';
import RezidentiatTutorial, { REZIDENTIAT_TUTORIAL_OPEN_EVENT } from '../components/RezidentiatTutorial';
import type { Quiz, QuestionStat } from '../types';

/** Reserved library-folder name that scopes this page — created on demand, no schema change. */
const RESIDENCY_FOLDER_NAME = 'Rezidențiat';
/** The QUIZ folder (useFolderStore) real banks import into — same display name, different store than the AI-library folder above; they coexist without conflict. */
const REZIDENTIAT_FOLDER_ROOT_NAME = 'Rezidențiat';

type Theme = ReturnType<typeof useTheme>;

/**
 * Accuracy across every quiz `generateQuizFromChapter` tagged with this exact
 * chapter (`['ai-studio','chapter-pack', sourceName, heading]`) — the same tag
 * convention every other weak-topic view in the app reads. Null when nothing
 * has been attempted yet, so the UI can show a neutral state instead of 0%.
 */
function useChapterProgress(sourceName: string, heading: string): { accuracy: number; attempted: number } | null {
  const quizzes = useQuizStore((state) => state.quizzes);
  const questionStats = useStatsStore((state) => state.questionStats);

  return useMemo(() => {
    const matchingQuizzes = quizzes.filter((quiz: Quiz) => {
      const tags = quiz.tags ?? [];
      return tags.includes('chapter-pack') && tags.includes(sourceName) && tags.includes(heading);
    });
    if (matchingQuizzes.length === 0) return null;

    let correct = 0;
    let attempted = 0;
    for (const quiz of matchingQuizzes) {
      for (const question of quiz.questions) {
        const stat: QuestionStat | undefined = questionStats[`${quiz.id}:${question.id}`];
        if (!stat) continue;
        correct += stat.timesCorrect;
        attempted += stat.timesCorrect + stat.timesWrong;
      }
    }
    if (attempted === 0) return null;
    return { accuracy: Math.round((correct / attempted) * 100), attempted };
  }, [quizzes, questionStats, sourceName, heading]);
}

function ChapterProgressBadge({ sourceName, heading, theme }: { sourceName: string; heading: string; theme: Theme }) {
  const progress = useChapterProgress(sourceName, heading);
  if (!progress) {
    return (
      <span className="rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider" style={{ background: theme.surface, color: theme.text3 }}>
        Neîncercat
      </span>
    );
  }
  const color = progress.accuracy >= 75 ? theme.success : progress.accuracy >= 45 ? theme.warning : theme.danger;
  return (
    <span
      className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider"
      style={{ background: `${color}18`, color }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {progress.accuracy}%
    </span>
  );
}

function BookChapters({ source, theme, calmMotion }: { source: AIKnowledgeSource; theme: Theme; calmMotion: boolean }) {
  const { chapters, loading } = useSourceChapters(source.id);
  const setChatOpen = useUIStore((state) => state.setChatOpen);

  const discuss = (heading: string, label: string) => {
    setChatOpen(true);
    dispatchDiscussChapter(source, heading, label, true);
  };
  const generate = (heading: string, label: string) => {
    setChatOpen(true);
    dispatchGenerateFromChapter(source, heading, label, true);
  };

  if (loading) {
    return (
      <div className="space-y-2.5 py-4">
        <div className="skeleton-block h-14 rounded-2xl" />
        <div className="skeleton-block h-14 rounded-2xl" />
      </div>
    );
  }

  if (chapters.length === 0) {
    return <p className="py-4 text-sm" style={{ color: theme.text3 }}>Nu am găsit încă fragmente indexate pentru această carte.</p>;
  }

  return (
    <div className="space-y-2.5 py-4">
      {chapters.map((chapter) => (
        <div
          key={chapter.heading}
          className="glass-panel flex flex-wrap items-center justify-between gap-4 rounded-2xl px-5 py-4"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <div className="truncate text-sm font-bold" style={{ color: theme.text }}>{chapter.label}</div>
              <ChapterProgressBadge sourceName={source.name} heading={chapter.heading} theme={theme} />
            </div>
            <div className="mt-1 text-[11px] font-medium" style={{ color: theme.text3 }}>{chapter.chunkCount} fragmente</div>
          </div>
          <div className="flex flex-shrink-0 items-center gap-2.5">
            <motion.button
              whileTap={calmMotion ? undefined : { scale: 0.97 }}
              onClick={() => discuss(chapter.heading, chapter.label)}
              className="flex items-center gap-1.5 rounded-xl px-3.5 py-2.5 text-[10.5px] font-black uppercase tracking-[0.08em]"
              style={{ background: theme.surface, border: `1px solid ${theme.border}`, color: theme.text2 }}
            >
              <MessageCircle size={13} /> Discută
            </motion.button>
            <motion.button
              whileTap={calmMotion ? undefined : { scale: 0.97 }}
              onClick={() => generate(chapter.heading, chapter.label)}
              className="flex items-center gap-1.5 rounded-xl px-3.5 py-2.5 text-[10.5px] font-black uppercase tracking-[0.08em]"
              style={{ background: `${theme.accent}15`, border: `1px solid ${theme.accent}25`, color: theme.accent }}
            >
              <Sparkles size={13} /> Generează grile
            </motion.button>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Real, verified rezidențiat grile — extracted from the user's own reference
 * books (text + answer cross-referenced), not AI-generated — one-time import
 * per bank into a "Rezidențiat" quiz folder. Separate from the book/chapter
 * AI system below — this is ready-to-play static content. One card per
 * `REZIDENTIAT_BANKS` entry so adding a future bank needs no new component.
 */
/**
 * Playful glass popover, auto-shown whenever at least one real bank hasn't
 * been imported yet — replaces the old flat per-bank cards. Naturally stops
 * appearing once everything's imported (no dismiss-flag bookkeeping needed:
 * "imported" IS the dismissed state), and a future bank added to
 * `REZIDENTIAT_BANKS` shows up here automatically.
 */
function RealBankAnnounceBubble({ theme, calmMotion }: { theme: Theme; calmMotion: boolean }) {
  const addToast = useToastStore((state) => state.addToast);
  const quizzes = useQuizStore((state) => state.quizzes);
  const pending = useMemo(
    () => REZIDENTIAT_BANKS.filter((b) => !isBankImported(b)),
    // Re-checked whenever the quiz list changes (e.g. right after import).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [quizzes],
  );
  const [importingId, setImportingId] = useState<string | null>(null);
  const [importingAll, setImportingAll] = useState(false);

  const runImport = async (bank: RezidentiatBankInfo) => {
    const result = await importRezidentiatBank(bank);
    return result;
  };

  const handleImportOne = async (bank: RezidentiatBankInfo) => {
    if (importingId || importingAll) return;
    setImportingId(bank.id);
    try {
      const result = await runImport(bank);
      addToast(`${bank.label}: ${result.quizzes} seturi, ${result.questions} grile importate.`, 'success', 5000);
    } catch (error) {
      addToast(`Import eșuat: ${error instanceof Error ? error.message : 'eroare necunoscută'}`, 'error', 5000);
    } finally {
      setImportingId(null);
    }
  };

  const handleImportAll = async () => {
    if (importingId || importingAll) return;
    setImportingAll(true);
    try {
      let quizzesCount = 0;
      let questionsCount = 0;
      for (const bank of pending) {
        const result = await runImport(bank);
        quizzesCount += result.quizzes;
        questionsCount += result.questions;
      }
      addToast(`Gata! ${quizzesCount} seturi, ${questionsCount} grile reale, calibrate pe foldere automat.`, 'success', 6000);
    } catch (error) {
      addToast(`Import eșuat: ${error instanceof Error ? error.message : 'eroare necunoscută'}`, 'error', 5000);
    } finally {
      setImportingAll(false);
    }
  };

  if (pending.length === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -16, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 26 }}
        className="glass-panel premium-shadow relative mb-6 overflow-hidden rounded-[28px] p-6"
      >
        <div
          className="pointer-events-none absolute -top-16 right-0 h-40 w-40 rounded-full opacity-30 blur-[60px]"
          style={{ background: theme.accent }}
        />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <motion.div
              animate={calmMotion ? undefined : { scale: [1, 1.08, 1], rotate: [0, -6, 6, 0] }}
              transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
              className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl text-white"
              style={{ background: theme.accent, boxShadow: `0 10px 24px ${theme.accent}44` }}
            >
              <Sparkles size={19} />
            </motion.div>
            <div>
              <div className="mb-1 text-sm font-black" style={{ color: theme.text }}>
                {pending.length === 1 ? 'Ai un set nou de descărcat! ✨' : `Ai ${pending.length} seturi noi de descărcat! ✨`}
              </div>
              <p className="max-w-md text-xs font-medium" style={{ color: theme.text3 }}>
                Grile reale, verificate — se calibrează singure pe foldere, pe disciplină și specialitate. Nimic de configurat.
              </p>
            </div>
          </div>
          {pending.length > 1 && (
            <motion.button
              whileTap={calmMotion ? undefined : { scale: 0.97 }}
              onClick={handleImportAll}
              disabled={importingAll || !!importingId}
              className="flex flex-shrink-0 items-center gap-2 rounded-2xl px-5 py-3 text-[11px] font-black uppercase tracking-[0.14em] text-white"
              style={{ background: theme.accent, opacity: importingAll ? 0.7 : 1 }}
            >
              {importingAll ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
              {importingAll ? 'Import...' : 'Descarcă tot'}
            </motion.button>
          )}
        </div>

        <div className="relative mt-4 space-y-2.5">
          {pending.map((bank) => (
            <div
              key={bank.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3"
              style={{ background: theme.surface2 }}
            >
              <div className="min-w-0">
                <div className="text-[13px] font-bold" style={{ color: theme.text }}>{bank.label}</div>
                <div className="text-[11px]" style={{ color: theme.text3 }}>{bank.description} — {bank.sourceLabel}</div>
              </div>
              <motion.button
                whileTap={calmMotion ? undefined : { scale: 0.97 }}
                onClick={() => handleImportOne(bank)}
                disabled={importingAll || !!importingId}
                className="flex flex-shrink-0 items-center gap-1.5 rounded-xl px-4 py-2 text-[10.5px] font-black uppercase tracking-wider"
                style={{ background: `${theme.accent}18`, color: theme.accent, opacity: importingId === bank.id ? 0.7 : 1 }}
              >
                {importingId === bank.id ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                {importingId === bank.id ? 'Import...' : 'Descarcă'}
              </motion.button>
            </div>
          ))}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

/**
 * Real nested folders now back the imported banks (Rezidențiat → discipline →
 * specialty), so browsing is the app's own FolderView drill-down — no custom
 * grid needed. This is just the doorway into that tree from this page.
 */
function RealBankFolderLink({ theme, calmMotion }: { theme: Theme; calmMotion: boolean }) {
  const quizzes = useQuizStore((state) => state.quizzes);
  const folders = useFolderStore((state) => state.folders);
  const rootFolder = useMemo(
    () => folders.find((f) => f.parentId === null && f.name.trim().toLowerCase() === REZIDENTIAT_FOLDER_ROOT_NAME.toLowerCase()),
    [folders],
  );
  const hasContent = useMemo(() => quizzes.some((q) => !q.archived && isRezidentiatQuiz(q)), [quizzes]);

  if (!hasContent || !rootFolder) return null;

  return (
    <Link to={`/folder/${rootFolder.id}`}>
      <motion.div
        whileHover={calmMotion ? undefined : { scale: 1.01, y: -1 }}
        whileTap={calmMotion ? undefined : { scale: 0.99 }}
        className="glass-panel premium-shadow mb-8 flex items-center justify-between gap-4 rounded-[24px] p-5"
      >
        <div className="flex items-center gap-3.5">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl" style={{ background: `${theme.accent}18`, color: theme.accent }}>
            <FolderTree size={20} />
          </div>
          <div>
            <div className="text-sm font-black" style={{ color: theme.text }}>Vezi grilele pe discipline și specialități</div>
            <div className="text-[11px] font-medium" style={{ color: theme.text3 }}>Medicină internă / Chirurgie → specialitate → boală</div>
          </div>
        </div>
        <ChevronRight size={18} style={{ color: theme.text3 }} />
      </motion.div>
    </Link>
  );
}

export default function Residency() {
  const theme = useTheme();
  const { calmMotion } = useAdaptiveMotion();
  const knowledgeSources = useAIStore((state) => state.knowledgeSources);
  const libraryFolders = useAIStore((state) => state.libraryFolders);
  const addLibraryFolder = useAIStore((state) => state.addLibraryFolder);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const residencyFolder = useMemo(
    () => libraryFolders.find((folder) => folder.name.trim().toLowerCase() === RESIDENCY_FOLDER_NAME.toLowerCase()) ?? null,
    [libraryFolders],
  );

  const books = useMemo(
    () => (residencyFolder ? knowledgeSources.filter((source) => source.folderId === residencyFolder.id) : []),
    [knowledgeSources, residencyFolder],
  );

  const addBookHref = residencyFolder ? `/vault?folder=${residencyFolder.id}` : '/vault';

  return (
    <div className="h-full overflow-y-auto px-4 py-6 sm:px-8 sm:py-10">
      <RezidentiatTutorial />
      <div className="mx-auto max-w-5xl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <div className="mb-2 flex items-center gap-3">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-2xl shadow-lg"
                  style={{ background: theme.accent, color: '#fff' }}
                >
                  <Stethoscope size={20} />
                </div>
                <h1 className="page-title-compact" style={{ color: theme.text }}>Rezidențiat</h1>
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent(REZIDENTIAT_TUTORIAL_OPEN_EVENT))}
                  aria-label="Vezi tutorialul secțiunii Rezidențiat"
                  title="Tur rapid"
                  className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-black"
                  style={{ background: theme.surface2, color: theme.text3, border: `1px solid ${theme.border}` }}
                >
                  ?
                </button>
              </div>
              <p className="max-w-md text-sm font-medium opacity-60" style={{ color: theme.text }}>
                Cărțile tale de rezidențiat, pe capitole — discută cu AI-ul despre orice capitol sau generează grile direct din el.
              </p>
            </div>
            {residencyFolder && (
              <Link
                to={addBookHref}
                className="flex items-center gap-2 rounded-2xl px-5 py-3 text-[11px] font-black uppercase tracking-[0.14em] text-white"
                style={{ background: theme.accent }}
              >
                <Plus size={15} /> Adaugă carte
              </Link>
            )}
          </div>
        </motion.div>

        <RealBankAnnounceBubble theme={theme} calmMotion={calmMotion} />
        <RealBankFolderLink theme={theme} calmMotion={calmMotion} />

        {!residencyFolder ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-panel premium-shadow rounded-[28px] p-10 text-center"
          >
            <Stethoscope size={32} style={{ color: theme.accent, margin: '0 auto 12px' }} />
            <h2 className="mb-2 text-lg font-black" style={{ color: theme.text }}>Nicio secțiune încă</h2>
            <p className="mx-auto mb-5 max-w-sm text-sm" style={{ color: theme.text3 }}>
              Creează secțiunea Rezidențiat, apoi încarcă acolo cărțile de referință — vor apărea aici, organizate pe capitole.
            </p>
            <motion.button
              whileTap={calmMotion ? undefined : { scale: 0.97 }}
              onClick={() => addLibraryFolder(RESIDENCY_FOLDER_NAME, '🩺')}
              className="rounded-2xl px-6 py-3 text-[11px] font-black uppercase tracking-[0.14em] text-white"
              style={{ background: theme.accent }}
            >
              Creează secțiunea Rezidențiat
            </motion.button>
          </motion.div>
        ) : books.length === 0 ? (
          <div className="glass-panel premium-shadow rounded-[28px] p-10 text-center">
            <p className="mb-5 text-sm" style={{ color: theme.text3 }}>Secțiunea e goală — adaugă prima carte.</p>
            <Link
              to={addBookHref}
              className="inline-flex items-center gap-2 rounded-2xl px-6 py-3 text-[11px] font-black uppercase tracking-[0.14em] text-white"
              style={{ background: theme.accent }}
            >
              <Plus size={15} /> Adaugă carte
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {books.map((source) => {
              const expanded = expandedId === source.id;
              const statusLabel = source.indexStatus === 'ready'
                ? `${source.chunkCount} fragmente indexate`
                : source.indexStatus === 'indexing'
                  ? `Indexare în curs... ${Math.round(source.indexProgress ?? 0)}%`
                  : 'Eroare la indexare';
              return (
                <motion.div
                  key={source.id}
                  layout
                  className="glass-panel premium-shadow overflow-hidden rounded-[26px] transition-shadow"
                  style={{
                    borderColor: expanded ? `${theme.accent}35` : undefined,
                    boxShadow: expanded ? `0 8px 28px -12px ${theme.accent}30` : undefined,
                  }}
                >
                  <button
                    onClick={() => setExpandedId(expanded ? null : source.id)}
                    className="flex w-full items-center justify-between gap-3 px-6 py-5 text-left"
                  >
                    <div className="flex min-w-0 items-center gap-3.5">
                      <div
                        className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl"
                        style={{ background: theme.surface2, color: theme.accent }}
                      >
                        <BookOpen size={19} />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-black" style={{ color: theme.text }}>{source.name}</div>
                        <div className="mt-0.5 text-[11px] font-medium" style={{ color: theme.text3 }}>{statusLabel}</div>
                      </div>
                    </div>
                    <motion.div animate={{ rotate: expanded ? 180 : 0 }} style={{ color: theme.text3 }}>
                      <ChevronDown size={18} />
                    </motion.div>
                  </button>
                  <AnimatePresence initial={false}>
                    {expanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: calmMotion ? 0.15 : 0.25 }}
                        className="overflow-hidden border-t px-6"
                        style={{ borderColor: theme.border }}
                      >
                        {source.indexStatus === 'ready' ? (
                          <BookChapters source={source} theme={theme} calmMotion={calmMotion} />
                        ) : source.indexStatus === 'indexing' ? (
                          <div className="space-y-2.5 py-4">
                            <p className="text-sm" style={{ color: theme.text3 }}>
                              Cartea se indexează încă — capitolele apar automat când se termină ({Math.round(source.indexProgress ?? 0)}%).
                            </p>
                            <div className="skeleton-block h-14 rounded-2xl" />
                          </div>
                        ) : (
                          <div className="py-4">
                            <p className="text-sm font-semibold" style={{ color: theme.danger }}>
                              Indexarea a eșuat{source.indexError ? `: ${source.indexError}` : '.'}
                            </p>
                            <p className="mt-1 text-sm" style={{ color: theme.text3 }}>
                              Șterge cartea din <Link to={addBookHref} className="underline">Bibliotecă</Link> și încarc-o din nou.
                            </p>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
