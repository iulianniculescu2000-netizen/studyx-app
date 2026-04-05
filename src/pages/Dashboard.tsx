import { motion } from 'framer-motion';
import { useState, useEffect, useMemo, useCallback, Component, useRef, memo, type ErrorInfo } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus, BookOpen, Zap,
  Sparkles, RefreshCw, X
} from 'lucide-react';
import { useTheme } from '../theme/ThemeContext';
import { useUserStore } from '../store/userStore';
import { useQuizStore } from '../store/quizStore';
import { useStatsStore } from '../store/statsStore';
import { useAIStore } from '../store/aiStore';
import { useTutorialStore } from '../store/tutorialStore';
import { buildPerformanceSummary, buildUserContextString } from '../lib/aiContext';
import { buildStudyCoachPlan } from '../lib/studyCoach';
import ImportQuizButton from '../components/ImportQuizButton';
import QuizCard from '../components/QuizCard';

let dashboardAIRecommendationPromise: Promise<typeof import('../lib/groq')> | null = null;

function loadDashboardAIRecommendation() {
  if (!dashboardAIRecommendationPromise) {
    dashboardAIRecommendationPromise = import('../lib/groq');
  }
  return dashboardAIRecommendationPromise;
}

class ErrorBoundary extends Component<{ children: React.ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Dashboard ErrorBoundary caught an error', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 text-center">
          <h2 className="mb-2 text-xl font-bold">Ceva nu a mers bine in Dashboard.</h2>
          <button onClick={() => window.location.reload()} className="text-accent underline">Reincarca pagina</button>
        </div>
      );
    }
    return this.props.children;
  }
}

function MagneticButton({
  children,
  className,
  style,
  to,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  to?: string;
}) {
  const reducedMotion = typeof window !== 'undefined'
    && (window.matchMedia('(prefers-reduced-motion: reduce)').matches
      || document.documentElement.getAttribute('data-performance') === 'lite');
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const handleMouse = (e: React.MouseEvent) => {
    if (reducedMotion) return;
    const { clientX, clientY, currentTarget } = e;
    const { left, top, width, height } = currentTarget.getBoundingClientRect();
    const x = (clientX - (left + width / 2)) * 0.22;
    const y = (clientY - (top + height / 2)) * 0.22;
    setPosition({ x, y });
  };

  const reset = () => setPosition({ x: 0, y: 0 });

  const content = (
    <motion.div
      onMouseMove={handleMouse}
      onMouseLeave={reset}
      animate={reducedMotion ? undefined : { x: position.x, y: position.y }}
      transition={{ type: 'spring', stiffness: 180, damping: 18, mass: 0.15 }}
      className={className}
      style={style}
    >
      {children}
    </motion.div>
  );

  return to ? <Link to={to} style={{ textDecoration: 'none' }}>{content}</Link> : content;
}

const AI_REC_KEY = 'studyx-ai-recommendation';

