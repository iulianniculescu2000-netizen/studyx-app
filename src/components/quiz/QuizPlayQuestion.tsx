import { motion, AnimatePresence } from 'framer-motion';
import { Layers, Sparkles } from 'lucide-react';
import QuizImage from '../QuizImage';
import type { Question, Option } from '../../types';

interface QuizPlayQuestionProps {
  question: Question;
  currentIdx: number;
  isMultiple: boolean;
  revealed: boolean;
  shakeId: string | null;
  feedbackAnim: 'correct' | 'wrong' | null;
  calmMotion: boolean;
  theme: any;
  getOptionStyle: (optId: string) => React.CSSProperties;
  getOptionTextColor: (optId: string) => string;
  correctIds: string[];
  selectedNow: string[];
  onSelect: (optId: string) => void;
}

export function QuizPlayQuestion({
  question,
  currentIdx,
  isMultiple,
  revealed,
  shakeId,
  feedbackAnim,
  calmMotion,
  theme,
  getOptionStyle,
  getOptionTextColor,
  correctIds,
  selectedNow,
  onSelect
}: QuizPlayQuestionProps) {
  const difficultyColor = {
    easy: '#10b981',
    medium: '#f59e0b',
    hard: '#ef4444'
  };

  const difficultyLabel = {
    easy: 'U\u0219or',
    medium: 'Mediu',
    hard: 'Greu'
  };

  return (
    <div className="max-w-2xl mx-auto w-full flex-1 flex flex-col">
      <AnimatePresence mode="wait">
        <motion.div key={`${question.id}-${currentIdx}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: calmMotion ? 0.18 : 0.25 }}
          className={`flex-1 flex flex-col ${feedbackAnim === 'wrong' ? 'anim-shake' : feedbackAnim === 'correct' ? 'anim-bounce' : ''}`}
        >
          {/* Question card */}
          <div className="rounded-3xl p-6 mb-5"
            style={{ background: theme.surface, border: `1px solid ${theme.border}` }}>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: theme.accent }}>
                Întrebarea {currentIdx + 1}
              </span>
              {isMultiple && (
                <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
                  style={{ background: `${theme.accent2}18`, color: theme.accent2 }}>
                  <Layers size={10} />Multi-select
                </span>
              )}
              {question.difficulty && (
                <span className="text-xs px-2 py-0.5 rounded-full"
                  style={{ background: `${difficultyColor[question.difficulty]}18`, color: difficultyColor[question.difficulty] }}>
                  {difficultyLabel[question.difficulty]}
                </span>
              )}
            </div>
            <p className="text-xl font-semibold leading-snug" style={{ color: theme.text }}>{question.text}</p>

            {/* Question image */}
            {question.imageUrl && (
              <div className="mt-4">
                <QuizImage src={question.imageUrl} maxHeight={260} />
              </div>
            )}

            {isMultiple && !revealed && (
              <p className="text-sm mt-2" style={{ color: theme.text3 }}>
                Selecteaz\u0103 toate r\u0103spunsurile corecte, apoi apas\u0103 "Confirm\u0103"
              </p>
            )}
          </div>

          {/* Options */}
          <div className="space-y-2.5 mb-5">
            {question.options.map((opt: Option, i: number) => (
              <motion.button key={opt.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{
                  opacity: 1,
                  y: 0,
                  x: shakeId === opt.id && !calmMotion ? [0, -10, 10, -8, 8, -4, 4, 0] : 0,
                  scale: (revealed && correctIds.includes(opt.id) && !calmMotion) ? [1, 1.05, 1] : 1
                }}
                transition={{
                  duration: shakeId === opt.id ? 0.3 : revealed && correctIds.includes(opt.id) ? 0.6 : 0.25,
                  delay: i * 0.03,
                  ease: 'easeOut'
                }}
                onClick={() => onSelect(opt.id)}
                disabled={revealed && !isMultiple}
                className="w-full flex items-center gap-4 p-4 rounded-2xl text-left transition-all"
                style={getOptionStyle(opt.id)}
                whileHover={!revealed ? { scale: calmMotion ? 1.005 : 1.01 } : {}}
                whileTap={!revealed && !calmMotion ? { scale: 0.99 } : {}}
              >
                {/* Checkbox/Radio */}
                <div className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold border-2 transition-all"
                  style={{
                    borderColor: (revealed && correctIds.includes(opt.id)) ? theme.success : (selectedNow.includes(opt.id) ? (revealed ? theme.danger : theme.accent) : theme.border2),
                    background: (revealed && correctIds.includes(opt.id)) ? `${theme.success}20` : (selectedNow.includes(opt.id) ? (revealed ? `${theme.danger}20` : `${theme.accent}20`) : 'transparent'),
                    color: getOptionTextColor(opt.id),
                  }}>
                  {revealed && correctIds.includes(opt.id) 
                    ? '\u2713' 
                    : (selectedNow.includes(opt.id) 
                        ? (revealed ? '\u00D7' : (isMultiple ? '\u25CF' : String.fromCharCode(65 + i))) 
                        : String.fromCharCode(65 + i))}
                </div>
                <span className="text-sm font-medium" style={{ color: getOptionTextColor(opt.id) }}>
                  {opt.text}
                </span>
              </motion.button>
            ))}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
