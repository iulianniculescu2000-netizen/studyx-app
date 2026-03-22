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

  return (
    <motion.button
      onClick={onClick}
      title={label}
      aria-label={label}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      whileTap={{ scale: 0.82 }}
      transition={{ duration: 0.08 }}
      style={{
        width,
        height: 40,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: 'none',
        outline: 'none',
        cursor: 'default',
        background: hover
          ? hoverBg
          : 'transparent',
        color: hover ? hoverColor : 'rgba(200,200,210,0.72)',
        transition: 'background 0.12s, color 0.12s',
        flexShrink: 0,
      }}
    >
      <motion.span
        animate={isClose && hover ? { rotate: [0, -10, 10, -4, 0] } : { rotate: 0 }}
        transition={{ duration: 0.28, ease: 'easeOut' }}
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
        zIndex: 9992,          // Above modals (z-200), below splash (z-9999)
        display: 'flex',
        alignItems: 'center',
        // Electron drag region override — buttons must be clickable
        WebkitAppRegion: 'no-drag',
      } as React.CSSProperties & { WebkitAppRegion: string }}
    >
      <WinBtn
        label="Minimizează"
        icon={<Minus size={14} strokeWidth={2} />}
        hoverBg="rgba(120,120,130,0.22)"
        hoverColor="rgba(240,240,250,1)"
        width={46}
        onClick={() => api.minimize()}
      />
      <WinBtn
        label={isMax ? 'Restaurează' : 'Maximizează'}
        icon={isMax
          ? <Minimize2 size={13} strokeWidth={2} />
          : <Maximize2 size={13} strokeWidth={2} />}
        hoverBg="rgba(48,209,88,0.22)"
        hoverColor="rgba(240,240,250,1)"
        width={46}
        onClick={() => api.maximize()}
      />
      <WinBtn
        label="Închide"
        icon={<X size={14} strokeWidth={2} />}
        hoverBg="rgba(255,69,58,0.88)"
        hoverColor="#FFFFFF"
        width={52}
        isClose
        onClick={() => api.close()}
      />
    </div>
  );
}
