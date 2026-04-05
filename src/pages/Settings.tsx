import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../theme/ThemeContext';
import { useUserStore } from '../store/userStore';
import { useFocusModeStore } from '../store/focusModeStore';
import { useAIStore } from '../store/aiStore';
import { THEME_LIST, type ThemeId } from '../theme/themes';
import {
  AlertTriangle, Trash2,
  Bot, Database, Maximize2, ShieldCheck,
  RotateCcw, Brain
} from 'lucide-react';
import BackupExport from '../components/BackupExport';
import AISettings from '../components/AISettings';
import { useUpdateStore } from '../store/updateStore';
import { useTutorialStore } from '../store/tutorialStore';
import { useToastStore } from '../store/toastStore';

// ── Confirm Dialog ────────────────────────────────────────────────────────────
function ConfirmResetModal({ open, onCancel, onConfirm }: { open: boolean; onCancel: () => void; onConfirm: () => void }) {
  const theme = useTheme();
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onCancel}
            className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-sm" />
          <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="fixed z-[1001] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm p-8 rounded-[32px] shadow-2xl"
            style={{ background: theme.modalBg, border: `1px solid ${theme.border}` }}>
            <div className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center text-red-500 mb-6">
              <AlertTriangle size={28} />
            </div>
            <h3 className="text-xl font-black mb-3" style={{ color: theme.text }}>Resetare totală?</h3>
            <p className="text-sm leading-relaxed mb-8 opacity-60" style={{ color: theme.text }}>Toate datele, grilele și progresul tău vor fi șterse definitiv. Această acțiune nu poate fi anulată.</p>
            <div className="flex gap-3">
              <button onClick={onCancel} className="flex-1 py-3 rounded-xl font-bold text-sm transition-colors"
                style={{ background: theme.surface2, color: theme.text }}>Anulează</button>
              <button onClick={onConfirm} className="flex-1 py-3 rounded-xl font-bold text-sm bg-red-500 text-white shadow-lg shadow-red-500/30">Reset</button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ── UI Components ─────────────────────────────────────────────────────────────
function Section({ title, children, delay }: { title: string; children: React.ReactNode; delay: number }) {
  const theme = useTheme();
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.4 }}
      className="mb-6 p-6 rounded-[28px] glass-panel border border-white/5 premium-shadow">
      <h3 className="text-[10px] font-black uppercase tracking-[0.2em] mb-6" style={{ color: theme.text3 }}>{title}</h3>
      {children}
    </motion.div>
  );
}

function Divider() {
  const theme = useTheme();
  return <div className="h-px w-full my-4" style={{ background: theme.border }} />;
}

function ToggleRow({ icon, label, description, checked, onChange, accent }: {
  icon: React.ReactNode; label: string; description?: string; checked: boolean; onChange: (v: boolean) => void; accent?: string;
}) {
  const theme = useTheme();
  const color = accent ?? theme.accent;
  return (
    <div className="flex items-center gap-4 py-3">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${color}15`, color }}>{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold" style={{ color: theme.text }}>{label}</div>
        {description && <div className="text-[11px] mt-0.5" style={{ color: theme.text2 }}>{description}</div>}
      </div>
      <motion.button whileTap={{ scale: 0.9 }} onClick={() => onChange(!checked)}
        className={`w-11 h-6 rounded-full relative transition-colors ${checked ? '' : 'bg-white/10'}`}
        style={{ background: checked ? color : theme.surface2 }}>
        <motion.div animate={{ x: checked ? 22 : 4 }} className="absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm" />
      </motion.button>
    </div>
  );
}

function ActionRow({ icon, label, description, buttonLabel, onClick, badge, danger }: {
  icon: React.ReactNode; label: string; description?: string; buttonLabel: string; onClick: () => void; badge?: React.ReactNode; danger?: boolean;
}) {
  const theme = useTheme();
  const color = danger ? theme.danger : theme.accent;
  return (
    <div className="flex items-start gap-4 py-3">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${color}15`, color }}>{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-bold" style={{ color: theme.text }}>{label}</span>
          {badge}
        </div>
        {description && <div className="text-[11px] mb-4 leading-relaxed" style={{ color: theme.text2 }}>{description}</div>}
        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={onClick}
          className="px-5 py-2 rounded-xl text-xs font-black uppercase tracking-widest border transition-all"
          style={{ background: `${color}10`, borderColor: `${color}30`, color }}>{buttonLabel}</motion.button>
      </div>
    </div>
  );
}

