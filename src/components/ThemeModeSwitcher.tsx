import { useId } from 'react';
import { motion } from 'framer-motion';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from '../theme/ThemeContext';
import { useThemeStore } from '../store/themeStore';
import { useAdaptiveMotion } from '../hooks/useAdaptiveMotion';
import { THEME_MODES, nextThemeMode, type ThemeMode } from '../theme/themes';

const LABELS: Record<ThemeMode, string> = {
  light: 'Luminos',
  dark: 'Întunecat',
  auto: 'Automat',
};

const ICONS: Record<ThemeMode, typeof Sun> = { light: Sun, dark: Moon, auto: Monitor };

/**
 * Luminos / Întunecat / Automat.
 *  - `segmented`: the Apple-style control with a sliding pill (Settings, onboarding).
 *  - `compact`: one small round button that cycles the three modes (sidebar, corners).
 */
export default function ThemeModeSwitcher({ variant = 'segmented' }: { variant?: 'segmented' | 'compact' }) {
  const theme = useTheme();
  const mode = useThemeStore((state) => state.mode);
  const setMode = useThemeStore((state) => state.setMode);
  const { calmMotion } = useAdaptiveMotion();
  const pillId = useId();

  if (variant === 'compact') {
    const Icon = ICONS[mode];
    return (
      <button
        type="button"
        onClick={() => setMode(nextThemeMode(mode))}
        aria-label={`Aspect: ${LABELS[mode]}. Apasă pentru a schimba.`}
        title={`Aspect: ${LABELS[mode]}`}
        data-testid="theme-toggle-compact"
        className="press-feedback focus-ring-premium flex h-9 w-9 items-center justify-center rounded-full"
        style={{ background: 'var(--fill-subtle)', color: theme.text2, border: `0.5px solid ${theme.hairline}` }}
      >
        <Icon size={16} strokeWidth={2} />
      </button>
    );
  }

  return (
    <div
      role="radiogroup"
      aria-label="Aspect"
      data-testid="theme-toggle"
      className="inline-flex w-full max-w-md gap-0.5 rounded-[14px] p-[3px]"
      style={{ background: 'var(--fill-subtle)', border: `0.5px solid ${theme.hairline}` }}
    >
      {THEME_MODES.map((option) => {
        const Icon = ICONS[option];
        const active = option === mode;
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setMode(option)}
            className="focus-ring-premium relative flex flex-1 items-center justify-center gap-1.5 rounded-[11px] px-3 py-2 text-[12.5px] font-semibold"
            style={{ color: active ? theme.text : theme.text3, transition: 'color 0.2s var(--ease-out-soft)' }}
          >
            {active && (
              <motion.span
                layoutId={`theme-pill-${pillId}`}
                className="absolute inset-0 rounded-[11px]"
                style={{
                  background: theme.isDark ? 'rgba(255,255,255,0.13)' : '#FFFFFF',
                  boxShadow: theme.isDark
                    ? 'inset 0 1px 0 rgba(255,255,255,0.10), 0 1px 3px rgba(0,0,0,0.35)'
                    : '0 1px 3px rgba(0,0,0,0.14), 0 0 0 0.5px rgba(0,0,0,0.05)',
                }}
                transition={calmMotion ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 38 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5">
              <Icon size={14} strokeWidth={2} />
              {LABELS[option]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
