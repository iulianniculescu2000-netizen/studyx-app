import { motion } from 'framer-motion';
import { Crown, Trophy, Star, Flame, BarChart3 } from 'lucide-react';

interface LeaderboardEntry {
  id: string;
  userId: string;
  username: string;
  avatar?: string;
  points: number;
  rank: number;
  level: number;
  achievements: number;
  studyStreak: number;
  aiScore: number;
  weeklyChange: number;
  badges: string[];
}

interface AIGamificationLeaderboardProps {
  leaderboard: LeaderboardEntry[];
  currentUserId: string;
}

export default function AIGamificationLeaderboard({ leaderboard, currentUserId }: AIGamificationLeaderboardProps) {
  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1: return 'text-yellow-600 bg-yellow-50 border-yellow-300';
      case 2: return 'text-gray-600 bg-gray-50 border-gray-300';
      case 3: return 'text-orange-600 bg-orange-50 border-orange-300';
      default: return 'text-gray-700 bg-white border-gray-200';
    }
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1: return '🥇';
      case 2: return '🥈';
      case 3: return '🥉';
      default: return `#${rank}`;
    }
  };

  const getChangeIcon = (change: number) => {
    if (change > 0) return '📈';
    if (change < 0) return '📉';
    return '➡️';
  };

  const getChangeColor = (change: number) => {
    if (change > 0) return 'text-green-600';
    if (change < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Leaderboard Header */}
      <div className="bg-gradient-to-r from-yellow-500 to-orange-500 p-6 text-white">
        <div className="flex items-center justify-center gap-3">
          <Crown className="w-6 h-6" />
          <h2 className="text-2xl font-bold">
            Clasament Global
          </h2>
        </div>
        <p className="text-center mt-2 text-yellow-100">
          Competi cu studenți din întreaga lume
        </p>
      </div>

      {/* Leaderboard Table */}
      <div className="p-6">
        <div className="space-y-3">
          {leaderboard.map((entry, index) => (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`flex items-center gap-4 p-4 rounded-xl border-2 transition-all duration-200 ${
                entry.userId === currentUserId 
                  ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 shadow-lg' 
                  : getRankColor(entry.rank)
              } hover:shadow-md`}
            >
              {/* Rank */}
              <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-lg font-bold text-lg">
                {getRankIcon(entry.rank)}
              </div>

              {/* Avatar */}
              <div className="flex-shrink-0">
                {entry.avatar ? (
                  <img 
                    src={entry.avatar} 
                    alt={entry.username}
                    className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-sm"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold">
                    {entry.username.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>

              {/* User Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-bold text-gray-900 dark:text-gray-100 truncate">
                    {entry.username}
                  </h3>
                  {entry.userId === currentUserId && (
                    <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded-full font-medium">
                      TU
                    </span>
                  )}
                </div>
                
                <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                  <div className="flex items-center gap-1">
                    <Star className="w-3 h-3" />
                    <span>Nivel {entry.level}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Flame className="w-3 h-3" />
                    <span>{entry.studyStreak} zile</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Trophy className="w-3 h-3" />
                    <span>{entry.achievements}</span>
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                    <BarChart3 className="w-3 h-3" />
                    <span>AI</span>
                  </div>
                  <p className="font-bold text-lg text-gray-900 dark:text-gray-100">
                    {entry.aiScore}
                  </p>
                </div>

                <div className="text-center">
                  <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                    <Trophy className="w-3 h-3" />
                    <span>Puncte</span>
                  </div>
                  <p className="font-bold text-lg text-gray-900 dark:text-gray-100">
                    {entry.points.toLocaleString()}
                  </p>
                </div>

                <div className="text-center">
                  <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
                    <span>Săptămâna</span>
                  </div>
                  <div className={`flex items-center gap-1 text-sm font-medium ${getChangeColor(entry.weeklyChange)}`}>
                    <span>{getChangeIcon(entry.weeklyChange)}</span>
                    <span>{Math.abs(entry.weeklyChange)}</span>
                  </div>
                </div>
              </div>

              {/* Badges */}
              <div className="flex-shrink-0">
                <div className="flex gap-1">
                  {entry.badges.slice(0, 3).map((badge, idx) => (
                    <span key={idx} className="text-lg" title={badge}>
                      {badge}
                    </span>
                  ))}
                  {entry.badges.length > 3 && (
                    <span className="text-xs text-gray-500 self-center">+{entry.badges.length - 3}</span>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Load More */}
        <div className="mt-6 text-center">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="px-6 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors duration-200"
          >
            Încarcă mai mulți
          </motion.button>
        </div>
      </div>
    </div>
  );
}
