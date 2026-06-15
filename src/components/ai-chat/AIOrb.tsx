import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import type { Theme } from '../../theme/themes';

/**
 * The AI's visual identity: an accent-colored orb that emits a pulsing ring while
 * it's "thinking" (active) and sits calm otherwise. Used in the chat header and
 * as a small avatar beside each assistant reply.
 */
export default function AIOrb({
  theme,
  size = 28,
  active = false,
  calm = false,
}: {
  theme: Theme;
  size?: number;
  /** Emit the pulsing ring (e.g. while a response is streaming). */
  active?: boolean;
  /** Respect reduced-motion: skip the pulse animation. */
  calm?: boolean;
}) {
  const iconSize = Math.max(11, Math.round(size * 0.5));
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }} aria-hidden="true">
      {active && !calm && (
        <motion.span
          style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: theme.accent }}
          animate={{ scale: [1, 2.05], opacity: [0.45, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
        />
      )}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Sparkles size={iconSize} color="#fff" />
      </div>
    </div>
  );
}
