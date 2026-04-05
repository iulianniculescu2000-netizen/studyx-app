import React from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '../theme/ThemeContext';

/**
 * Premium Minimal Background
 * Elimină petele de culoare stridente (mov) pentru un aspect curat, profesional.
 * Folosește doar gradiente subtile și un zgomot de textură fin.
 */
const AnimatedBackground: React.FC = () => {
  const theme = useTheme();

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
        animate={{
          opacity: [0.08, 0.15, 0.08],
          scale: [1, 1.2, 1],
          x: [0, 50, 0],
          y: [0, 30, 0],
        }}
        transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
        style={{
          position: 'absolute',
          top: '-15%',
          right: '-10%',
          width: '70vw',
          height: '70vw',
          borderRadius: '50%',
          background: `radial-gradient(circle, ${theme.accent}30, transparent 70%)`,
          filter: 'blur(100px)',
        }}
      />

      {/* Very Soft Ambient Glow - Bottom Left */}
      <motion.div
        animate={{
          opacity: [0.05, 0.12, 0.05],
          scale: [1, 1.3, 1],
          x: [0, -40, 0],
          y: [0, -20, 0],
        }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
        style={{
          position: 'absolute',
          bottom: '-15%',
          left: '-10%',
          width: '60vw',
          height: '60vw',
          borderRadius: '50%',
          background: `radial-gradient(circle, ${theme.accent2}20, transparent 70%)`,
          filter: 'blur(120px)',
        }}
      />
    </div>
  );
};

export default AnimatedBackground;
