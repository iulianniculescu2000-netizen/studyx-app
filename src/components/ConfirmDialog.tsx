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
            style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
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
                backdropFilter: 'blur(32px)',
                WebkitBackdropFilter: 'blur(32px)',
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
              <div className="flex gap-2 mt-4">
                <button
                  onClick={onCancel}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all hover:opacity-80"
                  style={{ background: theme.surface2, color: theme.text2, border: `1px solid ${theme.border}` }}
                >
                  {cancelLabel}
                </button>
                <button
                  onClick={onConfirm}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
                  style={{ background: variantColor }}
                >
                  {confirmLabel}
                </button>
              </div>

              {/* Close X button */}
              <motion.button
                onClick={onCancel}
                whileHover={{ rotate: 90, scale: 1.15 }}
                whileTap={{ scale: 0.88 }}
                transition={{ duration: 0.2 }}
                className="absolute top-4 right-4 p-1.5 rounded-lg"
                style={{ color: theme.text3 }}
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
