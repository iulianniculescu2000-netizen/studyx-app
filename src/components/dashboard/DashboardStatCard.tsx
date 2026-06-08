import { memo } from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '../../theme/ThemeContext';
import { useAdaptiveMotion } from '../../hooks/useAdaptiveMotion';

type Props = {
  label: string;
  numeric: number;
  suffix: string;
  display?: string;
  color: string;
  delay: number;
  trend?: 'up' | 'down' | 'neutral';
};

const DashboardStatCard = memo(function DashboardStatCard({
  label,
  numeric,
  suffix,
  display,
  color,
  delay,
  trend,
}: Props) {
  const theme = useTheme();
  const { calmMotion } = useAdaptiveMotion();

  return (
    <motion.div
      layout
      initial={calmMotion ? { opacity: 0 } : { opacity: 0, y: 20 }}
      animate={calmMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      transition={calmMotion ? { delay, duration: 0.2, ease: 'linear' } : { delay, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      whileHover={calmMotion ? undefined : { y: -5, transition: { duration: 0.2 } }}
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
          initial={calmMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
          animate={calmMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
          className="text-4xl font-black tracking-tighter tabular-nums"
          style={{ color: theme.text }}
        >
          {display ?? `${numeric}${suffix}`}
        </motion.div>
      </div>
    </motion.div>
  );
});

export default DashboardStatCard;
