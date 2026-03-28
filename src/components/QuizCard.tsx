import { useState, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { Trash2, Layers, AlertTriangle, X, Pencil, Pin, Play } from 'lucide-react';
import type { Quiz } from '../types';
import { useQuizStore } from '../store/quizStore';
import { useTheme } from '../theme/ThemeContext';
import { CARD_COLOR_MAP } from '../theme/colorMaps';

interface Props {
  quiz: Quiz;
  index: number;
  showDelete?: boolean;
}

/** Mini SVG score ring */
function ScoreRing({ score }: { score: number }) {
  const r = 13;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - score / 100);
  const color = score >= 90 ? '#30D158' : score >= 70 ? '#FFD60A' : score >= 50 ? '#FF9F0A' : '#FF453A';
  return (
    <div className="relative w-9 h-9 flex-shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 32 32">
        <circle cx="16" cy="16" r={r} fill="none" stroke={`${color}28`} strokeWidth="3" />
        <circle cx="16" cy="16" r={r} fill="none" stroke={color} strokeWidth="3"
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="font-bold leading-none" style={{ fontSize: 8, color }}>{score}%</span>
      </div>
    </div>
  );
}

const QuizCard = memo(function QuizCard({ quiz, index, showDelete = false }: Props) {
  const { getBestScore, deleteQuiz, togglePin } = useQuizStore();
  const theme = useTheme();
  const navigate = useNavigate();
  const bestScore = getBestScore(quiz.id);
  const colors = CARD_COLOR_MAP[quiz.color] ?? CARD_COLOR_MAP.blue;
  const multipleCount = quiz.questions.filter(q => q.multipleCorrect).length;
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: index * 0.07, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -3, transition: { duration: 0.18 } }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      className="relative group rounded-2xl overflow-hidden"
      style={{
        background: `linear-gradient(135deg, ${colors.from} 0%, ${colors.to} 100%)`,
        border: `1px solid ${colors.border}`,
        backdropFilter: 'blur(20px)',
        boxShadow: hovered
          ? `0 12px 32px rgba(0,0,0,0.22), 0 0 0 1px ${colors.border}`
          : '0 2px 8px rgba(0,0,0,0.12)',
        transition: 'box-shadow 0.2s ease',
      }}
    >
      <Link to={`/quiz/${quiz.id}`} className="block p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="text-3xl">{quiz.emoji}</div>
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            {bestScore !== null && <ScoreRing score={bestScore} />}
            {multipleCount > 0 && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)' }}>
                <Layers size={9} />Multi
              </div>
            )}
            <div className="px-2 py-0.5 rounded-full text-xs font-medium text-white"
              style={{ background: colors.badge }}>
              {quiz.category}
            </div>
          </div>
        </div>

        <h3 className="font-semibold text-lg leading-tight mb-1" style={{ color: theme.text }}>{quiz.title}</h3>
        <p className="text-sm mb-4 line-clamp-2" style={{ color: theme.text2 }}>{quiz.description}</p>

        <div className="flex items-center justify-between">
          <span className="text-sm" style={{ color: theme.text3 }}>
            {quiz.questions.length} {quiz.questions.length === 1 ? 'întrebare' : 'întrebări'}
          </span>
          <motion.div
            animate={{ gap: hovered ? 6 : 4 }}
            className="flex items-center text-sm font-medium"
            style={{ color: colors.badge }}>
            <span>Deschide</span>
          </motion.div>
        </div>
      </Link>

      {/* Quick Play button — appears on hover */}
      <AnimatePresence>
        {hovered && !confirmDelete && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.15 }}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate(`/play/${quiz.id}`); }}
            className="absolute bottom-4 right-4 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white"
            style={{
              background: colors.badge,
              boxShadow: `0 4px 12px rgba(0,0,0,0.3)`,
            }}>
            <Play size={11} fill="white" />Joacă
          </motion.button>
        )}
      </AnimatePresence>

      {/* Pin button */}
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); togglePin(quiz.id); }}
        className={`absolute top-3 left-3 p-1.5 rounded-lg transition-all ${quiz.pinned ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
        style={{
          background: quiz.pinned ? 'rgba(255,214,10,0.22)' : 'rgba(255,255,255,0.1)',
          color: quiz.pinned ? '#FFD60A' : 'rgba(255,255,255,0.55)',
        }}>
        <Pin size={12} fill={quiz.pinned ? '#FFD60A' : 'none'} />
      </button>

      {/* Edit + Delete buttons */}
      {showDelete && !confirmDelete && (
        <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-all">
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate(`/create?edit=${quiz.id}`); }}
            className="p-1.5 rounded-lg"
            style={{ background: 'rgba(10,132,255,0.15)', color: '#0A84FF' }}>
            <Pencil size={13} />
          </button>
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirmDelete(true); }}
            className="p-1.5 rounded-lg"
            style={{ background: 'rgba(255,69,58,0.15)', color: '#FF453A' }}>
            <Trash2 size={13} />
          </button>
        </div>
      )}

      {/* Inline delete confirm */}
      <AnimatePresence>
        {confirmDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(e) => e.preventDefault()}
            className="absolute inset-0 rounded-2xl flex flex-col items-center justify-center gap-3 p-4"
            style={{ background: theme.isDark ? 'rgba(0,0,0,0.88)' : 'rgba(255,255,255,0.95)', backdropFilter: 'blur(8px)' }}>
            <AlertTriangle size={20} style={{ color: '#FF453A' }} />
            <p className="text-sm font-medium text-center" style={{ color: theme.text }}>Ștergi grila?</p>
            <div className="flex gap-2">
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirmDelete(false); }}
                className="px-3 py-1.5 rounded-xl text-xs font-medium"
                style={{ background: theme.surface2, color: theme.text2 }}>
                <X size={11} className="inline mr-1" />Anulează
              </button>
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); deleteQuiz(quiz.id); }}
                className="px-3 py-1.5 rounded-xl text-xs font-medium text-white"
                style={{ background: '#FF453A' }}>
                <Trash2 size={11} className="inline mr-1" />Șterge
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});

export default QuizCard;
