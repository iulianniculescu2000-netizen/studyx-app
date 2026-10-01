import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  BookOpen,
  ImageIcon,
  Layers,
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
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../theme/ThemeContext';
import { useTutorialStore } from '../store/tutorialStore';
import { CURRENT_TOUR_VERSION, type TourId } from '../tutorial/tourMeta';
import { useUserStore } from '../store/userStore';
import { useOverlayFlag } from '../hooks/useOverlayFlag';

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
        boxShadow: `inset 0 1px 0 var(--glass-highlight), 0 18px 44px ${theme.accent}12`,
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
                  color: theme.accentText,
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

/** Rezidențiat's new layout: the three things that changed, cycling in place. */
function ResidencySectionDemo({ theme }: { theme: Theme }) {
  const rows = useMemo(
    () => [
      { Icon: Stethoscope, label: 'Disciplină → specialitate, cu progres pe fiecare' },
      { Icon: Sparkles, label: 'Grilele generate de AI intră singure în Grile › specialitate' },
      { Icon: BookOpen, label: '„Joacă tot”: o sesiune din toate testele unei specialități' },
    ],
    [],
  );
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setPhase((p) => (p + 1) % rows.length), 1600);
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

/** A generated deck is announced, not opened; if the AI stops halfway the cards already made are kept. */
function FlashcardsDemo({ theme }: { theme: Theme }) {
  const phases = useMemo(
    () => [
      { badge: 'se generează', tone: theme.warning, title: 'Generez 25 de carduri…', note: 'poți continua să lucrezi în aplicație' },
      { badge: 'gata', tone: theme.success, title: 'Pachet creat în „Cardiologie”', note: 'ai „Mută în” dacă vrei alt folder' },
      { badge: 'limită atinsă', tone: theme.danger, title: '14 din 25 de carduri păstrate', note: '„Continuă generarea” reia din lotul care a picat' },
    ],
    [theme.danger, theme.success, theme.warning],
  );
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setPhase((p) => (p + 1) % phases.length), 2100);
    return () => window.clearInterval(id);
  }, [phases.length]);
  const current = phases[phase];

  return (
    <DemoFrame theme={theme}>
      <div className="w-full max-w-[300px]">
        <span
          className="mb-2 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[8px] font-black uppercase tracking-wider"
          style={{ background: `${current.tone}18`, color: current.tone }}
        >
          {current.badge}
        </span>
        <AnimatePresence mode="wait">
          <motion.div
            key={phase}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="rounded-[14px] border px-3 py-2.5"
            style={{ background: theme.surface2, borderColor: theme.border }}
          >
            <div className="mb-1 flex items-center gap-1.5 text-[8px] font-black uppercase tracking-wider" style={{ color: theme.accentText }}>
              <Layers size={10} /> Flashcarduri
            </div>
            <div className="text-[11px] font-semibold" style={{ color: theme.text }}>{current.title}</div>
            <div className="mt-0.5 text-[10px] font-medium" style={{ color: theme.text3 }}>{current.note}</div>
          </motion.div>
        </AnimatePresence>
      </div>
    </DemoFrame>
  );
}

/** A command in Romanian is typed, then the place it landed appears. */
function ChatCommandDemo({ theme }: { theme: Theme }) {
  const command = 'fă-mi 5 grile din mielom multiplu';
  const [typed, setTyped] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTyped((count) => (count >= command.length + 14 ? 0 : count + 1)), 110);
    return () => window.clearInterval(id);
  }, [command.length]);
  const done = typed >= command.length + 3;

  return (
    <DemoFrame theme={theme}>
      <div className="w-full max-w-[320px] space-y-2">
        <div className="flex items-center gap-2 rounded-[12px] border px-3 py-2.5" style={{ background: theme.surface2, borderColor: theme.border }}>
          <MessageCircle size={13} style={{ color: theme.accent }} />
          <span className="min-h-[14px] text-[11px] font-semibold" style={{ color: theme.text }}>{command.slice(0, typed)}</span>
        </div>
        <motion.div
          animate={{ opacity: done ? 1 : 0, y: done ? 0 : 6 }}
          transition={{ duration: 0.3 }}
          className="flex items-center gap-2 rounded-[12px] border px-3 py-2"
          style={{ background: `${theme.success}12`, borderColor: `${theme.success}30` }}
        >
          <Stethoscope size={13} style={{ color: theme.success }} />
          <span className="text-[10.5px] font-bold" style={{ color: theme.text }}>Rezidențiat › Grile › Hematologie</span>
        </motion.div>
      </div>
    </DemoFrame>
  );
}

