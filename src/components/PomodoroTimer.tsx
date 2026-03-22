import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Timer, X, Play, Pause, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';
import { useTheme } from '../theme/ThemeContext';
import { useStatsStore } from '../store/statsStore';

/** Play a simple beep using Web Audio API */
function playAlert(type: 'focus_end' | 'break_end') {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const freqs = type === 'focus_end' ? [880, 1100, 880] : [660, 880, 660];
    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.15, ctx.currentTime + i * 0.25);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.25 + 0.2);
      osc.start(ctx.currentTime + i * 0.25);
      osc.stop(ctx.currentTime + i * 0.25 + 0.25);
    });
    setTimeout(() => ctx.close(), 2000);
  } catch {}
}

type Phase = 'focus' | 'short' | 'long';

const PHASES: Record<Phase, { label: string; duration: number; color: string; emoji: string }> = {
  focus: { label: 'Focus', duration: 25 * 60, color: '#FF453A', emoji: '🍅' },
  short: { label: 'Pauză scurtă', duration: 5 * 60, color: '#30D158', emoji: '☕' },
  long: { label: 'Pauză lungă', duration: 15 * 60, color: '#0A84FF', emoji: '🌿' },
};

export default function PomodoroTimer() {
  const theme = useTheme();
  const { recordStudySession } = useStatsStore();

  const [open, setOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => setChatOpen((e as CustomEvent).detail.open);
    window.addEventListener('studyx:chat', handler);
    return () => window.removeEventListener('studyx:chat', handler);
  }, []);
  const [minimized, setMinimized] = useState(false);
  const [phase, setPhase] = useState<Phase>('focus');
  const [timeLeft, setTimeLeft] = useState(PHASES.focus.duration);
  const [running, setRunning] = useState(false);
  const [sessions, setSessions] = useState(0);
  const sessionsRef = useRef(0); // ref so timer closure always has current count
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  const phaseInfo = PHASES[phase];
  const pct = timeLeft / phaseInfo.duration;
  const circumference = 2 * Math.PI * 52;

  const reset = useCallback((newPhase?: Phase) => {
    const p = newPhase ?? phase;
    setPhase(p);
    setTimeLeft(PHASES[p].duration);
    setRunning(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, [phase]);

  useEffect(() => {
    if (!running) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    startTimeRef.current = Date.now();
    intervalRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(intervalRef.current!);
          setRunning(false);
          // Play sound alert
          playAlert(phase === 'focus' ? 'focus_end' : 'break_end');
          // Record focus session
          if (phase === 'focus') {
            recordStudySession(PHASES.focus.duration);
            sessionsRef.current += 1;
            setSessions(sessionsRef.current);
          }
          // Auto-advance — use ref so closure has fresh session count
          const next: Phase = phase === 'focus'
            ? sessionsRef.current % 4 === 0 ? 'long' : 'short'
            : 'focus';
          setPhase(next);
          setTimeLeft(PHASES[next].duration);
          // Browser notification — wrapped in try/catch (some browsers throw)
          if ('Notification' in window && Notification.permission === 'granted') {
            try {
              new Notification(`StudyX · ${PHASES[next].emoji} ${PHASES[next].label}`, {
                body: phase === 'focus' ? 'Sesiune de focus încheiată! Ia o pauză.' : 'Pauza s-a terminat. Înapoi la studiu!',
              });
            } catch {}
          }
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current!);
  }, [running, phase]);

  useEffect(() => {
    if (open && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, [open]);

  const mm = String(Math.floor(timeLeft / 60)).padStart(2, '0');
  const ss = String(timeLeft % 60).padStart(2, '0');

  if (!open) {
    return (
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.93 }}
        onClick={() => setOpen(true)}
        className="fixed bottom-6 z-[50] w-12 h-12 rounded-2xl flex items-center justify-center shadow-xl"
        style={{
          right: chatOpen ? 396 : 24,
          transition: 'right 0.35s cubic-bezier(0.16,1,0.3,1)',
          background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})`,
          boxShadow: `0 8px 24px ${theme.accent}40`,
        }}>
        <Timer size={20} className="text-white" />
        {running && (
          <motion.div animate={{ scale: [1, 1.3, 1] }} transition={{ repeat: Infinity, duration: 1.5 }}
            className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-red-500 border-2"
            style={{ borderColor: theme.isDark ? '#000' : '#fff' }} />
        )}
      </motion.button>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.88, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.88, y: 20 }}
      transition={{ type: 'spring', stiffness: 340, damping: 28 }}
      className="fixed bottom-6 z-[50] rounded-2xl shadow-2xl overflow-hidden"
      style={{
        right: chatOpen ? 396 : 24,
        transition: 'right 0.35s cubic-bezier(0.16,1,0.3,1)',
        width: 280,
        background: theme.isDark ? 'rgba(18,18,22,0.97)' : 'rgba(255,255,255,0.97)',
        border: `1px solid ${theme.border}`,
        backdropFilter: 'blur(20px)',
      }}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: `1px solid ${theme.border}` }}>
        <Timer size={15} style={{ color: phaseInfo.color }} />
        <span className="flex-1 text-sm font-semibold" style={{ color: theme.text }}>
          {phaseInfo.emoji} {phaseInfo.label}
        </span>
        <button onClick={() => setMinimized(!minimized)} style={{ color: theme.text3 }}>
          {minimized ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        <motion.button whileHover={{ rotate: 90 }} onClick={() => { setOpen(false); reset(); }} style={{ color: theme.text3 }}>
          <X size={14} />
        </motion.button>
      </div>

      <AnimatePresence>
        {!minimized && (
          <motion.div
            initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
            className="overflow-hidden">
            {/* Ring + time */}
            <div className="flex flex-col items-center py-5">
              <div className="relative w-32 h-32">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="52" fill="none" stroke={theme.surface2} strokeWidth="8" />
                  <motion.circle cx="60" cy="60" r="52" fill="none"
                    stroke={phaseInfo.color} strokeWidth="8" strokeLinecap="round"
                    strokeDasharray={circumference}
                    animate={{ strokeDashoffset: circumference * (1 - pct) }}
                    transition={{ duration: 0.5, ease: 'linear' }}
                    style={{ filter: `drop-shadow(0 0 6px ${phaseInfo.color}60)` }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-bold tabular-nums" style={{ color: theme.text }}>{mm}:{ss}</span>
                  {sessions > 0 && (
                    <span className="text-[10px]" style={{ color: theme.text3 }}>🍅 {sessions} sesiuni</span>
                  )}
                </div>
              </div>

              {/* Phase pills */}
              <div className="flex gap-1.5 mt-3">
                {(Object.keys(PHASES) as Phase[]).map((p) => (
                  <button key={p} onClick={() => reset(p)}
                    className="px-2.5 py-1 rounded-full text-xs font-medium transition-all"
                    style={{
                      background: phase === p ? `${PHASES[p].color}22` : theme.surface2,
                      color: phase === p ? PHASES[p].color : theme.text3,
                      border: `1px solid ${phase === p ? PHASES[p].color + '50' : 'transparent'}`,
                    }}>
                    {PHASES[p].emoji}
                  </button>
                ))}
              </div>

              {/* Controls */}
              <div className="flex gap-2 mt-4">
                <motion.button whileTap={{ scale: 0.9 }} onClick={() => reset()}
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: theme.surface2, color: theme.text3 }}>
                  <RotateCcw size={14} />
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setRunning(!running)}
                  className="w-24 h-10 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 text-white"
                  style={{ background: running ? phaseInfo.color + 'cc' : phaseInfo.color }}>
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
