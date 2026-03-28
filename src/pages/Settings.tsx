import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../theme/ThemeContext';
import { useUserStore } from '../store/userStore';
import { useFocusModeStore } from '../store/focusModeStore';
import { useAIStore } from '../store/aiStore';
import { THEME_LIST } from '../theme/themes';
import {
  AlertTriangle, Monitor, Trash2, Check,
  Bot, Database, Maximize2, ShieldCheck, Palette,
} from 'lucide-react';
import BackupExport from '../components/BackupExport';
import AISettings from '../components/AISettings';
import { useUpdateStore } from '../store/updateStore';

// ── Confirm Dialog ────────────────────────────────────────────────────────────
function ConfirmDialog({
  title, message, confirmLabel, danger, onConfirm, onCancel,
}: {
  title: string; message: string; confirmLabel: string;
  danger?: boolean; onConfirm: () => void; onCancel: () => void;
}) {
  const theme = useTheme();
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
      onClick={onCancel}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0, y: 16 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.92, opacity: 0, y: 16 }}
        transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
        onClick={(e) => e.stopPropagation()}
        style={{ background: theme.modalBg, borderRadius: 16, padding: '32px 28px 24px',
          maxWidth: 420, width: '90%', border: `1px solid ${theme.border}`,
          boxShadow: '0 24px 60px rgba(0,0,0,0.4)' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%',
            background: danger ? 'rgba(239,68,68,0.15)' : `${theme.accent}22`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <AlertTriangle size={20} color={danger ? '#ef4444' : theme.accent} />
          </div>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: theme.text }}>{title}</h3>
        </div>
        <p style={{ margin: '0 0 24px', fontSize: 14, lineHeight: 1.6, color: theme.text2, paddingLeft: 52 }}>
          {message}
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{ padding: '8px 18px', borderRadius: 8,
            border: `1px solid ${theme.border}`, background: 'transparent',
            color: theme.text2, cursor: 'pointer', fontSize: 14, fontWeight: 500 }}>
            Anulează
          </button>
          <button onClick={onConfirm} style={{ padding: '8px 18px', borderRadius: 8, border: 'none',
            background: danger ? '#ef4444' : theme.accent, color: '#fff',
            cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
            {confirmLabel}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Section Card ──────────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <div style={{ background: theme.surface, border: `1px solid ${theme.border}`,
      borderRadius: 14, padding: '20px 24px', marginBottom: 16 }}>
      <h3 style={{ margin: '0 0 16px', fontSize: 12, fontWeight: 700, color: theme.text3,
        textTransform: 'uppercase', letterSpacing: '0.07em' }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

// ── Divider ───────────────────────────────────────────────────────────────────
function Divider() {
  const theme = useTheme();
  return <div style={{ height: 1, background: theme.border, margin: '12px 0' }} />;
}

// ── Toggle Row ────────────────────────────────────────────────────────────────
function ToggleRow({ icon, label, description, checked, onChange, accent }: {
  icon: React.ReactNode; label: string; description?: string;
  checked: boolean; onChange: (v: boolean) => void; accent?: string;
}) {
  const theme = useTheme();
  const color = accent ?? theme.accent;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '6px 0' }}>
      <div style={{ width: 36, height: 36, borderRadius: 9, background: `${color}18`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, color }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: theme.text }}>{label}</div>
        {description && <div style={{ fontSize: 12, color: theme.text2, marginTop: 2 }}>{description}</div>}
      </div>
      <button
        onClick={() => onChange(!checked)}
        style={{ width: 46, height: 26, borderRadius: 13, border: 'none',
          background: checked ? color : theme.border, cursor: 'pointer',
          position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}
        aria-label={label} aria-checked={checked} role="switch"
      >
        <span style={{ position: 'absolute', top: 3, left: checked ? 23 : 3,
          width: 20, height: 20, borderRadius: '50%', background: '#fff',
          transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.25)' }} />
      </button>
    </div>
  );
}

// ── Action Row ────────────────────────────────────────────────────────────────
function ActionRow({ icon, label, description, buttonLabel, onClick, badge, danger }: {
  icon: React.ReactNode; label: string; description?: string;
  buttonLabel: string; onClick: () => void; badge?: React.ReactNode; danger?: boolean;
}) {
  const theme = useTheme();
  const color = danger ? '#ef4444' : theme.accent;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '6px 0' }}>
      <div style={{ width: 36, height: 36, borderRadius: 9,
        background: danger ? 'rgba(239,68,68,0.12)' : `${theme.accent}18`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, color }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: description ? 2 : 8 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: theme.text }}>{label}</span>
          {badge}
        </div>
        {description && (
          <div style={{ fontSize: 12, color: theme.text2, lineHeight: 1.5, marginBottom: 10 }}>
            {description}
          </div>
        )}
        <button
          onClick={onClick}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 7,
            padding: '7px 14px', borderRadius: 8,
            border: `1px solid ${color}40`,
            background: danger ? 'rgba(239,68,68,0.08)' : `${theme.accent}12`,
            color, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
          onMouseEnter={(e) => { e.currentTarget.style.background = danger ? 'rgba(239,68,68,0.15)' : `${theme.accent}20`; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = danger ? 'rgba(239,68,68,0.08)' : `${theme.accent}12`; }}
        >
          {buttonLabel}
        </button>
      </div>
    </div>
  );
}

