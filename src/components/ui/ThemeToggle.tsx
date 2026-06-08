import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Moon, Sun, Monitor } from 'lucide-react';
import { useTheme } from '../../theme/ThemeContext';
import { useUserStore } from '../../store/userStore';

export function ThemeToggle() {
  const theme = useTheme();
  const setTheme = useUserStore((state) => state.setTheme);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="w-10 h-10 rounded-lg border border-gray-200 dark:border-gray-700"></div>
    );
  }

  const themes = [
    { id: 'pearl', icon: Sun, label: 'Light' },
    { id: 'obsidian', icon: Moon, label: 'Dark' },
    { id: 'auto', icon: Monitor, label: 'Auto' }
  ];

  const currentIndex = themes.findIndex(t => t.id === theme.id);
  const nextTheme = themes[(currentIndex + 1) % themes.length];

  const handleToggle = () => {
    setTheme(nextTheme.id as 'pearl' | 'obsidian' | 'auto');
  };

  return (
    <motion.button
      onClick={handleToggle}
      className="p-2 rounded-lg border transition-all hover:scale-105 active:scale-95"
      style={{
        borderColor: theme.border,
        background: theme.surface,
        color: theme.text
      }}
      whileHover={{ boxShadow: `0 4px 12px ${theme.accent}20` }}
      title={`Current: ${theme.id} - Click for ${nextTheme.label}`}
    >
      <motion.div
        key={theme.id}
        initial={{ rotate: -180, opacity: 0 }}
        animate={{ rotate: 0, opacity: 1 }}
        exit={{ rotate: 180, opacity: 0 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
      >
        <nextTheme.icon size={20} />
      </motion.div>
    </motion.button>
  );
}

// Compact theme toggle for mobile/header
export function CompactThemeToggle() {
  const theme = useTheme();
  const setTheme = useUserStore((state) => state.setTheme);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const handleToggle = () => {
    setTheme(theme.id === 'obsidian' ? 'pearl' : 'obsidian');
  };

  return (
    <motion.button
      onClick={handleToggle}
      className="p-2 rounded-lg transition-all"
      style={{
        color: theme.text3
      }}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      title={`Toggle theme (current: ${theme.id})`}
    >
      <motion.div
        key={theme.id}
        initial={{ rotate: -180 }}
        animate={{ rotate: 0 }}
        exit={{ rotate: 180 }}
        transition={{ duration: 0.3 }}
      >
        {theme.id === 'obsidian' ? <Sun size={18} /> : <Moon size={18} />}
      </motion.div>
    </motion.button>
  );
}

// Theme selector dropdown
export function ThemeSelector() {
  const theme = useTheme();
  const setTheme = useUserStore((state) => state.setTheme);
  const [isOpen, setIsOpen] = useState(false);

  const themes = [
    { id: 'pearl', icon: Sun, label: 'Light Mode', description: 'Bright and clean interface' },
    { id: 'obsidian', icon: Moon, label: 'Dark Mode', description: 'Easy on the eyes' },
    { id: 'auto', icon: Monitor, label: 'Auto Mode', description: 'Follows system preference' }
  ];

  const handleThemeChange = (themeId: 'pearl' | 'obsidian' | 'auto') => {
    setTheme(themeId);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg border transition-all"
        style={{
          borderColor: theme.border,
          background: theme.surface,
          color: theme.text
        }}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <motion.div
          key={theme.id}
          initial={{ rotate: -180 }}
          animate={{ rotate: 0 }}
          transition={{ duration: 0.3 }}
        >
          {(() => {
            const currentTheme = themes.find(t => t.id === theme.id);
            return currentTheme ? <currentTheme.icon size={16} /> : null;
          })()}
        </motion.div>
        <span className="text-sm font-medium">
          {themes.find(t => t.id === theme.id)?.label}
        </span>
      </motion.button>

      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: -10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.95 }}
          className="absolute top-full mt-2 w-64 rounded-lg border shadow-xl z-50"
          style={{
            borderColor: theme.border,
            background: theme.surface
          }}
        >
          {themes.map((themeOption) => (
            <motion.button
              key={themeOption.id}
              onClick={() => handleThemeChange(themeOption.id as 'pearl' | 'obsidian' | 'auto')}
              className="w-full p-3 flex items-center gap-3 transition-all hover:opacity-80"
              style={{
                background: theme.id === themeOption.id ? `${theme.accent}15` : 'transparent',
                borderLeft: theme.id === themeOption.id ? `3px solid ${theme.accent}` : '3px solid transparent'
              }}
              whileHover={{ x: 2 }}
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${theme.accent}15`, color: theme.accent }}>
                <themeOption.icon size={16} />
              </div>
              <div className="text-left">
                <div className="font-medium text-sm" style={{ color: theme.text }}>
                  {themeOption.label}
                </div>
                <div className="text-xs" style={{ color: theme.text3 }}>
                  {themeOption.description}
                </div>
              </div>
              {theme.id === themeOption.id && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="w-2 h-2 rounded-full ml-auto"
                  style={{ background: theme.accent }}
                />
              )}
            </motion.button>
          ))}
        </motion.div>
      )}
    </div>
  );
}
