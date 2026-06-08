import React from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, Clock, BookOpen } from 'lucide-react';

interface Quiz {
  id: string;
  title: string;
  description: string;
  questionCount: number;
  category: string;
  difficulty: 'easy' | 'medium' | 'hard';
  timeLimit?: number;
  shuffleQuestions: boolean;
  shuffleAnswers: boolean;
}

interface QuizPlayHeaderProps {
  quiz: Quiz;
  examMode: boolean;
  timedMode: boolean;
  progress: number;
  answeredCount: number;
  totalQuestions: number;
  timeElapsed: React.ReactNode;
  onExit: () => void;
}

const QuizPlayHeader = React.memo(function QuizPlayHeader({ 
  quiz, 
  examMode, 
  timedMode, 
  progress, 
  answeredCount, 
  totalQuestions, 
  timeElapsed,
  onExit 
}: QuizPlayHeaderProps) {

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-100 dark:border-gray-800 px-6 py-4 sticky top-0 z-50"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-6">
        {/* Left Section - Exit Button & Meta */}
        <div className="flex items-center gap-5">
          <motion.button
            whileHover={{ scale: 1.05, x: -2 }}
            whileTap={{ scale: 0.95 }}
            onClick={onExit}
            className="flex items-center gap-2 px-4 py-2 bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-[14px] hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200 font-bold text-sm border border-gray-100 dark:border-gray-700"
          >
            <ChevronLeft className="w-4 h-4" />
            Ieșire
          </motion.button>
          
          <div className="hidden lg:flex flex-col">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.15em] text-blue-500 mb-0.5">
              <BookOpen className="w-3 h-3" />
              <span>{quiz.category || 'Medicină'}</span>
            </div>
            <div className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
              Dificultate: {quiz.difficulty}
            </div>
          </div>
        </div>

        {/* Center Section - Quiz Info */}
        <div className="flex-1 text-center min-w-0">
          <h1 className="text-lg font-black text-gray-900 dark:text-white mb-0.5 truncate tracking-tight">
            {quiz.title}
          </h1>
          <div className="flex items-center justify-center gap-2 text-xs font-bold text-gray-400 dark:text-gray-500">
            <span>{answeredCount} / {totalQuestions} întrebări</span>
            <span className="w-1 h-1 bg-gray-300 dark:bg-gray-700 rounded-full" />
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {timeElapsed}
            </div>
          </div>
        </div>

        {/* Right Section - Progress & Modes */}
        <div className="flex items-center gap-5">
          <div className="flex gap-2">
            {examMode && (
              <span className="px-3 py-1 bg-red-500/10 text-red-600 dark:text-red-400 rounded-full text-[10px] font-black uppercase tracking-wider border border-red-500/20">
                Examen
              </span>
            )}
            {timedMode && (
              <span className="px-3 py-1 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-full text-[10px] font-black uppercase tracking-wider border border-blue-500/20">
                Test Cronometrat
              </span>
            )}
          </div>

          <div className="hidden sm:block w-32 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.8, ease: "circOut" }}
              className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full rounded-full shadow-[0_0_8px_rgba(59,130,246,0.5)]"
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
});

export default QuizPlayHeader;
