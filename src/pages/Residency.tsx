import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { BookOpen, ChevronDown, MessageCircle, Plus, Sparkles, Stethoscope } from 'lucide-react';
import { useTheme } from '../theme/ThemeContext';
import { useAIStore, type AIKnowledgeSource } from '../store/aiStore';
import { useUIStore } from '../store/uiStore';
import { useQuizStore } from '../store/quizStore';
import { useStatsStore } from '../store/statsStore';
import { useAdaptiveMotion } from '../hooks/useAdaptiveMotion';
import { useSourceChapters } from '../hooks/useSourceChapters';
import { dispatchDiscussChapter, dispatchGenerateFromChapter } from '../lib/ai/chapterEvents';
import type { Quiz, QuestionStat } from '../types';

/** Reserved library-folder name that scopes this page — created on demand, no schema change. */
const RESIDENCY_FOLDER_NAME = 'Rezidențiat';

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
    dispatchDiscussChapter(source, heading, label);
  };
  const generate = (heading: string, label: string) => {
    setChatOpen(true);
    dispatchGenerateFromChapter(source, heading, label);
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
          className="flex flex-wrap items-center justify-between gap-4 rounded-2xl px-5 py-4"
          style={{ background: theme.surface2, border: `1px solid ${theme.border}` }}
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
      <div className="mx-auto max-w-5xl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <div className="mb-2 flex items-center gap-3">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-2xl shadow-lg"
                  style={{ background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})`, color: '#fff' }}
                >
                  <Stethoscope size={20} />
                </div>
                <h1 className="page-title-compact" style={{ color: theme.text }}>Rezidențiat</h1>
              </div>
              <p className="max-w-md text-sm font-medium opacity-60" style={{ color: theme.text }}>
                Cărțile tale de rezidențiat, pe capitole — discută cu AI-ul despre orice capitol sau generează grile direct din el.
              </p>
            </div>
            {residencyFolder && (
              <Link
                to={addBookHref}
                className="flex items-center gap-2 rounded-2xl px-5 py-3 text-[11px] font-black uppercase tracking-[0.14em] text-white"
                style={{ background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})` }}
              >
                <Plus size={15} /> Adaugă carte
              </Link>
            )}
          </div>
        </motion.div>

        {!residencyFolder ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-[28px] p-10 text-center"
            style={{ background: theme.surface2, border: `1px solid ${theme.border}` }}
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
              style={{ background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})` }}
            >
              Creează secțiunea Rezidențiat
            </motion.button>
          </motion.div>
        ) : books.length === 0 ? (
          <div className="rounded-[28px] p-10 text-center" style={{ background: theme.surface2, border: `1px solid ${theme.border}` }}>
            <p className="mb-5 text-sm" style={{ color: theme.text3 }}>Secțiunea e goală — adaugă prima carte.</p>
            <Link
              to={addBookHref}
              className="inline-flex items-center gap-2 rounded-2xl px-6 py-3 text-[11px] font-black uppercase tracking-[0.14em] text-white"
              style={{ background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})` }}
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
                  ? 'Indexare în curs...'
                  : 'Eroare la indexare';
              return (
                <motion.div
                  key={source.id}
                  layout
                  className="overflow-hidden rounded-[26px] transition-shadow"
                  style={{
                    background: theme.surface,
                    border: `1px solid ${expanded ? `${theme.accent}35` : theme.border}`,
                    boxShadow: expanded ? `0 8px 28px -12px ${theme.accent}30` : 'none',
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
                    {expanded && source.indexStatus === 'ready' && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: calmMotion ? 0.15 : 0.25 }}
                        className="overflow-hidden border-t px-6"
                        style={{ borderColor: theme.border }}
                      >
                        <BookChapters source={source} theme={theme} calmMotion={calmMotion} />
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
