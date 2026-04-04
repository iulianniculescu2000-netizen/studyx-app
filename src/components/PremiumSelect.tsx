import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check } from 'lucide-react';
import { useTheme } from '../theme/ThemeContext';
import Portal from './Portal';

interface Option {
  value: string;
  label: string;
}

interface Props {
  options: Option[];
  value: string;
  onChange: (val: string) => void;
  icon?: React.ReactNode;
}

export default function PremiumSelect({ options, value, onChange, icon }: Props) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });

  const selected = options.find(o => o.value === value) || options[0];

  const updateCoords = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom + 8,
        left: rect.left,
        width: Math.max(rect.width, 200),
      });
    }
  };

  useEffect(() => {
    if (open) {
      updateCoords();
      window.addEventListener('resize', updateCoords);
      window.addEventListener('scroll', updateCoords, true);
    }
    return () => {
      window.removeEventListener('resize', updateCoords);
      window.removeEventListener('scroll', updateCoords, true);
    };
  }, [open]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all hover:opacity-80 active:scale-[0.98]"
        style={{ background: theme.surface2, border: `1px solid ${theme.border2}` }}
      >
        {icon}
        <span className="text-[11px] font-black uppercase tracking-wider whitespace-nowrap" style={{ color: theme.text2 }}>
          {selected?.label}
        </span>
        <ChevronDown size={12} style={{ color: theme.text3 }} className={`transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
      </button>

      <Portal>
        <AnimatePresence>
          {open && (
            <>
              {/* Backdrop to close */}
              <div 
                className="fixed inset-0 z-[9998]" 
                onClick={() => setOpen(false)} 
              />
              
              <motion.div
                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                style={{
                  position: 'fixed',
                  top: coords.top,
                  left: coords.left,
                  width: coords.width,
                  zIndex: 9999,
                  background: theme.modalBg,
                  border: `1px solid ${theme.border}`,
                  borderRadius: 16,
                  boxShadow: '0 12px 40px rgba(0,0,0,0.2)',
                  overflow: 'hidden',
                  backdropFilter: 'blur(20px)',
                }}
              >
                <div className="p-1.5 flex flex-col gap-1">
                  {options.map((opt) => {
                    const isActive = opt.value === value;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => {
                          onChange(opt.value);
                          setOpen(false);
                        }}
                        className="flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-all group"
                        style={{
                          background: isActive ? `${theme.accent}15` : 'transparent',
                        }}
                      >
                        <span className="text-xs font-bold" style={{ color: isActive ? theme.accent : theme.text2 }}>
                          {opt.label}
                        </span>
                        {isActive && <Check size={14} style={{ color: theme.accent }} />}
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </Portal>
    </div>
  );
}
