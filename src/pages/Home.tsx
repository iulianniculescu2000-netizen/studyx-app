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
    <div className="h-full overflow-y-auto px-4 sm:px-8 py-6 sm:py-8">
      <div className="max-w-5xl mx-auto">

        {/* Hero */}
        <div className="text-center mb-20 mt-8 sm:mt-12">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-full text-[11px] font-black uppercase tracking-[0.15em] mb-8 shadow-lg"
            style={{ background: `${theme.accent}12`, border: `1px solid ${theme.accent}30`, color: theme.accent }}
          >
            <Zap size={13} className="animate-pulse" />
            {greeting}, {username}! 👋
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="font-black tracking-tight mb-8"
            style={{ fontSize: 'clamp(42px, 8vw, 84px)', lineHeight: 0.95, letterSpacing: '-0.04em', color: theme.text }}
          >
            Învață mai <span style={{
              background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>rapid.</span>
            <br />
            <span style={{ color: theme.text3, opacity: 0.4 }}>Grile inteligente.</span>
          </motion.h1>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="flex items-center justify-center gap-4 flex-wrap"
          >
            <Link to="/create"
              className="flex items-center gap-3 px-8 py-4 rounded-2xl font-black text-white text-sm shadow-2xl transition-all hover:scale-[1.05] active:scale-[0.96]"
              style={{ background: `linear-gradient(135deg, ${theme.accent} 0%, ${theme.accent2} 100%)`, boxShadow: `0 10px 40px ${theme.accent}40` }}>
              Creează Grilă <ArrowRight size={18} />
            </Link>
            <Link to="/quizzes"
              className="flex items-center gap-3 px-8 py-4 rounded-2xl font-bold text-sm shadow-lg transition-all hover:scale-[1.05] active:scale-[0.96]"
              style={{ background: theme.surface, border: `1px solid ${theme.border}`, color: theme.text2 }}>
              <BookOpen size={18} />
              Colecție
            </Link>
            <ImportQuizButton />
          </motion.div>
        </div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.4 }}
          className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-16"
        >
          {stats.map((stat, i) => (
            <motion.div key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 + i * 0.1 }}
              whileHover={{ y: -3, boxShadow: `0 12px 32px ${stat.color}15` }}
              className="rounded-3xl p-6 text-center relative overflow-hidden group transition-all"
              style={{ background: theme.surface, border: `1px solid ${theme.border}` }}>
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                style={{ background: `radial-gradient(circle at center, ${stat.color}08, transparent 70%)` }} />
              <div className="flex justify-center mb-3 transition-transform group-hover:scale-110" style={{ color: stat.color }}>{stat.icon}</div>
              <div className="text-3xl font-black mb-1 tracking-tighter" style={{ color: theme.text }}>{stat.value}</div>
              <div className="text-[10px] font-black uppercase tracking-[0.15em] opacity-40" style={{ color: theme.text }}>{stat.label}</div>
            </motion.div>
          ))}
        </motion.div>

        {/* Recent quizzes */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>
          <div className="flex items-end justify-between mb-6 px-1">
            <div>
              <h2 className="text-xl font-black tracking-tight" style={{ color: theme.text }}>Recent Accesate</h2>
              <p className="text-[10px] font-bold uppercase tracking-wider opacity-50" style={{ color: theme.text }}>Ultimele tale sesiuni de studiu</p>
            </div>
            <Link to="/quizzes" className="text-xs font-black uppercase tracking-widest hover:opacity-70 transition-opacity" style={{ color: theme.accent }}>
              Vezi Tot →
            </Link>
          </div>
          {recentQuizzes.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {recentQuizzes.map((quiz, i) => (
                <QuizCard key={quiz.id} quiz={quiz} index={i} />
              ))}
            </div>
          ) : (
            <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}
              className="text-center py-20 rounded-[32px]" 
              style={{ background: theme.surface, border: `1px solid ${theme.border}` }}>
              <div className="text-5xl mb-4">📭</div>
              <p className="font-bold mb-2" style={{ color: theme.text3 }}>Nicio grilă creată încă.</p>
              <Link to="/create" className="text-xs font-black uppercase tracking-widest hover:underline" style={{ color: theme.accent }}>
                Creează Prima Grilă →
              </Link>
            </motion.div>
          )}
        </motion.div>

        {/* Import hint */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-12 p-6 rounded-[28px] flex items-start gap-4"
          style={{ background: `${theme.accent}08`, border: `1px solid ${theme.accent}15` }}
        >
          <div className="p-2 rounded-xl" style={{ background: `${theme.accent}15`, color: theme.accent }}>
            <Upload size={18} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium leading-relaxed" style={{ color: theme.text2 }}>
              Poți importa grile din fișiere <strong style={{ color: theme.text }}>.json</strong> sau
              le poți exporta pentru a le partaja. Trage fișierul direct pe butonul de import.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

