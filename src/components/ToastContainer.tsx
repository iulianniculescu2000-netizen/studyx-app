import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';
import { useToastStore } from '../store/toastStore';
import { useTheme } from '../theme/ThemeContext';
import Portal from './Portal';

export default function ToastContainer() {
  const { toasts, removeToast } = useToastStore();
  const theme = useTheme();

  const icons = {
    success: <CheckCircle2 size={18} color={theme.success} />,
    error: <AlertCircle size={18} color={theme.danger} />,
    info: <Info size={18} color={theme.accent} />,
    warning: <AlertTriangle size={18} color={theme.warning} />,
  };

  return (
    <Portal>
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none">
        <AnimatePresence mode="popLayout">
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl min-w-[280px] max-w-sm"
              style={{ 
                background: theme.isDark ? 'rgba(28,28,30,0.92)' : 'rgba(255,255,255,0.92)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: `0.5px solid ${theme.border}`,
                borderRadius: '14px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                minWidth: '280px',
                maxWidth: '380px',
              }}
            >
              <div className="shrink-0">{icons[toast.type]}</div>
              <p className="flex-1 text-sm font-bold leading-tight" style={{ color: theme.text }}>
                {toast.message}
              </p>
              <button 
                onClick={() => removeToast(toast.id)}
                className="shrink-0 p-1 rounded-lg hover:bg-white/5 transition-colors"
                style={{ color: theme.text3 }}
              >
                <X size={14} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </Portal>
  );
}
