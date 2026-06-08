import React from 'react';
import { motion } from 'framer-motion';

interface QuizPlayProgressProps {
  progress: number;
  answeredCount: number;
  totalQuestions: number;
  timeElapsed: number;
  correctCount?: number;
  accuracy?: number;
  isTimerStatic?: boolean;
}

const QuizPlayProgress = React.memo(function QuizPlayProgress({
  progress,
  answeredCount,
  totalQuestions,
  timeElapsed,
  correctCount,
  accuracy,
  isTimerStatic = false,
}: QuizPlayProgressProps) {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-5xl mx-auto bg-white/40 dark:bg-gray-900/40 backdrop-blur-sm rounded-[32px] border border-gray-100 dark:border-gray-800 p-6 mb-8 shadow-sm"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        {/* Left Side: Label and Question Count */}
        <div className="flex flex-col">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
            <h3 className="text-[11px] font-black uppercase tracking-[0.25em] text-blue-500">
              Sesiune Activă
            </h3>
          </div>
          <div className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
            {answeredCount} <span className="text-gray-300 dark:text-gray-700 mx-1">/</span> {totalQuestions}
            <span className="ml-2 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">întrebări</span>
          </div>
        </div>

        {/* Center: Progress Bar */}
        <div className="flex-1 max-w-md">
          <div className="flex justify-between items-center mb-2.5">
            <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">
              Progres Total
            </span>
            <span className="text-xs font-black text-blue-600 dark:text-blue-400">
              {Math.round(progress)}%
            </span>
          </div>
          <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2.5 p-0.5 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 1, ease: "circOut" }}
              className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600 rounded-full shadow-[0_0_12px_rgba(59,130,246,0.3)]"
            />
          </div>
        </div>

        {/* Right Side: Timer or Stats */}
        <div className="flex items-center gap-4">
          {!isTimerStatic && (
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">
                Timp Sesiune
              </span>
              <div className="text-xl font-black text-gray-900 dark:text-white tabular-nums">
                {formatTime(timeElapsed)}
              </div>
            </div>
          )}
          
          {(correctCount !== undefined || accuracy !== undefined) && (
            <div className="flex gap-4 border-l border-gray-100 dark:border-gray-800 pl-4 ml-2">
              {accuracy !== undefined && (
                <div className="flex flex-col items-end">
                  <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">
                    Acuratețe
                  </span>
                  <div className="text-xl font-black text-emerald-500 tracking-tight">
                    {Math.round(accuracy)}%
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
});

export default QuizPlayProgress;
