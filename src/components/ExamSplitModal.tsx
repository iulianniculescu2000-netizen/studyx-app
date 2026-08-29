/**
 * "Distribuie pe zile până la examen" — splits every question in a folder into
 * a few evenly-sized study sessions spaced across the days remaining until an
 * exam date, so a 300-question bank stops looking like one wall of questions.
 */
import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { CalendarDays, X, Check } from 'lucide-react';
import { useTheme } from '../theme/ThemeContext';
import { useQuizStore } from '../store/quizStore';
import { useToastStore } from '../store/toastStore';
import Portal from './Portal';
import { buildExamSplitPlan, suggestChunkCount, daysUntil, planToQuizzes } from '../lib/examSplit';
import { generateId } from '../pages/quiz-create/helpers';
import type { Quiz, QuizColor } from '../types';

interface Props {
  folderName: string;
  folderId: string | null;
  color: QuizColor;
  category: string;
  quizzes: Quiz[]; // real quizzes (not flashcard decks) already in this folder
  onClose: () => void;
}

function defaultExamDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 21); // a reasonable 3-week-out placeholder
  return d.toISOString().slice(0, 10);
}

export default function ExamSplitModal({ folderName, folderId, color, category, quizzes, onClose }: Props) {
  const theme = useTheme();
  const addQuiz = useQuizStore((s) => s.addQuiz);
  const addToast = useToastStore((s) => s.addToast);

  const totalQuestions = useMemo(() => quizzes.reduce((n, q) => n + q.questions.length, 0), [quizzes]);
  const [examDateStr, setExamDateStr] = useState(defaultExamDate());
  const examDate = useMemo(() => new Date(`${examDateStr}T12:00:00`), [examDateStr]);
  const days = useMemo(() => daysUntil(examDate), [examDate]);
  const [chunkCount, setChunkCount] = useState(() => suggestChunkCount(totalQuestions, days));

  // Re-suggest whenever the exam date moves, unless the user already picked their own count this session.
  const [userPickedCount, setUserPickedCount] = useState(false);
  const effectiveChunkCount = userPickedCount ? chunkCount : suggestChunkCount(totalQuestions, days);

  const plan = useMemo(
    () => buildExamSplitPlan(quizzes, examDate, effectiveChunkCount),
    [quizzes, examDate, effectiveChunkCount],
  );

  const canSplit = totalQuestions >= 2;

  const handleConfirm = () => {
    if (!canSplit) return;
    const newQuizzes = planToQuizzes(plan, folderName, { folderId, color, category }, generateId);
    newQuizzes.forEach((q) => addQuiz(q));
    addToast(
      `${plan.chunkCount} sesiuni create (${totalQuestions} grile) — grilele originale rămân neschimbate.`,
      'success',
      5000,
    );
    onClose();
  };

  return (
    <Portal>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-50"
        style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: -20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
        className="fixed top-[6%] left-1/2 z-50 w-full max-w-lg -translate-x-1/2 px-4"
      >
        <div
          className="rounded-3xl p-6 shadow-2xl max-h-[86vh] overflow-y-auto"
          style={{ background: theme.isDark ? 'rgba(22,22,26,0.98)' : 'rgba(255,255,255,0.98)', border: `1px solid ${theme.border}` }}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CalendarDays size={16} style={{ color: theme.accent }} />
              <span className="text-sm font-bold" style={{ color: theme.text }}>Distribuie pe zile până la examen</span>
            </div>
            <button onClick={onClose} style={{ color: theme.text3 }}><X size={16} /></button>
          </div>

          {!canSplit ? (
            <p className="text-sm" style={{ color: theme.text3 }}>
              Folderul „{folderName}" are prea puține grile ({totalQuestions}) ca să merite distribuite.
            </p>
          ) : (
            <div className="space-y-4">
              <p className="text-xs" style={{ color: theme.text3 }}>
                Împart cele <b style={{ color: theme.text2 }}>{totalQuestions}</b> grile din „{folderName}" în sesiuni
                egale, spre data examenului. Grilele originale rămân neatinse — se adaugă seturi noi.
              </p>

              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: theme.text2 }}>Data examenului</label>
                <input
                  type="date"
                  lang="ro-RO"
                  value={examDateStr}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => { setExamDateStr(e.target.value); setUserPickedCount(false); }}
                  className="w-full text-sm px-3 py-2 rounded-lg"
                  style={{ background: theme.surface2, border: `1px solid ${theme.border}`, color: theme.text, outline: 'none' }}
                />
                {/* Native date inputs render day/month order per the OS locale, not
                    the app's — a user on an en-US-locale system typing "11/07"
                    meaning 11 July actually gets 7 November stored. Spelling the
                    parsed date out in words removes all ambiguity. */}
                <p className="mt-1.5 text-[11px] font-semibold" style={{ color: theme.accent }}>
                  → {new Intl.DateTimeFormat('ro-RO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(examDate)}
                </p>
                <p className="mt-0.5 text-[11px]" style={{ color: theme.text3 }}>{days} zile rămase</p>
              </div>

              <div>
                <label className="text-xs font-medium mb-1.5 block" style={{ color: theme.text2 }}>
                  Număr de sesiuni
                </label>
                <div className="flex gap-1.5 flex-wrap">
                  {[2, 3, 4, 5, 6].map((n) => (
                    <button
                      key={n}
                      onClick={() => { setChunkCount(n); setUserPickedCount(true); }}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                      style={{
                        background: effectiveChunkCount === n ? theme.accent : theme.surface2,
                        color: effectiveChunkCount === n ? '#fff' : theme.text3,
                      }}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-xl p-3 space-y-1.5" style={{ background: theme.surface2 }}>
                {plan.sessions.map((s) => (
                  <div key={s.index} className="flex items-center justify-between text-xs">
                    <span style={{ color: theme.text2 }}>Sesiunea {s.index + 1}/{plan.chunkCount}</span>
                    <span style={{ color: theme.text3 }}>{s.questions.length} grile · {new Intl.DateTimeFormat('ro-RO', { day: 'numeric', month: 'short' }).format(s.date)}</span>
                  </div>
                ))}
              </div>

              <motion.button
                onClick={handleConfirm}
                whileTap={{ scale: 0.98 }}
                className="w-full py-2.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2"
                style={{ background: theme.accent }}
              >
                <Check size={14} /> Creează {plan.chunkCount} sesiuni
              </motion.button>
            </div>
          )}
        </div>
      </motion.div>
    </Portal>
  );
}
