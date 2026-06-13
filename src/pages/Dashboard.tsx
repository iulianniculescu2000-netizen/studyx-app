import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BookOpen, Plus, Sparkles } from 'lucide-react';
import { useTheme } from '../theme/ThemeContext';
import { useUserStore } from '../store/userStore';
import { useQuizStore } from '../store/quizStore';
import { useStatsStore } from '../store/statsStore';
import { useTutorialStore } from '../store/tutorialStore';
import ImportQuizButton from '../components/ImportQuizButton';
import QuizCard from '../components/QuizCard';
import DashboardErrorBoundary from '../components/dashboard/DashboardErrorBoundary';
import MagneticButton from '../components/dashboard/MagneticButton';
import DashboardAIStudyBuddy from '../components/dashboard/DashboardAIStudyBuddy';
import DashboardStatCard from '../components/dashboard/DashboardStatCard';
import TodayProgressCard from '../components/dashboard/TodayProgressCard';
import { useAdaptiveMotion } from '../hooks/useAdaptiveMotion';
import { useCountUp } from '../hooks/useCountUp';

type DashboardStat = {
  label: string;
  numeric: number;
  display?: string;
  suffix: string;
  color: string;
  trend?: 'up' | 'down' | 'neutral';
};

function DashboardLoading({ compact }: { compact: boolean }) {
  return (
    <div className={`premium-shell h-full overflow-y-auto px-4 sm:px-8 ${compact ? 'py-5 sm:py-6' : 'py-6 sm:py-10'}`}>
      <div className={`${compact ? 'max-w-[1040px]' : 'max-w-[1120px]'} mx-auto shell-main-stage`}>
        <div className="mb-10 h-10 w-48 animate-pulse rounded-xl bg-white/5" />
        <div className="mb-12 grid grid-cols-2 gap-5 md:grid-cols-4">
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className="h-32 animate-pulse rounded-[32px] bg-white/5" />
          ))}
        </div>
        <div className="mb-12 h-40 animate-pulse rounded-[32px] bg-white/5" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className="h-48 animate-pulse rounded-[32px] bg-white/5" />
          ))}
        </div>
      </div>
    </div>
  );
}

function DashboardHero({
  compact,
  greeting,
  username,
}: {
  compact: boolean;
  greeting: string;
  username: string;
}) {
  const theme = useTheme();
  const { calmMotion } = useAdaptiveMotion();

  return (
    <motion.div
      initial={calmMotion ? { opacity: 0 } : { opacity: 0, y: 20 }}
      animate={calmMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      className={compact ? 'mb-7' : 'mb-10'}
    >
      <div className="secondary-label mb-3 font-black tracking-[0.22em]" style={{ color: theme.text3 }}>
        STUDYX OVERVIEW
      </div>
      <h1 className={`${compact ? 'page-title-compact' : 'page-title'} mb-2`} style={{ color: theme.text }}>
        {greeting}, <span style={{ background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', display: 'inline-block' }}>{username}</span>
      </h1>
      <p className="page-subtitle max-w-2xl opacity-70" style={{ color: theme.text }}>
        {new Date().toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}. Un tablou calm, clar și orientat spre progres real.
      </p>
    </motion.div>
  );
}

function DashboardActions({ compact }: { compact: boolean }) {
  const theme = useTheme();

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35 }}
      className={`flex flex-wrap items-center ${compact ? 'mb-8 gap-3' : 'mb-12 gap-4'}`}
    >
      <MagneticButton
        to="/create"
        className={`press-feedback flex items-center gap-2.5 ${compact ? 'rounded-[20px] px-6 py-3.5' : 'rounded-[24px] px-8 py-4'} text-[11px] font-black uppercase tracking-wider text-white shadow-2xl transition-all`}
        style={{ background: `linear-gradient(135deg, ${theme.accent} 0%, ${theme.accent2} 100%)`, boxShadow: `0 12px 30px ${theme.accent}40` }}
      >
        <span data-tutorial="btn-new-quiz" className="contents">
          <Plus size={18} strokeWidth={3} /> Creează grilă
        </span>
      </MagneticButton>
      <div data-tutorial="btn-import"><ImportQuizButton /></div>
      <MagneticButton
        to="/quizzes"
        className={`press-feedback flex items-center gap-2.5 ${compact ? 'rounded-[20px] px-6 py-3.5' : 'rounded-[24px] px-8 py-4'} text-xs font-bold uppercase tracking-wider glass-panel transition-all hover:bg-white/5`}
        style={{ color: theme.text, border: `1px solid ${theme.border}` }}
      >
        <BookOpen size={16} /> Explorează
      </MagneticButton>
    </motion.div>
  );
}

function EmptyRecentQuizzes({ onStartTutorial }: { onStartTutorial: () => void }) {
  const theme = useTheme();
  const { calmMotion } = useAdaptiveMotion();

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="glass-panel rounded-[40px] border border-dashed border-white/10 py-16 text-center"
    >
      <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-white/5">
        <BookOpen size={40} className="opacity-20" style={{ color: theme.text }} />
      </div>
      <h3 className="mb-2 text-xl font-bold" style={{ color: theme.text }}>Începe călătoria ta medicală</h3>
      <p className="mx-auto mb-8 max-w-xs text-sm font-medium" style={{ color: theme.text3 }}>
        Nu ai nicio grilă adăugată încă. Importă un fișier sau creează una manual pentru a începe studiul.
      </p>
      <div className="mb-8 flex flex-wrap items-center justify-center gap-2 px-4">
        <span className="premium-chip rounded-full px-3 py-1 text-[11px] font-semibold" style={{ color: theme.text3 }}>Import JSON rapid</span>
        <span className="premium-chip rounded-full px-3 py-1 text-[11px] font-semibold" style={{ color: theme.text3 }}>Flashcards automate</span>
        <span className="premium-chip rounded-full px-3 py-1 text-[11px] font-semibold" style={{ color: theme.text3 }}>Bibliotecă AI integrată</span>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <MagneticButton
          to="/create"
          className="press-feedback inline-flex items-center gap-2 rounded-2xl px-8 py-3.5 text-xs font-black uppercase tracking-widest text-white shadow-xl"
          style={{ background: theme.accent }}
        >
          Creează prima grilă
        </MagneticButton>
        <motion.button
          whileHover={calmMotion ? undefined : { y: -1 }}
          whileTap={calmMotion ? undefined : { scale: 0.98 }}
          onClick={onStartTutorial}
          className="press-feedback glass-panel inline-flex items-center gap-2 rounded-2xl px-6 py-3.5 text-xs font-bold uppercase tracking-[0.14em]"
          style={{ color: theme.text, border: `1px solid ${theme.border}` }}
        >
          Tur rapid
        </motion.button>
      </div>
    </motion.div>
  );
}

