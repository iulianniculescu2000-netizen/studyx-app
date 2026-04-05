import { motion } from 'framer-motion';
import { useState, useEffect, useMemo, useCallback, Component, useRef, type ErrorInfo } from 'react';
import { Link } from 'react-router-dom';
import { 
  Plus, BookOpen, Flame, Target, Zap, 
  Sparkles, RefreshCw, X
} from 'lucide-react';
import { useTheme } from '../theme/ThemeContext';
import { useUserStore } from '../store/userStore';
import { useQuizStore } from '../store/quizStore';
import { useStatsStore } from '../store/statsStore';
import { useAIStore } from '../store/aiStore';
import { generateStudyRecommendation } from '../lib/groq';
import { buildPerformanceSummary, buildUserContextString } from '../lib/aiContext';
import ImportQuizButton from '../components/ImportQuizButton';
import QuizCard from '../components/QuizCard';

class ErrorBoundary extends Component<{ children: React.ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Dashboard ErrorBoundary caught an error", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 text-center">
          <h2 className="text-xl font-bold mb-2">Ceva nu a mers bine în Dashboard.</h2>
          <button onClick={() => window.location.reload()} className="text-accent underline">Reîncarcă pagina</button>
        </div>
      );
    }
    return this.props.children;
  }
}

function MagneticButton({ children, className, style, to }: { children: React.ReactNode, className?: string, style?: React.CSSProperties, to?: string }) {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const handleMouse = (e: React.MouseEvent) => {
    const { clientX, clientY, currentTarget } = e;
    const { left, top, width, height } = currentTarget.getBoundingClientRect();
    const x = (clientX - (left + width / 2)) * 0.35;
    const y = (clientY - (top + height / 2)) * 0.35;
    setPosition({ x, y });
  };
  const reset = () => setPosition({ x: 0, y: 0 });

  const content = (
    <motion.div
      onMouseMove={handleMouse}
      onMouseLeave={reset}
      animate={{ x: position.x, y: position.y }}
      transition={{ type: "spring", stiffness: 150, damping: 15, mass: 0.1 }}
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
  const { hasKey } = useAIStore();
  
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  const summary = useMemo(
    () => buildPerformanceSummary(questionStats, streak, getDueQuestions, getAccuracy, getStatsByTag, quizzes),
    [quizzes, questionStats, streak, getDueQuestions, getAccuracy, getStatsByTag]
  );
  const userContext = buildUserContextString(summary);

  const generate = useCallback(async () => {
    if (!hasKey()) return;
    setLoading(true);
    try {
      const rec = await generateStudyRecommendation(
        userContext,
        summary.dueCount,
        summary.weakTopics.map((t: { tag: string }) => t.tag)
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
        if (entry.date === today && entry.text) { setText(entry.text); return; }
      }
    } catch (err) {
      console.error('[Dashboard] Error reading recommendation cache:', err);
    }
    if (hasKey()) generate();
  }, [hasKey, generate, today]);

  if (dismissed) return null;
  if (!hasKey() && summary.totalAnswered === 0) return null;

  const displayText = text ?? (
    !hasKey()
      ? (summary.dueCount > 0
          ? `Ai ${summary.dueCount} întrebări de recapitulat azi. Menține SM-2 activ!`
          : 'Configurează AI în Setări pentru recomandări personalizate.')
      : null
  );

  if (!displayText && !loading) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-8 p-6 rounded-[32px] relative overflow-hidden glass-panel neon-border"
      style={{
        background: theme.isDark 
          ? 'rgba(138, 43, 226, 0.05)' 
          : 'rgba(138, 43, 226, 0.02)',
      }}
    >
      <motion.div 
        animate={{ opacity: [0.1, 0.2, 0.1], scale: [1, 1.1, 1] }}
        transition={{ duration: 8, repeat: Infinity }}
        className="absolute inset-0 pointer-events-none"
        style={{ background: `radial-gradient(circle at 80% 20%, ${theme.accent2}30, transparent 60%)` }} 
      />

      <div className="relative z-10 flex items-start gap-5">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg"
          style={{ background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})`, boxShadow: `0 8px 20px ${theme.accent}40` }}>
          <Sparkles size={22} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-sm font-bold tracking-tight" style={{ color: theme.accent2 }}>ASISTENT INTELIGENT STUDYX</span>
            {loading && (
              <div className="flex gap-1">
                {[0, 1, 2].map(i => (
                  <motion.div key={i}
                    animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
                    className="w-1 h-1 rounded-full"
                    style={{ background: theme.accent2 }}
                  />
                ))}
              </div>
            )}
          </div>
          {loading && !displayText ? (
            <div className="space-y-3 mt-4">
              <div className="h-3 w-3/4 rounded-full bg-white/5 animate-pulse" />
              <div className="h-3 w-1/2 rounded-full bg-white/5 animate-pulse" />
            </div>
          ) : (
            <p className="text-base font-medium leading-relaxed" style={{ color: theme.text }}>
              {displayText}
            </p>
          )}
          {!loading && text && (
            <motion.button whileHover={{ x: 5 }} onClick={generate}
              className="mt-4 text-xs font-bold uppercase tracking-widest flex items-center gap-2 opacity-60 hover:opacity-100 transition-opacity"
              style={{ color: theme.accent2 }}>
              Regenerează recomandarea <RefreshCw size={12} />
            </motion.button>
          )}
        </div>
        <button onClick={() => setDismissed(true)} className="p-2 hover:bg-white/5 rounded-xl transition-colors" style={{ color: theme.text3 }}>
          <X size={16} />
        </button>
      </div>
    </motion.div>
  );
}

function useCountUp(target: number, duration = 600) {
  const [value, setValue] = useState(0);
  const [prevTarget, setPrevTarget] = useState(target);
  const targetRef = useRef(target);

  if (target !== prevTarget) {
    setPrevTarget(target);
    setValue(0);
  }

  useEffect(() => {
    targetRef.current = target;
    if (target === 0) return;

    const startValue = 0;
    const startTime = Date.now();
    
    const tick = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(startValue + eased * (targetRef.current - startValue)));
      if (progress < 1) requestAnimationFrame(tick);
    };
    
    const raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  
  return value;
}

function StatCard({ label, numeric, suffix, display, color, delay, trend }: {
  label: string; numeric: number; suffix: string; display?: string;
  color: string; delay: number; 
  trend?: 'up' | 'down' | 'neutral';
}) {
  const theme = useTheme();
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -5, transition: { duration: 0.2 } }}
      className="rounded-[28px] p-6 relative overflow-hidden glass-panel premium-shadow"
      style={{ 
        borderTop: `3px solid ${color}`,
        background: theme.surface
      }}>
      
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div className="secondary-label font-black tracking-widest" style={{ color: theme.text3 }}>{label}</div>
          {trend && trend !== 'neutral' && (
            <div className={`flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded-full ${trend === 'up' ? 'text-green-600' : 'text-red-600'}`}
              style={{ background: trend === 'up' ? 'rgba(48,209,88,0.15)' : 'rgba(255,69,58,0.15)' }}>
              {trend === 'up' ? '▲' : '▼'} 2%
            </div>
          )}
        </div>
        <motion.div 
          initial={{ opacity: 0, y: 10 }} 
          animate={{ opacity: 1, y: 0 }} 
          className="text-4xl font-black tracking-tighter tabular-nums" style={{ color: theme.text }}>
          {display ?? `${numeric}${suffix}`}
        </motion.div>
      </div>
    </motion.div>
  );
}

function TodayProgressCard() {
  const theme = useTheme();
  const { getDueQuestions } = useStatsStore();
  const dueCount = getDueQuestions().length;
  
  // Mock progress for today's session based on due items
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
      className="mb-10 p-6 rounded-[32px] glass-panel relative overflow-hidden flex items-center gap-8"
      style={{ border: `1px solid ${theme.accent}20` }}
    >
      <div className="relative w-24 h-24 flex-shrink-0">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r={r} fill="none" stroke={theme.surface2} strokeWidth="8" />
          <motion.circle 
            cx="50" cy="50" r={r} fill="none" stroke={theme.accent} strokeWidth="8"
            strokeDasharray={circ}
            initial={{ strokeDashoffset: circ }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center flex-col">
          <span className="text-xl font-black" style={{ color: theme.text }}>{progressPercent}%</span>
        </div>
      </div>
      
      <div className="flex-1">
        <h3 className="text-xl font-black mb-1" style={{ color: theme.text }}>Sesiunea de azi</h3>
        <p className="text-sm font-medium opacity-60 mb-4" style={{ color: theme.text }}>
          {dueCount > 0 ? `Mai ai ${dueCount} întrebări de recapitulat pentru a-ți atinge obiectivul.` : 'Felicitări! Ai terminat toate recapitulările pentru azi.'}
        </p>
        <Link to="/daily-review" 
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-widest text-white shadow-lg transition-transform hover:scale-105 active:scale-95"
          style={{ background: theme.accent, boxShadow: `0 8px 20px ${theme.accent}40` }}>
          Începe Sesiunea <Zap size={13} fill="white" />
        </Link>
      </div>
      
      <div className="absolute -right-8 -bottom-8 w-40 h-40 opacity-10 pointer-events-none"
        style={{ background: `radial-gradient(circle, ${theme.accent}, transparent 70%)`, filter: 'blur(40px)' }} />
    </motion.div>
  );
}

export default function Dashboard() {
  const theme = useTheme();
  const { username } = useUserStore();
  const { quizzes, _hasHydrated } = useQuizStore();
  const { streak, getAccuracy, totalStudyTime } = useStatsStore();
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
    const t = setInterval(() => setHour(new Date().getHours()), 60000);
    return () => clearInterval(t);
  }, []);

  const recentQuizzes = useMemo(() => [...quizzes]
    .sort((a, b) => (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt))
    .slice(0, 4), [quizzes]);

  if (!_hasHydrated) {
    return (
      <div className="h-full overflow-y-auto px-4 sm:px-8 py-6 sm:py-10">
        <div className="max-w-[1000px] mx-auto">
          <div className="h-10 w-48 bg-white/5 rounded-xl mb-10 animate-pulse" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-12">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-32 rounded-[32px] bg-white/5 animate-pulse" />
            ))}
          </div>
          <div className="h-40 bg-white/5 rounded-[32px] mb-12 animate-pulse" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-48 rounded-[32px] bg-white/5 animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const greeting = hour < 12 ? 'Bună dimineața' : hour < 18 ? 'Bună ziua' : 'Bună seara';

  const stats = [
    { label: 'Grile', numeric: quizzes.length, display: String(animatedQuizzes), suffix: '', icon: <BookOpen size={20} />, color: theme.accent, trend: 'neutral' as const },
    { label: 'Streak', numeric: streak.currentStreak, display: `${animatedStreak}🔥`, suffix: '🔥', icon: <Flame size={20} className={streak.currentStreak >= 3 ? 'animate-streak-fire' : ''} />, color: theme.warning, bounce: true, trend: 'up' as const },
    { label: 'Acuratețe', numeric: accuracy, display: accuracy > 0 ? `${animatedAccuracy}%` : '—', suffix: '%', icon: <Target size={20} />, color: theme.success, trend: accuracy >= 75 ? 'up' as const : 'down' as const },
    { label: 'Ore studiu', numeric: studyHours, display: studyHours > 0 ? `${animatedStudyHours}h` : `${animatedStudyMinutes}m`, suffix: 'h', icon: <Zap size={20} />, color: theme.accent2, trend: 'up' as const },
  ];

  return (
    <ErrorBoundary>
      <div className="h-full overflow-y-auto px-4 sm:px-8 py-6 sm:py-10">
        <div className="max-w-[1000px] mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
            <h1 className="text-4xl font-black tracking-tighter mb-2" style={{ color: theme.text }}>
              {greeting}, <span style={{ background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', display: 'inline-block' }}>{username}</span> 👋
            </h1>
            <p className="text-sm font-medium opacity-60" style={{ color: theme.text }}>{new Date().toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
          </motion.div>

          <AIStudyBuddy />

          <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-12">
            {stats.map((s, i) => <StatCard key={s.label} {...s} delay={0.1 + i * 0.05} />)}
          </div>

          {quizzes.length > 0 && <TodayProgressCard />}

          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="flex gap-4 mb-12 flex-wrap items-center">
            <MagneticButton to="/create" className="flex items-center gap-2.5 px-8 py-4 rounded-[24px] font-black uppercase tracking-wider text-[11px] text-white shadow-2xl transition-all" style={{ background: `linear-gradient(135deg, ${theme.accent} 0%, ${theme.accent2} 100%)`, boxShadow: `0 12px 30px ${theme.accent}40` }}>
              <Plus size={18} strokeWidth={3} /> Creează Grilă
            </MagneticButton>
            <div data-tutorial="btn-import"><ImportQuizButton /></div>
            <MagneticButton to="/quizzes" className="flex items-center gap-2.5 px-8 py-4 rounded-[24px] font-bold text-xs uppercase tracking-wider glass-panel hover:bg-white/5 transition-all" style={{ color: theme.text, border: `1px solid ${theme.border}` }}>
              <BookOpen size={16} /> Explorează
            </MagneticButton>
          </motion.div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: theme.text }}><Sparkles size={18} /> Grile recente</h2>
              <Link to="/quizzes" className="text-xs font-bold uppercase tracking-widest hover:underline" style={{ color: theme.accent }}>Vezi tot</Link>
            </div>
            {recentQuizzes.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {recentQuizzes.map((q, i) => <QuizCard key={q.id} quiz={q} index={i} />)}
              </div>
            ) : (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-16 rounded-[40px] glass-panel border border-dashed border-white/10"
              >
                <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
                  <BookOpen size={40} className="opacity-20" style={{ color: theme.text }} />
                </div>
                <h3 className="text-xl font-bold mb-2" style={{ color: theme.text }}>Începe călătoria ta medicală</h3>
                <p className="text-sm font-medium max-w-xs mx-auto mb-8" style={{ color: theme.text3 }}>
                  Nu ai nicio grilă adăugată încă. Importă un fișier sau creează una manual pentru a începe studiul.
                </p>
                <MagneticButton to="/create" className="inline-flex items-center gap-2 px-8 py-3.5 rounded-2xl font-black uppercase tracking-widest text-xs text-white shadow-xl" style={{ background: theme.accent }}>
                  Creează Prima Grilă
                </MagneticButton>
              </motion.div>
            )}
          </motion.div>
        </div>
      </div>
    </ErrorBoundary>
  );
}
