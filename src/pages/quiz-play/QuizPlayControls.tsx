import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { ChevronRight, GraduationCap, Keyboard, Clock, Zap } from 'lucide-react';

interface QuizPlayControlsProps {
  isLast: boolean;
  revealed: boolean;
  examMode: boolean;
  autoAdvance: boolean;
  showKeys: boolean;
  selectedCount: number;
  questionTimer: number;
  onPrevious: () => void;
  onNext: () => void;
  onFinish: () => void;
  onToggleAutoAdvance: () => void;
  onToggleShowKeys: () => void;
}

const QuizPlayControls = React.memo(function QuizPlayControls({
  isLast,
  revealed,
  examMode,
  autoAdvance,
  showKeys,
  selectedCount,
  questionTimer,
  onPrevious,
  onNext,
  onFinish,
  onToggleAutoAdvance,
  onToggleShowKeys,
}: QuizPlayControlsProps) {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // We only want the animation to reset when the timer is reset to 30, 
  // not on every second decrement.
  const progressWidth = useMemo(() => {
    return (questionTimer / 30) * 100;
  }, [questionTimer]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-5xl mx-auto bg-white/70 dark:bg-gray-900/70 backdrop-blur-xl rounded-[26px] border border-gray-100 dark:border-gray-800 p-5 shadow-2xl shadow-black/5"
    >
      <div className="flex flex-col sm:flex-row items-center justify-between gap-5">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* Previous Button */}
          <motion.button
            whileHover={{ scale: 1.05, x: -2 }}
            whileTap={{ scale: 0.95 }}
            onClick={onPrevious}
            className="flex items-center justify-center gap-2 px-5 py-3 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-[18px] hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200 border border-gray-100 dark:border-gray-700 font-bold text-sm min-w-[120px]"
          >
            <ChevronRight className="w-4 h-4 rotate-180" />
            Anterior
          </motion.button>

          {/* Question Timer */}
          <div className="flex items-center gap-2.5 px-5 py-3 bg-blue-500/5 dark:bg-blue-500/10 rounded-[18px] border border-blue-500/20 min-w-[140px] justify-center">
            <Clock className="w-4 h-4 text-blue-500 animate-pulse" />
            <span className="text-sm font-black text-blue-600 dark:text-blue-400 tabular-nums">
              {formatTime(questionTimer)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* Settings Group */}
          <div className="flex items-center gap-2 bg-gray-50/50 dark:bg-gray-800/50 p-1 rounded-[20px] border border-gray-100 dark:border-gray-700">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onToggleAutoAdvance}
              title={autoAdvance ? "Auto-avansare activată" : "Auto-avansare dezactivată"}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-[16px] transition-all duration-300 font-bold text-xs uppercase tracking-wider ${
                autoAdvance
                  ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/25'
                  : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
              }`}
            >
              <Zap className={`w-3.5 h-3.5 ${autoAdvance ? 'fill-current' : ''}`} />
              Auto
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onToggleShowKeys}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-[16px] transition-all duration-300 font-bold text-xs uppercase tracking-wider ${
                showKeys
                  ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/25'
                  : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
              }`}
            >
              <Keyboard className="w-3.5 h-3.5" />
              Taste
            </motion.button>
          </div>

          {/* Next/Finish Button */}
          <motion.button
            whileHover={{ scale: 1.05, x: 2 }}
            whileTap={{ scale: 0.95 }}
            onClick={isLast ? onFinish : onNext}
            disabled={!revealed && !examMode && selectedCount === 0}
            className="flex items-center justify-center gap-2 px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-[18px] font-black text-sm hover:from-blue-700 hover:to-indigo-700 shadow-xl shadow-blue-500/20 transition-all duration-300 disabled:opacity-30 disabled:shadow-none min-w-[150px] uppercase tracking-widest"
          >
            {isLast ? (
              <>
                Finalizează
                <GraduationCap className="w-4 h-4" />
              </>
            ) : (
              <>
                Următor
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </motion.button>
        </div>
      </div>

      {/* Progress Bar (Time based) */}
      <div className="mt-5 w-full bg-gray-100 dark:bg-gray-800 rounded-full h-1.5 overflow-hidden">
        <motion.div
          animate={{ width: `${progressWidth}%` }}
          transition={{ duration: 1, ease: 'linear' }}
          className={`h-full rounded-full shadow-[0_0_8px] ${
            questionTimer < 10 
              ? 'bg-red-500 shadow-red-500/40' 
              : 'bg-blue-500 shadow-blue-500/40'
          }`}
        />
      </div>

      {/* Selection Status */}
      <div className="mt-3 text-center">
        <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">
          {selectedCount > 0 
            ? `${selectedCount} opțiun${selectedCount > 1 ? 'i' : 'e'} selectat${selectedCount > 1 ? 'e' : 'ă'}`
            : examMode 
            ? 'Alege un răspuns'
            : revealed 
            ? 'Răspuns evaluat' 
            : 'Selectează un răspuns pentru a continua'
          }
        </p>
      </div>
    </motion.div>
  );
});

export default QuizPlayControls;
