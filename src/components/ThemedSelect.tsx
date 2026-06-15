import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check } from 'lucide-react';
import { useTheme } from '../theme/ThemeContext';
import Portal from './Portal';

export interface ThemedSelectOption {
  value: string;
  label: string;
}

interface Props {
  options: ThemedSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  /** 'md' for full-size form fields, 'sm' for compact inline pickers. */
  size?: 'sm' | 'md';
  /** Open the list immediately on mount (for inline "edit" affordances). */
  defaultOpen?: boolean;
  /** Called when the dropdown closes without a selection (outside click / Esc). */
  onRequestClose?: () => void;
  className?: string;
}

/**
 * App-themed replacement for a native <select>. The option list renders in a
 * Portal positioned under the trigger, so it never inherits the OS-native white
 * popup and is never clipped by a parent modal's overflow.
 */
export default function ThemedSelect({
  options,
  value,
  onChange,
  placeholder = 'Alege...',
  disabled,
  size = 'md',
  defaultOpen = false,
  onRequestClose,
  className,
}: Props) {
  const theme = useTheme();
  const [open, setOpen] = useState(defaultOpen);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });

  const selected = options.find((option) => option.value === value);

  const updateCoords = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) {
      setCoords({ top: rect.bottom + 6, left: rect.left, width: rect.width });
    }
  };

  useLayoutEffect(() => {
    // Measure the trigger to position the portal popover under it. Setting state
    // here is intentional (DOM measurement after open), not a render cascade.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) updateCoords();
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onScrollOrResize = () => updateCoords();
    const onEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        onRequestClose?.();
      }
    };
    window.addEventListener('resize', onScrollOrResize);
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('keydown', onEsc);
    return () => {
      window.removeEventListener('resize', onScrollOrResize);
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('keydown', onEsc);
    };
  }, [open, onRequestClose]);

  const isSm = size === 'sm';

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        className={`flex w-full items-center gap-2 border text-left transition-all disabled:opacity-60 ${
          isSm ? 'rounded-lg px-2 py-1 text-[10px] font-bold' : 'rounded-2xl px-4 py-3 text-sm font-bold'
        } ${className ?? ''}`}
        style={{
          background: theme.surface2,
          borderColor: open ? `${theme.accent}55` : theme.border,
          color: theme.text,
        }}
      >
        <span className="min-w-0 flex-1 truncate">{selected?.label ?? placeholder}</span>
        <motion.div animate={{ rotate: open ? 180 : 0 }} style={{ color: theme.text3 }}>
          <ChevronDown size={isSm ? 12 : 16} />
        </motion.div>
      </button>

      <Portal>
        <AnimatePresence>
          {open && (
            <>
              <div
                className="fixed inset-0 z-[9998]"
                onClick={() => { setOpen(false); onRequestClose?.(); }}
              />
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.97 }}
                transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                style={{
                  position: 'fixed',
                  top: coords.top,
                  left: coords.left,
                  width: Math.max(coords.width, 180),
                  zIndex: 9999,
                  background: theme.modalBg,
                  border: `1px solid ${theme.border}`,
                  borderRadius: 16,
                  boxShadow: '0 12px 40px rgba(0,0,0,0.22)',
                  overflow: 'hidden',
                  backdropFilter: 'blur(20px) saturate(160%)',
                }}
              >
                <div className="custom-scrollbar flex max-h-60 flex-col gap-0.5 overflow-y-auto p-1.5">
                  {options.map((option) => {
                    const active = option.value === value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => {
                          onChange(option.value);
                          setOpen(false);
                        }}
                        className="flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left transition-all"
                        style={{ background: active ? `${theme.accent}18` : 'transparent' }}
                      >
                        <span
                          className="min-w-0 flex-1 truncate text-xs font-bold"
                          style={{ color: active ? theme.accent : theme.text2 }}
                        >
                          {option.label}
                        </span>
                        {active && <Check size={14} style={{ color: theme.accent }} />}
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </Portal>
    </>
  );
}
