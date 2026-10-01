import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Logo from './Logo';
import { useAdaptiveMotion } from '../hooks/useAdaptiveMotion';
import { useTheme } from '../theme/ThemeContext';

interface SplashScreenProps {
  visible: boolean;
  /** Total time the splash stays mounted, in ms — the progress bar fill is paced to exactly this, so it never lies about how long the wait actually is. */
  durationMs: number;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ visible, durationMs }) => {
  const { calmMotion: calm } = useAdaptiveMotion();
  const theme = useTheme();
  const [nearDone, setNearDone] = useState(false);

  // Quiet payoff right as the bar finishes filling, instead of an abrupt cut
  // from "loading" straight to gone — skipped under calmMotion, where the
  // whole splash is already short enough that a caption swap would just feel
  // rushed rather than satisfying.
  useEffect(() => {
    if (!visible || calm) return;
    const timer = setTimeout(() => setNearDone(true), Math.max(0, durationMs - 320));
    return () => clearTimeout(timer);
  }, [visible, calm, durationMs]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: calm ? 0.16 : 0.26, ease: 'easeInOut' } }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: `radial-gradient(circle at 50% 18%, color-mix(in srgb, ${theme.accent} 14%, transparent), transparent 32%), ${theme.bg}`,
          }}
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: calm ? 0.12 : 0.2, ease: [0.16, 1, 0.3, 1] }}
            style={{
              boxShadow: calm ? `0 10px 24px color-mix(in srgb, ${theme.accent} 10%, transparent)` : `0 12px 28px color-mix(in srgb, ${theme.accent} 14%, transparent)`,
              borderRadius: 30,
              padding: 12,
              willChange: 'transform, opacity',
            }}
          >
            <Logo size={124} />
          </motion.div>

          <motion.div
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: calm ? 0 : 0.05, duration: calm ? 0.12 : 0.18, ease: [0.16, 1, 0.3, 1] }}
            style={{ marginTop: 18, textAlign: 'center', willChange: 'transform, opacity' }}
          >
            <h1
              style={{
                color: theme.text,
                fontSize: '1.92rem',
                fontWeight: 'bold',
                letterSpacing: '1.8px',
                margin: 0,
                fontFamily: '"SF Pro Display", "SF Pro Text", "Segoe UI Variable Display", "Segoe UI", system-ui, sans-serif',
              }}
            >
              STUDY
              <span style={{
                background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}>X</span>
            </h1>
            <div
              style={{
                height: 2,
                width: 34,
                background: `linear-gradient(90deg, ${theme.accent}, ${theme.accent2})`,
                margin: '10px auto',
                borderRadius: 2,
              }}
            />
            <p
              style={{
                color: theme.text2,
                fontSize: '0.78rem',
                fontWeight: 500,
                textTransform: 'uppercase',
                letterSpacing: '1px',
                margin: 0,
              }}
            >
              Medicina / Inteligenta / Performanta
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: calm ? 0.05 : 0.1, duration: 0.15 }}
            style={{
              position: 'absolute',
              bottom: '10%',
              width: 164,
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: '100%',
                height: 2,
                background: theme.fillSubtle,
                borderRadius: 10,
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              <motion.div
                initial={{ width: '0%' }}
                animate={{ width: '100%' }}
                transition={
                  calm
                    ? { duration: 0.2 }
                    : { duration: (durationMs - 100) / 1000, ease: [0.22, 0.61, 0.36, 1] }
                }
                style={{
                  height: '100%',
                  background: `linear-gradient(90deg, ${theme.accent}, ${theme.accent2})`,
                  willChange: 'width',
                }}
              />
            </div>
            <AnimatePresence mode="wait">
              <motion.p
                key={nearDone ? 'ready' : 'loading'}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                style={{ color: theme.text3, fontSize: '0.68rem', marginTop: 8 }}
              >
                {nearDone ? 'Bine ai venit.' : 'Se încarcă experiența premium...'}
              </motion.p>
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SplashScreen;
