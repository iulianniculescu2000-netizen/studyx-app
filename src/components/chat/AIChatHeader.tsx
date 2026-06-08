import { motion } from 'framer-motion';
import { X, Bot, Sparkles, Target } from 'lucide-react';
import { useTheme } from '../../theme/ThemeContext';

interface AIChatHeaderProps {
  onClose: () => void;
  theme: any;
  calmMotion: boolean;
}

export function AIChatHeader({ onClose, theme, calmMotion }: AIChatHeaderProps) {
  return (
    <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: theme.border }}>
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl" style={{ background: `${theme.accent}15` }}>
          <Bot size={20} style={{ color: theme.accent }} />
        </div>
        <div>
          <h3 className="text-lg font-semibold" style={{ color: theme.text }}>
            AI Study Assistant
          </h3>
          <p className="text-sm" style={{ color: theme.text3 }}>
            Ajutor inteligent pentru studiu
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
  );
}
