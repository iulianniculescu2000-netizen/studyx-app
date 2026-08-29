import { motion } from 'framer-motion';
import { useTheme } from '../../theme/ThemeContext';

interface AIGamificationHeaderProps {
  username: string;
}

export default function AIGamificationHeader({ username }: AIGamificationHeaderProps) {
  const theme = useTheme();
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-center mb-8"
    >
      <div className="flex items-center justify-center gap-3 mb-4">
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            rotate: [0, 360],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="text-4xl"
        >
          {'🏆'}
        </motion.div>
        <h1
          className="text-3xl font-bold"
          style={{ background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', display: 'inline-block' }}
        >
          Gamification AI
        </h1>
      </div>
      <p className="max-w-2xl mx-auto" style={{ color: theme.text3 }}>
        {/* "clasamente globale" promised a leaderboard that never existed —
            StudyX is single-user, and the comparison tab is you vs. your past self. */}
        Provocări, realizări și comparație cu propriul tău progres, ca să-ți susțină studiul
      </p>
      <p className="mt-3 text-sm font-medium" style={{ color: theme.accent }}>
        Hub-ul premium de progres pentru {username}
      </p>
    </motion.div>
  );
}