function RecentQuizzesSection({
  recentQuizzes,
  onStartTutorial,
}: {
  recentQuizzes: ReturnType<typeof useQuizStore.getState>['quizzes'];
  onStartTutorial: () => void;
}) {
  const theme = useTheme();

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="section-title flex items-center gap-2" style={{ color: theme.text }}>
          <Sparkles size={18} /> Grile recente
        </h2>
        <Link to="/quizzes" className="text-xs font-bold uppercase tracking-widest hover:underline" style={{ color: theme.accent }}>
          Vezi tot
        </Link>
      </div>
      {recentQuizzes.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {recentQuizzes.map((quiz, index) => <QuizCard key={quiz.id} quiz={quiz} index={index} />)}
        </div>
      ) : (
        <EmptyRecentQuizzes onStartTutorial={onStartTutorial} />
      )}
    </motion.div>
  );
}

function DashboardShell({
  compact,
  children,
}: {
  compact: boolean;
  children: ReactNode;
}) {
  return (
    <div className={`premium-shell h-full overflow-y-auto px-4 sm:px-8 ${compact ? 'py-5 sm:py-6' : 'py-6 sm:py-10'}`}>
      <div className={`${compact ? 'max-w-[1040px]' : 'max-w-[1120px]'} mx-auto shell-main-stage`}>
        {children}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const theme = useTheme();
  const compact = typeof window !== 'undefined' && (window.innerHeight < 860 || window.innerWidth < 1280);
  const { username } = useUserStore();
  const { quizzes, _hasHydrated } = useQuizStore();
  const { streak, getAccuracy, totalStudyTime } = useStatsStore();
  const startTutorial = useTutorialStore((state) => state.startTutorial);
  const [hour, setHour] = useState(new Date().getHours());

  const accuracy = getAccuracy();
  const studyHours = Math.floor(totalStudyTime / 3600);
  const studyMinutes = Math.floor(totalStudyTime / 60);

  const quizOnlyCount = useMemo(() => quizzes.filter(q => !(q.tags?.includes('flashcard'))).length, [quizzes]);
  const animatedQuizzes = useCountUp(quizOnlyCount);
  const animatedStreak = useCountUp(streak.currentStreak);
  const animatedAccuracy = useCountUp(accuracy);
  const animatedStudyHours = useCountUp(studyHours);
  const animatedStudyMinutes = useCountUp(studyMinutes);

  useEffect(() => {
    const intervalId = setInterval(() => setHour(new Date().getHours()), 60000);
    return () => clearInterval(intervalId);
  }, []);

  const recentQuizzes = useMemo(
    () => [...quizzes]
      .sort((left, right) => (right.updatedAt ?? right.createdAt) - (left.updatedAt ?? left.createdAt))
      .slice(0, 4),
    [quizzes],
  );

  const greeting = hour < 12 ? 'Bună dimineața' : hour < 18 ? 'Bună ziua' : 'Bună seara';
  const stats: DashboardStat[] = [
    { label: 'Grile', numeric: quizOnlyCount, display: String(animatedQuizzes), suffix: '', color: theme.accent, trend: 'neutral' },
    { label: 'Streak', numeric: streak.currentStreak, display: `${animatedStreak} ${animatedStreak === 1 ? 'zi' : 'zile'}`, suffix: '', color: theme.warning, trend: 'up' },
    { label: 'Acuratețe', numeric: accuracy, display: accuracy > 0 ? `${animatedAccuracy}%` : '-', suffix: '%', color: theme.success, trend: accuracy >= 75 ? 'up' : 'down' },
    { label: 'Timp studiu', numeric: studyHours, display: studyHours > 0 ? `${animatedStudyHours}h` : `${animatedStudyMinutes}m`, suffix: 'h', color: theme.accent2, trend: 'up' },
  ];

  if (!_hasHydrated) {
    return <DashboardLoading compact={compact} />;
  }

  return (
    <DashboardErrorBoundary>
      <DashboardShell compact={compact}>
        <DashboardHero compact={compact} greeting={greeting} username={username ?? ''} />
        <DashboardAIStudyBuddy />

        <div className={`shell-stage-panel grid grid-cols-2 ${compact ? 'mb-8 gap-4 p-4 xl:grid-cols-4' : 'mb-12 gap-5 p-5 md:grid-cols-4'}`}>
          {stats.map((stat, index) => <DashboardStatCard key={stat.label} {...stat} delay={0.1 + index * 0.05} />)}
        </div>

        {quizzes.length > 0 && <TodayProgressCard />}
        <DashboardActions compact={compact} />
        <RecentQuizzesSection recentQuizzes={recentQuizzes} onStartTutorial={startTutorial} />
      </DashboardShell>
    </DashboardErrorBoundary>
  );
}