function AIStudyBuddy() {
  const theme = useTheme();
  const { quizzes } = useQuizStore();
  const { questionStats, streak, getDueQuestions, getAccuracy, getStatsByTag } = useStatsStore();
  const { hasKey, knowledgeSources } = useAIStore();

  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const reducedMotion = typeof window !== 'undefined'
    && (window.matchMedia('(prefers-reduced-motion: reduce)').matches
      || document.documentElement.getAttribute('data-performance') === 'lite');

  const today = new Date().toISOString().split('T')[0];

  const summary = useMemo(
    () => buildPerformanceSummary(questionStats, streak, getDueQuestions, getAccuracy, getStatsByTag, quizzes),
    [quizzes, questionStats, streak, getDueQuestions, getAccuracy, getStatsByTag],
  );
  const coachPlan = useMemo(() => buildStudyCoachPlan(summary, knowledgeSources), [summary, knowledgeSources]);
  const userContext = buildUserContextString(summary);

  const generate = useCallback(async () => {
    if (!hasKey()) return;
    setLoading(true);
    try {
      const { generateStudyRecommendation } = await loadDashboardAIRecommendation();
      const rec = await generateStudyRecommendation(
        userContext,
        summary.dueCount,
        summary.weakTopics.map((topic: { tag: string }) => topic.tag),
      );
      const entry = { date: today, text: rec };
      localStorage.setItem(AI_REC_KEY, JSON.stringify(entry));
      setText(rec);
    } catch (err) {
      console.error('[Dashboard] AI recommendation error:', err);
      setText(null);
    } finally {
      setLoading(false);
    }
  }, [userContext, summary.dueCount, summary.weakTopics, today, hasKey]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(AI_REC_KEY);
      if (raw) {
        const entry = JSON.parse(raw);
        if (entry.date === today && entry.text) {
          setText(entry.text);
          return;
        }
      }
    } catch (err) {
      console.error('[Dashboard] Error reading recommendation cache:', err);
    }
    if (hasKey()) {
      if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        const id = window.requestIdleCallback(() => {
          void generate();
        }, { timeout: 1500 });
        return () => window.cancelIdleCallback(id);
      }
      void generate();
    }
  }, [hasKey, generate, today]);

  if (dismissed) return null;
  if (!hasKey() && summary.totalAnswered === 0) return null;

  const displayText = text ?? (
    !hasKey()
      ? (summary.dueCount > 0
          ? `Ai ${summary.dueCount} intrebari de recapitulat azi. Mentine ritmul activ.`
          : 'Configureaza AI in Setari pentru recomandari personalizate.')
      : null
  );

  if (!displayText && !loading) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="editorial-hero relative mb-8 overflow-hidden rounded-[34px] p-6 sm:p-7 luxe-card"
      style={{
        background: theme.isDark
          ? 'linear-gradient(135deg, rgba(86,102,255,0.12), rgba(255,255,255,0.03))'
          : 'linear-gradient(135deg, rgba(255,255,255,0.90), rgba(245,249,253,0.82))',
        border: `1px solid ${theme.border}`,
      }}
    >
      <motion.div
        animate={reducedMotion ? undefined : { opacity: [0.1, 0.2, 0.1], scale: [1, 1.1, 1] }}
        transition={reducedMotion ? undefined : { duration: 8, repeat: Infinity }}
        className="pointer-events-none absolute inset-0"
        style={{ background: `radial-gradient(circle at 80% 20%, ${theme.accent2}30, transparent 60%)` }}
      />

      <div className="relative z-10 flex flex-col gap-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-4">
            <div
              className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-[22px] shadow-lg"
              style={{ background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})`, boxShadow: `0 14px 30px ${theme.accent}38` }}
            >
              <Sparkles size={24} className="text-white" />
            </div>
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-3">
                <span className="secondary-label font-black tracking-[0.22em]" style={{ color: theme.accent2 }}>
                  AI STUDY COACH
                </span>
                <span
                  className="rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em]"
                  style={{ background: theme.surface2, border: `1px solid ${theme.border}`, color: theme.text3 }}
                >
                  {coachPlan.sourceQualityLabel}
                </span>
                {loading && (
                  <div className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <motion.div
                        key={i}
                        animate={reducedMotion ? undefined : { scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
                        transition={reducedMotion ? undefined : { duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ background: theme.accent2 }}
                      />
                    ))}
                  </div>
                )}
              </div>
              <h2 className="max-w-2xl text-[1.9rem] font-black tracking-[-0.05em] sm:text-[2.35rem]" style={{ color: theme.text }}>
                {coachPlan.headline}
              </h2>
              <p className="mt-3 max-w-2xl text-sm font-medium leading-relaxed opacity-80 sm:text-[15px]" style={{ color: theme.text }}>
                {coachPlan.summary}
              </p>
              <div className="mt-4 flex flex-wrap gap-2.5">
                <span
                  className="rounded-full px-3.5 py-1.5 text-[11px] font-bold"
                  style={{ background: theme.surface2, border: `1px solid ${theme.border}`, color: theme.text3 }}
                >
                  Focus: {coachPlan.focusTopic}
                </span>
                {summary.dueCount > 0 && (
                  <span
                    className="rounded-full px-3.5 py-1.5 text-[11px] font-bold"
                    style={{ background: theme.surface2, border: `1px solid ${theme.border}`, color: theme.text3 }}
                  >
                    {summary.dueCount} itemi cer atentie
                  </span>
                )}
                <span
                  className="rounded-full px-3.5 py-1.5 text-[11px] font-bold"
                  style={{ background: theme.surface2, border: `1px solid ${theme.border}`, color: theme.text3 }}
                >
                  {knowledgeSources.length} surse AI
                </span>
              </div>
            </div>
          </div>
          <button onClick={() => setDismissed(true)} className="rounded-2xl p-2.5 transition-colors hover:bg-white/5" style={{ color: theme.text3 }}>
            <X size={16} />
          </button>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.9fr)]">
          <div
            className="rounded-[28px] px-5 py-5 sm:px-6"
            style={{ background: theme.surface2, border: `1px solid ${theme.border}` }}
          >
            <div className="mb-2 text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: theme.text3 }}>
              Recomandare AI contextuala
            </div>
            {loading && !displayText ? (
              <div className="mt-4 space-y-3">
                <div className="skeleton-block h-3 w-3/4 rounded-full" />
                <div className="skeleton-block h-3 w-5/6 rounded-full" />
                <div className="skeleton-block h-3 w-1/2 rounded-full" />
              </div>
            ) : (
              <p className="text-[15px] font-medium leading-[1.72]" style={{ color: theme.text }}>
                {displayText}
              </p>
            )}
            {!loading && text && (
              <motion.button
                whileHover={reducedMotion ? undefined : { x: 4 }}
                onClick={generate}
                className="mt-5 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.16em] opacity-70 transition-opacity hover:opacity-100"
                style={{ color: theme.accent2 }}
              >
                Regenereaza recomandarea <RefreshCw size={12} />
              </motion.button>
            )}
          </div>

          <div className="grid gap-3">
            {coachPlan.actions.map((action) => {
              const toneColor = action.tone === 'warning'
                ? theme.warning
                : action.tone === 'success'
                  ? theme.success
                  : theme.accent;
              const cardContent = (
                <>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <span
                      className="rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em]"
                      style={{ background: `${toneColor}16`, color: toneColor }}
                    >
                      {action.tone === 'warning' ? 'Recovery' : action.tone === 'success' ? 'Library' : 'Focus'}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: theme.text3 }}>
                      {action.route ? 'Deschide' : 'Info'}
                    </span>
                  </div>
                  <h3 className="text-base font-black tracking-tight" style={{ color: theme.text }}>
                    {action.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed" style={{ color: theme.text3 }}>
                    {action.detail}
                  </p>
                </>
              );

              return action.route ? (
                <Link
                  key={action.title}
                  to={action.route}
                  className="premium-card-hover rounded-[26px] px-5 py-4 no-underline"
                  style={{ background: theme.surface2, border: `1px solid ${theme.border}` }}
                >
                  {cardContent}
                </Link>
              ) : (
                <div
                  key={action.title}
                  className="premium-card-hover rounded-[26px] px-5 py-4"
                  style={{ background: theme.surface2, border: `1px solid ${theme.border}` }}
                >
                  {cardContent}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function useCountUp(target: number, duration = 600) {
  const [value, setValue] = useState(target);
  const previousTargetRef = useRef(target);
  const reducedMotion = typeof window !== 'undefined'
    && (window.matchMedia('(prefers-reduced-motion: reduce)').matches
      || document.documentElement.getAttribute('data-performance') === 'lite');

  useEffect(() => {
    const startValue = previousTargetRef.current;
    previousTargetRef.current = target;

    if (reducedMotion) return;
    if (startValue === target) return;

    const startTime = Date.now();

    const tick = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(startValue + eased * (target - startValue)));
      if (progress < 1) requestAnimationFrame(tick);
    };

    const raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, reducedMotion]);

  return reducedMotion ? target : value;
}

const StatCard = memo(function StatCard({
  label,
  numeric,
  suffix,
  display,
  color,
  delay,
  trend,
}: {
  label: string;
  numeric: number;
  suffix: string;
  display?: string;
  color: string;
  delay: number;
  trend?: 'up' | 'down' | 'neutral';
}) {
  const theme = useTheme();
  const reducedMotion = typeof window !== 'undefined'
    && (window.matchMedia('(prefers-reduced-motion: reduce)').matches
      || document.documentElement.getAttribute('data-performance') === 'lite');

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      whileHover={reducedMotion ? undefined : { y: -5, transition: { duration: 0.2 } }}
      className="premium-card-hover relative overflow-hidden rounded-[28px] p-6 glass-panel premium-shadow"
      style={{
        borderTop: `3px solid ${color}`,
        background: theme.surface,
      }}
    >
      <div className="relative z-10">
        <div className="mb-4 flex items-center justify-between">
          <div className="secondary-label font-black tracking-widest" style={{ color: theme.text3 }}>{label}</div>
          {trend && trend !== 'neutral' && (
            <div
              className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black ${trend === 'up' ? 'text-green-600' : 'text-red-600'}`}
              style={{ background: trend === 'up' ? 'rgba(48,209,88,0.15)' : 'rgba(255,69,58,0.15)' }}
            >
              {trend === 'up' ? '▲' : '▼'} 2%
            </div>
          )}
        </div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-4xl font-black tracking-tighter tabular-nums"
          style={{ color: theme.text }}
        >
          {display ?? `${numeric}${suffix}`}
        </motion.div>
      </div>
    </motion.div>
  );
});

