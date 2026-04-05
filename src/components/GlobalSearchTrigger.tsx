import { Search } from 'lucide-react';
import { useTheme } from '../theme/ThemeContext';

export default function GlobalSearchTrigger() {
  const theme = useTheme();

  return (
    <button
      data-tutorial="global-search"
      onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }))}
      className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs transition-all hover:opacity-80"
      style={{ background: theme.surface2, border: `1px solid ${theme.border}`, color: theme.text3 }}
    >
      <Search size={13} />
      <span>Cauta</span>
      <kbd className="font-mono ml-1" style={{ opacity: 0.6 }}>Ctrl+K</kbd>
    </button>
  );
}
