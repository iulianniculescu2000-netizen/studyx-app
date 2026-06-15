import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Check,
  CheckCircle2,
  FileImage,
  ImageIcon,
  Loader2,
  Pencil,
  Quote,
  Rocket,
  Sparkles,
  Wand2,
  X,
  Zap,
} from 'lucide-react';
import { useTheme } from '../theme/ThemeContext';
import { useTutorialStore } from '../store/tutorialStore';
import { useUserStore } from '../store/userStore';

const WHATS_NEW_VERSION = '1.0.5';
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

function AgentDemo({ theme }: { theme: Theme }) {
  const steps = ['Caut „Cursul 4” în bibliotecă', 'Generez 3 pachete de grile', 'Le salvez în folderul „Mielom”'];
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setPhase((p) => (p + 1) % (steps.length + 3)), 1100);
    return () => window.clearInterval(id);
  }, [steps.length]);

  return (
    <DemoFrame theme={theme}>
      <div className="w-full px-6">
        <motion.div
          initial={{ opacity: 0, x: 18 }}
          animate={{ opacity: 1, x: 0 }}
          className="mb-3 ml-auto w-fit max-w-[88%] rounded-[16px] rounded-br-[5px] px-3.5 py-2 text-[12px] font-semibold text-white"
          style={{ background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})` }}
        >
          fă-mi 3 pachete din cursul 4 de la mielom
        </motion.div>
        <div
          className="rounded-[16px] rounded-bl-[5px] border px-3.5 py-2.5"
          style={{ background: theme.surface2, borderColor: theme.border }}
        >
          <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.14em]" style={{ color: theme.accent }}>
            <Bot size={11} /> Agent · plan în execuție
          </div>
          {steps.map((step, i) => {
            const done = phase > i;
            const running = phase === i;
            return (
              <div key={step} className="flex items-center gap-2 py-[3px] text-[11.5px] font-medium" style={{ color: done ? theme.text : theme.text3 }}>
                <AnimatePresence mode="wait" initial={false}>
                  {done ? (
                    <motion.span key="done" initial={{ scale: 0 }} animate={{ scale: 1 }} style={{ color: theme.success }}>
                      <CheckCircle2 size={13} />
                    </motion.span>
                  ) : running ? (
                    <motion.span key="run" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ color: theme.accent }}>
                      <Loader2 size={13} className="animate-spin" />
                    </motion.span>
                  ) : (
                    <span key="wait" className="inline-block h-[13px] w-[13px] rounded-full border" style={{ borderColor: theme.border }} />
                  )}
                </AnimatePresence>
                {step}
              </div>
            );
          })}
        </div>
      </div>
    </DemoFrame>
  );
}

function ImageExtractDemo({ theme }: { theme: Theme }) {
  return (
    <DemoFrame theme={theme}>
      <div className="flex items-center gap-7">
        {/* PDF source */}
        <div
          className="relative flex h-[120px] w-[92px] flex-col gap-1.5 rounded-[12px] border p-2.5"
          style={{ background: theme.surface, borderColor: theme.border }}
        >
          <div className="text-[8px] font-black uppercase tracking-wider" style={{ color: theme.danger }}>PDF · Curs</div>
          {[64, 52, 58].map((w, i) => (
            <div key={i} className="h-[5px] rounded-full" style={{ width: w, background: `${theme.text3}30` }} />
          ))}
          <motion.div
            animate={{ scale: [1, 1.06, 1], boxShadow: [`0 0 0 0px ${theme.accent}00`, `0 0 0 4px ${theme.accent}28`, `0 0 0 0px ${theme.accent}00`] }}
            transition={{ repeat: Infinity, duration: 2.4 }}
            className="flex h-[36px] items-center justify-center rounded-[8px]"
            style={{ background: `${theme.accent}1c`, border: `1px dashed ${theme.accent}66` }}
          >
            <ImageIcon size={15} style={{ color: theme.accent }} />
          </motion.div>
          <div className="h-[5px] w-[48px] rounded-full" style={{ background: `${theme.text3}30` }} />
        </div>

        {/* flying image */}
        <motion.div
          animate={{ x: [-46, 46], opacity: [0, 1, 1, 0], scale: [0.65, 1.05, 1.05, 0.85] }}
          transition={{ repeat: Infinity, duration: 2.4, times: [0, 0.35, 0.75, 1], ease: 'easeInOut' }}
          className="absolute left-1/2 top-1/2 z-10 -ml-[17px] -mt-[14px] flex h-[28px] w-[34px] items-center justify-center rounded-[7px]"
          style={{ background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})`, boxShadow: `0 8px 18px ${theme.accent}50` }}
        >
          <FileImage size={14} color="#fff" />
        </motion.div>

        {/* flashcard target */}
        <motion.div
          animate={{ y: [0, -4, 0] }}
          transition={{ repeat: Infinity, duration: 2.4 }}
          className="flex h-[120px] w-[100px] flex-col gap-1.5 rounded-[14px] border p-2.5"
          style={{ background: theme.surface2, borderColor: `${theme.accent}44`, boxShadow: `0 14px 30px ${theme.accent}18` }}
        >
          <div className="text-[8px] font-black uppercase tracking-wider" style={{ color: theme.accent }}>Flashcard</div>
          <motion.div
            animate={{ opacity: [0.25, 1, 1, 0.25] }}
            transition={{ repeat: Infinity, duration: 2.4, times: [0, 0.4, 0.8, 1] }}
            className="flex h-[44px] items-center justify-center rounded-[8px]"
            style={{ background: `${theme.accent}22` }}
          >
            <ImageIcon size={16} style={{ color: theme.accent }} />
          </motion.div>
          <div className="h-[5px] w-[64px] rounded-full" style={{ background: `${theme.text3}38` }} />
          <div className="h-[5px] w-[50px] rounded-full" style={{ background: `${theme.text3}26` }} />
        </motion.div>
      </div>
    </DemoFrame>
  );
}

