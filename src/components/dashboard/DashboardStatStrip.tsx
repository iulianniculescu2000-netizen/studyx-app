import { memo } from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '../../theme/ThemeContext';
import { useAdaptiveMotion } from '../../hooks/useAdaptiveMotion';
import GlassCard from '../ui/GlassCard';

export type DashboardStat = {
  label: string;
  numeric: number;
  display?: string;
  suffix: string;
  color: string;
  delta?: number | null;
  deltaUnit?: '%' | 'pp';
};

/**
 * Thin strip of stats under the hero (UI 2.0) — replaces the four
 * competing 28px-radius cards from UI 1.0. Same numbers, same real
 * week-over-week deltas, just not fighting the hero for attention.
 */
const DashboardStatStrip = memo(function DashboardStatStrip({ stats }: { stats: DashboardStat[] }) {
  const theme = useTheme();
  const { calmMotion } = useAdaptiveMotion();

  return (
    <GlassCard
      animate
      padding="0"
      radius="24px"
      className="mb-8 grid grid-cols-2 divide-x md:grid-cols-4 md:divide-x"
      style={{ borderColor: theme.border }}
    >
      {stats.map((stat, index) => (
        <motion.div
          key={stat.label}
          initial={calmMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
          animate={calmMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
          transition={calmMotion ? { delay: index * 0.04, duration: 0.2, ease: 'linear' } : { delay: index * 0.06, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="flex items-center justify-between gap-3 px-5 py-4"
          style={{ borderColor: theme.border }}
        >
          <div>
            <div className="secondary-label mb-1 font-black tracking-widest" style={{ color: theme.text3 }}>{stat.label}</div>
            <div className="text-2xl font-black tracking-tighter tabular-nums" style={{ color: theme.text }}>
              {stat.display ?? `${stat.numeric}${stat.suffix}`}
            </div>
          </div>
          {typeof stat.delta === 'number' && stat.delta !== 0 && (
            <div
              className={`flex flex-shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black ${stat.delta > 0 ? 'text-green-600' : 'text-red-600'}`}
              style={{ background: stat.delta > 0 ? 'rgba(48,209,88,0.15)' : 'rgba(255,69,58,0.15)' }}
              title="Față de săptămâna trecută"
            >
              {stat.delta > 0 ? '▲' : '▼'} {Math.abs(stat.delta)}{stat.deltaUnit === 'pp' ? ' pp' : '%'}
            </div>
          )}
        </motion.div>
      ))}
    </GlassCard>
  );
});

export default DashboardStatStrip;
