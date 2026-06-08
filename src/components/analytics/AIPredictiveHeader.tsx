import { motion } from 'framer-motion';
import { Brain } from 'lucide-react';

interface AIPredictiveHeaderProps {
  currentLevel: number;
  subjects: string[];
}

export default function AIPredictiveHeader({ currentLevel, subjects }: AIPredictiveHeaderProps) {
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
        <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-500 to-blue-500 bg-clip-text text-transparent">
          AI Predictive Analytics
        </h1>
      </div>
      <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
        Predicții inteligente pentru examene, identificarea golurilor de cunoștințe și căi de studiu optimizate AI
      </p>
      
      <div className="flex justify-center gap-6 mt-6">
        <div className="flex items-center gap-2 px-4 py-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
          <Brain className="w-4 h-4 text-purple-600" />
          <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
            Nivel {currentLevel}
          </span>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <span className="text-lg">📚</span>
          <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
            {subjects.length} materii
          </span>
        </div>
      </div>
    </motion.div>
  );
}
