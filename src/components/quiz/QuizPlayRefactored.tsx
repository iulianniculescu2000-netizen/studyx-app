import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQuizStore } from '../../store/quizStore';
import { useStatsStore } from '../../store/statsStore';
import { useNotesStore } from '../../store/notesStore';
import { useAIStore } from '../../store/aiStore';
import { useUserStore } from '../../store/userStore';
import { useFocusModeStore } from '../../store/focusModeStore';
import { useUIStore } from '../../store/uiStore';
import { useTheme } from '../../theme/ThemeContext';
import { useAdaptiveMotion } from '../../hooks/useAdaptiveMotion';
import { QuizPlayHeader } from './QuizPlayHeader';
import { QuizPlayQuestion } from './QuizPlayQuestion';
import { QuizPlayControls } from './QuizPlayControls';
import { QuizPlayKeyboardShortcuts } from './QuizPlayKeyboardShortcuts';
import { QuizPlayNotePanel } from './QuizPlayNotePanel';
import { AIExplanationPanel, HintPanel, MnemonicPanel } from '../../pages/quiz-play/ai-panels';
import type { QuizSession, Question, Option } from '../../types';
import type { AIAnalysisResult, HintResult } from '../../ai/types';
import { formatQuizPlayTime, getCorrectOptionIds, isCorrectSelection, shuffleArray } from '../../pages/quiz-play/helpers';

const loadAIEngine = () => import('../../ai/AIEngine');

