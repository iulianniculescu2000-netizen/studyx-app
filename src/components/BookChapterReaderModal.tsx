import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useTheme } from '../theme/ThemeContext';
import { useAdaptiveMotion } from '../hooks/useAdaptiveMotion';

interface Props {
  title: string;
  pageLabel?: string;
  loading: boolean;
  content: string;
  onClose: () => void;
}

/** Full chapter reading view — mirrors KnowledgeVault.tsx's "Vizualizare document" modal chrome. */
export default function BookChapterReaderModal({ title, pageLabel, loading, content, onClose }: Props) {
  const theme = useTheme();
  const { performanceLite } = useAdaptiveMotion();

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-50 bg-black/35"
        style={{ backdropFilter: performanceLite ? 'blur(4px)' : 'blur(8px)' }}
      />
      <motion.div
        initial={{ opacity: 0, y: 28, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.98 }}
        className="premium-modal fixed inset-x-3 top-16 bottom-3 z-[60] mx-auto flex max-w-5xl flex-col overflow-hidden rounded-[30px] sm:inset-x-4 sm:top-20 sm:bottom-4 sm:rounded-[34px]"
      >
        <div className="flex flex-wrap items-start justify-between gap-4 border-b px-5 py-4 sm:px-6 sm:py-5" style={{ borderColor: theme.border }}>
          <div className="min-w-0">
            <div className="text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: theme.text3 }}>
              Cuprins {pageLabel ? `· ${pageLabel}` : ''}
            </div>
            <h2 className="mt-1 truncate text-2xl font-black tracking-tight" style={{ color: theme.text }}>{title}</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-2xl p-2.5"
            style={{ background: theme.surface2, border: `1px solid ${theme.border}`, color: theme.text3 }}
          >
            <X size={18} />
          </button>
        </div>
        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6 sm:py-5">
          {loading ? (
            <div className="space-y-3">
              <div className="skeleton-block h-4 w-2/3 rounded-full" />
              <div className="skeleton-block h-4 w-full rounded-full" />
              <div className="skeleton-block h-4 w-5/6 rounded-full" />
              <div className="skeleton-block h-4 w-full rounded-full" />
            </div>
          ) : content ? (
            <div className="glass-panel rounded-[28px] p-6">
              <pre className="whitespace-pre-wrap break-words text-sm leading-7" style={{ color: theme.text, fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}>
                {content}
              </pre>
            </div>
          ) : (
            <p className="text-sm" style={{ color: theme.text3 }}>
              Nu am putut localiza acest capitol în text.
            </p>
          )}
        </div>
      </motion.div>
    </>
  );
}
