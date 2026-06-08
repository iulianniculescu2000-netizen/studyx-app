import { motion } from 'framer-motion';
import { ChevronLeft, Clock, BookOpen, Layers, Keyboard } from 'lucide-react';
import { formatQuizPlayTime } from '../../pages/quiz-play/helpers';

interface QuizPlayHeaderProps {
  quiz: any;
  questionQueue: any[];
  currentIdx: number;
  answers: Record<string, string[]>;
  timeElapsed: number;
  examMode: boolean;
  timedMode: boolean;
  questionTimer: number;
  showKeys: boolean;
  setShowKeys: (show: boolean) => void;
  onBack: () => void;
  theme: any;
  calmMotion: boolean;
}

export function QuizPlayHeader({
  quiz,
  questionQueue,
  currentIdx,
  answers,
  timeElapsed,
  examMode,
  timedMode,
  questionTimer,
  showKeys,
  setShowKeys,
  onBack,
  theme,
  calmMotion
}: QuizPlayHeaderProps) {
  const answeredCount = Object.keys(answers).length;
  const progress = questionQueue.length > 0 ? (answeredCount / questionQueue.length) * 100 : 0;

  return (
    <motion.div 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: calmMotion ? 0.3 : 0.5 }}
      className="flex items-center justify-between mb-6"
    >
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="p-2 rounded-xl transition-all hover:bg-gray-100 dark:hover:bg-gray-800"
          style={{ color: theme.text3 }}
        >
          <ChevronLeft size={20} />
        </button>
        <div>
          <h1 className="text-xl font-bold" style={{ color: theme.text }}>
            {quiz?.title}
          </h1>
          <div className="flex items-center gap-3 text-sm" style={{ color: theme.text3 }}>
            <span className="flex items-center gap-1">
              <BookOpen size={14} />
              {currentIdx + 1}/{questionQueue.length}
            </span>
            <span className="flex items-center gap-1">
              <Clock size={14} />
              {formatQuizPlayTime(timeElapsed)}
            </span>
            {examMode && (
              <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">
                Exam Mode
              </span>
            )}
            {timedMode && (
              <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300">
                <Clock size={14} />
                {questionTimer}s
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1 max-w-xs">
          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          </div>
        </div>
        <button
          onClick={() => setShowKeys(!showKeys)}
          className="p-2 rounded-xl transition-all hover:bg-gray-100 dark:hover:bg-gray-800"
          style={{ color: theme.text3 }}
          title="Keyboard shortcuts"
        >
          <Keyboard size={18} />
        </button>
      </div>
    </motion.div>
  );
}
