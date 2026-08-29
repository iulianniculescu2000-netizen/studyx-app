import { useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  AlertTriangle,
  Bot,
  Brain,
  ChevronDown,
  Cpu,
  Database,
  Gauge,
  History,
  RotateCcw,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import BackupExport from '../components/BackupExport';
import AISettings from '../components/AISettings';
import { detectDeviceCapabilities } from '../lib/deviceTier';
import { getHealthBadgeLabel } from '../lib/healthReporter';
import { runStartupHealthCheck } from '../lib/startupHealthCheck';
import { clearRollbackSnapshot, formatSnapshotDate, getRollbackSnapshot } from '../lib/rollback';
import { saveProfileData } from '../store/profileStorage';
import { useQuizStore } from '../store/quizStore';
import { useFolderStore } from '../store/folderStore';
import type { Folder, Quiz, QuizSession } from '../types';
import { useAIStore } from '../store/aiStore';
import { useDiagnosticsStore } from '../store/diagnosticsStore';
import { useFocusModeStore } from '../store/focusModeStore';
import { useRuntimeStore } from '../store/runtimeStore';
import { useToastStore } from '../store/toastStore';
import { useTutorialStore } from '../store/tutorialStore';
import { useUpdateStore } from '../store/updateStore';
import { useUserStore } from '../store/userStore';
import { useTheme } from '../theme/ThemeContext';
import { THEME_LIST, type ThemeId } from '../theme/themes';

function ConfirmResetModal({
  open,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const theme = useTheme();

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
            className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="fixed left-1/2 top-1/2 z-[1001] w-[calc(100vw-1.5rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-[32px] p-6 shadow-2xl sm:p-8"
            style={{ background: theme.modalBg, border: `1px solid ${theme.border}` }}
          >
            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 text-red-500">
              <AlertTriangle size={28} />
            </div>
            <h3 className="mb-3 text-xl font-black" style={{ color: theme.text }}>
              Resetare totală?
            </h3>
            <p className="mb-8 text-sm leading-relaxed opacity-60" style={{ color: theme.text }}>
              Toate datele, grilele și progresul tău vor fi șterse definitiv. Această acțiune nu poate fi anulată.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                onClick={onCancel}
                className="flex-1 rounded-xl py-3 text-sm font-bold transition-colors"
                style={{ background: theme.surface2, color: theme.text }}
              >
                Anulează
              </button>
              <button
                onClick={onConfirm}
                className="flex-1 rounded-xl bg-red-500 py-3 text-sm font-bold text-white shadow-lg shadow-red-500/30"
              >
                Reset
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function Section({ title, children, delay }: { title: string; children: ReactNode; delay: number }) {
  const theme = useTheme();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className="premium-shadow mb-6 rounded-[28px] border border-white/5 glass-panel p-5 sm:p-6"
    >
      <h3 className="mb-6 text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: theme.text3 }}>
        {title}
      </h3>
      {children}
    </motion.div>
  );
}

function Divider() {
  const theme = useTheme();
  return <div className="my-4 h-px w-full" style={{ background: theme.border }} />;
}

function ToggleRow({
  icon,
  label,
  description,
  checked,
  onChange,
  accent,
}: {
  icon: ReactNode;
  label: string;
  description?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  accent?: string;
}) {
  const theme = useTheme();
  const color = accent ?? theme.accent;

  return (
    <div className="flex items-center gap-3 py-3 sm:gap-4">
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
        style={{ background: `${color}15`, color }}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-bold" style={{ color: theme.text }}>
          {label}
        </div>
        {description && (
          <div className="mt-0.5 text-[11px]" style={{ color: theme.text2 }}>
            {description}
          </div>
        )}
      </div>
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 rounded-full transition-colors ${checked ? '' : 'bg-white/10'}`}
        style={{ background: checked ? color : theme.surface2 }}
      >
        <motion.div
          animate={{ x: checked ? 22 : 4 }}
          className="absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm"
        />
      </motion.button>
    </div>
  );
}

function ActionRow({
  icon,
  label,
  description,
  buttonLabel,
  onClick,
  badge,
  danger,
}: {
  icon: ReactNode;
  label: string;
  description?: string;
  buttonLabel: string;
  onClick: () => void;
  badge?: ReactNode;
  danger?: boolean;
}) {
  const theme = useTheme();
  const color = danger ? theme.danger : theme.accent;

  return (
    <div className="flex flex-col gap-4 py-3 sm:flex-row sm:items-start">
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
        style={{ background: `${color}15`, color }}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold" style={{ color: theme.text }}>
            {label}
          </span>
          {badge}
        </div>
        {description && (
          <div className="mb-4 text-[11px] leading-relaxed" style={{ color: theme.text2 }}>
            {description}
          </div>
        )}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onClick}
          className="rounded-xl border px-5 py-2 text-xs font-black uppercase tracking-widest transition-all"
          style={{ background: `${color}10`, borderColor: `${color}30`, color }}
        >
          {buttonLabel}
        </motion.button>
      </div>
    </div>
  );
}

export default function Settings() {
  const theme = useTheme();
  const { addToast } = useToastStore();
  const { themeId, setTheme, activeProfileId } = useUserStore();
  const { screenshotProtection, setContentProtection } = useFocusModeStore();
  const { hasKey } = useAIStore();
  const { localVersion } = useUpdateStore();
  const performanceMode = useRuntimeStore((state) => state.performanceMode);
  const lowPowerMode = useRuntimeStore((state) => state.lowPowerMode);
  const featureFlags = useRuntimeStore((state) => state.featureFlags);
  const setPerformanceMode = useRuntimeStore((state) => state.setPerformanceMode);
  const setLowPowerMode = useRuntimeStore((state) => state.setLowPowerMode);
  const setFeatureFlag = useRuntimeStore((state) => state.setFeatureFlag);
  const healthStatus = useDiagnosticsStore((state) => state.healthStatus);
  const checks = useDiagnosticsStore((state) => state.checks);
  const events = useDiagnosticsStore((state) => state.events);
  const lastCheckedAt = useDiagnosticsStore((state) => state.lastCheckedAt);
  const setHealthReport = useDiagnosticsStore((state) => state.setHealthReport);
  const clearDiagnostics = useDiagnosticsStore((state) => state.clearDiagnostics);

  const [showBackup, setShowBackup] = useState(false);
  const [showAISettings, setShowAISettings] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [themePickerOpen, setThemePickerOpen] = useState(false);
  const [uiTab, setUiTab] = useState<'ui2' | 'ui1'>(themeId === 'glass' ? 'ui2' : 'ui1');
  const deviceInfo = detectDeviceCapabilities();

  // A rollback snapshot is written before every content-pack install. Until now
  // nothing ever read it back, so the safety net only performed the half that
  // costs storage and none of the half that saves you.
  const [snapshot, setSnapshot] = useState(() => getRollbackSnapshot());
  const [restoring, setRestoring] = useState(false);

  const handleRestoreSnapshot = async () => {
    if (!snapshot || restoring) return;
    setRestoring(true);
    try {
      useQuizStore.getState()._hydrate({
        quizzes: snapshot.quizzes as Quiz[],
        sessions: snapshot.sessions as QuizSession[],
      });
      useFolderStore.getState()._hydrate({ folders: snapshot.folders as Folder[] });
      if (activeProfileId) await saveProfileData(activeProfileId);
      clearRollbackSnapshot();
      setSnapshot(null);
      addToast('Am restaurat starea dinaintea ultimei instalări.', 'success');
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Restaurarea a eșuat.', 'error');
    } finally {
      setRestoring(false);
    }
  };

  const themeDescription = (id: string) => (
    id === 'auto' ? 'Se adaptează sistemului' :
    id === 'obsidian' ? 'Negru mat, iOS accent' :
    id === 'bigsur' ? 'macOS luminos, curat' :
    id === 'pearl' ? 'Cald, terracotta' :
    id === 'aurora' ? 'Violet profund' :
    id === 'midnight' ? 'GitHub dark, albastru' :
    id === 'amber' ? 'Cald, seară' :
    id === 'glass' ? 'Iconițe, hero unic, glass violet-cyan' :
    'Previzualizare temă'
  );

  const activeThemeEntry = THEME_LIST.find((entry) => entry.id === themeId) ?? THEME_LIST[0];
  const ui2Entries = THEME_LIST.filter((entry) => entry.id === 'glass');
  const ui1Entries = THEME_LIST.filter((entry) => entry.id !== 'glass');

  const renderThemeRow = (entry: typeof THEME_LIST[number]) => {
    const active = themeId === entry.id;
    return (
      <motion.button
        key={entry.id}
        onClick={() => setTheme(entry.id as ThemeId)}
        whileTap={{ scale: 0.98 }}
        className="flex w-full items-center gap-3 rounded-[16px] px-3 py-2.5 text-left transition-colors hover:bg-white/5"
        style={{ background: active ? `${theme.accent}14` : 'transparent' }}
      >
        <span
          className="h-8 w-8 flex-shrink-0 rounded-full border-2 flex items-center justify-center text-sm"
          style={{
            background: entry.id === 'auto' ? '#F2F2F7' : entry.bg,
            borderColor: active ? theme.accent : 'transparent',
          }}
        >
          {entry.emoji}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold leading-tight" style={{ color: theme.text }}>{entry.name}</span>
          <span className="block text-[11px] font-medium opacity-60" style={{ color: theme.text3 }}>{themeDescription(entry.id)}</span>
        </span>
        {active && (
          <motion.span
            layoutId="settings-theme-active"
            className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-black"
            style={{ background: `${theme.accent}18`, color: theme.accent }}
          >
            ✓
          </motion.span>
        )}
      </motion.button>
    );
  };

  const handleReset = async () => {
    await window.electronAPI?.hardReset();
  };

  const rerunHealthCheck = async () => {
    try {
      const report = await runStartupHealthCheck();
      setHealthReport(report.status, report.checks);
      addToast(`Verificare finalizată: ${getHealthBadgeLabel(report.status)}.`, report.status === 'healthy' ? 'success' : 'warning');
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Verificarea de sănătate a eșuat.', 'error');
    }
  };

  return (
    <div className="custom-scrollbar h-full overflow-y-auto px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-4xl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
          <h1 className="page-title-compact mb-2" style={{ color: theme.text }}>
            Setări
          </h1>
          <p className="page-subtitle opacity-50" style={{ color: theme.text }}>
            Configurarea experienței tale premium StudyX.
          </p>
        </motion.div>

        <Section title="Aparență" delay={0.1}>
          {/* Compact Apple-style row instead of the old wall of big theme cards —
              one row shows the active theme, a click opens a grouped list (UI 2.0 / UI 1.0). */}
          <motion.button
            onClick={() => setThemePickerOpen((v) => !v)}
            whileTap={{ scale: 0.99 }}
            className="glass-panel flex w-full items-center gap-3 rounded-[20px] px-4 py-3.5 text-left"
            aria-expanded={themePickerOpen}
          >
            <span
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[14px] text-lg"
              style={{ background: activeThemeEntry.id === 'auto' ? '#F2F2F7' : activeThemeEntry.bg, border: `2px solid ${theme.accent}` }}
            >
              {activeThemeEntry.emoji}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[11px] font-black uppercase tracking-[0.14em]" style={{ color: theme.text3 }}>Temă</span>
              <span className="flex items-center gap-1.5 text-sm font-bold" style={{ color: theme.text }}>
                {activeThemeEntry.name}
                {activeThemeEntry.id === 'glass' && (
                  <span className="rounded-full px-1.5 py-0.5 text-[8.5px] font-black uppercase tracking-wider" style={{ background: `${theme.accent}18`, color: theme.accent }}>UI 2.0</span>
                )}
              </span>
            </span>
            <motion.span animate={{ rotate: themePickerOpen ? 180 : 0 }} transition={{ duration: 0.18 }} style={{ color: theme.text3 }}>
              <ChevronDown size={16} />
            </motion.span>
          </motion.button>

          <AnimatePresence initial={false}>
            {themePickerOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="overflow-hidden"
              >
                <div className="glass-panel mt-2 rounded-[20px] p-2">
                  {/* Apple-style segmented control */}
                  <div className="relative mb-2 flex items-center gap-1 rounded-[14px] p-1" style={{ background: theme.surface2 }}>
                    {([{ id: 'ui2', label: 'UI II' }, { id: 'ui1', label: 'UI I' }] as const).map((seg) => (
                      <button
                        key={seg.id}
                        onClick={() => setUiTab(seg.id)}
                        className="relative flex-1 rounded-[11px] py-2 text-center text-[11.5px] font-black uppercase tracking-[0.08em] transition-colors"
                        style={{ color: uiTab === seg.id ? '#fff' : theme.text3 }}
                      >
                        {uiTab === seg.id && (
                          <motion.span
                            layoutId="settings-ui-tab-thumb"
                            className="absolute inset-0 rounded-[11px]"
                            style={{ background: theme.accent }}
                            transition={{ type: 'spring', stiffness: 500, damping: 34 }}
                          />
                        )}
                        <span className="relative z-10 inline-flex items-center gap-1.5">
                          {seg.label}
                          {seg.id === 'ui2' && (
                            <span
                              className="rounded-full px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider"
                              style={{ background: uiTab === seg.id ? 'rgba(255,255,255,0.22)' : `${theme.accent}18`, color: uiTab === seg.id ? '#fff' : theme.accent }}
                            >
                              Nou
                            </span>
                          )}
                        </span>
                      </button>
                    ))}
                  </div>

                  <div className="space-y-0.5">
                    {(uiTab === 'ui2' ? ui2Entries : ui1Entries).map(renderThemeRow)}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </Section>

        <Section title="Stabilitate & Performanță" delay={0.15}>
          <div className="glass-panel mb-5 rounded-[24px] p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-bold" style={{ color: theme.text }}>
                  {getHealthBadgeLabel(healthStatus)}
                </div>
                <div className="text-[11px]" style={{ color: theme.text2 }}>
                  Nivel dispozitiv: {deviceInfo.tier} · {deviceInfo.hardwareConcurrency} thread-uri · {deviceInfo.deviceMemory} GB RAM estimat
                </div>
              </div>
              <span
                className="rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em]"
                style={{
                  background: healthStatus === 'healthy' ? `${theme.success}15` : healthStatus === 'warning' ? `${theme.warning}15` : `${theme.danger}15`,
                  color: healthStatus === 'healthy' ? theme.success : healthStatus === 'warning' ? theme.warning : theme.danger,
                }}
              >
                {healthStatus === 'healthy' ? 'Optim' : healthStatus === 'warning' ? 'Avertizare' : 'Eroare'}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {(['auto', 'lite', 'full'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setPerformanceMode(mode)}
                  className="rounded-xl px-3 py-2 text-[11px] font-black uppercase tracking-[0.14em]"
                  style={{
                    background: performanceMode === mode ? theme.accent : theme.surface,
                    color: performanceMode === mode ? '#fff' : theme.text,
                    border: `1px solid ${performanceMode === mode ? 'transparent' : theme.border}`,
                  }}
                >
                  {mode === 'auto' ? 'Auto' : mode === 'lite' ? 'Lite' : 'Full'}
                </button>
              ))}
            </div>
            {lastCheckedAt && (
              <div className="mt-3 text-[11px]" style={{ color: theme.text3 }}>
                Ultima verificare: {new Date(lastCheckedAt).toLocaleString('ro-RO')}
              </div>
            )}
          </div>

          <ToggleRow
            icon={<Cpu size={16} />}
            label="Mod economisire"
            description="Reduce blur-ul, intensitatea motion și favorizează taskurile mai sigure pe device-uri slabe."
            checked={lowPowerMode}
            onChange={setLowPowerMode}
            accent={theme.warning}
          />
          <Divider />
          <ToggleRow
            icon={<Activity size={16} />}
            label="Panou diagnostic"
            description="Păstrează vizibile verificările de sănătate și semnalele de stabilitate în Setări."
            checked={featureFlags.diagnosticsPanel}
            onChange={(value) => setFeatureFlag('diagnosticsPanel', value)}
            accent={theme.success}
          />
          <Divider />
          <ToggleRow
            icon={<Gauge size={16} />}
            label="Coadă fundal sigură"
            description="Rulează sarcinile grele de AI în serie pentru sisteme mai slabe și importuri mai stabile."
            checked={featureFlags.backgroundQueue}
            onChange={(value) => setFeatureFlag('backgroundQueue', value)}
            accent={theme.accent}
          />
          <Divider />
          <ToggleRow
            icon={<ShieldCheck size={16} />}
            label="Pornire sigură"
            description="Rulează verificări de sănătate după pornire și semnalează automat modurile degradate."
            checked={featureFlags.safeStartup}
            onChange={(value) => setFeatureFlag('safeStartup', value)}
            accent={theme.success}
          />
          <Divider />
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => void rerunHealthCheck()}
              className="rounded-xl border px-5 py-2 text-xs font-black uppercase tracking-widest transition-all"
              style={{ background: `${theme.accent}10`, borderColor: `${theme.accent}30`, color: theme.accent }}
            >
              Rulează health check
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={clearDiagnostics}
              className="rounded-xl border px-5 py-2 text-xs font-black uppercase tracking-widest transition-all"
              style={{ background: theme.surface2, borderColor: theme.border, color: theme.text3 }}
            >
              Resetează diagnosticul
            </motion.button>
          </div>

          {featureFlags.diagnosticsPanel && checks.length > 0 && (
            <div className="mt-5 space-y-2">
              {checks.map((check) => (
                <div
                  key={check.id}
                  className="rounded-[18px] border px-4 py-3"
                  style={{
                    background: check.status === 'ok' ? `${theme.success}08` : check.status === 'warning' ? `${theme.warning}08` : `${theme.danger}08`,
                    borderColor: check.status === 'ok' ? `${theme.success}20` : check.status === 'warning' ? `${theme.warning}20` : `${theme.danger}20`,
                  }}
                >
                  <div className="text-xs font-black uppercase tracking-[0.14em]" style={{ color: theme.text }}>
                    {check.label}
                  </div>
                  <div className="mt-1 text-[11px] leading-relaxed" style={{ color: theme.text2 }}>
                    {check.detail}
                  </div>
                </div>
              ))}
            </div>
          )}

          {featureFlags.diagnosticsPanel && events.length > 0 && (
            <div className="mt-5">
              <div className="mb-2 text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: theme.text3 }}>
                Evenimente recente
              </div>
              <div className="space-y-2">
                {events.slice(0, 6).map((event) => (
                  <div
                    key={event.id}
                    className="rounded-[18px] border px-4 py-3"
                    style={{
                      background: event.level === 'error' ? `${theme.danger}08` : event.level === 'warning' ? `${theme.warning}08` : `${theme.accent}08`,
                      borderColor: event.level === 'error' ? `${theme.danger}20` : event.level === 'warning' ? `${theme.warning}20` : `${theme.accent}18`,
                    }}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs font-black uppercase tracking-[0.14em]" style={{ color: theme.text }}>
                        {event.title}
                      </div>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: theme.text3 }}>
                        {event.area} · {new Date(event.createdAt).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    <div className="micro-copy mt-1" style={{ color: theme.text2 }}>
                      {event.detail}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Section>

        <Section title="Date & Securitate" delay={0.2}>
          <ActionRow
            icon={<Database size={16} />}
            label="Gestionare Date"
            description="Exportă progresul sau importă backup-uri anterioare."
            buttonLabel="Deschide"
            onClick={() => setShowBackup(true)}
          />
          {snapshot && (
            <>
              <Divider />
              <ActionRow
                icon={<History size={16} />}
                label="Restaurează dinaintea ultimei instalări"
                description={`${snapshot.label} · ${formatSnapshotDate(snapshot.savedAt)} · ${snapshot.quizzes.length} seturi`}
                buttonLabel={restoring ? 'Se restaurează...' : 'Restaurează'}
                onClick={handleRestoreSnapshot}
                danger
              />
            </>
          )}
          <Divider />
          <ToggleRow
            icon={<ShieldCheck size={16} />}
            label="Protecție Conținut"
            description="Blochează capturile de ecran (recomandat în testări)."
            checked={screenshotProtection}
            onChange={setContentProtection}
            accent={theme.success}
          />
        </Section>

        <Section title="Inteligență Artificială" delay={0.3}>
          <ActionRow
            icon={<Bot size={16} />}
            label="Asistent AI"
            description="Analiză inteligentă și explicații medicale automate."
            buttonLabel={hasKey ? 'Gestionează' : 'Configurează'}
            onClick={() => setShowAISettings(true)}
            badge={(
              <span
                className="rounded-full px-2 py-0.5 text-[9px] font-black"
                style={{ background: hasKey ? `${theme.success}20` : `${theme.warning}20`, color: hasKey ? theme.success : theme.warning }}
              >
                {hasKey ? 'ACTIV' : 'NECONFIGURAT'}
              </span>
            )}
          />
        </Section>

        <Section title="Ajutor & Sistem" delay={0.4}>
          <ActionRow
            icon={<Brain size={16} />}
            label="Tutorial"
            description="Reia ghidul de utilizare a platformei."
            buttonLabel="Pornește"
            onClick={() => {
              useTutorialStore.getState().startTutorial();
              addToast('Tutorial repornit!', 'info');
            }}
          />
          <Divider />
          <ActionRow
            icon={<RotateCcw size={16} />}
            label="Actualizări"
            description={`Versiunea curentă: ${localVersion}`}
            buttonLabel="Caută update"
            onClick={() => useUpdateStore.getState().setShowUpdateModal(true)}
          />
        </Section>

        <Section title="Zonă Periculoasă" delay={0.5}>
          <ActionRow
            icon={<Trash2 size={16} />}
            label="Resetare Completă"
            description="Șterge tot progresul și setările. Ireversibil."
            buttonLabel="Resetează tot"
            onClick={() => setConfirmReset(true)}
            danger
          />
        </Section>

        <div className="py-10 text-center text-[10px] font-bold uppercase tracking-[0.3em] opacity-20" style={{ color: theme.text }}>
          StudyX Premium • 2026
        </div>
      </div>

      <ConfirmResetModal open={confirmReset} onCancel={() => setConfirmReset(false)} onConfirm={handleReset} />
      {showBackup && <BackupExport open={showBackup} onClose={() => setShowBackup(false)} />}
      {showAISettings && <AISettings open={showAISettings} onClose={() => setShowAISettings(false)} />}
    </div>
  );
}
