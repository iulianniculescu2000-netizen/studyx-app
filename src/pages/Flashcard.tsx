import { motion, AnimatePresence } from 'framer-motion';
import { useState, useMemo, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, RotateCcw, Shuffle, Check, X } from 'lucide-react';
import { useQuizStore } from '../store/quizStore';
import { useTheme } from '../theme/ThemeContext';
import { HERO_COLOR_MAP } from '../theme/colorMaps';

function shuffleArr<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function Flashcard() {
  const { id } = useParams<{ id: string }>();
  const { quizzes } = useQuizStore();
  const theme = useTheme();
  const quiz = quizzes.find(q => q.id === id);

  const [isShuffled, setIsShuffled] = useState(false);
  const [seed, setSeed] = useState(0);

  const cards = useMemo(() => {
    const qs = quiz?.questions ?? [];
    return isShuffled ? shuffleArr(qs) : qs;
  }, [quiz, isShuffled, seed]);

  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState<Set<string>>(new Set());
  const [unknown, setUnknown] = useState<Set<string>>(new Set());

  const card = cards[idx];
  const colors = HERO_COLOR_MAP[quiz?.color ?? 'blue'] ?? HERO_COLOR_MAP.blue;
  const correctAnswers = card?.options.filter(o => o.isCorrect).map(o => o.text) ?? [];

  const goNext = useCallback(() => {
    setFlipped(false);
    setTimeout(() => setIdx(i => Math.min(i + 1, cards.length - 1)), 150);
  }, [cards.length]);

  const goPrev = useCallback(() => {
    setFlipped(false);
    setTimeout(() => setIdx(i => Math.max(i - 1, 0)), 150);
  }, []);

  const markKnown = () => {
    setKnown(s => new Set([...s, card.id]));
    setUnknown(s => { const n = new Set(s); n.delete(card.id); return n; });
    goNext();
  };

  const markUnknown = () => {
    setUnknown(s => new Set([...s, card.id]));
    setKnown(s => { const n = new Set(s); n.delete(card.id); return n; });
    goNext();
  };

  const reset = () => {
    setIdx(0);
    setFlipped(false);
    setKnown(new Set());
    setUnknown(new Set());
    if (isShuffled) setSeed(s => s + 1);
  };

  if (!quiz || !card) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p style={{ color: theme.text2 }}>Grila nu a fost găsită.</p>
      </div>
    );
  }

  const progress = ((idx + 1) / cards.length) * 100;
  const isLast = idx === cards.length - 1;

  return (
    <div className="h-full overflow-y-auto px-6 py-8">
      <div className="max-w-xl mx-auto">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <Link to={`/quiz/${quiz.id}`}
            className="flex items-center gap-1.5 text-sm hover:opacity-80 transition-all mb-3"
            style={{ color: theme.text3 }}>
            <ChevronLeft size={15} />{quiz.title}
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold" style={{ color: theme.text }}>Flashcarduri</h1>
              <p className="text-sm" style={{ color: theme.text3 }}>
                {idx + 1} / {cards.length} · {known.size} știute · {unknown.size} de revăzut
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => { setIsShuffled(!isShuffled); setSeed(s => s + 1); setIdx(0); setFlipped(false); }}
                className="p-2 rounded-xl transition-all hover:opacity-80"
                style={{ background: isShuffled ? `${theme.accent}20` : theme.surface, color: isShuffled ? theme.accent : theme.text3, border: `1px solid ${theme.border}` }}>
                <Shuffle size={15} />
              </button>
              <button onClick={reset}
                className="p-2 rounded-xl transition-all hover:opacity-80"
                style={{ background: theme.surface, color: theme.text3, border: `1px solid ${theme.border}` }}>
                <RotateCcw size={15} />
              </button>
            </div>
          </div>
        </motion.div>

        {/* Progress bar */}
        <div className="h-1.5 rounded-full mb-6 overflow-hidden" style={{ background: theme.surface2 }}>
          <motion.div className="h-full rounded-full" animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }} style={{ background: colors.gradient }} />
        </div>

        {/* Known / Unknown indicators */}
        <div className="flex gap-2 mb-4">
          <div className="flex items-center gap-1 text-xs" style={{ color: theme.success }}>
            <Check size={12} />{known.size} știute
          </div>
          <div className="flex items-center gap-1 text-xs" style={{ color: theme.danger }}>
            <X size={12} />{unknown.size} de revăzut
          </div>
          {card && known.has(card.id) && (
            <span className="text-xs px-2 py-0.5 rounded-full ml-auto"
              style={{ background: `${theme.success}18`, color: theme.success }}>✓ Știută</span>
          )}
          {card && unknown.has(card.id) && (
            <span className="text-xs px-2 py-0.5 rounded-full ml-auto"
              style={{ background: `${theme.danger}18`, color: theme.danger }}>✗ De revăzut</span>
          )}
        </div>

        {/* Card */}
        <AnimatePresence mode="wait">
          <motion.div
            key={`${idx}-${flipped}`}
            initial={{ opacity: 0, rotateY: flipped ? -90 : 90, scale: 0.96 }}
            animate={{ opacity: 1, rotateY: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.94 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            onClick={() => setFlipped(f => !f)}
            className="cursor-pointer rounded-3xl p-8 mb-6 min-h-[260px] flex flex-col items-center justify-center text-center select-none"
            style={{
              background: flipped
                ? `linear-gradient(135deg, ${theme.surface} 0%, ${theme.surface2} 100%)`
                : colors.gradient,
              border: `1px solid ${flipped ? theme.border : 'transparent'}`,
              boxShadow: flipped ? 'none' : `0 20px 60px ${colors.glow}`,
            }}
          >
            <div className="text-xs font-semibold uppercase tracking-widest mb-4 opacity-60"
              style={{ color: flipped ? theme.text3 : 'rgba(255,255,255,0.7)' }}>
              {flipped ? 'Răspuns' : 'Întrebare'} · apasă pentru a întoarce
            </div>
            {!flipped ? (
              <>
                {card.imageUrl && (
                  <img src={card.imageUrl} alt="" className="max-h-32 object-contain rounded-xl mb-4" />
                )}
                <p className="text-lg font-semibold text-white leading-relaxed">{card.text}</p>
                {card.difficulty && (
                  <span className="mt-4 text-xs px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(255,255,255,0.2)', color: 'white' }}>
                    {card.difficulty === 'easy' ? 'Ușor' : card.difficulty === 'medium' ? 'Mediu' : 'Dificil'}
                  </span>
                )}
              </>
            ) : (
              <>
                <div className="space-y-2 w-full">
                  {correctAnswers.map((ans, i) => (
                    <div key={i} className="flex items-center gap-2 px-4 py-2.5 rounded-xl"
                      style={{ background: `${theme.success}15`, border: `1px solid ${theme.success}30` }}>
                      <Check size={14} style={{ color: theme.success, flexShrink: 0 }} />
                      <p className="text-sm font-medium text-left" style={{ color: theme.text }}>{ans}</p>
                    </div>
                  ))}
                </div>
                {card.explanation && (
                  <p className="text-xs mt-4 leading-relaxed" style={{ color: theme.text3 }}>{card.explanation}</p>
                )}
              </>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex items-center gap-3">
          <button onClick={goPrev} disabled={idx === 0}
            className="p-3 rounded-2xl transition-all hover:opacity-80 disabled:opacity-30"
            style={{ background: theme.surface, border: `1px solid ${theme.border}`, color: theme.text2 }}>
            <ChevronLeft size={18} />
          </button>

          {flipped && (
            <>
              <button onClick={markUnknown}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-medium text-sm transition-all hover:opacity-80"
                style={{ background: `${theme.danger}15`, border: `1px solid ${theme.danger}30`, color: theme.danger }}>
                <X size={15} />Nu știu
              </button>
              <button onClick={markKnown}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-medium text-sm transition-all hover:opacity-80"
                style={{ background: `${theme.success}15`, border: `1px solid ${theme.success}30`, color: theme.success }}>
                <Check size={15} />Știu!
              </button>
            </>
          )}

          {!flipped && (
            <button onClick={() => setFlipped(true)}
              className="flex-1 py-3 rounded-2xl font-medium text-sm text-white transition-all hover:opacity-90"
              style={{ background: colors.gradient }}>
              Întoarce cardul
            </button>
          )}

          <button onClick={isLast ? reset : goNext} disabled={!flipped && !isLast}
            className="p-3 rounded-2xl transition-all hover:opacity-80 disabled:opacity-30"
            style={{ background: theme.surface, border: `1px solid ${theme.border}`, color: theme.text2 }}>
            {isLast ? <RotateCcw size={18} /> : <ChevronRight size={18} />}
          </button>
        </div>

        {/* Summary after last card */}
        {isLast && flipped && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="mt-6 rounded-2xl p-5 text-center"
            style={{ background: theme.surface, border: `1px solid ${theme.border}` }}>
            <p className="text-2xl mb-2">🎉</p>
            <p className="font-semibold mb-1" style={{ color: theme.text }}>Ai terminat setul!</p>
            <p className="text-sm" style={{ color: theme.text3 }}>
              {known.size} știute · {unknown.size} de revăzut · {cards.length - known.size - unknown.size} nemarcate
            </p>
            <button onClick={reset} className="mt-4 px-4 py-2 rounded-xl text-sm font-medium text-white transition-all hover:opacity-90"
              style={{ background: colors.gradient }}>
              Reia
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