function EditDeckDemo({ theme }: { theme: Theme }) {
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    const id = window.setInterval(() => setEditing((e) => !e), 1900);
    return () => window.clearInterval(id);
  }, []);

  return (
    <DemoFrame theme={theme}>
      <motion.div
        animate={{ rotateY: editing ? 6 : 0, scale: editing ? 1.02 : 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 18 }}
        className="relative w-[280px] rounded-[18px] border p-4"
        style={{
          background: theme.surface2,
          borderColor: editing ? `${theme.accent}60` : theme.border,
          boxShadow: editing ? `0 0 0 3px ${theme.accent}1f, 0 16px 36px ${theme.accent}20` : '0 10px 26px rgba(0,0,0,0.10)',
        }}
      >
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[9px] font-black uppercase tracking-[0.16em]" style={{ color: theme.text3 }}>
            {editing ? 'Mod editare' : 'Pachet flashcard'}
          </span>
          <motion.span
            animate={{ scale: editing ? [1, 1.25, 1] : 1, rotate: editing ? [0, -12, 0] : 0 }}
            transition={{ duration: 0.5 }}
            className="flex h-6 w-6 items-center justify-center rounded-[8px]"
            style={{ background: editing ? `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})` : `${theme.accent}18`, color: editing ? '#fff' : theme.accent }}
          >
            <Pencil size={11} />
          </motion.span>
        </div>
        <div className="text-[13px] font-bold" style={{ color: theme.text }}>
          Care este criteriul CRAB în mielomul multiplu?
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={editing ? 'edit' : 'view'}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="mt-2 rounded-[10px] border px-3 py-2 text-[11.5px] font-medium"
            style={{
              background: editing ? `${theme.accent}0e` : theme.surface,
              borderColor: editing ? `${theme.accent}45` : theme.border,
              color: theme.text2,
            }}
          >
            {editing
              ? 'HiperCalcemie · insuf. Renală · Anemie · leziuni osoase (Bone)▌'
              : 'Calciu ↑, Rinichi, Anemie, leziuni osoase'}
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </DemoFrame>
  );
}

