import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';
import { useToastStore, type ToastType } from '../store/toastStore';
import { useTheme } from '../theme/ThemeContext';
import { useAdaptiveMotion } from '../hooks/useAdaptiveMotion';
import Portal from './Portal';

const TOAST_LABELS: Record<ToastType, string> = {
  success: 'Succes',
  error: 'Eroare',
  warning: 'Atenție',
  info: 'StudyX',
};

export default function ToastContainer() {
  const { toasts, removeToast } = useToastStore();
  const theme = useTheme();
  const { calmMotion, performanceLite } = useAdaptiveMotion();

  const icons: Record<ToastType, React.ReactNode> = {
    success: <CheckCircle2 size={17} color={theme.success} />,
    error: <AlertCircle size={17} color={theme.danger} />,
    info: <Info size={17} color={theme.accent} />,
    warning: <AlertTriangle size={17} color={theme.warning} />,
  };

  const badgeBg: Record<ToastType, string> = {
    success: `${theme.success}1c`,
    error: `${theme.danger}1c`,
    info: `${theme.accent}1c`,
    warning: `${theme.warning}1c`,
  };

  return (
    <Portal>
      {/* Apple-style banners: anchored top-center, drop in with a soft spring bounce. */}
      <div className="fixed top-14 left-1/2 z-[9999] flex w-full -translate-x-1/2 flex-col items-center gap-2.5 px-4 pointer-events-none">
        <AnimatePresence mode="popLayout">
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              layout
              initial={calmMotion ? { opacity: 0 } : { opacity: 0, y: -64, scale: 0.92 }}
              animate={calmMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
              exit={calmMotion ? { opacity: 0 } : { opacity: 0, y: -36, scale: 0.94 }}
              transition={calmMotion
                ? { duration: 0.12 }
                : { type: 'spring', stiffness: 380, damping: 26, mass: 0.9 }}
              className="pointer-events-auto flex w-full max-w-[380px] items-start gap-3 rounded-[18px] px-3.5 py-3 shadow-2xl"
              style={{
                background: theme.isDark ? 'rgba(30,30,34,0.88)' : 'rgba(255,255,255,0.92)',
                backdropFilter: performanceLite ? 'blur(14px)' : 'blur(24px) saturate(180%)',
                WebkitBackdropFilter: performanceLite ? 'blur(14px)' : 'blur(24px) saturate(180%)',
                border: `0.5px solid ${theme.border}`,
                boxShadow: performanceLite
                  ? '0 10px 24px rgba(0,0,0,0.16)'
                  : '0 16px 40px rgba(0,0,0,0.20), 0 2px 8px rgba(0,0,0,0.08)',
              }}
            >
              <div
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[11px]"
                style={{ background: badgeBg[toast.type] }}
              >
                {icons[toast.type]}
              </div>

              <div className="min-w-0 flex-1 pt-0.5">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className="text-[10.5px] font-black uppercase tracking-[0.08em]"
                    style={{ color: theme.text3 }}
                  >
                    {TOAST_LABELS[toast.type]}
                  </span>
                  <span className="text-[10px] font-semibold flex-shrink-0" style={{ color: theme.text3 }}>
                    acum
                  </span>
                </div>
                <p className="mt-0.5 text-[13px] font-semibold leading-snug" style={{ color: theme.text }}>
                  {toast.message}
                </p>
                {toast.action && (
                  <button
                    onClick={() => {
                      toast.action?.onClick();
                      removeToast(toast.id);
                    }}
                    className="mt-1.5 rounded-lg px-2.5 py-1 text-xs font-bold transition-colors"
                    style={{ background: `${theme.accent}1a`, color: theme.accent }}
                  >
                    {toast.action.label}
                  </button>
                )}
              </div>

              <button
                onClick={() => removeToast(toast.id)}
                aria-label="Inchide notificarea"
                className="flex-shrink-0 rounded-lg p-1 transition-colors hover:bg-white/5"
                style={{ color: theme.text3 }}
              >
                <X size={13} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </Portal>
  );
}