/** One key's limit is reached and the next one takes over by itself. */
function AIKeysDemo({ theme }: { theme: Theme }) {
  const providers = ['Groq', 'Gemini', 'Cerebras'];
  const [active, setActive] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setActive((current) => (current + 1) % providers.length), 1700);
    return () => window.clearInterval(id);
  }, [providers.length]);

  return (
    <DemoFrame theme={theme}>
      <div className="w-[260px] space-y-1.5">
        {providers.map((name, i) => {
          const isActive = i === active;
          const isFull = i < active;
          return (
            <motion.div
              key={name}
              animate={{ opacity: isFull ? 0.45 : 1, x: isActive ? 4 : 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 26 }}
              className="flex items-center justify-between rounded-[12px] border px-3 py-2.5"
              style={{
                background: isActive ? `${theme.accent}14` : theme.surface2,
                borderColor: isActive ? `${theme.accent}38` : theme.border,
              }}
            >
              <span className="text-[11px] font-bold" style={{ color: isActive ? theme.text : theme.text2 }}>{name}</span>
              <span className="text-[9px] font-black uppercase tracking-wider" style={{ color: isFull ? theme.warning : isActive ? theme.success : theme.text3 }}>
                {isFull ? 'limită atinsă' : isActive ? 'răspunde' : 'rezervă'}
              </span>
            </motion.div>
          );
        })}
      </div>
    </DemoFrame>
  );
}

/** Active nav item glow, spring-driven. */
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
                color: isActive ? theme.accentText : theme.text3,
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
  /** "Arată-mi": closes the slides, opens the page and, when there is one, starts its short tour. */
  cta?: { label: string; to: string; tour?: TourId };
};