function CitationsDemo({ theme }: { theme: Theme }) {
  const pills = [
    { label: 'Cursul 4 — Mielom.pdf', pct: 92 },
    { label: 'Hematologie LP.pdf', pct: 71 },
    { label: 'Curs 7 — Leucemii.pdf', pct: 58 },
  ];
  const [cycle, setCycle] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setCycle((c) => c + 1), 3400);
    return () => window.clearInterval(id);
  }, []);

  return (
    <DemoFrame theme={theme}>
      <div key={cycle} className="w-full max-w-[330px] px-4">
        <div
          className="rounded-[16px] rounded-bl-[5px] border px-4 py-3"
          style={{ background: theme.surface2, borderColor: theme.border }}
        >
          <div className="text-[12px] font-medium leading-relaxed" style={{ color: theme.text }}>
            Criteriile CRAB definesc afectarea de organ în mielomul multiplu…
          </div>
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mt-2.5 inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em]"
            style={{ background: `${theme.success}14`, borderColor: `${theme.success}35`, color: theme.success }}
          >
            <Check size={10} /> Ancorat în bibliotecă
          </motion.div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {pills.map((pill, i) => (
              <motion.span
                key={pill.label}
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.7 + i * 0.35, type: 'spring', stiffness: 320, damping: 20 }}
                className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold"
                style={{ background: `${theme.accent}10`, borderColor: `${theme.accent}30`, color: theme.text2 }}
              >
                <Quote size={9} style={{ color: theme.accent }} />
                {pill.label} · <span style={{ color: theme.accent }}>{pill.pct}%</span>
              </motion.span>
            ))}
          </div>
        </div>
      </div>
    </DemoFrame>
  );
}

function StreamingDemo({ theme }: { theme: Theme }) {
  const fullText = 'Anemia din mielom apare prin infiltrarea măduvei și supresia eritropoiezei…';
  const [len, setLen] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => {
      setLen((l) => (l >= fullText.length ? 0 : l + 2));
    }, 55);
    return () => window.clearInterval(id);
  }, [fullText.length]);

  return (
    <DemoFrame theme={theme}>
      <div className="w-full max-w-[330px] px-4">
        <div
          className="min-h-[96px] rounded-[16px] rounded-bl-[5px] border px-4 py-3 text-[12.5px] font-medium leading-relaxed"
          style={{ background: theme.surface2, borderColor: theme.border, color: theme.text }}
        >
          {fullText.slice(0, len)}
          <span className="streaming-cursor" style={{ color: theme.accent }}>▌</span>
        </div>
        <motion.div
          animate={{ opacity: [0, 1, 1, 0], y: [8, 0, 0, -4] }}
          transition={{ repeat: Infinity, duration: 4.5, times: [0, 0.15, 0.8, 1], delay: 1 }}
          className="mt-3 flex items-center gap-2 rounded-[12px] border px-3 py-2"
          style={{ background: theme.surface, borderColor: theme.border }}
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-[7px]" style={{ background: `${theme.success}18`, color: theme.success }}>
            <Check size={12} />
          </span>
          <div>
            <div className="text-[10px] font-black" style={{ color: theme.text }}>StudyX — agent</div>
            <div className="text-[9.5px]" style={{ color: theme.text3 }}>3 pachete generate cu succes ✓</div>
          </div>
        </motion.div>
      </div>
    </DemoFrame>
  );
}

