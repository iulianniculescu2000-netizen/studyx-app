import { motion } from 'framer-motion';
import { Calendar } from 'lucide-react';
import { useTheme } from '../../theme/ThemeContext';

interface AIPredictiveTimeframeProps {
  timeframe: 'week' | 'month' | 'semester';
  setTimeframe: (timeframe: 'week' | 'month' | 'semester') => void;
}

export default function AIPredictiveTimeframe({ timeframe, setTimeframe }: AIPredictiveTimeframeProps) {
  const theme = useTheme();
  const periods = [
    { id: 'week', label: 'Săptămână' },
    { id: 'month', label: 'Lună' },
    { id: 'semester', label: 'Semestru' }
  ] as const;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-panel rounded-[24px] p-6 mb-6"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Calendar className="w-5 h-5" style={{ color: theme.text3 }} />
          <span className="font-medium" style={{ color: theme.text2 }}>
            Perioadă analiză:
          </span>
        </div>
        <div className="flex gap-2">
          {periods.map((period) => {
            const active = timeframe === period.id;
            return (
              <motion.button
                key={period.id}
                whileHover={{ scale: 1.015 }}
                whileTap={{ scale: 0.93, transition: { type: 'spring', stiffness: 500, damping: 15 } }}
                onClick={() => setTimeframe(period.id)}
                className="press-feedback px-4 py-2 rounded-lg font-medium transition-colors duration-200"
                style={{
                  background: active ? theme.accent : theme.surface2,
                  color: active ? '#fff' : theme.text2,
                }}
              >
                {period.label}
              </motion.button>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
