import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Check, CreditCard, Loader2, MessageCircle, Sparkles } from 'lucide-react';
import { useTheme } from '../theme/ThemeContext';
import { useAIStore, type AIStudyPlanSession } from '../store/aiStore';
import { useUIStore } from '../store/uiStore';
import { useQuizStore } from '../store/quizStore';
import { useToastStore } from '../store/toastStore';
import { useAdaptiveMotion } from '../hooks/useAdaptiveMotion';
import { dispatchDiscussChapter, dispatchGenerateFromChapter } from '../lib/ai/chapterEvents';
import { generateFlashcardsFromChapter } from '../lib/ai/chapterFlashcardGeneration';

const DATE_FMT = new Intl.DateTimeFormat('ro-RO', { weekday: 'short', day: 'numeric', month: 'short' });

function passLabel(session: AIStudyPlanSession): string {
  return session.kind === 'first-pass' ? 'Prima trecere' : `Recapitulare ${session.passIndex}`;
}

export default function ExamPlanSessionRow({ folderId, session }: { folderId: string; session: AIStudyPlanSession }) {
  const theme = useTheme();
  const { calmMotion } = useAdaptiveMotion();
  const toggleExamPlanSession = useAIStore((state) => state.toggleExamPlanSession);
  const setChatOpen = useUIStore((state) => state.setChatOpen);
  const addQuiz = useQuizStore((state) => state.addQuiz);
  const addToast = useToastStore((state) => state.addToast);
  const navigate = useNavigate();
  const [generatingKey, setGeneratingKey] = useState<string | null>(null);

  const date = new Date(`${session.date}T12:00:00`);

  const discuss = (chapter: AIStudyPlanSession['chapters'][number]) => {
    setChatOpen(true);
    dispatchDiscussChapter({ id: chapter.sourceId, name: chapter.sourceName }, chapter.heading, chapter.label);
  };
  const generate = (chapter: AIStudyPlanSession['chapters'][number]) => {
    setChatOpen(true);
    dispatchGenerateFromChapter({ id: chapter.sourceId, name: chapter.sourceName }, chapter.heading, chapter.label);
  };
  const generateFlashcards = async (chapter: AIStudyPlanSession['chapters'][number]) => {
    const key = `${chapter.sourceId}::${chapter.heading}`;
    if (generatingKey) return;
    setGeneratingKey(key);
    try {
      const { deck, cardCount } = await generateFlashcardsFromChapter({
        sourceId: chapter.sourceId,
        sourceName: chapter.sourceName,
        heading: chapter.heading,
        label: chapter.label,
        folder: null,
        cardCount: 20,
      });
      addQuiz({ ...deck, folderId: null });
      addToast(`${cardCount} flashcarduri create din „${chapter.label}".`, 'success', 5000);
      navigate(`/flashcards/session/${deck.id}?mode=all`);
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Generarea flashcardurilor a eșuat.', 'error', 5000);
    } finally {
      setGeneratingKey(null);
    }
  };

  return (
    <div className="rounded-2xl p-3.5" style={{ background: theme.surface2, border: `1px solid ${theme.border}` }}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => toggleExamPlanSession(folderId, session.id)}
            className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md transition-all"
            style={{
              background: session.done ? theme.success : 'transparent',
              border: `1.5px solid ${session.done ? theme.success : theme.border}`,
            }}
            aria-label={session.done ? 'Marchează ca nebifat' : 'Marchează ca bifat'}
          >
            {session.done && <Check size={12} color="#fff" strokeWidth={3} />}
          </button>
          <span className="text-xs font-black" style={{ color: session.done ? theme.text3 : theme.text2, textDecoration: session.done ? 'line-through' : 'none' }}>
            {passLabel(session)}
          </span>
        </div>
        <span className="text-[11px] font-semibold capitalize" style={{ color: theme.text3 }}>{DATE_FMT.format(date)}</span>
      </div>

      <div className="mt-2.5 space-y-2">
        {session.chapters.map((chapter) => {
          const key = `${chapter.sourceId}::${chapter.heading}`;
          return (
            <div
              key={key}
              className="flex flex-wrap items-center justify-between gap-2.5 rounded-xl px-3 py-2.5"
              style={{ background: theme.surface }}
            >
              <div className="min-w-0">
                <div className="truncate text-xs font-bold" style={{ color: theme.text }}>{chapter.label}</div>
                <div className="truncate text-[10px] font-medium" style={{ color: theme.text3 }}>{chapter.sourceName}</div>
              </div>
              <div className="flex flex-shrink-0 items-center gap-1.5">
                <motion.button
                  whileTap={calmMotion ? undefined : { scale: 0.97 }}
                  onClick={() => discuss(chapter)}
                  className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[9.5px] font-black uppercase tracking-[0.06em]"
                  style={{ background: theme.surface2, border: `1px solid ${theme.border}`, color: theme.text2 }}
                >
                  <MessageCircle size={11} /> Discută
                </motion.button>
                <motion.button
                  whileTap={calmMotion ? undefined : { scale: 0.97 }}
                  onClick={() => generate(chapter)}
                  className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[9.5px] font-black uppercase tracking-[0.06em]"
                  style={{ background: `${theme.accent}15`, border: `1px solid ${theme.accent}25`, color: theme.accent }}
                >
                  <Sparkles size={11} /> Grile
                </motion.button>
                <motion.button
                  whileTap={calmMotion ? undefined : { scale: 0.97 }}
                  onClick={() => void generateFlashcards(chapter)}
                  disabled={generatingKey === key}
                  className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[9.5px] font-black uppercase tracking-[0.06em] disabled:opacity-60"
                  style={{ background: `${theme.success}15`, border: `1px solid ${theme.success}25`, color: theme.success }}
                >
                  {generatingKey === key ? <Loader2 size={11} className="animate-spin" /> : <CreditCard size={11} />}
                  Flashcarduri
                </motion.button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
