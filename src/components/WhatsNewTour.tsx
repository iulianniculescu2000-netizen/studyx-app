import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Check,
  CheckCircle2,
  ClipboardPaste,
  Copy,
  ImageIcon,
  MessageCircle,
  Minus,
  Pencil,
  Plus,
  Quote,
  Rocket,
  Sparkles,
  TrendingUp,
  Wand2,
  X,
  Zap,
} from 'lucide-react';
import { useTheme } from '../theme/ThemeContext';
import { useTutorialStore } from '../store/tutorialStore';
import { useUserStore } from '../store/userStore';

const WHATS_NEW_VERSION = '1.0.6';
const SEEN_KEY = `studyx:whatsnew:${WHATS_NEW_VERSION}:seen`;

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

function ExternalAiImportDemo({ theme }: { theme: Theme }) {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setPhase((p) => (p + 1) % 4), 1300);
    return () => window.clearInterval(id);
  }, []);

  return (
    <DemoFrame theme={theme}>
      <div className="flex w-full max-w-[360px] items-center justify-center gap-5 px-4">
        <div
          className="flex w-[110px] flex-col items-center gap-2 rounded-[16px] border p-3"
          style={{ background: theme.surface2, borderColor: theme.border }}
        >
          <span className="text-[8px] font-black uppercase tracking-wider" style={{ color: theme.text3 }}>StudyX</span>
          <motion.div
            animate={{
              scale: phase === 0 ? [1, 1.08, 1] : 1,
              background: [`${theme.accent}18`],
            }}
            transition={{ duration: 0.5 }}
            className="flex h-9 w-full items-center justify-center gap-1.5 rounded-[10px] text-[9.5px] font-bold"
            style={{ background: `${theme.accent}18`, color: theme.accent }}
          >
            {phase === 0 ? <Check size={12} /> : <Copy size={11} />}
            {phase === 0 ? 'Copiat!' : 'Copiază prompt'}
          </motion.div>
        </div>

        <motion.div
          animate={{ x: phase >= 1 ? [0, 6, 0] : 0, opacity: phase >= 1 ? 1 : 0.35 }}
          transition={{ duration: 1, repeat: phase >= 1 ? Infinity : 0 }}
        >
          <ArrowRight size={16} style={{ color: theme.text3 }} />
        </motion.div>

        <div
          className="flex w-[130px] flex-col gap-1.5 rounded-[16px] border p-3"
          style={{
            background: phase >= 1 ? `${theme.accent}0c` : theme.surface2,
            borderColor: phase >= 2 ? `${theme.success}45` : theme.border,
          }}
        >
          <div className="flex items-center gap-1.5 text-[8px] font-black uppercase tracking-wider" style={{ color: theme.text3 }}>
            <MessageCircle size={10} /> ChatGPT / Gemini
          </div>
          <AnimatePresence mode="wait">
            {phase < 2 ? (
              <motion.div key="wait" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-1">
                {[70, 55, 40].map((w, i) => (
                  <div key={i} className="h-[5px] rounded-full" style={{ width: w, background: `${theme.text3}30` }} />
                ))}
              </motion.div>
            ) : (
              <motion.div
                key="json"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-1.5 rounded-[8px] px-2 py-1.5 text-[9px] font-bold"
                style={{ background: `${theme.success}16`, color: theme.success }}
              >
                {phase === 3 ? <CheckCircle2 size={12} /> : <ClipboardPaste size={12} />}
                {phase === 3 ? 'Grilă importată' : '{ questions: [...] }'}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </DemoFrame>
  );
}

function EditableAgentParamsDemo({ theme }: { theme: Theme }) {
  const [count, setCount] = useState(15);
  const [difficulty, setDifficulty] = useState(0);
  const difficulties = ['Auto', 'Mediu', 'Dificil'];

  useEffect(() => {
    const id = window.setInterval(() => {
      setCount((c) => (c >= 25 ? 15 : c + 5));
      setDifficulty((d) => (d + 1) % difficulties.length);
    }, 1000);
    return () => window.clearInterval(id);
  }, [difficulties.length]);

  return (
    <DemoFrame theme={theme}>
      <div
        className="w-[300px] rounded-[18px] border p-4"
        style={{ background: theme.surface2, borderColor: `${theme.accent}30` }}
      >
        <div className="mb-2.5 flex items-center gap-2 text-[10px] font-black uppercase tracking-wider" style={{ color: theme.accent }}>
          <Sparkles size={12} /> Plan agent · confirmă
        </div>
        <div className="mb-2 text-[11.5px] font-semibold" style={{ color: theme.text2 }}>
          Generez grile din &bdquo;Cursul 4&rdquo;
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-[10px] border px-2 py-1" style={{ borderColor: theme.border, background: theme.surface }}>
            <Minus size={11} style={{ color: theme.text3 }} />
            <motion.span
              key={count}
              initial={{ scale: 1.3, color: theme.accent }}
              animate={{ scale: 1, color: theme.text2 }}
              className="min-w-[3.2rem] text-center text-[11px] font-bold tabular-nums"
            >
              {count} întrebări
            </motion.span>
            <Plus size={11} style={{ color: theme.text3 }} />
          </div>
          <AnimatePresence mode="wait">
            <motion.span
              key={difficulty}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              className="rounded-[10px] px-2.5 py-1 text-[10.5px] font-bold text-white"
              style={{ background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})` }}
            >
              {difficulties[difficulty]}
            </motion.span>
          </AnimatePresence>
        </div>
      </div>
    </DemoFrame>
  );
}

function RealPredictionsDemo({ theme }: { theme: Theme }) {
  const topics = [
    { name: 'Cardiologie', value: 38 },
    { name: 'Hematologie', value: 61 },
    { name: 'Neurologie', value: 74 },
  ];
  const [cycle, setCycle] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setCycle((c) => c + 1), 3200);
    return () => window.clearInterval(id);
  }, []);

  return (
    <DemoFrame theme={theme}>
      <div key={cycle} className="w-full max-w-[300px] px-4">
        <div className="mb-2.5 flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider" style={{ color: theme.text3 }}>
          <TrendingUp size={11} style={{ color: theme.success }} /> Calculat din statisticile tale reale
        </div>
        <div className="space-y-2">
          {topics.map((topic, i) => (
            <div key={topic.name} className="flex items-center gap-2">
              <span className="w-[76px] flex-shrink-0 text-[10px] font-semibold" style={{ color: theme.text2 }}>{topic.name}</span>
              <div className="h-[9px] flex-1 overflow-hidden rounded-full" style={{ background: theme.surface2 }}>
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: `linear-gradient(90deg, ${theme.accent}, ${theme.accent2})` }}
                  initial={{ width: 0 }}
                  animate={{ width: `${topic.value}%` }}
                  transition={{ duration: 0.9, delay: 0.2 + i * 0.15, ease: 'easeOut' }}
                />
              </div>
              <span className="w-[28px] text-right text-[10px] font-bold tabular-nums" style={{ color: theme.text3 }}>{topic.value}%</span>
            </div>
          ))}
        </div>
      </div>
    </DemoFrame>
  );
}

function HeroDemo({ theme }: { theme: Theme }) {
  const icons = [Bot, ImageIcon, Pencil, Quote, Zap, Wand2];
  return (
    <DemoFrame theme={theme}>
      <div className="relative flex h-full w-full items-center justify-center">
        <motion.div
          animate={{ scale: [1, 1.07, 1] }}
          transition={{ repeat: Infinity, duration: 3 }}
          className="z-10 flex h-[84px] w-[84px] items-center justify-center rounded-[26px] text-white"
          style={{
            background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})`,
            boxShadow: `0 22px 50px ${theme.accent}55`,
          }}
        >
          <Sparkles size={38} />
        </motion.div>
        {icons.map((Icon, i) => {
          const angle = (i / icons.length) * Math.PI * 2;
          const radius = 92;
          return (
            <motion.div
              key={i}
              animate={{
                x: [Math.cos(angle) * radius, Math.cos(angle + 0.5) * radius, Math.cos(angle) * radius],
                y: [Math.sin(angle) * radius * 0.62, Math.sin(angle + 0.5) * radius * 0.62, Math.sin(angle) * radius * 0.62],
                opacity: [0.55, 1, 0.55],
              }}
              transition={{ repeat: Infinity, duration: 6 + i * 0.6, ease: 'easeInOut' }}
              className="absolute flex h-10 w-10 items-center justify-center rounded-[13px] border"
              style={{ background: theme.surface2, borderColor: theme.border, color: theme.accent }}
            >
              <Icon size={17} />
            </motion.div>
          );
        })}
      </div>
    </DemoFrame>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Slides
// ─────────────────────────────────────────────────────────────────────────────

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
    badge: `Update ${WHATS_NEW_VERSION}`,
    title: 'StudyX v1.0.6 — generezi grile fără JSON, AI mai onest',
    description: 'Import de grile din orice AI extern fără fișiere JSON, control fin asupra a ce generează agentul înainte să apeși Confirmă, și predicții care se calculează din statisticile tale reale, nu din cifre fixe. Totul în 60 de secunde.',
    Demo: HeroDemo,
  },
  {
    id: 'external-ai-import',
    badge: 'Import grile',
    title: 'Generezi grile cu orice AI, fără fișiere JSON',
    description: 'Copiezi un prompt gata făcut, îl lipești în ChatGPT sau Gemini gratuit, copiezi răspunsul înapoi în StudyX și apeși Importă. Fără cotă internă epuizată, fără să atingi vreun fișier .json.',
    Demo: ExternalAiImportDemo,
    tip: 'Găsești opțiunea în butonul „Import grile” → tab-ul „AI extern”.',
  },
  {
    id: 'editable-agent',
    badge: 'Chat AI mai controlabil',
    title: 'Ajustezi planul agentului înainte să-l confirmi',
    description: 'Dacă agentul a înțeles greșit câte întrebări vrei sau ce dificultate, acum poți corecta direct din cardul de confirmare — fără să anulezi și să retastezi toată comanda.',
    Demo: EditableAgentParamsDemo,
  },
  {
    id: 'real-predictions',
    badge: 'Analiză predictivă',
    title: 'Predicțiile se calculează din statisticile tale',
    description: 'Lacunele de cunoștințe și planul de recuperare nu mai sunt exemple fixe identice pentru toată lumea — se calculează din topicurile la care chiar greșești, cu prioritate reală pe ce contează.',
    Demo: RealPredictionsDemo,
    tip: 'Căutarea globală (Cmd/Ctrl+K) e și ea mai precisă: rezultatele exacte apar primele.',
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
              style={{ background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})` }}
            />

            {/* header */}
            <div className="relative z-10 flex items-center justify-between px-7 pt-6">
              <div className="flex items-center gap-2.5">
                <motion.div
                  animate={{ rotate: [0, 12, -8, 0] }}
                  transition={{ repeat: Infinity, duration: 5, repeatDelay: 1.5 }}
                  className="flex h-9 w-9 items-center justify-center rounded-[13px] text-white"
                  style={{ background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})`, boxShadow: `0 10px 22px ${theme.accent}44` }}
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
                        ? `linear-gradient(90deg, ${theme.accent}, ${theme.accent2})`
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
                    background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})`,
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
                    background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})`,
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
