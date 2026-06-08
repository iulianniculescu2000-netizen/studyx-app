import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../../theme/ThemeContext';

interface SidebarTooltipProps {
  label: string;
  children: React.ReactNode;
}

export function SidebarTooltip({ label, children }: SidebarTooltipProps) {
  const [show, setShow] = useState(false);
  const theme = useTheme();

  return (
    <div className="relative" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, x: -6, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -4, scale: 0.95 }}
            transition={{ duration: 0.13 }}
            className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap z-50 pointer-events-none"
            style={{
              background: theme.isDark ? 'rgba(30,30,36,0.98)' : 'rgba(255,255,255,0.98)',
              border: `1px solid ${theme.border2}`,
              color: theme.text,
              boxShadow: '0 8px 24px rgba(0,0,0,0.22)',
            }}
          >
            {label}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
