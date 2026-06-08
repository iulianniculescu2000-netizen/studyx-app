import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Keyboard, Command, ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from 'lucide-react';
import { useTheme } from '../../theme/ThemeContext';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function KeyboardShortcutsModal({ isOpen, onClose }: KeyboardShortcutsModalProps) {
  const theme = useTheme();
  const { getAllShortcuts } = useKeyboardShortcuts();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const allShortcuts = getAllShortcuts();
  
  const categories = [
    { id: 'all', label: 'Toate' },
    { id: 'navigation', label: 'Navigare' },
    { id: 'study', label: 'Studiu' },
    { id: 'ai', label: 'AI' },
    { id: 'quiz', label: 'Quiz' },
    { id: 'ui', label: 'Interfa\u021b\u0103' }
  ];

  const filteredShortcuts = allShortcuts.filter(shortcut => {
    const matchesSearch = shortcut.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || shortcut.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const formatKeyCombo = (key: string, modifiers: string[]) => {
    const parts = [...modifiers, key.toUpperCase()];
    
    return parts.map(part => {
      switch (part.toLowerCase()) {
        case 'ctrl':
          return <span key={part} className="font-mono text-xs font-bold">Ctrl</span>;
        case 'shift':
          return <span key={part} className="font-mono text-xs">Shift</span>;
        case 'alt':
          return <span key={part} className="font-mono text-xs">Alt</span>;
        case 'meta':
          return <Command key={part} size={14} />;
        case 'arrowright':
          return <ArrowRight key={part} size={14} />;
        case 'arrowleft':
          return <ArrowLeft key={part} size={14} />;
        case 'arrowup':
          return <ArrowUp key={part} size={14} />;
        case 'arrowdown':
          return <ArrowDown key={part} size={14} />;
        case 'escape':
          return <span key={part} className="font-mono text-xs">Esc</span>;
        case 'enter':
          return <span key={part} className="font-mono text-xs">Enter</span>;
        case ' ':
          return <span key={part} className="font-mono text-xs">Space</span>;
        default:
          return <span key={part} className="font-mono text-xs">{part}</span>;
      }
    });
  };

  useEffect(() => {
    const handleShowShortcuts = () => {
      setSearchQuery('');
      setSelectedCategory('all');
    };

    window.addEventListener('studyx:show-shortcuts', handleShowShortcuts);
    return () => window.removeEventListener('studyx:show-shortcuts', handleShowShortcuts);
  }, []);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.2 }}
          className="rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden"
          style={{ background: theme.surface }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-6 border-b" style={{ borderColor: theme.border }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl" style={{ background: `${theme.accent}15` }}>
                  <Keyboard size={20} style={{ color: theme.accent }} />
                </div>
                <div>
                  <h2 className="text-xl font-bold" style={{ color: theme.text }}>
                    Scurtaturi Keyboard
                  </h2>
                  <p className="text-sm" style={{ color: theme.text3 }}>
                    Navigare rapid\u0103 \u00een StudyX
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-xl transition-all hover:bg-gray-100 dark:hover:bg-gray-800"
                style={{ color: theme.text3 }}
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3">
              <input
                type="text"
                placeholder="Caut\u0103 scurt\u0103turi..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg border text-sm"
                style={{
                  background: theme.surface,
                  borderColor: theme.border,
                  color: theme.text
                }}
              />

              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => {
                  const active = selectedCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setSelectedCategory(cat.id)}
                      className="rounded-xl border px-3 py-2 text-sm font-medium transition-all"
                      style={{
                        background: active ? `${theme.accent}15` : theme.surface,
                        borderColor: active ? theme.accent : theme.border,
                        color: active ? theme.accent : theme.text,
                      }}
                    >
                      {cat.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="p-6 overflow-y-auto max-h-[60vh]">
            <div className="space-y-4">
              {categories
                .filter(cat => selectedCategory === 'all' || cat.id === selectedCategory)
                .map(category => {
                  const categoryShortcuts = filteredShortcuts.filter(
                    s => selectedCategory === 'all' || s.category === category.id
                  );

                  if (categoryShortcuts.length === 0) return null;

                  return (
                    <div key={category.id}>
                      <h3 className="font-semibold mb-3 text-sm uppercase tracking-wider" style={{ color: theme.text3 }}>
                        {category.label}
                      </h3>
                      <div className="space-y-2">
                        {categoryShortcuts.map((shortcut, index) => (
                          <motion.div
                            key={index}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.2, delay: index * 0.05 }}
                            className="flex items-center justify-between p-3 rounded-lg border"
                            style={{ borderColor: theme.border, background: theme.surface }}
                          >
                            <span className="text-sm font-medium" style={{ color: theme.text }}>
                              {shortcut.description}
                            </span>
                            <div className="flex items-center gap-1">
                              {formatKeyCombo(shortcut.key, shortcut.modifiers).map((element, i) => (
                                <div key={i} className="p-1 rounded border" style={{ borderColor: theme.border, background: theme.surface2 }}>
                                  {element}
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  );
                })}
            </div>

            {filteredShortcuts.length === 0 && (
              <div className="text-center py-8">
                <Keyboard size={48} className="mx-auto mb-4 opacity-20" style={{ color: theme.text3 }} />
                <p className="text-sm" style={{ color: theme.text3 }}>
                  Nu s-au g\u0103sit scurt\u0103turi
                </p>
              </div>
            )}
          </div>

          <div className="p-4 border-t" style={{ borderColor: theme.border }}>
            <div className="flex items-center justify-between text-xs" style={{ color: theme.text3 }}>
              <span>Apas\u0103 ? pentru a deschide acest meniu oric\u00e2nd</span>
              <span>{filteredShortcuts.length} scurt\u0103turi g\u0103site</span>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// Floating keyboard shortcut hint
export function KeyboardShortcutHint() {
  const theme = useTheme();
  const [showHint, setShowHint] = useState(true);

  useEffect(() => {
    let hintTimer: ReturnType<typeof setTimeout> | null = null;
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === '?') {
        setShowHint(false);
        if (hintTimer) clearTimeout(hintTimer);
        hintTimer = setTimeout(() => setShowHint(true), 5000);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
      if (hintTimer) clearTimeout(hintTimer);
    };
  }, []);

  if (!showHint) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="fixed bottom-4 right-4 p-3 rounded-lg border shadow-lg z-40"
        style={{
          borderColor: theme.border,
          background: theme.surface,
          color: theme.text3
        }}
    >
      <div className="flex items-center gap-2 text-xs">
        <Keyboard size={12} />
        <span>Apasă ? pentru scurtături</span>
      </div>
    </motion.div>
  );
}
