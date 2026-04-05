import { motion, AnimatePresence } from 'framer-motion';
import { Link, useLocation } from 'react-router-dom';
import { BookOpen, Plus, Home, Palette, X, LogOut } from 'lucide-react';
import { useState } from 'react';
import { useTheme } from '../theme/ThemeContext';
import { useUserStore } from '../store/userStore';
import { THEME_LIST, type Theme, type ThemeId } from '../theme/themes';

export default function Navbar() {
  const location = useLocation();
  const theme = useTheme();
  const { username, themeId, setTheme, logout } = useUserStore();
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const isActive = (path: string) => location.pathname === path;
  const avatarLetter = username?.charAt(0).toUpperCase() ?? '?';

  return (
    <>
      <motion.nav
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="fixed top-0 left-0 right-0 z-50 glass-panel premium-shadow"
      >
        <div className="px-6 py-3 flex items-center justify-between"
          style={{ background: theme.navBg, borderBottom: `1px solid ${theme.border}` }}>

          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-white text-sm"
              style={{ background: `linear-gradient(135deg, ${theme.accent} 0%, ${theme.accent2} 100%)` }}>
              S
            </div>
            <span className="font-semibold text-lg tracking-tight" style={{ color: theme.text }}>StudyX</span>
          </Link>

          {/* Nav links */}
          <div className="flex items-center gap-1">
            <NavLink to="/" label="Acasă" icon={<Home size={15} />} active={isActive('/')} theme={theme} />
            <NavLink to="/quizzes" label="Grile" icon={<BookOpen size={15} />} active={isActive('/quizzes')} theme={theme} />
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {/* New quiz CTA */}
            <Link to="/create"
              className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium text-white"
              style={{ background: `linear-gradient(135deg, ${theme.accent} 0%, ${theme.accent2} 100%)` }}>
              <Plus size={15} />
              <span className="hidden sm:inline">Grilă nouă</span>
            </Link>

            {/* Theme button */}
            <button
              onClick={() => { setShowThemePicker(!showThemePicker); setShowUserMenu(false); }}
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-all"
              style={{ background: showThemePicker ? theme.surface2 : theme.surface, border: `1px solid ${theme.border}`, color: theme.text2 }}
              title="Schimbă tema"
            >
              <Palette size={16} />
            </button>

            {/* Avatar */}
            <button
              onClick={() => { setShowUserMenu(!showUserMenu); setShowThemePicker(false); }}
              className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white text-sm transition-all"
              style={{ background: `linear-gradient(135deg, ${theme.accent} 0%, ${theme.accent2} 100%)` }}
            >
              {avatarLetter}
            </button>
          </div>
        </div>
      </motion.nav>

      {/* Theme picker dropdown */}
      <AnimatePresence>
        {showThemePicker && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowThemePicker(false)} />
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="fixed top-16 right-6 z-50 w-72 rounded-2xl p-4 shadow-2xl"
              style={{ background: theme.isDark ? 'rgba(20,20,22,0.95)' : 'rgba(255,255,255,0.95)', border: `1px solid ${theme.border}`, backdropFilter: 'blur(30px)' }}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold" style={{ color: theme.text }}>Temă vizuală</span>
                <button onClick={() => setShowThemePicker(false)} style={{ color: theme.text3 }}>
                  <X size={15} />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {THEME_LIST.map((t) => (
                  <motion.button key={t.id}
                    whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                    onClick={() => { setTheme(t.id as ThemeId); setShowThemePicker(false); }}
                    className="p-2 rounded-xl text-center transition-all"
                    style={{
                      background: themeId === t.id ? `${theme.accent}20` : theme.surface,
                      border: `1px solid ${themeId === t.id ? theme.accent : theme.border}`,
                    }}>
                    <div className="w-full h-8 rounded-lg mb-1.5 overflow-hidden relative" style={{ background: t.bg }}>
                      <div className="absolute inset-0" style={{ background: `radial-gradient(circle at 30% 50%, ${t.orb1}, transparent)` }} />
                    </div>
                    <p className="text-xs font-medium" style={{ color: theme.text }}>{t.emoji} {t.name}</p>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* User menu dropdown */}
      <AnimatePresence>
        {showUserMenu && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="fixed top-16 right-6 z-50 w-52 rounded-2xl p-3 shadow-2xl"
              style={{ background: theme.isDark ? 'rgba(20,20,22,0.95)' : 'rgba(255,255,255,0.95)', border: `1px solid ${theme.border}`, backdropFilter: 'blur(30px)' }}
            >
              <div className="flex items-center gap-3 p-2 mb-2">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white"
                  style={{ background: `linear-gradient(135deg, ${theme.accent} 0%, ${theme.accent2} 100%)` }}>
                  {avatarLetter}
                </div>
                <div>
                  <p className="font-semibold text-sm" style={{ color: theme.text }}>{username}</p>
                  <p className="text-xs" style={{ color: theme.text3 }}>StudyX</p>
                </div>
              </div>
              <div style={{ height: 1, background: theme.border, margin: '4px 0 8px' }} />
              <button
                onClick={() => { logout(); setShowUserMenu(false); }}
                className="w-full flex items-center gap-2 p-2 rounded-xl text-sm transition-all hover:opacity-80"
                style={{ color: theme.danger, background: `${theme.danger}10` }}
              >
                <LogOut size={14} />
                Schimbă utilizatorul
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

function NavLink({ to, label, icon, active, theme }: {
  to: string; label: string; icon: React.ReactNode; active: boolean; theme: Theme;
}) {
  return (
    <Link to={to}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-all"
      style={{
        color: active ? theme.text : theme.text2,
        background: active ? theme.surface2 : 'transparent',
      }}>
      {icon} {label}
    </Link>
  );
}
