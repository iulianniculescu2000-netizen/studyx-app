import { motion } from 'framer-motion';
import type { Theme } from '../../theme/themes';

interface ReviewActionCardProps {
  accent: string;
  badge?: number | string;
  ctaLabel?: string;
  description: string;
  disabled?: boolean;
  emoji: string;
  subtitle: string;
  theme: Theme;
  title: string;
  wide?: boolean;
  onClick: () => void;
}

export default function ReviewActionCard({
  accent,
  badge,
  ctaLabel,
  description,
  disabled = false,
  emoji,
  subtitle,
  theme,
  title,
  wide = false,
  onClick,
}: ReviewActionCardProps) {
  return (
    <motion.button
      whileHover={disabled ? undefined : { scale: 1.01, y: -3 }}
      whileTap={disabled ? undefined : { scale: 0.985 }}
      onClick={onClick}
      disabled={disabled}
      className={`premium-option-card group relative flex min-h-[208px] w-full flex-col overflow-hidden rounded-[32px] p-6 text-left transition-all disabled:opacity-40 ${wide ? 'md:col-span-2' : ''}`}
      style={{
        background: theme.surface,
        border: `1px solid ${disabled ? theme.border : `${accent}33`}`,
        boxShadow: `0 18px 44px ${theme.isDark ? 'rgba(0,0,0,0.22)' : 'rgba(20,24,36,0.08)'}, inset 0 1px 0 rgba(255,255,255,0.08)`,
      }}
    >
      <div
        className="pointer-events-none absolute left-0 top-0 h-28 w-28 rounded-full blur-3xl"
        style={{ background: `${accent}18` }}
      />

      <div
        className="pointer-events-none absolute inset-x-6 top-0 h-px opacity-70"
        style={{ background: `linear-gradient(90deg, transparent, ${accent}55, transparent)` }}
      />

      <div className="relative mb-5 flex items-start gap-4">
        <div
          className="flex h-13 w-13 shrink-0 items-center justify-center rounded-[20px] text-2xl shadow-inner"
          style={{ background: `${accent}18`, border: `1px solid ${accent}38` }}
        >
          {emoji}
        </div>

        <div className="min-w-0 flex-1">
          <span className="block text-lg font-black leading-tight" style={{ color: theme.text }}>
            {title}
          </span>
          <span
            className="mt-1 inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em]"
            style={{ color: accent, background: `${accent}12`, border: `1px solid ${accent}20` }}
          >
            {subtitle}
          </span>
        </div>

        {badge !== undefined && (
          <span
            className="premium-option-badge shrink-0 rounded-full px-3 py-1 text-xs font-black shadow-lg"
            style={{ background: `linear-gradient(135deg, ${accent}, ${theme.accent2})`, color: '#fff' }}
          >
            {badge}
          </span>
        )}
      </div>

      <p className="relative mt-auto text-sm font-medium leading-relaxed" style={{ color: theme.text2 }}>
        {description}
      </p>

      {ctaLabel && (
        <div className="relative mt-5 inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.16em]" style={{ color: accent }}>
          {ctaLabel}
        </div>
      )}
    </motion.button>
  );
}
