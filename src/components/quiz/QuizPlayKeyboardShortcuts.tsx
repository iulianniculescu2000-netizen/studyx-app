import { motion } from 'framer-motion';

interface QuizPlayKeyboardShortcutsProps {
  show: boolean;
  theme: any;
  calmMotion: boolean;
}

export function QuizPlayKeyboardShortcuts({ show, theme, calmMotion }: QuizPlayKeyboardShortcutsProps) {
  if (!show) return null;

  return (
    <motion.div 
      initial={{ opacity: 0, height: 0 }} 
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="mt-3 p-3 rounded-xl text-xs flex flex-wrap gap-3"
      style={{ background: theme.surface, border: `1px solid ${theme.border}`, color: theme.text3 }}
    >
      {['1-4 / A-D: selecteaz\u0103 op\u021biune', 'Enter / Space: confirmare / urm\u0103tor', 'H: indiciu AI'].map((hint) => (
        <span key={hint} className="font-mono">{hint}</span>
      ))}
    </motion.div>
  );
}
