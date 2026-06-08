import { motion } from 'framer-motion';

interface AIPredictiveTabsProps {
  activeTab: 'predictions' | 'gaps' | 'paths';
  setActiveTab: (tab: 'predictions' | 'gaps' | 'paths') => void;
}

export default function AIPredictiveTabs({ activeTab, setActiveTab }: AIPredictiveTabsProps) {
  const tabs = [
    { id: 'predictions', label: 'Predicții Examen', icon: '🎯' },
    { id: 'gaps', label: 'Goluri Cunoștințe', icon: '📊' },
    { id: 'paths', label: 'Căi Studiu', icon: '🛤️' }
  ] as const;

  return (
    <div className="flex gap-2 mb-6 border-b border-gray-200 dark:border-gray-700">
      {tabs.map((tab) => (
        <motion.button
          key={tab.id}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setActiveTab(tab.id)}
          className={`px-6 py-3 font-medium transition-all duration-200 border-b-2 ${
            activeTab === tab.id
              ? 'border-purple-500 text-purple-600 dark:text-purple-400'
              : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
          }`}
        >
          <span className="mr-2">{tab.icon}</span>
          {tab.label}
        </motion.button>
      ))}
    </div>
  );
}
