import { createContext, useContext, useEffect, useState, useRef, type ReactNode, useLayoutEffect } from 'react';
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

  // Folosim useLayoutEffect pentru a aplica schimbarile inainte de randare
  useLayoutEffect(() => {
    const applyTheme = () => {
      const root = document.documentElement;
      
      const vars = {
        '--bg': theme.bg,
        '--surface': theme.surface,
        '--surface2': theme.surface2,
        '--border': theme.border,
        '--border2': theme.border2,
        '--text': theme.text,
        '--text2': theme.text2,
        '--text3': theme.text3,
        '--accent': theme.accent,
        '--accent2': theme.accent2,
        '--success': theme.success,
        '--danger': theme.danger,
        '--warning': theme.warning,
        '--nav-bg': theme.navBg,
        '--input-bg': theme.inputBg,
        '--glass-bg': theme.isDark ? 'rgba(28,28,30,0.65)' : 'rgba(255,255,255,0.72)',
      };

      Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v));
      root.setAttribute('data-theme', theme.isDark ? 'dark' : 'light');
      document.body.style.background = theme.bg;
      document.body.style.color = theme.text;
    };

    // Premium View Transitions API (Chrome 111+ / Electron 25+)
    if (
      prevThemeRef.current && 
      prevThemeRef.current !== resolved && 
      'startViewTransition' in document
    ) {
      (document as unknown as { startViewTransition: (cb: () => void) => void }).startViewTransition(() => {
        applyTheme();
      });
    } else {
      // Fallback instantaneu pentru viteza maxima
      applyTheme();
    }

    prevThemeRef.current = resolved;
  }, [theme, resolved]);

  return (
    <ThemeContext.Provider value={theme}>
      {children}
    </ThemeContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme(): Theme {
  return useContext(ThemeContext);
}

export type { ThemeId };
