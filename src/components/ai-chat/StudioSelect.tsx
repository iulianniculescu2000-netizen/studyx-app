import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown } from 'lucide-react';
import { useTheme } from '../../theme/ThemeContext';

export type StudioOption = {
  value: string;
  label: string;
  hint?: string;
};

/** Dropdown picker used across AI Studio's source/chapter/folder fields. */
export default function StudioSelect({
  label,
  value,
  onChange,
  options,
  placeholder,
  theme,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: StudioOption[];
  placeholder: string;
  theme: ReturnType<typeof useTheme>;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value) ?? null;
  const isDisabled = options.length === 0;

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: theme.text3 }}>
        {label}
      </span>
      <button
        type="button"
        onClick={() => {
          if (!isDisabled) {
            setOpen((current) => !current);
          }
        }}
        disabled={isDisabled}
        className="flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all"
        style={{
          background: theme.surface,
          borderColor: open ? `${theme.accent}55` : theme.border,
          color: theme.text,
          boxShadow: open ? `0 0 0 1px ${theme.accent}20` : 'none',
          opacity: isDisabled ? 0.55 : 1,
        }}
      >
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">
            {selected?.label ?? placeholder}
          </div>
          <div className="mt-0.5 truncate text-[11px]" style={{ color: theme.text3 }}>
            {selected?.hint ?? (isDisabled ? 'Nu există opțiuni disponibile.' : 'Apasă pentru a alege.')}
          </div>
        </div>
        <motion.div animate={{ rotate: open ? 180 : 0 }} style={{ color: theme.text3 }}>
          <ChevronDown size={16} />
        </motion.div>
      </button>

      <AnimatePresence>
        {open && !isDisabled && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-30 rounded-[22px] border p-2 shadow-2xl"
            style={{
              background: theme.isDark ? 'rgba(22,22,30,0.96)' : 'rgba(255,255,255,0.96)',
              borderColor: theme.border,
              backdropFilter: 'blur(18px) saturate(155%)',
            }}
          >
            <div className="custom-scrollbar max-h-56 space-y-1 overflow-y-auto">
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
                    className="flex w-full items-center gap-3 rounded-[18px] px-3 py-2.5 text-left transition-all"
                    style={{
                      background: active ? theme.accent : 'transparent',
                      color: active ? '#fff' : theme.text,
                    }}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">
                        {option.label}
                      </div>
                      {option.hint && (
                        <div className="mt-0.5 truncate text-[11px]" style={{ color: active ? 'rgba(255,255,255,0.76)' : theme.text3 }}>
                          {option.hint}
                        </div>
                      )}
                    </div>
                    {active && <Check size={15} />}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
