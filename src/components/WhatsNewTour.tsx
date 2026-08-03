import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { AnimatePresence, animate, motion, useMotionValue, useTransform } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Camera,
  Check,
  CheckCircle2,
  ClipboardPaste,
  Copy,
  FileText,
  FolderOpen,
  ImageIcon,
  MessageCircle,
  Minus,
  Pencil,
  Plus,
  Quote,
  KeyRound,
  Rocket,
  Sparkles,
  Target,
  TrendingUp,
  Wand2,
  X,
  Zap,
} from 'lucide-react';
import { useTheme } from '../theme/ThemeContext';
import { useTutorialStore } from '../store/tutorialStore';
import { useUserStore } from '../store/userStore';
import { useOverlayFlag } from '../hooks/useOverlayFlag';

const WHATS_NEW_VERSION = '2.1.0';
// Bump the suffix when the tour content changes within the same app version, so
// users who already dismissed the previous tour see the new highlights once more.
const SEEN_KEY = `studyx:whatsnew:${WHATS_NEW_VERSION}-v21:seen`;

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
          style={{ background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})` }}
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

function DocScanDemo({ theme }: { theme: Theme }) {
  // 0: page/photo shown · 1: scanning · 2: recognized grilă
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setPhase((p) => (p + 1) % 3), 1500);
    return () => window.clearInterval(id);
  }, []);
  const rows = [0, 1, 2, 3];
  const correctRow = 1;

  return (
    <DemoFrame theme={theme}>
      <div className="flex w-full max-w-[380px] items-center justify-center gap-4 px-4">
        {/* source: a photographed page */}
        <div className="relative" style={{ transform: 'rotate(-4deg)' }}>
          <div
            className="relative w-[112px] overflow-hidden rounded-[14px] border p-2.5"
            style={{ background: theme.surface2, borderColor: theme.border }}
          >
            <div className="mb-1.5 flex items-center gap-1 text-[7px] font-black uppercase tracking-wider" style={{ color: theme.text3 }}>
              <Camera size={9} style={{ color: theme.accent }} /> Poză
            </div>
            {rows.map((r) => (
              <div key={r} className="mb-1.5 flex items-center gap-1">
                <div className="h-[4px] w-[4px] rounded-full" style={{ background: `${theme.text3}55` }} />
                <div className="h-[4px] rounded-full" style={{ width: 62 - r * 6, background: `${theme.text3}40` }} />
              </div>
            ))}
            {/* sweeping scan line */}
            <motion.div
              className="absolute left-0 right-0 h-[3px]"
              style={{ background: `linear-gradient(90deg, transparent, ${theme.accent}, transparent)`, boxShadow: `0 0 10px ${theme.accent}` }}
              animate={{ top: ['12%', '88%', '12%'] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            />
          </div>
        </div>

        <motion.div animate={{ x: phase >= 1 ? [0, 5, 0] : 0, opacity: phase >= 1 ? 1 : 0.4 }} transition={{ duration: 0.9, repeat: Infinity }}>
          <ArrowRight size={16} style={{ color: theme.text3 }} />
        </motion.div>

        {/* result: recognized grilă */}
        <div
          className="w-[150px] rounded-[14px] border p-2.5 transition-colors"
          style={{ background: phase >= 2 ? `${theme.success}0e` : theme.surface2, borderColor: phase >= 2 ? `${theme.success}50` : theme.border }}
        >
          <div className="mb-1.5 flex items-center gap-1 text-[7px] font-black uppercase tracking-wider" style={{ color: phase >= 2 ? theme.success : theme.text3 }}>
            <FileText size={9} /> {phase >= 2 ? 'Grilă recunoscută' : 'Analizez…'}
          </div>
          {rows.map((r) => {
            const isCorrect = r === correctRow;
            return (
              <div key={r} className="mb-1.5 flex items-center gap-1.5 rounded-[5px] px-1 py-0.5"
                style={{ background: phase >= 2 && isCorrect ? `${theme.success}20` : 'transparent' }}>
                <motion.div
                  className="flex items-center justify-center rounded-full"
                  style={{ width: 9, height: 9, border: `1.4px solid ${phase >= 2 && isCorrect ? theme.success : `${theme.text3}55`}`, background: phase >= 2 && isCorrect ? theme.success : 'transparent' }}
                  animate={phase >= 2 && isCorrect ? { scale: [0.5, 1.2, 1] } : { scale: 1 }}
                  transition={{ duration: 0.4 }}
                >
                  {phase >= 2 && isCorrect && <Check size={6} color="#fff" strokeWidth={3.5} />}
                </motion.div>
                <div className="h-[4px] rounded-full" style={{ width: 58 - r * 5, background: phase >= 2 && isCorrect ? theme.success : `${theme.text3}40` }} />
              </div>
            );
          })}
        </div>
      </div>
    </DemoFrame>
  );
}

function ExamSplitDemo({ theme }: { theme: Theme }) {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setPhase((p) => (p + 1) % 3), 1600);
    return () => window.clearInterval(id);
  }, []);
  const sessions = [
    { label: 'Ses. 1', date: '12 iul', q: 75 },
    { label: 'Ses. 2', date: '19 iul', q: 75 },
    { label: 'Ses. 3', date: '26 iul', q: 75 },
    { label: 'Ses. 4', date: '2 aug', q: 75 },
  ];

  return (
    <DemoFrame theme={theme}>
      <div className="w-full max-w-[340px] px-4">
        <div className="mb-2.5 flex items-center justify-between text-[9px] font-black uppercase tracking-wider" style={{ color: theme.text3 }}>
          <span className="flex items-center gap-1"><FolderOpen size={11} /> 300 grile</span>
          <motion.span
            animate={{ opacity: phase >= 1 ? 1 : 0.4 }}
            style={{ color: phase >= 1 ? theme.success : theme.text3 }}
          >
            {phase >= 1 ? '4 sesiuni create' : 'analizez zilele rămase…'}
          </motion.span>
        </div>
        <div className="flex gap-1.5">
          {sessions.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ scaleY: 0.3, opacity: 0.3 }}
              animate={phase >= 1 ? { scaleY: 1, opacity: 1 } : { scaleY: 0.3, opacity: 0.3 }}
              transition={{ delay: i * 0.12, duration: 0.4, ease: 'backOut' }}
              style={{ transformOrigin: 'bottom' }}
              className="flex-1 rounded-[10px] border p-2 text-center"
            >
              <div
                className="mb-1.5 h-8 w-full rounded-[6px]"
                style={{ background: `linear-gradient(180deg, ${theme.accent}, ${theme.accent2})`, opacity: 0.85 }}
              />
              <div className="text-[8px] font-black" style={{ color: theme.text2 }}>{s.label}</div>
              <div className="text-[7px]" style={{ color: theme.text3 }}>{s.date}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </DemoFrame>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Slides
function SchemaDrawnDemo({ theme }: { theme: Theme }) {
  // 0: plain text answer · 1..: the schema draws itself
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setPhase((p) => (p + 1) % 4), 1400);
    return () => window.clearInterval(id);
  }, []);
  const drawn = phase > 0;

  return (
    <DemoFrame theme={theme}>
      <div className="flex w-full max-w-[390px] items-center justify-center gap-4 px-4">
        {/* before: the schema as a wall of text */}
        <div
          className="w-[104px] rounded-[14px] border p-2.5"
          style={{ background: theme.surface2, borderColor: theme.border, opacity: drawn ? 0.42 : 1 }}
        >
          <div className="mb-1.5 text-[7px] font-black uppercase tracking-wider" style={{ color: theme.text3 }}>Înainte</div>
          {[92, 78, 88, 64, 82].map((w, i) => (
            <div key={i} className="mb-1 h-[3px] rounded-full" style={{ width: `${w}%`, background: theme.text3, opacity: 0.4 }} />
          ))}
          <div className="mt-1.5 text-[7px] font-semibold" style={{ color: theme.text3 }}>cauză → efect → …</div>
        </div>

        <ArrowRight size={14} style={{ color: theme.accent, flexShrink: 0 }} />

        {/* after: a real drawn flowchart */}
        <div
          className="relative h-[168px] w-[176px] rounded-[16px] border"
          style={{ background: theme.surface, borderColor: `${theme.accent}35` }}
        >
          <svg viewBox="0 0 176 168" className="h-full w-full">
            {[
              { y: 16, w: 92, label: 'Suspiciune', kind: 'start' as const },
              { y: 62, w: 78, label: 'Scor clinic', kind: 'step' as const },
              { y: 108, w: 84, label: 'Decizie?', kind: 'decision' as const },
            ].map((node, i) => {
              const color = node.kind === 'start' ? theme.success : node.kind === 'decision' ? theme.warning : theme.accent;
              return (
                <motion.g
                  key={node.label}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: drawn ? 1 : 0.15 }}
                  transition={{ delay: drawn ? i * 0.18 : 0, duration: 0.35 }}
                >
                  <rect
                    x={(176 - node.w) / 2}
                    y={node.y}
                    width={node.w}
                    height={28}
                    rx={node.kind === 'start' ? 14 : 9}
                    fill={`${color}20`}
                    stroke={color}
                    strokeWidth={1.4}
                  />
                  <text x={88} y={node.y + 18} textAnchor="middle" fontSize={9} fontWeight={700} fill={theme.text}>
                    {node.label}
                  </text>
                </motion.g>
              );
            })}
            {[44, 90].map((y, i) => (
              <motion.line
                key={y}
                x1={88}
                y1={y}
                x2={88}
                y2={y + 18}
                stroke={theme.text3}
                strokeWidth={1.4}
                initial={{ pathLength: 0 }}
                animate={{ pathLength: drawn ? 1 : 0 }}
                transition={{ delay: drawn ? 0.12 + i * 0.18 : 0, duration: 0.3 }}
              />
            ))}
            {(['Da', 'Nu'] as const).map((label, i) => (
              <motion.g
                key={label}
                initial={{ opacity: 0 }}
                animate={{ opacity: drawn && phase > 1 ? 1 : 0 }}
                transition={{ duration: 0.3 }}
              >
                <line x1={88} y1={136} x2={i === 0 ? 44 : 132} y2={150} stroke={theme.text3} strokeWidth={1.4} />
                <text x={i === 0 ? 40 : 136} y={160} textAnchor="middle" fontSize={8} fontWeight={800} fill={theme.text2}>
                  {label}
                </text>
              </motion.g>
            ))}
          </svg>
        </div>
      </div>
    </DemoFrame>
  );
}

function StructuredAnswerDemo({ theme }: { theme: Theme }) {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setPhase((p) => (p + 1) % 2), 1900);
    return () => window.clearInterval(id);
  }, []);
  const structured = phase === 1;

  const sections = [
    { label: '✅ De ce e corect', color: theme.success, rows: 2 },
    { label: '❌ De ce cade varianta ta', color: theme.danger, rows: 1 },
    { label: '⚠️ Celelalte variante', color: theme.warning, rows: 3, bullets: true },
  ];

  return (
    <DemoFrame theme={theme}>
      <div className="w-full max-w-[320px] px-4">
        <div className="mb-2 flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider" style={{ color: theme.text3 }}>
          <FileText size={11} style={{ color: theme.accent }} /> Explicație AI
        </div>

        <AnimatePresence mode="wait">
          {!structured ? (
            <motion.div
              key="blob"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="rounded-[13px] border p-3"
              style={{ background: theme.surface2, borderColor: theme.border }}
            >
              {[96, 92, 98, 88, 94, 61].map((w, i) => (
                <div key={i} className="mb-[5px] h-[4px] rounded-full" style={{ width: `${w}%`, background: theme.text3, opacity: 0.38 }} />
              ))}
            </motion.div>
          ) : (
            <motion.div key="sections" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2">
              {sections.map((section, i) => (
                <motion.div
                  key={section.label}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.14 }}
                  className="rounded-[11px] border px-2.5 py-2"
                  style={{ background: `${section.color}0D`, borderColor: `${section.color}30` }}
                >
                  <div className="mb-1 text-[9px] font-black" style={{ color: section.color }}>{section.label}</div>
                  {Array.from({ length: section.rows }, (_, r) => (
                    <div key={r} className="mb-[3px] flex items-center gap-1">
                      {section.bullets && <Minus size={7} style={{ color: theme.text3 }} />}
                      <div className="h-[3px] flex-1 rounded-full" style={{ background: theme.text3, opacity: 0.34 }} />
                    </div>
                  ))}
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </DemoFrame>
  );
}

function BookIndexingDemo({ theme }: { theme: Theme }) {
  const [page, setPage] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setPage((p) => (p >= 391 ? 0 : Math.min(391, p + 37))), 420);
    return () => window.clearInterval(id);
  }, []);
  const percent = Math.round((page / 391) * 100);
  const chapters = ['Sepsis', 'Hematologie', 'Cardiologie', 'Pneumologie'];
  const attached = Math.floor((percent / 100) * chapters.length);

  return (
    <DemoFrame theme={theme}>
      <div className="flex w-full max-w-[370px] items-center gap-4 px-4">
        <div
          className="flex w-[112px] flex-col items-center gap-2 rounded-[14px] border p-3"
          style={{ background: theme.surface2, borderColor: theme.border }}
        >
          <FileText size={26} style={{ color: theme.accent }} />
          <span className="text-[9px] font-black" style={{ color: theme.text }}>Kumar & Clark</span>
          <span className="text-[8px] font-semibold tabular-nums" style={{ color: theme.text3 }}>
            pagina {page}/391
          </span>
          <div className="h-[5px] w-full overflow-hidden rounded-full" style={{ background: theme.surface }}>
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${percent}%`, background: `linear-gradient(90deg, ${theme.accent}, ${theme.accent2})` }}
            />
          </div>
        </div>

        <div className="flex-1 space-y-1.5">
          <div className="mb-1 text-[8px] font-black uppercase tracking-wider" style={{ color: theme.text3 }}>
            Capitole recunoscute
          </div>
          {chapters.map((chapter, i) => {
            const done = i < attached;
            return (
              <div
                key={chapter}
                className="flex items-center gap-1.5 rounded-[9px] border px-2 py-1"
                style={{
                  background: done ? `${theme.success}12` : theme.surface2,
                  borderColor: done ? `${theme.success}35` : theme.border,
                }}
              >
                {done ? <CheckCircle2 size={10} style={{ color: theme.success }} /> : <Minus size={10} style={{ color: theme.text3 }} />}
                <span className="text-[9px] font-bold" style={{ color: done ? theme.text : theme.text3 }}>{chapter}</span>
              </div>
            );
          })}
        </div>
      </div>
    </DemoFrame>
  );
}

