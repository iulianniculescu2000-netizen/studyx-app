import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../theme/ThemeContext';

interface SplashScreenProps {
  visible: boolean;
}

export default function SplashScreen({ visible }: SplashScreenProps) {
  const theme = useTheme();

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="splash"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: theme.bg,
          }}
        >
          {/* Logo + name */}
          <motion.div
            initial={{ scale: 0.72, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}
          >
            {/* Icon */}
            <motion.div
              animate={{ boxShadow: [`0 8px 32px ${theme.accent}55`, `0 8px 48px ${theme.accent}90`, `0 8px 32px ${theme.accent}55`] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              style={{
                width: 68,
                height: 68,
                borderRadius: 22,
                background: `linear-gradient(135deg, ${theme.accent} 0%, ${theme.accent2} 100%)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 30,
                fontWeight: 900,
                color: '#fff',
                letterSpacing: -1,
                userSelect: 'none',
              }}
            >
              S
            </motion.div>

            {/* App name */}
            <div style={{ fontSize: 24, fontWeight: 800, color: theme.text, letterSpacing: -0.5 }}>
              StudyX
            </div>

            {/* Animated loading bar */}
            <div style={{ width: 120, height: 3, borderRadius: 2, background: theme.border, overflow: 'hidden' }}>
              <motion.div
                initial={{ x: '-100%' }}
                animate={{ x: '100%' }}
                transition={{ duration: 1.1, repeat: Infinity, ease: [0.4, 0, 0.6, 1] }}
                style={{
                  height: '100%',
                  width: '60%',
                  borderRadius: 2,
                  background: `linear-gradient(90deg, transparent, ${theme.accent}, transparent)`,
                }}
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
