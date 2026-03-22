import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Flame, RefreshCw, Plus, BookOpen, Zap, Target, X, CheckCircle2, Circle } from 'lucide-react';
import { useTheme } from '../theme/ThemeContext';
import { useUserStore } from '../store/userStore';
import { useQuizStore } from '../store/quizStore';
import { useStatsStore } from '../store/statsStore';
import QuizCard from '../components/QuizCard';
import ImportQuizButton from '../components/ImportQuizButton';

function useCountUp(end: number, duration = 700): number {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (end === 0) { setVal(0); return; }
    let raf: number;
    const startTime = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setVal(Math.floor(eased * end));
      if (progress < 1) raf = requestAnimationFrame(tick);
      else setVal(end);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [end, duration]);
  return val;
}

function StatCard({ label, numeric, suffix, display, icon, color, delay }: {
  label: string; numeric: number; suffix: string; display?: string;
  icon: React.ReactNode; color: string; delay: number;
}) {
  const theme = useTheme();
  const count = useCountUp(numeric);
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -3, boxShadow: `0 12px 32px ${color}22`, transition: { duration: 0.18 } }}
      className="rounded-2xl p-4 relative overflow-hidden"
      style={{
        background: theme.surface,
        border: `1px solid ${theme.border}`,
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
      }}>
      {/* Subtle color accent top-left */}
      <div className="absolute top-0 left-0 w-20 h-20 rounded-full pointer-events-none"
        style={{
          background: `radial-gradient(circle at top left, ${color}18, transparent 70%)`,
        }} />
      <div className="relative">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
          style={{ background: `${color}18`, color }}>
          {icon}
        </div>
        <motion.div
          key={count}
          initial={{ scale: 1.18, color: color }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 18 }}
          className="text-2xl font-bold mb-0.5"
          style={{ color: theme.text }}>
          {display ?? `${count}${suffix}`}
        </motion.div>
        <div className="text-xs font-medium" style={{ color: theme.text3 }}>{label}</div>
      </div>
    </motion.div>
  );
}

