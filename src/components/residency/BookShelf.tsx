import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, ChevronDown, CreditCard, Loader2, MessageCircle, Sparkles } from 'lucide-react';
import { useTheme } from '../../theme/ThemeContext';
import type { AIKnowledgeSource } from '../../store/aiStore';
import { useUIStore } from '../../store/uiStore';
import { useQuizStore } from '../../store/quizStore';
import { useFolderStore } from '../../store/folderStore';
import { useStatsStore } from '../../store/statsStore';
import { useToastStore } from '../../store/toastStore';
import { useSourceChapters } from '../../hooks/useSourceChapters';
import { dispatchDiscussChapter, dispatchGenerateFromChapter } from '../../lib/ai/chapterEvents';
import { generateFlashcardsFromChapter } from '../../lib/ai/chapterFlashcardGeneration';
import { findOrCreateAiFlashcardsFolder } from '../../lib/rezidentiatRoot';
import BookTableOfContents from '../BookTableOfContents';
import type { Quiz, QuestionStat } from '../../types';

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

function ChapterProgress({ sourceName, heading, theme }: { sourceName: string; heading: string; theme: Theme }) {
  const progress = useChapterProgress(sourceName, heading);
  if (!progress) return null;
  const color = progress.accuracy >= 75 ? theme.success : progress.accuracy >= 45 ? theme.warning : theme.danger;
  return (
    <span className="flex items-center gap-1.5 text-[11px] font-semibold" style={{ color }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {progress.accuracy}%
    </span>
  );
}

function ChapterAction({
  icon,
  label,
  onClick,
  busy,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  busy?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="fine-chip press-feedback inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium disabled:opacity-60"
      style={{ color: 'var(--text-secondary, inherit)' }}
    >
      {busy ? <Loader2 size={12} className="animate-spin" /> : icon}
      {label}
    </button>
  );
}

export function BookChapters({ source, theme }: { source: AIKnowledgeSource; theme: Theme }) {
  const { chapters, loading } = useSourceChapters(source.id);
  const setChatOpen = useUIStore((state) => state.setChatOpen);
  const folders = useFolderStore((state) => state.folders);
  const addQuiz = useQuizStore((state) => state.addQuiz);
  const addToast = useToastStore((state) => state.addToast);
  const navigate = useNavigate();
  const [generatingHeading, setGeneratingHeading] = useState<string | null>(null);

  const discuss = (heading: string, label: string) => {
    setChatOpen(true);
    dispatchDiscussChapter(source, heading, label, true);
  };
  const generate = (heading: string, label: string) => {
    setChatOpen(true);
    dispatchGenerateFromChapter(source, heading, label, true);
  };

  const generateFlashcards = async (heading: string, label: string) => {
    if (generatingHeading) return;
    setGeneratingHeading(heading);
    try {
      const folderId = findOrCreateAiFlashcardsFolder();
      const folder = folders.find((f) => f.id === folderId) ?? null;
      const { deck, cardCount } = await generateFlashcardsFromChapter({
        sourceId: source.id,
        sourceName: source.name,
        heading,
        label,
        folder,
        cardCount: 20,
        examStyle: 'residency',
      });
      addQuiz({ ...deck, folderId });
      addToast(`${cardCount} flashcarduri create din „${label}".`, 'success', 5000);
      navigate(`/flashcards/session/${deck.id}?mode=all`);
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Generarea flashcardurilor a eșuat.', 'error', 5000);
    } finally {
      setGeneratingHeading(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-2 py-3">
        <div className="skeleton-block h-12 rounded-xl" />
        <div className="skeleton-block h-12 rounded-xl" />
      </div>
    );
  }

  if (chapters.length === 0) {
    return <p className="py-4 text-sm" style={{ color: theme.text3 }}>Nu am găsit încă fragmente indexate pentru această carte.</p>;
  }

  return (
    <div>
      {chapters.map((chapter, index) => (
        <div
          key={chapter.heading}
          className="flex flex-wrap items-center justify-between gap-3 py-3"
          style={{ borderTop: index === 0 ? undefined : '1px solid var(--hairline)' }}
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <div className="truncate text-[13.5px] font-semibold" style={{ color: theme.text }}>{chapter.label}</div>
              <ChapterProgress sourceName={source.name} heading={chapter.heading} theme={theme} />
            </div>
            <div className="mt-0.5 text-[11.5px]" style={{ color: theme.text3 }}>{chapter.chunkCount} fragmente</div>
          </div>
          <div className="flex flex-shrink-0 items-center gap-1.5">
            <ChapterAction icon={<MessageCircle size={12} />} label="Discută" onClick={() => discuss(chapter.heading, chapter.label)} />
            <ChapterAction icon={<Sparkles size={12} />} label="Grile" onClick={() => generate(chapter.heading, chapter.label)} />
            <ChapterAction
              icon={<CreditCard size={12} />}
              label="Carduri"
              busy={generatingHeading === chapter.heading}
              onClick={() => void generateFlashcards(chapter.heading, chapter.label)}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

interface BookShelfProps {
  books: AIKnowledgeSource[];
  addBookHref: string;
  calmMotion: boolean;
  emptyMessage?: string;
}

/** Reference books as one calm list; a book opens in place to show its chapters. */
export default function BookShelf({ books, addBookHref, calmMotion, emptyMessage }: BookShelfProps) {
  const theme = useTheme();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (books.length === 0) {
    return (
      <div className="rounded-2xl px-5 py-8 text-center" style={{ background: theme.surface, border: '1px solid var(--hairline)' }}>
        <p className="text-sm" style={{ color: theme.text3 }}>{emptyMessage ?? 'Nicio carte încă.'}</p>
        <Link to={addBookHref} className="mt-3 inline-block text-[13px] font-semibold" style={{ color: theme.accent }}>
          Adaugă o carte
        </Link>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl" style={{ background: theme.surface, border: '1px solid var(--hairline)' }}>
      {books.map((source, index) => {
        const expanded = expandedId === source.id;
        const status = source.indexStatus === 'ready'
          ? `${source.chunkCount} fragmente`
          : source.indexStatus === 'indexing'
            ? `Indexare… ${Math.round(source.indexProgress ?? 0)}%`
            : 'Eroare la indexare';
        return (
          <div key={source.id} style={{ borderTop: index === 0 ? undefined : '1px solid var(--hairline)' }}>
            <button
              type="button"
              onClick={() => setExpandedId(expanded ? null : source.id)}
              className="fine-row flex w-full items-center gap-3 px-4 py-3.5 text-left"
              style={{ borderRadius: 0 }}
              aria-expanded={expanded}
            >
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px]" style={{ background: `${theme.accent}18`, color: theme.accent }}>
                <BookOpen size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-semibold" style={{ color: theme.text }}>{source.name.replace(/\.pdf$/i, '')}</div>
                <div className="text-[12px]" style={{ color: source.indexStatus === 'error' ? theme.danger : theme.text3 }}>{status}</div>
              </div>
              <motion.span animate={{ rotate: expanded ? 180 : 0 }} style={{ color: theme.text3 }}>
                <ChevronDown size={16} />
              </motion.span>
            </button>
            <AnimatePresence initial={false}>
              {expanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: calmMotion ? 0.12 : 0.22 }}
                  className="overflow-hidden px-4"
                  style={{ background: 'var(--fill-subtle)' }}
                >
                  {source.indexStatus === 'ready' ? (
                    <>
                      <BookTableOfContents source={source} theme={theme} />
                      <BookChapters source={source} theme={theme} />
                    </>
                  ) : source.indexStatus === 'indexing' ? (
                    <p className="py-4 text-sm" style={{ color: theme.text3 }}>
                      Cartea se indexează încă — capitolele apar când se termină.
                    </p>
                  ) : (
                    <p className="py-4 text-sm" style={{ color: theme.danger }}>
                      Indexarea a eșuat{source.indexError ? `: ${source.indexError}` : '.'} Șterge cartea din <Link to={addBookHref} className="underline">Bibliotecă</Link> și încarc-o din nou.
                    </p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
