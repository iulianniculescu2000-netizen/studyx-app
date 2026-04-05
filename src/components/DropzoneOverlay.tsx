import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import { FilePlus, Sparkles } from 'lucide-react';
import { useTheme } from '../theme/ThemeContext';

interface Props {
  onFilesDropped: (files: File[]) => void;
}

export default function DropzoneOverlay({ onFilesDropped }: Props) {
  const [active, setActive] = useState(false);
  const theme = useTheme();
  const performanceLite = typeof document !== 'undefined'
    && document.documentElement.getAttribute('data-performance') === 'lite';

  useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer?.types.includes('Files')) {
        setActive(true);
      }
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      // Only deactivate if leaving the window (relatedTarget is null)
      if (!e.relatedTarget) {
        setActive(false);
      }
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setActive(false);
      
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        onFilesDropped(Array.from(e.dataTransfer.files));
      }
    };

    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('drop', handleDrop);
    };
  }, [onFilesDropped]);

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[10000] flex items-center justify-center p-6 sm:p-10 pointer-events-none"
          style={{ 
            background: 'rgba(0,0,0,0.4)', 
            backdropFilter: performanceLite ? 'blur(4px)' : 'blur(12px)',
          }}
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            className="w-full max-w-lg p-10 sm:p-16 rounded-[48px] border-4 border-dashed text-center flex flex-col items-center gap-8 shadow-2xl"
            style={{ 
              background: theme.modalBg,
              borderColor: theme.accent,
              boxShadow: performanceLite ? `0 0 48px ${theme.accent}22` : `0 0 100px ${theme.accent}44`
            }}
          >
            <motion.div
              animate={performanceLite ? { y: 0, rotate: 0, scale: 1 } : { 
                y: [0, -20, 0],
                rotate: [0, 5, -5, 0],
                scale: [1, 1.1, 1]
              }}
              transition={performanceLite ? { duration: 0.18 } : { repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
              className="w-28 h-28 rounded-[32px] flex items-center justify-center shadow-2xl"
              style={{ 
                background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})`, 
                color: '#fff',
                boxShadow: `0 20px 40px ${theme.accent}66`
              }}
            >
              <FilePlus size={56} />
            </motion.div>
            
            <div className="space-y-3">
              <h2 className="text-4xl font-black tracking-tight" style={{ color: theme.text }}>
                Import <span style={{ color: theme.accent }}>Inteligent</span>
              </h2>
              <p className="text-lg font-medium opacity-60 max-w-xs mx-auto leading-relaxed" style={{ color: theme.text }}>
                Eliberează fișierele aici pentru a le indexa în Biblioteca AI.
              </p>
            </div>

            <div className="flex gap-3 flex-wrap justify-center">
              {[
                { label: 'PDF / Word', color: theme.accent },
                { label: 'OCR Medical', color: '#FF9F0A' },
                { label: 'RAG Indexing', color: theme.success }
              ].map(t => (
                <span key={t.label} className="px-5 py-2 rounded-2xl text-[10px] font-black uppercase tracking-[0.15em] shadow-sm"
                  style={{ background: `${t.color}15`, color: t.color, border: `1px solid ${t.color}30` }}>
                  {t.label}
                </span>
              ))}
            </div>

            <div className="absolute bottom-8 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest opacity-40" style={{ color: theme.text }}>
              <Sparkles size={12} />
              StudyX Smart Engine v2
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