const SLIDES: Slide[] = [
  {
    id: 'hero',
    badge: `Versiunea ${CURRENT_TOUR_VERSION}`,
    title: 'StudyX 2.3 — mai multă ordine, mai puține surprize',
    description: 'Rezidențiat și Flashcarduri au fost refăcute, Biblioteca AI e mai clară, iar AI-ul poate folosi mai multe chei gratuite ca rezerve. În plus, zeci de reparații la datele tale și la interfață.',
    Demo: HeroDemo,
  },
  {
    id: 'residency',
    badge: 'Rezidențiat',
    title: 'Rezidențiat, organizat pe discipline și specialități',
    description: 'Intri într-o disciplină, alegi specialitatea și vezi testele cu progresul lor. Grilele generate de AI intră singure în Grile › specialitate, iar cele arhivate se găsesc oricând la „Arhivate”.',
    Demo: ResidencySectionDemo,
    tip: 'Butonul „?” de lângă titlu deschide un tur scurt.',
    cta: { label: 'Arată-mi Rezidențiat', to: '/rezidentiat', tour: 'residency' },
  },
  {
    id: 'flashcards',
    badge: 'Flashcarduri',
    title: 'Pagina Flashcarduri, refăcută',
    description: '„De repetat azi” numără exact ce primești în sesiune. Un pachet generat de AI nu mai deschide sesiunea singur: te anunță unde a ajuns și îl muți cu „Mută în”. Dacă AI-ul se oprește la mijloc, cardurile făcute rămân și poți continua generarea.',
    Demo: FlashcardsDemo,
    cta: { label: 'Arată-mi Flashcardurile', to: '/flashcards', tour: 'flashcards' },
  },
  {
    id: 'vault-chat',
    badge: 'Biblioteca AI și chat',
    title: 'Biblioteca AI redesenată, chat care te înțelege mai bine',
    description: 'Căutarea din bibliotecă ignoră diacriticele. În chat, comenzile în română sunt înțelese corect, erorile îți spun ce poți face, iar Studio se deschide ca panou lângă conversație, pe ferestrele late.',
    Demo: ChatCommandDemo,
    cta: { label: 'Arată-mi Biblioteca', to: '/vault', tour: 'vault' },
  },
  {
    id: 'ai-keys',
    badge: 'AI',
    title: 'Mai multe chei gratuite = rezerve automate',
    description: 'Cu două sau mai multe chei, când limita unui furnizor se atinge aplicația trece singură pe următorul. În Setări → Asistent AI vezi și cât ai consumat, pe furnizor.',
    Demo: AIKeysDemo,
    tip: 'Ghidul de chei din Setări te duce pas cu pas, cu testarea cheii.',
    cta: { label: 'Deschide Setările', to: '/settings' },
  },
  {
    id: 'polish',
    badge: 'Interfață și siguranță',
    title: 'Mai curat, mai accesibil, mai sigur',
    description: 'Contrast mai bun în tema Luminos, bară laterală cu animație la „Restrânge”, ferestre care se închid cu Esc și respectă tastatura, „Golește conversația” cu confirmare. Salvarea modificărilor la închidere a fost întărită.',
    Demo: GlassFluidDemo,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export default function WhatsNewTour() {
  const theme = useTheme();
  const navigate = useNavigate();
  const activeProfileId = useUserStore((state) => state.activeProfileId);
  const tutorialActive = useTutorialStore((state) => state.active);
  const hydrated = useTutorialStore((state) => state._hasHydrated);
  const seenTours = useTutorialStore((state) => state.seen);
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  useOverlayFlag(open);
  const [direction, setDirection] = useState(1);

  const slide = SLIDES[index];
  const isLast = index === SLIDES.length - 1;
  const isFirst = index === 0;

  // Opens once per version, for people who already finished the onboarding (a new user is not told what
  // is new in an app they have just met) and only while no tour is running.
  useEffect(() => {
    if (!hydrated || !activeProfileId || tutorialActive) return;
    const store = useTutorialStore.getState();
    if (!store.hasSeen(activeProfileId, 'onboarding') || store.hasSeen(activeProfileId, 'whatsNew')) return;
    const timer = window.setTimeout(() => setOpen(true), 1400);
    return () => window.clearTimeout(timer);
  }, [activeProfileId, hydrated, seenTours, tutorialActive]);

  // Manual re-open (Settings / dev).
  useEffect(() => {
    const handler = () => { setIndex(0); setDirection(1); setOpen(true); };
    window.addEventListener(WHATS_NEW_OPEN_EVENT, handler);
    return () => window.removeEventListener(WHATS_NEW_OPEN_EVENT, handler);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    if (activeProfileId) useTutorialStore.getState().markSeen(activeProfileId, 'whatsNew');
  }, [activeProfileId]);

  // "Arată-mi": leave the slides, open the page and start its short tour.
  const showMe = useCallback((cta: NonNullable<Slide['cta']>) => {
    close();
    navigate(cta.to);
    if (cta.tour) window.setTimeout(() => useTutorialStore.getState().startTour(cta.tour as TourId), 400);
  }, [close, navigate]);

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
                  <div className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: theme.accentText }}>
                    Ce e nou
                  </div>
                  <div className="text-[13px] font-black tracking-tight" style={{ color: theme.text }}>
                    StudyX {CURRENT_TOUR_VERSION}
                  </div>
                </div>
              </div>
              <button
                onClick={close}
                aria-label="Închide turul de noutăți"
                className="rounded-full p-2 transition-colors hover:bg-[var(--hover-fill)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
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
                      style={{ background: `${theme.accent}12`, borderColor: `${theme.accent}30`, color: theme.accentText }}
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
                    {slide.cta && (
                      <button
                        type="button"
                        onClick={() => showMe(slide.cta as NonNullable<Slide['cta']>)}
                        className="press-feedback mt-3 inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[12.5px] font-semibold"
                        style={{ background: `${theme.accent}16`, color: theme.accentText }}
                      >
                        {slide.cta.label} <ArrowRight size={13} />
                      </button>
                    )}
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
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.94 }}
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
