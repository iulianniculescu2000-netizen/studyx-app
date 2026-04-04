import { useState, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { Trash2, Layers, AlertTriangle, Pencil, Pin, Play, PinOff } from 'lucide-react';
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
        <span className="font-black tracking-tighter" style={{ fontSize: 9, color }}>{score}%</span>
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
      transition={{ duration: 0.45, delay: index * 0.05, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      className="relative group rounded-[24px] overflow-hidden"
      style={{
        background: `linear-gradient(135deg, ${colors.from} 0%, ${colors.to} 100%)`,
        border: `1px solid ${colors.border}`,
        backdropFilter: 'blur(20px)',
        boxShadow: hovered
          ? `0 16px 40px rgba(0,0,0,0.15), 0 0 0 1px ${colors.border}`
          : '0 4px 12px rgba(0,0,0,0.08)',
        transition: 'box-shadow 0.25s ease',
      }}
    >
      <Link to={`/quiz/${quiz.id}`} className="block p-5 flex flex-col h-full">
        <div className="flex items-start justify-between mb-4">
          <div className="text-4xl drop-shadow-md">{quiz.emoji}</div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {multipleCount > 0 && (
              <div className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider"
                style={{ background: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.9)' }}>
                <Layers size={10} />Multi
              </div>
            )}
            {bestScore !== null && <ScoreRing score={bestScore} />}
          </div>
        </div>

        <h3 className="font-black text-lg leading-tight mb-1.5 flex items-start gap-2" style={{ color: theme.text }}>
          <span className="line-clamp-2">{quiz.title}</span>
          {quiz.pinned && <Pin size={14} fill={colors.badge} color={colors.badge} className="flex-shrink-0 mt-1" />}
        </h3>
        <p className="text-sm mb-5 line-clamp-2 font-medium opacity-70" style={{ color: theme.text }}>{quiz.description}</p>

        <div className="mt-auto flex items-end justify-between">
          <div>
            <div className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider text-white inline-block mb-1.5 shadow-sm"
              style={{ background: colors.badge }}>
              {quiz.category}
            </div>
            <p className="text-xs font-bold opacity-50" style={{ color: theme.text }}>
              {quiz.questions.length} {quiz.questions.length === 1 ? 'întrebare' : 'întrebări'}
            </p>
          </div>
        </div>
      </Link>

      {/* Floating Action Bar (Edit / Delete / Pin) */}
      <AnimatePresence>
        {hovered && !confirmDelete && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute top-4 right-4 flex items-center gap-1 p-1.5 rounded-[14px] shadow-xl z-20"
            style={{ background: theme.surface2, border: `1px solid ${theme.border}`, backdropFilter: 'blur(20px)' }}>
            
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); togglePin(quiz.id); }}
              className="p-1.5 rounded-lg transition-all hover:bg-white/10"
              style={{ color: quiz.pinned ? '#FFD60A' : theme.text2 }}
              title={quiz.pinned ? 'Scoate Pin' : 'Fixează (Pin)'}>
              {quiz.pinned ? <PinOff size={14} /> : <Pin size={14} />}
            </button>
            
            {showDelete && (
              <>
                <div className="w-px h-4 mx-0.5" style={{ background: theme.border }} />
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate(`/create?edit=${quiz.id}`); }}
                  className="p-1.5 rounded-lg transition-all hover:bg-blue-500/15"
                  style={{ color: '#0A84FF' }}
                  title="Editează">
                  <Pencil size={14} />
                </button>
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirmDelete(true); }}
                  className="p-1.5 rounded-lg transition-all hover:bg-red-500/15"
                  style={{ color: '#FF453A' }}
                  title="Șterge">
                  <Trash2 size={14} />
                </button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quick Play button — appears on hover */}
      <AnimatePresence>
        {hovered && !confirmDelete && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8, x: 10 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.8, x: 10 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate(`/play/${quiz.id}`); }}
            className="absolute bottom-5 right-5 flex items-center gap-1.5 px-4 py-2 rounded-[14px] text-xs font-black uppercase tracking-wider text-white shadow-2xl transition-transform hover:scale-105 active:scale-95"
            style={{ background: colors.badge }}>
            <Play size={12} fill="white" />Joacă
          </motion.button>
        )}
      </AnimatePresence>

      {/* Inline delete confirm */}
      <AnimatePresence>
        {confirmDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(e) => e.preventDefault()}
            className="absolute inset-0 z-30 rounded-[24px] flex flex-col items-center justify-center gap-4 p-5"
            style={{ background: theme.isDark ? 'rgba(0,0,0,0.88)' : 'rgba(255,255,255,0.95)', backdropFilter: 'blur(12px)' }}>
            <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,69,58,0.15)' }}>
              <AlertTriangle size={24} style={{ color: '#FF453A' }} />
            </div>
            <p className="text-sm font-bold text-center" style={{ color: theme.text }}>Sigur vrei să ștergi această grilă?</p>
            <div className="flex gap-3 w-full max-w-[200px]">
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirmDelete(false); }}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-all hover:bg-white/10"
                style={{ background: theme.surface2, color: theme.text2 }}>
                Anulează
              </button>
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); deleteQuiz(quiz.id); }}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white transition-all hover:opacity-90"
                style={{ background: '#FF453A', boxShadow: '0 4px 12px rgba(255,69,58,0.3)' }}>
                Șterge
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});

export default QuizCard;

