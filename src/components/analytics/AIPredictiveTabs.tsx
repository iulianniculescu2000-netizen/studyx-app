import { motion } from 'framer-motion';
import { useTheme } from '../../theme/ThemeContext';

interface AIPredictiveTabsProps {
  activeTab: 'predictions' | 'gaps' | 'paths';
  setActiveTab: (tab: 'predictions' | 'gaps' | 'paths') => void;
}

export default function AIPredictiveTabs({ activeTab, setActiveTab }: AIPredictiveTabsProps) {
  const theme = useTheme();
  const tabs = [
    { id: 'predictions', label: 'Predicții Examen', icon: '🎯' },
    { id: 'gaps', label: 'Goluri Cunoștințe', icon: '📊' },
    { id: 'paths', label: 'Căi Studiu', icon: '🛤️' }
  ] as const;

  return (
    <div className="flex gap-2 mb-6 border-b" style={{ borderColor: theme.border }}>
      {tabs.map((tab) => {
        const active = activeTab === tab.id;
        return (
          <motion.button
            key={tab.id}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setActiveTab(tab.id)}
            className="px-6 py-3 font-medium transition-all duration-200"
            style={{
              color: active ? theme.accent : theme.text3,
              borderBottom: `2px solid ${active ? theme.accent : 'transparent'}`,
            }}
          >
            <span className="mr-2">{tab.icon}</span>
            {tab.label}
          </motion.button>
        );
      })}
    </div>
  );
}