export default function Dashboard() {
  const theme = useTheme();
  const { username } = useUserStore();
  const { quizzes, sessions } = useQuizStore();
  const { streak, getDueQuestions, getAccuracy, totalStudyTime } = useStatsStore();

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bună dimineața' : hour < 18 ? 'Bună ziua' : 'Bună seara';
  const dueCount = getDueQuestions().length;
  const accuracy = getAccuracy();
  const studyHours = Math.floor(totalStudyTime / 3600);

  const recentQuizzes = useMemo(() => [...quizzes]
    .sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt);
    })
    .slice(0, 4), [quizzes]);

  const [checklistDismissed, setChecklistDismissed] = useState(() =>
    localStorage.getItem('studyx-checklist-dismissed') === 'true'
  );
  const checklistItems = [
    { id: 'quiz', label: 'Creează prima grilă', done: quizzes.filter(q => !q.id.startsWith('sample-') && !q.id.startsWith('img-')).length > 0, link: '/create' },
    { id: 'play', label: 'Rezolvă o grilă', done: sessions.length > 0, link: '/quizzes' },
    { id: 'review', label: 'Încearcă recapitularea', done: dueCount === 0 && sessions.length > 0, link: '/review' },
    { id: 'stats', label: 'Vizitează statisticile', done: false, link: '/stats' },
    { id: 'theme', label: 'Personalizează tema', done: false, link: '/settings' },
  ];
  const checklistDone = checklistItems.filter(i => i.done).length;
  const showChecklist = !checklistDismissed && checklistDone < checklistItems.length;

  const stats = [
    { label: 'Grile', numeric: quizzes.length, suffix: '', icon: <BookOpen size={18} />, color: theme.accent },
    { label: 'Streak', numeric: streak.currentStreak, suffix: '🔥', icon: <Flame size={18} />, color: theme.warning },
    { label: 'Acuratețe', numeric: accuracy, suffix: '%', display: accuracy > 0 ? undefined : '—', icon: <Target size={18} />, color: theme.success },
    { label: 'Ore studiu', numeric: studyHours, suffix: 'h', display: studyHours > 0 ? undefined : `${Math.floor(totalStudyTime / 60)}m`, icon: <Zap size={18} />, color: theme.accent2 },
  ];

  return (
    <div className="h-full overflow-y-auto px-8 py-8">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }} className="mb-8">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight mb-1" style={{ color: theme.text }}>
                {greeting}, <span style={{
                  background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})`,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}>{username}</span> 👋
              </h1>
              <p style={{ color: theme.text2 }}>
                {new Date().toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
            </div>
            <div className="hidden md:flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl flex-shrink-0"
              style={{ background: theme.surface, color: theme.text3, border: `1px solid ${theme.border}` }}>
              <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono"
                style={{ background: theme.surface2, border: `1px solid ${theme.border2}` }}>?</kbd>
              <span>scurtături</span>
            </div>
          </div>
        </motion.div>

        {/* Onboarding checklist */}
        <AnimatePresence>
          {showChecklist && (
            <motion.div
              initial={{ opacity: 0, height: 0, marginBottom: 0 }}
              animate={{ opacity: 1, height: 'auto', marginBottom: 24 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              className="overflow-hidden">
              <div className="rounded-2xl p-4" style={{ background: theme.surface, border: `1px solid ${theme.border}` }}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-semibold" style={{ color: theme.text }}>Primii pași în StudyX</p>
                    <p className="text-xs" style={{ color: theme.text3 }}>{checklistDone}/{checklistItems.length} finalizate</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Progress pill */}
                    <div className="w-24 h-1.5 rounded-full overflow-hidden" style={{ background: theme.surface2 }}>
                      <motion.div className="h-full rounded-full"
                        animate={{ width: `${(checklistDone / checklistItems.length) * 100}%` }}
                        transition={{ duration: 0.6, ease: 'easeOut' }}
                        style={{ background: `linear-gradient(90deg, ${theme.accent}, ${theme.accent2})` }} />
                    </div>
                    <button onClick={() => { setChecklistDismissed(true); localStorage.setItem('studyx-checklist-dismissed', 'true'); }}
                      style={{ color: theme.text3 }}>
                      <X size={14} />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {checklistItems.map((item) => (
                    <Link key={item.id} to={item.link} style={{ textDecoration: 'none' }}>
                      <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                        className="flex items-center gap-2 p-2.5 rounded-xl transition-all"
                        style={{
                          background: item.done ? `${theme.success}10` : theme.surface2,
                          border: `1px solid ${item.done ? theme.success + '30' : 'transparent'}`,
                          opacity: item.done ? 0.8 : 1,
                        }}>
                        {item.done
                          ? <CheckCircle2 size={14} style={{ color: theme.success, flexShrink: 0 }} />
                          : <Circle size={14} style={{ color: theme.text3, flexShrink: 0 }} />}
                        <span className="text-xs font-medium" style={{ color: item.done ? theme.success : theme.text2 }}>
                          {item.label}
                        </span>
                      </motion.div>
                    </Link>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Due review banner */}
        {dueCount > 0 && (
          <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="mb-6 p-4 rounded-2xl flex items-center justify-between"
            style={{
              background: `linear-gradient(135deg, ${theme.warning}18, ${theme.accent}10)`,
              border: `1px solid ${theme.warning}35`,
              boxShadow: `0 4px 24px ${theme.warning}12`,
            }}>
            <div className="flex items-center gap-3">
              <motion.div
                animate={{ scale: [1, 1.15, 1] }}
                transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                style={{ background: `${theme.warning}20` }}>
                ⚡
              </motion.div>
              <div>
                <p className="font-semibold" style={{ color: theme.text }}>
                  {dueCount} {dueCount === 1 ? 'întrebare' : 'întrebări'} de recapitulat
                </p>
                <p className="text-sm" style={{ color: theme.text2 }}>Repetare spațiată · algoritmul SM-2</p>
              </div>
            </div>
            <Link to="/review"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-white text-sm"
              style={{ background: `linear-gradient(135deg, ${theme.warning}, ${theme.accent})`, boxShadow: `0 4px 14px ${theme.warning}30` }}>
              <RefreshCw size={14} />Recapitulează
            </Link>
          </motion.div>
        )}

        {/* Stats grid */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }} className="grid grid-cols-4 gap-3 mb-8">
          {stats.map((s, i) => (
            <StatCard key={s.label} label={s.label} numeric={s.numeric} suffix={s.suffix}
              display={s.display} icon={s.icon} color={s.color} delay={0.2 + i * 0.06} />
          ))}
        </motion.div>

        {/* Quick actions */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}
          className="flex gap-3 mb-8 flex-wrap">
          <Link to="/create" data-tutorial="btn-new-quiz"
            className="flex items-center gap-2 px-5 py-3 rounded-2xl font-semibold text-white text-sm"
            style={{ background: `linear-gradient(135deg, ${theme.accent} 0%, ${theme.accent2} 100%)` }}>
            <Plus size={16} />Grilă nouă
          </Link>
          <div data-tutorial="btn-import"><ImportQuizButton /></div>
          <Link to="/quizzes"
            className="flex items-center gap-2 px-5 py-3 rounded-2xl font-medium text-sm"
            style={{ background: theme.surface2, border: `1px solid ${theme.border2}`, color: theme.text2 }}>
            <BookOpen size={16} />Toate grilele
          </Link>
        </motion.div>

        {/* Recent quizzes */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold" style={{ color: theme.text }}>Grile recente</h2>
            <Link to="/quizzes" className="text-sm hover:underline" style={{ color: theme.accent }}>
              Vezi toate →
            </Link>
          </div>
          {recentQuizzes.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {recentQuizzes.map((quiz, i) => (
                <QuizCard key={quiz.id} quiz={quiz} index={i} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 rounded-2xl"
              style={{ background: theme.surface, border: `1px solid ${theme.border}` }}>
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                className="text-4xl mb-3">📭</motion.div>
              <p style={{ color: theme.text3 }}>Nicio grilă încă.</p>
              <Link to="/create" className="text-sm hover:underline mt-1 inline-block" style={{ color: theme.accent }}>
                Creează prima grilă →
              </Link>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