export default function QuizPlayRefactored() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const { calmMotion } = useAdaptiveMotion();
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
    let qs = quiz.shuffleQuestions ? shuffleArray(quiz.questions) : [...quiz.questions];
    if (wrongQuestionsOnly && wrongQuestionsOnly.length > 0) {
      qs = qs.filter(q => wrongQuestionsOnly.includes(q.id));
    }
    if (quiz.shuffleAnswers) {
      return qs.map((q) => ({ ...q, options: shuffleArray(q.options) }));
    }
    return qs;
  }, [quiz, wrongQuestionsOnly]);

  const [currentIdx, setCurrentIdx] = useState(0);
  const [questionQueue, setQuestionQueue] = useState<Question[]>(orderedQuestions);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [selectedNow, setSelectedNow] = useState<string[]>([]);
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
  const [hintLevel, setHintLevel] = useState(0);
  const [hintData, setHintData] = useState<HintResult | null>(null);
  const [hintLoading, setHintLoading] = useState(false);
  const [showSmartNudge, setShowSmartNudge] = useState(false);
  const [notePanelOpen, setNotePanelOpen] = useState(false);

  const question = questionQueue[currentIdx];
  const isLast = currentIdx === questionQueue.length - 1;
  const isMultiple = question?.multipleCorrect ?? false;
  const currentNote = useNotesStore((s) => (question ? (s.notes[question.id] ?? '') : ''));

  const { focusMode, toggleFocusMode } = useFocusModeStore();
  const setChatOpen = useUIStore((state) => state.setChatOpen);

  // Helper functions
  const getOptionStyle = useCallback((optId: string) => {
    const correctIds = getCorrectOptionIds(question?.options ?? []);
    const isSelected = selectedNow.includes(optId);
    const isCorrect = correctIds.includes(optId);
    
    if (revealed) {
      if (isCorrect) {
        return { background: `${theme.success}15`, borderColor: theme.success, color: theme.success };
      } else if (isSelected) {
        return { background: `${theme.danger}15`, borderColor: theme.danger, color: theme.danger };
      }
    } else if (isSelected) {
      return { background: `${theme.accent}15`, borderColor: theme.accent, color: theme.accent };
    }
    
    return { background: theme.surface, borderColor: theme.border, color: theme.text };
  }, [question, selectedNow, revealed, theme]);

  const getOptionTextColor = useCallback((optId: string) => {
    const correctIds = getCorrectOptionIds(question?.options ?? []);
    const isSelected = selectedNow.includes(optId);
    const isCorrect = correctIds.includes(optId);
    
    if (revealed) {
      if (isCorrect) return theme.success;
      if (isSelected) return theme.danger;
      return theme.text3;
    }
    
    if (isSelected) return theme.accent;
    return theme.text;
  }, [question, selectedNow, revealed, theme]);

  // Event handlers
  const handleBack = useCallback(() => {
    navigate('/quizzes');
  }, [navigate]);

  const handleSelect = useCallback((optId: string) => {
    if (revealed && !isMultiple) return;

    if (isMultiple) {
      setSelectedNow(prev => 
        prev.includes(optId) 
          ? prev.filter(id => id !== optId)
          : [...prev, optId]
      );
    } else {
      setSelectedNow([optId]);
      const newAnswers = { ...answers, [question!.id]: [optId] };
      setAnswers(newAnswers);
      
      if (examMode) {
        if (isLast) {
          // Will handle in finishQuiz
        } else {
          setCurrentIdx(i => i + 1);
          setSelectedNow([]);
        }
      } else {
        setRevealed(true);
        const isCorrect = question!.options.find((o) => o.id === optId)?.isCorrect;
        if (isCorrect) {
          setFeedbackAnim('correct');
        } else {
          setFeedbackAnim('wrong');
          setShakeId(optId);
        }
      }
    }
  }, [revealed, isMultiple, answers, question, examMode, isLast]);

  const handleConfirmMultiple = useCallback(() => {
    if (selectedNow.length === 0) return;
    const newAnswers = { ...answers, [question!.id]: selectedNow };
    setAnswers(newAnswers);
    
    if (examMode) {
      if (isLast) {
        // Will handle in finishQuiz
      } else {
        setCurrentIdx(i => i + 1);
        setSelectedNow([]);
      }
    } else {
      setRevealed(true);
      const correctIds = getCorrectOptionIds(question!.options);
      const isCorrect = isCorrectSelection(selectedNow, correctIds);
      if (isCorrect) {
        setFeedbackAnim('correct');
      } else {
        setFeedbackAnim('wrong');
      }
    }
  }, [selectedNow, answers, question, examMode, isLast]);

  const handleNext = useCallback(() => {
    // Cancel any in-progress AI explanation
    aiAbortRef.current?.abort();
    aiAbortRef.current = null;
    setAiText(null);
    setAiLoading(false);
    setMnemonicText(null);
    setMnemonicLoading(false);
    setRevealed(false);
    setSelectedNow([]);
    setFeedbackAnim(null);
    setShakeId(null);
    setHintLevel(0);
    setHintData(null);
    setAnalysisResult(null);
    setAnalysisQuestionId(null);
    setNextTopicHint(null);

    if (isLast) {
      finishQuiz(answers);
    } else {
      setCurrentIdx(i => i + 1);
    }
  }, [answers, isLast]);

  const handleGetHint = useCallback(async () => {
    if (!hasKey || !question || hintLevel >= 3) return;
    
    setHintLoading(true);
    try {
      const { generateHint } = await loadAIEngine();
      const hint = await generateHint(question, hintLevel + 1);
      setHintData(hint);
      setHintLevel(prev => prev + 1);
    } catch (error) {
      console.error('Hint generation failed:', error);
    } finally {
      setHintLoading(false);
    }
  }, [hasKey, question, hintLevel]);

  const handleToggleNote = useCallback(() => {
    setNotePanelOpen(!notePanelOpen);
  }, [notePanelOpen]);

  const handleSaveNote = useCallback((noteText: string) => {
    if (question) {
      setNote(question.id, noteText, activeProfileId);
    }
  }, [question, setNote, activeProfileId]);

  const handleOpenStudyChat = useCallback(() => {
    if (!question) return;
    
    setChatOpen(true);
    window.dispatchEvent(new CustomEvent('studyx:ai-prompt', {
      detail: {
        open: true,
        mode: 'explain',
        resetConversation: true,
        prompt: `Explic-mi detaliat întrebarea: ${question.text}`,
      },
    }));
  }, [question, setChatOpen]);

  const finishQuiz = useCallback((finalAnswers: Record<string, string[]>) => {
    const score = questionQueue.filter((q) => {
      const userAnswers = finalAnswers[q.id] ?? [];
      const correctIds = getCorrectOptionIds(q.options);
      return isCorrectSelection(userAnswers, correctIds);
    }).length;
    
    questionQueue.forEach((q) => {
      const userAnswers = finalAnswers[q.id] ?? [];
      const correctIds = getCorrectOptionIds(q.options);
      const isCorrect = isCorrectSelection(userAnswers, correctIds);
      recordAnswer(quiz!.id, q.id, isCorrect);
    });
    
    const duration = Math.floor((Date.now() - startedAt) / 1000);
    recordStudySession(duration);

    navigate(`/quiz/${id}/results`, {
      state: {
        quiz,
        answers: finalAnswers,
        score,
        duration,
        examMode,
        timedMode
      }
    });
  }, [questionQueue, quiz, id, startedAt, recordAnswer, recordStudySession, navigate, examMode, timedMode]);

  // Effects
  useEffect(() => {
    setHintLevel(0);
    setHintData(null);
  }, [currentIdx]);

  useEffect(() => {
    if (examMode) return;
    const intervalId = setInterval(() => {
      setTimeElapsed((t) => t + 1);
    }, 1000);
    return () => clearInterval(intervalId);
  }, [examMode]);

  useEffect(() => {
    if (!timedMode || revealed) return;
    setQuestionTimer(TIME_PER_Q);
    const intervalId = setInterval(() => {
      setQuestionTimer((t) => {
        if (t <= 1) return 0;
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(intervalId);
  }, [currentIdx, timedMode, revealed]);

  // Auto-advance after reveal
  useEffect(() => {
    if (!revealed || !autoAdvance || examMode || aiLoading || mnemonicLoading) return;
    const t = setTimeout(handleNext, 2000);
    return () => clearTimeout(t);
  }, [revealed, autoAdvance, handleNext, examMode, aiLoading, mnemonicLoading]);

  // Timed mode: auto-advance when timer expires
  useEffect(() => {
    if (!timedMode || revealed || questionTimer > 0) return;
    const newAnswers = { ...answers, [question?.id ?? '']: [] };
    setAnswers(newAnswers);
    setSelectedNow([]);
    if (isLast) finishQuiz(newAnswers);
    else setCurrentIdx(i => i + 1);
  }, [questionTimer, timedMode, revealed, answers, question, isLast, finishQuiz]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleBack();
        return;
      }
      
      if (e.key === 'h' || e.key === 'H') {
        handleGetHint();
        return;
      }
      
      if (e.key === 'n' || e.key === 'N') {
        handleToggleNote();
        return;
      }
      
      // Number keys for options
      if (e.key >= '1' && e.key <= '4') {
        const optIndex = parseInt(e.key) - 1;
        if (question && question.options[optIndex]) {
          handleSelect(question.options[optIndex].id);
        }
        return;
      }
      
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (revealed) {
          handleNext();
        } else if (isMultiple && selectedNow.length > 0) {
          handleConfirmMultiple();
        } else if (selectedNow.length === 1) {
          // Single selection already handled in handleSelect
        }
        return;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleBack, handleGetHint, handleToggleNote, handleSelect, handleConfirmMultiple, handleNext, revealed, isMultiple, selectedNow, question]);

  if (!quiz || !question) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: theme.background }}>
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4" style={{ color: theme.text }}>Quiz not found</h1>
          <button
            onClick={handleBack}
            className="px-4 py-2 rounded-lg"
            style={{ background: theme.accent, color: 'white' }}
          >
            Back to Quizzes
          </button>
        </div>
      </div>
    );
  }

  const correctIds = getCorrectOptionIds(question.options);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: theme.background }}>
      <QuizPlayHeader
        quiz={quiz}
        questionQueue={questionQueue}
        currentIdx={currentIdx}
        answers={answers}
        timeElapsed={timeElapsed}
        examMode={examMode}
        timedMode={timedMode}
        questionTimer={questionTimer}
        showKeys={showKeys}
        setShowKeys={setShowKeys}
        onBack={handleBack}
        theme={theme}
        calmMotion={calmMotion}
      />

      <QuizPlayKeyboardShortcuts
        show={showKeys}
        theme={theme}
        calmMotion={calmMotion}
      />

      <QuizPlayQuestion
        question={question}
        currentIdx={currentIdx}
        isMultiple={isMultiple}
        revealed={revealed}
        shakeId={shakeId}
        feedbackAnim={feedbackAnim}
        calmMotion={calmMotion}
        theme={theme}
        getOptionStyle={getOptionStyle}
        getOptionTextColor={getOptionTextColor}
        correctIds={correctIds}
        selectedNow={selectedNow}
        onSelect={handleSelect}
      />

      <HintPanel
        calmMotion={calmMotion}
        examMode={examMode}
        hasAI={hasKey}
        hintLevel={hintLevel}
        hintData={hintData}
        hintLoading={hintLoading}
        revealed={revealed}
        showSmartNudge={showSmartNudge}
        onGetHint={handleGetHint}
        theme={theme}
      />

      <AIExplanationPanel
        calmMotion={calmMotion}
        aiText={aiText}
        aiLoading={aiLoading}
        question={question}
        theme={theme}
      />

      <MnemonicPanel
        calmMotion={calmMotion}
        mnemonicText={mnemonicText}
        mnemonicLoading={mnemonicLoading}
        theme={theme}
      />

      <QuizPlayNotePanel
        question={question}
        currentNote={currentNote}
        isOpen={notePanelOpen}
        theme={theme}
        calmMotion={calmMotion}
        onClose={handleToggleNote}
        onSave={handleSaveNote}
      />

      <QuizPlayControls
        revealed={revealed}
        isMultiple={isMultiple}
        isLast={isLast}
        selectedNow={selectedNow}
        examMode={examMode}
        calmMotion={calmMotion}
        theme={theme}
        onNext={handleNext}
        onConfirmMultiple={handleConfirmMultiple}
        onGetHint={handleGetHint}
        onToggleNote={handleToggleNote}
        onOpenStudyChat={handleOpenStudyChat}
        hasKey={hasKey}
        currentNote={currentNote}
      />
    </div>
  );
}
