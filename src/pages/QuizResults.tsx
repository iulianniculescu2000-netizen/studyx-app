import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Trophy, RotateCcw, Home, Check, X, Star, Download, Bot, Loader2, Scale } from 'lucide-react';
import confetti from 'canvas-confetti';
import type { QuizSession, Question, QuestionStat } from '../types';
import { useQuizStore } from '../store/quizStore';
import { useStatsStore } from '../store/statsStore';
import { useTheme } from '../theme/ThemeContext';
import { useAIStore } from '../store/aiStore';
import { useUserStore } from '../store/userStore';
import { explainWrongAnswer } from '../lib/groq';
import { buildAdaptiveExamQuiz, buildMistakeFlashcardQuiz, buildWeaknessRecoveryQuiz } from '../lib/adaptiveStudy';

export default function QuizResults() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { quizzes, addQuiz } = useQuizStore();
  const theme = useTheme();
  // Hooks must be called unconditionally — before any early returns
  const { hasKey } = useAIStore();
  const { questionStats, getAccuracy } = useStatsStore();
  const activeProfileId = useUserStore((state) => state.activeProfileId);
  const [aiExplanations, setAiExplanations] = useState<Record<string, string>>({});
  const [aiLoading, setAiLoading] = useState<Record<string, boolean>>({});
  const [followUpLoading, setFollowUpLoading] = useState<'flashcards' | 'recovery' | 'exam' | null>(null);

  const state = location.state as { session: QuizSession; orderedQuestions?: Question[] } | QuizSession | undefined;
  let session: QuizSession | undefined;
  let orderedQuestions: Question[] | undefined;

  if (state && 'session' in state) {
    session = state.session;
    orderedQuestions = state.orderedQuestions;
  } else {
    session = state as QuizSession | undefined;
  }

  const quiz = quizzes.find((q) => q.id === id);
  const questions = orderedQuestions ?? quiz?.questions ?? [];
  const isAdaptiveExam = quiz?.tags?.includes('adaptive-exam') ?? false;
  const isRecoverySession = quiz?.tags?.includes('recovery') ?? false;
  const isMistakeDeck = quiz?.tags?.includes('mistake-bank') ?? false;

  const pct = Math.round(((session?.score ?? 0) / (session?.total ?? 1)) * 100);

  useEffect(() => {
    if (pct >= 90 && session && quiz) {
      confetti({ particleCount: 120, spread: 70, origin: { y: 0.35 }, colors: ['#FFD60A', '#FF9F0A', '#30D158', '#0A84FF'] });
      if (pct >= 95) {
        setTimeout(() => confetti({ particleCount: 80, spread: 100, origin: { y: 0.3 }, angle: 60, colors: ['#FFD60A', '#FF375F'] }), 400);
        setTimeout(() => confetti({ particleCount: 80, spread: 100, origin: { y: 0.3 }, angle: 120, colors: ['#30D158', '#5E5CE6'] }), 700);
      }
    }
  }, [pct, session, quiz]);

  if (!session || !quiz) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="mb-4" style={{ color: theme.text2 }}>Sesiunea nu a fost găsită.</p>
          <Link to="/quizzes" style={{ color: theme.accent }}>Înapoi</Link>
        </div>
      </div>
    );
  }

  const duration = session.finishedAt ? Math.round((session.finishedAt - session.startedAt) / 1000) : 0;

  const handleExplain = async (q: Question, userAnswerText: string, correctText: string) => {
    if (aiLoading[q.id] || aiExplanations[q.id]) return;
    setAiLoading((p) => ({ ...p, [q.id]: true }));
    const total = Object.values(questionStats).reduce((s, qs: QuestionStat) => s + qs.timesCorrect + qs.timesWrong, 0);
    const userContext = total > 0 ? `Student medical: ${total} grile rezolvate, acuratețe ${getAccuracy()}%.` : undefined;
    try {
      const explanation = await explainWrongAnswer(q.text, userAnswerText, correctText, userContext);
      setAiExplanations((p) => ({ ...p, [q.id]: explanation }));
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      setAiExplanations((p) => ({ ...p, [q.id]: `Eroare: ${message}` }));
    } finally {
      setAiLoading((p) => ({ ...p, [q.id]: false }));
    }
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  const grade =
    pct >= 90 ? { label: 'Excelent!', emoji: '🏆', color: '#FFD60A' }
    : pct >= 70 ? { label: 'Bine!', emoji: '⭐', color: theme.success }
    : pct >= 50 ? { label: 'Satisfăcător', emoji: '💪', color: theme.warning }
    : { label: 'Mai încearcă!', emoji: '📚', color: theme.danger };

  const exportResults = () => {
    const data = {
      quiz: quiz.title,
      date: new Date(session!.startedAt).toLocaleString('ro-RO'),
      score: `${session!.score}/${session!.total} (${pct}%)`,
      duration: formatTime(duration),
      questions: questions.map((q) => {
        const userAnswers = session!.answers[q.id] ?? [];
        const correctIds = q.options.filter((o) => o.isCorrect).map((o) => o.id);
        return {
          question: q.text,
          correct: userAnswers.length === correctIds.length && correctIds.every((i) => userAnswers.includes(i)),
          yourAnswer: userAnswers.map((id) => q.options.find((o) => o.id === id)?.text).join(', '),
          correctAnswer: q.options.filter((o) => o.isCorrect).map((o) => o.text).join(', '),
        };
      }),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rezultate-${quiz.title.replace(/\s+/g, '-').toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const launchFollowUp = (mode: 'flashcards' | 'recovery' | 'exam') => {
    if (!activeProfileId) return;
    setFollowUpLoading(mode);
    try {
      const nextQuiz =
        mode === 'flashcards'
          ? buildMistakeFlashcardQuiz(activeProfileId, quizzes, questionStats)
          : mode === 'recovery'
            ? buildWeaknessRecoveryQuiz(activeProfileId, quizzes, questionStats)
            : buildAdaptiveExamQuiz(activeProfileId, quizzes, questionStats);

      if (!nextQuiz) return;
      addQuiz(nextQuiz);
      navigate(
        mode === 'flashcards' ? `/flashcards/session/${nextQuiz.id}?mode=all` : `/play/${nextQuiz.id}`,
        mode === 'exam' ? { state: { mode: 'exam' } } : undefined,
      );
    } finally {
      setFollowUpLoading(null);
    }
  };

  const insightTitle = isAdaptiveExam
    ? (pct >= 85 ? 'Simulare foarte solidă' : pct >= 65 ? 'Ai o bază bună de examen' : 'Mai e loc clar de consolidare')
    : isRecoverySession
      ? (pct >= 80 ? 'Recuperarea a prins bine' : 'Mai merită o rundă focalizată')
      : isMistakeDeck
        ? (pct >= 85 ? 'Greșelile vechi se fixează' : 'Flashcards-urile mai au valoare pentru consolidare')
        : (pct >= 85 ? 'Ritm excelent' : 'Poți împinge și mai sus sesiunea următoare');

  const insightText = isAdaptiveExam
    ? 'Adaptive Exam Mode ți-a calibrat dificultatea după istoricul tău. Pasul următor bun este o sesiune scurtă pe punctele slabe sau un deck de fixare din greșeli.'
    : isRecoverySession
      ? 'Weakness Recovery a extras exact zonele unde ai nevoie de consolidare. Dacă mai sunt goluri, transformă-le direct în flashcards sau treci într-o simulare de examen.'
      : isMistakeDeck
        ? 'Deck-ul din greșeli e excelent pentru fixare rapidă. După ce scorul urcă, continuă cu o recuperare focalizată sau cu un examen adaptiv.'
        : 'Poți continua inteligent: recuperezi punctele slabe, creezi flashcards din greșeli sau intri direct într-un examen adaptiv.';

  return (
    <div className="h-full overflow-y-auto">
    <div className="min-h-full pt-6 pb-20 px-6 relative z-10">
      <div className="max-w-2xl mx-auto">

        {/* Score hero */}
        <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }} className="text-center mb-10">

          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
            transition={{ delay: 0.2, duration: 0.5, type: 'spring', stiffness: 200 }}
            className="text-6xl mb-4">{grade.emoji}</motion.div>

          <h1 className="text-4xl font-bold mb-2 tracking-tight" style={{ color: theme.text }}>{grade.label}</h1>
          <p className="mb-6" style={{ color: theme.text2 }}>{quiz.title}</p>

          {/* Score ring */}
          <div className="relative w-36 h-36 mx-auto mb-6">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" fill="none" stroke={theme.surface2} strokeWidth="8" />
              <motion.circle cx="50" cy="50" r="42" fill="none"
                stroke={grade.color} strokeWidth="8" strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 42}`}
                initial={{ strokeDashoffset: 2 * Math.PI * 42 }}
                animate={{ strokeDashoffset: 2 * Math.PI * 42 * (1 - pct / 100) }}
                transition={{ duration: 1.2, delay: 0.3, ease: 'easeOut' }}
                style={{ filter: `drop-shadow(0 0 8px ${grade.color}60)` }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold" style={{ color: theme.text }}>{pct}%</span>
              <span className="text-xs" style={{ color: theme.text3 }}>scor</span>
            </div>
          </div>

          <div className="flex items-center justify-center gap-6">
            {[
              { val: session.score, label: 'Corecte', color: theme.success },
              null,
              { val: session.total - session.score, label: 'Greșite', color: theme.danger },
              null,
              { val: formatTime(duration), label: 'Timp', color: theme.text },
            ].map((item, i) =>
              item === null
                ? <div key={i} className="w-px h-8" style={{ background: theme.border }} />
                : <div key={i} className="text-center">
                    <div className="text-xl font-bold" style={{ color: item.color }}>{item.val}</div>
                    <div className="text-xs" style={{ color: theme.text3 }}>{item.label}</div>
                  </div>
            )}
          </div>

          {/* Rezidențiat penalty score panel */}
          {session.penalizedScore !== undefined && quiz.penaltyMode && (
            <motion.div
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55 }}
              className="mt-5 mx-auto"
              style={{
                maxWidth: 320,
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.25)',
                borderRadius: 14,
                padding: '14px 20px',
              }}>
              <div className="flex items-center gap-2 mb-1" style={{ color: '#ef4444' }}>
                <Scale size={14} />
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Scor net Rezidențiat
                </span>
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#ef4444', lineHeight: 1 }}>
                {session.penalizedScore}
                <span style={{ fontSize: 16, fontWeight: 500, color: 'rgba(239,68,68,0.6)', marginLeft: 4 }}>
                  / {session.total} pct
                </span>
              </div>
              <div style={{ fontSize: 12, color: theme.text2, marginTop: 6 }}>
                {Math.round((session.penalizedScore / session.total) * 100)}% din punctajul maxim ·{' '}
                <span style={{ color: theme.text3 }}>+1 corect · −0.25/greșit</span>
              </div>
            </motion.div>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.38 }}
          className="rounded-[28px] p-5 mb-6 relative overflow-hidden"
          style={{
            background: `linear-gradient(180deg, ${theme.surface}, ${theme.surface2})`,
            border: `1px solid ${theme.border}`,
            boxShadow: '0 12px 34px rgba(0,0,0,0.12)',
          }}>
          <div
            className="absolute -top-10 right-0 w-40 h-40 rounded-full blur-3xl pointer-events-none"
            style={{ background: `${theme.accent}10` }}
          />
          <div className="relative">
            <div className="text-[11px] uppercase tracking-[0.18em] font-black mb-2" style={{ color: theme.accent }}>
              Smart Follow-Up
            </div>
            <h2 className="text-xl font-black tracking-tight mb-1" style={{ color: theme.text }}>{insightTitle}</h2>
            <p className="text-sm leading-relaxed mb-4 max-w-2xl" style={{ color: theme.text2 }}>{insightText}</p>
            <div className="grid sm:grid-cols-3 gap-2.5">
              <button
                onClick={() => launchFollowUp('flashcards')}
                disabled={!activeProfileId || followUpLoading !== null}
                className="rounded-2xl px-4 py-3 text-sm font-semibold text-left transition-all disabled:opacity-55"
                style={{ background: `${theme.warning}12`, border: `1px solid ${theme.warning}30`, color: theme.text }}>
                {followUpLoading === 'flashcards' ? 'Generez flashcards...' : 'Smart Flashcards'}
              </button>
              <button
                onClick={() => launchFollowUp('recovery')}
                disabled={!activeProfileId || followUpLoading !== null}
                className="rounded-2xl px-4 py-3 text-sm font-semibold text-left transition-all disabled:opacity-55"
                style={{ background: `${theme.success}10`, border: `1px solid ${theme.success}28`, color: theme.text }}>
                {followUpLoading === 'recovery' ? 'Construiesc sesiunea...' : 'Weakness Recovery'}
              </button>
              <button
                onClick={() => launchFollowUp('exam')}
                disabled={!activeProfileId || followUpLoading !== null}
                className="rounded-2xl px-4 py-3 text-sm font-semibold text-left transition-all disabled:opacity-55"
                style={{ background: `${theme.accent}10`, border: `1px solid ${theme.accent}28`, color: theme.text }}>
                {followUpLoading === 'exam' ? 'Pregătesc simularea...' : 'Adaptive Exam'}
              </button>
            </div>
          </div>
        </motion.div>

        {/* Question review */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="rounded-2xl p-5 mb-6"
          style={{ background: theme.surface, border: `1px solid ${theme.border}` }}>
          <h2 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: theme.text2 }}>
            <Star size={13} />Revizuire răspunsuri
          </h2>
          <div className="space-y-3">
            {questions.map((q, i) => {
              const userAnswerIds = session!.answers[q.id] ?? [];
              const correctIds = q.options.filter((o) => o.isCorrect).map((o) => o.id);
              const isCorrect =
                userAnswerIds.length === correctIds.length &&
                correctIds.every((id) => userAnswerIds.includes(id));

              const userAnswerTexts = userAnswerIds.map((id) => q.options.find((o) => o.id === id)?.text).filter(Boolean).join(', ');
              const correctTexts = q.options.filter((o) => o.isCorrect).map((o) => o.text).join(', ');

              return (
                <motion.div key={q.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + i * 0.04 }}
                  className="flex items-start gap-3 p-3 rounded-xl"
                  style={{ background: isCorrect ? `${theme.success}08` : `${theme.danger}08` }}>
                  <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center mt-0.5"
                    style={{ background: isCorrect ? `${theme.success}18` : `${theme.danger}18` }}>
                    {isCorrect
                      ? <Check size={12} style={{ color: theme.success }} />
                      : <X size={12} style={{ color: theme.danger }} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium mb-1" style={{ color: theme.text }}>
                      {i + 1}. {q.text}
                    </p>
                    {q.imageUrl && (
                      <img src={q.imageUrl} alt="Imagine întrebare"
                        className="max-h-28 object-contain rounded-xl mb-2"
                        style={{ border: `1px solid ${theme.border}` }} />
                    )}
                    {!isCorrect && userAnswerTexts && (
                      <p className="text-xs mb-0.5" style={{ color: theme.danger }}>
                        Răspunsul tău: {userAnswerTexts}
                      </p>
                    )}
                    {!isCorrect && (
                      <p className="text-xs" style={{ color: theme.success }}>
                        Corect: {correctTexts}
                      </p>
                    )}
                    {isCorrect && (
                      <p className="text-xs" style={{ color: theme.success }}>✓ {userAnswerTexts}</p>
                    )}
                    {q.explanation && (
                      <p className="text-xs mt-1" style={{ color: theme.text3 }}>
                        💡 {q.explanation}
                      </p>
                    )}
                    {/* AI Explainer — only for wrong answers */}
                    {!isCorrect && hasKey() && (
                      <div className="mt-2">
                        {!aiExplanations[q.id] ? (
                          <button
                            onClick={() => handleExplain(q, userAnswerTexts, correctTexts)}
                            disabled={aiLoading[q.id]}
                            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-all"
                            style={{
                              background: `${theme.accent}14`,
                              color: aiLoading[q.id] ? theme.text3 : theme.accent,
                              border: `1px solid ${theme.accent}30`,
                            }}>
                            {aiLoading[q.id]
                              ? <><Loader2 size={11} className="animate-spin" />Generez explicație...</>
                              : <><Bot size={11} />Explică cu AI</>}
                          </button>
                        ) : (
                          <AnimatePresence>
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              className="mt-1 p-2.5 rounded-xl text-xs leading-relaxed overflow-hidden"
                              style={{ background: `${theme.accent}0d`, border: `1px solid ${theme.accent}20`, color: theme.text2 }}>
                              <span className="font-semibold flex items-center gap-1 mb-1" style={{ color: theme.accent }}>
                                <Bot size={11} />Explicație AI
                              </span>
                              {aiExplanations[q.id]}
                            </motion.div>
                          </AnimatePresence>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* Actions */}
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }} className="space-y-2">
          {/* Primary: retry */}
          <Link to={`/play/${quiz.id}`}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-semibold text-white transition-all hover:opacity-90"
            style={{ background: `linear-gradient(135deg, ${theme.accent} 0%, ${theme.accent2} 100%)`, boxShadow: `0 6px 20px ${theme.accent}25` }}>
            <RotateCcw size={15} />
            Încearcă din nou
          </Link>
          {/* Secondary row */}
          <div className="grid grid-cols-3 gap-2">
            <Link to="/"
              className="flex items-center justify-center gap-1.5 py-3 rounded-xl font-medium text-sm transition-all hover:opacity-80"
              style={{ background: theme.surface, border: `1px solid ${theme.border}`, color: theme.text2 }}>
              <Home size={14} />Acasă
            </Link>
            <button onClick={exportResults}
              className="flex items-center justify-center gap-1.5 py-3 rounded-xl font-medium text-sm transition-all hover:opacity-80"
              style={{ background: theme.surface, border: `1px solid ${theme.border}`, color: theme.text2 }}>
              <Download size={14} />Export
            </button>
            <Link to={`/quiz/${quiz.id}`}
              className="flex items-center justify-center gap-1.5 py-3 rounded-xl font-medium text-sm transition-all hover:opacity-80"
              style={{ background: theme.surface, border: `1px solid ${theme.border}`, color: theme.text2 }}>
              <Trophy size={14} />Grilă
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
    </div>
  );
}