// ─────────────────────────────────────────────────────────────────────────────


/** Real exam questions have five options; the app used to ask for four. */
function CalibrationDemo({ theme }: { theme: Theme }) {
  const [after, setAfter] = useState(false);
  useEffect(() => {
    const id = window.setInterval(() => setAfter((value) => !value), 2200);
    return () => window.clearInterval(id);
  }, []);

  const letters = after ? ['A', 'B', 'C', 'D', 'E'] : ['A', 'B', 'C', 'D'];

  return (
    <DemoFrame theme={theme}>
      <div className="w-[300px]">
        <div className="mb-2 flex items-center gap-2">
          <span
            className="rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.12em]"
            style={{ background: after ? `${theme.success}20` : `${theme.warning}20`, color: after ? theme.success : theme.warning }}
          >
            {after ? 'ca la rezidențiat' : 'înainte'}
          </span>
          <span className="text-[10px] font-bold" style={{ color: theme.text3 }}>
            {after ? '5 variante (A-E)' : '4 variante'}
          </span>
        </div>
        <div className="mb-2 text-[11px] font-bold" style={{ color: theme.text2 }}>
          Agentul etiologic al sifilisului este:
        </div>
        <div className="space-y-1">
          {letters.map((letter, index) => (
            <motion.div
              key={letter}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="flex items-center gap-2 rounded-lg px-2 py-1"
              style={{
                background: index === 1 ? `${theme.success}14` : theme.surface,
                border: `1px solid ${index === 1 ? `${theme.success}40` : theme.border}`,
              }}
            >
              <span className="text-[9px] font-black" style={{ color: index === 1 ? theme.success : theme.text3 }}>{letter}</span>
              <span className="h-1.5 flex-1 rounded-full" style={{ background: index === 1 ? `${theme.success}55` : theme.border }} />
            </motion.div>
          ))}
        </div>
      </div>
    </DemoFrame>
  );
}

