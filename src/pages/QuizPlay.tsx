import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { ChevronLeft, ChevronRight, BookOpen, Layers, Keyboard, Zap, Eye, GraduationCap, StickyNote, MessageSquare, Sparkles } from 'lucide-react';
import { useQuizStore } from '../store/quizStore';
import { useStatsStore } from '../store/statsStore';
import { useNotesStore } from '../store/notesStore';
import { useAIStore } from '../store/aiStore';
import { useUserStore } from '../store/userStore';
import { useFocusModeStore } from '../store/focusModeStore';
import { useUIStore } from '../store/uiStore';
import { useTheme } from '../theme/ThemeContext';
import { HERO_COLOR_MAP } from '../theme/colorMaps';
import { useAdaptiveMotion } from '../hooks/useAdaptiveMotion';
import { useViewportProfile } from '../hooks/useViewportProfile';
import QuizImage from '../components/QuizImage';
import type { QuizSession, Question, Option } from '../types';
import type { AIAnalysisResult, HintResult } from '../ai/types';
import {
  buildAnalysisFallback,
  buildHintFallback,
  buildMnemonicFallback,
  cleanQuestionExplanation,
  getAnswerTextForOptionIds,
  getCorrectAnswerText,
} from '../helpers/quizAi';
import { evaluateSelection, formatQuizPlayTime, getCorrectOptionIds, isCorrectSelection, shuffleArray } from './quiz-play/helpers';
import { AIExplanationPanel, HintPanel, MnemonicPanel } from './quiz-play/ai-panels';

const loadAIEngine = () => import('../ai/AIEngine');

