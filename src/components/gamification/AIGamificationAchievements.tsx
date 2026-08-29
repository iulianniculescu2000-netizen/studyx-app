import type { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../../theme/ThemeContext';

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
  const theme = useTheme();

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'common': return theme.text3;
      case 'rare': return theme.accent;
      case 'epic': return theme.accent2;
      case 'legendary': return theme.warning;
      default: return theme.text3;
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {achievements.map((achievement, index) => {
          const rarityColor = getRarityColor(achievement.rarity);
          return (
          <motion.div
            key={achievement.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            whileHover={{ scale: 1.02 }}
            onClick={() => setSelectedAchievement(achievement)}
            className="glass-panel p-6 rounded-xl cursor-pointer transition-all duration-200"
            style={{ borderColor: `${rarityColor}55` }}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 rounded-lg" style={{ background: theme.surface2 }}>
                {achievement.icon}
              </div>
              <div className="flex flex-col items-end">
                <span className="text-xs font-semibold px-2 py-1 rounded-full" style={{ background: `${rarityColor}18`, color: rarityColor }}>
                  {achievement.rarity.toUpperCase()}
                </span>
                {achievement.aiGenerated && (
                  <span className="text-xs mt-1" style={{ color: theme.accent2 }}>
                    ✨ AI Generated
                  </span>
                )}
              </div>
            </div>

            <h3 className="font-bold text-lg mb-2" style={{ color: theme.text }}>
              {achievement.title}
            </h3>
            <p className="text-sm mb-4" style={{ color: theme.text3 }}>
              {achievement.description}
            </p>

            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium" style={{ color: theme.text3 }}>
                {achievement.points} puncte
              </span>
              <span className="text-xs px-2 py-1 rounded-full" style={{ background: theme.surface2, color: theme.text2 }}>
                {achievement.category}
              </span>
            </div>

            <div className="w-full rounded-full h-2" style={{ background: theme.surface2 }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(achievement.progress / achievement.maxProgress) * 100}%` }}
                transition={{ duration: 1, delay: index * 0.1 }}
                className="h-2 rounded-full"
                style={{ background: theme.success }}
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-xs" style={{ color: theme.text3 }}>
                Progres
              </span>
              <span className="text-xs font-medium" style={{ color: theme.text2 }}>
                {achievement.progress}/{achievement.maxProgress}
              </span>
            </div>
          </motion.div>
          );
        })}
      </div>

      <AnimatePresence>
        {selectedAchievement && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 flex items-center justify-center p-4 z-50"
            style={{ background: 'rgba(0,0,0,0.5)' }}
            onClick={() => setSelectedAchievement(null)}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-panel rounded-2xl p-8 max-w-lg w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-4 rounded-xl" style={{ background: theme.surface2 }}>
                    {selectedAchievement.icon}
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold" style={{ color: theme.text }}>
                      {selectedAchievement.title}
                    </h2>
                    <span className="text-sm font-semibold" style={{ color: getRarityColor(selectedAchievement.rarity) }}>
                      {selectedAchievement.rarity.toUpperCase()}
                    </span>
                  </div>
                </div>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setSelectedAchievement(null)}
                  style={{ color: theme.text3 }}
                >
                  ✕
                </motion.button>
              </div>

              <p className="mb-6" style={{ color: theme.text3 }}>
                {selectedAchievement.description}
              </p>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium" style={{ color: theme.text3 }}>Puncte</span>
                  <span className="font-bold text-lg" style={{ color: theme.text }}>{selectedAchievement.points}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium" style={{ color: theme.text3 }}>Categorie</span>
                  <span className="px-3 py-1 rounded-full text-sm" style={{ background: theme.surface2, color: theme.text2 }}>
                    {selectedAchievement.category}
                  </span>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium" style={{ color: theme.text3 }}>Progres</span>
                    <span className="text-sm font-medium" style={{ color: theme.text2 }}>
                      {selectedAchievement.progress}/{selectedAchievement.maxProgress}
                    </span>
                  </div>
                  <div className="w-full rounded-full h-3" style={{ background: theme.surface2 }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(selectedAchievement.progress / selectedAchievement.maxProgress) * 100}%` }}
                      className="h-3 rounded-full"
                      style={{ background: theme.success }}
                    />
                  </div>
                </div>

                {selectedAchievement.rewards && selectedAchievement.rewards.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium mb-2" style={{ color: theme.text3 }}>Recompense</h3>
                    <div className="space-y-2">
                      {selectedAchievement.rewards.map((reward, index) => (
                        <div key={index} className="flex items-center gap-2 p-2 rounded-lg" style={{ background: theme.surface2 }}>
                          <span className="text-lg">
                            {typeof reward.value === 'string' &&
                             (reward.value.includes('🏆') || reward.value.includes('🤝') ||
                              reward.value.includes('🔥') || reward.value.includes('🤖'))
                              ? reward.value.split(' ')[0] : '🎁'}
                          </span>
                          <span className="text-sm" style={{ color: theme.text2 }}>{reward.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedAchievement.unlockedAt && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium" style={{ color: theme.text3 }}>Deblocat la</span>
                    <span className="text-sm" style={{ color: theme.text2 }}>
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