/**
 * The conformance score that appears after every generated set.
 *
 * The ring used to be driven by a setInterval ticking React state every 90ms —
 * about eleven steps a second, which looks exactly as jerky as it sounds. It is
 * now a motion value animated at frame rate; the number is written straight to
 * the DOM node on each update so counting up doesn't re-render the component
 * sixty times a second.
 */
function ConformanceDemo({ theme }: { theme: Theme }) {
  const score = useMotionValue(0);
  const dash = useTransform(score, (value) => `${(value / 100) * 264} 264`);
  const color = useTransform(score, [0, 82, 83, 100], [theme.warning, theme.warning, theme.success, theme.success]);
  const numberRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const controls = animate(score, 100, {
      duration: 2.4,
      ease: 'easeOut',
      repeat: Infinity,
      repeatType: 'loop',
      repeatDelay: 1,
    });
    const stop = score.on('change', (value) => {
      if (numberRef.current) numberRef.current.textContent = String(Math.round(value));
    });
    return () => { controls.stop(); stop(); };
  }, [score]);

  return (
    <DemoFrame theme={theme}>
      <div className="flex w-[280px] flex-col items-center">
        <div className="relative mb-3 flex h-[92px] w-[92px] items-center justify-center">
          <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90">
            <circle cx="50" cy="50" r="42" fill="none" stroke={theme.border} strokeWidth="8" />
            <motion.circle
              cx="50" cy="50" r="42" fill="none"
              stroke={color}
              strokeWidth="8" strokeLinecap="round"
              style={{ strokeDasharray: dash }}
            />
          </svg>
          <motion.span ref={numberRef} className="text-[22px] font-black" style={{ color }}>0</motion.span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] font-black" style={{ color: theme.text2 }}>
          <Target size={12} style={{ color: theme.accent }} />
          seamănă cu examenul
        </div>
        <div className="mt-1 text-[9px] font-semibold" style={{ color: theme.text3 }}>
          măsurat pe subiectele oficiale 2021-2024
        </div>
      </div>
    </DemoFrame>
  );
}