export default function Settings() {
  const theme = useTheme();
  const { addToast } = useToastStore();
  const { themeId, setTheme } = useUserStore();
  const { focusMode, setFocusMode, screenshotProtection, setContentProtection } = useFocusModeStore();
  const { hasKey } = useAIStore();
  const { localVersion } = useUpdateStore();
  
  const [showBackup, setShowBackup] = useState(false);
  const [showAISettings, setShowAISettings] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const handleReset = async () => {
    await window.electronAPI?.hardReset();
  };

  return (
    <div className="h-full overflow-y-auto px-6 py-10 custom-scrollbar">
      <div className="max-w-3xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
          <h1 className="text-4xl font-black tracking-tighter mb-2" style={{ color: theme.text }}>Setări</h1>
          <p className="text-sm font-medium opacity-50" style={{ color: theme.text }}>Configurarea experienței tale premium StudyX.</p>
        </motion.div>

        <Section title="Aparență" delay={0.1}>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
            {THEME_LIST.map(t => (
              <motion.button key={t.id} onClick={() => setTheme(t.id as ThemeId)}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="p-4 rounded-[22px] text-left transition-all border-2 relative overflow-hidden group"
                style={{ 
                  background: t.id === 'auto' ? '#F2F2F7' : t.bg, 
                  borderColor: themeId === t.id ? theme.accent : 'transparent',
                  boxShadow: themeId === t.id ? `0 8px 24px ${theme.accent}25` : 'none'
                }}>
                <div className="text-2xl mb-2">{t.emoji}</div>
                <div className="text-xs font-bold" style={{ color: t.id === 'auto' ? '#000000' : t.text }}>{t.name}</div>
                {themeId === t.id && <motion.div layoutId="theme-active" className="absolute top-2 right-2 w-2 h-2 rounded-full" style={{ background: theme.accent }} />}
              </motion.button>
            ))}
          </div>
          <ToggleRow icon={<Maximize2 size={16} />} label="Mod Focus" description="Ascunde elementele de navigație pentru concentrare maximă." checked={focusMode} onChange={setFocusMode} />
        </Section>

        <Section title="Date & Securitate" delay={0.2}>
          <ActionRow icon={<Database size={16} />} label="Gestionare Date" description="Exportă progresul sau importă backup-uri anterioare." buttonLabel="Deschide" onClick={() => setShowBackup(true)} />
          <Divider />
          <ToggleRow icon={<ShieldCheck size={16} />} label="Protecție Conținut" description="Blochează capturile de ecran (recomandat în testări)." checked={screenshotProtection} onChange={setContentProtection} accent={theme.success} />
        </Section>

        <Section title="Inteligență Artificială" delay={0.3}>
          <ActionRow icon={<Bot size={16} />} label="Groq AI" description="Analiză inteligentă și explicații medicale automate." buttonLabel={hasKey() ? 'Gestionează' : 'Configurează'} onClick={() => setShowAISettings(true)}
            badge={<span className="text-[9px] font-black px-2 py-0.5 rounded-full" style={{ background: hasKey() ? `${theme.success}20` : `${theme.warning}20`, color: hasKey() ? theme.success : theme.warning }}>{hasKey() ? 'ACTIV' : 'NECONFIGURAT'}</span>} />
        </Section>

        <Section title="Ajutor & Sistem" delay={0.4}>
          <ActionRow icon={<Brain size={16} />} label="Tutorial" description="Reia ghidul de utilizare a platformei." buttonLabel="Pornește" onClick={() => { useTutorialStore.getState().startTutorial(); addToast('Tutorial repornit!', 'info'); }} />
          <Divider />
          <ActionRow icon={<RotateCcw size={16} />} label="Actualizări" description={`Versiunea curentă: ${localVersion}`} buttonLabel="Caută update" onClick={() => useUpdateStore.getState().setShowUpdateModal(true)} />
        </Section>

        <Section title="Zonă Periculoasă" delay={0.5}>
          <ActionRow icon={<Trash2 size={16} />} label="Resetare Completă" description="Șterge tot progresul și setările. Ireversibil." buttonLabel="Resetează tot" onClick={() => setConfirmReset(true)} danger />
        </Section>

        <div className="py-10 text-center opacity-20 text-[10px] font-bold uppercase tracking-[0.3em]" style={{ color: theme.text }}>
          StudyX Premium • 2026
        </div>
      </div>

      <ConfirmResetModal open={confirmReset} onCancel={() => setConfirmReset(false)} onConfirm={handleReset} />
      {showBackup && <BackupExport open={showBackup} onClose={() => setShowBackup(false)} />}
      {showAISettings && <AISettings open={showAISettings} onClose={() => setShowAISettings(false)} />}
    </div>
  );
}
