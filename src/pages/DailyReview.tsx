/**
 * DailyReview.tsx
 *
 * SM-2 daily spaced-repetition queue.
 * Shows all questions whose nextReview <= now, one by one.
 * Records answers back into statsStore so the SM-2 algorithm advances.
 */
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Brain, ChevronRight, Check, X, RotateCcw, Home, Sparkles, Trophy } from 'lucide-react';
import { useTheme } from '../theme/ThemeContext';
import { useQuizStore } from '../store/quizStore';
import { useStatsStore } from '../store/statsStore';
import type { Question } from '../types';

interface DueItem {
  quizId: string;
  quizTitle: string;
  question: Question;
}

function buildDueItems(
  stats: ReturnType<typeof useStatsStore.getState>['questionStats'],
  quizzes: ReturnType<typeof useQuizStore.getState>['quizzes'],
): DueItem[] {
  const now = Date.now();
  return Object.values(stats)
    .filter(s => s.nextReview > 0 && s.nextReview <= now)
    .flatMap(s => {
      const quiz = quizzes.find(q => q.id === s.quizId);
      const question = quiz?.questions.find(q => q.id === s.questionId);
      if (!quiz || !question) return [];
      return [{ quizId: quiz.id, quizTitle: quiz.title, question }];
    });
}

