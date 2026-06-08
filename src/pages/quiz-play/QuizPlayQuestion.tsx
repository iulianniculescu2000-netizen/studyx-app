import React, { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Sparkles, Zap } from 'lucide-react';
import QuizImage from '../../components/QuizImage';
import type { Question } from '../../types';
import type { HintResult } from '../../ai/types';

interface QuizPlayQuestionProps {
  question: Question;
  questionIndex: number;
  totalQuestions: number;
  selectedOptions: string[];
  revealed: boolean;
  examMode: boolean;
  aiText: string | null;
  aiLoading: boolean;
  hintLevel: number;
  hintData: HintResult | null;
  hintLoading: boolean;
  mnemonicText?: string | null;
  mnemonicLoading?: boolean;
  showSmartNudge: boolean;
  currentNote: string;
  onOptionToggle: (optionId: string) => void;
  onReveal: () => void;
  onAIExplain: () => void;
  onHint: () => void;
  onMnemonic: () => void;
  onNoteChange: (note: string) => void;
}

const QuizPlayQuestion = React.memo(function QuizPlayQuestion({
  question,
  questionIndex,
  totalQuestions,
  selectedOptions,
  revealed,
  examMode,
  aiText,
  aiLoading,
  hintLevel,
  hintData,
  hintLoading,
  mnemonicText,
  mnemonicLoading,
  showSmartNudge,
  onOptionToggle,
  onReveal,
  onAIExplain,
  onHint,
  onMnemonic,
}: QuizPlayQuestionProps) {
  const [shakeId, setShakeId] = useState<string | null>(null);
  const [feedbackAnim, setFeedbackAnim] = useState<'correct' | 'wrong' | null>(null);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isMultiple = question?.multipleCorrect ?? false;

  useEffect(() => () => {
    if (feedbackTimerRef.current) {
      clearTimeout(feedbackTimerRef.current);
    }
  }, []);

  const handleOptionClick = useCallback((optionId: string) => {
    if (revealed || examMode) return;
    
    onOptionToggle(optionId);

    if (feedbackTimerRef.current) {
      clearTimeout(feedbackTimerRef.current);
    }
    
    // Trigger shake animation for wrong answers
    const option = question.options.find(opt => opt.id === optionId);
    if (option && !option.isCorrect) {
      setShakeId(optionId);
      setFeedbackAnim('wrong');
      feedbackTimerRef.current = setTimeout(() => {
        setShakeId(null);
        setFeedbackAnim(null);
      }, 500);
    } else if (option?.isCorrect) {
      setFeedbackAnim('correct');
      feedbackTimerRef.current = setTimeout(() => setFeedbackAnim(null), 500);
    }
  }, [revealed, examMode, onOptionToggle, question.options]);

  return (
    <div className="max-w-4xl mx-auto will-change-transform">
      {/* Question Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="mb-6"
      >
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-medium text-gray-500">
            Întrebarea {questionIndex + 1} din {totalQuestions}
          </span>
          {isMultiple && (
            <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-medium">
              Răspunsuri multiple
            </span>
          )}
        </div>
        
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
          {question.text}
        </h2>
        
        {question.explanation && (
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {question.explanation}
          </p>
        )}
      </motion.div>

      {/* Question Image */}
      {question.imageUrl && (
        <motion.div
          initial={{ opacity: 0, scale: 0.99 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.25 }}
          className="mb-6 overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm"
        >
          <QuizImage
            src={question.imageUrl}
            alt={question.text}
          />
        </motion.div>
      )}

      {/* Options Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6 max-w-4xl mx-auto">
        {question.options.map((option, index) => {
          const isSelected = selectedOptions.includes(option.id);
          const isCorrect = option.isCorrect;
          const showResult = revealed || (examMode && selectedOptions.length > 0);
          
          return (
            <motion.div
              key={option.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ 
                opacity: 1, 
                y: 0,
                x: shakeId === option.id ? [0, -8, 8, -4, 4, 0] : 0,
                scale: (showResult && isCorrect && isSelected) ? [1, 1.02, 1] : 1
              }}
              transition={{ 
                delay: index * 0.05,
                duration: 0.25,
                ease: [0.23, 1, 0.32, 1]
              }}
              whileHover={revealed || examMode ? {} : { y: -2, scale: 1.01 }}
              whileTap={revealed || examMode ? {} : { scale: 0.98 }}
              onClick={() => handleOptionClick(option.id)}
              className={`group relative p-5 rounded-[22px] border-2 cursor-pointer transition-all duration-300 shadow-sm ${
                showResult
                  ? isCorrect
                    ? 'border-green-500 bg-green-50/50 dark:bg-green-900/10 shadow-green-100/50 dark:shadow-none'
                    : isSelected
                    ? 'border-red-500 bg-red-50/50 dark:bg-red-900/10 shadow-red-100/50 dark:shadow-none'
                    : 'border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-800/50 opacity-60'
                  : isSelected
                  ? 'border-blue-500 bg-blue-50/30 dark:bg-blue-900/20 shadow-md shadow-blue-100/50 dark:shadow-none'
                  : 'border-transparent bg-white dark:bg-gray-800 shadow-sm hover:border-blue-200 dark:hover:border-blue-900/50 hover:shadow-md'
              }`}
            >
              <div className="flex items-start gap-4">
                <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all duration-300 ${
                  showResult
                    ? isCorrect
                      ? 'border-green-500 bg-green-500'
                      : isSelected
                      ? 'border-red-500 bg-red-500'
                      : 'border-gray-200 bg-transparent'
                    : isSelected
                    ? 'border-blue-500 bg-blue-500 shadow-lg shadow-blue-500/40'
                    : 'border-gray-200 dark:border-gray-700 bg-transparent group-hover:border-blue-300'
                }`}>
                  {showResult && isCorrect && (
                    <span className="text-white text-xs font-black">✓</span>
                  )}
                  {showResult && !isCorrect && isSelected && (
                    <span className="text-white text-xs font-black">✕</span>
                  )}
                  {!showResult && isSelected && (
                    <motion.div 
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="w-2 h-2 bg-white rounded-full" 
                    />
                  )}
                </div>
                
                <div className="flex-1">
                  <p className={`text-[15px] leading-relaxed transition-colors duration-300 ${
                    showResult
                      ? isCorrect
                        ? 'text-green-800 dark:text-green-300 font-bold'
                        : isSelected
                        ? 'text-red-800 dark:text-red-300 font-bold'
                        : 'text-gray-500 dark:text-gray-400'
                      : isSelected
                      ? 'text-blue-800 dark:text-blue-200 font-bold'
                      : 'text-gray-700 dark:text-gray-200 font-medium'
                  }`}>
                    {option.text}
                  </p>
                </div>

                <div className="text-[10px] font-black text-gray-300 dark:text-gray-600 group-hover:text-blue-200 transition-colors">
                  {String.fromCharCode(65 + index)}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Action Buttons */}
      <div className="max-w-4xl mx-auto px-2">
        <div className="flex flex-wrap gap-4 mb-8 justify-center items-center">
        {!revealed && !examMode && (
          <>
            <motion.button
              whileHover={{ scale: 1.05, translateY: -2 }}
              whileTap={{ scale: 0.95 }}
              onClick={onReveal}
              disabled={selectedOptions.length === 0}
              className="flex items-center gap-2.5 px-7 py-3.5 bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-[18px] font-bold shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all duration-300 disabled:opacity-40 disabled:shadow-none disabled:translate-y-0"
            >
              <Zap className="w-5 h-5 fill-current" />
              Verifică Răspuns
            </motion.button>
            
            <motion.button
              whileHover={{ scale: 1.05, translateY: -2 }}
              whileTap={{ scale: 0.95 }}
              onClick={onHint}
              disabled={hintLoading || hintLevel >= 3}
              className="flex items-center gap-2.5 px-7 py-3.5 bg-gradient-to-br from-amber-400 to-amber-500 text-white rounded-[18px] font-bold shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 transition-all duration-300 disabled:opacity-40 disabled:shadow-none disabled:translate-y-0"
            >
              <Sparkles className="w-5 h-5 fill-current" />
              Indiciu {hintLevel > 0 && `(${hintLevel}/3)`}
            </motion.button>
          </>
        )}
        
        <div className="flex gap-4">
          <motion.button
            whileHover={{ scale: 1.05, translateY: -2 }}
            whileTap={{ scale: 0.95 }}
            onClick={onAIExplain}
            disabled={aiLoading}
            className="flex items-center gap-2.5 px-7 py-3.5 bg-gradient-to-br from-purple-500 to-indigo-600 text-white rounded-[18px] font-bold shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transition-all duration-300 disabled:opacity-40 disabled:shadow-none"
          >
            <MessageSquare className="w-5 h-5 fill-current" />
            {aiLoading ? 'Se analizează...' : 'Explicație AI'}
          </motion.button>

          {revealed && !examMode && (
            <motion.button
              whileHover={{ scale: 1.05, translateY: -2 }}
              whileTap={{ scale: 0.95 }}
              onClick={onMnemonic}
              disabled={mnemonicLoading}
              className="flex items-center gap-2.5 px-7 py-3.5 bg-gradient-to-br from-teal-400 to-emerald-500 text-white rounded-[18px] font-bold shadow-lg shadow-teal-500/25 hover:shadow-teal-500/40 transition-all duration-300 disabled:opacity-40 disabled:shadow-none"
            >
              <Zap className="w-5 h-5 fill-current" />
              {mnemonicLoading ? 'Se generează...' : 'Mnemonic AI'}
            </motion.button>
          )}
        </div>
        </div>
      </div>

      {/* AI Panels */}
      <AnimatePresence>
        {aiText && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-xl p-4 mb-6">
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare className="w-4 h-4 text-purple-600" />
                <span className="font-medium text-purple-700 dark:text-purple-300">
                  Explicație AI
                </span>
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                {aiText}
              </p>
            </div>
          </motion.div>
        )}

        {hintData && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-xl p-4 mb-6">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-yellow-600" />
                <span className="font-medium text-yellow-700 dark:text-yellow-300">
                  Indiciu {hintLevel}
                </span>
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                {hintLevel === 1 ? hintData.light : 
                 hintLevel === 2 ? hintData.medium : 
                 hintData.full}
              </p>
            </div>
          </motion.div>
        )}

        {mnemonicText && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700 rounded-xl p-4 mb-6">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-4 h-4 text-indigo-600" />
                <span className="font-medium text-indigo-700 dark:text-indigo-300">
                  Mnemonic sugerat
                </span>
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed italic">
                {mnemonicText}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Smart Nudge */}
      <AnimatePresence>
        {showSmartNudge && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="fixed bottom-24 right-4 bg-blue-600 text-white px-4 py-3 rounded-xl shadow-2xl z-50 border border-blue-400"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500 rounded-lg">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider opacity-80">Sugestie AI</p>
                <p className="text-sm font-medium">
                  Pare dificil? Încearcă un indiciu!
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Feedback Animation */}
      <AnimatePresence>
        {feedbackAnim && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.2 }}
            className={`fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-8xl font-black z-[100] pointer-events-none drop-shadow-2xl ${
              feedbackAnim === 'correct' ? 'text-green-500' : 'text-red-500'
            }`}
          >
            {feedbackAnim === 'correct' ? '✓' : '✗'}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

export default QuizPlayQuestion;
