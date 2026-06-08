import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { RotateCcw, Home, Check, X, Star, Download, Bot, Loader2, Scale, MessageSquare, BookOpen } from 'lucide-react';
import confetti from 'canvas-confetti';
import type { QuizSession, Question, QuestionStat } from '../types';
import { useQuizStore } from '../store/quizStore';
import { useStatsStore } from '../store/statsStore';
import { useTheme } from '../theme/ThemeContext';
import { useAIStore } from '../store/aiStore';
import { useUserStore } from '../store/userStore';
import { useUIStore } from '../store/uiStore';
import { useAdaptiveMotion } from '../hooks/useAdaptiveMotion';
import { buildClarificationFallback, getAnswerTextForOptionIds, getCorrectAnswerText } from '../helpers/quizAi';
import { explainWrongAnswer } from '../lib/groq';
import { buildAdaptiveExamQuiz, buildMistakeFlashcardQuiz, buildWeaknessRecoveryQuiz } from '../lib/adaptiveStudy';
import { syncProfileFromStats } from '../ai/UserProfile';

export default function QuizResults() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { quizzes, sessions, addQuiz } = useQuizStore();
  const theme = useTheme();
  const { calmMotion } = useAdaptiveMotion();
  // Hooks must be called unconditionally — before any early returns
  const { hasKey } = useAIStore();
  const { questionStats, getAccuracy } = useStatsStore();
  const activeProfileId = useUserStore((state) => state.activeProfileId);
  const setChatOpen = useUIStore((state) => state.setChatOpen);
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

  const fallbackSession = useMemo(() => {
    if (!id) return undefined;
    return sessions
      .filter((item) => item.quizId === id)
      .sort((left, right) => (right.finishedAt ?? right.startedAt) - (left.finishedAt ?? left.startedAt))[0];
  }, [id, sessions]);

  session = session ?? fallbackSession;

  const quiz = quizzes.find((q) => q.id === id);
  const questions = useMemo(() => orderedQuestions ?? quiz?.questions ?? [], [orderedQuestions, quiz?.questions]);
  const isAdaptiveExam = quiz?.tags?.includes('adaptive-exam') ?? false;
  const isRecoverySession = quiz?.tags?.includes('recovery') ?? false;
  const isMistakeDeck = quiz?.tags?.includes('mistake-bank') ?? false;
  const wrongEntries = useMemo(() => questions
    .map((question) => {
      const userAnswerIds = session?.answers[question.id] ?? [];
      const correctIds = question.options.filter((option) => option.isCorrect).map((option) => option.id);
      const isCorrect = userAnswerIds.length === correctIds.length && correctIds.every((entry) => userAnswerIds.includes(entry));
      return { question, isCorrect };
    })
    .filter((entry) => !entry.isCorrect), [questions, session?.answers]);

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

  useEffect(() => {
    if (!activeProfileId) return;
    // Citim direct din store (fără a crea array nou la fiecare render)
    // pentru a evita re-declanșarea useEffect la fiecare re-render
    const allQuestions = useQuizStore.getState().quizzes.flatMap((item) => item.questions);
    const currentStreak = useStatsStore.getState().streak.currentStreak;
    syncProfileFromStats(activeProfileId, questionStats, allQuestions, currentStreak);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProfileId, questionStats]);
  // quizzes exclus din deps — se citesc direct din store pentru a evita array nou la fiecare render

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
    } catch {
      setAiExplanations((p) => ({ ...p, [q.id]: buildClarificationFallback(q, userAnswerText, correctText) }));
    } finally {
      setAiLoading((p) => ({ ...p, [q.id]: false }));
    }
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
  };
  const openResultsDebrief = (prompt: string, mode: 'explain' | 'summarize' | 'test' = 'summarize') => {
    setChatOpen(true);
    window.dispatchEvent(new CustomEvent('studyx:ai-prompt', {
      detail: {
        open: true,
        mode,
        resetConversation: true,
        prompt,
      },
    }));
  };

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
          yourAnswer: getAnswerTextForOptionIds(q.options, userAnswers),
          correctAnswer: getCorrectAnswerText(q),
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
  const debriefPrompt = wrongEntries.length > 0
    ? `Fă-mi un debrief al sesiunii "${quiz.title}". Am obținut ${session.score}/${session.total} (${pct}%). Mă interesează mai ales unde am greșit și ce trebuie să corectez prioritar pentru examen.`
    : `Fă-mi un debrief scurt al sesiunii "${quiz.title}". Am obținut ${session.score}/${session.total} (${pct}%). Spune-mi ce am făcut bine și cum să păstrez nivelul.`;

  return (
    <div className="premium-shell h-full overflow-y-auto">
    <div className="min-h-full pt-6 pb-20 px-4 sm:px-6 relative z-10">
      <div className="max-w-3xl mx-auto shell-main-stage">

        {/* Score hero */}
        <motion.div initial={calmMotion ? { opacity: 0 } : { opacity: 0, scale: 0.8 }} animate={calmMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
          transition={calmMotion ? { duration: 0.18 } : { duration: 0.6, ease: [0.16, 1, 0.3, 1] }} className="editorial-hero luxe-card text-center mb-8 overflow-hidden rounded-[34px] sm:rounded-[38px] px-5 sm:px-6 py-7 sm:py-8">

          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
            transition={{ delay: 0.2, duration: 0.5, type: 'spring', stiffness: 200 }}
            className="text-6xl mb-4">{grade.emoji}</motion.div>

          <div className="secondary-label mb-2 font-black tracking-[0.22em]" style={{ color: theme.text3 }}>
            RAPORT SESIUNE
          </div>
          <h1 className="page-title-compact mb-2" style={{ color: theme.text }}>{grade.label}</h1>
          <p className="mb-6" style={{ color: theme.text2 }}>{quiz.title}</p>

          {/* Score ring */}
          <div className="relative w-32 h-32 sm:w-36 sm:h-36 mx-auto mb-6">
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
              <span className="metric-value" style={{ color: theme.text }}>{pct}%</span>
              <span className="text-xs" style={{ color: theme.text3 }}>scor</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 sm:flex sm:items-center sm:justify-center sm:gap-6">
            {[
              { val: session.score, label: 'Corecte', color: theme.success },
              null,
              ...(session.partialAnswers && session.partialAnswers.length > 0
                ? [{ val: session.partialAnswers.length, label: 'Parțiale', color: theme.warning }, null]
                : []),
              { val: session.total - session.score - (session.partialAnswers?.length ?? 0), label: 'Greșite', color: theme.danger },
              null,
              { val: formatTime(duration), label: 'Timp', color: theme.text },
            ].map((item, i) =>
              item === null
                ? <div key={i} className="hidden h-8 w-px sm:block" style={{ background: theme.border }} />
                : <div key={i} className="text-center">
                    <div className="section-title" style={{ color: (item as { val: number|string; label: string; color: string }).color }}>{(item as { val: number|string; label: string; color: string }).val}</div>
                    <div className="micro-copy" style={{ color: theme.text3 }}>{(item as { val: number|string; label: string; color: string }).label}</div>
                  </div>
            )}
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
            <span className="premium-chip rounded-full px-3 py-1 text-[11px] font-semibold" style={{ color: theme.text3 }}>
              {wrongEntries.length} greșeli de revizuit
            </span>
            {session.partialAnswers && session.partialAnswers.length > 0 && (
              <span className="premium-chip rounded-full px-3 py-1 text-[11px] font-semibold" style={{ color: theme.warning }}>
                {session.partialAnswers.length} parțiale — necesită consolidare
              </span>
            )}
            <span className="premium-chip rounded-full px-3 py-1 text-[11px] font-semibold" style={{ color: theme.text3 }}>
              {formatTime(duration)} durată
            </span>
            <span className="premium-chip rounded-full px-3 py-1 text-[11px] font-semibold" style={{ color: theme.text3 }}>
              {quiz.questions.length} întrebări în set
            </span>
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
          className="editorial-hero luxe-card rounded-[30px] p-5 mb-6 relative overflow-hidden"
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
              Continuă inteligent
            </div>
            <h2 className="text-xl font-black tracking-tight mb-1" style={{ color: theme.text }}>{insightTitle}</h2>
            <p className="text-sm leading-relaxed mb-4 max-w-2xl" style={{ color: theme.text2 }}>{insightText}</p>
            <div className="grid sm:grid-cols-3 gap-2.5">
              <button
                onClick={() => launchFollowUp('flashcards')}
                disabled={!activeProfileId || followUpLoading !== null}
                className="rounded-2xl px-4 py-3 text-sm font-semibold text-left transition-all disabled:opacity-55"
                style={{ background: `${theme.warning}12`, border: `1px solid ${theme.warning}30`, color: theme.text }}>
                {followUpLoading === 'flashcards' ? 'Generez flashcards...' : 'Flashcards din greșeli'}
              </button>
              <button
                onClick={() => launchFollowUp('recovery')}
                disabled={!activeProfileId || followUpLoading !== null}
                className="rounded-2xl px-4 py-3 text-sm font-semibold text-left transition-all disabled:opacity-55"
                style={{ background: `${theme.success}10`, border: `1px solid ${theme.success}28`, color: theme.text }}>
                {followUpLoading === 'recovery' ? 'Construiesc sesiunea...' : 'Recuperare puncte slabe'}
              </button>
              <button
                onClick={() => launchFollowUp('exam')}
                disabled={!activeProfileId || followUpLoading !== null}
                className="rounded-2xl px-4 py-3 text-sm font-semibold text-left transition-all disabled:opacity-55"
                style={{ background: `${theme.accent}10`, border: `1px solid ${theme.accent}28`, color: theme.text }}>
                {followUpLoading === 'exam' ? 'Pregătesc simularea...' : 'Simulare adaptivă'}
              </button>
            </div>
            {hasKey && (
              <button
                onClick={() => openResultsDebrief(debriefPrompt, wrongEntries.length > 0 ? 'explain' : 'summarize')}
                className="premium-card-hover press-feedback mt-4 inline-flex items-center gap-2 rounded-[18px] px-4 py-3 text-[11px] font-black uppercase tracking-[0.16em] text-white"
                style={{ background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})`, boxShadow: `0 14px 30px ${theme.accent}26` }}
              >
                <MessageSquare size={14} />
                Debrief cu AI Coach
              </button>
            )}
          </div>
        </motion.div>

        {/* Question review */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="luxe-card rounded-[30px] p-5 mb-6"
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

              const userAnswerTexts = getAnswerTextForOptionIds(q.options, userAnswerIds, '');
              const correctTexts = getCorrectAnswerText(q);

              return (
                <motion.div key={q.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + i * 0.04 }}
                  className="premium-card-hover flex items-start gap-3 p-4 rounded-[22px]"
                  style={{
                    background: isCorrect ? `${theme.success}08` : `${theme.danger}08`,
                    border: `1px solid ${isCorrect ? `${theme.success}20` : `${theme.danger}20`}`,
                  }}>
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
          {!isCorrect && (
                      <div className="mt-2">
                        <div className="flex flex-wrap gap-2">
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
                                : <><Bot size={11} />{hasKey ? 'Explică cu AI' : 'Explică smart'}</>}
                            </button>
                          ) : (
                            <AnimatePresence>
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                className="mt-1 p-2.5 rounded-xl text-xs leading-relaxed overflow-hidden"
                                style={{ background: `${theme.accent}0d`, border: `1px solid ${theme.accent}20`, color: theme.text2 }}>
                                <span className="font-semibold flex items-center gap-1 mb-1" style={{ color: theme.accent }}>
                                  <Bot size={11} />{hasKey ? 'Explicație AI' : 'Explicație ghidată'}
                                </span>
                                {aiExplanations[q.id]}
                              </motion.div>
                            </AnimatePresence>
                          )}

                          <button
                            onClick={() => openResultsDebrief(
                              `Explică-mi pe scurt de ce am greșit întrebarea: "${q.text}". Răspunsul meu a fost "${userAnswerTexts || 'niciun răspuns'}", iar răspunsul corect este "${correctTexts}". Dă-mi și o regulă scurtă de reținut.`,
                              'explain',
                            )}
                            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all"
                            style={{
                              background: `${theme.accent2}12`,
                              color: theme.accent2,
                              border: `1px solid ${theme.accent2}28`,
                            }}
                          >
                            <MessageSquare size={11} />
                            Continuă în chat
                          </button>
                        </div>
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
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
              <BookOpen size={14} />Detalii
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
    </div>
  );
}
