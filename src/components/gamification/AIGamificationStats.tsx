import { motion } from 'framer-motion';
import { Trophy, Star, Flame, Medal, BarChart3 } from 'lucide-react';

interface UserStats {
  points: number;
  level: number;
  studyStreak: number;
  achievements: number;
  aiScore: number;
  weeklyRank: number;
}

interface AIGamificationStatsProps {
  userStats: UserStats;
}

export default function AIGamificationStats({ userStats }: AIGamificationStatsProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 rounded-2xl p-6 border border-yellow-200 dark:border-yellow-800 mb-6"
    >
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Trophy className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Puncte
            </span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {userStats.points.toLocaleString()}
          </p>
        </div>
        
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Star className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Nivel
            </span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {userStats.level}
          </p>
        </div>
        
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Flame className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Streak
            </span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {userStats.studyStreak} zile
          </p>
        </div>
        
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Medal className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Realizări
            </span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {userStats.achievements}
          </p>
        </div>
        
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <BarChart3 className="w-5 h-5 text-red-600 dark:text-red-400" />
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Rang Săptămânal
            </span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            #{userStats.weeklyRank}
          </p>
        </div>
      </div>
    </motion.div>
  );
}
