import { motion, AnimatePresence } from 'framer-motion';
import { useState, useMemo, useCallback, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight, RefreshCw, Trophy, Keyboard, Layers } from 'lucide-react';
import { useTheme } from '../theme/ThemeContext';
import QuizImage from '../components/QuizImage';
import { useQuizStore } from '../store/quizStore';
import { useStatsStore } from '../store/statsStore';
import { useUserStore } from '../store/userStore';
import { buildAdaptiveExamQuiz, buildWeaknessRecoveryQuiz } from '../lib/adaptiveStudy';
import type { Question, QuestionStat } from '../types';

interface ReviewItem {
  stat: QuestionStat;
  question: Question;
  quizTitle: string;
}

export default function ReviewMode() {
  const theme = useTheme();
  const navigate = useNavigate();
  const quizzes = useQuizStore((state) => state.quizzes);
  const addQuiz = useQuizStore((state) => state.addQuiz);
  const dueCount = useStatsStore((state) => state.getDueQuestions().length);
  const weakCount = useStatsStore((state) => state.getWeakQuestions(10).length);
  const recordAnswer = useStatsStore((state) => state.recordAnswer);
  const recordStudySession = useStatsStore((state) => state.recordStudySession);
  const activeProfileId = useUserStore((state) => state.activeProfileId);

  const createQuizFromMistakes = () => {
    const weak = getWeakQuestions(20);
    const items = weak.flatMap(stat => {
      const quiz = quizzes.find(q => q.id === stat.quizId);
      const question = quiz?.questions.find(q => q.id === stat.questionId);
      if (!question) return [];
      return [question];
    });
    if (items.length === 0) return;
    const id = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
    addQuiz({
      id,
      title: '🔥 Quiz din greșeli',
      description: `${items.length} întrebări la care ai greșit cel mai des`,
      emoji: '🔥',
      color: 'red',
      category: 'Altele',
      folderId: null,
      shuffleQuestions: true,
      shuffleAnswers: true,
      tags: ['greșeli', 'recapitulare'],
      questions: items,
      createdAt: Date.now(),
    });
    navigate(`/play/${id}`);
  };

  const [mode, setMode] = useState<'pick' | 'review' | 'done'>('pick');
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [results, setResults] = useState<boolean[]>([]);
  const [startedAt] = useState(() => Date.now());
  const [showKeys, setShowKeys] = useState(false);

  const buildItems = (stats: QuestionStat[]): ReviewItem[] => {
    return stats.flatMap(stat => {
      const quiz = quizzes.find(q => q.id === stat.quizId);
      const question = quiz?.questions.find(q => q.id === stat.questionId);
      if (!quiz || !question) return [];
      return [{ stat, question, quizTitle: quiz.title }];
    });
  };

  const startDue = () => {
    const due = useStatsStore.getState().getDueQuestions();
    setItems(buildItems(due));
    setMode('review');
  };

  const startWeak = () => {
    const weak = useStatsStore.getState().getWeakQuestions(10);
    setItems(buildItems(weak));
    setMode('review');
  };

  const startRecoverySession = () => {
    if (!activeProfileId) return;
    const quiz = buildWeaknessRecoveryQuiz(activeProfileId, quizzes, useStatsStore.getState().questionStats);
    if (!quiz) return;
    addQuiz(quiz);
    navigate(`/play/${quiz.id}`);
  };

  const startAdaptiveExam = () => {
    if (!activeProfileId) return;
    const quiz = buildAdaptiveExamQuiz(activeProfileId, quizzes, useStatsStore.getState().questionStats);
    if (!quiz) return;
    addQuiz(quiz);
    navigate(`/play/${quiz.id}`, { state: { mode: 'exam' } });
  };

  const current = items[currentIdx];
  const isMultiple = current?.question.multipleCorrect ?? false;
  const correctIds = useMemo(() => current?.question.options.filter(o => o.isCorrect).map(o => o.id) ?? [], [current]);

  const revealAnswer = useCallback((sel: string[]) => {
    if (!current) return;
    const isCorrect = sel.length === correctIds.length && correctIds.every((id: string) => sel.includes(id));
    setRevealed(true);
    setResults(prev => [...prev, isCorrect]);
    recordAnswer(current.stat.quizId, current.stat.questionId, isCorrect);
  }, [correctIds, current, recordAnswer]);

  const handleSelect = useCallback((optId: string) => {
    if (revealed) return;
    if (isMultiple) {
      setSelected(prev => prev.includes(optId) ? prev.filter(i => i !== optId) : [...prev, optId]);
    } else {
      setSelected([optId]);
      revealAnswer([optId]);
    }
  }, [isMultiple, revealAnswer, revealed]);

  const handleNext = useCallback(() => {
    if (currentIdx + 1 >= items.length) {
      recordStudySession(Math.floor((Date.now() - startedAt) / 1000));
      setMode('done');
    } else {
      setCurrentIdx(i => i + 1);
      setSelected([]);
      setRevealed(false);
    }
  }, [currentIdx, items.length, recordStudySession, startedAt]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const keyMap: Record<string, number> = { '1': 0, '2': 1, '3': 2, '4': 3, 'a': 0, 'b': 1, 'c': 2, 'd': 3 };
      const idx = keyMap[e.key.toLowerCase()];
      if (idx !== undefined && current?.question.options[idx]) handleSelect(current.question.options[idx].id);
      if ((e.key === 'Enter' || e.key === ' ') && revealed) { e.preventDefault(); handleNext(); }
      if (e.key === 'Enter' && isMultiple && !revealed && selected.length > 0) revealAnswer(selected);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [current, revealed, selected, isMultiple, handleNext, revealAnswer, handleSelect]);

  if (mode === 'pick') {
    return (
      <div className="min-h-full px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-6xl">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="mb-8 text-center sm:mb-10">
            <h1 className="mb-3 text-4xl font-black tracking-tighter sm:text-5xl" style={{ color: theme.text }}>
              Recapitulare <span style={{
                background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                display: 'inline-block'
              }}>Inteligentă</span>
            </h1>
            <p className="text-sm font-medium opacity-60" style={{ color: theme.text }}>
              Alege modul de optimizare a memoriei
            </p>
          </motion.div>

          <div className="grid gap-4 md:grid-cols-2 xl:gap-5">
            <motion.button whileHover={{ scale: 1.01, y: -2 }} whileTap={{ scale: 0.985 }}
              onClick={startDue}
              disabled={dueCount === 0}
              className="group relative flex min-h-[190px] w-full flex-col overflow-hidden rounded-[30px] p-6 text-left transition-all disabled:opacity-40"
              style={{ 
                background: theme.surface, 
                border: `1px solid ${dueCount > 0 ? theme.warning + '40' : theme.border}`,
                boxShadow: '0 14px 34px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.08)'
              }}>
              <div className="absolute top-0 left-0 w-24 h-24 rounded-full blur-3xl pointer-events-none"
                style={{ background: `${theme.warning}15` }} />
              
              <div className="relative mb-4 flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-inner"
                  style={{ background: `${theme.warning}20`, border: `1px solid ${theme.warning}40` }}>
                  ⚡
                </div>
                <div className="min-w-0 flex-1">
                  <span className="font-black text-lg block leading-tight" style={{ color: theme.text }}>Repetare Spațiată</span>
                  <span className="text-[10px] font-black uppercase tracking-wider opacity-60" style={{ color: theme.warning }}>Algoritm SM-2</span>
                </div>
                <span className="shrink-0 rounded-full px-3 py-1 text-xs font-black shadow-lg"
                  style={{ background: `linear-gradient(135deg, ${theme.warning}, ${theme.accent})`, color: '#fff' }}>
                  {dueCount}
                </span>
              </div>
              <p className="relative mt-auto text-sm font-medium leading-relaxed" style={{ color: theme.text2 }}>
                Întrebări selectate automat pentru a preveni uitarea. Maximul de eficiență în studiu.
              </p>
            </motion.button>

            <motion.button whileHover={{ scale: 1.01, y: -2 }} whileTap={{ scale: 0.985 }}
              onClick={startWeak}
              disabled={weakCount === 0}
              className="group relative flex min-h-[190px] w-full flex-col overflow-hidden rounded-[30px] p-6 text-left transition-all disabled:opacity-40"
              style={{ 
                background: theme.surface, 
                border: `1px solid ${weakCount > 0 ? theme.danger + '40' : theme.border}`,
                boxShadow: '0 14px 34px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.08)'
              }}>
              <div className="absolute top-0 left-0 w-24 h-24 rounded-full blur-3xl pointer-events-none"
                style={{ background: `${theme.danger}15` }} />

              <div className="relative mb-4 flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-inner"
                  style={{ background: `${theme.danger}20`, border: `1px solid ${theme.danger}40` }}>
                  🎯
                </div>
                <div className="min-w-0 flex-1">
                  <span className="font-black text-lg block leading-tight" style={{ color: theme.text }}>Puncte Slabe</span>
                  <span className="text-[10px] font-black uppercase tracking-wider opacity-60" style={{ color: theme.danger }}>Analiză Erori</span>
                </div>
                <span className="shrink-0 rounded-full px-3 py-1 text-xs font-black shadow-lg"
                  style={{ background: theme.danger, color: '#fff' }}>
                  {weakCount}
                </span>
              </div>
              <p className="relative mt-auto text-sm font-medium leading-relaxed" style={{ color: theme.text2 }}>
                Concentrează-te pe subiectele unde ai întâmpinat dificultăți. Transformă minusurile în plusuri.
              </p>
            </motion.button>

            <motion.button whileHover={{ scale: 1.01, y: -2 }} whileTap={{ scale: 0.985 }}
              onClick={createQuizFromMistakes}
              disabled={weakCount === 0}
              className="group relative flex min-h-[190px] w-full flex-col overflow-hidden rounded-[30px] p-6 text-left transition-all disabled:opacity-40"
              style={{ 
                background: theme.surface, 
                border: `1px solid ${theme.accent}40`,
                boxShadow: '0 14px 34px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.08)'
              }}>
              <div className="absolute top-0 left-0 w-24 h-24 rounded-full blur-3xl pointer-events-none"
                style={{ background: `${theme.accent}15` }} />

              <div className="relative mb-4 flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-inner"
                  style={{ background: `${theme.accent}20`, border: `1px solid ${theme.accent}40` }}>
                  🔥
                </div>
                <div className="min-w-0 flex-1">
                  <span className="font-black text-lg block leading-tight" style={{ color: theme.text }}>Quiz din Greșeli</span>
                  <span className="text-[10px] font-black uppercase tracking-wider opacity-60" style={{ color: theme.accent }}>Generator Automat</span>
                </div>
              </div>
              <p className="relative mt-auto text-sm font-medium leading-relaxed" style={{ color: theme.text2 }}>
                Generează o grilă nouă din istoricul tău de erori pentru o sesiune de antrenament rapid.
              </p>
            </motion.button>

            <motion.button whileHover={{ scale: 1.01, y: -2 }} whileTap={{ scale: 0.985 }}
              onClick={startRecoverySession}
              disabled={!activeProfileId || weakCount === 0}
              className="group relative flex min-h-[190px] w-full flex-col overflow-hidden rounded-[30px] p-6 text-left transition-all disabled:opacity-40"
              style={{
                background: theme.surface,
                border: `1px solid ${theme.success}40`,
                boxShadow: '0 14px 34px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.08)'
              }}>
              <div className="absolute top-0 left-0 w-24 h-24 rounded-full blur-3xl pointer-events-none"
                style={{ background: `${theme.success}14` }} />

              <div className="relative mb-4 flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-inner"
                  style={{ background: `${theme.success}20`, border: `1px solid ${theme.success}40` }}>
                  ♻️
                </div>
                <div className="min-w-0 flex-1">
                  <span className="font-black text-lg block leading-tight" style={{ color: theme.text }}>Weakness Recovery</span>
                  <span className="text-[10px] font-black uppercase tracking-wider opacity-60" style={{ color: theme.success }}>Focused Recovery</span>
                </div>
              </div>
              <p className="relative mt-auto text-sm font-medium leading-relaxed" style={{ color: theme.text2 }}>
                O sesiune scurtă, ghidată de topicurile unde ai cea mai mare nevoie de consolidare.
              </p>
            </motion.button>

            <motion.button whileHover={{ scale: 1.01, y: -2 }} whileTap={{ scale: 0.985 }}
              onClick={startAdaptiveExam}
              disabled={!activeProfileId || quizzes.length === 0}
              className="group relative flex min-h-[190px] w-full flex-col overflow-hidden rounded-[30px] p-6 text-left transition-all disabled:opacity-40 md:col-span-2"
              style={{
                background: theme.surface,
                border: `1px solid ${theme.accent2}40`,
                boxShadow: '0 14px 34px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.08)'
              }}>
              <div className="absolute top-0 left-0 w-24 h-24 rounded-full blur-3xl pointer-events-none"
                style={{ background: `${theme.accent2}16` }} />

              <div className="relative mb-4 flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-inner"
                  style={{ background: `${theme.accent2}20`, border: `1px solid ${theme.accent2}40` }}>
                  🎓
                </div>
                <div className="min-w-0 flex-1">
                  <span className="font-black text-lg block leading-tight" style={{ color: theme.text }}>Adaptive Exam Mode</span>
                  <span className="text-[10px] font-black uppercase tracking-wider opacity-60" style={{ color: theme.accent2 }}>Dynamic Simulation</span>
                </div>
              </div>
              <p className="relative mt-auto text-sm font-medium leading-relaxed" style={{ color: theme.text2 }}>
                Simulare de examen cu dificultate calibrată după istoricul tău, pentru antrenament realist.
              </p>
            </motion.button>
          </div>

          {dueCount === 0 && weakCount === 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="mt-10 rounded-3xl p-6 text-center"
              style={{ background: `${theme.success}10`, border: `1px solid ${theme.success}25` }}>
              <p className="text-xl font-bold mb-1" style={{ color: theme.success }}>✨ Ești la zi!</p>
              <p className="text-sm font-medium opacity-70" style={{ color: theme.text }}>
                Nu ai întrebări restante. Memoria ta este în formă maximă!
              </p>
              <Link to="/quizzes" className="text-sm font-bold hover:underline mt-3 inline-block" style={{ color: theme.accent }}>
                Explorează grile noi →
              </Link>
            </motion.div>
          )}
        </div>
      </div>
    );
  }

  if (mode === 'done') {
    const correct = results.filter(Boolean).length;
    const pct = Math.round((correct / results.length) * 100);
    return (
      <div className="min-h-full flex items-center justify-center px-4 py-8">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-sm px-8">
          <div className="text-6xl mb-4">{pct >= 80 ? '🏆' : pct >= 50 ? '💪' : '📚'}</div>
          <h2 className="text-3xl font-bold mb-2" style={{ color: theme.text }}>
            {pct >= 80 ? 'Excelent!' : pct >= 50 ? 'Bine!' : 'Continuă!'}
          </h2>
          <p className="mb-6" style={{ color: theme.text2 }}>
            {correct}/{results.length} corecte ({pct}%)
          </p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => { setMode('pick'); setCurrentIdx(0); setResults([]); }}
              className="flex items-center gap-2 px-5 py-3 rounded-2xl font-medium text-sm"
              style={{ background: theme.surface, border: `1px solid ${theme.border}`, color: theme.text2 }}>
              <RefreshCw size={14} />Altă sesiune
            </button>
            <Link to="/"
              className="flex items-center gap-2 px-5 py-3 rounded-2xl font-semibold text-white text-sm"
              style={{ background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})` }}>
              <Trophy size={14} />Dashboard
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  if (!current) return null;

  const progress = ((currentIdx) / items.length) * 100;

  const getOptStyle = (optId: string): React.CSSProperties => {
    const isSel = selected.includes(optId);
    if (!revealed) return isSel
      ? { background: `${theme.accent}18`, border: `1px solid ${theme.accent}50` }
      : { background: theme.surface, border: `1px solid ${theme.border}` };
    if (correctIds.includes(optId)) return { background: `${theme.success}14`, border: `1px solid ${theme.success}50` };
    if (isSel) return { background: `${theme.danger}12`, border: `1px solid ${theme.danger}50` };
    return { background: theme.surface, border: `1px solid ${theme.border}`, opacity: 0.4 };
  };

  return (
    <div className="min-h-full flex flex-col px-4 py-6 sm:px-6 lg:px-8">
      {/* Progress */}
      <div className="max-w-2xl mx-auto w-full">
        <div className="flex items-center gap-4 mb-3">
          <span className="text-sm font-medium" style={{ color: theme.text3 }}>{currentIdx + 1}/{items.length}</span>
          <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: theme.surface2 }}>
            <motion.div className="h-full rounded-full"
              style={{ background: `linear-gradient(90deg, ${theme.accent}, ${theme.accent2})` }}
              animate={{ width: `${progress}%` }} transition={{ duration: 0.4 }} />
          </div>
          <button onClick={() => setShowKeys(k => !k)}
            className="p-1.5 rounded-lg transition-all hover:opacity-80"
            style={{ color: showKeys ? theme.accent : theme.text3, background: showKeys ? `${theme.accent}15` : 'transparent' }}>
            <Keyboard size={14} />
          </button>
        </div>
        {/* Keyboard hint */}
        <AnimatePresence>
          {showKeys && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-3 px-3 py-2 rounded-xl text-xs flex flex-wrap gap-3 overflow-hidden"
              style={{ background: theme.surface, border: `1px solid ${theme.border}`, color: theme.text3 }}>
              {['1-4 / A-D: selectează opțiune', 'Enter / Space: următor', 'Enter (multi): confirmă'].map(h => (
                <span key={h} className="font-mono">{h}</span>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex-1 flex flex-col max-w-2xl w-full mx-auto mt-3">
        <AnimatePresence>
          <motion.div key={currentIdx}
            initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.3 }}
            className="flex-1 flex flex-col">

            <div className="rounded-2xl p-6 mb-5"
              style={{ background: theme.surface, border: `1px solid ${theme.border}` }}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: theme.accent }}>
                  Recapitulare
                </span>
                {current.question.multipleCorrect && (
                  <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
                    style={{ background: `${theme.accent2}18`, color: theme.accent2 }}>
                    <Layers size={10} />Multi-select
                  </span>
                )}
                <span className="ml-auto text-xs px-2 py-0.5 rounded-full truncate max-w-[140px]"
                  style={{ background: theme.surface2, color: theme.text3 }}>
                  {current.quizTitle}
                </span>
              </div>
              <p className="text-xl font-semibold" style={{ color: theme.text }}>{current.question.text}</p>
              {current.question.imageUrl && (
                <div className="mt-4">
                  <QuizImage src={current.question.imageUrl} maxHeight={224} />
                </div>
              )}
              {isMultiple && !revealed && (
                <p className="text-sm mt-2" style={{ color: theme.text3 }}>Selectează toate răspunsurile corecte</p>
              )}
            </div>

            <div className="space-y-2.5 mb-4">
              {current.question.options.map((opt, i) => (
                <motion.button key={opt.id}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  onClick={() => handleSelect(opt.id)}
                  className="w-full flex items-center gap-3 p-4 rounded-xl text-left transition-all"
                  style={getOptStyle(opt.id)}
                  whileHover={!revealed ? { scale: 1.01 } : {}}
                  whileTap={!revealed ? { scale: 0.99 } : {}}>
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold border-2 flex-shrink-0"
                    style={{
                      borderColor: selected.includes(opt.id) ? (revealed ? (correctIds.includes(opt.id) ? theme.success : theme.danger) : theme.accent) : theme.border2,
                      background: selected.includes(opt.id) ? (revealed ? (correctIds.includes(opt.id) ? `${theme.success}20` : `${theme.danger}20`) : `${theme.accent}20`) : 'transparent',
                      color: revealed ? (correctIds.includes(opt.id) ? theme.success : selected.includes(opt.id) ? theme.danger : theme.text3) : selected.includes(opt.id) ? theme.accent : theme.text2,
                    }}>
                    {String.fromCharCode(65 + i)}
                  </div>
                  <span className="text-sm font-medium" style={{ color: revealed ? (correctIds.includes(opt.id) ? theme.success : selected.includes(opt.id) ? theme.danger : theme.text3) : theme.text }}>
                    {opt.text}
                  </span>
                  <span className="ml-auto text-xs font-mono rounded px-1" style={{ background: theme.surface2, color: theme.text3 }}>{i + 1}</span>
                </motion.button>
              ))}
            </div>

            {isMultiple && !revealed && selected.length > 0 && (
              <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                onClick={() => revealAnswer(selected)}
                className="w-full py-3.5 rounded-xl font-semibold text-white mb-3"
                style={{ background: `linear-gradient(135deg, ${theme.accent2}, ${theme.accent})` }}>
                Confirmă ({selected.length} selectate)
              </motion.button>
            )}

            <AnimatePresence>
              {revealed && current.question.explanation && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                  className="mb-3 p-4 rounded-xl overflow-hidden"
                  style={{ background: `${theme.accent}0C`, border: `1px solid ${theme.accent}25` }}>
                  <p className="text-sm" style={{ color: theme.text2 }}>
                    <span className="font-semibold" style={{ color: theme.accent }}>💡 </span>
                    {current.question.explanation}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {revealed && (
                <motion.button initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
                  onClick={handleNext}
                  className="w-full py-4 rounded-xl font-semibold text-white flex items-center justify-center gap-2"
                  style={{ background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})` }}
                  whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}>
                  {currentIdx + 1 >= items.length ? '🏁 Finalizează' : <>Următor <ChevronRight size={16} /></>}
                </motion.button>
              )}
            </AnimatePresence>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
