import { motion } from 'framer-motion';
import { X, Package2, Sparkles } from 'lucide-react';
import { useTheme } from '../../theme/ThemeContext';

interface UpdateModalHeaderProps {
  onClose: () => void;
  theme: any;
  calmMotion: boolean;
}

export function UpdateModalHeader({ onClose, theme, calmMotion }: UpdateModalHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl" style={{ background: `${theme.accent}15` }}>
          <Package2 size={20} style={{ color: theme.accent }} />
        </div>
        <div>
          <h2 className="text-xl font-bold" style={{ color: theme.text }}>
            Actualizare StudyX
          </h2>
          <p className="text-sm" style={{ color: theme.text3 }}>
            Verific\u0103 actualiz\u0103ri noi
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
