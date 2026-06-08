import type { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: ReactNode;
  points: number;
  category: 'study' | 'collaboration' | 'performance' | 'milestone';
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  unlockedAt?: Date;
  progress: number;
  maxProgress: number;
  aiGenerated: boolean;
  prerequisites?: string[];
  rewards?: {
    type: 'badge' | 'title' | 'points' | 'feature';
    value: string | number;
  }[];
}

interface AIGamificationAchievementsProps {
  achievements: Achievement[];
  selectedAchievement: Achievement | null;
  setSelectedAchievement: (achievement: Achievement | null) => void;
}

export default function AIGamificationAchievements({ 
  achievements, 
  selectedAchievement, 
  setSelectedAchievement 
}: AIGamificationAchievementsProps) {
  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'common': return 'border-gray-300 bg-gray-50';
      case 'rare': return 'border-blue-300 bg-blue-50';
      case 'epic': return 'border-purple-300 bg-purple-50';
      case 'legendary': return 'border-yellow-300 bg-yellow-50';
      default: return 'border-gray-300 bg-gray-50';
    }
  };

  const getRarityTextColor = (rarity: string) => {
    switch (rarity) {
      case 'common': return 'text-gray-600';
      case 'rare': return 'text-blue-600';
      case 'epic': return 'text-purple-600';
      case 'legendary': return 'text-yellow-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {achievements.map((achievement, index) => (
          <motion.div
            key={achievement.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            whileHover={{ scale: 1.02 }}
            onClick={() => setSelectedAchievement(achievement)}
            className={`p-6 rounded-xl border-2 cursor-pointer transition-all duration-200 ${getRarityColor(
              achievement.rarity
            )} hover:shadow-lg`}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-white rounded-lg shadow-sm">
                {achievement.icon}
              </div>
              <div className="flex flex-col items-end">
                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${getRarityTextColor(
                  achievement.rarity
                )} bg-opacity-10`}>
                  {achievement.rarity.toUpperCase()}
                </span>
                {achievement.aiGenerated && (
                  <span className="text-xs text-purple-600 mt-1">
                    ✨ AI Generated
                  </span>
                )}
              </div>
            </div>
            
            <h3 className="font-bold text-lg mb-2 text-gray-900 dark:text-gray-100">
              {achievement.title}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              {achievement.description}
            </p>
            
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-500">
                {achievement.points} puncte
              </span>
              <span className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded-full">
                {achievement.category}
              </span>
            </div>
            
            <div className="w-full bg-gray-200 rounded-full h-2">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(achievement.progress / achievement.maxProgress) * 100}%` }}
                transition={{ duration: 1, delay: index * 0.1 }}
                className="bg-gradient-to-r from-green-400 to-green-600 h-2 rounded-full"
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-xs text-gray-500">
                Progres
              </span>
              <span className="text-xs font-medium text-gray-700">
                {achievement.progress}/{achievement.maxProgress}
              </span>
            </div>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {selectedAchievement && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
            onClick={() => setSelectedAchievement(null)}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-gray-800 rounded-2xl p-8 max-w-lg w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-4 bg-gradient-to-br from-yellow-100 to-orange-100 rounded-xl">
                    {selectedAchievement.icon}
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                      {selectedAchievement.title}
                    </h2>
                    <span className={`text-sm font-semibold ${getRarityTextColor(
                      selectedAchievement.rarity
                    )}`}>
                      {selectedAchievement.rarity.toUpperCase()}
                    </span>
                  </div>
                </div>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setSelectedAchievement(null)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  ✕
                </motion.button>
              </div>

              <p className="text-gray-600 dark:text-gray-400 mb-6">
                {selectedAchievement.description}
              </p>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-500">Puncte</span>
                  <span className="font-bold text-lg">{selectedAchievement.points}</span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-500">Categorie</span>
                  <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">
                    {selectedAchievement.category}
                  </span>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-gray-500">Progres</span>
                    <span className="text-sm font-medium">
                      {selectedAchievement.progress}/{selectedAchievement.maxProgress}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(selectedAchievement.progress / selectedAchievement.maxProgress) * 100}%` }}
                      className="bg-gradient-to-r from-green-400 to-green-600 h-3 rounded-full"
                    />
                  </div>
                </div>

                {selectedAchievement.rewards && selectedAchievement.rewards.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-2">Recompense</h3>
                    <div className="space-y-2">
                      {selectedAchievement.rewards.map((reward, index) => (
                        <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                          <span className="text-lg">
                            {typeof reward.value === 'string' && 
                             (reward.value.includes('🏆') || reward.value.includes('🤝') || 
                              reward.value.includes('🔥') || reward.value.includes('🤖')) 
                              ? reward.value.split(' ')[0] : '🎁'}
                          </span>
                          <span className="text-sm text-gray-700">{reward.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedAchievement.unlockedAt && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-500">Deblocat la</span>
                    <span className="text-sm text-gray-700">
                      {selectedAchievement.unlockedAt.toLocaleDateString('ro-RO')}
                    </span>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
