import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ChevronLeft, Check, Brain,
  Sparkles, Trophy, Loader2, Bot,
} from 'lucide-react';
import { useAIStore } from '../store/aiStore';
import { useQuizStore } from '../store/quizStore';
import { useStatsStore } from '../store/statsStore';
import { useTheme } from '../theme/ThemeContext';
import { useAdaptiveMotion } from '../hooks/useAdaptiveMotion';
import { useViewportProfile } from '../hooks/useViewportProfile';
import { buildClarificationFallback, cleanQuestionExplanation, getCorrectAnswerText } from '../helpers/quizAi';
import { explainWrongAnswer } from '../lib/groq';
import QuizImage from '../components/QuizImage';
import type { Question, Quiz } from '../types';

interface CardItem {
  question: Question;
  quiz: Quiz;
}

type Rating = 'hard' | 'good' | 'easy';

function shuffleArr<T>(array: T[]): T[] {
  const next = [...array];
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function getAnswerTone(answer: string, dense: boolean) {
  const length = answer.trim().length;
  if (dense) {
    if (length > 240) return 'text-sm sm:text-base font-semibold leading-relaxed';
    if (length > 150) return 'text-base sm:text-lg font-bold leading-relaxed';
    if (length > 90) return 'text-lg sm:text-xl font-bold leading-snug';
    return 'text-xl sm:text-2xl font-black leading-tight';
  }
  if (length > 260) return 'text-base sm:text-lg font-semibold leading-relaxed';
  if (length > 170) return 'text-lg sm:text-xl font-bold leading-relaxed';
  if (length > 110) return 'text-xl sm:text-2xl font-bold leading-snug';
  return 'text-2xl sm:text-3xl font-black leading-tight';
}

function getQuestionTone(question: string, crampedHeight: boolean, dense: boolean) {
  const length = question.trim().length;

  if (dense) {
    if (length > 220) return 'text-base sm:text-lg font-bold leading-relaxed';
    if (length > 130) return 'text-lg sm:text-xl font-black leading-snug';
    return 'text-xl sm:text-2xl font-black leading-tight';
  }

  if (crampedHeight) {
    if (length > 240) return 'text-lg sm:text-xl font-bold leading-relaxed';
    if (length > 140) return 'text-xl sm:text-2xl font-black leading-snug';
    return 'text-2xl sm:text-3xl font-black leading-tight';
  }

  if (length > 260) return 'text-xl sm:text-2xl font-bold leading-relaxed';
  if (length > 150) return 'text-2xl sm:text-3xl font-black leading-snug';
  return 'text-3xl sm:text-[2.6rem] font-black leading-tight';
}

export default function FlashcardSession() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const theme = useTheme();
  const { calmMotion, performanceLite } = useAdaptiveMotion();
  const { crampedHeight, shortHeight, narrow, mobile, tablet, viewport, density, uiScale } = useViewportProfile();
  const { hasKey } = useAIStore();
  const { quizzes } = useQuizStore();
  const { questionStats, recordAnswer, recordStudySession } = useStatsStore();

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);

  const modeAll = searchParams.get('mode') === 'all';

  const initialCards = useMemo<CardItem[]>(() => {
    if (id === 'all') {
      const items: CardItem[] = [];
      quizzes.filter((quiz) => !quiz.archived && quiz.questions.length > 0).forEach((quiz) => {
        quiz.questions.forEach((question) => {
          const stat = questionStats[`${quiz.id}:${question.id}`];
          if (!stat || (stat.nextReview > 0 && stat.nextReview <= now)) {
            items.push({ question, quiz });
          }
        });
      });
      return shuffleArr(items);
    }

    const quiz = quizzes.find((item) => item.id === id);
    if (!quiz) return [];

    const items: CardItem[] = quiz.questions
      .filter((question) => {
        if (modeAll) return true;
        const stat = questionStats[`${quiz.id}:${question.id}`];
        return !stat || (stat.nextReview > 0 && stat.nextReview <= now);
      })
      .map((question) => ({ question, quiz }));

    return modeAll ? items : shuffleArr(items);
  }, [id, quizzes, questionStats, modeAll, now]);

  const sessionRouteKey = `${id ?? 'all'}:${modeAll ? 'all' : 'due'}`;
  const [activeRouteKey, setActiveRouteKey] = useState(sessionRouteKey);
  const [cards, setCards] = useState<CardItem[]>(initialCards);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [sessionDone, setSessionDone] = useState(false);
  const [cardKey, setCardKey] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const startTime = useRef(Date.now());
  const answerScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const shouldResetForRoute = activeRouteKey !== sessionRouteKey;
    const shouldHydrateEmptySession = cards.length === 0 && initialCards.length > 0;
    if (!shouldResetForRoute && !shouldHydrateEmptySession) return;

    setCards(initialCards);
    setCurrentIdx(0);
    setFlipped(false);
    setRatings([]);
    setSessionDone(false);
    setCardKey((key) => key + 1);
    setElapsed(0);
    setAiExplanation(null);
    setAiLoading(false);
    startTime.current = Date.now();
    setActiveRouteKey(sessionRouteKey);
  }, [activeRouteKey, cards.length, initialCards, sessionRouteKey]);

  const getElapsedSeconds = useCallback(() => {
    return Math.max(1, Math.floor((Date.now() - startTime.current) / 1000));
  }, []);

  const handleRating = useCallback((rating: Rating) => {
    if (!cards[currentIdx]) return;
    const { question, quiz } = cards[currentIdx];

    const isCorrect = rating !== 'hard';
    recordAnswer(quiz.id, question.id, isCorrect);
    setRatings((prev) => [...prev, rating]);

    if (currentIdx + 1 < cards.length) {
      setFlipped(false);
      setAiExplanation(null);
      setCurrentIdx((index) => index + 1);
      setCardKey((key) => key + 1);
    } else {
      const finalElapsed = getElapsedSeconds();
      recordStudySession(finalElapsed);
      setElapsed(finalElapsed);
      setSessionDone(true);
    }
  }, [cards, currentIdx, recordAnswer, recordStudySession, getElapsedSeconds]);

  const handleExplain = async () => {
    if (aiLoading || !cards[currentIdx]) return;
    setAiLoading(true);
    const { question } = cards[currentIdx];
    const correctText = getCorrectAnswerText(question);
    const { getAccuracy } = useStatsStore.getState();
    const userCtx = `Utilizatorul a parcurs ${cards.length} flashcard-uri în această sesiune. Acuratețe globală: ${getAccuracy()}%.`;

    try {
      const explanation = await explainWrongAnswer(question.text, 'Am uitat contextul', correctText, userCtx);
      setAiExplanation(explanation);
    } catch {
      setAiExplanation(buildClarificationFallback(question, 'Am uitat contextul', correctText));
    } finally {
      setAiLoading(false);
    }
  };

  useEffect(() => {
    const handleKeys = (event: KeyboardEvent) => {
      if (sessionDone) return;

      if (event.code === 'Space' || event.key === 'Enter') {
        event.preventDefault();
        if (!flipped) setFlipped(true);
      }

      if (flipped) {
        if (event.key === '1') { event.preventDefault(); handleRating('hard'); }
        if (event.key === '2') { event.preventDefault(); handleRating('good'); }
        if (event.key === '3') { event.preventDefault(); handleRating('easy'); }
      }
    };

    window.addEventListener('keydown', handleKeys);
    return () => window.removeEventListener('keydown', handleKeys);
  }, [flipped, handleRating, sessionDone]);

  useEffect(() => {
    if (!flipped) return;
    answerScrollRef.current?.scrollTo({ top: 0, behavior: 'auto' });
  }, [cardKey, flipped]);

  useEffect(() => {
    if (!aiExplanation || !answerScrollRef.current) return;
    const scroller = answerScrollRef.current;
    const frame = window.requestAnimationFrame(() => {
      scroller.scrollTo({
        top: scroller.scrollHeight,
        behavior: calmMotion ? 'auto' : 'smooth',
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [aiExplanation, calmMotion]);

  if (sessionDone) {
    const hardCount = ratings.filter((rating) => rating === 'hard').length;
    const goodCount = ratings.filter((rating) => rating === 'good').length;
    const easyCount = ratings.filter((rating) => rating === 'easy').length;

    return (
      <div className="h-full flex items-center justify-center px-6">
        <motion.div
          initial={calmMotion ? { opacity: 0, y: 12 } : { opacity: 0, scale: 0.95 }}
          animate={calmMotion ? { opacity: 1, y: 0 } : { opacity: 1, scale: 1 }}
          className="max-w-md w-full text-center"
        >
          <div
            className="w-20 h-20 rounded-3xl mx-auto mb-6 flex items-center justify-center"
            style={{ background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})`, boxShadow: `0 16px 40px ${theme.accent}30` }}
          >
            <Trophy size={36} className="text-white" />
          </div>
          <h2 className="text-3xl font-black tracking-tight mb-2" style={{ color: theme.text }}>Sesiune încheiată</h2>
          <p className="text-sm font-medium opacity-60 mb-10" style={{ color: theme.text }}>
            Ai parcurs {cards.length} flashcarduri în {Math.floor(elapsed / 60)}m {elapsed % 60}s.
          </p>

          <div className={`grid gap-3 mb-10 ${mobile ? 'grid-cols-1' : 'grid-cols-3'}`}>
            <div className="p-4 rounded-2xl" style={{ background: `${theme.danger}10`, border: `1px solid ${theme.danger}20` }}>
              <div className="text-xl font-black mb-1" style={{ color: theme.danger }}>{hardCount}</div>
              <div className="text-[10px] font-black uppercase opacity-50" style={{ color: theme.text }}>Dificile</div>
            </div>
            <div className="p-4 rounded-2xl" style={{ background: `${theme.accent}10`, border: `1px solid ${theme.accent}20` }}>
              <div className="text-xl font-black mb-1" style={{ color: theme.accent }}>{goodCount}</div>
              <div className="text-[10px] font-black uppercase opacity-50" style={{ color: theme.text }}>Bune</div>
            </div>
            <div className="p-4 rounded-2xl" style={{ background: `${theme.success}10`, border: `1px solid ${theme.success}20` }}>
              <div className="text-xl font-black mb-1" style={{ color: theme.success }}>{easyCount}</div>
              <div className="text-[10px] font-black uppercase opacity-50" style={{ color: theme.text }}>Ușoare</div>
            </div>
          </div>

          <button
            onClick={() => navigate('/flashcards')}
            className={`w-full rounded-2xl font-black uppercase tracking-widest text-xs text-white shadow-2xl transition-all ${mobile ? 'py-3.5' : 'py-4'}`}
            style={{ background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})`, boxShadow: `0 12px 30px ${theme.accent}40` }}
          >
            Înapoi la Flashcards
          </button>
        </motion.div>
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="h-full flex items-center justify-center px-6">
        <div className="text-center">
          <Sparkles size={48} className="mx-auto mb-4 opacity-20" style={{ color: theme.text }} />
          <h2 className="text-xl font-bold mb-2" style={{ color: theme.text }}>Niciun card de studiat</h2>
          <p className="text-sm opacity-60 mb-6" style={{ color: theme.text }}>Toate cardurile tale sunt la zi sau nu există întrebări.</p>
          <button onClick={() => navigate('/flashcards')} className="text-accent font-bold">Înapoi</button>
        </div>
      </div>
    );
  }

  const current = cards[currentIdx];
  const correctAnswers = current.question.options.filter((option) => option.isCorrect);
  const questionText = current.question.text.trim();
  const answerTextLength = correctAnswers.reduce((sum, option) => sum + option.text.trim().length, 0);
  const progress = (currentIdx / cards.length) * 100;
  const hasMedia = Boolean(current.question.imageUrl);
  const denseLayout = density === 'dense';
  const headerOffset = denseLayout ? 92 : crampedHeight ? 104 : 122;
  const dockOffset = flipped
    ? (denseLayout ? 156 : crampedHeight ? 174 : 198)
    : (denseLayout ? 42 : 52);
  const stageHeight = Math.max(
    denseLayout ? 340 : 390,
    Math.min(
      denseLayout ? 560 : crampedHeight ? 620 : 720,
      viewport.height - headerOffset - dockOffset,
    ),
  );
  const cardHeight = stageHeight;
  const sessionPaddingClass = denseLayout
    ? 'px-3 py-3 sm:px-4'
    : crampedHeight
      ? 'px-4 py-3 sm:px-5'
      : 'px-4 py-4 sm:px-6';
  const topBarPaddingClass = denseLayout ? 'px-3 py-2.5 sm:px-4' : crampedHeight ? 'px-4 py-3' : 'px-5 py-3.5';
  const cardWidthClass = mobile ? 'max-w-full' : narrow ? 'max-w-[54rem]' : tablet ? 'max-w-[62rem]' : hasMedia ? 'max-w-5xl' : 'max-w-4xl';
  const dockGridClass = mobile ? 'grid-cols-1' : shortHeight ? 'grid-cols-3' : 'grid-cols-3';
  const imageDominantFront = hasMedia && questionText.length <= 160;
  const frontCopyTone = imageDominantFront
    ? (denseLayout ? 'text-sm sm:text-base font-black leading-snug' : 'text-base sm:text-lg font-black leading-snug')
    : getQuestionTone(current.question.text, crampedHeight, denseLayout);
  const titleStyle = { fontSize: `clamp(${(0.95 * uiScale).toFixed(2)}rem, ${(1.5 * uiScale).toFixed(2)}vw, ${(1.2 * uiScale).toFixed(2)}rem)` };
  const frontUsesSplitMedia = hasMedia && !imageDominantFront && !mobile && !narrow && cardHeight >= 460 && current.question.text.length <= 220;
  const imageFrameClass = frontUsesSplitMedia
    ? 'min-h-0 w-full'
    : imageDominantFront
      ? 'mt-4 w-full max-w-[68rem]'
      : denseLayout
      ? 'mt-4 w-full max-w-[34rem]'
      : shortHeight
        ? 'mt-5 w-full max-w-[38rem]'
        : 'mt-6 w-full max-w-[44rem]';
  const frontContentWidthClass = imageDominantFront
    ? 'max-w-[70rem]'
    : denseLayout
      ? 'max-w-[34rem]'
      : 'max-w-3xl';
  const frontImageMaxHeight = Math.max(
    frontUsesSplitMedia ? 280 : imageDominantFront ? 240 : 150,
    Math.min(
      frontUsesSplitMedia
        ? Math.floor(cardHeight * 0.82)
        : imageDominantFront
          ? (denseLayout ? 360 : shortHeight ? 430 : 560)
          : denseLayout
            ? 240
            : shortHeight
              ? 280
              : 380,
      Math.floor(cardHeight * (frontUsesSplitMedia ? 0.82 : imageDominantFront ? 0.78 : current.question.text.length > 180 ? 0.34 : 0.48)),
    ),
  );
  const frontPanelPaddingClass = denseLayout ? 'p-4 sm:p-5' : crampedHeight ? 'p-5 sm:p-7' : 'p-6 sm:p-10';
  const backPanelPaddingClass = denseLayout ? 'p-3.5 sm:p-4' : crampedHeight ? 'p-4 sm:p-5' : 'p-5 sm:p-6';
  const answerCardPaddingClass = denseLayout ? 'px-3.5 py-3 sm:px-4 sm:py-3.5' : crampedHeight ? 'px-4 py-4' : 'px-5 py-4 sm:px-6';
  const dockLabelTextClass = denseLayout ? 'mt-1 text-[13px] font-semibold' : 'mt-1 text-sm font-semibold';
  const dockLabel = flipped ? 'Evaluează cardul' : current.quiz.category;

  const centerBackContent = correctAnswers.length <= 2 && answerTextLength < 260 && !current.question.explanation && !aiExplanation;
  const faceTransition = calmMotion
    ? { duration: 0.18, ease: 'easeOut' as const }
    : { duration: 0.28, ease: [0.16, 1, 0.3, 1] as const };
  const faceInitial = calmMotion
    ? { opacity: 0, y: 8 }
    : { opacity: 0, rotateY: flipped ? -72 : 72, scale: 0.985 };
  const faceAnimate = calmMotion
    ? { opacity: 1, y: 0 }
    : { opacity: 1, rotateY: 0, scale: 1 };
  const faceExit = calmMotion
    ? { opacity: 0, y: -8 }
    : { opacity: 0, rotateY: flipped ? 72 : -72, scale: 0.985 };

  return (
    <div className="premium-shell h-full overflow-hidden">
      <div className={`grid h-full grid-rows-[auto_minmax(0,1fr)_auto] gap-3 ${sessionPaddingClass}`}>
        <div className={`${cardWidthClass} mx-auto w-full`}>
          <div
            className={`luxe-card overflow-hidden ${denseLayout ? 'rounded-[22px]' : 'rounded-[24px]'} ${topBarPaddingClass}`}
            style={{ background: theme.modalBg, border: `1px solid ${theme.border}` }}
          >
            <div className={`flex items-center gap-3 ${mobile ? 'flex-wrap' : ''}`}>
              <button
                onClick={() => navigate('/flashcards')}
                className={`press-feedback inline-flex shrink-0 items-center gap-2 rounded-full font-black uppercase tracking-[0.18em] ${denseLayout ? 'px-2.5 py-1.5 text-[10px]' : 'px-3 py-2 text-[11px]'}`}
                style={{ background: theme.surface2, color: theme.text, border: `1px solid ${theme.border}` }}
              >
                <ChevronLeft size={14} /> Ieșire
              </button>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Brain size={14} style={{ color: theme.accent }} />
                  <h1 className="truncate font-black tracking-tight" style={{ color: theme.text, ...titleStyle }}>
                    {current.quiz.title}
                  </h1>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full" style={{ background: theme.surface2 }}>
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: `linear-gradient(90deg, ${theme.accent}, ${theme.accent2})` }}
                    animate={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              <div className={`flex shrink-0 items-center gap-2 ${mobile ? 'w-full justify-between' : ''}`}>
                <span className="rounded-full px-3 py-1.5 text-[11px] font-black tabular-nums" style={{ background: `${theme.accent}14`, color: theme.accent, border: `1px solid ${theme.accent}24` }}>
                  {currentIdx + 1} / {cards.length}
                </span>
                <span className="rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em]" style={{ background: theme.surface2, color: theme.text3, border: `1px solid ${theme.border}` }}>
                  {modeAll ? 'Tot deck-ul' : 'Due'}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="min-h-0 overflow-hidden">
          <div
            className={`relative flex h-full flex-col items-center justify-center overflow-hidden ${denseLayout ? 'py-1' : crampedHeight ? 'py-2' : 'py-3'}`}
            style={{ perspective: performanceLite ? '900px' : '1200px' }}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={cardKey}
                initial={calmMotion ? { opacity: 0, y: 12 } : { opacity: 0, x: 20, scale: 0.95 }}
                animate={calmMotion ? { opacity: 1, y: 0 } : { opacity: 1, x: 0, scale: 1 }}
                exit={calmMotion ? { opacity: 0, y: -8 } : { opacity: 0, x: -20, scale: 0.95 }}
                transition={calmMotion ? { duration: 0.22, ease: 'easeOut' } : { type: 'spring', stiffness: 300, damping: 25 }}
                onClick={() => !flipped && setFlipped(true)}
                className={`relative w-full ${cardWidthClass} transition-[opacity] duration-300 ${!flipped ? 'cursor-pointer' : 'cursor-default'}`}
                style={{ height: '100%', maxHeight: cardHeight, transformStyle: 'preserve-3d' }}
              >
                <AnimatePresence initial={false} mode="wait">
                  {!flipped && (
                    <motion.div
                      key="front"
                      initial={faceInitial}
                      animate={faceAnimate}
                      exit={faceExit}
                      transition={faceTransition}
                      className={`absolute inset-0 overflow-hidden rounded-[34px] border border-white/10 ${frontPanelPaddingClass} text-center shadow-2xl glass-panel flex flex-col items-center justify-center`}
                      style={{ position: 'absolute', background: theme.surface, backfaceVisibility: 'hidden' }}
                    >
                  {frontUsesSplitMedia && current.question.imageUrl ? (
                    <div className="grid h-full w-full grid-cols-[minmax(0,0.72fr)_minmax(0,1fr)] items-center gap-7">
                      <div className="custom-scrollbar min-h-0 overflow-y-auto pr-1 text-left">
                        <h2 className={`${frontCopyTone} whitespace-pre-wrap break-words`} style={{ color: theme.text }}>
                          {current.question.text}
                        </h2>
                      </div>
                      <div className={`${imageFrameClass} flex items-center justify-center`}>
                        <QuizImage
                          src={current.question.imageUrl}
                          maxHeight={frontImageMaxHeight}
                          variant="flashcard"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className={`custom-scrollbar mx-auto flex max-h-full ${hasMedia ? 'w-full' : ''} ${frontContentWidthClass} flex-col items-center justify-center overflow-y-auto px-1`}>
                      <h2 className={`${frontCopyTone} whitespace-pre-wrap break-words`} style={{ color: theme.text }}>
                        {current.question.text}
                      </h2>

                      {current.question.imageUrl && (
                        <div className={`${imageFrameClass} flex items-center justify-center`}>
                          <QuizImage
                            src={current.question.imageUrl}
                            maxHeight={frontImageMaxHeight}
                            variant="flashcard"
                          />
                        </div>
                      )}
                    </div>
                  )}
                    </motion.div>
                  )}

                  {flipped && (
                    <motion.div
                      key="back"
                      initial={faceInitial}
                      animate={faceAnimate}
                      exit={faceExit}
                      transition={faceTransition}
                      className={`absolute inset-0 rounded-[34px] border border-white/10 ${backPanelPaddingClass} text-center shadow-2xl glass-panel flex flex-col overflow-hidden`}
                      style={{ position: 'absolute', background: theme.isDark ? 'rgba(30,30,35,0.95)' : 'rgba(255,255,255,0.95)', backfaceVisibility: 'hidden' }}
                    >
                  <div className="mx-auto mb-3 flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                    <Check size={14} style={{ color: theme.success }} />
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-60" style={{ color: theme.text }}>
                      Răspuns corect
                    </span>
                  </div>

                  <div className="flex min-h-0 flex-1 flex-col">
                    <div
                      ref={answerScrollRef}
                      className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-1 pb-1 pr-1 sm:px-2"
                    >
                      <div className={`mx-auto flex min-h-full w-full max-w-[44rem] flex-col ${centerBackContent ? 'justify-center' : 'justify-start'} gap-3 py-1`}>
                        {correctAnswers.map((option, index) => (
                          <div
                            key={`${option.id}-${index}`}
                            className={`rounded-[22px] border text-left ${answerCardPaddingClass}`}
                            style={{
                              background: theme.isDark ? 'rgba(255,255,255,0.055)' : 'rgba(255,255,255,0.78)',
                              borderColor: theme.isDark ? 'rgba(255,255,255,0.10)' : 'rgba(15,23,42,0.08)',
                              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.10), 0 10px 26px rgba(0,0,0,0.07)',
                            }}
                          >
                            <p
                              className="mb-2 text-[10px] font-black uppercase tracking-[0.22em]"
                              style={{ color: theme.text3 }}
                            >
                              Răspunsul de reținut
                            </p>
                            <p
                              className={`${getAnswerTone(option.text, denseLayout)} whitespace-pre-wrap break-words`}
                              style={{ color: theme.text }}
                            >
                              {option.text}
                            </p>
                          </div>
                        ))}
                      </div>

                      {cleanQuestionExplanation(current.question.explanation) && (
                        <div
                          className="rounded-[20px] border p-4 text-left"
                          style={{
                            background: theme.isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.035)',
                            borderColor: theme.isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.07)',
                          }}
                        >
                          <p className="mb-2 text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: theme.text3 }}>
                            Explicația din grilă
                          </p>
                          <p className="text-sm leading-relaxed" style={{ color: theme.text2 }}>{cleanQuestionExplanation(current.question.explanation)}</p>
                        </div>
                      )}

                      {aiExplanation && (
                        <div
                          className="rounded-[22px] border p-4 text-left sm:p-5"
                          style={{
                            background: `linear-gradient(180deg, ${theme.accent}14, ${theme.accent2}0A)`,
                            border: `1px solid ${theme.accent}26`,
                            boxShadow: `0 16px 34px ${theme.accent}12`,
                          }}
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="flex items-center gap-2">
                              <Bot size={15} style={{ color: theme.accent }} />
                              <p className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: theme.accent }}>
                                {hasKey ? 'Clarificare AI' : 'Clarificare ghidată'}
                              </p>
                            </div>
                            <span
                              className="rounded-full px-2.5 py-1 text-[10px] font-bold"
                              style={{
                                background: `${theme.accent}16`,
                                color: theme.accent,
                                border: `1px solid ${theme.accent}22`,
                              }}
                            >
                              Simplu și clar
                            </span>
                          </div>
                          <p className="mt-2 text-xs leading-relaxed" style={{ color: theme.text3 }}>
                            Explicație reformulată pe scurt, într-un ton mai ușor de reținut.
                          </p>
                          <p className="mt-4 whitespace-pre-wrap text-sm leading-7 sm:text-[15px]" style={{ color: theme.text2 }}>
                            {aiExplanation}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="flex-shrink-0">
                      <div className="flex min-h-[36px] items-center justify-center">
                        {!aiExplanation && !aiLoading && (
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              void handleExplain();
                            }}
                            className="press-feedback inline-flex items-center gap-2 rounded-full px-4 py-2 text-[11px] font-black uppercase tracking-[0.2em] transition-all"
                            style={{
                              color: theme.accent,
                              border: `1px solid ${theme.accent}22`,
                              background: `${theme.accent}10`,
                              boxShadow: `0 10px 24px ${theme.accent}10`,
                            }}
                          >
                            <Bot size={14} /> {hasKey ? 'Cere clarificarea AI' : 'Cere clarificare smart'}
                          </button>
                        )}

                        {aiLoading && (
                          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest opacity-70" style={{ color: theme.accent }}>
                            <Loader2 size={14} className="animate-spin" /> Se analizează...
                          </div>
                        )}
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

        <div className={`${cardWidthClass} mx-auto w-full ${crampedHeight ? 'pt-2' : 'pt-3'}`}>
          {flipped ? (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className={`glass-panel premium-shadow rounded-[28px] ${denseLayout ? 'p-3.5 sm:p-4' : 'p-4 sm:p-5'}`}
            >
              <div className={`mb-4 flex items-center justify-between gap-3 ${mobile ? 'flex-col items-start' : ''}`}>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: theme.text3 }}>
                    Evaluare card
                  </p>
                  <p className={dockLabelTextClass} style={{ color: theme.text }}>
                    {dockLabel}
                  </p>
                </div>
              </div>

              <div className={`grid gap-3 ${dockGridClass}`}>
                <button
                  onClick={() => handleRating('hard')}
                  className={`press-feedback flex flex-col items-center rounded-[24px] transition-all group ${denseLayout ? 'gap-1.5 p-3' : 'gap-2 p-4'}`}
                  style={{
                    background: `${theme.danger}10`,
                    border: `1.5px solid ${theme.danger}35`,
                    color: theme.danger,
                    boxShadow: `0 12px 24px ${theme.danger}10`,
                  }}
                >
                  <span className={`${denseLayout ? 'text-xl' : 'text-2xl'} font-black tabular-nums`}>1</span>
                  <span className="font-black">Greu</span>
                  <span className="text-[10px] opacity-60 font-normal">Reia mai curând</span>
                </button>

                <button
                  onClick={() => handleRating('good')}
                  className={`press-feedback flex flex-col items-center rounded-[24px] transition-all group ${denseLayout ? 'gap-1.5 p-3' : 'gap-2 p-4'}`}
                  style={{
                    background: `${theme.accent}10`,
                    border: `1.5px solid ${theme.accent}35`,
                    color: theme.accent,
                    boxShadow: `0 12px 24px ${theme.accent}10`,
                  }}
                >
                  <span className={`${denseLayout ? 'text-xl' : 'text-2xl'} font-black tabular-nums`}>2</span>
                  <span className="font-black">Bine</span>
                  <span className="text-[10px] opacity-60 font-normal">Ritm normal</span>
                </button>

                <button
                  onClick={() => handleRating('easy')}
                  className={`press-feedback flex flex-col items-center rounded-[24px] transition-all group ${denseLayout ? 'gap-1.5 p-3' : 'gap-2 p-4'}`}
                  style={{
                    background: `${theme.success}10`,
                    border: `1.5px solid ${theme.success}35`,
                    color: theme.success,
                    boxShadow: `0 12px 24px ${theme.success}10`,
                  }}
                >
                  <span className={`${denseLayout ? 'text-xl' : 'text-2xl'} font-black tabular-nums`}>3</span>
                  <span className="font-black">Ușor</span>
                  <span className="text-[10px] opacity-60 font-normal">Revino mai târziu</span>
                </button>
              </div>
            </motion.div>
          ) : (
            <div className="pb-1 text-center text-xs font-medium" style={{ color: theme.text2 }}>
              {dockLabel}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
