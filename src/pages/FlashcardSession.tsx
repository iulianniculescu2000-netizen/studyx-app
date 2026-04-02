import { motion, AnimatePresence } from 'framer-motion';
import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useParams, useSearchParams, Link, useNavigate } from 'react-router-dom';
import {
  ChevronLeft, RotateCcw, Check, Brain, Clock,
  ArrowLeft, SkipForward, Bot, Loader2,
} from 'lucide-react';
import { useQuizStore } from '../store/quizStore';
import { useStatsStore } from '../store/statsStore';
import { useTheme } from '../theme/ThemeContext';
import { useAIStore } from '../store/aiStore';
import { groqChat } from '../lib/groq';
import { HERO_COLOR_MAP, CARD_COLOR_MAP } from '../theme/colorMaps';
import type { Question, Quiz } from '../types';

/* ─── Types ─────────────────────────────────────────────────────────── */
interface CardItem {
  question: Question;
  quiz: Quiz;
}

type Rating = 'easy' | 'ok' | 'hard';

/* ─── Helpers ────────────────────────────────────────────────────────── */
function shuffleArr<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function formatDuration(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

/* ─── Animated 3-D Card ─────────────────────────────────────────────── */
function FlipCard({
  card, flipped, onFlip, colors,
}: {
  card: CardItem; flipped: boolean; onFlip: () => void; colors: { gradient: string; glow: string };
}) {
  const theme = useTheme();
  const { hasKey } = useAIStore();
  const correctAnswers = card.question.options.filter(o => o.isCorrect).map(o => o.text);
  const [aiExpl, setAiExpl] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  const explainWithAI = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (aiLoading || aiExpl) return;
    setAiLoading(true);
    try {
      const correct = correctAnswers.join(', ');
      const result = await groqChat([{
        role: 'user',
        content: `Explică pe scurt (3-4 fraze, în română) conceptul medical din spatele acestei întrebări de grilă:\n\nÎntrebare: ${card.question.text}\nRăspuns corect: ${correct}${card.question.explanation ? `\nExplicație existentă: ${card.question.explanation}` : ''}\n\nFii concis și practic, ca un profesor medical.`,
      }], 0.4);
      if (mountedRef.current) setAiExpl(result);
    } catch {
      if (mountedRef.current) setAiExpl('Nu s-a putut genera explicația.');
    } finally {
      if (mountedRef.current) setAiLoading(false);
    }
  };

  return (
    <div
      className="relative cursor-pointer select-none"
      style={{ perspective: 1200 }}
      onClick={!flipped ? onFlip : undefined}
    >
      <motion.div
        animate={{ rotateY: flipped ? 180 : 0, filter: flipped ? ['blur(0px)', 'blur(3px)', 'blur(0px)'] : ['blur(0px)', 'blur(3px)', 'blur(0px)'] }}
        transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
        style={{ transformStyle: 'preserve-3d', position: 'relative', minHeight: 280 }}
      >
        {/* FRONT */}
        <div
          className="absolute inset-0 rounded-3xl p-8 flex flex-col items-center justify-center text-center overflow-hidden"
          style={{
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            background: colors.gradient,
            boxShadow: `0 24px 64px ${colors.glow}`,
          } as any}
        >
          {/* Decorative rings */}
          <div className="absolute top-0 right-0 w-40 h-40 rounded-full opacity-10"
            style={{ background: 'radial-gradient(circle, white 0%, transparent 70%)', transform: 'translate(30%, -30%)' }} />
          <div className="absolute bottom-0 left-0 w-32 h-32 rounded-full opacity-10"
            style={{ background: 'radial-gradient(circle, white 0%, transparent 70%)', transform: 'translate(-30%, 30%)' }} />

          <div className="relative z-10 w-full">
            <div className="text-xs font-semibold uppercase tracking-widest mb-5 opacity-60 text-white">
              Întrebare · apasă să întoarci
            </div>
            {card.question.imageUrl && (
              <img
                src={card.question.imageUrl}
                alt=""
                className="max-h-36 object-contain rounded-2xl mb-4 mx-auto"
                style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}
              />
            )}
            <p className="text-lg font-semibold text-white leading-relaxed">{card.question.text}</p>
            {card.question.difficulty && (
              <span className="inline-block mt-4 text-xs px-3 py-1 rounded-full"
                style={{ background: 'rgba(255,255,255,0.18)', color: 'white' }}>
                {card.question.difficulty === 'easy' ? 'Ușor' : card.question.difficulty === 'medium' ? 'Mediu' : 'Dificil'}
              </span>
            )}
          </div>
        </div>

        {/* BACK */}
        <div
          className="absolute inset-0 rounded-3xl p-8 flex flex-col items-center justify-center overflow-auto"
          style={{
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transform: 'rotateY(180deg) translateZ(1px)',
            background: theme.surface,
            border: `1px solid ${theme.border}`,
          } as any}
        >
          <div style={{ width: '100%', transform: 'translateZ(0)' }}>
            <div className="text-xs font-semibold uppercase tracking-widest mb-5 opacity-50 text-center"
              style={{ color: theme.text3 }}>
              Răspuns corect
            </div>
            <div className="space-y-2 w-full">
              {correctAnswers.map((ans, i) => (
                <div key={i} className="flex items-start gap-3 px-4 py-3 rounded-2xl"
                  style={{ background: `${theme.success}14`, border: `1px solid ${theme.success}28` }}>
                  <Check size={15} className="flex-shrink-0 mt-0.5" style={{ color: theme.success }} />
                  <p className="text-sm font-medium text-left leading-relaxed" style={{ color: theme.text }}>{ans}</p>
                </div>
              ))}
            </div>
            {card.question.explanation && (
              <div className="mt-4 px-4 py-3 rounded-2xl w-full"
                style={{ background: theme.surface2, border: `1px solid ${theme.border}` }}>
                <p className="text-xs leading-relaxed" style={{ color: theme.text3 }}>
                  💡 {card.question.explanation}
                </p>
              </div>
            )}
            {hasKey() && (
              <div className="mt-3 w-full">
                {!aiExpl && (
                  <button onClick={explainWithAI} disabled={aiLoading}
                    className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium transition-all"
                    style={{
                      background: `${theme.accent}12`,
                      border: `1px solid ${theme.accent}25`,
                      color: theme.accent,
                    }}>
                    {aiLoading ? <><Loader2 size={11} className="animate-spin" />Generez explicație...</> : <><Bot size={11} />Explică mai mult cu AI</>}
                  </button>
                )}
                {aiExpl && (
                  <div className="px-3 py-2.5 rounded-xl text-xs leading-relaxed"
                    style={{ background: `${theme.accent}10`, border: `1px solid ${theme.accent}20`, color: theme.text2 }}>
                    🤖 {aiExpl}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

/* ─── Session Summary ───────────────────────────────────────────────── */
function SessionSummary({
  ratings, durationSeconds, onRestart, onBack,
}: {
  ratings: Rating[];
  cards?: CardItem[];
  durationSeconds: number;
  onRestart: () => void;
  onBack: () => void;
}) {
  const theme = useTheme();
  const easy = ratings.filter(r => r === 'easy').length;
  const ok = ratings.filter(r => r === 'ok').length;
  const hard = ratings.filter(r => r === 'hard').length;
  const total = ratings.length;
  const accuracy = total > 0 ? Math.round(((easy + ok) / total) * 100) : 0;

  const emoji = accuracy >= 90 ? '🏆' : accuracy >= 70 ? '⭐' : accuracy >= 50 ? '💪' : '📚';
  const message = accuracy >= 90 ? 'Excelent! Stăpânești materia!'
    : accuracy >= 70 ? 'Foarte bine! Continuă!'
    : accuracy >= 50 ? 'Bun progres! Mai exersează!'
    : 'Practică face perfectul!';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="max-w-md mx-auto px-4 py-8"
    >
      {/* Hero result */}
      <div className="text-center mb-8">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.15, type: 'spring', stiffness: 280, damping: 18 }}
          className="text-6xl mb-4"
        >
          {emoji}
        </motion.div>
        <h2 className="text-2xl font-bold mb-2" style={{ color: theme.text }}>{message}</h2>
        <p className="text-sm" style={{ color: theme.text3 }}>
          {total} carduri · {formatDuration(durationSeconds)}
        </p>
      </div>

      {/* Accuracy ring + breakdown */}
      <div className="rounded-3xl p-6 mb-4" style={{ background: theme.surface, border: `1px solid ${theme.border}` }}>
        <div className="flex items-center justify-center mb-6">
          <div className="relative w-28 h-28">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 112 112">
              <circle cx="56" cy="56" r="48" fill="none" stroke={`${theme.accent}20`} strokeWidth="8" />
              <motion.circle
                cx="56" cy="56" r="48" fill="none" stroke={theme.accent} strokeWidth="8"
                strokeDasharray={2 * Math.PI * 48}
                initial={{ strokeDashoffset: 2 * Math.PI * 48 }}
                animate={{ strokeDashoffset: 2 * Math.PI * 48 * (1 - accuracy / 100) }}
                transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold" style={{ color: theme.accent }}>{accuracy}%</span>
              <span className="text-xs" style={{ color: theme.text3 }}>acuratețe</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Ușor', count: easy, color: theme.success, icon: '✓' },
            { label: 'Ok', count: ok, color: theme.accent, icon: '◎' },
            { label: 'Greu', count: hard, color: theme.danger, icon: '✗' },
          ].map(({ label, count, color, icon }) => (
            <div key={label} className="text-center p-3 rounded-2xl"
              style={{ background: `${color}12`, border: `1px solid ${color}25` }}>
              <div className="text-lg font-bold" style={{ color }}>{icon}</div>
              <div className="text-xl font-bold" style={{ color }}>{count}</div>
              <div className="text-xs" style={{ color: theme.text3 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="p-4 rounded-2xl flex items-center gap-3"
          style={{ background: theme.surface, border: `1px solid ${theme.border}` }}>
          <Clock size={18} style={{ color: theme.accent }} />
          <div>
            <p className="text-xs" style={{ color: theme.text3 }}>Durată</p>
            <p className="font-semibold text-sm" style={{ color: theme.text }}>{formatDuration(durationSeconds)}</p>
          </div>
        </div>
        <div className="p-4 rounded-2xl flex items-center gap-3"
          style={{ background: theme.surface, border: `1px solid ${theme.border}` }}>
          <Brain size={18} style={{ color: theme.accent2 }} />
          <div>
            <p className="text-xs" style={{ color: theme.text3 }}>Carduri/min</p>
            <p className="font-semibold text-sm" style={{ color: theme.text }}>
              {durationSeconds > 0 ? (total / (durationSeconds / 60)).toFixed(1) : '-'}
            </p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-3 rounded-2xl text-sm font-medium flex-1"
          style={{ background: theme.surface, border: `1px solid ${theme.border}`, color: theme.text2 }}
        >
          <ArrowLeft size={15} />
          Înapoi la deck-uri
        </button>
        <button
          onClick={onRestart}
          className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-sm font-semibold text-white flex-1"
          style={{ background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})` }}
        >
          <RotateCcw size={15} />
          Reia sesiunea
        </button>
      </div>
    </motion.div>
  );
}

/* ─── Main Page ─────────────────────────────────────────────────────── */
export default function FlashcardSession() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const theme = useTheme();
  const { quizzes } = useQuizStore();
  const { questionStats, recordAnswer, recordStudySession } = useStatsStore();

  const modeAll = searchParams.get('mode') === 'all';

  /* ── Build card queue ── */
  const initialCards = useMemo<CardItem[]>(() => {
    const now = Date.now();

    if (id === 'all') {
      // Cross-deck: all due questions from all quizzes
      const items: CardItem[] = [];
      quizzes.filter(q => !q.archived && q.questions.length > 0).forEach(quiz => {
        quiz.questions.forEach(question => {
          const stat = questionStats[`${quiz.id}:${question.id}`];
          if (!stat || (stat.nextReview > 0 && stat.nextReview <= now)) {
            items.push({ question, quiz });
          }
        });
      });
      return shuffleArr(items);
    }

    const quiz = quizzes.find(q => q.id === id);
    if (!quiz) return [];

    const items: CardItem[] = quiz.questions
      .filter(question => {
        if (modeAll) return true;
        const stat = questionStats[`${quiz.id}:${question.id}`];
        return !stat || (stat.nextReview > 0 && stat.nextReview <= now);
      })
      .map(question => ({ question, quiz }));

    return modeAll ? items : shuffleArr(items);
  }, [id, quizzes, questionStats, modeAll]);

  /* ── Session state ── */
  const [cards, setCards] = useState<CardItem[]>(initialCards);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [sessionDone, setSessionDone] = useState(false);
  const [cardKey, setCardKey] = useState(0);

  const startTime = useRef(Date.now());
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime.current) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const currentCard = cards[currentIdx];
  const progress = cards.length > 0 ? (currentIdx / cards.length) * 100 : 0;

  /* ── Rating handler ── */
  const handleRating = useCallback((rating: Rating) => {
    if (!currentCard || !flipped) return;

    const correct = rating !== 'hard';
    recordAnswer(currentCard.quiz.id, currentCard.question.id, correct);

    const newRatings = [...ratings, rating];
    setRatings(newRatings);

    if (currentIdx + 1 >= cards.length) {
      // End of session
      const duration = Math.floor((Date.now() - startTime.current) / 1000);
      recordStudySession(duration);
      setSessionDone(true);
    } else {
      setFlipped(false);
      setTimeout(() => {
        setCurrentIdx(i => i + 1);
        setCardKey(k => k + 1);
      }, 120);
    }
  }, [currentCard, flipped, ratings, currentIdx, cards.length, recordAnswer, recordStudySession]);

  /* ── Skip handler ── */
  const handleSkip = useCallback(() => {
    if (currentIdx + 1 >= cards.length) {
      const duration = Math.floor((Date.now() - startTime.current) / 1000);
      recordStudySession(duration);
      setSessionDone(true);
    } else {
      setFlipped(false);
      setTimeout(() => {
        setCurrentIdx(i => i + 1);
        setCardKey(k => k + 1);
      }, 120);
    }
  }, [currentIdx, cards.length, recordStudySession]);

  /* ── Keyboard shortcuts ── */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (sessionDone) return;

      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        if (!flipped) setFlipped(true);
      }
      if (flipped) {
        if (e.key === '1') handleRating('hard');
        if (e.key === '2') handleRating('ok');
        if (e.key === '3') handleRating('easy');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [flipped, sessionDone, handleRating]);

  /* ── Restart ── */
  const handleRestart = () => {
    setCards(shuffleArr(initialCards));
    setCurrentIdx(0);
    setFlipped(false);
    setRatings([]);
    setSessionDone(false);
    setCardKey(k => k + 1);
    startTime.current = Date.now();
    setElapsed(0);
  };

  /* ── Colors ── */
  const colors = currentCard
    ? (HERO_COLOR_MAP[currentCard.quiz.color] ?? HERO_COLOR_MAP.blue)
    : HERO_COLOR_MAP.blue;
  const cardColors = currentCard
    ? (CARD_COLOR_MAP[currentCard.quiz.color] ?? CARD_COLOR_MAP.blue)
    : CARD_COLOR_MAP.blue;

  /* ── Empty state ── */
  if (initialCards.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center px-8 py-12">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-sm"
        >
          <div className="text-5xl mb-4">🎉</div>
          <h2 className="text-xl font-bold mb-2" style={{ color: theme.text }}>
            {modeAll ? 'Niciun card în acest deck' : 'Nicio carte de recapitulat!'}
          </h2>
          <p className="text-sm mb-6" style={{ color: theme.text3 }}>
            {modeAll
              ? 'Deck-ul este gol sau nu are întrebări.'
              : 'Toate cardurile sunt la zi. Revino mai târziu pentru a continua studiul.'}
          </p>
          <Link
            to="/flashcards"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-semibold text-white"
            style={{ background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})` }}
          >
            <ArrowLeft size={14} />Înapoi la Flashcarduri
          </Link>
        </motion.div>
      </div>
    );
  }

  /* ── Session done ── */
  if (sessionDone) {
    return (
      <div className="h-full overflow-y-auto">
        <SessionSummary
          ratings={ratings}
          cards={cards}
          durationSeconds={elapsed}
          onRestart={handleRestart}
          onBack={() => navigate('/flashcards')}
        />
      </div>
    );
  }

  /* ── Active session ── */
  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-lg mx-auto px-4 py-6">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-5"
        >
          <Link to="/flashcards"
            className="flex items-center gap-1.5 text-sm hover:opacity-70 transition-opacity"
            style={{ color: theme.text3 }}>
            <ChevronLeft size={15} />
            Flashcarduri
          </Link>

          <div className="flex items-center gap-3">
            {/* Deck info */}
            {id !== 'all' && currentCard && (
              <div className="flex items-center gap-1.5">
                <span className="text-sm">{currentCard.quiz.emoji}</span>
                <span className="text-xs font-medium truncate max-w-[120px]" style={{ color: theme.text3 }}>
                  {currentCard.quiz.title}
                </span>
              </div>
            )}

            {/* Timer */}
            <div className="flex items-center gap-1 text-xs" style={{ color: theme.text3 }}>
              <Clock size={12} />
              {formatDuration(elapsed)}
            </div>
          </div>
        </motion.div>

        {/* Progress bar + counter */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold" style={{ color: theme.text3 }}>
              {currentIdx + 1} / {cards.length}
            </span>
            <div className="flex items-center gap-2 text-xs">
              <span style={{ color: theme.success }}>✓ {ratings.filter(r => r !== 'hard').length}</span>
              <span style={{ color: theme.danger }}>✗ {ratings.filter(r => r === 'hard').length}</span>
            </div>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: theme.surface2 }}>
            <motion.div
              className="h-full rounded-full"
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              style={{ background: `linear-gradient(90deg, ${cardColors.from.replace(/[^,]+\)/, '1)')}, ${cardColors.to.replace(/[^,]+\)/, '1)')})` }}
            />
          </div>
        </div>

        {/* Card */}
        <AnimatePresence mode="wait">
          <motion.div
            key={cardKey}
            initial={{ opacity: 0, x: 32, scale: 0.97 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -32, scale: 0.97 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="mb-5"
          >
            {currentCard && (
              <FlipCard
                card={currentCard}
                flipped={flipped}
                onFlip={() => setFlipped(true)}
                colors={colors}
              />
            )}
          </motion.div>
        </AnimatePresence>

        {/* Actions */}
        <AnimatePresence mode="wait">
          {!flipped ? (
            <motion.div
              key="reveal"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className="space-y-3"
            >
              <button
                onClick={() => setFlipped(true)}
                className="w-full py-4 rounded-2xl font-semibold text-white text-sm transition-opacity hover:opacity-90"
                style={{ background: colors.gradient, boxShadow: `0 8px 24px ${colors.glow}` }}
              >
                Întoarce cardul · Space
              </button>
              <button
                onClick={handleSkip}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl text-xs transition-opacity hover:opacity-70"
                style={{ color: theme.text3 }}
              >
                <SkipForward size={12} />
                Sară peste
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="rate"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
            >
              <p className="text-center text-xs font-semibold uppercase tracking-widest mb-3"
                style={{ color: theme.text3 }}>
                Cât de bine ai știut?
              </p>
              <div className="grid grid-cols-3 gap-3">
                {/* Greu */}
                <button
                  onClick={() => handleRating('hard')}
                  className="flex flex-col items-center gap-1.5 py-3.5 rounded-2xl text-sm font-semibold transition-all hover:scale-[1.03] active:scale-[0.98]"
                  style={{
                    background: `${theme.danger}14`,
                    border: `1.5px solid ${theme.danger}35`,
                    color: theme.danger,
                  }}
                >
                  <span className="text-xl">😰</span>
                  <span>Greu</span>
                  <span className="text-[10px] opacity-60 font-normal">Mâine · 1</span>
                </button>

                {/* Ok */}
                <button
                  onClick={() => handleRating('ok')}
                  className="flex flex-col items-center gap-1.5 py-3.5 rounded-2xl text-sm font-semibold transition-all hover:scale-[1.03] active:scale-[0.98]"
                  style={{
                    background: `${theme.accent}14`,
                    border: `1.5px solid ${theme.accent}35`,
                    color: theme.accent,
                  }}
                >
                  <span className="text-xl">🤔</span>
                  <span>Ok</span>
                  <span className="text-[10px] opacity-60 font-normal">Normal · 2</span>
                </button>

                {/* Ușor */}
                <button
                  onClick={() => handleRating('easy')}
                  className="flex flex-col items-center gap-1.5 py-3.5 rounded-2xl text-sm font-semibold transition-all hover:scale-[1.03] active:scale-[0.98]"
                  style={{
                    background: `${theme.success}14`,
                    border: `1.5px solid ${theme.success}35`,
                    color: theme.success,
                  }}
                >
                  <span className="text-xl">😊</span>
                  <span>Ușor</span>
                  <span className="text-[10px] opacity-60 font-normal">Rapid · 3</span>
                </button>
              </div>

              <p className="text-center text-xs mt-3 opacity-40" style={{ color: theme.text3 }}>
                Tastă 1 · 2 · 3
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Keyboard hint */}
        {!flipped && (
          <p className="text-center text-xs mt-4 opacity-30" style={{ color: theme.text3 }}>
            Space sau Enter pentru a întoarce
          </p>
        )}
      </div>
    </div>
  );
}
