import { motion } from 'framer-motion';

interface AIGamificationTabsProps {
  activeTab: 'achievements' | 'challenges' | 'leaderboard';
  setActiveTab: (tab: 'achievements' | 'challenges' | 'leaderboard') => void;
}

export default function AIGamificationTabs({ activeTab, setActiveTab }: AIGamificationTabsProps) {
  const tabs = [
    { id: 'achievements', label: 'Realizări', icon: '🏆' },
    { id: 'challenges', label: 'Provocări', icon: '🎯' },
    { id: 'leaderboard', label: 'Clasament', icon: '👑' }
  ] as const;

  return (
    <div className="flex justify-center mb-8">
      <div className="bg-gray-100 dark:bg-gray-800 rounded-xl p-1 flex gap-1">
        {tabs.map((tab) => (
          <motion.button
            key={tab.id}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setActiveTab(tab.id)}
            className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 flex items-center gap-2 ${
              activeTab === tab.id
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
            }`}
          >
            <span className="text-lg">{tab.icon}</span>
            <span>{tab.label}</span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
