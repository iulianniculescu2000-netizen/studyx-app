import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../theme/ThemeContext';

interface Props {
  label: string;
  children: React.ReactNode;
  delay?: number;
}

export default function PremiumTooltip({ label, children, delay = 500 }: Props) {
  const [show, setShow] = useState(false);
  const theme = useTheme();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleEnter = () => {
    timerRef.current = setTimeout(() => setShow(true), delay);
  };

  const handleLeave = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setShow(false);
  };

  return (
    <div className="relative inline-block" onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
      {children}
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, y: 5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 2, scale: 0.95 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap z-[100] pointer-events-none"
            style={{
              background: theme.isDark ? 'rgba(20,20,25,0.95)' : 'rgba(255,255,255,0.98)',
              border: `1px solid ${theme.border}`,
              color: theme.text,
              boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
              backdropFilter: 'blur(8px)'
            }}>
            {label}
            {/* Arrow */}
            <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[5px]"
              style={{ borderTopColor: theme.isDark ? 'rgba(20,20,25,0.95)' : 'rgba(255,255,255,0.98)' }} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
