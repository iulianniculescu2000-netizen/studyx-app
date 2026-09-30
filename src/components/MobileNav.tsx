/**
 * Bottom tab bar for the web/PWA build on phones.
 * The desktop Sidebar is `display:none` under 640px, which hides every nav
 * link — this restores navigation to the primary destinations on mobile.
 * Renders nothing on wider viewports (where the Sidebar handles navigation).
 */
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, ListChecks, Layers, BarChart3, Settings } from 'lucide-react';
import { useTheme } from '../theme/ThemeContext';
import { useViewportProfile } from '../hooks/useViewportProfile';
import { useAdaptiveMotion } from '../hooks/useAdaptiveMotion';

const TABS = [
  { to: '/', label: 'Acasă', icon: Home },
  { to: '/quizzes', label: 'Grile', icon: ListChecks },
  { to: '/flashcards', label: 'Carduri', icon: Layers },
  { to: '/stats', label: 'Statistici', icon: BarChart3 },
  { to: '/settings', label: 'Setări', icon: Settings },
] as const;

function isActive(pathname: string, to: string): boolean {
  if (to === '/') return pathname === '/';
  return pathname === to || pathname.startsWith(`${to}/`);
}

export default function MobileNav() {
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const { mobile } = useViewportProfile();
  const { calmMotion } = useAdaptiveMotion();

  if (!mobile) return null;

  return (
    <nav
      className="studyx-mobile-nav"
      style={{
        position: 'fixed',
        left: 14,
        right: 14,
        bottom: 'calc(14px + env(safe-area-inset-bottom, 0px))',
        zIndex: 900,
        height: 64,
        display: 'flex',
        alignItems: 'stretch',
        justifyContent: 'space-around',
        background: theme.isDark ? 'rgba(28,28,32,0.72)' : theme.navBg,
        border: `1px solid ${theme.border}`,
        borderRadius: 28,
        backdropFilter: 'blur(22px) saturate(150%)',
        WebkitBackdropFilter: 'blur(22px) saturate(150%)',
        boxShadow: theme.isDark
          ? '0 18px 40px rgba(0,0,0,0.45)'
          : '0 18px 36px rgba(15,23,42,0.14)',
      }}
    >
      {TABS.map(({ to, label, icon: Icon }) => {
        const active = isActive(location.pathname, to);
        return (
          <button
            key={to}
            type="button"
            onClick={() => navigate(to)}
            aria-label={label}
            aria-current={active ? 'page' : undefined}
            className="press-feedback hover:bg-[var(--hover-fill)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 3,
              margin: '8px 4px',
              borderRadius: 18,
              background: active ? 'var(--accent-soft)' : undefined,
              border: `1px solid ${active ? `${theme.accent}30` : 'transparent'}`,
              boxShadow: active ? `0 4px 14px ${theme.accent}26` : undefined,
              cursor: 'pointer',
              color: active ? theme.accent : theme.text3,
              transition: calmMotion ? 'none' : 'color 0.3s ease, background-color 0.5s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            <Icon size={21} strokeWidth={active ? 2.6 : 2} />
            <span
              style={{
                fontSize: 10,
                fontWeight: active ? 800 : 600,
                letterSpacing: '-0.01em',
              }}
            >
              {label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
