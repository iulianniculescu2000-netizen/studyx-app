/**
 * Mini animated walkthrough for the Rezidențiat page — same shell pattern as
 * WhatsNewTour (self-playing per-slide demo, dot nav, arrows), but scoped to
 * this one page instead of a whole-app "what's new" tour. Auto-opens once,
 * replayable via the "?" button next to the page title.
 */
import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Bot,
  Check,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  X,
  Zap,
} from 'lucide-react';
import { useTheme } from '../theme/ThemeContext';
import { useOverlayFlag } from '../hooks/useOverlayFlag';

const SEEN_KEY = 'studyx:tutorial:rezidentiat:v1:seen';
export const REZIDENTIAT_TUTORIAL_OPEN_EVENT = 'studyx:rezidentiat-tutorial:open';

type Theme = ReturnType<typeof useTheme>;

function DemoFrame({ theme, children }: { theme: Theme; children: React.ReactNode }) {
  return (
    <div
      className="relative mx-auto flex h-[190px] w-full max-w-[420px] items-center justify-center overflow-hidden rounded-[24px] border"
      style={{
        background: theme.isDark
          ? 'linear-gradient(160deg, rgba(255,255,255,0.045), rgba(255,255,255,0.012))'
          : 'linear-gradient(160deg, rgba(255,255,255,0.9), rgba(244,246,255,0.7))',
        borderColor: theme.border,
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.07), 0 18px 44px ${theme.accent}12`,
      }}
    >
      {children}
    </div>
  );
}

function HeroDemo({ theme }: { theme: Theme }) {
  return (
    <DemoFrame theme={theme}>
      <motion.div
        animate={{ scale: [1, 1.08, 1], rotate: [0, -4, 4, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        className="flex h-20 w-20 items-center justify-center rounded-[24px]"
        style={{ background: theme.accent, boxShadow: `0 18px 40px ${theme.accent}45` }}
      >
        <Stethoscope size={34} color="#fff" />
      </motion.div>
    </DemoFrame>
  );
}

function ChaptersDemo({ theme }: { theme: Theme }) {
  const [active, setActive] = useState<'discuss' | 'generate'>('discuss');
  useEffect(() => {
    const id = window.setInterval(() => setActive((a) => (a === 'discuss' ? 'generate' : 'discuss')), 1500);
    return () => window.clearInterval(id);
  }, []);
  return (
    <DemoFrame theme={theme}>
      <div className="w-full max-w-[340px] rounded-[16px] border px-4 py-3" style={{ background: theme.surface2, borderColor: theme.border }}>
        <div className="flex items-center gap-2.5 mb-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-[10px]" style={{ background: theme.surface, color: theme.accent }}>
            <BookOpen size={14} />
          </div>
          <div className="min-w-0">
            <div className="truncate text-[11px] font-black" style={{ color: theme.text }}>Traumatologie</div>
            <div className="text-[9px] font-medium" style={{ color: theme.text3 }}>36 fragmente</div>
          </div>
        </div>
        <div className="flex gap-2">
          <motion.div
            animate={{ scale: active === 'discuss' ? 1.04 : 1 }}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-[10px] py-2 text-[9.5px] font-black uppercase tracking-wide"
            style={{
              background: active === 'discuss' ? theme.surface : 'transparent',
              border: `1px solid ${active === 'discuss' ? theme.border2 : theme.border}`,
              color: theme.text2,
            }}
          >
            <MessageCircle size={11} /> Discută
          </motion.div>
          <motion.div
            animate={{ scale: active === 'generate' ? 1.04 : 1 }}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-[10px] py-2 text-[9.5px] font-black uppercase tracking-wide"
            style={{
              background: active === 'generate' ? `${theme.accent}18` : 'transparent',
              border: `1px solid ${active === 'generate' ? `${theme.accent}40` : theme.border}`,
              color: active === 'generate' ? theme.accent : theme.text2,
            }}
          >
            <Sparkles size={11} /> Generează grile
          </motion.div>
        </div>
      </div>
    </DemoFrame>
  );
}

function RealBankDemo({ theme }: { theme: Theme }) {
  return (
    <DemoFrame theme={theme}>
      <div className="w-full max-w-[320px] rounded-[16px] border p-4" style={{ background: theme.surface2, borderColor: theme.border }}>
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-[10px] font-black" style={{ color: theme.text }}>Boli hepatice</span>
          <motion.span
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, type: 'spring', stiffness: 260, damping: 18 }}
            className="rounded-full px-2 py-0.5 text-[8px] font-black uppercase tracking-wider"
            style={{ background: `${theme.danger}18`, color: theme.danger }}
          >
            Scor cu penalizare
          </motion.span>
        </div>
        <div className="space-y-1.5">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 * i }}
              className="flex items-center gap-2 rounded-[8px] px-2.5 py-1.5"
              style={{ background: i === 0 ? `${theme.success}18` : theme.surface }}
            >
              {i === 0 && <Check size={11} style={{ color: theme.success }} />}
              <div className="h-1.5 flex-1 rounded-full" style={{ background: i === 0 ? `${theme.success}40` : `${theme.text3}25`, width: `${80 - i * 12}%` }} />
            </motion.div>
          ))}
        </div>
        <div className="mt-2.5 text-[9px] font-semibold" style={{ color: theme.text3 }}>~2050 de grile verificate din bibliografia oficială</div>
      </div>
    </DemoFrame>
  );
}

function DedicatedAiDemo({ theme }: { theme: Theme }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setShown(true), 400);
    return () => window.clearTimeout(id);
  }, []);
  return (
    <DemoFrame theme={theme}>
      <div className="w-full max-w-[340px] space-y-2">
        <div className="flex justify-end">
          <div className="max-w-[75%] rounded-[14px] rounded-tr-[4px] px-3 py-1.5 text-[10px] font-semibold text-white" style={{ background: theme.accent }}>
            Ce e mai probabil să apară la examen aici?
          </div>
        </div>
        <AnimatePresence>
          {shown && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex justify-start"
            >
              <div className="max-w-[85%] rounded-[14px] rounded-tl-[4px] border px-3 py-2" style={{ background: theme.surface2, borderColor: theme.border }}>
                <div className="flex items-center gap-1.5 mb-1 text-[8px] font-black uppercase tracking-wider" style={{ color: theme.accent }}>
                  <Bot size={10} /> AI Rezidențiat
                </div>
                <div className="space-y-1">
                  {[95, 80, 60].map((w, i) => (
                    <div key={i} className="h-[5px] rounded-full" style={{ width: `${w}%`, background: `${theme.text3}30` }} />
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </DemoFrame>
  );
}

type Slide = {
  id: string;
  badge: string;
  title: string;
  description: string;
  Demo: (props: { theme: Theme }) => ReactElement;
};

const SLIDES: Slide[] = [
  {
    id: 'hero',
    badge: 'Bun venit',
    title: 'Rezidențiat, totul într-un singur loc',
    description: 'Cărțile tale de bibliografie, o bancă reală de grile verificate și un AI care știe exact pe ce te pregătești — nu un chat generic.',
    Demo: HeroDemo,
  },
  {
    id: 'chapters',
    badge: 'Cărțile tale',
    title: 'Discută sau generează grile, pe capitol',
    description: 'Fiecare capitol indexat din cărțile tale are două acțiuni rapide: discuți cu AI-ul despre el, sau îi ceri să genereze grile direct din conținutul lui.',
    Demo: ChaptersDemo,
  },
  {
    id: 'bank',
    badge: 'Conținut real',
    title: '~2050 de grile reale, verificate',
    description: 'Extrase din bibliografia oficială (Lawrence + Kumar), cu răspunsul corect confirmat din cheia cărții — nu inventate de AI. Scorare reală de examen: -0,25 pentru fiecare răspuns greșit bifat.',
    Demo: RealBankDemo,
  },
  {
    id: 'dedicated-ai',
    badge: 'AI dedicat',
    title: 'Aici AI-ul răspunde ca la rezidențiat, nu generic',
    description: 'Discuțiile și grilele generate din această pagină sunt calibrate pe formatul examenului real: 5 variante A-E, stil de enunț oficial, focus pe ce chiar contează pentru concurs.',
    Demo: DedicatedAiDemo,
  },
];

export default function RezidentiatTutorial() {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  useOverlayFlag(open);

  const slide = SLIDES[index];
  const isLast = index === SLIDES.length - 1;
  const isFirst = index === 0;

  useEffect(() => {
    let seen = false;
    try { seen = localStorage.getItem(SEEN_KEY) === '1'; } catch { /* ignore */ }
    if (seen) return;
    let cancelled = false;
    let timer: number;
    // Defers behind any other fullscreen overlay (WhatsNewTour on a brand-new
    // profile's first visit, most notably) instead of popping open on top of
    // it — both use the same z-index, so stacking them reads as a UI glitch.
    const tryOpen = () => {
      if (cancelled) return;
      if (document.documentElement.dataset.overlay === 'open') {
        timer = window.setTimeout(tryOpen, 400);
        return;
      }
      setOpen(true);
    };
    timer = window.setTimeout(tryOpen, 500);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, []);

  useEffect(() => {
    const handler = () => { setIndex(0); setDirection(1); setOpen(true); };
    window.addEventListener(REZIDENTIAT_TUTORIAL_OPEN_EVENT, handler);
    return () => window.removeEventListener(REZIDENTIAT_TUTORIAL_OPEN_EVENT, handler);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    try { localStorage.setItem(SEEN_KEY, '1'); } catch { /* ignore */ }
  }, []);

  const go = useCallback((delta: number) => {
    setDirection(delta);
    setIndex((current) => Math.min(SLIDES.length - 1, Math.max(0, current + delta)));
  }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') go(1);
      else if (event.key === 'ArrowLeft') go(-1);
      else if (event.key === 'Escape') close();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, go, close]);

  const slideVariants = useMemo(() => ({
    enter: (dir: number) => ({ opacity: 0, x: dir * 56, scale: 0.985 }),
    center: { opacity: 1, x: 0, scale: 1 },
    exit: (dir: number) => ({ opacity: 0, x: dir * -56, scale: 0.985 }),
  }), []);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[10010] flex items-center justify-center p-5"
          style={{ background: 'rgba(8,8,14,0.55)', backdropFilter: 'blur(14px) saturate(130%)' }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ type: 'spring', stiffness: 280, damping: 26 }}
            className="relative flex w-full max-w-[560px] flex-col overflow-hidden rounded-[32px] border"
            style={{
              background: theme.isDark ? 'rgba(20,20,28,0.97)' : 'rgba(253,253,255,0.98)',
              borderColor: theme.border,
              boxShadow: `0 40px 110px rgba(0,0,0,0.45), 0 0 0 1px ${theme.accent}10, 0 18px 50px ${theme.accent}18`,
            }}
          >
            <div
              className="pointer-events-none absolute -top-28 left-1/2 h-56 w-[480px] -translate-x-1/2 rounded-full opacity-40 blur-[80px]"
              style={{ background: theme.accent }}
            />

            <div className="relative z-10 flex items-center justify-between px-7 pt-6">
              <div className="flex items-center gap-2.5">
                <motion.div
                  animate={{ rotate: [0, 12, -8, 0] }}
                  transition={{ repeat: Infinity, duration: 5, repeatDelay: 1.5 }}
                  className="flex h-9 w-9 items-center justify-center rounded-[13px] text-white"
                  style={{ background: theme.accent, boxShadow: `0 10px 22px ${theme.accent}44` }}
                >
                  <ShieldCheck size={17} />
                </motion.div>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: theme.accent }}>
                    Tur rapid
                  </div>
                  <div className="text-[13px] font-black tracking-tight" style={{ color: theme.text }}>
                    Secțiunea Rezidențiat
                  </div>
                </div>
              </div>
              <button
                onClick={close}
                aria-label="Închide tutorialul"
                className="rounded-[12px] p-2 transition-colors hover:bg-white/5"
                style={{ color: theme.text3 }}
              >
                <X size={18} />
              </button>
            </div>

            <div className="relative z-10 px-7 pb-2 pt-5">
              <AnimatePresence mode="wait" custom={direction} initial={false}>
                <motion.div
                  key={slide.id}
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                >
                  <slide.Demo theme={theme} />

                  <div className="mt-5 text-center">
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em]"
                      style={{ background: `${theme.accent}12`, borderColor: `${theme.accent}30`, color: theme.accent }}
                    >
                      <Sparkles size={10} />
                      {slide.badge}
                    </span>
                    <h2 className="mt-3 text-[1.4rem] font-black leading-tight tracking-tight" style={{ color: theme.text }}>
                      {slide.title}
                    </h2>
                    <p className="mx-auto mt-2.5 max-w-[440px] text-[13px] font-medium leading-relaxed" style={{ color: theme.text2 }}>
                      {slide.description}
                    </p>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="relative z-10 flex items-center justify-between px-7 pb-6 pt-3">
              <button
                onClick={() => go(-1)}
                disabled={isFirst}
                aria-label="Slide anterior"
                className="flex h-10 w-10 items-center justify-center rounded-[14px] border transition-all disabled:opacity-30"
                style={{ background: theme.surface2, borderColor: theme.border, color: theme.text2 }}
              >
                <ArrowLeft size={16} />
              </button>

              <div className="flex items-center gap-2">
                {SLIDES.map((entry, i) => (
                  <button
                    key={entry.id}
                    onClick={() => { setDirection(i > index ? 1 : -1); setIndex(i); }}
                    aria-label={`Slide ${i + 1}`}
                    className="rounded-full transition-all"
                    style={{
                      width: i === index ? 22 : 7,
                      height: 7,
                      background: i === index ? theme.accent : `${theme.text3}38`,
                    }}
                  />
                ))}
              </div>

              {isLast ? (
                <motion.button
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={close}
                  className="flex h-10 items-center gap-2 rounded-[14px] px-5 text-[12px] font-black text-white"
                  style={{ background: theme.accent, boxShadow: `0 12px 26px ${theme.accent}40` }}
                >
                  Am înțeles
                  <Zap size={14} />
                </motion.button>
              ) : (
                <button
                  onClick={() => go(1)}
                  aria-label="Slide următor"
                  className="flex h-10 w-10 items-center justify-center rounded-[14px] text-white transition-all"
                  style={{ background: theme.accent, boxShadow: `0 10px 22px ${theme.accent}38` }}
                >
                  <ArrowRight size={16} />
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