function FoldersDemo({ theme }: { theme: Theme }) {
  const tiles = [
    { emoji: '🩸', name: 'Hematologie', count: 4 },
    { emoji: '🫀', name: 'Cardiologie', count: 2 },
    { emoji: '🧠', name: 'Neurologie', count: 3 },
  ];
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const steps = [null, 0, null, 1, null, 2, null];
    let i = 0;
    const id = window.setInterval(() => {
      setActive(steps[i % steps.length] ?? null);
      i += 1;
    }, 1200);
    return () => window.clearInterval(id);
  }, []);

  return (
    <DemoFrame theme={theme}>
      <div className="flex w-full max-w-[340px] flex-wrap justify-center gap-2 px-4">
        {tiles.map((tile, i) => {
          const isActive = active === i;
          return (
            <motion.div
              key={tile.name}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{
                opacity: 1,
                scale: isActive ? 1.07 : 1,
                y: isActive ? -4 : 0,
                borderColor: isActive ? `${theme.accent}66` : theme.border,
                boxShadow: isActive ? `0 12px 28px ${theme.accent}28` : 'none',
              }}
              transition={{ delay: 0.15 + i * 0.12, type: 'spring', stiffness: 260, damping: 20 }}
              className="flex w-[88px] flex-col gap-1.5 rounded-[16px] border p-3 text-left"
              style={{
                background: isActive ? `${theme.accent}0e` : theme.surface2,
                borderColor: isActive ? `${theme.accent}55` : theme.border,
              }}
            >
              <span className="text-[20px] leading-none">{tile.emoji}</span>
              <div className="text-[11px] font-bold leading-tight" style={{ color: theme.text }}>{tile.name}</div>
              <div className="text-[9px] font-semibold" style={{ color: isActive ? theme.accent : theme.text3 }}>
                {tile.count} doc.
              </div>
            </motion.div>
          );
        })}
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
    title: 'StudyX v1.0.5 — bibliotecă pe subfoldere, AI mai deștept',
    description: 'Subfoldere reale în Bibliotecă, provider Google Gemini pe lângă Groq, un agent care ține minte firul conversației și extragere de poze fără dubluri. Plus zeci de fix-uri de fundal. Totul în 60 de secunde.',
    Demo: HeroDemo,
  },
  {
    id: 'agent',
    badge: 'AI Agent',
    title: 'Spune-i ce vrei. El face tot.',
    description: 'Scrie în chat „fă-mi 3 pachete din cursul 4 și pune-le în folderul Mielom”. Agentul planifică, execută fiecare pas vizibil și poate fi anulat oricând. Nu mai navighezi manual prin meniuri.',
    Demo: AgentDemo,
    tip: 'Dacă folderul nu există încă, agentul îl creează singur înainte să salveze.',
  },
  {
    id: 'images',
    badge: 'Imagini HD în grile',
    title: 'Pozele din cursuri ajung în grile',
    description: 'StudyX extrage automat imaginile relevante din PDF-urile tale — scheme, frotiuri, imagini clinice — și le atașează la flashcarduri cu rezoluție mai mare ca niciodată. Calitate PNG, nu JPEG.',
    Demo: ImageExtractDemo,
    tip: 'Calitatea imaginilor extrase a crescut semnificativ față de versiunile anterioare.',
  },
  {
    id: 'edit',
    badge: 'Editare flashcarduri',
    title: 'Corectezi orice card, pe loc',
    description: 'Fiecare pachet are un buton de editare. Modifici fața și spatele cardului, adaugi carduri noi sau ștergi ce nu mai e necesar — fără să regenerezi tot pachetul de la zero.',
    Demo: EditDeckDemo,
  },
  {
    id: 'citations',
    badge: 'Răspunsuri ancorate',
    title: 'Vezi exact de unde știe AI-ul',
    description: 'Fiecare răspuns vine cu sursele lui: documentul din bibliotecă și procentul de relevanță. Zero răspunsuri „din burtă” — totul e tras din cursurile tale.',
    Demo: CitationsDemo,
    tip: 'AI-ul combină mai multe cursuri când întrebarea atinge mai multe teme.',
  },
  {
    id: 'streaming',
    badge: 'Live + notificări',
    title: 'Răspunsuri live, notificări native',
    description: 'Răspunsurile apar în timp real cu cursor live și pot fi oprite oricând. Când agentul termină un job lung și tu ești în altă fereastră, primești notificare direct în Windows — fără să stai să aștepți.',
    Demo: StreamingDemo,
  },
  {
    id: 'folders',
    badge: 'Bibliotecă pe foldere',
    title: 'Navighezi direct în materie — acum cu subfoldere',
    description: 'Biblioteca AI e pe foldere și acum pe subfoldere: intri în Hematologie › Cursuri, organizezi în adâncime și muți documentele direct în subfolderul potrivit. Agentul știe ierarhia și pune ce-i ceri exact unde trebuie.',
    Demo: FoldersDemo,
    tip: 'Ștergi un folder? Confirmare elegantă în aplicație, iar documentele rămân în „Neclasificate”.',
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
