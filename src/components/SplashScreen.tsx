import React from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import Logo from './Logo';

interface SplashScreenProps {
  visible: boolean;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ visible }) => {
  const reduceMotion = useReducedMotion();
  const performanceLite = typeof document !== 'undefined'
    && document.documentElement.getAttribute('data-performance') === 'lite';
  const calm = reduceMotion || performanceLite;

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
            background: 'radial-gradient(circle at 50% 18%, rgba(0,113,227,0.14), transparent 28%), #0a0a0f',
          }}
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: calm ? 0.12 : 0.2, ease: [0.16, 1, 0.3, 1] }}
            style={{
              boxShadow: calm ? '0 10px 24px rgba(0,113,227,0.08)' : '0 12px 28px rgba(0,113,227,0.10)',
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
                color: 'white',
                fontSize: '1.92rem',
                fontWeight: 'bold',
                letterSpacing: '1.8px',
                margin: 0,
                fontFamily: '"SF Pro Display", "SF Pro Text", "Segoe UI Variable Display", "Segoe UI", system-ui, sans-serif',
              }}
            >
              STUDY<span style={{ color: '#0071E3' }}>X</span>
            </h1>
            <div
              style={{
                height: 2,
                width: 34,
                background: '#0071E3',
                margin: '10px auto',
                borderRadius: 2,
              }}
            />
            <p
              style={{
                color: '#aeb4c3',
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
                background: 'rgba(255,255,255,0.05)',
                borderRadius: 10,
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              <motion.div
                animate={calm ? { x: '18%' } : { x: ['-42%', '42%'] }}
                transition={calm ? { duration: 0.12 } : { duration: 0.5, ease: 'easeInOut', repeat: Infinity }}
                style={{
                  width: '54%',
                  height: '100%',
                  background: 'linear-gradient(90deg, transparent, #0071E3, transparent)',
                  position: 'absolute',
                  willChange: 'transform',
                }}
              />
            </div>
            <p style={{ color: 'rgba(255,255,255,0.24)', fontSize: '0.68rem', marginTop: 8 }}>
              Se incarca experienta premium...
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SplashScreen;