export default function DailyReview() {
  const theme = useTheme();
  const { quizzes } = useQuizStore();
  const { questionStats, recordAnswer, recordStudySession } = useStatsStore();

  const [phase, setPhase] = useState<'ready' | 'session' | 'done'>('ready');
  const [items] = useState<DueItem[]>(() => buildDueItems(questionStats, quizzes));
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [results, setResults] = useState<boolean[]>([]);
  const [startedAt] = useState(() => Date.now());

  const current = items[currentIdx];
  const isMultiple = current?.question.multipleCorrect ?? false;
  const correctIds = useMemo(() => current?.question.options.filter(o => o.isCorrect).map(o => o.id) ?? [], [current]);
  const progress = items.length > 0 ? ((currentIdx + (revealed ? 1 : 0)) / items.length) * 100 : 0;

  const revealAnswer = useCallback((sel: string[]) => {
    if (!current) return;
    const isCorrect = sel.length === correctIds.length && correctIds.every((id: string) => sel.includes(id));
    setRevealed(true);
    setResults(prev => [...prev, isCorrect]);
    recordAnswer(current.quizId, current.question.id, isCorrect);
  }, [correctIds, current, recordAnswer]);

  const handleSelect = (optId: string) => {
    if (revealed) return;
    if (isMultiple) {
      setSelected(prev => prev.includes(optId) ? prev.filter(i => i !== optId) : [...prev, optId]);
    } else {
      setSelected([optId]);
      revealAnswer([optId]);
    }
  };

  const handleNext = () => {
    if (currentIdx + 1 >= items.length) {
      recordStudySession(Math.floor((Date.now() - startedAt) / 1000));
      setPhase('done');
    } else {
      setCurrentIdx(i => i + 1);
      setSelected([]);
      setRevealed(false);
    }
  };

  const correctCount = results.filter(Boolean).length;
  const accuracy = results.length > 0 ? Math.round((correctCount / results.length) * 100) : 0;

  // ── Empty state ─────────────────────────────────────────────────────────────
  if (items.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col items-center justify-center h-full text-center px-8"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.1 }}
          className="w-24 h-24 rounded-3xl flex items-center justify-center mb-8 mx-auto"
          style={{ background: `${theme.success}15` }}
        >
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={theme.success} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 12l2 2 4-4"/>
            <rect x="3" y="4" width="18" height="18" rx="3"/>
            <path d="M16 2v4M8 2v4M3 10h18"/>
          </svg>
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-2xl font-black mb-3 tracking-tight"
          style={{ color: theme.text }}
        >
          Ești la zi! 🎉
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28 }}
          className="text-sm mb-8 max-w-xs leading-relaxed"
          style={{ color: theme.text3 }}
        >
          Ai recapitulat tot ce era programat pentru azi. Revino mâine pentru sesiunea următoare.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
        >
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm text-white"
            style={{ background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})` }}
          >
            Înapoi la Dashboard
          </Link>
        </motion.div>
      </motion.div>
    );
  }

  // ── Ready screen ─────────────────────────────────────────────────────────────
  if (phase === 'ready') {
    return (
      <div className="h-full overflow-y-auto px-6 py-10 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-sm w-full text-center"
        >
          {/* Icon */}
          <div className="w-20 h-20 rounded-3xl mx-auto mb-6 flex items-center justify-center"
            style={{ background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})`, boxShadow: `0 16px 40px ${theme.accent}30` }}>
            <Brain size={36} className="text-white" />
          </div>

          <h1 className="text-4xl font-black tracking-tighter mb-2" style={{ color: theme.text }}>
            Sesiune <span style={{ 
              background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})`, 
              WebkitBackgroundClip: 'text', 
              WebkitTextFillColor: 'transparent',
              display: 'inline-block'
            }}>Zilnică</span>
          </h1>
          <p className="text-sm font-medium opacity-60 mb-10" style={{ color: theme.text }}>
            Repetare spațiată SM-2 · {items.length} {items.length === 1 ? 'întrebare' : 'întrebări'} de recapitulat azi
          </p>

          {/* Stats cards */}
          <div className="grid grid-cols-2 gap-3 mb-8">
            <div className="rounded-2xl p-4 text-left"
              style={{ background: theme.surface, border: `1px solid ${theme.border}` }}>
              <p className="text-2xl font-bold" style={{ color: theme.accent }}>{items.length}</p>
              <p className="text-xs mt-0.5" style={{ color: theme.text3 }}>Întrebări de azi</p>
            </div>
            <div className="rounded-2xl p-4 text-left"
              style={{ background: theme.surface, border: `1px solid ${theme.border}` }}>
              <p className="text-2xl font-bold" style={{ color: theme.accent2 }}>
                {Math.ceil(items.length * 0.5)}m
              </p>
              <p className="text-xs mt-0.5" style={{ color: theme.text3 }}>Timp estimat</p>
            </div>
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setPhase('session')}
            className="w-full py-4 rounded-2xl font-semibold text-white flex items-center justify-center gap-2 mb-3"
            style={{ background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})`, boxShadow: `0 8px 24px ${theme.accent}25` }}>
            <Sparkles size={16} />Începe sesiunea
          </motion.button>
          <Link to="/" className="text-sm" style={{ color: theme.text3 }}>Înapoi la Dashboard</Link>
        </motion.div>
      </div>
    );
  }

  // ── Done screen ─────────────────────────────────────────────────────────────
  if (phase === 'done') {
    const grade = accuracy >= 90 ? 'Excelent! 🏆' : accuracy >= 70 ? 'Bine! 👍' : accuracy >= 50 ? 'Continuă! 💪' : 'Mai exersează! 📚';
    return (
      <div className="h-full overflow-y-auto px-6 py-10 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-sm w-full text-center"
        >
          <div className="w-20 h-20 rounded-3xl mx-auto mb-6 flex items-center justify-center"
            style={{ background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})`, boxShadow: `0 16px 40px ${theme.accent}30` }}>
            <Trophy size={36} className="text-white" />
          </div>

          <h2 className="text-2xl font-bold mb-1" style={{ color: theme.text }}>{grade}</h2>
          <p className="text-sm mb-6" style={{ color: theme.text3 }}>Sesiune SM-2 completă</p>

          {/* Score ring */}
          <div className="relative w-28 h-28 mx-auto mb-6">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" fill="none" stroke={theme.surface2} strokeWidth="10" />
              <motion.circle
                cx="50" cy="50" r="42" fill="none"
                stroke={accuracy >= 70 ? theme.success : accuracy >= 40 ? theme.warning : theme.danger}
                strokeWidth="10" strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 42}`}
                initial={{ strokeDashoffset: 2 * Math.PI * 42 }}
                animate={{ strokeDashoffset: 2 * Math.PI * 42 * (1 - accuracy / 100) }}
                transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold" style={{ color: theme.text }}>{accuracy}%</span>
              <span className="text-xs" style={{ color: theme.text3 }}>acuratețe</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-8">
            <div className="rounded-2xl p-4"
              style={{ background: `${theme.success}12`, border: `1px solid ${theme.success}25` }}>
              <p className="text-xl font-bold" style={{ color: theme.success }}>{correctCount}</p>
              <p className="text-xs" style={{ color: theme.text3 }}>Corecte</p>
            </div>
            <div className="rounded-2xl p-4"
              style={{ background: `${theme.danger}12`, border: `1px solid ${theme.danger}25` }}>
              <p className="text-xl font-bold" style={{ color: theme.danger }}>{results.length - correctCount}</p>
              <p className="text-xs" style={{ color: theme.text3 }}>Greșite</p>
            </div>
          </div>

          <div className="space-y-2">
            <button
              onClick={() => { setPhase('ready'); setCurrentIdx(0); setSelected([]); setRevealed(false); setResults([]); }}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-semibold text-white"
              style={{ background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})` }}>
              <RotateCcw size={14} />Repetă sesiunea
            </button>
            <Link to="/"
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium"
              style={{ background: theme.surface, border: `1px solid ${theme.border}`, color: theme.text2 }}>
              <Home size={14} />Acasă
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  // ── Session screen ────────────────────────────────────────────────────────────
  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-xl mx-auto px-4 py-6">

        {/* Progress bar */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Brain size={15} style={{ color: theme.accent }} />
              <span className="text-xs font-semibold" style={{ color: theme.accent }}>Sesiune zilnică</span>
            </div>
            <span className="text-xs" style={{ color: theme.text3 }}>
              {currentIdx + 1} / {items.length}
            </span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: theme.surface2 }}>
            <motion.div
              className="h-full rounded-full"
              style={{ background: `linear-gradient(90deg, ${theme.accent}, ${theme.accent2})` }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            />
          </div>
        </div>

        <AnimatePresence>
          <motion.div
            key={currentIdx}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.22 }}
          >
            {/* Question card */}
            <div className="rounded-2xl p-5 mb-4"
              style={{ background: theme.surface, border: `1px solid ${theme.border}` }}>
              <p className="text-xs font-medium mb-3 truncate" style={{ color: theme.text3 }}>
                📚 {current.quizTitle}
              </p>
              <p className="text-lg font-semibold leading-snug" style={{ color: theme.text }}>
                {current.question.text}
              </p>
            </div>

            {/* Options */}
            <div className="space-y-2.5 mb-4">
              {current.question.options.map((opt) => {
                const isSelected = selected.includes(opt.id);
                const isCorrect = opt.isCorrect;
                let bg = theme.surface;
                let border = theme.border;
                let color = theme.text2;

                if (revealed) {
                  if (isCorrect) { bg = `${theme.success}14`; border = `${theme.success}45`; color = theme.success; }
                  else if (isSelected) { bg = `${theme.danger}12`; border = `${theme.danger}40`; color = theme.danger; }
                } else if (isSelected) {
                  bg = `${theme.accent}14`; border = `${theme.accent}45`; color = theme.accent;
                }

                return (
                  <motion.button
                    key={opt.id}
                    onClick={() => handleSelect(opt.id)}
                    whileTap={!revealed ? { scale: 0.98 } : {}}
                    className="w-full flex items-center gap-3 p-4 rounded-xl text-left transition-colors"
                    style={{ background: bg, border: `1px solid ${border}`, color, cursor: revealed ? 'default' : 'pointer' }}
                  >
                    <span className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold"
                      style={{
                        background: revealed && isCorrect
                          ? `${theme.success}25`
                          : revealed && isSelected && !isCorrect
                            ? `${theme.danger}20`
                            : isSelected ? `${theme.accent}22` : theme.surface2,
                        color: revealed && isCorrect ? theme.success : revealed && isSelected && !isCorrect ? theme.danger : isSelected ? theme.accent : theme.text3,
                      }}>
                      {revealed && isCorrect ? <Check size={12} /> : revealed && isSelected && !isCorrect ? <X size={12} /> : opt.id.toUpperCase()}
                    </span>
                    <span className="text-sm">{opt.text}</span>
                  </motion.button>
                );
              })}
            </div>

            {/* Confirm multi-select */}
            <AnimatePresence>
              {isMultiple && !revealed && selected.length > 0 && (
                <motion.button
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  onClick={() => revealAnswer(selected)}
                  className="w-full py-3.5 rounded-2xl font-semibold text-white mb-4"
                  style={{ background: `linear-gradient(135deg, ${theme.accent2}, ${theme.accent})` }}>
                  Confirmă selecția
                </motion.button>
              )}
            </AnimatePresence>

            {/* Explanation */}
            <AnimatePresence>
              {revealed && current.question.explanation && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mb-4 p-5 rounded-3xl overflow-hidden"
                  style={{ background: `${theme.accent}0C`, border: `1.5px solid ${theme.accent}25` }}>
                  <p className="text-sm" style={{ color: theme.text2, lineHeight: '1.7', fontSize: '15px' }}>
                    <span className="font-black uppercase tracking-widest text-[10px] block mb-2" style={{ color: theme.accent }}>💡 Explicație</span>
                    {current.question.explanation}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Next button */}
            <AnimatePresence>
              {revealed && (
                <motion.button
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={handleNext}
                  className="w-full py-4 rounded-2xl font-semibold text-white flex items-center justify-center gap-2"
                  style={{ background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})` }}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}>
                  {currentIdx + 1 >= items.length ? '🏁 Vezi rezultatele' : (<>Următor <ChevronRight size={16} /></>)}
                </motion.button>
              )}
            </AnimatePresence>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
