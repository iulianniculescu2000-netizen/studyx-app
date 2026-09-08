import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';
import { ArrowRight, Sparkles, Check, ChevronLeft } from 'lucide-react';
import { useUserStore } from '../store/userStore';
import { useTheme } from '../theme/ThemeContext';
import { THEME_LIST, type ThemeId } from '../theme/themes';
import Logo from '../components/Logo';

interface Props {
  onBack?: () => void;
}

// A few real first names to cycle through as the placeholder — a static
// "ex: Alexandru" read as a form field; a name that quietly changes every
// few seconds reads as an invitation, without ever competing with what the
// user is actually typing (only runs while the field is empty AND unfocused).
const NAME_EXAMPLES = ['Alexandru', 'Maria', 'Andrei', 'Ioana', 'Ștefan', 'Elena'];

export default function Welcome({ onBack }: Props) {
  const { setUsername, setTheme, themeId } = useUserStore();
  const theme = useTheme();
  const [name, setName] = useState('');
  const [step, setStep] = useState<'name' | 'theme'>('name');
  const [error, setError] = useState('');
  const [inputFocused, setInputFocused] = useState(false);
  const [shake, setShake] = useState(false);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);

  useEffect(() => {
    if (name || inputFocused) return undefined;
    const id = window.setInterval(() => setPlaceholderIndex((i) => (i + 1) % NAME_EXAMPLES.length), 2200);
    return () => window.clearInterval(id);
  }, [name, inputFocused]);
  // 'glass' is the only UI 2.0 entry in THEME_LIST — everything else (bigsur,
  // obsidian, pearl, aurora, midnight, amber, auto) is UI 1.0, same split as
  // ThemeQuickSwitcher already uses in the sidebar.
  const [uiGen, setUiGen] = useState<'v2' | 'v1'>(() => (themeId === 'glass' ? 'v2' : 'v1'));
  const glassEntries = THEME_LIST.filter((entry) => entry.id === 'glass');
  const legacyEntries = THEME_LIST.filter((entry) => entry.id !== 'glass');
  const visibleThemes = uiGen === 'v2' ? glassEntries : legacyEntries;

  const handleGenChange = (gen: 'v2' | 'v1') => {
    setUiGen(gen);
    if (gen === 'v2') setTheme('glass');
    else if (themeId === 'glass') setTheme('obsidian');
  };

  const handleNameSubmit = () => {
    const trimmed = name.trim();
    if (trimmed.length < 2 || trimmed.length > 30) {
      setError(trimmed.length < 2 ? 'Cel puțin 2 caractere.' : 'Maxim 30 de caractere.');
      setShake(true);
      window.setTimeout(() => setShake(false), 420);
      return;
    }
    setError('');
    setStep('theme');
  };

  const handleFinish = () => {
    setUsername(name.trim());
  };

  const avatarLetter = name.trim().charAt(0).toUpperCase() || '?';
  const hasLetter = name.trim().length >= 1;

  return (
    <div className="min-h-screen flex flex-col items-center px-6 pt-12 pb-10 relative"
      style={{ background: theme.bg, overflowX: 'hidden' }}>

      {/* Ambient orbs */}
      <motion.div className="absolute rounded-full pointer-events-none"
        style={{ width: 700, height: 700, top: '-25%', left: '-20%', background: `radial-gradient(circle, ${theme.orb1} 0%, transparent 65%)`, filter: 'blur(80px)' }}
        animate={{ x: [0, 40, 0], y: [0, -30, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div className="absolute rounded-full pointer-events-none"
        style={{ width: 600, height: 600, bottom: '-15%', right: '-15%', background: `radial-gradient(circle, ${theme.orb2} 0%, transparent 65%)`, filter: 'blur(80px)' }}
        animate={{ x: [0, -30, 0], y: [0, 25, 0] }}
        transition={{ duration: 17, repeat: Infinity, ease: 'easeInOut', delay: 3 }}
      />
      <motion.div className="absolute rounded-full pointer-events-none"
        style={{ width: 400, height: 400, top: '40%', left: '60%', background: `radial-gradient(circle, ${theme.orb3} 0%, transparent 65%)`, filter: 'blur(60px)' }}
        animate={{ x: [0, 20, 0], y: [0, -15, 0] }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 6 }}
      />

      <div className="w-full max-w-md relative z-10">
        <AnimatePresence mode="wait">

          {/* ── Step 1: Name ──────────────────────────────────── */}
          {step === 'name' && (
            <motion.div key="name"
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -40, scale: 0.97 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            >
              {/* Back button (when adding a new profile) */}
              {onBack && (
                <motion.button
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  onClick={onBack}
                  className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[12.5px] font-bold mb-6 transition-all hover:opacity-80"
                  style={{ background: theme.surface2, border: `1px solid ${theme.border}`, color: theme.text2 }}>
                  <ChevronLeft size={15} />Înapoi la profiluri
                </motion.button>
              )}

              {/* Logo + title */}
              <div className="text-center mb-8">
                <motion.div
                  initial={{ scale: 0, rotate: -10 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 240, damping: 18, delay: 0.1 }}
                  className="mx-auto mb-5 flex items-center justify-center"
                >
                  <Logo size={80} />
                </motion.div>
                <motion.h1
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="text-4xl font-bold tracking-tight mb-1.5"
                  style={{ color: theme.text }}>
                  Bun venit la <span style={{ color: theme.accent }}>StudyX</span>
                </motion.h1>
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
                  style={{ color: theme.text2 }}>
                  Platforma ta de grile inteligente
                </motion.p>
              </div>

              {/* Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0, x: shake ? [0, -8, 8, -6, 6, -3, 3, 0] : 0 }}
                transition={shake ? { duration: 0.42, ease: 'easeInOut' } : { delay: 0.25 }}
                className="glass-panel rounded-3xl p-6 mb-4"
                style={{
                  boxShadow: inputFocused
                    ? `0 0 0 1.5px ${theme.accent}55, 0 20px 50px ${theme.accent}1f`
                    : undefined,
                  transition: 'box-shadow 0.35s ease',
                }}>

                {/* Live avatar preview */}
                <div className="flex items-center gap-4 mb-5">
                  <div className="relative flex-shrink-0">
                    <AnimatePresence mode="wait">
                      {hasLetter ? (
                        <motion.div
                          key={avatarLetter}
                          initial={{ scale: 0.5, opacity: 0, rotate: -8 }}
                          animate={{ scale: 1, opacity: 1, rotate: 0 }}
                          exit={{ scale: 0.5, opacity: 0 }}
                          transition={{ type: 'spring', stiffness: 420, damping: 16 }}
                          className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold text-white"
                          style={{
                            background: theme.accent,
                            boxShadow: `0 6px 20px ${theme.accent}35`,
                          }}>
                          {avatarLetter}
                        </motion.div>
                      ) : (
                        <motion.div
                          key="placeholder"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1, scale: inputFocused ? 1.05 : 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ scale: { type: 'spring', stiffness: 300, damping: 20 } }}
                          className="w-14 h-14 rounded-2xl flex items-center justify-center"
                          style={{
                            background: theme.surface2,
                            border: `2px dashed ${inputFocused ? theme.accent : theme.border2}`,
                            transition: 'border-color 0.3s ease',
                          }}>
                          <span className="text-xl" style={{ opacity: 0.3 }}>?</span>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <div className="flex-1 min-w-0">
                    <label className="text-xs font-semibold uppercase tracking-widest block mb-1.5"
                      style={{ color: inputFocused ? theme.accent : theme.text3, transition: 'color 0.25s ease' }}>
                      Cum te cheamă?
                    </label>
                    <div className="relative">
                      {/* Plain input, deliberately NOT remounted on placeholder cycling —
                          `autoFocus` re-fires on every mount, so swapping key here would
                          have stolen focus back every 2.2s even while the user was doing
                          something else entirely. The placeholder text just swaps in place. */}
                      <input
                        type="text"
                        placeholder={`ex: ${NAME_EXAMPLES[placeholderIndex]}`}
                        value={name}
                        onChange={(e) => { setName(e.target.value); setError(''); }}
                        onKeyDown={(e) => e.key === 'Enter' && handleNameSubmit()}
                        onFocus={() => setInputFocused(true)}
                        onBlur={() => setInputFocused(false)}
                        autoFocus
                        className="w-full text-xl font-semibold bg-transparent"
                        style={{ color: theme.text, outline: 'none', border: 'none' }}
                      />
                      {/* Focus glow — grows from the center instead of a static line, so
                          typing reads as a live conversation with the field, not a form. */}
                      <motion.div
                        className="absolute -bottom-1 left-0 right-0 origin-center rounded-full"
                        style={{ height: 2, background: theme.accent }}
                        initial={false}
                        animate={{ scaleX: inputFocused ? 1 : 0, opacity: inputFocused ? 1 : 0 }}
                        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                      />
                    </div>
                  </div>
                </div>

                {/* Divider */}
                <div style={{ height: 1, background: theme.border, marginBottom: 16 }} />

                {/* Instant "this is really you" feedback, before the next screen even says it. */}
                <AnimatePresence mode="wait">
                  {name.trim().length >= 2 && !error && (
                    <motion.p
                      key="live-greeting"
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className="text-sm font-semibold mb-2"
                      style={{ color: theme.accent }}>
                      Salut, {name.trim()}! 👋 Arată bine.
                    </motion.p>
                  )}
                </AnimatePresence>

                {/* Hint text */}
                <p className="text-xs" style={{ color: theme.text3 }}>
                  Numele tău va apărea în aplicație. Îl poți schimba oricând.
                </p>

                {error && (
                  <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                    className="text-sm mt-2" style={{ color: theme.danger }}>
                    ⚠ {error}
                  </motion.p>
                )}
              </motion.div>

              <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
                onClick={handleNameSubmit}
                whileHover={{ scale: 1.02, y: -1 }}
                whileTap={{ scale: 0.97 }}
                className="w-full py-4 rounded-2xl font-bold text-white flex items-center justify-center gap-2 transition-opacity"
                style={{
                  background: theme.accent,
                  boxShadow: `0 10px 30px ${theme.accent}35`,
                  opacity: name.trim().length < 2 ? 0.45 : 1,
                }}>
                Continuă <ArrowRight size={18} />
              </motion.button>
            </motion.div>
          )}

          {/* ── Step 2: Theme ────────────────────────────────── */}
          {step === 'theme' && (
            <motion.div key="theme"
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -40 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            >
              {/* ── Big Avatar Hero ── */}
              <div className="flex flex-col items-center mb-5">
                <div className="relative mb-4 mt-2">
                  {/* Rotating ring */}
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                    className="absolute rounded-full pointer-events-none"
                    style={{ inset: -10, border: `1.5px solid ${theme.accent}30`, borderRadius: '50%' }}
                  />
                  {/* Inner dashed ring */}
                  <motion.div
                    animate={{ rotate: -360 }}
                    transition={{ duration: 14, repeat: Infinity, ease: 'linear' }}
                    className="absolute rounded-full pointer-events-none"
                    style={{ inset: -4, border: `1px dashed ${theme.accent2}40`, borderRadius: '50%' }}
                  />

                  {/* Avatar bubble */}
                  <motion.div
                    initial={{ scale: 0, rotate: -10 }}
                    animate={{ scale: 1, rotate: 0, y: [0, -5, 0] }}
                    transition={{
                      scale: { type: 'spring', stiffness: 280, damping: 18 },
                      rotate: { type: 'spring', stiffness: 280, damping: 18 },
                      y: { duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 },
                    }}
                    className="relative w-24 h-24 rounded-full flex items-center justify-center"
                    style={{
                      background: theme.accent,
                      boxShadow: `0 16px 48px ${theme.accent}45, 0 0 0 4px ${theme.accent}18`,
                    }}>
                    <span className="text-4xl font-black text-white select-none"
                      style={{ textShadow: '0 2px 10px rgba(0,0,0,0.25)' }}>
                      {avatarLetter}
                    </span>
                  </motion.div>

                  {/* Bottom glow */}
                  <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-16 h-5 rounded-full pointer-events-none"
                    style={{ background: theme.accent, filter: 'blur(14px)', opacity: 0.3 }}
                  />
                </div>

                <motion.h2
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-2xl font-bold mb-0.5 tracking-tight"
                  style={{ color: theme.text }}>
                  Salut, {name.trim()}! 👋
                </motion.h2>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="text-sm"
                  style={{ color: theme.text2 }}>
                  Alege tema care ți se potrivește
                </motion.p>
              </div>

              {/* UI generation switch */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="flex justify-center mb-4">
                <div className="inline-flex rounded-2xl p-1 gap-1"
                  style={{ background: theme.surface2, border: `1px solid ${theme.border}` }}>
                  {([
                    { id: 'v2' as const, label: 'UI II · Glass', hint: 'Nou' },
                    { id: 'v1' as const, label: 'UI I · Clasic', hint: null },
                  ]).map((gen) => {
                    const active = uiGen === gen.id;
                    return (
                      <button
                        key={gen.id}
                        onClick={() => handleGenChange(gen.id)}
                        className="relative px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-1.5 transition-colors"
                        style={{ color: active ? '#fff' : theme.text3 }}>
                        {active && (
                          <motion.div
                            layoutId="ui-gen-pill"
                            className="absolute inset-0 rounded-xl"
                            style={{ background: theme.accent, boxShadow: `0 6px 18px ${theme.accent}40` }}
                            transition={{ type: 'spring', stiffness: 340, damping: 28 }}
                          />
                        )}
                        <span className="relative flex items-center gap-1.5">
                          {gen.id === 'v2' && <Sparkles size={13} />}
                          {gen.label}
                          {gen.hint && (
                            <span className="rounded-full px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider"
                              style={{ background: active ? 'rgba(255,255,255,0.25)' : `${theme.accent}18`, color: active ? '#fff' : theme.accent }}>
                              {gen.hint}
                            </span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </motion.div>

              {/* Theme grid */}
              <motion.div
                key={uiGen}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05, duration: 0.3 }}
                className={`grid gap-2.5 mb-5 ${uiGen === 'v2' ? 'grid-cols-1' : 'grid-cols-2'}`}>
                {visibleThemes.map((t, i) => {
                  const isActive = themeId === t.id;
                  return (
                    <motion.button
                      key={t.id}
                      initial={{ opacity: 0, scale: 0.88 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.4 + i * 0.05, duration: 0.3 }}
                      onClick={() => setTheme(t.id as ThemeId)}
                      whileHover={{ scale: 1.025, y: -1 }}
                      whileTap={{ scale: 0.97 }}
                      className="p-3.5 rounded-2xl text-left transition-all relative overflow-hidden"
                      style={{
                        background: t.modalBg,
                        border: `2px solid ${isActive ? t.accent : t.border}`,
                        boxShadow: isActive ? `0 4px 20px ${t.accent}35` : '0 2px 8px rgba(0,0,0,0.10)',
                      }}>
                      {/* Mini preview */}
                      <div className="w-full h-8 rounded-xl mb-2.5 relative overflow-hidden"
                        style={{ background: t.bg }}>
                        <div className="absolute inset-0"
                          style={{ background: `radial-gradient(circle at 30% 50%, ${t.orb1}, transparent 60%), radial-gradient(circle at 70% 50%, ${t.orb2}, transparent 60%)`, opacity: 0.6 }} />
                        <div className="absolute bottom-1 left-2 right-6 h-1.5 rounded-full"
                          style={{ background: t.surface2 }} />
                        <div className="absolute bottom-1 right-2 w-4 h-1.5 rounded-full"
                          style={{ background: t.accent, opacity: 0.8 }} />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-base">{t.emoji}</span>
                        <span className="font-semibold text-sm" style={{ color: t.text }}>{t.name}</span>
                      </div>

                      {/* Check indicator */}
                      <AnimatePresence>
                        {isActive && (
                          <motion.div
                            key="check"
                            layoutId="theme-check"
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0 }}
                            className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full flex items-center justify-center"
                            style={{ background: t.accent }}>
                            <Check size={11} color="white" strokeWidth={3} />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.button>
                  );
                })}
              </motion.div>

              <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                onClick={handleFinish}
                whileHover={{ scale: 1.02, y: -1 }}
                whileTap={{ scale: 0.97 }}
                className="w-full py-4 rounded-2xl font-bold text-white flex items-center justify-center gap-2"
                style={{
                  background: theme.accent,
                  boxShadow: `0 10px 30px ${theme.accent}40`,
                }}>
                <Sparkles size={17} />
                Intră în StudyX
              </motion.button>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
