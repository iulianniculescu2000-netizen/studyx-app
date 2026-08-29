import { motion } from 'framer-motion';
import { Crown, TrendingUp, TrendingDown, Minus, Trophy } from 'lucide-react';
import { useTheme } from '../../theme/ThemeContext';

export interface SelfComparisonEntry {
  label: string;
  /** Accuracy 0-100 for the period. */
  value: number;
  /** Questions answered in the period (context under the bar). */
  questions: number;
  highlight?: boolean;
  isBest?: boolean;
}

interface AIGamificationSelfComparisonProps {
  entries: SelfComparisonEntry[];
  /** Motivational delta: today's accuracy minus yesterday's. */
  todayVsYesterday: number;
}

export default function AIGamificationSelfComparison({
  entries,
  todayVsYesterday,
}: AIGamificationSelfComparisonProps) {
  const theme = useTheme();
  const maxValue = Math.max(100, ...entries.map((entry) => entry.value));

  const motivation = (() => {
    if (todayVsYesterday > 0) {
      return {
        icon: <TrendingUp className="w-5 h-5" />,
        text: `Azi ești cu ${todayVsYesterday}% mai bun decât ieri. Continuă așa! 🚀`,
        color: theme.success,
      };
    }
    if (todayVsYesterday < 0) {
      return {
        icon: <TrendingDown className="w-5 h-5" />,
        text: `Azi ești cu ${Math.abs(todayVsYesterday)}% sub ieri. O sesiune scurtă te readuce pe val. 💪`,
        color: theme.warning,
      };
    }
    return {
      icon: <Minus className="w-5 h-5" />,
      text: 'Constanța bate intensitatea. Ține ritmul cu tine însuți. 🎯',
      color: theme.text3,
    };
  })();

  return (
    <div className="glass-panel rounded-xl overflow-hidden">
      {/* Header */}
      <div className="p-6 text-center" style={{ background: `${theme.accent}14`, borderBottom: `1px solid ${theme.border}` }}>
        <div className="flex items-center justify-center gap-3">
          <Crown className="w-6 h-6" style={{ color: theme.accent }} />
          <h2 className="text-2xl font-bold" style={{ color: theme.text }}>Tu vs. Tine</h2>
        </div>
        <p className="mt-2" style={{ color: theme.text3 }}>
          Singurul competitor care contează ești tu de ieri
        </p>
      </div>

      <div className="p-6">
        {/* Motivation banner */}
        <div
          className="flex items-center gap-3 p-4 rounded-xl mb-6"
          style={{ background: `${motivation.color}14`, border: `1px solid ${motivation.color}35`, color: motivation.color }}
        >
          {motivation.icon}
          <span className="font-medium">{motivation.text}</span>
        </div>

        <div className="space-y-4">
          {entries.map((entry, index) => (
            <motion.div
              key={entry.label}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.06 }}
              className="p-4 rounded-xl transition-all duration-200"
              style={{
                background: entry.highlight ? `${theme.accent}14` : entry.isBest ? `${theme.warning}14` : theme.surface2,
                border: `1px solid ${entry.highlight ? `${theme.accent}55` : entry.isBest ? `${theme.warning}55` : theme.border}`,
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {entry.isBest && <Trophy className="w-4 h-4" style={{ color: theme.warning }} />}
                  <h3 className="font-bold" style={{ color: theme.text }}>{entry.label}</h3>
                  {entry.highlight && (
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: `${theme.accent}25`, color: theme.accent }}>
                      ACUM
                    </span>
                  )}
                </div>
                <span className="font-bold text-lg" style={{ color: theme.text }}>{entry.value}%</span>
              </div>

              {/* Progress bar */}
              <div className="h-2.5 w-full rounded-full overflow-hidden" style={{ background: theme.surface2 }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(entry.value / maxValue) * 100}%` }}
                  transition={{ delay: index * 0.06 + 0.1, duration: 0.5 }}
                  className="h-full rounded-full"
                  style={{ background: entry.highlight ? theme.accent : entry.isBest ? theme.warning : theme.text3 }}
                />
              </div>

              <p className="mt-2 text-xs" style={{ color: theme.text3 }}>
                {entry.questions > 0 ? `${entry.questions} întrebări` : 'Fără activitate înregistrată'}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
