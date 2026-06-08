import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, ChevronUp, Pause, Play, RotateCcw, Timer, X } from 'lucide-react';
import { useTheme } from '../theme/ThemeContext';
import { useStatsStore } from '../store/statsStore';
import { useUIStore } from '../store/uiStore';

const POMODORO_PREFS_KEY = 'studyx-pomodoro-prefs';

function playAlert(type: 'focus_end' | 'break_end') {
  try {
    const AudioCtor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtor();
    const freqs = type === 'focus_end' ? [880, 1100, 880] : [660, 880, 660];

    freqs.forEach((freq, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.15, ctx.currentTime + index * 0.25);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + index * 0.25 + 0.2);
      osc.start(ctx.currentTime + index * 0.25);
      osc.stop(ctx.currentTime + index * 0.25 + 0.25);
    });

    setTimeout(() => {
      void ctx.close();
    }, 2000);
  } catch (error) {
    console.error(error);
  }
}

type Phase = 'focus' | 'short' | 'long';

const PHASES: Record<Phase, { label: string; duration: number; color: string; emoji: string }> = {
  focus: { label: 'Focus', duration: 25 * 60, color: '#FF453A', emoji: '\u{1F345}' },
  short: { label: 'Pauză scurtă', duration: 5 * 60, color: '#30D158', emoji: '\u2615' },
  long: { label: 'Pauză lungă', duration: 15 * 60, color: '#0A84FF', emoji: '\u{1F33F}' },
};

function loadPomodoroPrefs(): { phase: Phase; minimized: boolean } {
  if (typeof window === 'undefined') {
    return { phase: 'focus', minimized: false };
  }

  try {
    const raw = localStorage.getItem(POMODORO_PREFS_KEY);
    if (!raw) {
      return { phase: 'focus', minimized: false };
    }

    const parsed = JSON.parse(raw) as { phase?: Phase; minimized?: boolean };
    const phase = parsed.phase && parsed.phase in PHASES ? parsed.phase : 'focus';
    return { phase, minimized: !!parsed.minimized };
  } catch {
    return { phase: 'focus', minimized: false };
  }
}

function savePomodoroPrefs(state: { phase: Phase; minimized: boolean }) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(POMODORO_PREFS_KEY, JSON.stringify(state));
  } catch {
    // Persistence is optional here.
  }
}

