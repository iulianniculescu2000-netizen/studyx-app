/**
 * Window controls for frameless Electron on Windows.
 * Kept fixed in the top-right corner and styled as a compact premium capsule.
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
  label,
  icon,
  hoverBg,
  hoverColor,
  width,
  isClose,
  onClick,
}: BtnConfig & { onClick: () => void }) {
  const [hover, setHover] = useState(false);
  const theme = useTheme();
  const performanceLite = typeof document !== 'undefined'
    && document.documentElement.getAttribute('data-performance') === 'lite';

  return (
    <motion.button
      onClick={onClick}
      title={label}
      aria-label={label}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      whileTap={performanceLite ? undefined : { scale: 0.94 }}
      transition={{ type: 'spring', stiffness: 340, damping: 22 }}
      className="press-feedback"
      style={{
        width,
        height: 40,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: 'none',
        outline: 'none',
        cursor: 'pointer',
        background: hover ? hoverBg : 'transparent',
        color: hover ? hoverColor : theme.text2,
        transition: 'background 0.16s ease, color 0.14s ease, transform 0.14s ease',
        flexShrink: 0,
        borderRadius: isClose ? '0 14px 14px 0' : 0,
      }}
    >
      <motion.span
        animate={isClose && hover ? { rotate: 90, scale: 1.08 } : { rotate: 0, scale: 1 }}
        transition={{ duration: 0.18, ease: 'backOut' }}
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
  const performanceLite = typeof document !== 'undefined'
    && document.documentElement.getAttribute('data-performance') === 'lite';

  useEffect(() => {
    if (!api) return;
    api.isMaximized().then(setIsMax).catch(() => {});
    const unsub = api.onMaximized(setIsMax);
    return unsub;
  }, [api]);

  if (!api) return null;

  return (
    <div
      className="premium-window-controls"
      style={{
        position: 'fixed',
        top: 6,
        right: 10,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        background: theme.isDark ? 'rgba(28,28,30,0.52)' : 'rgba(255,255,255,0.62)',
        backdropFilter: performanceLite ? 'blur(10px) saturate(120%)' : 'blur(18px) saturate(150%)',
        width: 136,
        height: 40,
        borderRadius: isMax ? 16 : 18,
        border: `1px solid ${theme.border}`,
        boxShadow: theme.isDark
          ? '0 12px 28px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.06)'
          : '0 12px 28px rgba(15,23,42,0.08), inset 0 1px 0 rgba(255,255,255,0.7)',
        WebkitAppRegion: 'no-drag',
        overflow: 'hidden',
      } as React.CSSProperties & { WebkitAppRegion: string }}
    >
      <WinBtn
        label="Minimizeaza"
        icon={<Minus size={14} strokeWidth={2.4} />}
        hoverBg={theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.05)'}
        hoverColor={theme.text}
        width={46}
        onClick={() => api.minimize()}
      />
      <WinBtn
        label={isMax ? 'Restaureaza' : 'Maximizeaza'}
        icon={isMax ? <Minimize2 size={13} strokeWidth={2.4} /> : <Maximize2 size={13} strokeWidth={2.4} />}
        hoverBg={theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.05)'}
        hoverColor={theme.text}
        width={46}
        onClick={() => api.maximize()}
      />
      <WinBtn
        label="Inchide"
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
