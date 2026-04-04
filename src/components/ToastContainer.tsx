import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';
import { useToastStore } from '../store/toastStore';
import { useTheme } from '../theme/ThemeContext';
import Portal from './Portal';

export default function ToastContainer() {
  const { toasts, removeToast } = useToastStore();
  const theme = useTheme();

  const icons = {
    success: <CheckCircle2 size={18} color="#30D158" />,
    error: <AlertCircle size={18} color="#FF453A" />,
    info: <Info size={18} color={theme.accent} />,
    warning: <AlertTriangle size={18} color="#FF9F0A" />,
  };

  return (
    <Portal>
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none">
        <AnimatePresence mode="popLayout">
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, x: 20, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.9, transition: { duration: 0.2 } }}
              className="pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl min-w-[280px] max-w-sm"
              style={{ 
                background: theme.modalBg, 
                border: `1px solid ${theme.border}`,
                backdropFilter: 'blur(20px)'
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
