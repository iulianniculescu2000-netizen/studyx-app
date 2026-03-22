import { createContext, useContext, useEffect, useState, useRef, type ReactNode } from 'react';
import { THEMES, type Theme, type ThemeId } from './themes';
import { useUserStore } from '../store/userStore';

const ThemeContext = createContext<Theme>(THEMES.obsidian);

function useOSDark() {
  const [dark, setDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return dark;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const themeId = useUserStore((s) => s.themeId);
  const osDark = useOSDark();
  const resolved: ThemeId = themeId === 'auto' ? (osDark ? 'obsidian' : 'pearl') : themeId;
  const theme = THEMES[resolved] ?? THEMES.obsidian;
  const prevThemeRef = useRef<ThemeId | null>(null);
  const [ripple, setRipple] = useState<{ color: string; key: number } | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--bg', theme.bg);
    root.style.setProperty('--surface', theme.surface);
    root.style.setProperty('--surface2', theme.surface2);
    root.style.setProperty('--border', theme.border);
    root.style.setProperty('--border2', theme.border2);
    root.style.setProperty('--text', theme.text);
    root.style.setProperty('--text2', theme.text2);
    root.style.setProperty('--text3', theme.text3);
    root.style.setProperty('--accent', theme.accent);
    root.style.setProperty('--accent2', theme.accent2);
    root.style.setProperty('--success', theme.success);
    root.style.setProperty('--danger', theme.danger);
    root.style.setProperty('--warning', theme.warning);
    root.style.setProperty('--nav-bg', theme.navBg);
    root.style.setProperty('--input-bg', theme.inputBg);
    document.body.style.background = theme.bg;
    document.body.style.color = theme.text;

    // Trigger circular ripple when theme changes (not on first mount)
    if (prevThemeRef.current && prevThemeRef.current !== resolved) {
      setRipple({ color: theme.bg, key: Date.now() });
      setTimeout(() => setRipple(null), 700);
    }
    prevThemeRef.current = resolved;
  }, [theme, resolved]);

  return (
    <ThemeContext.Provider value={theme}>
      {children}
      {/* Circular ripple overlay on theme switch */}
      {ripple && (
        <div
          key={ripple.key}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: ripple.color,
              animation: 'theme-ripple 0.65s cubic-bezier(0.4, 0, 0.2, 1) forwards',
            }}
          />
        </div>
      )}
    </ThemeContext.Provider>
  );
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}

export type { ThemeId };