export default function QuizPlay() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const { calmMotion } = useAdaptiveMotion();
  const { compact, crampedHeight, shortHeight, mobile, narrow, tablet, uiScale, density } = useViewportProfile();
  const { quizzes, addSession } = useQuizStore();
  const { recordAnswer, recordStudySession } = useStatsStore();
  const setNote = useNotesStore((s) => s.setNote);
  const { hasKey } = useAIStore();
  const activeProfileId = useUserStore((s) => s.activeProfileId);
  const quiz = quizzes.find((q) => q.id === id);
  const state = location.state as { mode?: string; wrongQuestionsOnly?: string[]; practiceCount?: number; blockStart?: number } | null;
  const examMode = state?.mode === 'exam';
  const timedMode = state?.mode === 'timed';
  const wrongQuestionsOnly = state?.wrongQuestionsOnly;
  const practiceCount = state?.practiceCount;
  const blockStart = state?.blockStart ?? 0;
  const TIME_PER_Q = 30; // seconds

  // Build shuffled question/option order once
  const orderedQuestions = useMemo<Question[]>(() => {
    if (!quiz) return [];
    let qs = quiz.shuffleQuestions ? shuffleArray(quiz.questions) : [...quiz.questions];
    if (wrongQuestionsOnly && wrongQuestionsOnly.length > 0) {
      const uniqueWrongIds = Array.from(new Set(wrongQuestionsOnly));
      qs = qs.filter(q => uniqueWrongIds.includes(q.id));
    }
    if (practiceCount && practiceCount > 0) {
      const safeStart = Math.max(0, Math.min(blockStart, Math.max(0, qs.length - 1)));
      qs = qs.slice(safeStart, safeStart + practiceCount);
    }
    if (quiz.shuffleAnswers) {
      return qs.map((q) => ({ ...q, options: shuffleArray(q.options) }));
    }
    return qs;
  }, [quiz, wrongQuestionsOnly, practiceCount, blockStart]);

  const [currentIdx, setCurrentIdx] = useState(0);
  const [questionQueue, setQuestionQueue] = useState<Question[]>(orderedQuestions);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [selectedNow, setSelectedNow] = useState<string[]>([]); // for current question
  const [revealed, setRevealed] = useState(false);
  const [shakeId, setShakeId] = useState<string | null>(null);
  const [feedbackAnim, setFeedbackAnim] = useState<'correct' | 'partial' | 'wrong' | null>(null);
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
  const setChatOpen = useUIStore((state) => state.setChatOpen);
  const openStudyChat = useCallback((mode: 'explain' | 'summarize' | 'test', prompt: string) => {
    setChatOpen(true);
    window.dispatchEvent(new CustomEvent('studyx:ai-prompt', {
      detail: {
        open: true,
        mode,
        resetConversation: true,
        prompt,
      },
    }));
  }, [setChatOpen]);

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
    if (!question || hintLoading || hintLevel >= 3) return;
    
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
      setHintData(buildHintFallback(question));
      setHintLevel(1);
    } finally {
      setHintLoading(false);
    }
  }, [question, hintLoading, hintLevel, hintData]);

  useEffect(() => {
    setQuestionQueue(orderedQuestions);
    setCurrentIdx(0);
    setAnswers({});
    setSelectedNow([]);
    setRevealed(false);
    setAiText(null);
    setAiLoading(false);
    setMnemonicText(null);
    setMnemonicLoading(false);
    setAnalysisResult(null);
    setAnalysisQuestionId(null);
    setNextTopicHint(null);
    setShakeId(null);
    setFeedbackAnim(null);
    setHintLevel(0);
    setHintData(null);
  }, [orderedQuestions]);

  useEffect(() => {
    setHintLevel(0);
    setHintData(null);
  }, [currentIdx]);

  useEffect(() => {
    if (examMode) return; // Don't track time in exam mode
    const intervalId = setInterval(() => {
      setTimeElapsed((t) => t + 1);
    }, 1000);
    return () => clearInterval(intervalId);
  }, [examMode]);

  // Per-question countdown in timed mode
  useEffect(() => {
    if (!timedMode || revealed) return;
    setQuestionTimer(TIME_PER_Q);
    const intervalId = setInterval(() => {
      setQuestionTimer((t) => {
        if (t <= 1) {
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(intervalId);
  }, [currentIdx, timedMode, revealed]);

  const finishQuiz = useCallback((finalAnswers: Record<string, string[]>) => {
    const score = questionQueue.filter((q) => {
      const userAnswers = finalAnswers[q.id] ?? [];
      const correctIds = getCorrectOptionIds(q.options);
      return isCorrectSelection(userAnswers, correctIds);
    }).length;
    const partialAnswerIds = questionQueue
      .filter((q) => {
        const userAnswers = finalAnswers[q.id] ?? [];
        const correctIds = getCorrectOptionIds(q.options);
        return evaluateSelection(userAnswers, correctIds) === 'partial';
      })
      .map((q) => q.id);
    questionQueue.forEach((q) => {
      const userAnswers = finalAnswers[q.id] ?? [];
      const correctIds = getCorrectOptionIds(q.options);
      const result = evaluateSelection(userAnswers, correctIds);
      // Partial counts as wrong for spaced-repetition tracking
      recordAnswer(quiz!.id, q.id, result === 'correct');
    });
    const duration = Math.floor((Date.now() - startedAt) / 1000);
    recordStudySession(duration);

    // -- Rezidențiat penalty scoring ------------------------------------------
    // +1 per fully correct answer, -0.25 per wrong option selected.
    // Only active when quiz.penaltyMode is true. Score net is clamped to = 0.
    let penalizedScore: number | undefined;
    if (quiz!.penaltyMode) {
      let netPoints = 0;
      questionQueue.forEach((q) => {
        const userAnswers = finalAnswers[q.id] ?? [];
        if (userAnswers.length === 0) return; // unanswered: no points, no penalty
        const correctIds = getCorrectOptionIds(q.options);
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
      ...(partialAnswerIds.length > 0 ? { partialAnswers: partialAnswerIds } : {}),
    };
    addSession(session);
    navigate(`/results/${quiz!.id}`, { state: { session, orderedQuestions: questionQueue } });
  }, [questionQueue, quiz, startedAt, addSession, navigate, recordAnswer, recordStudySession, examMode, timedMode]);

  const resetAssistiveState = useCallback(() => {
    aiAbortRef.current?.abort();
    aiAbortRef.current = null;
    setAiText(null);
    setAiLoading(false);
    setMnemonicText(null);
    setMnemonicLoading(false);
    setAnalysisResult(null);
    setAnalysisQuestionId(null);
    setNextTopicHint(null);
    setShakeId(null);
    setFeedbackAnim(null);
    setHintLevel(0);
    setHintData(null);
  }, []);

  const handleSkipQuestion = useCallback(() => {
    // Skip is only meaningful in study mode before revealing the answer.
    if (examMode || timedMode || revealed || questionQueue.length <= 1 || isLast) return;
    resetAssistiveState();
    setQuestionQueue((prev) => {
      const next = [...prev];
      const [skipped] = next.splice(currentIdx, 1);
      next.push(skipped);
      return next;
    });
    setSelectedNow([]);
    setRevealed(false);
  }, [examMode, timedMode, revealed, questionQueue.length, isLast, currentIdx, resetAssistiveState]);

  const handleSelect = useCallback((optId: string) => {
    if (revealed) return;
    if (isMultiple) {
      setSelectedNow((prev) =>
        prev.includes(optId) ? prev.filter((id) => id !== optId) : [...prev, optId]
      );
      return;
    }

    setSelectedNow([optId]);
    if (examMode) {
      const newAnswers = { ...answers, [question.id]: [optId] };
      setAnswers(newAnswers);
      if (isLast) finishQuiz(newAnswers);
      else {
        setCurrentIdx((i) => i + 1);
        setSelectedNow([]);
      }
    }
  }, [revealed, isMultiple, examMode, answers, question, isLast, finishQuiz]);

  const confirmSelection = useCallback(() => {
    if (selectedNow.length === 0) return;
    const newAnswers = { ...answers, [question.id]: selectedNow };
    setAnswers(newAnswers);
    if (examMode) {
      if (isLast) finishQuiz(newAnswers);
      else { setCurrentIdx((i) => i + 1); setSelectedNow([]); }
    } else {
      setRevealed(true);
      const correctIdsForQuestion = getCorrectOptionIds(question.options);
      const result = evaluateSelection(selectedNow, correctIdsForQuestion);
      if (result === 'correct') {
        setFeedbackAnim('correct');
        window.setTimeout(() => setFeedbackAnim(null), 420);
      } else if (result === 'partial') {
        setFeedbackAnim('partial');
        window.setTimeout(() => setFeedbackAnim(null), 600);
      } else {
        setFeedbackAnim('wrong');
        setShakeId(selectedNow.find((id) => !correctIdsForQuestion.includes(id)) ?? selectedNow[0] ?? null);
        window.setTimeout(() => {
          setFeedbackAnim(null);
          setShakeId(null);
        }, 520);
      }
    }
  }, [selectedNow, question, answers, examMode, isLast, finishQuiz]);

  const handleNext = useCallback(() => {
    resetAssistiveState();
    if (isLast) {
      finishQuiz(answers);
    } else {
      setCurrentIdx((i) => i + 1);
      setSelectedNow([]);
      setRevealed(false);
    }
  }, [isLast, answers, finishQuiz, resetAssistiveState]);

  const handleAIExplain = useCallback(async () => {
    if (!question || aiLoading) return;
    if (analysisResult?.explanation && analysisQuestionId === question.id) {
      setAiText(analysisResult.explanation);
      return;
    }
    setAiLoading(true);
    const currentAnswers = answers[question.id] ?? selectedNow;
    const userAnswer = getAnswerTextForOptionIds(question.options, currentAnswers);
    const correctAnswer = getCorrectAnswerText(question);
    const correctIdsForQuestion = getCorrectOptionIds(question.options);
    const isCorrect = isCorrectSelection(currentAnswers, correctIdsForQuestion);
    try {
      if (!activeProfileId) {
        const fallbackAnalysis = buildAnalysisFallback({ question, userAnswer, correctAnswer, isCorrect });
        setAnalysisResult(fallbackAnalysis);
        setAnalysisQuestionId(question.id);
        setAiText(fallbackAnalysis.explanation);
        setNextTopicHint(fallbackAnalysis.recommendedTopic ?? null);
        return;
      }
      const { analyzeAnswer } = await loadAIEngine();
      const { analysis } = await analyzeAnswer(activeProfileId, { question, userAnswer, correctAnswer, isCorrect });
      setAnalysisResult(analysis);
      setAnalysisQuestionId(question.id);
      setAiText(analysis.explanation);
    } catch {
      const fallbackAnalysis = buildAnalysisFallback({ question, userAnswer, correctAnswer, isCorrect });
      setAnalysisResult(fallbackAnalysis);
      setAnalysisQuestionId(question.id);
      setAiText(fallbackAnalysis.explanation);
      setNextTopicHint(fallbackAnalysis.recommendedTopic ?? null);
    } finally {
      setAiLoading(false);
    }
  }, [question, aiLoading, activeProfileId, analysisResult, analysisQuestionId, answers, selectedNow]);

  useEffect(() => {
    if (!revealed || examMode || !question || analysisQuestionId === question.id) return;
    const currentAnswers = answers[question.id] ?? selectedNow;
    if (currentAnswers.length === 0) return;
    const correctIdsForQuestion = getCorrectOptionIds(question.options);
    const isCorrect = isCorrectSelection(currentAnswers, correctIdsForQuestion);

    setAnalysisQuestionId(question.id);
    if (!isCorrect) {
      setNextTopicHint(question.tags?.[0] ?? question.difficulty ?? null);
    }
  }, [revealed, examMode, question, analysisQuestionId, answers, selectedNow]);

  // Auto-advance after reveal
  // Dacă AI-ul a fost activ, așteptăm 5s după ce finalizează (nu 2s) pentru a citi explicația.
  // Timer-ul pornește NUMAI dacă nu s-a cerut explicație AI (aiText null = nu a fost apăsat).
  useEffect(() => {
    if (!revealed || !autoAdvance || examMode || aiLoading || mnemonicLoading) return;
    // Dacă există text AI deja afișat, dăm 5s să-l citească; altfel 2s standard
    const delay = aiText ? 5000 : 2000;
    const t = setTimeout(handleNext, delay);
    return () => clearTimeout(t);
  }, [revealed, autoAdvance, handleNext, examMode, aiLoading, mnemonicLoading, aiText]);

  // Timed mode: auto-advance when timer expires
  // Dacă utilizatorul a selectat ceva (parțial), păstrăm selecția — nu o anulăm
  useEffect(() => {
    if (!timedMode || revealed || questionTimer > 0) return;
    if (!question?.id) return;
    // Păstrăm selectedNow dacă există (răspuns parțial mai bun decât nimic)
    const effectiveAnswer = selectedNow.length > 0 ? selectedNow : [];
    const newAnswers = { ...answers, [question.id]: effectiveAnswer };
    setAnswers(newAnswers);
    setSelectedNow([]);
    if (isLast) finishQuiz(newAnswers);
    else setCurrentIdx(i => i + 1);
  }, [questionTimer, timedMode, revealed, question, isLast, finishQuiz, answers, selectedNow]);

  // Maintain latest state for keyboard handler without re-binding listener
  const kbStateRef = useRef({ question, handleSelect, confirmSelection, handleNext, handleGetHint, isMultiple, revealed, examMode });
  useEffect(() => {
    kbStateRef.current = { question, handleSelect, confirmSelection, handleNext, handleGetHint, isMultiple, revealed, examMode };
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
        if (!state.revealed) { state.confirmSelection(); }
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

  const correctIds = getCorrectOptionIds(question.options);
  const currentSelection = answers[question.id] ?? selectedNow;
  const selectionResult = evaluateSelection(currentSelection, correctIds);
  const wasWrong = currentSelection.length > 0 && selectionResult === 'wrong';
  const wasPartial = currentSelection.length > 0 && selectionResult === 'partial';
  const selectedAnswerText = getAnswerTextForOptionIds(question.options, currentSelection);
  const correctAnswerText = getCorrectAnswerText(question);
  const studyFocusTopic = analysisResult?.recommendedTopic ?? analysisResult?.missingConcept ?? nextTopicHint ?? question.tags?.[0] ?? null;
  const focusSurface = focusMode
    ? (theme.isDark ? 'rgba(18, 22, 30, 0.96)' : 'rgba(255, 255, 255, 0.98)')
    : theme.surface;
  const focusSurface2 = focusMode
    ? (theme.isDark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(15, 23, 42, 0.055)')
    : theme.surface2;
  const focusBorder = focusMode
    ? (theme.isDark ? 'rgba(255, 255, 255, 0.32)' : 'rgba(15, 23, 42, 0.16)')
    : theme.border;
  const focusPanelShadow = focusMode
    ? (theme.isDark ? '0 24px 70px rgba(0,0,0,0.32)' : '0 24px 70px rgba(15,23,42,0.12)')
    : undefined;
  const questionCardSurface = focusMode
    ? (theme.isDark
      ? 'linear-gradient(180deg, rgba(24, 28, 38, 0.98), rgba(15, 18, 28, 0.97))'
      : 'linear-gradient(180deg, rgba(255, 255, 255, 0.99), rgba(247, 249, 252, 0.98))')
    : `linear-gradient(180deg, color-mix(in srgb, ${theme.surface} 88%, transparent), color-mix(in srgb, ${theme.surface2} 86%, transparent))`;

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
      return {
        background: focusSurface,
        border: `${focusMode ? '1.5px' : '1px'} solid ${focusBorder}`,
        boxShadow: focusMode ? focusPanelShadow : undefined,
      };
    }
    // Partial correct: selected correct options → green; missed correct → warning amber
    if (isCorrect && isSelected) return {
      background: `${theme.success}12`,
      border: `2px solid ${theme.success}`,
      boxShadow: `0 8px 24px ${theme.success}15`,
    };
    if (isCorrect && !isSelected && wasPartial) return {
      background: `${theme.warning}10`,
      border: `2px dashed ${theme.warning}`,
      boxShadow: `0 8px 24px ${theme.warning}12`,
    };
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
    return {
      background: focusMode ? focusSurface2 : theme.surface,
      border: `1px solid ${focusMode ? focusBorder : theme.border}`,
      opacity: focusMode ? 0.68 : 0.4,
      filter: focusMode ? 'saturate(0.88)' : 'grayscale(0.5)',
    };
  };

  const getOptionTextColor = (optId: string) => {
    if (!revealed) return theme.text;
    const isCorrectOpt = correctIds.includes(optId);
    const isSelected = selectedNow.includes(optId);
    if (isCorrectOpt && isSelected) return theme.success;
    if (isCorrectOpt && !isSelected && wasPartial) return theme.warning;
    if (isCorrectOpt) return theme.success;
    if (isSelected) return theme.danger;
    return theme.text3;
  };

  const difficultyColor = { easy: theme.success, medium: theme.warning, hard: theme.danger };
  const difficultyLabel = { easy: 'Ușor', medium: 'Mediu', hard: 'Dificil' };
  const heroColors = HERO_COLOR_MAP[quiz.color] ?? HERO_COLOR_MAP.blue;
  const denseLayout = density === 'dense';
  const modeLabel = examMode
    ? 'Simulare examen'
    : timedMode
      ? 'Test cronometrat'
      : wrongQuestionsOnly && wrongQuestionsOnly.length > 0
        ? 'Recuperare greșeli'
        : 'Studiu ghidat';
  const timerTone = questionTimer <= 10 ? theme.danger : timedMode ? theme.warning : theme.accent;
  const progressSummary = `${answeredCount}/${questionQueue.length}`;
  const shellPaddingClass = denseLayout
    ? 'pt-3 pb-8 px-3 sm:px-4'
    : shortHeight
      ? 'pt-4 pb-10 px-3 sm:px-5'
      : 'pt-6 pb-14 px-4 sm:px-6';
  const heroPaddingClass = denseLayout
    ? 'px-3.5 py-3.5 sm:px-4 sm:py-4'
    : crampedHeight
      ? 'px-4 py-4 sm:px-5 sm:py-5'
      : 'px-5 py-5 sm:px-6 sm:py-6';
  const contentCardPaddingClass = denseLayout ? 'p-3' : crampedHeight ? 'p-3 sm:p-4' : 'p-4 sm:p-5';
  const questionCardPaddingClass = denseLayout ? 'p-3.5 sm:p-4' : crampedHeight ? 'p-4 sm:p-5' : 'p-5 sm:p-6';
  const questionWidthClass = mobile ? 'max-w-full' : narrow ? 'max-w-[840px]' : tablet ? 'max-w-[920px]' : 'max-w-3xl';
  const optionStackClass = denseLayout ? 'space-y-2 mb-3.5' : crampedHeight ? 'space-y-2.5 mb-4' : 'space-y-3 mb-5';
  const optionPaddingClass = denseLayout ? 'p-3' : crampedHeight ? 'p-3.5 sm:p-4' : 'p-4';
  // heroMetricsGridClass replaced by inline strip layout
  const heroControlsWrapClass = denseLayout ? 'flex flex-wrap items-center gap-1.5' : 'flex flex-wrap items-center gap-2';
  const optionTextClass = denseLayout ? 'text-[13px] sm:text-sm font-medium leading-relaxed' : 'text-sm font-medium';
  const questionTextClass = denseLayout
    ? 'text-base font-semibold leading-relaxed sm:text-lg'
    : crampedHeight
      ? 'text-lg font-semibold leading-snug sm:text-xl'
      : 'text-xl font-semibold leading-snug';
  const heroTitleStyle = denseLayout
    ? { fontSize: `clamp(${(1.55 * uiScale).toFixed(2)}rem, ${(2.4 * uiScale).toFixed(2)}vw, ${(2.05 * uiScale).toFixed(2)}rem)` }
    : undefined;
  const heroSubtitleClass = denseLayout ? 'mt-1.5 max-w-2xl text-xs font-medium leading-relaxed text-white/78 sm:text-sm' : 'mt-2 max-w-2xl text-sm font-medium leading-relaxed text-white/78';
  const questionImageMaxHeight = denseLayout ? 180 : shortHeight ? 220 : 260;
  const showActionDock = compact || crampedHeight || mobile;
  const selectionSummary = selectedNow.length > 0
    ? `${selectedNow.length} variant${selectedNow.length === 1 ? 'ă selectată' : 'e selectate'}`
    : examMode
      ? 'Selectează și confirmă'
      : 'Selectează un răspuns pentru a continua';
  return (
    <div className="premium-shell h-full overflow-y-auto relative">
      {/* Dark overlay for Focus Mode */}
      <AnimatePresence>
        {focusMode && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-0 pointer-events-none"
            style={{
              background: theme.isDark ? 'rgba(0, 0, 0, 0.26)' : 'rgba(15, 23, 42, 0.08)',
              backdropFilter: 'none',
            }}
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

    <div className={`min-h-full relative z-10 ${shellPaddingClass}`}>
      <div className="max-w-[1120px] mx-auto shell-main-stage">
        {/* Session hero */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: calmMotion ? 0.18 : 0.45, ease: [0.16, 1, 0.3, 1] }}
          className={`editorial-hero luxe-card overflow-hidden ${denseLayout ? 'mb-4 rounded-[26px] sm:rounded-[30px]' : 'mb-6 rounded-[32px] sm:rounded-[38px]'} ${heroPaddingClass}`}
          style={{ background: heroColors.gradient, boxShadow: `0 26px 72px ${heroColors.glow}` }}
        >
          <div className={`relative z-10 flex flex-col ${denseLayout ? 'gap-4' : 'gap-6'}`}>
            <div className={`flex flex-col ${denseLayout ? 'gap-4' : 'gap-5'} xl:flex-row xl:items-start xl:justify-between`}>
              <div className="min-w-0 flex-1">
                <Link
                  to={`/quiz/${quiz.id}`}
                  className={`inline-flex items-center gap-2 rounded-full font-black uppercase tracking-[0.18em] transition-all ${denseLayout ? 'px-2.5 py-1 text-[10px]' : 'px-3 py-1.5 text-xs'}`}
                  style={{ background: 'rgba(255,255,255,0.16)', color: 'rgba(255,255,255,0.88)' }}
                >
                  <ChevronLeft size={14} />
                  Înapoi la detalii
                </Link>

                <div className={`${denseLayout ? 'mt-3 gap-3' : 'mt-4 gap-4'} flex items-start`}>
                  <div
                    className={`flex shrink-0 items-center justify-center shadow-2xl ${denseLayout ? 'h-11 w-11 rounded-[16px] text-2xl sm:h-12 sm:w-12' : 'h-14 w-14 rounded-[20px] text-3xl'}`}
                    style={{ background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(12px)' }}
                  >
                    {quiz.emoji}
                  </div>

                  <div className="min-w-0">
                    <div className="text-[10px] font-black uppercase tracking-[0.24em] text-white/65">
                      Sesiune quiz
                    </div>
                    <h1 className={`page-title-compact mt-1 text-white ${denseLayout ? 'leading-tight' : ''}`} style={heroTitleStyle}>{quiz.title}</h1>
                    <p className={heroSubtitleClass}>
                      {quiz.category} • {modeLabel}
                    </p>
                    <div className={`${denseLayout ? 'mt-2 gap-1.5' : 'mt-3 gap-2'} flex flex-wrap items-center`}>
                      <span className="rounded-full border border-white/18 bg-white/12 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-white/90">
                        Întrebarea {currentIdx + 1} din {questionQueue.length}
                      </span>
                      {isMultiple && (
                        <span className="rounded-full border border-white/18 bg-white/12 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-white/90">
                          Răspunsuri multiple
                        </span>
                      )}
                      {quiz.penaltyMode && (
                        <span className="rounded-full border border-white/18 bg-white/12 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-white/90">
                          Scor cu penalizare
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Metrics strip — compact, no wrapping */}
              <div
                className="flex shrink-0 self-start items-stretch divide-x rounded-[20px] overflow-hidden border border-white/18"
                style={{ background: 'rgba(255,255,255,0.12)' }}
              >
                {[
                  { label: 'Progres', value: progressSummary },
                  { label: 'Timp', value: formatQuizPlayTime(timeElapsed) },
                  { label: timedMode ? 'Timer' : 'Ritm', value: timedMode ? `${questionTimer}s` : autoAdvance ? 'Auto' : 'Man.' , accent: timedMode ? timerTone : undefined },
                  { label: 'Rămase', value: `${Math.max(questionQueue.length - answeredCount, 0)}` },
                ].map((metric, i) => (
                  <div
                    key={metric.label}
                    className="flex flex-col items-center justify-center px-4 py-3 gap-1"
                    style={{ borderLeft: i > 0 ? '1px solid rgba(255,255,255,0.16)' : 'none' }}
                  >
                    <span className="text-[9px] font-black uppercase tracking-[0.14em] text-white/50 whitespace-nowrap leading-none">
                      {metric.label}
                    </span>
                    <span
                      className="text-sm font-black tracking-tight whitespace-nowrap leading-none"
                      style={{ color: metric.accent ?? 'rgba(255,255,255,0.95)' }}
                    >
                      {metric.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className={`grid ${denseLayout ? 'gap-3' : 'gap-4'} xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end`}>
              <div className={`rounded-[24px] border border-white/14 bg-black/12 ${denseLayout ? 'px-3 py-3' : 'px-4 py-4'}`}>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="text-[11px] font-black uppercase tracking-[0.2em] text-white/65">Progres sesiune</span>
                  <span className="text-sm font-black text-white">{Math.round(progress)}%</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden bg-white/16">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: 'linear-gradient(90deg, rgba(255,255,255,0.98), rgba(255,255,255,0.62))' }}
                    animate={{ width: `${progress}%` }}
                    transition={calmMotion ? { duration: 0.2, ease: 'linear' } : { duration: 0.4, ease: 'easeOut' }}
                  />
                </div>
              </div>

              <div className={heroControlsWrapClass}>
                {examMode && (
                  <span className="rounded-full border border-white/18 bg-white/12 px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-white/90">
                    <span className="inline-flex items-center gap-1.5">
                      <GraduationCap size={12} />
                      Examen
                    </span>
                  </span>
                )}
                {!examMode && (
                  <button
                    onClick={() => setAutoAdvance(!autoAdvance)}
                    title={autoAdvance ? 'Dezactivează auto-avansarea' : 'Activează auto-avansarea (2 secunde)'}
                    className="press-feedback rounded-full border px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em]"
                    style={{
                      background: autoAdvance ? 'rgba(255,255,255,0.24)' : 'rgba(255,255,255,0.10)',
                      borderColor: autoAdvance ? 'rgba(255,255,255,0.30)' : 'rgba(255,255,255,0.14)',
                      color: '#FFFFFF',
                    }}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <Zap size={12} fill={autoAdvance ? '#FFFFFF' : 'none'} />
                      Auto
                    </span>
                  </button>
                )}
                {!examMode && !timedMode && !revealed && (
                  <button
                    onClick={handleSkipQuestion}
                    disabled={isLast || questionQueue.length <= 1}
                    title="Sari peste această întrebare și revino la final"
                    className="press-feedback rounded-full border px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] disabled:opacity-45"
                    style={{
                      background: 'rgba(255,255,255,0.10)',
                      borderColor: 'rgba(255,255,255,0.14)',
                      color: '#FFFFFF',
                    }}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <ChevronRight size={12} />
                      Amână
                    </span>
                  </button>
                )}
                <button
                  onClick={() => setShowKeys(!showKeys)}
                  className="press-feedback rounded-full border px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em]"
                  style={{ background: 'rgba(255,255,255,0.10)', borderColor: 'rgba(255,255,255,0.14)', color: '#FFFFFF' }}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <Keyboard size={12} />
                    Taste
                  </span>
                </button>
                <button
                  onClick={toggleFocusMode}
                  title={focusMode ? 'Ieși din Modul Focus' : 'Intră în Modul Focus'}
                  className="press-feedback rounded-full border px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em]"
                  style={{
                    background: focusMode ? 'rgba(255,255,255,0.24)' : 'rgba(255,255,255,0.10)',
                    borderColor: focusMode ? 'rgba(255,255,255,0.30)' : 'rgba(255,255,255,0.14)',
                    color: '#FFFFFF',
                  }}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <Eye size={12} />
                    Focus
                  </span>
                </button>
              </div>
            </div>
          </div>

          <AnimatePresence>
            {showKeys && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="relative z-10 mt-4 flex flex-wrap gap-2 overflow-hidden"
              >
                {['1-4 / A-D selectează opțiunea', 'Enter / Space confirmă sau continuă', 'H deschide indiciul'].map((hint) => (
                  <span
                    key={hint}
                    className="rounded-full border border-white/16 bg-white/12 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-white/82"
                  >
                    {hint}
                  </span>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

      {/* Question */}
      <div className={`${questionWidthClass} mx-auto w-full flex flex-col`}>
        <div
          className={`glass-panel premium-shadow rounded-[32px] ${contentCardPaddingClass}`}
          style={focusMode ? { background: focusSurface, borderColor: focusBorder, boxShadow: focusPanelShadow } : undefined}
        >
        <AnimatePresence mode="wait">
          <motion.div key={`${question.id}-${currentIdx}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: calmMotion ? 0.18 : 0.25 }}
            className={`flex-1 flex flex-col ${feedbackAnim === 'wrong' ? 'anim-shake' : feedbackAnim === 'correct' ? 'anim-bounce' : feedbackAnim === 'partial' ? 'anim-pulse-partial' : ''}`}
          >
            {/* Question card */}
            <div
              className={`editorial-hero rounded-[30px] mb-5 ${questionCardPaddingClass}`}
              style={{
                background: questionCardSurface,
                border: `1px solid ${focusMode ? focusBorder : theme.border}`,
                boxShadow: focusMode ? `inset 0 1px 0 rgba(255,255,255,0.12), ${focusPanelShadow}` : undefined,
              }}
            >
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: theme.accent }}>
                  {modeLabel}
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
              <p className="text-xs font-black uppercase tracking-[0.22em] mb-2" style={{ color: theme.text3 }}>
                Întrebarea {currentIdx + 1} din {questionQueue.length}
              </p>
              <p className={questionTextClass} style={{ color: theme.text }}>{question.text}</p>

              {/* Question image */}
              {question.imageUrl && (
                <div className="mt-4">
                  <QuizImage src={question.imageUrl} maxHeight={questionImageMaxHeight} />
                </div>
              )}

              {isMultiple && !revealed && (
                <p className="text-sm mt-2" style={{ color: theme.text3 }}>
                  Selectează toate răspunsurile corecte, apoi apasă "Confirmă"
                </p>
              )}
            </div>

            <HintPanel
              calmMotion={calmMotion}
              examMode={examMode}
                usesRemoteAI={hasKey}
              hintLevel={hintLevel}
              hintData={hintData}
              hintLoading={hintLoading}
              revealed={revealed}
              showSmartNudge={showSmartNudge}
              onGetHint={handleGetHint}
              theme={theme}
            />

            {/* Options */}
            <div className={optionStackClass}>
              {question.options.map((opt: Option, i: number) => (
                <motion.button key={opt.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{
                    opacity: 1,
                    y: 0,
                    x: shakeId === opt.id && !calmMotion ? [0, -10, 10, -8, 8, -4, 4, 0] : 0,
                    scale: (revealed && correctIds.includes(opt.id) && !calmMotion) ? [1, 1.05, 1] : 1
                  }}
                  transition={{
                    duration: shakeId === opt.id ? 0.3 : revealed && correctIds.includes(opt.id) ? 0.6 : 0.25,
                    delay: i * 0.03,
                    ease: 'easeOut'
                  }}
                  onClick={() => handleSelect(opt.id)}
                  disabled={revealed && !isMultiple}
                  className={`premium-option-card w-full flex items-center gap-4 rounded-[24px] text-left transition-all ${optionPaddingClass}`}
                  style={getOptionStyle(opt.id)}
                  whileHover={!revealed ? { scale: calmMotion ? 1.005 : 1.01 } : {}}
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
                      ? '\u2713' 
                      : (selectedNow.includes(opt.id) 
                          ? (revealed ? '\u00D7' : (isMultiple ? '\u25CF' : String.fromCharCode(65 + i))) 
                          : String.fromCharCode(65 + i))}
                  </div>
                  <span className={optionTextClass} style={{ color: getOptionTextColor(opt.id) }}>
                    {opt.text}
                  </span>
                  {/* Keyboard hint badge */}
                  {!revealed && !denseLayout && (
                    <span className="ml-auto text-xs font-mono rounded px-1.5 py-0.5 flex-shrink-0"
                      style={{ background: theme.surface2, color: theme.text3 }}>
                      {i + 1}
                    </span>
                  )}
                </motion.button>
              ))}
            </div>

            {/* Confirm button */}
            <AnimatePresence>
              {showActionDock ? null : ((!revealed && !examMode) || (isMultiple && examMode && !revealed)) ? (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mb-4 flex flex-wrap items-center gap-3"
                >
                  <motion.button
                    onClick={confirmSelection}
                    disabled={selectedNow.length === 0}
                    className="press-feedback flex-1 rounded-[22px] px-5 py-3.5 text-sm font-black text-white disabled:opacity-35 sm:flex-none sm:min-w-[220px]"
                    style={{ background: `linear-gradient(135deg, ${theme.accent} 0%, ${theme.accent2} 100%)`, boxShadow: `0 18px 36px ${theme.accent}22` }}
                    whileHover={calmMotion ? undefined : { scale: 1.01 }}
                    whileTap={calmMotion ? undefined : { scale: 0.98 }}
                  >
                    {examMode
                      ? `Confirmă (${selectedNow.length})`
                      : isMultiple
                        ? `Verifică selecția (${selectedNow.length})`
                        : 'Verifică răspunsul'}
                  </motion.button>

                  {!examMode && (
                    <div className="rounded-[20px] border px-4 py-3 text-xs font-bold" style={{ background: theme.surface2, borderColor: theme.border, color: theme.text3 }}>
                      {selectedNow.length > 0
                        ? `${selectedNow.length} variant${selectedNow.length === 1 ? 'ă selectată' : 'e selectate'}`
                        : 'Selectează un răspuns pentru a continua'}
                    </div>
                  )}
                </motion.div>
              ) : null}
            </AnimatePresence>

            {/* Explanation */}
            <AnimatePresence>
              {revealed && !examMode && cleanQuestionExplanation(question.explanation) && (
                <motion.div
                  initial={{ opacity: 0, y: 10, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-4 p-4 rounded-2xl overflow-hidden"
                  style={{ background: `${theme.accent}0C`, border: `1px solid ${theme.accent}25` }}
                >
                  <p className="text-sm" style={{ color: theme.text2 }}>
                    <span className="font-semibold" style={{ color: theme.accent }}>Explicație: </span>
                    {cleanQuestionExplanation(question.explanation)}
                  </p>
                  {autoAdvance && (
                    <div className="mt-3 h-0.5 rounded-full overflow-hidden" style={{ background: theme.surface2 }}>
                      <motion.div className="h-full rounded-full"
                        initial={{ width: '0%' }} animate={{ width: '100%' }}
                        transition={{ duration: calmMotion ? 1 : 1.5, ease: 'linear' }}
                        style={{ background: theme.accent }} />
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            <AIExplanationPanel
              aiLoading={aiLoading}
              aiText={aiText}
              analysisResult={analysisResult}
              examMode={examMode}
                usesRemoteAI={hasKey}
              nextTopicHint={nextTopicHint}
              revealed={revealed}
              onExplain={handleAIExplain}
              theme={theme}
            />

            <MnemonicPanel
              examMode={examMode}
                usesRemoteAI={hasKey}
              mnemonicLoading={mnemonicLoading}
              mnemonicText={mnemonicText}
              revealed={revealed}
              wasWrong={wasWrong}
              onGenerate={async () => {
                setMnemonicLoading(true);
                try {
                  const correctAnswer = getCorrectAnswerText(question);
                  const concept = analysisResult?.missingConcept || analysisResult?.recommendedTopic || correctAnswer || question.text;
                  if (!activeProfileId) {
                    setMnemonicText(buildMnemonicFallback(concept, correctAnswer));
                    return;
                  }
                  const { getUserProfile, generateMnemonicForConcept } = await loadAIEngine();
                  const profile = getUserProfile(activeProfileId);
                  const repeatedMistake = profile.mistakeBank.find((entry) => entry.questionId === question.id)?.wrongCount ?? 0;
                  const targetConcept = repeatedMistake >= 2 ? concept : `${correctAnswer} | ${question.text}`;
                  const mnemonic = await generateMnemonicForConcept(targetConcept, correctAnswer);
                  setMnemonicText(mnemonic);
                } catch {
                  const correctAnswer = getCorrectAnswerText(question);
                  const concept = analysisResult?.missingConcept || analysisResult?.recommendedTopic || correctAnswer || question.text;
                  setMnemonicText(buildMnemonicFallback(concept, correctAnswer));
                } finally {
                  setMnemonicLoading(false);
                }
              }}
              theme={theme}
            />

            <AnimatePresence>
            {revealed && !examMode && hasKey && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="luxe-card mb-4 rounded-[28px] p-4"
                  style={{ background: theme.surface, border: `1px solid ${theme.border}` }}
                >
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className="citation-pill inline-flex items-center gap-1.5">
                      <Sparkles size={12} />
                      Continuă cu AI
                    </span>
                    {studyFocusTopic && (
                      <span className="premium-chip rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em]" style={{ color: theme.text3 }}>
                        Focus: {studyFocusTopic}
                      </span>
                    )}
                    {wasWrong && (
                      <span className="premium-chip rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em]" style={{ color: theme.danger }}>
                        Necesită consolidare
                      </span>
                    )}
                    {wasPartial && (
                      <span className="premium-chip rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em]" style={{ color: theme.warning }}>
                        Parțial corect — mai exersează
                      </span>
                    )}
                  </div>

                  <p className="mb-3 text-sm font-medium leading-relaxed" style={{ color: theme.text }}>
                    Continuă imediat în chat cu contextul acestei întrebări, fără să pierzi ritmul sesiunii.
                  </p>

                  <div className="grid gap-2.5 sm:grid-cols-3">
                    <button
                      onClick={() => openStudyChat(
                        'explain',
                        `Explică-mi clar întrebarea aceasta și de ce răspunsul corect este "${correctAnswerText}". Întrebare: ${question.text}. Răspunsul meu: ${selectedAnswerText || "niciun răspuns"}.`,
                      )}
                      className="premium-card-hover press-feedback rounded-[20px] border px-4 py-3 text-left"
                      style={{ background: theme.surface2, borderColor: theme.border, color: theme.text }}
                    >
                      <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.16em]">
                        <MessageSquare size={14} style={{ color: theme.accent2 }} />
                        Discută răspunsul
                      </div>
                      <div className="mt-1 text-xs opacity-65" style={{ color: theme.text }}>
                        Deschide explicația completă în AI chat.
                      </div>
                    </button>

                    <button
                      onClick={() => openStudyChat(
                        'test',
                        `Testează-mă rapid pe tema "${studyFocusTopic ?? question.text}". Pune-mi 3 întrebări scurte, una câte una, și verifică dacă am înțeles.`,
                      )}
                      className="premium-card-hover press-feedback rounded-[20px] border px-4 py-3 text-left"
                      style={{ background: theme.surface2, borderColor: theme.border, color: theme.text }}
                    >
                      <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.16em]">
                        <Sparkles size={14} style={{ color: theme.accent }} />
                        Mini-test pe focus
                      </div>
                      <div className="mt-1 text-xs opacity-65" style={{ color: theme.text }}>
                        Fixează imediat conceptul vulnerabil.
                      </div>
                    </button>

                    <button
                      onClick={() => openStudyChat(
                        'summarize',
                        `Rezumă-mi pentru examen regula, capcanele și diferențele-cheie pentru această întrebare. Întrebare: ${question.text}. Răspuns corect: ${correctAnswerText}.${analysisResult?.rule ? ` Regulă actuală: ${analysisResult.rule}.` : ''}`,
                      )}
                      className="premium-card-hover press-feedback rounded-[20px] border px-4 py-3 text-left"
                      style={{ background: theme.surface2, borderColor: theme.border, color: theme.text }}
                    >
                      <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.16em]">
                        <BookOpen size={14} style={{ color: theme.warning }} />
                        Fixează regula
                      </div>
                      <div className="mt-1 text-xs opacity-65" style={{ color: theme.text }}>
                        Comprimă ideea în format de examen.
                      </div>
                    </button>
                  </div>
                </motion.div>
              )}
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
              {revealed && !showActionDock && (
                <motion.button
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={handleNext}
                  className={`w-full rounded-2xl font-semibold text-white flex items-center justify-center gap-2 ${denseLayout ? 'py-3.5 text-sm' : 'py-4'}`}
                  style={{ background: `linear-gradient(135deg, ${theme.accent} 0%, ${theme.accent2} 100%)` }}
                  whileHover={calmMotion ? undefined : { scale: 1.01 }}
                  whileTap={calmMotion ? undefined : { scale: 0.98 }}
                >
                  {isLast ? 'Vezi rezultatele' : (<>Următor <ChevronRight size={16} /></>)}
                </motion.button>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {showActionDock && (
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  className="sticky bottom-3 z-20 mt-4"
                >
                  <div className={`glass-panel premium-shadow rounded-[24px] border ${denseLayout ? 'px-3 py-3' : 'px-4 py-4'}`}>
                    <div className={`flex items-start justify-between gap-3 ${mobile ? 'flex-col' : ''}`}>
                      <div className="min-w-0">
                        <p className={`font-semibold leading-relaxed ${denseLayout ? 'text-[13px] sm:text-sm' : 'text-sm'}`} style={{ color: theme.text }}>
                          {selectionSummary}
                        </p>
                      </div>

                      <div className={`flex items-center gap-2 ${mobile ? 'w-full flex-col' : 'shrink-0'}`}>
                        {!revealed && (
                          <div
                            className={`rounded-full border px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] ${mobile ? 'w-full text-center' : ''}`}
                            style={{ background: theme.surface2, borderColor: theme.border, color: timedMode ? timerTone : theme.text3 }}
                          >
                            {timedMode ? `Timer ${questionTimer}s` : `Întrebarea ${currentIdx + 1}/${questionQueue.length}`}
                          </div>
                        )}

                        <motion.button
                          onClick={revealed ? handleNext : confirmSelection}
                          disabled={!revealed && selectedNow.length === 0}
                          className={`press-feedback rounded-[20px] text-sm font-black text-white disabled:opacity-35 ${denseLayout ? 'px-4 py-2.5' : 'px-5 py-3'} ${mobile ? 'w-full' : 'min-w-[220px]'}`}
                          style={{ background: `linear-gradient(135deg, ${theme.accent} 0%, ${theme.accent2} 100%)`, boxShadow: `0 18px 36px ${theme.accent}22` }}
                          whileHover={calmMotion ? undefined : { scale: 1.01 }}
                          whileTap={calmMotion ? undefined : { scale: 0.98 }}
                        >
                          {revealed
                            ? (isLast ? 'Vezi rezultatele' : 'Următor')
                            : examMode
                              ? `Confirmă (${selectedNow.length})`
                              : isMultiple
                                ? `Verifică selecția (${selectedNow.length})`
                                : 'Verifică răspunsul'}
                        </motion.button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </AnimatePresence>
        </div>
      </div>
      </div>
    </div>
    </div>
  );
}
