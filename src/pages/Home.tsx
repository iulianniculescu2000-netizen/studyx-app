import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, Zap, Trophy, BookOpen, Upload } from 'lucide-react';
import { useQuizStore } from '../store/quizStore';
import { useUserStore } from '../store/userStore';
import { useTheme } from '../theme/ThemeContext';
import QuizCard from '../components/QuizCard';
import ImportQuizButton from '../components/ImportQuizButton';

export default function Home() {
  const { quizzes, sessions } = useQuizStore();
  const { username } = useUserStore();
  const theme = useTheme();
  const recentQuizzes = quizzes.slice(0, 3);

  const bestEver = sessions.length > 0
    ? `${Math.max(...sessions.map(s => Math.round((s.score / s.total) * 100)))}%`
    : '—';

  const stats = [
    { label: 'Grile create', value: quizzes.length, icon: <BookOpen size={18} />, color: theme.accent },
    { label: 'Sesiuni', value: sessions.length, icon: <Zap size={18} />, color: theme.accent2 },
    { label: 'Scor maxim', value: bestEver, icon: <Trophy size={18} />, color: theme.warning },
  ];

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bună dimineața' : hour < 18 ? 'Bună ziua' : 'Bună seara';

  return (
    <div className="h-full overflow-y-auto px-8 py-8">
      <div className="max-w-5xl mx-auto">

        {/* Hero */}
        <div className="text-center mb-16">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium mb-5"
            style={{ background: `${theme.accent}18`, border: `1px solid ${theme.accent}30`, color: theme.accent }}
          >
            <Zap size={13} />
            {greeting}, {username}! 👋
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="font-bold tracking-tight mb-5"
            style={{ fontSize: 'clamp(38px, 6vw, 72px)', lineHeight: 1.05, letterSpacing: '-0.03em', color: theme.text }}
          >
            Învață mai rapid
            <br />
            <span style={{ color: theme.text3 }}>cu grile inteligente.</span>
          </motion.h1>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="flex items-center justify-center gap-3 flex-wrap"
          >
            <Link to="/create"
              className="flex items-center gap-2 px-6 py-3 rounded-full font-semibold text-white text-sm hover:scale-105 active:scale-95 transition-transform"
              style={{ background: `linear-gradient(135deg, ${theme.accent} 0%, ${theme.accent2} 100%)`, boxShadow: `0 0 30px ${theme.accent}35` }}>
              Creează o grilă <ArrowRight size={15} />
            </Link>
            <Link to="/quizzes"
              className="flex items-center gap-2 px-6 py-3 rounded-full font-medium text-sm hover:scale-105 active:scale-95 transition-transform"
              style={{ background: theme.surface2, border: `1px solid ${theme.border2}`, color: theme.text2 }}>
              <BookOpen size={15} />
              Toate grilele
            </Link>
            <ImportQuizButton />
          </motion.div>
        </div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.35 }}
          className="grid grid-cols-3 gap-4 mb-14"
        >
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-2xl p-5 text-center"
              style={{ background: theme.surface, border: `1px solid ${theme.border}` }}>
              <div className="flex justify-center mb-2" style={{ color: stat.color }}>{stat.icon}</div>
              <div className="text-2xl font-bold mb-0.5" style={{ color: theme.text }}>{stat.value}</div>
              <div className="text-xs" style={{ color: theme.text3 }}>{stat.label}</div>
            </div>
          ))}
        </motion.div>

        {/* Recent quizzes */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45 }}>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xl font-semibold" style={{ color: theme.text }}>Grile recente</h2>
            <Link to="/quizzes" className="text-sm hover:underline" style={{ color: theme.accent }}>
              Vezi toate →
            </Link>
          </div>
          {recentQuizzes.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {recentQuizzes.map((quiz, i) => (
                <QuizCard key={quiz.id} quiz={quiz} index={i} />
              ))}
            </div>
          ) : (
            <div className="text-center py-16 rounded-2xl" style={{ background: theme.surface, border: `1px solid ${theme.border}` }}>
              <div className="text-4xl mb-3">📭</div>
              <p style={{ color: theme.text3 }}>Nicio grilă încă.</p>
              <Link to="/create" className="text-sm hover:underline mt-1 inline-block" style={{ color: theme.accent }}>
                Creează prima ta grilă →
              </Link>
            </div>
          )}
        </motion.div>

        {/* Import hint */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-8 p-4 rounded-2xl flex items-center gap-3"
          style={{ background: `${theme.accent}08`, border: `1px solid ${theme.accent}18` }}
        >
          <Upload size={16} style={{ color: theme.accent, flexShrink: 0 }} />
          <p className="text-sm" style={{ color: theme.text2 }}>
            Poți importa grile din fișiere <strong style={{ color: theme.text }}>.json</strong> sau
            le poți exporta pentru a le partaja cu alții. Trage fișierul direct pe butonul "Import JSON".
          </p>
        </motion.div>
      </div>
    </div>
  );
}
