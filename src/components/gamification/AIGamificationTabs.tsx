import { motion } from 'framer-motion';
import { useTheme } from '../../theme/ThemeContext';

interface AIGamificationTabsProps {
  activeTab: 'achievements' | 'challenges' | 'leaderboard';
  setActiveTab: (tab: 'achievements' | 'challenges' | 'leaderboard') => void;
}

export default function AIGamificationTabs({ activeTab, setActiveTab }: AIGamificationTabsProps) {
  const theme = useTheme();
  const tabs = [
    { id: 'achievements', label: 'Realizări', icon: '🏆' },
    { id: 'challenges', label: 'Provocări', icon: '🎯' },
    { id: 'leaderboard', label: 'Tu vs. Tine', icon: '👑' }
  ] as const;

  return (
    <div className="flex justify-center mb-8">
      <div className="rounded-xl p-1 flex gap-1" style={{ background: theme.surface2 }}>
        {tabs.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <motion.button
              key={tab.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setActiveTab(tab.id)}
              className="px-6 py-3 rounded-lg font-medium transition-all duration-200 flex items-center gap-2"
              style={active ? { background: theme.surface, color: theme.text } : { color: theme.text3 }}
            >
              <span className="text-lg">{tab.icon}</span>
              <span>{tab.label}</span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
