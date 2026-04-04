import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Command } from 'lucide-react';
import { useTheme } from '../theme/ThemeContext';
import { useNavigate } from 'react-router-dom';

const SHORTCUTS = [
  { category: 'Navigare', items: [
    { keys: ['?'], description: 'Arată scurtăturile' },
    { keys: ['G', 'H'], description: 'Dashboard (go home)' },
    { keys: ['G', 'Q'], description: 'Toate grilele' },
    { keys: ['G', 'S'], description: 'Statistici' },
    { keys: ['G', 'R'], description: 'Recapitulare' },
    { keys: ['G', 'N'], description: 'Notițele mele' },
  ]},
  { category: 'Acțiuni', items: [
    { keys: ['Ctrl', 'K'], description: 'Caută (global search)' },
    { keys: ['N'], description: 'Grilă nouă' },
    { keys: ['Esc'], description: 'Închide / Anulează' },
  ]},
];

function Key({ label }: { label: string }) {
  const theme = useTheme();
  return (
    <kbd
      className="inline-flex items-center justify-center px-2 py-0.5 rounded-md text-xs font-semibold min-w-[24px]"
      style={{
        background: theme.isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
        border: `1px solid ${theme.border2}`,
        color: theme.text2,
        fontFamily: 'monospace',
        boxShadow: theme.isDark
          ? '0 2px 0 rgba(0,0,0,0.4)'
          : '0 2px 0 rgba(0,0,0,0.12)',
      }}
    >
      {label}
    </kbd>
  );
}

export default function KeyboardShortcuts() {
  const [open, setOpen] = useState(false);
  const theme = useTheme();
  const navigate = useNavigate();

  // G + key navigation state
  const [gPressed, setGPressed] = useState(false);
  const [gTimer, setGTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target as HTMLElement).isContentEditable;

      // Esc always closes modal
      if (e.key === 'Escape') { setOpen(false); setGPressed(false); return; }

      if (isInput) return;

      // ? → open shortcuts modal
      if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
        e.preventDefault();
        setOpen(v => !v);
        return;
      }

      // Ctrl+K → global search (dispatched separately in GlobalSearch)

      // G + [key] navigation
      if (gPressed) {
        setGPressed(false);
        if (gTimer) clearTimeout(gTimer);
        switch (e.key.toLowerCase()) {
          case 'h': navigate('/'); break;
          case 'q': navigate('/quizzes'); break;
          case 's': navigate('/stats'); break;
          case 'r': navigate('/review'); break;
          case 'n': navigate('/notes'); break;
        }
        return;
      }

      if (e.key.toLowerCase() === 'g') {
        setGPressed(true);
        const t = setTimeout(() => setGPressed(false), 1200);
        setGTimer(t);
        return;
      }

      // N → new quiz
      if (e.key.toLowerCase() === 'n') {
        navigate('/create');
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [gPressed, gTimer, navigate]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[200]"
            style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
            onClick={() => setOpen(false)}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.93, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.93, y: 20 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="fixed z-[201] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md rounded-3xl overflow-hidden"
            style={{
              background: theme.modalBg,
              border: `1px solid ${theme.border2}`,
              boxShadow: '0 32px 80px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.05)',
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4"
              style={{ borderBottom: `1px solid ${theme.border}` }}>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{ background: `${theme.accent}18`, color: theme.accent }}>
                  <Command size={15} />
                </div>
                <div>
                  <h2 className="text-sm font-bold" style={{ color: theme.text }}>Scurtături tastatură</h2>
                  <p className="text-xs" style={{ color: theme.text3 }}>Navighează mai rapid</p>
                </div>
              </div>
              <motion.button 
                whileHover={{ scale: 1.1, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setOpen(false)}
                className="p-2 rounded-xl transition-all"
                style={{ color: theme.text3, background: theme.surface2, cursor: 'pointer' }}>
                <X size={14} />
              </motion.button>
            </div>

            {/* Content */}
            <div className="px-6 py-5 space-y-5">
              {SHORTCUTS.map((section) => (
                <div key={section.category}>
                  <p className="text-[11px] font-semibold uppercase tracking-widest mb-3"
                    style={{ color: theme.text3 }}>
                    {section.category}
                  </p>
                  <div className="space-y-2">
                    {section.items.map((item) => (
                      <div key={item.description} className="flex items-center justify-between">
                        <span className="text-sm" style={{ color: theme.text2 }}>
                          {item.description}
                        </span>
                        <div className="flex items-center gap-1">
                          {item.keys.map((k, i) => (
                            <span key={k} className="flex items-center gap-1">
                              {i > 0 && <span className="text-xs" style={{ color: theme.text3 }}>then</span>}
                              <Key label={k} />
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 flex items-center justify-center gap-1.5"
              style={{ borderTop: `1px solid ${theme.border}`, background: `${theme.surface}` }}>
              <Key label="?" />
              <span className="text-xs" style={{ color: theme.text3 }}>pentru a deschide/închide</span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
