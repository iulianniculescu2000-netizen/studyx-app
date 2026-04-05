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
  index?: number;
  showDelete?: boolean;
}

/** Mini SVG score ring */
const ScoreRing = ({ score, theme }: { score: number; theme: import('../theme/themes').Theme }) => {
  const r = 13;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - score / 100);
  const color = score >= 90 ? theme.success : score >= 70 ? '#FFD60A' : score >= 50 ? '#FF9F0A' : '#FF453A';
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
};

const CATEGORY_COLOR_MAP: Record<string, string> = {
  'Dermatologie': 'pink',
  'Cardiologie': 'red',
  'Anatomie': 'purple',
  'Fiziologie': 'blue',
  'Biochimie': 'orange',
  'Farmacologie': 'teal',
  'Patologie': 'red',
  'Chirurgie': 'orange',
  'Medicină internă': 'blue',
  'Neurologie': 'purple',
  'Microbiologie': 'green',
};

const QuizCard = memo(function QuizCard({ quiz, index = 0, showDelete = false }: Props) {
  const { getBestScore, deleteQuiz, togglePin } = useQuizStore();
  const theme = useTheme();
  const navigate = useNavigate();
  const bestScore = getBestScore(quiz.id);
  const colorId = quiz.color || CATEGORY_COLOR_MAP[quiz.category] || 'blue';
  const colors = CARD_COLOR_MAP[colorId] ?? CARD_COLOR_MAP.blue;
  const multipleCount = quiz.questions.filter(q => q.multipleCorrect).length;
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -3, boxShadow: '0 16px 36px rgba(0,0,0,0.10)' }}
      whileTap={{ scale: 0.98 }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      className="relative group rounded-[32px] overflow-hidden glass-panel premium-shadow press-feedback"
      style={{
        background: hovered
          ? `linear-gradient(135deg, ${colors.from}22 0%, ${colors.to}22 100%)`
          : `linear-gradient(135deg, ${colors.from}12 0%, ${colors.to}12 100%)`,
        border: `1px solid ${hovered ? colors.badge + '55' : 'rgba(255,255,255,0.06)'}`,
        transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
      }}

    >
      <div className="absolute -top-20 -right-20 w-40 h-40 rounded-full pointer-events-none opacity-20 transition-opacity duration-500"
        style={{ background: `radial-gradient(circle, ${colors.badge}80, transparent 70%)`, filter: 'blur(30px)', opacity: hovered ? 0.4 : 0.1 }} />

      <Link to={`/quiz/${quiz.id}`} className="block p-6 flex flex-col h-full relative z-10">
        <div className="flex items-start justify-between mb-5">
          <div className="text-5xl drop-shadow-sm filter transition-transform duration-300 group-hover:scale-110 origin-bottom-left">
            {quiz.emoji}
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {multipleCount > 0 && (
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest backdrop-blur-md"
                style={{ background: `${theme.accent}15`, color: theme.accent, border: `1px solid ${theme.accent}30` }}>
                <Layers size={10} />Multi
              </div>
            )}
            {bestScore !== null && <ScoreRing score={bestScore} theme={theme} />}
          </div>
        </div>

        <h3 className="font-black text-xl leading-tight mb-2 flex items-start gap-2" style={{ color: theme.text }}>
          <span className="line-clamp-2">{quiz.title}</span>
          {quiz.pinned && <Pin size={16} fill={colors.badge} color={colors.badge} className="flex-shrink-0 mt-1 drop-shadow-sm" />}
        </h3>
        <p className="text-sm mb-6 line-clamp-2 font-medium opacity-60" style={{ color: theme.text }}>{quiz.description}</p>

        <div className="mt-auto flex items-end justify-between">
          <div>
            <div className="px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] text-white inline-block mb-2 shadow-lg transition-transform group-hover:scale-105 origin-left"
              style={{ 
                background: colors.badge,
                boxShadow: `0 4px 12px ${colors.badge}40`
              }}>
              {quiz.category}
            </div>
            <p className="text-xs font-bold opacity-60 uppercase tracking-widest" style={{ color: theme.text }}>
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
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            className="absolute top-5 right-5 flex items-center gap-1 p-1.5 rounded-2xl shadow-2xl z-20"
            style={{ background: theme.isDark ? 'rgba(20,20,25,0.82)' : 'rgba(255,255,255,0.88)', border: `1px solid ${theme.border}`, backdropFilter: 'blur(22px) saturate(145%)' }}>
            
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); togglePin(quiz.id); }}
              className="p-2 rounded-xl transition-colors hover:bg-white/10 press-feedback"
              style={{ color: quiz.pinned ? '#FFD60A' : theme.text2, transition: 'all 0.15s ease-out' }}
              title={quiz.pinned ? 'Scoate Pin' : 'Fixează (Pin)'}>
              {quiz.pinned ? <PinOff size={15} /> : <Pin size={15} />}
            </button>
            
            {showDelete && (
              <>
                <div className="w-px h-4 mx-1" style={{ background: theme.border }} />
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate(`/create?edit=${quiz.id}`); }}
                  className="p-2 rounded-xl transition-colors hover:bg-blue-500/15 press-feedback"
                  style={{ color: '#0A84FF', transition: 'all 0.15s ease-out' }}
                  title="Editează">
                  <Pencil size={15} />
                </button>
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirmDelete(true); }}
                  className="p-2 rounded-xl transition-colors hover:bg-red-500/15 press-feedback"
                  style={{ color: '#FF453A', transition: 'all 0.15s ease-out' }}
                  title="Șterge">
                  <Trash2 size={15} />
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
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate(`/play/${quiz.id}`); }}
            className="absolute bottom-6 right-6 flex items-center gap-1.5 px-5 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-2xl transition-transform hover:scale-110 active:scale-95 press-feedback"
            style={{ 
              background: colors.badge,
              color: '#FFFFFF',
              boxShadow: `0 8px 20px ${colors.badge}60`,
              transition: 'all 0.15s ease-out'
            }}>
            <Play size={13} fill="white" /> Joacă
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
            className="absolute inset-0 z-30 rounded-[32px] flex flex-col items-center justify-center gap-4 p-6"
            style={{ background: theme.isDark ? 'rgba(0,0,0,0.88)' : 'rgba(255,255,255,0.95)', backdropFilter: 'blur(16px)' }}>
            <div className="w-14 h-14 rounded-[20px] flex items-center justify-center" style={{ background: 'rgba(255,69,58,0.15)', border: '1px solid rgba(255,69,58,0.3)' }}>
              <AlertTriangle size={26} style={{ color: '#FF453A' }} />
            </div>
            <p className="text-base font-bold text-center" style={{ color: theme.text }}>Sigur vrei să ștergi această grilă?</p>
            <div className="flex gap-3 w-full max-w-[220px]">
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirmDelete(false); }}
                className="flex-1 py-3 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all hover:bg-white/10 press-feedback"
                style={{ background: theme.surface2, color: theme.text2, transition: 'all 0.15s ease-out' }}>
                Anulează
              </button>
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); deleteQuiz(quiz.id); }}
                className="flex-1 py-3 rounded-2xl text-xs font-bold uppercase tracking-wider text-white transition-all hover:opacity-90 press-feedback"
                style={{ background: '#FF453A', boxShadow: '0 8px 20px rgba(255,69,58,0.3)', transition: 'all 0.15s ease-out' }}>
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
