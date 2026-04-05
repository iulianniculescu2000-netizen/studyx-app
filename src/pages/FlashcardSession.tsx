import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { 
  ChevronLeft, Check, Brain, 
  Sparkles, Trophy, Loader2, Bot
} from 'lucide-react';
import { useQuizStore } from '../store/quizStore';
import { useStatsStore } from '../store/statsStore';
import { useTheme } from '../theme/ThemeContext';
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

export default function FlashcardSession() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const theme = useTheme();
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
      quizzes.filter((q) => !q.archived && q.questions.length > 0).forEach((quiz) => {
        quiz.questions.forEach((question) => {
          const stat = questionStats[`${quiz.id}:${question.id}`];
          if (!stat || (stat.nextReview > 0 && stat.nextReview <= now)) {
            items.push({ question, quiz });
          }
        });
      });
      return shuffleArr(items);
    }

    const quiz = quizzes.find((q) => q.id === id);
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

  const [cards] = useState<CardItem[]>(initialCards);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [sessionDone, setSessionDone] = useState(false);
  const [cardKey, setCardKey] = useState(0);

  const startTime = useRef(0);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    startTime.current = Date.now();
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime.current) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const handleRating = useCallback((rating: Rating) => {
    if (!cards[currentIdx]) return;
    const { question, quiz } = cards[currentIdx];
    
    // In SM-2 context for Flashcards:
    // Easy -> correct=true
    // Good -> correct=true
    // Hard -> correct=false (reset interval)
    const isCorrect = rating !== 'hard';
    recordAnswer(quiz.id, question.id, isCorrect);
    setRatings(prev => [...prev, rating]);

    if (currentIdx + 1 < cards.length) {
      setFlipped(false);
      setAiExplanation(null);
      setCurrentIdx(i => i + 1);
      setCardKey(k => k + 1);
    } else {
      recordStudySession(elapsed);
      setSessionDone(true);
    }
  }, [cards, currentIdx, recordAnswer, recordStudySession, elapsed]);

  const handleExplain = async () => {
    if (aiLoading || !cards[currentIdx]) return;
    setAiLoading(true);
    const { question } = cards[currentIdx];
    const correctText = question.options.filter(o => o.isCorrect).map(o => o.text).join(', ');
    try {
      const exp = await explainWrongAnswer(question.text, 'Am uitat contextul', correctText);
      setAiExplanation(exp);
    } catch {
      setAiExplanation('Nu s-a putut genera explicația.');
    } finally {
      setAiLoading(false);
    }
  };

  useEffect(() => {
    const handleKeys = (e: KeyboardEvent) => {
      if (sessionDone) return;
      if (e.code === 'Space' || e.key === 'Enter') {
        if (!flipped) setFlipped(true);
      }
      if (flipped) {
        if (e.key === '1') handleRating('hard');
        if (e.key === '2') handleRating('good');
        if (e.key === '3') handleRating('easy');
      }
    };
    window.addEventListener('keydown', handleKeys);
    return () => window.removeEventListener('keydown', handleKeys);
  }, [flipped, handleRating, sessionDone]);

  if (sessionDone) {
    const hardCount = ratings.filter(r => r === 'hard').length;
    const goodCount = ratings.filter(r => r === 'good').length;
    const easyCount = ratings.filter(r => r === 'easy').length;

    return (
      <div className="h-full flex items-center justify-center px-6">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full text-center">
          <div className="w-20 h-20 rounded-3xl mx-auto mb-6 flex items-center justify-center"
            style={{ background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})`, boxShadow: `0 16px 40px ${theme.accent}30` }}>
            <Trophy size={36} className="text-white" />
          </div>
          <h2 className="text-3xl font-black tracking-tight mb-2" style={{ color: theme.text }}>Sesiune Încheiată</h2>
          <p className="text-sm font-medium opacity-60 mb-10" style={{ color: theme.text }}>
            Ai parcurs {cards.length} flashcarduri în {Math.floor(elapsed / 60)}m {elapsed % 60}s.
          </p>

          <div className="grid grid-cols-3 gap-3 mb-10">
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

          <button onClick={() => navigate('/flashcards')}
            className="w-full py-4 rounded-2xl font-black uppercase tracking-widest text-xs text-white shadow-2xl transition-all hover:scale-102 active:scale-98"
            style={{ background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})`, boxShadow: `0 12px 30px ${theme.accent}40` }}>
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
  const progress = ((currentIdx) / cards.length) * 100;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Progress */}
      <div className="px-6 pt-6">
        <div className="max-w-2xl mx-auto flex items-center justify-between mb-2">
          <button onClick={() => navigate('/flashcards')} className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest opacity-50 hover:opacity-100 transition-opacity" style={{ color: theme.text }}>
            <ChevronLeft size={14} /> Ieșire
          </button>
          <span className="text-xs font-black tabular-nums" style={{ color: theme.text3 }}>
            {currentIdx + 1} / {cards.length}
          </span>
        </div>
        <div className="max-w-2xl mx-auto h-1.5 rounded-full bg-white/5 overflow-hidden">
          <motion.div className="h-full bg-accent" 
            style={{ background: `linear-gradient(90deg, ${theme.accent}, ${theme.accent2})` }}
            animate={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-6 relative" style={{ perspective: '1200px' }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={cardKey}
            initial={{ opacity: 0, x: 20, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            onClick={() => !flipped && setFlipped(true)}
            className={`w-full max-w-2xl aspect-[4/3] sm:aspect-[16/10] relative cursor-pointer preserve-3d transition-transform duration-700 ${flipped ? 'rotate-y-180' : ''}`}
          >
            {/* Front */}
            <div className="absolute inset-0 backface-hidden rounded-[40px] p-8 sm:p-12 glass-panel flex flex-col items-center justify-center text-center shadow-2xl border border-white/10"
              style={{ background: theme.surface }}>
              <div className="absolute top-8 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10">
                <Brain size={14} style={{ color: theme.accent }} />
                <span className="text-[10px] font-black uppercase tracking-widest opacity-50" style={{ color: theme.text }}>{current.quiz.title}</span>
              </div>
              <h2 className="text-xl sm:text-3xl font-bold leading-tight" style={{ color: theme.text }}>
                {current.question.text}
              </h2>
              {current.question.imageUrl && (
                <div className="mt-6 rounded-2xl overflow-hidden max-h-40 shadow-lg border border-white/5">
                  <QuizImage src={current.question.imageUrl} />
                </div>
              )}
              <div className="absolute bottom-10 text-[10px] font-black uppercase tracking-[0.2em] opacity-30" style={{ color: theme.text }}>
                Apasă pentru a vedea răspunsul
              </div>
            </div>

            {/* Back */}
            <div className="absolute inset-0 backface-hidden rotate-y-180 rounded-[40px] p-8 sm:p-12 glass-panel flex flex-col items-center justify-center text-center shadow-2xl border border-white/10"
              style={{ background: theme.isDark ? 'rgba(30,30,35,0.95)' : 'rgba(255,255,255,0.95)' }}>
              <div className="absolute top-8 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10">
                <Check size={14} style={{ color: theme.success }} />
                <span className="text-[10px] font-black uppercase tracking-widest opacity-50" style={{ color: theme.text }}>Răspuns Corect</span>
              </div>
              
              <div className="w-full max-h-[60%] overflow-y-auto custom-scrollbar px-4">
                {current.question.options.filter(o => o.isCorrect).map((o, i) => (
                  <div key={i} className="text-xl sm:text-2xl font-black mb-2" style={{ color: theme.text }}>
                    {o.text}
                  </div>
                ))}
                
                {current.question.explanation && (
                  <div className="mt-6 p-4 rounded-2xl text-left bg-white/5 border border-white/5">
                    <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: theme.text3 }}>Explicație</p>
                    <p className="text-sm leading-relaxed" style={{ color: theme.text2 }}>{current.question.explanation}</p>
                  </div>
                )}

                {aiExplanation && (
                  <div className="mt-4 p-4 rounded-2xl text-left" style={{ background: `${theme.accent}10`, border: `1px solid ${theme.accent}20` }}>
                    <p className="text-xs font-bold uppercase tracking-wider opacity-60 mb-2" style={{ color: theme.accent }}>Context AI</p>
                    <p className="text-sm leading-relaxed" style={{ color: theme.text2 }}>{aiExplanation}</p>
                  </div>
                )}
              </div>

              {!aiExplanation && !aiLoading && (
                <button onClick={(e) => { e.stopPropagation(); handleExplain(); }}
                  className="mt-6 flex items-center gap-2 text-xs font-bold uppercase tracking-widest hover:opacity-100 hover:text-accent transition-all"
                  style={{ color: theme.text3 }}>
                  <Bot size={14} /> Explică cu AI
                </button>
              )}
              {aiLoading && (
                <div className="mt-6 flex items-center gap-2 text-xs font-bold uppercase tracking-widest opacity-60" style={{ color: theme.accent }}>
                  <Loader2 size={14} className="animate-spin" /> Se analizează...
                </div>
              )}
            </div>
          </motion.div>
        </AnimatePresence>

        <AnimatePresence>
          {flipped && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="mt-8 w-full max-w-2xl"
            >
              <p className="text-center text-[10px] font-black uppercase tracking-widest mb-4" style={{ color: theme.text3 }}>Cum a fost întrebarea?</p>
              <div className="grid grid-cols-3 gap-4">
                <button onClick={() => handleRating('hard')}
                  className="flex flex-col items-center gap-2 p-4 rounded-3xl transition-all hover:scale-105 active:scale-95 group"
                  style={{ 
                    background: `${theme.danger}10`, 
                    border: `1.5px solid ${theme.danger}35`,
                    color: theme.danger,
                    boxShadow: `0 12px 24px ${theme.danger}10`,
                  }}
                >
                  <span className="text-xl">😫</span>
                  <span>Greu</span>
                  <span className="text-[10px] opacity-60 font-normal">1</span>
                </button>

                <button onClick={() => handleRating('good')}
                  className="flex flex-col items-center gap-2 p-4 rounded-3xl transition-all hover:scale-105 active:scale-95 group"
                  style={{ 
                    background: `${theme.accent}10`, 
                    border: `1.5px solid ${theme.accent}35`,
                    color: theme.accent,
                    boxShadow: `0 12px 24px ${theme.accent}10`,
                  }}
                >
                  <span className="text-xl">😐</span>
                  <span>Bine</span>
                  <span className="text-[10px] opacity-60 font-normal">2</span>
                </button>

                <button onClick={() => handleRating('easy')}
                  className="flex flex-col items-center gap-2 p-4 rounded-3xl transition-all hover:scale-105 active:scale-95 group"
                  style={{ 
                    background: `${theme.success}10`, 
                    border: `1.5px solid ${theme.success}35`,
                    color: theme.success,
                    boxShadow: `0 12px 24px ${theme.success}10`,
                  }}
                >
                  <span className="text-xl">😊</span>
                  <span>Ușor</span>
                  <span className="text-[10px] opacity-60 font-normal">3</span>
                </button>
              </div>

              <p className="text-center text-xs mt-3 font-medium" style={{ color: theme.text2 }}>
                Taste: 1 · 2 · 3
              </p>
              </motion.div>
              )}
              </AnimatePresence>

              {!flipped && (
              <p className="text-center text-xs mt-4 font-medium" style={{ color: theme.text2 }}>
              Space sau Enter pentru flip
              </p>
              )}
              </div>
              </div>
              );
              }
