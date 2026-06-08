import { motion } from 'framer-motion';
import { Calendar } from 'lucide-react';

interface AIPredictiveTimeframeProps {
  timeframe: 'week' | 'month' | 'semester';
  setTimeframe: (timeframe: 'week' | 'month' | 'semester') => void;
}

export default function AIPredictiveTimeframe({ timeframe, setTimeframe }: AIPredictiveTimeframeProps) {
  const periods = [
    { id: 'week', label: 'Săptămână' },
    { id: 'month', label: 'Lună' },
    { id: 'semester', label: 'Semestru' }
  ] as const;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 mb-6"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Calendar className="w-5 h-5 text-gray-500" />
          <span className="font-medium text-gray-700 dark:text-gray-300">
            Perioadă analiză:
          </span>
        </div>
        <div className="flex gap-2">
          {periods.map((period) => (
            <motion.button
              key={period.id}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setTimeframe(period.id)}
              className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                timeframe === period.id
                  ? 'bg-purple-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {period.label}
            </motion.button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
