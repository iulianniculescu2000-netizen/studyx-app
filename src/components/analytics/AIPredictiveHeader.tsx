import { motion } from 'framer-motion';
import { Brain } from 'lucide-react';
import { useTheme } from '../../theme/ThemeContext';

interface AIPredictiveHeaderProps {
  currentLevel: number;
  subjects: string[];
}

export default function AIPredictiveHeader({ currentLevel, subjects }: AIPredictiveHeaderProps) {
  const theme = useTheme();
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-center mb-8"
    >
      <div className="flex items-center justify-center gap-3 mb-4">
        <motion.div
          animate={{
            scale: [1, 1.1, 1],
            rotate: [0, 360]
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="text-4xl"
        >
          🧠
        </motion.div>
        <h1
          className="text-3xl font-bold"
          style={{ background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', display: 'inline-block' }}
        >
          AI Predictive Analytics
        </h1>
      </div>
      <p className="max-w-2xl mx-auto" style={{ color: theme.text3 }}>
        Predicții inteligente pentru examene, identificarea golurilor de cunoștințe și căi de studiu optimizate AI
      </p>

      <div className="flex justify-center gap-6 mt-6">
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg" style={{ background: `${theme.accent}14`, border: `1px solid ${theme.accent}25` }}>
          <Brain className="w-4 h-4" style={{ color: theme.accent }} />
          <span className="text-sm font-medium" style={{ color: theme.accent }}>
            Nivel {currentLevel}
          </span>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg" style={{ background: theme.surface2, border: `1px solid ${theme.border}` }}>
          <span className="text-lg">📚</span>
          <span className="text-sm font-medium" style={{ color: theme.text2 }}>
            {subjects.length} materii
          </span>
        </div>
      </div>
    </motion.div>
  );
}