// ── Main Settings Page ────────────────────────────────────────────────────────
export default function Settings() {
  const theme = useTheme();
  const isElectron = !!window.electronAPI;
  const themeId = useUserStore((s) => s.themeId);
  const setTheme = useUserStore((s) => s.setTheme);
  const { focusMode, setFocusMode } = useFocusModeStore();
  const { hasKey } = useAIStore();

  const localVersion = useUpdateStore((s) => s.localVersion);

  const [hwAccel, setHwAccel] = useState(true);
  const [hwAccelSaved, setHwAccelSaved] = useState(false);
  const [screenshotProtection, setScreenshotProtection] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [showBackup, setShowBackup] = useState(false);
  const [showAISettings, setShowAISettings] = useState(false);

  useEffect(() => {
    if (!isElectron) return;
    window.electronAPI!.getSettings().then((s) => {
      if (s?.hardwareAccel === false) setHwAccel(false);
    });
  }, [isElectron]);

  const handleHwAccelToggle = async (val: boolean) => {
    setHwAccel(val);
    if (isElectron) {
      await window.electronAPI!.setHardwareAccel(val);
      setHwAccelSaved(true);
      setTimeout(() => setHwAccelSaved(false), 2500);
    }
  };

  const handleScreenshotToggle = async (val: boolean) => {
    setScreenshotProtection(val);
    if (isElectron) {
      await window.electronAPI!.setContentProtection(val);
    }
  };

  const hardResetApp = async () => {
    setConfirmReset(false);
    setResetting(true);
    if (isElectron) {
      await window.electronAPI!.hardReset();
    } else {
      localStorage.clear();
      sessionStorage.clear();
      window.location.reload();
    }
  };

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: '32px 32px 48px', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: 660, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ margin: '0 0 6px', fontSize: 24, fontWeight: 800, color: theme.text }}>Setări</h1>
          <p style={{ margin: 0, fontSize: 14, color: theme.text2 }}>
            Personalizare, date și preferințe StudyX.
          </p>
        </div>

        {/* ── Aparență ── */}
        <Section title="Aparență">
          {/* Theme grid */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: theme.text, marginBottom: 10,
              display: 'flex', alignItems: 'center', gap: 8 }}>
              <Palette size={15} color={theme.accent} />
              Temă
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {THEME_LIST.map((t) => (
                <motion.button
                  key={t.id}
                  whileHover={{ scale: 1.03, y: -2 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => setTheme(t.id as any)}
                  style={{
                    background: t.modalBg,
                    border: `2px solid ${themeId === t.id ? t.accent : t.border}`,
                    borderRadius: 12,
                    padding: '10px 10px 8px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    position: 'relative',
                    overflow: 'hidden',
                    boxShadow: themeId === t.id ? `0 2px 16px ${t.accent}40` : '0 2px 8px rgba(0,0,0,0.10)',
                    transition: 'border-color 0.2s, box-shadow 0.2s',
                  }}
                >
                  {/* Bg preview */}
                  <div style={{ width: '100%', height: 28, borderRadius: 7, background: t.bg,
                    marginBottom: 6, position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0,
                      height: 4, background: t.accent, borderRadius: '0 0 7px 7px' }} />
                    <div style={{ position: 'absolute', top: 4, left: 6, width: 30,
                      height: 4, borderRadius: 2, background: t.surface2, opacity: 0.7 }} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ fontSize: 13 }}>{t.emoji}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: t.text,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.name}
                    </span>
                  </div>
                  {themeId === t.id && (
                    <motion.div
                      initial={{ scale: 0 }} animate={{ scale: 1 }}
                      style={{ position: 'absolute', top: 6, right: 6, width: 16, height: 16,
                        borderRadius: '50%', background: t.accent,
                        display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Check size={9} color="#fff" strokeWidth={3} />
                    </motion.div>
                  )}
                </motion.button>
              ))}
            </div>
          </div>

          <Divider />

          <ToggleRow
            icon={<Maximize2 size={16} />}
            label="Mod Focus"
            description="Ascunde sidebar-ul și bara de titlu pentru concentrare maximă. Ieși cu Escape."
            checked={focusMode}
            onChange={setFocusMode}
            accent={theme.accent2}
          />
        </Section>

        {/* ── Date & Backup ── */}
        <Section title="Date & Backup">
          <ActionRow
            icon={<Database size={16} />}
            label="Backup & Export"
            description="Exportă toate datele (quiz-uri, statistici, notițe) ca fișier JSON. Importă backup-uri anterioare."
            buttonLabel="Deschide Backup"
            onClick={() => setShowBackup(true)}
          />
        </Section>

        {/* ── AI ── */}
        <Section title="Inteligență Artificială">
          <ActionRow
            icon={<Bot size={16} />}
            label="Groq API"
            description="Generare automată de grile din text/PDF, explicații AI și chat pe grile. Gratuit — 14.400 req/zi."
            buttonLabel={hasKey() ? 'Gestionează cheia' : 'Configurează AI'}
            onClick={() => setShowAISettings(true)}
            badge={
              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                background: hasKey() ? `${theme.success}20` : `${theme.warning}20`,
                color: hasKey() ? theme.success : theme.warning }}>
                {hasKey() ? '✓ Activ' : 'Neconfigurat'}
              </span>
            }
          />
        </Section>

        {/* ── Securitate ── */}
        <Section title="Securitate">
          <ToggleRow
            icon={<ShieldCheck size={16} />}
            label="Protecție Screenshot"
            description="Blochează capturi de ecran și înregistrarea ferestrei. Recomandat în modul Examen."
            checked={screenshotProtection}
            onChange={handleScreenshotToggle}
            accent={theme.success}
          />
        </Section>

        {/* ── Performanță ── */}
        <Section title="Performanță">
          <ToggleRow
            icon={<Monitor size={16} />}
            label="Accelerare Hardware"
            description={hwAccel
              ? 'Activă — GPU folosit pentru randare. Modificarea se aplică la repornire.'
              : 'Dezactivată — fallback pe CPU. Util dacă apar artefacte grafice.'}
            checked={hwAccel}
            onChange={handleHwAccelToggle}
          />
          <AnimatePresence>
            {hwAccelSaved && (
              <motion.div
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8,
                  fontSize: 12, color: theme.success, paddingLeft: 50 }}>
                <Check size={13} />
                Salvat — se va aplica la următoarea pornire.
              </motion.div>
            )}
          </AnimatePresence>
        </Section>

        {/* ── Resetare ── */}
        <Section title="Zone Periculoasă">
          <ActionRow
            icon={<Trash2 size={16} />}
            label="Reset complet"
            description="Șterge toate profilurile, quiz-urile, statisticile și notițele. Repornește aplicația. Ireversibil."
            buttonLabel={resetting ? 'Se resetează…' : 'Resetează aplicația'}
            onClick={() => !resetting && setConfirmReset(true)}
            danger
          />
        </Section>

        {/* ── Sistem ── */}
        <Section title="Informații Sistem">
          <div style={{ fontSize: 12, color: theme.text2, lineHeight: 2 }}>
            {[
              ['Mediu', isElectron ? 'production (StudyX)' : 'browser (dev)'],
              ['Date stocate în', '%APPDATA%\\StudyX'],
              ['Versiune', localVersion],
            ].map(([label, value]) => (
              <div key={label} style={{ display: 'flex', gap: 8 }}>
                <span style={{ color: theme.text, fontWeight: 600, minWidth: 130 }}>{label}:</span>
                <span style={{ fontFamily: 'monospace', color: theme.text2 }}>{value}</span>
              </div>
            ))}
          </div>
        </Section>

      </div>

      {/* Modals */}
      <BackupExport open={showBackup} onClose={() => setShowBackup(false)} />
      <AISettings open={showAISettings} onClose={() => setShowAISettings(false)} />

      <AnimatePresence>
        {confirmReset && (
          <ConfirmDialog
            title="Resetează aplicația?"
            message="Toate profilurile, quiz-urile, statisticile și notițele vor fi șterse permanent. Aplicația se va reporni. Această acțiune NU poate fi anulată."
            confirmLabel="Da, resetează tot"
            danger
            onConfirm={hardResetApp}
            onCancel={() => setConfirmReset(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