/** Three free keys, and the automatic switch when one runs out. */
function FreeKeysDemo({ theme }: { theme: Theme }) {
  const providers = ['Groq', 'Gemini', 'Cerebras'];
  const [active, setActive] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setActive((value) => (value + 1) % providers.length), 1600);
    return () => window.clearInterval(id);
  }, [providers.length]);

  return (
    <DemoFrame theme={theme}>
      <div className="w-[300px] space-y-2">
        {providers.map((name, index) => {
          const isActive = index === active;
          const exhausted = index < active;
          return (
            <motion.div
              key={name}
              animate={{ scale: isActive ? 1.03 : 1 }}
              className="flex items-center gap-2 rounded-xl px-3 py-2"
              style={{
                background: isActive ? `${theme.success}14` : theme.surface,
                border: `1px solid ${isActive ? `${theme.success}45` : theme.border}`,
              }}
            >
              <KeyRound size={12} style={{ color: isActive ? theme.success : theme.text3 }} />
              <span className="text-[11px] font-black" style={{ color: isActive ? theme.text : theme.text3 }}>{name}</span>
              <span className="ml-auto text-[9px] font-bold" style={{ color: isActive ? theme.success : theme.text3 }}>
                {isActive ? 'în lucru' : exhausted ? 'limită atinsă' : 'în așteptare'}
              </span>
            </motion.div>
          );
        })}
        <div className="pt-1 text-center text-[9px] font-semibold" style={{ color: theme.text3 }}>
          când una se termină, StudyX trece singur pe următoarea
        </div>
      </div>
    </DemoFrame>
  );
}

