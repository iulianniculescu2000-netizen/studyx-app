import { useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  AlertTriangle,
  Bot,
  Brain,
  Cpu,
  Database,
  Gauge,
  RotateCcw,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import BackupExport from '../components/BackupExport';
import AISettings from '../components/AISettings';
import { useViewportProfile } from '../hooks/useViewportProfile';
import { detectDeviceCapabilities } from '../lib/deviceTier';
import { getHealthBadgeLabel } from '../lib/healthReporter';
import { runStartupHealthCheck } from '../lib/startupHealthCheck';
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
  const { themeId, setTheme } = useUserStore();
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
  const { compact, mobile, shortHeight, uiScale } = useViewportProfile();

  const [showBackup, setShowBackup] = useState(false);
  const [showAISettings, setShowAISettings] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const deviceInfo = detectDeviceCapabilities();

  const themeCardHeight = mobile ? 132 : shortHeight ? 140 : compact ? 156 : 180;

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
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
            {THEME_LIST.map((entry) => (
              <motion.button
                key={entry.id}
                onClick={() => setTheme(entry.id as ThemeId)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="group relative flex flex-col items-start justify-between overflow-hidden rounded-[24px] border-2 p-4 text-left transition-all"
                style={{
                  background: entry.id === 'auto' ? '#F2F2F7' : entry.bg,
                  borderColor: themeId === entry.id ? theme.accent : 'transparent',
                  boxShadow: themeId === entry.id ? `0 8px 24px ${theme.accent}25` : 'none',
                  minHeight: `${themeCardHeight}px`,
                  padding: `${Math.max(14, Math.round(16 * uiScale))}px`,
                }}
              >
                <div
                  className="pointer-events-none absolute inset-x-0 top-0 h-16 opacity-60"
                  style={{
                    background: entry.id === 'auto'
                      ? 'linear-gradient(180deg, rgba(0,0,0,0.06), transparent)'
                      : 'linear-gradient(180deg, rgba(255,255,255,0.1), transparent)',
                  }}
                />
                <div
                  className="relative z-10 flex h-11 w-11 items-center justify-center rounded-2xl text-2xl"
                  style={{ background: entry.id === 'auto' ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)' }}
                >
                  {entry.emoji}
                </div>
                <div className="relative z-10 mt-auto">
                  <div className="text-sm font-black leading-tight" style={{ color: entry.id === 'auto' ? '#000' : entry.text }}>
                    {entry.name}
                  </div>
                  <div className="mt-1 text-[11px] font-semibold opacity-70" style={{ color: entry.id === 'auto' ? '#111' : entry.text }}>
                    {entry.id === 'auto' ? 'Se adaptează sistemului' :
                     entry.id === 'obsidian' ? 'Negru mat, iOS accent' :
                     entry.id === 'bigsur' ? 'macOS luminos, curat' :
                     entry.id === 'pearl' ? 'Cald, terracotta' :
                     entry.id === 'aurora' ? 'Violet profund' :
                     entry.id === 'midnight' ? 'GitHub dark, albastru' :
                     'Previzualizare temă'}
                  </div>
                </div>
                {themeId === entry.id && (
                  <motion.div
                    layoutId="theme-active"
                    className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-black"
                    style={{ background: `${theme.accent}18`, borderColor: `${theme.accent}35`, color: theme.accent }}
                  >
                    ✓
                  </motion.div>
                )}
              </motion.button>
            ))}
          </div>
        </Section>

        <Section title="Stabilitate & Performanță" delay={0.15}>
          <div className="mb-5 rounded-[24px] border p-4" style={{ background: theme.surface2, borderColor: theme.border }}>
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
                    background: performanceMode === mode ? `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})` : theme.surface,
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
            label="Groq AI"
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
