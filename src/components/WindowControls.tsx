/**
 * WindowControls — Fixed overlay, always visible in Electron.
 *
 * Positioned at the very top-right corner of the window regardless of which
 * page or screen is active (Welcome, ProfileSelect, main app, etc.).
 * This is the correct pattern for frameless Electron windows on Windows.
 */
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Minus, X, Maximize2, Minimize2 } from 'lucide-react';
import { useTheme } from '../theme/ThemeContext';

interface BtnConfig {
  label: string;
  icon: React.ReactNode;
  hoverBg: string;
  hoverColor: string;
  width: number;
  isClose?: boolean;
}

function WinBtn({
  label, icon, hoverBg, hoverColor, width, isClose, onClick,
}: BtnConfig & { onClick: () => void }) {
  const [hover, setHover] = useState(false);
  const theme = useTheme();

  return (
    <motion.button
      onClick={onClick}
      title={label}
      aria-label={label}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      whileTap={{ scale: 0.8 }}
      transition={{ type: 'spring', stiffness: 400, damping: 10 }}
      style={{
        width,
        height: 40,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: 'none',
        outline: 'none',
        cursor: 'pointer',
        background: hover
          ? hoverBg
          : 'transparent',
        color: hover 
          ? hoverColor 
          : theme.text2, // High visibility based on theme
        transition: 'background 0.15s, color 0.12s',
        flexShrink: 0,
      }}
    >
      <motion.span
        animate={isClose && hover ? { rotate: 90, scale: 1.1 } : { rotate: 0, scale: 1 }}
        transition={{ duration: 0.2, ease: 'backOut' }}
        style={{ display: 'flex', alignItems: 'center' }}
      >
        {icon}
      </motion.span>
    </motion.button>
  );
}

export default function WindowControls() {
  const [isMax, setIsMax] = useState(false);
  const api = typeof window !== 'undefined' ? window.electronAPI : undefined;
  const theme = useTheme();

  useEffect(() => {
    if (!api) return;
    api.isMaximized().then(setIsMax).catch(() => {});
    const unsub = api.onMaximized(setIsMax);
    return unsub;
  }, [api]);

  // Only render in Electron
  if (!api) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        zIndex: 9999,          // Absolute top
        display: 'flex',
        alignItems: 'center',
        background: 'transparent',
        width: 138,            // 46 * 3
        height: 40,
        // Electron drag region override — buttons must be clickable
        WebkitAppRegion: 'no-drag',
      } as React.CSSProperties & { WebkitAppRegion: string }}
    >
      <WinBtn
        label="Minimizează"
        icon={<Minus size={14} strokeWidth={2.5} />}
        hoverBg={theme.isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}
        hoverColor={theme.text}
        width={46}
        onClick={() => api.minimize()}
      />
      <WinBtn
        label={isMax ? 'Restaurează' : 'Maximizează'}
        icon={isMax
          ? <Minimize2 size={13} strokeWidth={2.5} />
          : <Maximize2 size={13} strokeWidth={2.5} />}
        hoverBg={theme.isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}
        hoverColor={theme.text}
        width={46}
        onClick={() => api.maximize()}
      />
      <WinBtn
        label="Închide"
        icon={<X size={14} strokeWidth={2.5} />}
        hoverBg="rgba(255,69,58,0.95)"
        hoverColor="#FFFFFF"
        width={46}
        isClose
        onClick={() => api.close()}
      />
    </div>
  );
}
