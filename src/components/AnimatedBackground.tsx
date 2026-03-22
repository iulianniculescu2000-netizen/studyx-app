import { motion } from 'framer-motion';
import { useTheme } from '../theme/ThemeContext';

export default function AnimatedBackground() {
  const theme = useTheme();

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      {/* Base background */}
      <div className="absolute inset-0" style={{ background: theme.bg }} />

      {/* Ambient orbs — larger, softer, more visible */}
      <motion.div className="absolute rounded-full"
        style={{
          width: 800, height: 800,
          top: '-25%', left: '-18%',
          background: `radial-gradient(circle, ${theme.orb1} 0%, transparent 68%)`,
          filter: 'blur(72px)',
        }}
        animate={{ x: [0, 35, 0], y: [0, -22, 0] }}
        transition={{ duration: 13, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div className="absolute rounded-full"
        style={{
          width: 700, height: 700,
          bottom: '-18%', right: '-14%',
          background: `radial-gradient(circle, ${theme.orb2} 0%, transparent 68%)`,
          filter: 'blur(65px)',
        }}
        animate={{ x: [0, -28, 0], y: [0, 24, 0] }}
        transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut', delay: 3 }}
      />
      <motion.div className="absolute rounded-full"
        style={{
          width: 450, height: 450,
          top: '38%', left: '52%',
          background: `radial-gradient(circle, ${theme.orb3} 0%, transparent 68%)`,
          filter: 'blur(48px)',
        }}
        animate={{ x: [0, 22, -12, 0], y: [0, -28, 12, 0] }}
        transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut', delay: 6 }}
      />

      {/* Subtle dot grid */}
      <div className="absolute inset-0"
        style={{
          backgroundImage: `radial-gradient(circle, ${theme.gridColor} 1px, transparent 1px)`,
          backgroundSize: '28px 28px',
          opacity: theme.isDark ? 0.8 : 0.5,
        }}
      />
    </div>
  );
}
