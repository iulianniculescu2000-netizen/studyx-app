import { motion } from 'framer-motion';
import { Trophy, Star, Flame, Medal, BarChart3 } from 'lucide-react';
import { useTheme } from '../../theme/ThemeContext';

interface UserStats {
  points: number;
  level: number;
  studyStreak: number;
  achievements: number;
  aiScore: number;
  weeklyQuestions: number;
}

interface AIGamificationStatsProps {
  userStats: UserStats;
}

export default function AIGamificationStats({ userStats }: AIGamificationStatsProps) {
  const theme = useTheme();
  const items = [
    { icon: Trophy, label: 'Puncte', value: userStats.points.toLocaleString(), color: theme.accent },
    { icon: Star, label: 'Nivel', value: userStats.level, color: theme.accent2 },
    { icon: Flame, label: 'Streak', value: `${userStats.studyStreak} zile`, color: theme.warning },
    { icon: Medal, label: 'Realizări', value: userStats.achievements, color: theme.accent },
    { icon: BarChart3, label: 'Întrebări (7 zile)', value: userStats.weeklyQuestions, color: theme.success },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-panel rounded-2xl p-6 mb-6"
    >
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {items.map((item) => (
          <div key={item.label} className="text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <item.icon className="w-5 h-5" style={{ color: item.color }} />
              <span className="text-sm font-medium" style={{ color: theme.text3 }}>
                {item.label}
              </span>
            </div>
            <p className="text-2xl font-bold" style={{ color: theme.text }}>
              {item.value}
            </p>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
