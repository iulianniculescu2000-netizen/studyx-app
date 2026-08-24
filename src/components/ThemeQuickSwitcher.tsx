import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Sparkles } from 'lucide-react';
import { useTheme } from '../theme/ThemeContext';
import { useAdaptiveMotion } from '../hooks/useAdaptiveMotion';
import { useUserStore } from '../store/userStore';
import { THEME_LIST, type ThemeId } from '../theme/themes';
import Portal from './Portal';

/**
 * Quick UI-version + theme switcher, pinned in the sidebar's bottom bar next
 * to Settings — lets you jump between UI 2.0 (Glass) and any UI 1.0 theme
 * without leaving the current screen. Settings still has the full picker
 * with previews; this is the fast path.
 *
 * The dropdown renders through a Portal (fixed-positioned from the trigger's
 * rect) because the sidebar root has `overflow-hidden` for its collapse
 * animation — an inline absolute dropdown would get clipped at the edge.
 */
export default function ThemeQuickSwitcher({ collapsed }: { collapsed: boolean }) {
  const theme = useTheme();
  const { calmMotion, performanceLite } = useAdaptiveMotion();
  const { themeId, setTheme } = useUserStore();
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ left: 0, bottom: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    // menuPos is computed once from the trigger's rect when opening — a resize
    // (window resize, orientation change) leaves it pinned at stale coordinates,
    // detached from the trigger. Simplest correct fix: close instead of drifting.
    const onResize = () => setOpen(false);
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
    };
  }, [open]);

  const toggleOpen = () => {
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setMenuPos({
        left: collapsed ? rect.right + 10 : rect.left,
        bottom: window.innerHeight - rect.top + 8,
      });
    }
    setOpen((v) => !v);
  };

  const glassEntries = THEME_LIST.filter((entry) => entry.id === 'glass');
  const legacyEntries = THEME_LIST.filter((entry) => entry.id !== 'glass');
  const activeEntry = THEME_LIST.find((entry) => entry.id === themeId);

  const pick = (id: string) => {
    setTheme(id as ThemeId);
    setOpen(false);
  };

  const row = (entry: typeof THEME_LIST[number]) => {
    const active = themeId === entry.id;
    return (
      <button
        key={entry.id}
        onClick={() => pick(entry.id)}
        className="press-feedback flex w-full items-center gap-2.5 rounded-[12px] px-2.5 py-2 text-left transition-colors hover:bg-white/5"
        style={{ background: active ? `${theme.accent}14` : 'transparent' }}
      >
        <span
          className="h-6 w-6 flex-shrink-0 rounded-full border"
          style={{
            background: entry.id === 'auto' ? '#F2F2F7' : entry.bg,
            borderColor: theme.border2,
            boxShadow: `inset 0 0 0 1px ${entry.isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)'}`,
          }}
        />
        <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold" style={{ color: theme.text }}>
          {entry.name}
        </span>
        {active && (
          <span
            className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full text-[9px] font-black"
            style={{ background: `${theme.accent}22`, color: theme.accent }}
          >
            ✓
          </span>
        )}
      </button>
    );
  };

  return (
    <>
      <button
        ref={triggerRef}
        onClick={toggleOpen}
        aria-label="Schimbă tema (UI)"
        aria-expanded={open}
        className="press-feedback flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors hover:bg-white/5"
        style={{ color: theme.text3, justifyContent: collapsed ? 'center' : 'flex-start' }}
      >
        <span
          className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full text-[9px] font-black uppercase"
          style={{ background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})`, color: '#fff' }}
        >
          {activeEntry?.id === 'glass' ? '2' : '1'}
        </span>
        {!collapsed && (
          <>
            <span className="flex-1 truncate text-left" style={{ color: theme.text3 }}>UI</span>
            <ChevronDown size={13} style={{ transform: open ? 'rotate(180deg)' : undefined, transition: 'transform 0.18s' }} />
          </>
        )}
      </button>

      <Portal>
        <AnimatePresence>
          {open && (
            <motion.div
              ref={menuRef}
              initial={calmMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.97 }}
              animate={calmMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
              exit={calmMotion ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.97 }}
              transition={calmMotion ? { duration: 0.1 } : { duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
              className="glass-panel z-[9999] w-64 overflow-hidden rounded-[20px] p-2"
              style={{
                position: 'fixed',
                left: menuPos.left,
                bottom: menuPos.bottom,
                border: `1px solid ${theme.border}`,
                boxShadow: '0 24px 60px rgba(0,0,0,0.32)',
                background: theme.isDark ? 'rgba(24,22,30,0.96)' : 'rgba(255,255,255,0.97)',
                backdropFilter: performanceLite ? 'blur(10px)' : 'blur(24px) saturate(160%)',
              }}
            >
              <div className="mb-1.5 flex items-center gap-1.5 px-2 pt-1">
                <Sparkles size={11} style={{ color: theme.accent }} />
                <span className="text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: theme.accent }}>UI 2.0</span>
                <span className="rounded-full px-1.5 py-0.5 text-[8.5px] font-black uppercase tracking-wider" style={{ background: `${theme.accent}18`, color: theme.accent }}>Nou</span>
              </div>
              <div className="mb-2 space-y-0.5">
                {glassEntries.map(row)}
              </div>

              <div className="my-1.5 h-px" style={{ background: theme.border }} />

              <div className="mb-1.5 px-2 pt-1 text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: theme.text3, opacity: 0.65 }}>
                UI 1.0
              </div>
              <div className="space-y-0.5">
                {legacyEntries.map(row)}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Portal>
    </>
  );
}
