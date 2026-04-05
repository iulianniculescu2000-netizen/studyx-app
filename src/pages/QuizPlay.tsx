import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Clock, BookOpen, Layers, Keyboard, Zap, GraduationCap, StickyNote, Sparkles, Loader2 } from 'lucide-react';
import { useQuizStore } from '../store/quizStore';
import { useStatsStore } from '../store/statsStore';
import { useNotesStore } from '../store/notesStore';
import { useAIStore } from '../store/aiStore';
import { useUserStore } from '../store/userStore';
import { useFocusModeStore } from '../store/focusModeStore';
import { useTheme } from '../theme/ThemeContext';
import QuizImage from '../components/QuizImage';
import type { QuizSession, Question, Option } from '../types';
import type { AIAnalysisResult, HintResult } from '../ai/types';

const loadAIEngine = () => import('../ai/AIEngine');

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function QuizPlay() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const performanceLite = typeof document !== 'undefined'
    && document.documentElement.getAttribute('data-performance') === 'lite';
  const calmMotion = reduceMotion || performanceLite;
  const { quizzes, addSession } = useQuizStore();
  const { recordAnswer, recordStudySession } = useStatsStore();
  const setNote = useNotesStore((s) => s.setNote);
  const { hasKey } = useAIStore();
  const activeProfileId = useUserStore((s) => s.activeProfileId);
  const quiz = quizzes.find((q) => q.id === id);
  const state = location.state as { mode?: string; wrongQuestionsOnly?: string[] } | null;
  const examMode = state?.mode === 'exam';
  const timedMode = state?.mode === 'timed';
  const wrongQuestionsOnly = state?.wrongQuestionsOnly;
  const TIME_PER_Q = 30; // seconds

  // Build shuffled question/option order once
  const orderedQuestions = useMemo<Question[]>(() => {
    if (!quiz) return [];
    let qs = quiz.shuffleQuestions ? shuffle(quiz.questions) : [...quiz.questions];
    if (wrongQuestionsOnly && wrongQuestionsOnly.length > 0) {
      qs = qs.filter(q => wrongQuestionsOnly.includes(q.id));
    }
    if (quiz.shuffleAnswers) {
      return qs.map((q) => ({ ...q, options: shuffle(q.options) }));
    }
    return qs;
  }, [quiz, wrongQuestionsOnly]);

  const [currentIdx, setCurrentIdx] = useState(0);
  const [questionQueue, setQuestionQueue] = useState<Question[]>(orderedQuestions);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [selectedNow, setSelectedNow] = useState<string[]>([]); // for current question
  const [revealed, setRevealed] = useState(false);
  const [shakeId, setShakeId] = useState<string | null>(null);
  const [feedbackAnim, setFeedbackAnim] = useState<'correct' | 'wrong' | null>(null);
  const [startedAt] = useState(Date.now());
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [showKeys, setShowKeys] = useState(false);
  const [autoAdvance, setAutoAdvance] = useState(false);
  const [questionTimer, setQuestionTimer] = useState(TIME_PER_Q);
  const [aiText, setAiText] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const aiAbortRef = useRef<AbortController | null>(null);
  const [mnemonicText, setMnemonicText] = useState<string | null>(null);
  const [mnemonicLoading, setMnemonicLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AIAnalysisResult | null>(null);
  const [analysisQuestionId, setAnalysisQuestionId] = useState<string | null>(null);
  const [nextTopicHint, setNextTopicHint] = useState<string | null>(null);
  const [hintLevel, setHintLevel] = useState(0); // 0: none, 1: light, 2: medium, 3: full
  const [hintData, setHintData] = useState<HintResult | null>(null);
  const [hintLoading, setHintLoading] = useState(false);
  const [showSmartNudge, setShowSmartNudge] = useState(false);

  const question = questionQueue[currentIdx];
  const isLast = currentIdx === questionQueue.length - 1;
  const answeredCount = Object.keys(answers).length;
  const progress = questionQueue.length > 0 ? (answeredCount / questionQueue.length) * 100 : 0;
  const isMultiple = question?.multipleCorrect ?? false;
  const currentNote = useNotesStore((s) => (question ? (s.notes[question.id] ?? '') : ''));

  const { focusMode, toggleFocusMode } = useFocusModeStore();

  const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  // Smart nudge logic: if user is stuck for >12s, pulse the hint button
  useEffect(() => {
    if (revealed || examMode || hintLevel > 0) {
      setShowSmartNudge(false);
      return;
    }
    const timer = setTimeout(() => setShowSmartNudge(true), 12000);
    return () => clearTimeout(timer);
  }, [currentIdx, revealed, examMode, hintLevel]);

  const handleGetHint = useCallback(async () => {
    if (!question || !activeProfileId || hintLoading || hintLevel >= 3) return;
    
    if (hintLevel > 0 && hintData) {
      setHintLevel(prev => prev + 1);
      return;
    }

    setHintLoading(true);
    try {
      const { generateHint } = await loadAIEngine();
      const result = await generateHint(question);
      setHintData(result);
      setHintLevel(1);
    } catch {
      // Fallback
    } finally {
      setHintLoading(false);
    }
  }, [question, activeProfileId, hintLoading, hintLevel, hintData]);

  useEffect(() => {
    setQuestionQueue(orderedQuestions);
    setCurrentIdx(0);
    setAnswers({});
    setSelectedNow([]);
    setRevealed(false);
    setAnalysisResult(null);
    setAnalysisQuestionId(null);
    setNextTopicHint(null);
  }, [orderedQuestions]);

  useEffect(() => {
    setHintLevel(0);
    setHintData(null);
  }, [currentIdx]);

  useEffect(() => {
    const timer = setInterval(() => setTimeElapsed((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  // Per-question countdown in timed mode
  useEffect(() => {
    if (!timedMode || revealed) return;
    setQuestionTimer(TIME_PER_Q);
    const timer = setInterval(() => setQuestionTimer((t) => {
      if (t <= 1) { clearInterval(timer); return 0; }
      return t - 1;
    }), 1000);
    return () => clearInterval(timer);
  }, [currentIdx, timedMode, revealed]);

  const finishQuiz = useCallback((finalAnswers: Record<string, string[]>) => {
    const score = questionQueue.filter((q) => {
      const userAnswers = finalAnswers[q.id] ?? [];
      const correctIds = q.options.filter((o) => o.isCorrect).map((o) => o.id);
      return userAnswers.length === correctIds.length && correctIds.every((id) => userAnswers.includes(id));
    }).length;
    questionQueue.forEach((q) => {
      const userAnswers = finalAnswers[q.id] ?? [];
      const correctIds = q.options.filter((o) => o.isCorrect).map((o) => o.id);
      const isCorrect = userAnswers.length === correctIds.length && correctIds.every((id) => userAnswers.includes(id));
      recordAnswer(quiz!.id, q.id, isCorrect);
    });
    const duration = Math.floor((Date.now() - startedAt) / 1000);
    recordStudySession(duration);

    // ── Rezidențiat penalty scoring ──────────────────────────────────────────
    // +1 per fully correct answer, -0.25 per wrong option selected.
    // Only active when quiz.penaltyMode is true. Score net is clamped to ≥ 0.
    let penalizedScore: number | undefined;
    if (quiz!.penaltyMode) {
      let netPoints = 0;
      questionQueue.forEach((q) => {
        const userAnswers = finalAnswers[q.id] ?? [];
        if (userAnswers.length === 0) return; // unanswered: no points, no penalty
        const correctIds = q.options.filter((o) => o.isCorrect).map((o) => o.id);
        const allCorrect =
          userAnswers.length === correctIds.length &&
          correctIds.every((id) => userAnswers.includes(id));
        if (allCorrect) {
          netPoints += 1;
        } else {
          const wrongSelected = userAnswers.filter((id) => !correctIds.includes(id)).length;
          netPoints -= wrongSelected * 0.25;
        }
      });
      penalizedScore = Math.max(0, Math.round(netPoints * 100) / 100);
    }

    const session: QuizSession = {
      id: crypto.randomUUID().replace(/-/g, '').slice(0, 12),
      quizId: quiz!.id,
      answers: finalAnswers,
      startedAt,
      finishedAt: Date.now(),
      score,
      total: questionQueue.length,
      mode: examMode ? 'exam' : timedMode ? 'test' : 'study',
      ...(penalizedScore !== undefined ? { penalizedScore } : {}),
    };
    addSession(session);
    navigate(`/results/${quiz!.id}`, { state: { session, orderedQuestions: questionQueue } });
  }, [questionQueue, quiz, startedAt, addSession, navigate, recordAnswer, recordStudySession, examMode, timedMode]);

  const handleSkipQuestion = useCallback(() => {
    // Skip is only meaningful in study mode before revealing the answer.
    if (examMode || timedMode || revealed || questionQueue.length <= 1 || isLast) return;
    setAiText(null);
    setAiLoading(false);
    setMnemonicText(null);
    setMnemonicLoading(false);
    setAnalysisResult(null);
    setAnalysisQuestionId(null);
    setNextTopicHint(null);
    setHintLevel(0);
    setHintData(null);
    setQuestionQueue((prev) => {
      const next = [...prev];
      const [skipped] = next.splice(currentIdx, 1);
      next.push(skipped);
      return next;
    });
    setSelectedNow([]);
    setRevealed(false);
  }, [examMode, timedMode, revealed, questionQueue.length, isLast, currentIdx]);

  const handleSelect = useCallback((optId: string) => {
    if (revealed) return;
    if (isMultiple) {
      setSelectedNow((prev) =>
        prev.includes(optId) ? prev.filter((id) => id !== optId) : [...prev, optId]
      );
    } else {
      setSelectedNow([optId]);
      const newAnswers = { ...answers, [question.id]: [optId] };
      setAnswers(newAnswers);
      if (examMode) {
        if (isLast) finishQuiz(newAnswers);
        else { setCurrentIdx((i) => i + 1); setSelectedNow([]); }
      } else {
        setRevealed(true);
        const isCorrect = question.options.find((o) => o.id === optId)?.isCorrect;
        if (isCorrect) {
          setFeedbackAnim('correct');
          setTimeout(() => setFeedbackAnim(null), 400);
        } else {
          setFeedbackAnim('wrong');
          setTimeout(() => setFeedbackAnim(null), 450);
          setShakeId(optId);
          setTimeout(() => setShakeId(null), 600);
        }
      }
    }
  }, [revealed, isMultiple, question, answers, examMode, isLast, finishQuiz]);

  const confirmMultiple = useCallback(() => {
    if (selectedNow.length === 0) return;
    const newAnswers = { ...answers, [question.id]: selectedNow };
    setAnswers(newAnswers);
    if (examMode) {
      if (isLast) finishQuiz(newAnswers);
      else { setCurrentIdx((i) => i + 1); setSelectedNow([]); }
    } else {
      setRevealed(true);
      const correctIdsForQuestion = question.options.filter((option) => option.isCorrect).map((option) => option.id);
      const isCorrect = selectedNow.length === correctIdsForQuestion.length && correctIdsForQuestion.every((currentId) => selectedNow.includes(currentId));
      if (isCorrect) {
        setFeedbackAnim('correct');
        setTimeout(() => setFeedbackAnim(null), 400);
      } else {
        setFeedbackAnim('wrong');
        setTimeout(() => setFeedbackAnim(null), 450);
      }
    }
  }, [selectedNow, question, answers, examMode, isLast, finishQuiz]);

  const handleNext = useCallback(() => {
    // Cancel any in-progress AI explanation
    aiAbortRef.current?.abort();
    aiAbortRef.current = null;
    setAiText(null);
    setAiLoading(false);
    setMnemonicText(null);
    setMnemonicLoading(false);
    setAnalysisResult(null);
    setAnalysisQuestionId(null);
    setNextTopicHint(null);
    setHintLevel(0);
    setHintData(null);
    if (isLast) {
      finishQuiz(answers);
    } else {
      setCurrentIdx((i) => i + 1);
      setSelectedNow([]);
      setRevealed(false);
    }
  }, [isLast, answers, finishQuiz]);

  const handleAIExplain = useCallback(async () => {
    if (!question || aiLoading || !activeProfileId) return;
    if (analysisResult?.explanation) {
      setAiText(analysisResult.explanation);
      return;
    }
    setAiLoading(true);
    try {
      const { analyzeAnswer } = await loadAIEngine();
      const currentAnswers = answers[question.id] ?? selectedNow;
      const userAnswer = question.options.filter((option) => currentAnswers.includes(option.id)).map((option) => option.text).join(', ');
      const correctAnswer = question.options.filter((option) => option.isCorrect).map((option) => option.text).join(', ');
      const correctIdsForQuestion = question.options.filter((option) => option.isCorrect).map((option) => option.id);
      const isCorrect = currentAnswers.length === correctIdsForQuestion.length && correctIdsForQuestion.every((currentId) => currentAnswers.includes(currentId));
      const { analysis } = await analyzeAnswer(activeProfileId, { question, userAnswer, correctAnswer, isCorrect });
      setAnalysisResult(analysis);
      setAnalysisQuestionId(question.id);
      setAiText(analysis.explanation);
    } catch {
      setAiText('Nu s-a putut genera explicația. Verifică cheia API în Setări.');
    } finally {
      setAiLoading(false);
    }
  }, [question, aiLoading, activeProfileId, analysisResult, answers, selectedNow]);

  useEffect(() => {
    if (!revealed || examMode || !question || !activeProfileId || analysisQuestionId === question.id) return;
    const currentAnswers = answers[question.id] ?? selectedNow;
    if (currentAnswers.length === 0) return;
    const userAnswer = question.options.filter((option) => currentAnswers.includes(option.id)).map((option) => option.text).join(', ');
    const correctIdsForQuestion = question.options.filter((option) => option.isCorrect).map((option) => option.id);
    const correctAnswer = question.options.filter((option) => option.isCorrect).map((option) => option.text).join(', ');
    const isCorrect = currentAnswers.length === correctIdsForQuestion.length && correctIdsForQuestion.every((currentId) => currentAnswers.includes(currentId));
    let cancelled = false;

    setAiLoading(true);
    loadAIEngine()
      .then(({ analyzeAnswer, WeaknessAnalyzer, getNextQuestion }) =>
        analyzeAnswer(activeProfileId, { question, userAnswer, correctAnswer, isCorrect })
          .then(({ analysis, profile }) => ({ analysis, profile, WeaknessAnalyzer, getNextQuestion }))
      )
      .then((result) => {
        if (!result || cancelled) return;
        const { profile, WeaknessAnalyzer, getNextQuestion, analysis } = result;
        setAnalysisResult(analysis);
        setAnalysisQuestionId(question.id);
        if (!isCorrect) setAiText(analysis.explanation);
        const weakTopics = WeaknessAnalyzer.getWeakTopics(profile.profileId);
        const suggestion = getNextQuestion({
          previousQuestions: profile.recentQuestions,
          weakTopics,
          recentMistakes: profile.recentMistakes,
          accuracy: profile.globalAccuracy,
          streak: profile.streak,
          availableTime: profile.availableTime,
          preferredDifficulty: profile.currentDifficulty,
        });
        setNextTopicHint(suggestion.topic);
      })
      .catch(() => {
        if (!cancelled) setAiText((prev) => prev ?? 'Nu s-a putut genera analiza AI.');
      })
      .finally(() => {
        if (!cancelled) setAiLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [revealed, examMode, question, activeProfileId, analysisQuestionId, answers, selectedNow]);

  // Auto-advance after reveal
  useEffect(() => {
    if (!revealed || !autoAdvance || examMode || aiLoading || mnemonicLoading) return;
    const t = setTimeout(handleNext, 2000);
    return () => clearTimeout(t);
  }, [revealed, autoAdvance, handleNext, examMode, aiLoading, mnemonicLoading]);

  // Timed mode: auto-advance when timer expires (no answer = wrong)
  useEffect(() => {
    if (!timedMode || revealed || questionTimer > 0) return;
    const newAnswers = { ...answers, [question?.id ?? '']: [] };
    setAnswers(newAnswers);
    setSelectedNow([]);
    if (isLast) finishQuiz(newAnswers);
    else setCurrentIdx(i => i + 1);
  }, [questionTimer, timedMode, revealed, answers, question, isLast, finishQuiz]);

  // Maintain latest state for keyboard handler without re-binding listener
  const kbStateRef = useRef({ question, handleSelect, confirmMultiple, handleNext, handleGetHint, isMultiple, revealed, examMode });
  useEffect(() => {
    kbStateRef.current = { question, handleSelect, confirmMultiple, handleNext, handleGetHint, isMultiple, revealed, examMode };
  });

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const state = kbStateRef.current;
      if (
        document.activeElement instanceof HTMLInputElement || 
        document.activeElement instanceof HTMLTextAreaElement ||
        document.activeElement?.hasAttribute('contenteditable')
      ) return;

      // 1-4 or A-D to select option
      const keyMap: Record<string, number> = { '1': 0, '2': 1, '3': 2, '4': 3, 'a': 0, 'b': 1, 'c': 2, 'd': 3 };
      const idx = keyMap[e.key.toLowerCase()];
      if (idx !== undefined && state.question?.options[idx]) {
        state.handleSelect(state.question.options[idx].id);
      }
      // Enter or Space to confirm/next
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (state.isMultiple && !state.revealed) { state.confirmMultiple(); }
        else if (state.revealed) { state.handleNext(); }
      }
      // 'H' for Hint
      if (e.key.toLowerCase() === 'h' && !state.revealed && !state.examMode) {
        state.handleGetHint();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  if (!quiz || !question) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="mb-4" style={{ color: theme.text2 }}>Grila nu a fost găsită.</p>
          <Link to="/quizzes" style={{ color: theme.accent }}>Înapoi la grile</Link>
        </div>
      </div>
    );
  }

  const correctIds = question.options.filter((o) => o.isCorrect).map((o) => o.id);

  const getOptionStyle = (optId: string): React.CSSProperties => {
    const isSelected = selectedNow.includes(optId);
    const isCorrect = correctIds.includes(optId);
    if (!revealed) {
      if (isSelected) return { 
        background: `${theme.accent}25`, 
        border: `2px solid ${theme.accent}`,
        boxShadow: `0 8px 24px ${theme.accent}20`,
        transform: 'translateY(-1px)'
      };
      return { background: theme.surface, border: `1px solid ${theme.border}` };
    }
    if (isCorrect) return { 
      background: `${theme.success}12`, 
      border: `2px solid ${theme.success}`,
      boxShadow: `0 8px 24px ${theme.success}15`
    };
    if (isSelected && !isCorrect) return { 
      background: `${theme.danger}12`, 
      border: `2px solid ${theme.danger}`,
      boxShadow: `0 8px 24px ${theme.danger}15`
    };
    return { background: theme.surface, border: `1px solid ${theme.border}`, opacity: 0.4, filter: 'grayscale(0.5)' };
  };

  const getOptionTextColor = (optId: string) => {
    if (!revealed) return selectedNow.includes(optId) ? theme.text : theme.text;
    if (correctIds.includes(optId)) return theme.success;
    if (selectedNow.includes(optId)) return theme.danger;
    return theme.text3;
  };

  const difficultyColor = { easy: theme.success, medium: theme.warning, hard: theme.danger };
  const difficultyLabel = { easy: 'Ușor', medium: 'Mediu', hard: 'Dificil' };

  return (
    <div className="h-full overflow-y-auto relative">
      {/* Dark overlay for Focus Mode */}
      <AnimatePresence>
        {focusMode && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-0 bg-black/40 pointer-events-none"
            style={{ backdropFilter: calmMotion ? 'none' : 'blur(2px)' }}
          />
        )}
      </AnimatePresence>

      {/* Top thin progress bar */}
      <div className="fixed top-0 left-0 w-full h-1 z-[100] pointer-events-none" style={{ background: `${theme.accent}10` }}>
        <motion.div 
          className="h-full"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: calmMotion ? 0.24 : 0.6, ease: [0.23, 1, 0.32, 1] }}
          style={{ background: `linear-gradient(90deg, ${theme.accent}, ${theme.accent2})`, boxShadow: `0 0 10px ${theme.accent}60` }}
        />
      </div>

    <div className="min-h-full pt-6 pb-10 px-6 relative z-10 flex flex-col">
      {/* Top bar */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl mx-auto w-full mb-6">
        <div className="flex items-center justify-between mb-4">
          <Link to={`/quiz/${quiz.id}`}
            className="flex items-center gap-1.5 text-sm transition-all hover:opacity-80"
            style={{ color: theme.text3 }}>
            <ChevronLeft size={15} />{quiz.title}
          </Link>
          <div className="flex items-center gap-3">
            {examMode && (
              <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ background: `${theme.danger}18`, color: theme.danger }}>
                <GraduationCap size={10} />Examen
              </span>
            )}
            {timedMode && (
              <span className="flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full font-bold tabular-nums"
                style={{
                  background: questionTimer <= 10 ? `${theme.danger}22` : `${theme.warning}18`,
                  color: questionTimer <= 10 ? theme.danger : theme.warning,
                  border: `1px solid ${questionTimer <= 10 ? theme.danger + '40' : theme.warning + '30'}`,
                }}>
                <Clock size={10} />{questionTimer}s
              </span>
            )}
            {!examMode && (
              <button onClick={() => setAutoAdvance(!autoAdvance)}
                title={autoAdvance ? 'Dezactivează auto-avansare' : 'Activează auto-avansare (1.5s)'}
                className="flex items-center gap-1 text-xs transition-all hover:opacity-80"
                style={{ color: autoAdvance ? theme.accent : theme.text3 }}>
                <Zap size={13} fill={autoAdvance ? theme.accent : 'none'} />
              </button>
            )}
            {!examMode && !timedMode && !revealed && (
              <button
                onClick={handleSkipQuestion}
                disabled={isLast || questionQueue.length <= 1}
                title="Sari peste această întrebare și revino la final"
                className="flex items-center gap-1 text-xs transition-all hover:opacity-80 disabled:opacity-40"
                style={{ color: theme.warning }}
              >
                <ChevronRight size={13} />
                Skip
              </button>
            )}
            <button onClick={() => setShowKeys(!showKeys)}
              className="flex items-center gap-1 text-xs transition-all hover:opacity-80"
              style={{ color: theme.text3 }}>
              <Keyboard size={13} />
            </button>
            <button onClick={toggleFocusMode}
              title={focusMode ? 'Ieși din Modul Focus' : 'Intră în Modul Focus'}
              className="flex items-center gap-1 text-xs transition-all hover:opacity-80"
              style={{ color: focusMode ? theme.accent : theme.text3 }}>
              <Zap size={13} fill={focusMode ? theme.accent : 'none'} />
            </button>
            <div className="flex items-center gap-1.5 text-sm" style={{ color: theme.text3 }}>
              <Clock size={13} />{formatTime(timeElapsed)}
            </div>
            <div className="flex items-center gap-1.5 text-sm" style={{ color: theme.text3 }}>
              <BookOpen size={13} />{currentIdx + 1}/{questionQueue.length}
            </div>
          </div>
        </div>

        {/* Progress */}
        <div className="h-1 rounded-full overflow-hidden" style={{ background: theme.surface2 }}>
          <motion.div className="h-full rounded-full"
            style={{ background: `linear-gradient(90deg, ${theme.accent}, ${theme.accent2})` }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          />
        </div>

        {/* Keyboard hint */}
        <AnimatePresence>
          {showKeys && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3 p-3 rounded-xl text-xs flex flex-wrap gap-3"
              style={{ background: theme.surface, border: `1px solid ${theme.border}`, color: theme.text3 }}>
              {['1-4 / A-D: selectează opțiune', 'Enter / Space: confirmare / următor'].map((hint) => (
                <span key={hint} className="font-mono">{hint}</span>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Question */}
      <div className="max-w-2xl mx-auto w-full flex-1 flex flex-col">
        <AnimatePresence mode="wait">
          <motion.div key={`${question.id}-${currentIdx}`}
            initial={calmMotion ? { opacity: 0 } : { opacity: 0, x: 50, scale: 0.98 }}
            animate={calmMotion ? { opacity: 1 } : { opacity: 1, x: 0, scale: 1 }}
            exit={calmMotion ? { opacity: 0 } : { opacity: 0, x: -50, scale: 0.98 }}
            transition={calmMotion
              ? { duration: 0.18 }
              : {
                  type: "spring",
                  stiffness: 350,
                  damping: 30,
                  opacity: { duration: 0.2 }
                }}
            className={`flex-1 flex flex-col ${feedbackAnim === 'wrong' ? 'anim-shake' : feedbackAnim === 'correct' ? 'anim-bounce' : ''}`}
          >
            {/* Question card */}
            <div className="rounded-3xl p-6 mb-5"
              style={{ background: theme.surface, border: `1px solid ${theme.border}` }}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: theme.accent }}>
                  Întrebarea {currentIdx + 1}
                </span>
                {isMultiple && (
                  <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
                    style={{ background: `${theme.accent2}18`, color: theme.accent2 }}>
                    <Layers size={10} />Multi-select
                  </span>
                )}
                {question.difficulty && (
                  <span className="text-xs px-2 py-0.5 rounded-full"
                    style={{ background: `${difficultyColor[question.difficulty]}18`, color: difficultyColor[question.difficulty] }}>
                    {difficultyLabel[question.difficulty]}
                  </span>
                )}
              </div>
              <p className="text-xl font-semibold leading-snug" style={{ color: theme.text }}>{question.text}</p>

              {/* Question image */}
              {question.imageUrl && (
                <div className="mt-4">
                  <QuizImage src={question.imageUrl} maxHeight={260} />
                </div>
              )}

              {isMultiple && !revealed && (
                <p className="text-sm mt-2" style={{ color: theme.text3 }}>
                  Selectează toate răspunsurile corecte, apoi apasă "Confirmă"
                </p>
              )}
            </div>

            {/* AI Hint Button (Premium & Smart) */}
            {!revealed && !examMode && hasKey() && (
              <div className="mb-5">
                <AnimatePresence mode="wait">
                  {hintLevel === 0 ? (
                    <motion.button
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ 
                        opacity: 1, 
                        y: 0,
                        scale: showSmartNudge && !calmMotion ? [1, 1.05, 1] : 1,
                      }}
                      transition={showSmartNudge && !calmMotion
                        ? { scale: { repeat: Infinity, duration: 2, ease: "easeInOut" } }
                        : { duration: 0.18 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      onClick={handleGetHint}
                      disabled={hintLoading}
                      className="group relative flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all overflow-hidden"
                      style={{ 
                        background: theme.surface, 
                        border: `1px solid ${showSmartNudge ? theme.accent : theme.border}`,
                        color: theme.accent,
                        boxShadow: showSmartNudge ? `0 0 20px ${theme.accent}30` : `0 4px 12px ${theme.accent}10`
                      }}
                      whileHover={calmMotion ? undefined : { scale: 1.02, boxShadow: `0 6px 20px ${theme.accent}30` }}
                      whileTap={calmMotion ? undefined : { scale: 0.98 }}
                    >
                      {/* Premium Shimmer Effect */}
                      {!calmMotion && (
                        <motion.div 
                          className="absolute inset-0 z-0"
                          animate={{ x: ['-100%', '200%'] }}
                          transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
                          style={{ 
                            background: `linear-gradient(90deg, transparent, ${theme.accent}15, transparent)`,
                            width: '50%'
                          }}
                        />
                      )}

                      <div className="relative z-10 flex items-center gap-2">
                        {hintLoading ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <Sparkles size={13} className={showSmartNudge ? "animate-pulse" : ""} />
                        )}
                        <span>{hintLoading ? 'Analizez...' : 'Indiciu AI'}</span>
                        <span className="ml-1 font-mono text-[9px] border border-current px-1 rounded" style={{ color: theme.text3 }}>H</span>
                      </div>
                    </motion.button>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      className="p-4 rounded-[24px] relative overflow-hidden glass-panel"
                      style={{ 
                        background: `${theme.accent}08`, 
                        border: `1px solid ${theme.accent}25`,
                        boxShadow: `0 8px 32px ${theme.accent}10`
                      }}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Sparkles size={14} style={{ color: theme.accent }} />
                          <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: theme.accent }}>
                            Indiciu AI • Nivel {hintLevel}/3
                          </span>
                        </div>
                        {hintLevel < 3 && (
                          <button 
                            onClick={handleGetHint}
                            className="text-[10px] font-bold px-2 py-1 rounded-lg transition-all hover:opacity-80"
                            style={{ background: `${theme.accent}15`, color: theme.accent }}>
                            + Mai mult
                          </button>
                        )}
                      </div>
                      <p className="text-sm font-medium leading-relaxed italic" style={{ color: theme.text }}>
                        "{hintLevel === 1 ? hintData?.light : hintLevel === 2 ? hintData?.medium : hintData?.full}"
                      </p>
                      
                      {/* Subtle decorative glow */}
                      <div className="absolute -right-10 -top-10 w-32 h-32 rounded-full blur-[60px] opacity-20"
                        style={{ background: theme.accent }} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Options */}
            <div className="space-y-2.5 mb-5">
              {question.options.map((opt: Option, i: number) => (
                <motion.button key={opt.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={
                    shakeId === opt.id
                      ? { x: [0, -10, 10, -8, 8, -4, 4, 0], opacity: 1, y: 0 }
                      : (revealed && correctIds.includes(opt.id))
                        ? { opacity: 1, y: 0, scale: [1, 1.05, 1] }
                        : { opacity: 1, y: 0 }
                  }
                  transition={shakeId === opt.id
                    ? { duration: 0.3, ease: 'easeInOut' }
                    : (revealed && correctIds.includes(opt.id))
                      ? { duration: 0.6, repeat: 0 }
                      : { delay: i * 0.05 }}
                  onClick={() => handleSelect(opt.id)}
                  disabled={revealed && !isMultiple}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl text-left transition-all"
                  style={getOptionStyle(opt.id)}
                  whileHover={!revealed && !calmMotion ? { scale: 1.01 } : {}}
                  whileTap={!revealed && !calmMotion ? { scale: 0.99 } : {}}
                >
                  {/* Checkbox/Radio */}
                  <div className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold border-2 transition-all"
                    style={{
                      borderColor: (revealed && correctIds.includes(opt.id)) ? theme.success : (selectedNow.includes(opt.id) ? (revealed ? theme.danger : theme.accent) : theme.border2),
                      background: (revealed && correctIds.includes(opt.id)) ? `${theme.success}20` : (selectedNow.includes(opt.id) ? (revealed ? `${theme.danger}20` : `${theme.accent}20`) : 'transparent'),
                      color: getOptionTextColor(opt.id),
                    }}>
                    {revealed && correctIds.includes(opt.id) 
                      ? '✓' 
                      : (selectedNow.includes(opt.id) 
                          ? (revealed ? '✗' : (isMultiple ? '✓' : String.fromCharCode(65 + i))) 
                          : String.fromCharCode(65 + i))}
                  </div>
                  <span className="text-sm font-medium" style={{ color: getOptionTextColor(opt.id) }}>
                    {opt.text}
                  </span>
                  {/* Keyboard hint badge */}
                  {!revealed && (
                    <span className="ml-auto text-xs font-mono rounded px-1.5 py-0.5 flex-shrink-0"
                      style={{ background: theme.surface2, color: theme.text3 }}>
                      {i + 1}
                    </span>
                  )}
                </motion.button>
              ))}
            </div>

            {/* Confirm button for multi-select */}
            <AnimatePresence>
              {isMultiple && !revealed && (
                <motion.button
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  onClick={confirmMultiple}
                  disabled={selectedNow.length === 0}
                  className="w-full py-3.5 rounded-2xl font-semibold text-white mb-4 disabled:opacity-30 transition-all hover:opacity-90"
                  style={{ background: `linear-gradient(135deg, ${theme.accent2} 0%, ${theme.accent} 100%)` }}
                  whileHover={calmMotion ? undefined : { scale: 1.01 }}
                  whileTap={calmMotion ? undefined : { scale: 0.98 }}
                >
                  Confirmă selecția ({selectedNow.length} {selectedNow.length === 1 ? 'ales' : 'alese'})
                </motion.button>
              )}
            </AnimatePresence>

            {/* Explanation */}
            <AnimatePresence>
              {revealed && !examMode && question.explanation && (
                <motion.div
                  initial={{ opacity: 0, y: 10, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-4 p-4 rounded-2xl overflow-hidden"
                  style={{ background: `${theme.accent}0C`, border: `1px solid ${theme.accent}25` }}
                >
                  <p className="text-sm" style={{ color: theme.text2 }}>
                    <span className="font-semibold" style={{ color: theme.accent }}>💡 Explicație: </span>
                    {question.explanation}
                  </p>
                  {autoAdvance && (
                    <div className="mt-3 h-0.5 rounded-full overflow-hidden" style={{ background: theme.surface2 }}>
                      <motion.div className="h-full rounded-full"
                        initial={{ width: '0%' }} animate={{ width: '100%' }}
                        transition={{ duration: 1.5, ease: 'linear' }}
                        style={{ background: theme.accent }} />
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* AI inline explanation */}
            <AnimatePresence mode="wait">
              {revealed && !examMode && hasKey() && (
                <motion.div
                  initial={{ opacity: 0, y: 15, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
                  className="mb-4"
                >
                  {aiText === null ? (
                    <button
                      onClick={handleAIExplain}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all hover:opacity-80"
                      style={{
                        background: `${theme.accent2}15`,
                        border: `1px solid ${theme.accent2}30`,
                        color: theme.accent2,
                      }}
                    >
                      <Sparkles size={12} />
                      Explică AI
                    </button>
                  ) : (
                    <motion.div
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="p-5 rounded-3xl"
                      style={{ background: `${theme.accent2}0C`, border: `1.5px solid ${theme.accent2}25` }}
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <Sparkles size={14} style={{ color: theme.accent2 }} />
                        <span className="text-xs font-black uppercase tracking-widest" style={{ color: theme.accent2 }}>
                          Explicație AI
                        </span>
                        {aiLoading && (
                          <motion.div
                            animate={{ opacity: [1, 0.3, 1] }}
                            transition={{ duration: 1, repeat: Infinity }}
                            className="w-1.5 h-1.5 rounded-full ml-1"
                            style={{ background: theme.accent2 }}
                          />
                        )}
                      </div>
                      <p className="text-sm leading-generous whitespace-pre-wrap" style={{ color: theme.text2, lineHeight: '1.7', fontSize: '15px' }}>
                        {aiText}
                        {aiLoading && <span className="animate-pulse">▊</span>}
                      </p>
                      {analysisResult?.mistakeType && (
                        <div className="mt-4 pt-4 border-t border-dashed opacity-60" style={{ borderColor: `${theme.accent2}30` }}>
                          <div className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: theme.accent2 }}>Analiză eroare</div>
                          <div className="text-xs" style={{ color: theme.text3 }}>{analysisResult.mistakeType}</div>
                        </div>
                      )}
                      {analysisResult?.rule && (
                        <div className="mt-2 text-xs italic" style={{ color: theme.text3 }}>
                          Regulă: {analysisResult.rule}
                        </div>
                      )}
                      {nextTopicHint && (
                        <div className="mt-2 text-xs font-bold" style={{ color: theme.accent }}>
                          Focus AI recomandat: {nextTopicHint}
                        </div>
                      )}
                    </motion.div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Mnemonic AI — only when answer was wrong */}
            <AnimatePresence>
              {revealed && !examMode && hasKey() && (() => {
                const userSel = answers[question.id] ?? selectedNow;
                const correctIds = question.options.filter(o => o.isCorrect).map(o => o.id);
                const wasWrong = !(userSel.length === correctIds.length && correctIds.every(id => userSel.includes(id)));
                if (!wasWrong) return null;
                const correctAnswer = question.options.find(o => o.isCorrect)?.text ?? '';
                return (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-4"
                  >
                    {mnemonicText === null ? (
                      <button
                        disabled={mnemonicLoading}
                        onClick={async () => {
                          if (!activeProfileId) return;
                          setMnemonicLoading(true);
                          try {
                            const { getUserProfile, generateMnemonicForConcept } = await loadAIEngine();
                            const profile = getUserProfile(activeProfileId);
                            const concept = analysisResult?.missingConcept || analysisResult?.recommendedTopic || correctAnswer || question.text;
                            const repeatedMistake = profile.mistakeBank.find((entry) => entry.questionId === question.id)?.wrongCount ?? 0;
                            const correctAnswerStr = question.options.find((o) => o.isCorrect)?.text || '';
                            const targetConcept = repeatedMistake >= 2 ? concept : `${correctAnswerStr} | ${question.text}`;
                            const m = await generateMnemonicForConcept(targetConcept, correctAnswerStr);
                            setMnemonicText(m);
                          } catch { setMnemonicText('Nu s-a putut genera mnemonicul.'); }
                          finally { setMnemonicLoading(false); }
                        }}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all hover:opacity-80"
                        style={{ background: `${theme.warning}15`, border: `1px solid ${theme.warning}30`, color: theme.warning }}
                      >
                        {mnemonicLoading
                          ? <><Loader2 size={12} className="animate-spin" />Generez mnemonic...</>
                          : <><Zap size={12} />Mnemonic AI</>}
                      </button>
                    ) : (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="p-4 rounded-2xl"
                        style={{ background: `${theme.warning}0C`, border: `1px solid ${theme.warning}25` }}>
                        <div className="flex items-center gap-2 mb-2">
                          <Zap size={12} style={{ color: theme.warning }} />
                          <span className="text-xs font-semibold" style={{ color: theme.warning }}>Mnemonic</span>
                        </div>
                        <p className="text-sm leading-relaxed" style={{ color: theme.text2 }}>{mnemonicText}</p>
                      </motion.div>
                    )}
                  </motion.div>
                );
              })()}
            </AnimatePresence>

            {/* Personal note */}
            <AnimatePresence>
              {revealed && !examMode && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-4 rounded-2xl overflow-hidden"
                  style={{ border: `1px solid ${theme.border}` }}
                >
                  <div className="flex items-center gap-2 px-3 py-2"
                    style={{ background: theme.surface2, borderBottom: `1px solid ${theme.border}` }}>
                    <StickyNote size={12} style={{ color: theme.warning }} />
                    <span className="text-xs font-medium" style={{ color: theme.text3 }}>Notița mea</span>
                  </div>
                  <textarea
                    placeholder="Adaugă o notiță pentru această întrebare..."
                    value={currentNote}
                    onChange={e => setNote(question.id, e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 text-xs resize-none bg-transparent"
                    style={{ color: theme.text2, outline: 'none', border: 'none' }}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Next button */}
            <AnimatePresence>
              {revealed && (
                <motion.button
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={handleNext}
                  className="w-full py-4 rounded-2xl font-semibold text-white flex items-center justify-center gap-2"
                  style={{ background: `linear-gradient(135deg, ${theme.accent} 0%, ${theme.accent2} 100%)` }}
                  whileHover={calmMotion ? undefined : { scale: 1.01 }}
                  whileTap={calmMotion ? undefined : { scale: 0.98 }}
                >
                  {isLast ? '🏁 Vezi rezultatele' : (<>Următor <ChevronRight size={16} /></>)}
                </motion.button>
              )}
            </AnimatePresence>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
    </div>
  );
}
