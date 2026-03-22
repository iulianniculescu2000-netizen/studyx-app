import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, Info, AlertTriangle } from 'lucide-react';
import { useToastStore } from '../store/toastStore';
import { useTheme } from '../theme/ThemeContext';

const ICONS = { success: Check, error: X, warning: AlertTriangle, info: Info };

export default function ToastContainer() {
  const { toasts, remove } = useToastStore();
  const theme = useTheme();
  // Use theme colors so toasts match the active theme
  const COLORS = {
    success: theme.success,
    error: theme.danger,
    warning: theme.warning,
    info: theme.accent,
  };

  return (
    <div className="fixed bottom-6 right-6 z-[200] flex flex-col-reverse gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map((t) => {
          const Icon = ICONS[t.type];
          const color = COLORS[t.type];
          return (
            <motion.div key={t.id}
              initial={{ opacity: 0, y: 20, scale: 0.9, x: 40 }}
              animate={{ opacity: 1, y: 0, scale: 1, x: 0 }}
              exit={{ opacity: 0, y: 8, scale: 0.95, x: 40 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              whileHover={{ scale: 1.02, y: -2 }}
              className="flex flex-col pointer-events-auto min-w-[220px] max-w-[340px] overflow-hidden rounded-2xl"
              style={{
                background: theme.modalBg,
                border: `1px solid ${color}35`,
                backdropFilter: 'blur(24px)',
                boxShadow: `0 8px 32px rgba(0,0,0,0.22), 0 0 0 1px ${color}12`,
              }}>
              {/* Content row */}
              <div className="flex items-center gap-3 px-4 py-3">
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: 0.1, type: 'spring', stiffness: 300, damping: 20 }}
                  className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `${color}18`, color }}>
                  <Icon size={14} strokeWidth={2.5} />
                </motion.div>
                <p className="text-sm font-medium flex-1 leading-snug" style={{ color: theme.text }}>
                  {t.message}
                </p>
                <motion.button
                  onClick={() => remove(t.id)}
                  whileHover={{ rotate: 90, scale: 1.15 }}
                  whileTap={{ scale: 0.85 }}
                  transition={{ duration: 0.18 }}
                  className="flex-shrink-0 p-0.5 rounded-lg"
                  style={{ color: theme.text3 }}>
                  <X size={12} />
                </motion.button>
              </div>

              {/* Progress bar */}
              <motion.div
                initial={{ scaleX: 1 }}
                animate={{ scaleX: 0 }}
                transition={{ duration: t.duration / 1000, ease: 'linear' }}
                style={{
                  height: 2,
                  background: `linear-gradient(90deg, ${color}, ${color}88)`,
                  transformOrigin: 'left',
                }}
              />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
