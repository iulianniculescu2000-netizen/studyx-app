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

function usePerformanceProfile() {
  const getProfile = () => {
    if (typeof window === 'undefined') return 'full' as const;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const smallViewport = window.innerWidth < 1280 || window.innerHeight < 820;
    const lowCpu = (navigator.hardwareConcurrency ?? 8) <= 4;
    const deviceMemory = 'deviceMemory' in navigator ? (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8 : 8;
    const lowMemory = deviceMemory <= 4;
    return reducedMotion || smallViewport || lowCpu || lowMemory ? 'lite' as const : 'full' as const;
  };

  const [profile, setProfile] = useState<'full' | 'lite'>(getProfile);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setProfile(getProfile());
    mq.addEventListener('change', update);
    window.addEventListener('resize', update, { passive: true });
    return () => {
      mq.removeEventListener('change', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  return profile;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const themeId = useUserStore((s) => s.themeId);
  const osDark = useOSDark();
  const performanceProfile = usePerformanceProfile();
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
        '--glass-panel': theme.isDark
          ? 'linear-gradient(180deg, rgba(38,38,42,0.72), rgba(28,28,30,0.58))'
          : `linear-gradient(180deg, color-mix(in srgb, ${theme.surface} 96%, rgba(255,255,255,0.95)), color-mix(in srgb, ${theme.surface2} 94%, rgba(255,255,255,0.55)))`,
        '--glass-panel-strong': theme.isDark
          ? 'linear-gradient(180deg, rgba(44,44,48,0.88), rgba(30,30,33,0.78))'
          : `linear-gradient(180deg, color-mix(in srgb, ${theme.modalBg} 96%, rgba(255,255,255,0.98)), color-mix(in srgb, ${theme.surface2} 88%, rgba(255,255,255,0.92)))`,
        '--glass-border': theme.isDark ? 'rgba(255,255,255,0.12)' : `color-mix(in srgb, ${theme.border2} 74%, rgba(255,255,255,0.55))`,
        '--glass-highlight': theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.9)',
        '--shadow-color': theme.isDark ? 'rgba(0,0,0,0.42)' : 'rgba(26,33,56,0.10)',
        '--shadow-color-soft': theme.isDark ? 'rgba(0,0,0,0.24)' : 'rgba(26,33,56,0.055)',
        '--focus-ring': theme.isDark ? 'rgba(10,132,255,0.38)' : `color-mix(in srgb, ${theme.accent} 26%, transparent)`,
        '--selection': theme.accent,
        '--shell-gutter': performanceProfile === 'lite' ? '18px' : '24px',
        '--shell-curve': performanceProfile === 'lite' ? '24px' : '32px',
      };

      Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v));
      root.setAttribute('data-theme', theme.isDark ? 'dark' : 'light');
      root.setAttribute('data-performance', performanceProfile);
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
  }, [theme, resolved, performanceProfile]);

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
