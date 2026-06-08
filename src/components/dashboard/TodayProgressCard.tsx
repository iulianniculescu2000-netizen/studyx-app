import { memo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Zap } from 'lucide-react';
import { useTheme } from '../../theme/ThemeContext';
import { useStatsStore } from '../../store/statsStore';
import { useAdaptiveMotion } from '../../hooks/useAdaptiveMotion';

const TodayProgressCard = memo(function TodayProgressCard() {
  const theme = useTheme();
  const { getDueQuestions } = useStatsStore();
  const dueCount = getDueQuestions().length;
  const { calmMotion, performanceLite } = useAdaptiveMotion();

  const totalDueToday = Math.max(dueCount, 10);
  const completedToday = Math.max(0, totalDueToday - dueCount);
  const progressPercent = Math.round((completedToday / totalDueToday) * 100);

  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - progressPercent / 100);

  return (
    <motion.div
      initial={calmMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95 }}
      animate={calmMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
      className="premium-card-hover relative mb-10 flex items-center gap-8 overflow-hidden rounded-[32px] p-6 glass-panel"
      style={{ border: `1px solid ${theme.accent}20` }}
    >
      <div className="relative h-24 w-24 flex-shrink-0">
        <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r={radius} fill="none" stroke={theme.surface2} strokeWidth="8" />
          <motion.circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke={theme.accent}
            strokeWidth="8"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={calmMotion ? { duration: 0 } : { duration: 1.5, ease: 'easeOut' }}
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
          {dueCount > 0 ? `Mai ai ${dueCount} întrebări de recapitulat pentru a-ți atinge obiectivul.` : 'Felicitări! Ai terminat toate recapitulările pentru azi.'}
        </p>
        <Link
          to="/daily-review"
          className="press-feedback inline-flex items-center gap-2 rounded-2xl px-5 py-2.5 text-[11px] font-black uppercase tracking-widest text-white shadow-lg transition-transform"
          style={{ background: theme.accent, boxShadow: `0 8px 20px ${theme.accent}40` }}
        >
          Începe sesiunea <Zap size={13} fill="white" />
        </Link>
      </div>

      <div
        className="pointer-events-none absolute -bottom-8 -right-8 h-40 w-40 opacity-10"
        style={{ background: `radial-gradient(circle, ${theme.accent}, transparent 70%)`, filter: performanceLite ? 'blur(24px)' : 'blur(40px)' }}
      />
    </motion.div>
  );
});

export default TodayProgressCard;
