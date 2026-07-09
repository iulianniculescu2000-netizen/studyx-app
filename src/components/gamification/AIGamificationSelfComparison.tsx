import { motion } from 'framer-motion';
import { Crown, TrendingUp, TrendingDown, Minus, Trophy } from 'lucide-react';

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
  const maxValue = Math.max(100, ...entries.map((entry) => entry.value));

  const motivation = (() => {
    if (todayVsYesterday > 0) {
      return {
        icon: <TrendingUp className="w-5 h-5" />,
        text: `Azi ești cu ${todayVsYesterday}% mai bun decât ieri. Continuă așa! 🚀`,
        className: 'text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
      };
    }
    if (todayVsYesterday < 0) {
      return {
        icon: <TrendingDown className="w-5 h-5" />,
        text: `Azi ești cu ${Math.abs(todayVsYesterday)}% sub ieri. O sesiune scurtă te readuce pe val. 💪`,
        className: 'text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800',
      };
    }
    return {
      icon: <Minus className="w-5 h-5" />,
      text: 'Constanța bate intensitatea. Ține ritmul cu tine însuți. 🎯',
      className: 'text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700',
    };
  })();

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-500 p-6 text-white">
        <div className="flex items-center justify-center gap-3">
          <Crown className="w-6 h-6" />
          <h2 className="text-2xl font-bold">Tu vs. Tine</h2>
        </div>
        <p className="text-center mt-2 text-blue-100">
          Singurul competitor care contează ești tu de ieri
        </p>
      </div>

      <div className="p-6">
        {/* Motivation banner */}
        <div className={`flex items-center gap-3 p-4 rounded-xl border mb-6 ${motivation.className}`}>
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
              className={`p-4 rounded-xl border-2 transition-all duration-200 ${
                entry.highlight
                  ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700 shadow-lg'
                  : entry.isBest
                    ? 'bg-yellow-50 dark:bg-yellow-900/10 border-yellow-300 dark:border-yellow-800'
                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {entry.isBest && <Trophy className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />}
                  <h3 className="font-bold text-gray-900 dark:text-gray-100">{entry.label}</h3>
                  {entry.highlight && (
                    <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-100 rounded-full font-medium">
                      ACUM
                    </span>
                  )}
                </div>
                <span className="font-bold text-lg text-gray-900 dark:text-gray-100">{entry.value}%</span>
              </div>

              {/* Progress bar */}
              <div className="h-2.5 w-full rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(entry.value / maxValue) * 100}%` }}
                  transition={{ delay: index * 0.06 + 0.1, duration: 0.5 }}
                  className={`h-full rounded-full ${
                    entry.highlight
                      ? 'bg-gradient-to-r from-blue-500 to-purple-500'
                      : entry.isBest
                        ? 'bg-gradient-to-r from-yellow-400 to-orange-500'
                        : 'bg-gray-400 dark:bg-gray-500'
                  }`}
                />
              </div>

              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                {entry.questions > 0 ? `${entry.questions} întrebări` : 'Fără activitate înregistrată'}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
