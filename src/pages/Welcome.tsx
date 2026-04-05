import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { ArrowRight, Sparkles, Check, ChevronLeft } from 'lucide-react';
import { useUserStore } from '../store/userStore';
import { useTheme } from '../theme/ThemeContext';
import { THEME_LIST, type ThemeId } from '../theme/themes';
import Logo from '../components/Logo';

interface Props {
  onBack?: () => void;
}

export default function Welcome({ onBack }: Props) {
  const { setUsername, setTheme, themeId } = useUserStore();
  const theme = useTheme();
  const [name, setName] = useState('');
  const [step, setStep] = useState<'name' | 'theme'>('name');
  const [error, setError] = useState('');

  const handleNameSubmit = () => {
    const trimmed = name.trim();
    if (trimmed.length < 2) { setError('Cel puțin 2 caractere.'); return; }
    if (trimmed.length > 30) { setError('Maxim 30 de caractere.'); return; }
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
                  className="flex items-center gap-1.5 text-sm mb-6 transition-opacity hover:opacity-80"
                  style={{ color: theme.text3 }}>
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
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="rounded-3xl p-6 mb-4"
                style={{ background: theme.surface, border: `1px solid ${theme.border}`, backdropFilter: 'blur(20px)' }}>

                {/* Live avatar preview */}
                <div className="flex items-center gap-4 mb-5">
                  <div className="relative flex-shrink-0">
                    <AnimatePresence>
                      {hasLetter ? (
                        <motion.div
                          key="avatar"
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0, opacity: 0 }}
                          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                          className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold text-white"
                          style={{
                            background: `linear-gradient(135deg, ${theme.accent} 0%, ${theme.accent2} 100%)`,
                            boxShadow: `0 6px 20px ${theme.accent}35`,
                          }}>
                          {avatarLetter}
                        </motion.div>
                      ) : (
                        <motion.div
                          key="placeholder"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="w-14 h-14 rounded-2xl flex items-center justify-center"
                          style={{ background: theme.surface2, border: `2px dashed ${theme.border2}` }}>
                          <span className="text-xl" style={{ opacity: 0.3 }}>?</span>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <div className="flex-1">
                    <label className="text-xs font-semibold uppercase tracking-widest block mb-1.5"
                      style={{ color: theme.text3 }}>
                      Cum te cheamă?
                    </label>
                    <input
                      type="text"
                      placeholder="ex: Alexandru"
                      value={name}
                      onChange={(e) => { setName(e.target.value); setError(''); }}
                      onKeyDown={(e) => e.key === 'Enter' && handleNameSubmit()}
                      autoFocus
                      className="w-full text-xl font-semibold bg-transparent"
                      style={{ color: theme.text, outline: 'none', border: 'none' }}
                    />
                  </div>
                </div>

                {/* Divider */}
                <div style={{ height: 1, background: theme.border, marginBottom: 16 }} />

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
                  background: `linear-gradient(135deg, ${theme.accent} 0%, ${theme.accent2} 100%)`,
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
                      background: `linear-gradient(135deg, ${theme.accent} 0%, ${theme.accent2} 100%)`,
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

              {/* Theme grid */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
                className="grid grid-cols-2 gap-2.5 mb-5">
                {THEME_LIST.map((t, i) => {
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
                  background: `linear-gradient(135deg, ${theme.accent} 0%, ${theme.accent2} 100%)`,
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
