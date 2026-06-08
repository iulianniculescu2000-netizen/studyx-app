import { motion } from 'framer-motion';
import { Trophy, Flame, Target, Clock, BookOpen, TrendingUp } from 'lucide-react';
import { useTheme } from '../../theme/ThemeContext';
import { useAdaptiveMotion } from '../../hooks/useAdaptiveMotion';

interface StatsOverviewProps {
  accuracy: number;
  studyHours: string;
  streak: { currentStreak: number; longestStreak: number };
  totalQuizzes: number;
  totalQuestions: number;
  theme: any;
  calmMotion: boolean;
}

export function StatsOverview({
  accuracy,
  studyHours,
  streak,
  totalQuizzes,
  totalQuestions,
  theme,
  calmMotion
}: StatsOverviewProps) {
  const stats = [
    {
      icon: Trophy,
      label: 'Acurate\u021bie',
      value: `${Math.round(accuracy)}%`,
      color: theme.success,
      bgColor: `${theme.success}15`
    },
    {
      icon: Clock,
      label: 'Timp studiu',
      value: `${studyHours}h`,
      color: theme.accent,
      bgColor: `${theme.accent}15`
    },
    {
      icon: Flame,
      label: 'Streak curent',
      value: `${streak.currentStreak} ${streak.currentStreak === 1 ? 'zi' : 'zile'}`,
      color: theme.warning,
      bgColor: `${theme.warning}15`
    },
    {
      icon: Target,
      label: 'Streak maxim',
      value: `${streak.longestStreak} ${streak.longestStreak === 1 ? 'zi' : 'zile'}`,
      color: theme.info,
      bgColor: `${theme.info}15`
    },
    {
      icon: BookOpen,
      label: 'Quiz-uri',
      value: totalQuizzes.toString(),
      color: theme.text3,
      bgColor: `${theme.text3}15`
    },
    {
      icon: TrendingUp,
      label: '\u00centreb\u0103ri',
      value: totalQuestions.toString(),
      color: theme.text3,
      bgColor: `${theme.text3}15`
    }
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: calmMotion ? 0.3 : 0.5 }}
      className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6"
    >
      {stats.map((stat, index) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, delay: index * 0.1 }}
          className="p-4 rounded-2xl text-center"
          style={{ background: stat.bgColor }}
        >
          <div className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2">
            <stat.icon size={20} style={{ color: stat.color }} />
          </div>
          <div className="text-2xl font-bold mb-1" style={{ color: stat.color }}>
            {stat.value}
          </div>
          <div className="text-xs font-medium" style={{ color: theme.text3 }}>
            {stat.label}
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}
