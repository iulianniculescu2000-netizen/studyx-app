import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useTheme } from '../theme/ThemeContext';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'default';
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirmă',
  cancelLabel = 'Anulează',
  variant = 'danger',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const theme = useTheme();
  const performanceLite = typeof document !== 'undefined'
    && document.documentElement.getAttribute('data-performance') === 'lite';

  const variantColor = variant === 'danger' ? theme.danger : variant === 'warning' ? theme.warning : theme.accent;
  const Icon = variant === 'danger' ? Trash2 : AlertTriangle;

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[100]"
            style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: performanceLite ? 'blur(2px)' : 'blur(6px)' }}
            onClick={onCancel}
          />

          {/* Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: -12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: -12 }}
            transition={{ type: 'spring', damping: 22, stiffness: 380 }}
            className="fixed z-[101] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm"
            style={{ padding: '0 16px' }}
          >
            <div
              className="relative rounded-3xl p-6 shadow-2xl"
              style={{
                background: theme.modalBg,
                border: `1px solid ${theme.border2}`,
                backdropFilter: performanceLite ? 'blur(18px)' : 'blur(32px)',
                WebkitBackdropFilter: performanceLite ? 'blur(18px)' : 'blur(32px)',
              }}
            >
              {/* Icon */}
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
                style={{ background: `${variantColor}18` }}
              >
                <Icon size={22} style={{ color: variantColor }} />
              </div>

              {/* Title */}
              <h3 className="text-base font-semibold mb-1.5 leading-snug" style={{ color: theme.text }}>
                {title}
              </h3>

              {/* Description */}
              {description && (
                <p className="text-sm leading-relaxed mb-5" style={{ color: theme.text2 }}>
                  {description}
                </p>
              )}

              {/* Actions */}
              <div className="flex gap-3 mt-6">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={onCancel}
                  className="flex-1 py-3 rounded-2xl text-sm font-bold transition-all press-feedback"
                  style={{ background: theme.surface2, color: theme.text2, border: `1px solid ${theme.border2}` }}
                >
                  {cancelLabel}
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02, boxShadow: `0 8px 24px ${variantColor}40` }}
                  whileTap={{ scale: 0.97 }}
                  onClick={onConfirm}
                  className="flex-1 py-3 rounded-2xl text-sm font-black text-white shadow-lg transition-all press-feedback"
                  style={{ background: variantColor }}
                >
                  {confirmLabel}
                </motion.button>
              </div>

              {/* Close X button */}
              <motion.button
                onClick={onCancel}
                whileHover={{ rotate: 90, scale: 1.15, background: 'rgba(255,255,255,0.1)' }}
                whileTap={{ scale: 0.88 }}
                transition={{ duration: 0.2 }}
                className="absolute top-4 right-4 p-1.5 rounded-lg press-feedback"
                style={{ color: theme.text3, cursor: 'pointer' }}
              >
                <X size={14} />
              </motion.button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
