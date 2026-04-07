import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useTheme } from '../theme/ThemeContext';

/**
 * Premium Minimal Background
 * Elimină petele de culoare stridente (mov) pentru un aspect curat, profesional.
 * Folosește doar gradiente subtile și un zgomot de textură fin.
 */
const AnimatedBackground: React.FC = () => {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const performanceLite = typeof document !== 'undefined'
    && document.documentElement.getAttribute('data-performance') === 'lite';
  const useStaticBackground = reduceMotion || performanceLite;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: -1,
        background: 'transparent',
        overflow: 'hidden',
      }}
    >
      {/* Subtle Grain Texture */}
      <div 
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{ 
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` 
        }} 
      />

      {/* Very Soft Ambient Glow - Top Right */}
      <motion.div
        className="animated-background-orb"
        animate={useStaticBackground ? { opacity: 0.08, scale: 1, x: 0, y: 0 } : {
          opacity: [0.06, 0.12, 0.06],
          scale: [1, 1.14, 1],
          x: [0, 36, 0],
          y: [0, 22, 0],
        }}
        transition={useStaticBackground ? { duration: 0.2 } : { duration: 22, repeat: Infinity, ease: "easeInOut" }}
        style={{
          position: 'absolute',
          top: '-15%',
          right: '-10%',
          width: '70vw',
          height: '70vw',
          borderRadius: '50%',
          background: `radial-gradient(circle, ${theme.orb1}, transparent 70%)`,
          filter: useStaticBackground ? 'blur(88px)' : 'blur(120px)',
          willChange: useStaticBackground ? 'auto' : 'transform, opacity',
        }}
      />

      {/* Very Soft Ambient Glow - Bottom Left */}
      <motion.div
        className="animated-background-orb"
        animate={useStaticBackground ? { opacity: 0.06, scale: 1, x: 0, y: 0 } : {
          opacity: [0.04, 0.1, 0.04],
          scale: [1, 1.18, 1],
          x: [0, -28, 0],
          y: [0, -16, 0],
        }}
        transition={useStaticBackground ? { duration: 0.2 } : { duration: 28, repeat: Infinity, ease: "easeInOut" }}
        style={{
          position: 'absolute',
          bottom: '-15%',
          left: '-10%',
          width: '60vw',
          height: '60vw',
          borderRadius: '50%',
          background: `radial-gradient(circle, ${theme.orb2}, transparent 70%)`,
          filter: useStaticBackground ? 'blur(96px)' : 'blur(132px)',
          willChange: useStaticBackground ? 'auto' : 'transform, opacity',
        }}
      />
    </div>
  );
};

export default AnimatedBackground;