const TodayProgressCard = memo(function TodayProgressCard() {
  const theme = useTheme();
  const { getDueQuestions } = useStatsStore();
  const dueCount = getDueQuestions().length;
  const reducedMotion = typeof window !== 'undefined'
    && (window.matchMedia('(prefers-reduced-motion: reduce)').matches
      || document.documentElement.getAttribute('data-performance') === 'lite');

  const totalDueToday = Math.max(dueCount, 10);
  const completedToday = Math.max(0, totalDueToday - dueCount);
  const progressPercent = Math.round((completedToday / totalDueToday) * 100);

  const r = 36;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - progressPercent / 100);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="premium-card-hover relative mb-10 flex items-center gap-8 overflow-hidden rounded-[32px] p-6 glass-panel"
      style={{ border: `1px solid ${theme.accent}20` }}
    >
      <div className="relative h-24 w-24 flex-shrink-0">
        <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r={r} fill="none" stroke={theme.surface2} strokeWidth="8" />
          <motion.circle
            cx="50"
            cy="50"
            r={r}
            fill="none"
            stroke={theme.accent}
            strokeWidth="8"
            strokeDasharray={circ}
            initial={{ strokeDashoffset: circ }}
            animate={{ strokeDashoffset: offset }}
            transition={reducedMotion ? { duration: 0 } : { duration: 1.5, ease: 'easeOut' }}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-black" style={{ color: theme.text }}>{progressPercent}%</span>
        </div>
      </div>

      <div className="flex-1">
        <h3 className="mb-1 text-xl font-black" style={{ color: theme.text }}>Sesiunea de azi</h3>
        <p className="mb-4 text-sm font-medium opacity-60" style={{ color: theme.text }}>
          {dueCount > 0 ? `Mai ai ${dueCount} intrebari de recapitulat pentru a-ti atinge obiectivul.` : 'Felicitari! Ai terminat toate recapitularile pentru azi.'}
        </p>
        <Link
          to="/daily-review"
          className="press-feedback inline-flex items-center gap-2 rounded-2xl px-5 py-2.5 text-[11px] font-black uppercase tracking-widest text-white shadow-lg transition-transform hover:scale-105 active:scale-95"
          style={{ background: theme.accent, boxShadow: `0 8px 20px ${theme.accent}40` }}
        >
          Incepe sesiunea <Zap size={13} fill="white" />
        </Link>
      </div>

      <div
        className="pointer-events-none absolute -bottom-8 -right-8 h-40 w-40 opacity-10"
        style={{ background: `radial-gradient(circle, ${theme.accent}, transparent 70%)`, filter: 'blur(40px)' }}
      />
    </motion.div>
  );
});

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

  const animatedQuizzes = useCountUp(quizzes.length);
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
      .sort((a, b) => (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt))
      .slice(0, 4),
    [quizzes],
  );

  if (!_hasHydrated) {
    return (
      <div className={`premium-shell h-full overflow-y-auto px-4 sm:px-8 ${compact ? 'py-5 sm:py-6' : 'py-6 sm:py-10'}`}>
        <div className={`${compact ? 'max-w-[1040px]' : 'max-w-[1120px]'} mx-auto shell-main-stage`}>
          <div className="mb-10 h-10 w-48 animate-pulse rounded-xl bg-white/5" />
          <div className="mb-12 grid grid-cols-2 gap-5 md:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 animate-pulse rounded-[32px] bg-white/5" />
            ))}
          </div>
          <div className="mb-12 h-40 animate-pulse rounded-[32px] bg-white/5" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-48 animate-pulse rounded-[32px] bg-white/5" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const greeting = hour < 12 ? 'Buna dimineata' : hour < 18 ? 'Buna ziua' : 'Buna seara';

  const stats = [
    { label: 'Grile', numeric: quizzes.length, display: String(animatedQuizzes), suffix: '', color: theme.accent, trend: 'neutral' as const },
    { label: 'Streak', numeric: streak.currentStreak, display: `${animatedStreak} zile`, suffix: '', color: theme.warning, trend: 'up' as const },
    { label: 'Acuratete', numeric: accuracy, display: accuracy > 0 ? `${animatedAccuracy}%` : '—', suffix: '%', color: theme.success, trend: accuracy >= 75 ? 'up' as const : 'down' as const },
    { label: 'Timp studiu', numeric: studyHours, display: studyHours > 0 ? `${animatedStudyHours}h` : `${animatedStudyMinutes}m`, suffix: 'h', color: theme.accent2, trend: 'up' as const },
  ];

  return (
    <ErrorBoundary>
      <div className={`premium-shell h-full overflow-y-auto px-4 sm:px-8 ${compact ? 'py-5 sm:py-6' : 'py-6 sm:py-10'}`}>
        <div className={`${compact ? 'max-w-[1040px]' : 'max-w-[1120px]'} mx-auto shell-main-stage`}>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className={compact ? 'mb-7' : 'mb-10'}>
            <div className="secondary-label mb-3 font-black tracking-[0.22em]" style={{ color: theme.text3 }}>
              STUDYX OVERVIEW
            </div>
            <h1 className={`${compact ? 'text-3xl' : 'text-5xl'} mb-2 font-black tracking-tighter`} style={{ color: theme.text }}>
              {greeting}, <span style={{ background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', display: 'inline-block' }}>{username}</span>
            </h1>
            <p className="max-w-2xl text-sm font-medium leading-relaxed opacity-70 sm:text-[15px]" style={{ color: theme.text }}>
              {new Date().toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}. Un tablou calm, clar si orientat spre progres real.
            </p>
          </motion.div>

          <AIStudyBuddy />

          <div className={`shell-stage-panel grid grid-cols-2 ${compact ? 'mb-8 gap-4 p-4 xl:grid-cols-4' : 'mb-12 gap-5 p-5 md:grid-cols-4'}`}>
            {stats.map((stat, index) => <StatCard key={stat.label} {...stat} delay={0.1 + index * 0.05} />)}
          </div>

          {quizzes.length > 0 && <TodayProgressCard />}

          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className={`flex flex-wrap items-center ${compact ? 'mb-8 gap-3' : 'mb-12 gap-4'}`}>
            <MagneticButton
              to="/create"
              className={`press-feedback flex items-center gap-2.5 ${compact ? 'rounded-[20px] px-6 py-3.5' : 'rounded-[24px] px-8 py-4'} text-[11px] font-black uppercase tracking-wider text-white shadow-2xl transition-all`}
              style={{ background: `linear-gradient(135deg, ${theme.accent} 0%, ${theme.accent2} 100%)`, boxShadow: `0 12px 30px ${theme.accent}40` }}
            >
              <span data-tutorial="btn-new-quiz" className="contents">
                <Plus size={18} strokeWidth={3} /> Creeaza grila
              </span>
            </MagneticButton>
            <div data-tutorial="btn-import"><ImportQuizButton /></div>
            <MagneticButton
              to="/quizzes"
              className={`press-feedback flex items-center gap-2.5 ${compact ? 'rounded-[20px] px-6 py-3.5' : 'rounded-[24px] px-8 py-4'} text-xs font-bold uppercase tracking-wider glass-panel transition-all hover:bg-white/5`}
              style={{ color: theme.text, border: `1px solid ${theme.border}` }}
            >
              <BookOpen size={16} /> Exploreaza
            </MagneticButton>
          </motion.div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-bold" style={{ color: theme.text }}><Sparkles size={18} /> Grile recente</h2>
              <Link to="/quizzes" className="text-xs font-bold uppercase tracking-widest hover:underline" style={{ color: theme.accent }}>Vezi tot</Link>
            </div>
            {recentQuizzes.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {recentQuizzes.map((quiz, index) => <QuizCard key={quiz.id} quiz={quiz} index={index} />)}
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center rounded-[40px] border border-dashed border-white/10 py-16 glass-panel"
              >
                <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-white/5">
                  <BookOpen size={40} className="opacity-20" style={{ color: theme.text }} />
                </div>
                <h3 className="mb-2 text-xl font-bold" style={{ color: theme.text }}>Incepe calatoria ta medicala</h3>
                <p className="mx-auto mb-8 max-w-xs text-sm font-medium" style={{ color: theme.text3 }}>
                  Nu ai nicio grila adaugata inca. Importa un fisier sau creeaza una manual pentru a incepe studiul.
                </p>
                <div className="mb-8 flex flex-wrap items-center justify-center gap-2 px-4">
                  <span className="premium-chip rounded-full px-3 py-1 text-[11px] font-semibold" style={{ color: theme.text3 }}>Import JSON rapid</span>
                  <span className="premium-chip rounded-full px-3 py-1 text-[11px] font-semibold" style={{ color: theme.text3 }}>Flashcards automate</span>
                  <span className="premium-chip rounded-full px-3 py-1 text-[11px] font-semibold" style={{ color: theme.text3 }}>Biblioteca AI integrata</span>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <MagneticButton
                    to="/create"
                    className="press-feedback inline-flex items-center gap-2 rounded-2xl px-8 py-3.5 text-xs font-black uppercase tracking-widest text-white shadow-xl"
                    style={{ background: theme.accent }}
                  >
                    Creeaza prima grila
                  </MagneticButton>
                  <motion.button
                    whileHover={typeof window !== 'undefined' && document.documentElement.getAttribute('data-performance') === 'lite' ? undefined : { y: -1 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={startTutorial}
                    className="press-feedback inline-flex items-center gap-2 rounded-2xl px-6 py-3.5 text-xs font-bold uppercase tracking-[0.14em] glass-panel"
                    style={{ color: theme.text, border: `1px solid ${theme.border}` }}
                  >
                    Tur rapid
                  </motion.button>
                </div>
              </motion.div>
            )}
          </motion.div>
        </div>
      </div>
    </ErrorBoundary>
  );
}