export default function PomodoroTimer() {
  const theme = useTheme();
  const { recordStudySession } = useStatsStore();
  const chatOpen = useUIStore((state) => state.chatOpen);
  const floatingUiSuppressed = useUIStore((state) => state.floatingUILocks.length > 0);
  const prefs = useMemo(() => loadPomodoroPrefs(), []);

  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(prefs.minimized);
  const [phase, setPhase] = useState<Phase>(prefs.phase);
  const [timeLeft, setTimeLeft] = useState(PHASES[prefs.phase].duration);
  const [running, setRunning] = useState(false);
  const [sessions, setSessions] = useState(0);
  const [viewport, setViewport] = useState(() => ({
    width: typeof window === 'undefined' ? 1280 : window.innerWidth,
    height: typeof window === 'undefined' ? 900 : window.innerHeight,
  }));
  const sessionsRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const phaseInfo = PHASES[phase];
  const pct = timeLeft / phaseInfo.duration;
  const circumference = 2 * Math.PI * 52;

  const reset = useCallback((nextPhase?: Phase) => {
    const targetPhase = nextPhase ?? phase;
    setPhase(targetPhase);
    setTimeLeft(PHASES[targetPhase].duration);
    setRunning(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
  }, [phase]);

  useEffect(() => {
    if (!running) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      setTimeLeft((current) => {
        if (current <= 1) {
          clearInterval(intervalRef.current!);
          setRunning(false);
          playAlert(phase === 'focus' ? 'focus_end' : 'break_end');

          if (phase === 'focus') {
            recordStudySession(PHASES.focus.duration);
            sessionsRef.current += 1;
            setSessions(sessionsRef.current);
          }

          const next: Phase = phase === 'focus'
            ? sessionsRef.current % 4 === 0 ? 'long' : 'short'
            : 'focus';
          setPhase(next);
          setTimeLeft(PHASES[next].duration);
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => clearInterval(intervalRef.current!);
  }, [running, phase, recordStudySession]);

  useEffect(() => {
    const handleResize = () => {
      setViewport({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    savePomodoroPrefs({ phase, minimized });
  }, [phase, minimized]);

  const mm = String(Math.floor(timeLeft / 60)).padStart(2, '0');
  const ss = String(timeLeft % 60).padStart(2, '0');
  const panelWidth = Math.min(280, Math.max(248, viewport.width - 32));
  const chatSheetWidth = Math.min(440, Math.max(320, viewport.width - 28));
  const chatSheetHeight = Math.min(Math.round(viewport.height * 0.78), 760);

  const dockMetrics = useMemo(() => {
    const margin = 24;
    const gap = 18;
    const launcherHeight = 48;
    const openHeight = minimized ? 74 : 328;
    const hasSideDockSpace = viewport.width >= chatSheetWidth + panelWidth + margin * 3 + gap;

    if (!chatOpen) {
      return {
        right: margin,
        bottom: margin,
      };
    }

    if (hasSideDockSpace) {
      return {
        right: chatSheetWidth + margin + gap,
        bottom: margin,
      };
    }

    const maxLauncherBottom = Math.max(margin, viewport.height - launcherHeight - margin);
    const maxPanelBottom = Math.max(margin, viewport.height - openHeight - margin);

    return {
      right: margin,
      bottom: minimized
        ? Math.min(chatSheetHeight + gap + margin, maxLauncherBottom)
        : Math.min(chatSheetHeight + gap + margin, maxPanelBottom),
    };
  }, [chatOpen, chatSheetHeight, chatSheetWidth, minimized, panelWidth, viewport.height, viewport.width]);

  const currentRight = dockMetrics.right;
  const currentBottom = dockMetrics.bottom;

  if (floatingUiSuppressed) {
    return null;
  }

  if (!open) {
    return (
      <motion.button
        animate={{ right: currentRight, bottom: currentBottom }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.93 }}
        onClick={() => {
          setMinimized(false);
          setOpen(true);
        }}
        title="Deschide Pomodoro"
        aria-label="Deschide Pomodoro"
        className="fixed z-[9997] flex h-12 w-12 items-center justify-center rounded-2xl shadow-xl press-feedback"
        style={{
          background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})`,
          boxShadow: `0 8px 24px ${theme.accent}40`,
        }}
      >
        <Timer size={20} className="text-white" />
        {running && (
          <motion.div
            animate={{ scale: [1, 1.3, 1] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
            className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 bg-red-500"
            style={{ borderColor: theme.isDark ? 'black' : 'white' }}
          />
        )}
      </motion.button>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0, right: currentRight, bottom: currentBottom }}
      exit={{ opacity: 0, scale: 0.94, y: 8 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="fixed z-[9997] overflow-hidden rounded-[28px] shadow-2xl"
      style={{
        width: panelWidth,
        background: theme.isDark ? 'rgba(18,18,22,0.9)' : 'rgba(255,255,255,0.88)',
        border: `1px solid ${theme.border}`,
        backdropFilter: 'blur(22px) saturate(145%)',
      }}
    >
      <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: `1px solid ${theme.border}` }}>
        <Timer size={15} style={{ color: phaseInfo.color }} />
        <span className="flex-1 text-sm font-semibold" style={{ color: theme.text }}>
          {phaseInfo.emoji} {phaseInfo.label}
        </span>
        <button
          onClick={() => setMinimized(!minimized)}
          aria-label={minimized ? 'Extinde Pomodoro' : 'Minimizeaza Pomodoro'}
          style={{ color: theme.text3 }}
          title={minimized ? 'Extinde' : 'Minimizează'}
        >
          {minimized ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        <motion.button
          whileHover={{ rotate: 90 }}
          onClick={() => {
            setMinimized(false);
            setOpen(false);
            reset();
          }}
          aria-label="Inchide Pomodoro"
          style={{ color: theme.text3 }}
          title="Închide Pomodoro"
        >
          <X size={14} />
        </motion.button>
      </div>

      <AnimatePresence>
        {!minimized && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
            <div className="flex flex-col items-center py-5">
              <div className="relative h-32 w-32">
                <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="52" fill="none" stroke={theme.surface2} strokeWidth="8" />
                  <motion.circle
                    cx="60"
                    cy="60"
                    r="52"
                    fill="none"
                    stroke={phaseInfo.color}
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    animate={{ strokeDashoffset: circumference * (1 - pct) }}
                    transition={{ duration: 0.5, ease: 'linear' }}
                    style={{ filter: `drop-shadow(0 0 6px ${phaseInfo.color}60)` }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="tabular-nums text-3xl font-bold" style={{ color: theme.text }}>
                    {mm}:{ss}
                  </span>
                  {sessions > 0 && (
                    <span className="text-[10px]" style={{ color: theme.text3 }}>
                      {PHASES.focus.emoji} {sessions} sesiuni
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-3 flex gap-1.5">
                {(Object.keys(PHASES) as Phase[]).map((entry) => (
                  <button
                    key={entry}
                    onClick={() => reset(entry)}
                    aria-label={`Seteaza Pomodoro pe ${PHASES[entry].label}`}
                    title={PHASES[entry].label}
                    className="rounded-full px-2.5 py-1 text-xs font-medium transition-all"
                    style={{
                      background: phase === entry ? `${PHASES[entry].color}22` : theme.surface2,
                      color: phase === entry ? PHASES[entry].color : theme.text3,
                      border: `1px solid ${phase === entry ? `${PHASES[entry].color}50` : 'transparent'}`,
                    }}
                  >
                    {PHASES[entry].emoji}
                  </button>
                ))}
              </div>

              <div className="mt-4 flex gap-2">
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => reset()}
                  aria-label="Reseteaza timerul"
                  title="Resetează timerul"
                  className="flex h-10 w-10 items-center justify-center rounded-xl"
                  style={{ background: theme.surface2, color: theme.text3 }}
                >
                  <RotateCcw size={14} />
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setRunning(!running)}
                  aria-label={running ? 'Pune pauza Pomodoro' : 'Porneste Pomodoro'}
                  className="flex h-10 w-24 items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white"
                  style={{ background: running ? `${phaseInfo.color}cc` : phaseInfo.color }}
                >
                  {running ? <><Pause size={14} />Pauză</> : <><Play size={14} />Start</>}
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