/** The consistency map on the dashboard. */
function ConsistencyDemo({ theme }: { theme: Theme }) {
  const [seed, setSeed] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setSeed((value) => value + 1), 2400);
    return () => window.clearInterval(id);
  }, []);

  const squares = useMemo(
    () => Array.from({ length: 7 * 14 }, (_, index) => ((index * 7 + seed * 3) % 11) / 10),
    [seed],
  );

  return (
    <DemoFrame theme={theme}>
      <div>
        <div className="mb-2 text-center text-[10px] font-black uppercase tracking-[0.14em]" style={{ color: theme.text3 }}>
          harta consistenței
        </div>
        <div className="grid grid-flow-col grid-rows-7 gap-[3px]">
          {squares.map((value, index) => (
            <motion.span
              key={index}
              initial={{ opacity: 0.3 }}
              animate={{ opacity: 1 }}
              transition={{ delay: (index % 14) * 0.01 }}
              className="h-[10px] w-[10px] rounded-[3px]"
              style={{
                background: value < 0.35
                  ? (theme.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)')
                  : `color-mix(in srgb, ${theme.accent} ${Math.round(value * 100)}%, transparent)`,
              }}
            />
          ))}
        </div>
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
    title: 'StudyX 2.1 — grile calibrate pe examenul real',
    description: 'Am măsurat subiectele oficiale de rezidențiat din 2021-2024 și două culegeri românești, apoi am adus generarea la forma lor: cinci variante, enunțuri scurte, distractori din aceeași categorie. În plus, îți arătăm cât de mult seamănă fiecare set generat cu examenul — și poți alege între grile de rezidențiat și grile simple, pentru materiile din facultate.',
    Demo: HeroDemo,
  },
  {
    id: 'calibration',
    badge: 'Calibrat pe examen',
    title: 'Grilele au acum forma subiectelor reale',
    description: 'Generatorul cerea patru variante; examenul are cinci (A-E). Am corectat asta și restul formei: enunț scurt completat de variante, opțiuni din aceeași categorie logică, abrevieri explicitate, praguri și criterii cu nume, iar cazurile clinice rare — cât apar la examen, nu la fiecare întrebare.',
    Demo: CalibrationDemo,
    tip: 'Ai două fire: „fă-mi grile de rezidențiat" (5 variante) sau „grile simple pentru materie" (4 variante).',
  },
  {
    id: 'conformance',
    badge: 'Scor de conformitate',
    title: 'Vezi cât de mult seamănă setul cu examenul',
    description: 'După fiecare generare primești un scor din 100, calculat față de cifrele reale ale examenului: număr de variante, enunțuri completabile, lungimi, enunțuri negative, cazuri clinice. Dacă ceva e sub țintă, îți spune exact ce.',
    Demo: ConformanceDemo,
  },
  {
    id: 'free-keys',
    badge: 'Chei gratuite',
    title: 'Pune toate cele trei chei gratuite',
    description: 'StudyX merge pe nivelurile gratuite de la Groq, Google Gemini și Cerebras — fără card, doar cu un cont. Când una atinge limita zilnică, aplicația trece automat pe următoarea și continuă de unde ai rămas. Cu toate trei salvate, practic nu mai rămâi blocat.',
    Demo: FreeKeysDemo,
    tip: 'Setări → AI. Îți explicăm din nou și în chat, prima dată când deschizi asistentul.',
  },
  {
    id: 'consistency',
    badge: 'Dashboard',
    title: 'Harta consistenței și o temă caldă de noapte',
    description: 'Un pătrat pentru fiecare zi din ultimele 18 săptămâni: vezi dintr-o privire cum arată luna ta, nu doar streak-ul de azi. Iar „Ambră Nocturnă" e o temă fără albastru, pentru cine învață noaptea târziu.',
    Demo: ConsistencyDemo,
    tip: 'Fâșia „Știai că" de pe Dashboard îți arată pe rând ce mai poate face aplicația.',
  },
  {
    id: 'drawn-schemas',
    badge: 'Scheme desenate',
    title: 'Schemele și algoritmii sunt desenați, nu descriși',
    description: 'Când ceri o schemă, un mecanism sau un algoritm de conduită, AI-ul îl desenează: noduri, ramuri „Da/Nu”, start, capcane de examen. Un click deschide diagrama pe tot ecranul, iar chatul are buton de lățire pentru scheme și tabele mari.',
    Demo: SchemaDrawnDemo,
    tip: 'Merge din orice mod de chat — cere „fă-mi o schemă” sau „algoritm de diagnostic”.',
  },
  {
    id: 'structured-answers',
    badge: 'Răspunsuri organizate',
    title: 'Explicațiile vin pe secțiuni, nu ca un perete de text',
    description: 'Fiecare explicație de grilă are acum structură fixă: de ce e corect, de ce cade varianta ta, celelalte variante ca listă și regula de examen. Se aplică peste tot — chat, Rezultate, flashcarduri și recomandarea zilnică.',
    Demo: StructuredAnswerDemo,
  },
  {
    id: 'full-books',
    badge: 'Cărți de rezidențiat',
    title: 'Kumar, Lawrence și Sinopsis sunt citite complet',
    description: 'Manualele mari se opreau după câteva secunde de citire și se pierdeau în întregime. Acum sunt parcurse pagină cu pagină, până la ultima, iar fiecare fragment știe din ce capitol vine — deci poți cere grile sau explicații pe capitol.',
    Demo: BookIndexingDemo,
    tip: 'Reimportă cărțile adăugate înainte de 2.1 ca să primească și ele capitolele.',
  },
  {
    id: 'grile-scan',
    badge: 'Grile din poză / document',
    title: 'Fă o poză. Primești grile.',
    description: 'Fotografiezi o pagină de grile, arunci un PDF, Word sau un scan — StudyX recunoaște întrebările, variantele și răspunsul corect (din bold, culoare sau cheie), iar unde e nevoie completează cu AI. Verifici rapid și le ai gata de învățat.',
    Demo: DocScanDemo,
    tip: 'Găsești butonul „Fă o poză. Primești grile." pe Dashboard sau în „Import grile” → „Din document”.',
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
  {
    id: 'exam-split',
    badge: 'Plan de examen',
    title: 'Distribui un folder întreg pe zilele rămase',
    description: 'Ai 300 de grile într-un folder și un examen în 3 săptămâni? Alegi data examenului, iar StudyX le împarte automat în câteva sesiuni egale, spațiate până în ziua examenului — grilele originale rămân neatinse.',
    Demo: ExamSplitDemo,
    tip: 'Găsești butonul „Distribuie pe zile” în orice folder cu grile.',
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
