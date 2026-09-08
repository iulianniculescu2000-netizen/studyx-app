import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  BookOpen,
  ImageIcon,
  MessageCircle,
  Pencil,
  Quote,
  Rocket,
  Sparkles,
  Stethoscope,
  Wand2,
  X,
  Zap,
} from 'lucide-react';
import { useTheme } from '../theme/ThemeContext';
import { useTutorialStore } from '../store/tutorialStore';
import { useUserStore } from '../store/userStore';
import { useOverlayFlag } from '../hooks/useOverlayFlag';

const WHATS_NEW_VERSION = '2.2.0';
// Bump the suffix when the tour content changes within the same app version, so
// users who already dismissed the previous tour see the new highlights once more.
const SEEN_KEY = `studyx:whatsnew:${WHATS_NEW_VERSION}-v22:seen`;

/** Force-open event (Settings → "Vezi noutățile" or dev preview). */
export const WHATS_NEW_OPEN_EVENT = 'studyx:whats-new:open';

type Theme = ReturnType<typeof useTheme>;

// ─────────────────────────────────────────────────────────────────────────────
// Mini live demos — each slide gets a looping, self-playing animation.
// ─────────────────────────────────────────────────────────────────────────────

function DemoFrame({ theme, children }: { theme: Theme; children: React.ReactNode }) {
  return (
    <div
      className="relative mx-auto flex h-[210px] w-full max-w-[420px] items-center justify-center overflow-hidden rounded-[26px] border"
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

/**
 * The icons used to "orbit" by animating x/y between three keyframes with an
 * easeInOut curve — which means they slowed to a stop and reversed twice per
 * cycle. That reads as stutter, not motion. A continuous rotation of the whole
 * ring (linear, one transform per element) is both genuinely smooth and cheaper
 * for the compositor; each icon counter-rotates so it stays upright.
 */
function HeroDemo({ theme }: { theme: Theme }) {
  const icons = [Bot, ImageIcon, Pencil, Quote, Zap, Wand2];
  const radiusX = 92;
  const radiusY = 58;

  return (
    <DemoFrame theme={theme}>
      <div className="relative flex h-full w-full items-center justify-center">
        {/* Glow pulses on opacity only; scaling a large box-shadow re-rasters it every frame. */}
        <motion.div
          animate={{ opacity: [0.35, 0.75, 0.35] }}
          transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
          className="absolute h-[120px] w-[120px] rounded-full"
          style={{ background: theme.accent, filter: 'blur(38px)', willChange: 'opacity' }}
        />
        <div
          className="z-10 flex h-[84px] w-[84px] items-center justify-center rounded-[26px] text-white"
          style={{ background: theme.accent }}
        >
          <Sparkles size={38} />
        </div>

        <motion.div
          className="absolute inset-0"
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 26, ease: 'linear' }}
          style={{ willChange: 'transform' }}
        >
          {icons.map((Icon, i) => {
            const angle = (i / icons.length) * Math.PI * 2;
            return (
              <motion.div
                key={i}
                className="absolute left-1/2 top-1/2 flex h-10 w-10 items-center justify-center rounded-[13px] border"
                style={{
                  marginLeft: -20,
                  marginTop: -20,
                  x: Math.cos(angle) * radiusX,
                  y: Math.sin(angle) * radiusY,
                  background: theme.surface2,
                  borderColor: theme.border,
                  color: theme.accent,
                  willChange: 'transform',
                }}
                animate={{ rotate: -360 }}
                transition={{ repeat: Infinity, duration: 26, ease: 'linear' }}
              >
                <Icon size={17} />
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </DemoFrame>
  );
}

/** Rezidențiat's real bank + library + isolated AI chat — three highlights cycling in place. */
function ResidencySectionDemo({ theme }: { theme: Theme }) {
  const rows = useMemo(
    () => [
      { Icon: Stethoscope, label: '~4200 grile reale, pe disciplină și specialitate' },
      { Icon: BookOpen, label: 'Kumar, Lawrence, Sinopsis — indexate pe capitol' },
      { Icon: MessageCircle, label: 'Chat AI complet izolat pe secțiune' },
    ],
    [],
  );
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setPhase((p) => (p + 1) % rows.length), 1500);
    return () => window.clearInterval(id);
  }, [rows.length]);

  return (
    <DemoFrame theme={theme}>
      <div className="w-full max-w-[340px] space-y-2 px-2">
        {rows.map((row, i) => {
          const active = i === phase;
          return (
            <motion.div
              key={row.label}
              animate={{ opacity: active ? 1 : 0.4, scale: active ? 1.02 : 1 }}
              className="flex items-center gap-2.5 rounded-[12px] border px-3 py-2.5"
              style={{
                background: active ? `${theme.accent}12` : theme.surface2,
                borderColor: active ? `${theme.accent}35` : theme.border,
              }}
            >
              <row.Icon size={14} style={{ color: active ? theme.accent : theme.text3 }} />
              <span className="text-[10.5px] font-bold" style={{ color: active ? theme.text : theme.text3 }}>{row.label}</span>
            </motion.div>
          );
        })}
      </div>
    </DemoFrame>
  );
}

/** The chat message used to freeze at pre-execution text; it now rewrites itself with the real outcome. */
function AgentOutcomeDemo({ theme }: { theme: Theme }) {
  const [after, setAfter] = useState(false);
  useEffect(() => {
    const id = window.setInterval(() => setAfter((v) => !v), 2000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <DemoFrame theme={theme}>
      <div className="w-full max-w-[300px]">
        <span
          className="mb-2 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[8px] font-black uppercase tracking-wider"
          style={{ background: after ? `${theme.success}18` : `${theme.warning}18`, color: after ? theme.success : theme.warning }}
        >
          {after ? 'acum' : 'înainte'}
        </span>
        <AnimatePresence mode="wait">
          <motion.div
            key={after ? 'after' : 'before'}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="rounded-[14px] rounded-tl-[4px] border px-3 py-2.5"
            style={{ background: theme.surface2, borderColor: theme.border }}
          >
            <div className="mb-1 flex items-center gap-1.5 text-[8px] font-black uppercase tracking-wider" style={{ color: theme.accent }}>
              <Bot size={10} /> Agent
            </div>
            <div className="text-[11px] font-semibold" style={{ color: theme.text2 }}>
              {after ? '✅ Gata: folder „Cardio" + 10 grile' : 'Generez grile din „Cardio"...'}
            </div>
          </motion.div>
        </AnimatePresence>
        <div className="mt-2 text-[9px] font-semibold" style={{ color: theme.text3 }}>
          {after ? 'mesajul se actualizează cu rezultatul real' : 'înainte rămânea așa, chiar și după ce jobul se termina'}
        </div>
      </div>
    </DemoFrame>
  );
}

/** Active nav item glow, spring-driven — the "Glass fluid" refresh. */
function GlassFluidDemo({ theme }: { theme: Theme }) {
  const items = ['Dashboard', 'Grile', 'Rezidențiat'];
  const [active, setActive] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setActive((a) => (a + 1) % items.length), 1300);
    return () => window.clearInterval(id);
  }, [items.length]);

  return (
    <DemoFrame theme={theme}>
      <div className="w-[220px] space-y-1.5">
        {items.map((label, i) => {
          const isActive = i === active;
          return (
            <motion.div
              key={label}
              animate={{
                boxShadow: isActive ? `0 4px 18px ${theme.accent}2e` : '0 0 0 rgba(0,0,0,0)',
                x: isActive ? 4 : 0,
              }}
              transition={{ type: 'spring', stiffness: 300, damping: 26 }}
              className="rounded-[12px] px-3 py-2.5 text-[11px] font-bold"
              style={{
                background: isActive ? `${theme.accent}16` : 'transparent',
                color: isActive ? theme.accent : theme.text3,
              }}
            >
              {label}
            </motion.div>
          );
        })}
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
  tip?: string;
};

const SLIDES: Slide[] = [
  {
    id: 'hero',
    badge: `Versiunea ${WHATS_NEW_VERSION}`,
    title: 'StudyX 2.2 — Rezidențiatul are casă proprie',
    description: 'O bancă reală de ~4200 de grile, o bibliotecă cu 3 cărți de referință și un AI complet izolat, doar pentru secțiunea de rezidențiat. Plus un agent de chat mai de încredere și o interfață mai fluidă peste tot în aplicație.',
    Demo: HeroDemo,
  },
  {
    id: 'residency',
    badge: 'Secțiune nouă',
    title: 'Rezidențiat: bancă reală + bibliotecă AI + AI izolat',
    description: '~4200 de grile verificate din bibliografia oficială, organizate automat pe disciplină și specialitate. Kumar, Lawrence și Sinopsis sunt deja indexate pe capitole. Iar chat-ul din secțiune e o conversație complet separată — răspunde mereu în stil de rezidențiat.',
    Demo: ResidencySectionDemo,
    tip: 'Deschide Rezidențiat din sidebar — are propriul tur, din butonul „?" de lângă titlu.',
  },
  {
    id: 'agent-memory',
    badge: 'Agent mai de încredere',
    title: 'Agentul ține minte ce a făcut — și unde',
    description: 'Mesajul din chat îți arăta mereu intenția inițială, chiar și după ce un job eșua sau reușea — acum se rescrie cu rezultatul real. Iar tot ce creezi fără să specifici un folder (dintr-o secțiune ca Rezidențiat) rămâne acolo, nu se rătăcește pe ecranul general.',
    Demo: AgentOutcomeDemo,
  },
  {
    id: 'glass-fluid',
    badge: 'Interfață',
    title: 'Tranziții mai fluide, ecran de start reînnoit',
    description: 'Navigarea între pagini folosește acum fizică de resort, fundalurile modalelor au blur mai puternic, iar elementele active din meniu au un glow discret. Ecranul unde îți scrii numele e și el mai natural — exemple care se schimbă, previzualizare live.',
    Demo: GlassFluidDemo,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export default function WhatsNewTour() {
  const theme = useTheme();
  const activeProfileId = useUserStore((state) => state.activeProfileId);
  const tutorialActive = useTutorialStore((state) => state.active);
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  useOverlayFlag(open);
  const [direction, setDirection] = useState(1);

  const slide = SLIDES[index];
  const isLast = index === SLIDES.length - 1;
  const isFirst = index === 0;

  // Auto-open once per version, only when a profile is active and the new-user tutorial isn't running.
  useEffect(() => {
    if (!activeProfileId || tutorialActive) return;
    let seen = false;
    try { seen = localStorage.getItem(SEEN_KEY) === '1'; } catch { /* ignore */ }
    if (seen) return;
    const timer = window.setTimeout(() => setOpen(true), 1400);
    return () => window.clearTimeout(timer);
  }, [activeProfileId, tutorialActive]);

  // Manual re-open (Settings / dev).
  useEffect(() => {
    const handler = () => { setIndex(0); setDirection(1); setOpen(true); };
    window.addEventListener(WHATS_NEW_OPEN_EVENT, handler);
    return () => window.removeEventListener(WHATS_NEW_OPEN_EVENT, handler);
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
            className="relative flex w-full max-w-[620px] flex-col overflow-hidden rounded-[32px] border"
            style={{
              background: theme.isDark ? 'rgba(20,20,28,0.97)' : 'rgba(253,253,255,0.98)',
              borderColor: theme.border,
              boxShadow: `0 40px 110px rgba(0,0,0,0.45), 0 0 0 1px ${theme.accent}10, 0 18px 50px ${theme.accent}18`,
            }}
          >
            {/* ambient glow */}
            <div
              className="pointer-events-none absolute -top-28 left-1/2 h-56 w-[480px] -translate-x-1/2 rounded-full opacity-40 blur-[80px]"
              style={{ background: theme.accent }}
            />

            {/* header */}
            <div className="relative z-10 flex items-center justify-between px-7 pt-6">
              <div className="flex items-center gap-2.5">
                <motion.div
                  animate={{ rotate: [0, 12, -8, 0] }}
                  transition={{ repeat: Infinity, duration: 5, repeatDelay: 1.5 }}
                  className="flex h-9 w-9 items-center justify-center rounded-[13px] text-white"
                  style={{ background: theme.accent, boxShadow: `0 10px 22px ${theme.accent}44` }}
                >
                  <Rocket size={17} />
                </motion.div>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: theme.accent }}>
                    Ce e nou
                  </div>
                  <div className="text-[13px] font-black tracking-tight" style={{ color: theme.text }}>
                    StudyX {WHATS_NEW_VERSION}
                  </div>
                </div>
              </div>
              <button
                onClick={close}
                aria-label="Închide turul de noutăți"
                className="rounded-[12px] p-2 transition-colors hover:bg-white/5"
                style={{ color: theme.text3 }}
              >
                <X size={18} />
              </button>
            </div>

            {/* slide body */}
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
                    <h2 className="mt-3 text-[1.45rem] font-black leading-tight tracking-tight" style={{ color: theme.text }}>
                      {slide.title}
                    </h2>
                    <p className="mx-auto mt-2.5 max-w-[470px] text-[13px] font-medium leading-relaxed" style={{ color: theme.text2 }}>
                      {slide.description}
                    </p>
                    <div className="mt-2 h-[30px]">
                      {slide.tip && (
                        <motion.p
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.5 }}
                          className="text-[11px] font-semibold"
                          style={{ color: theme.text3 }}
                        >
                          💡 {slide.tip}
                        </motion.p>
                      )}
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* footer: dots + nav */}
            <div className="relative z-10 flex items-center justify-between px-7 pb-6 pt-1">
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
                      background: i === index
                        ? theme.accent
                        : `${theme.text3}38`,
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
                  style={{
                    background: theme.accent,
                    boxShadow: `0 12px 26px ${theme.accent}40`,
                  }}
                >
                  Începe să explorezi
                  <Zap size={14} />
                </motion.button>
              ) : (
                <button
                  onClick={() => go(1)}
                  aria-label="Slide următor"
                  className="flex h-10 w-10 items-center justify-center rounded-[14px] text-white transition-all"
                  style={{
                    background: theme.accent,
                    boxShadow: `0 10px 22px ${theme.accent}38`,
                  }}
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
