import { motion } from 'framer-motion';
import { Download, BookOpen, FolderPlus, ChevronRight } from 'lucide-react';
import { useTheme } from '../../theme/ThemeContext';
import { useAdaptiveMotion } from '../../hooks/useAdaptiveMotion';
import type { ContentUpdate } from '../../store/updateStore';

interface ContentPackCardProps {
  pack: ContentUpdate;
  installed: boolean;
  installing: boolean;
  onInstall: () => void;
  theme: any;
}

export function ContentPackCard({ 
  pack, 
  installed, 
  installing, 
  onInstall, 
  theme 
}: ContentPackCardProps) {
  const { calmMotion } = useAdaptiveMotion();
  
  const accent = {
    blue: '#0A84FF',
    purple: '#5E5CE6',
    green: '#30D158',
    orange: '#FF9F0A',
    pink: '#FF375F',
    red: '#FF453A',
    teal: '#5AC8FA',
  }[pack.color] ?? theme.accent;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: calmMotion ? 0.3 : 0.5 }}
      className="flex flex-col items-start gap-4 sm:flex-row sm:items-center"
      style={{
        background: installed ? `${accent}0E` : theme.surface2,
        border: `1px solid ${installed ? `${accent}28` : theme.border}`,
        borderRadius: 18,
        padding: '14px 16px',
      }}
    >
      <div className="flex items-center gap-3">
        <div 
          className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
          style={{ background: `${accent}15`, color: accent }}
        >
          {pack.emoji}
        </div>
        <div>
          <h3 className="font-semibold" style={{ color: theme.text }}>
            {pack.subject}
          </h3>
          <p className="text-sm" style={{ color: theme.text3 }}>
            {pack.quizCount} quiz-uri
          </p>
        </div>
      </div>
      
      <div className="flex items-center gap-2 ml-auto">
        {installed ? (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium" style={{ background: `${accent}15`, color: accent }}>
            <BookOpen size={14} />
            Instalat
          </div>
        ) : (
          <button
            onClick={onInstall}
            disabled={installing}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
            style={{
              background: installing ? theme.border : accent,
              color: installing ? theme.text3 : 'white'
            }}
          >
            {installing ? (
              <>
                <motion.div 
                  className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                />
                Instalare...
              </>
            ) : (
              <>
                <Download size={14} />
                Instaleaz\u0103
              </>
            )}
          </button>
        )}
      </div>
    </motion.div>
  );
}
