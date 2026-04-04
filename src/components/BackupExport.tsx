import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, Upload, Check, AlertCircle } from 'lucide-react';
import { useTheme } from '../theme/ThemeContext';
import Portal from './Portal';
import { useQuizStore } from '../store/quizStore';
import { useFolderStore } from '../store/folderStore';
import { useStatsStore } from '../store/statsStore';
import { useNotesStore } from '../store/notesStore';
import { useUserStore } from '../store/userStore';

interface BackupExportProps {
  open: boolean;
  onClose: () => void;
}

export default function BackupExport({ open, onClose }: BackupExportProps) {
  const theme = useTheme();
  const [status, setStatus] = useState<'idle' | 'ok' | 'error'>('idle');
  const [msg, setMsg] = useState('');

  const exportBackup = async () => {
    const { quizzes, sessions } = useQuizStore.getState();
    const { folders } = useFolderStore.getState();
    const { questionStats, streak, totalStudyTime } = useStatsStore.getState();
    const { notes } = useNotesStore.getState();
    const { profiles, activeProfileId } = useUserStore.getState();

    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      profile: profiles.find(p => p.id === activeProfileId),
      quizzes,
      sessions,
      folders,
      stats: { questionStats, streak, totalStudyTime },
      notes,
    };

    const content = JSON.stringify(data, null, 2);
    const filename = `studyx-backup-${new Date().toISOString().split('T')[0]}.json`;

    // Electron save dialog
    if (window.electronAPI?.saveFile) {
      const ok = await window.electronAPI.saveFile({ defaultPath: filename, content });
      if (ok) { setStatus('ok'); setMsg('Backup salvat cu succes!'); }
      else { setStatus('idle'); }
    } else {
      // Browser fallback
      const blob = new Blob([content], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      setStatus('ok');
      setMsg('Backup descărcat!');
    }
    setTimeout(() => setStatus('idle'), 3000);
  };

  const importBackup = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (data.version !== 1) throw new Error('Format nerecunoscut');

        // Restore stores
        if (data.quizzes) useQuizStore.setState((s) => ({ ...s, quizzes: data.quizzes, sessions: data.sessions ?? s.sessions }));
        if (data.folders) useFolderStore.setState((s) => ({ ...s, folders: data.folders }));
        if (data.stats) useStatsStore.getState()._hydrate(data.stats);
        if (data.notes) useNotesStore.setState((s) => ({ ...s, notes: data.notes }));

        setStatus('ok');
        setMsg('Backup restaurat! Repornește aplicația dacă ceva pare greșit.');
      } catch (err: any) {
        setStatus('error');
        setMsg(err.message ?? 'Fișier invalid');
      }
      setTimeout(() => setStatus('idle'), 4000);
    };
    input.click();
  };

  return (
    <Portal>
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200]"
            style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
            onClick={onClose} />

          <motion.div
            initial={{ opacity: 0, scale: 0.93, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.93, y: 20 }}
            transition={{ type: 'spring', stiffness: 360, damping: 28 }}
            className="fixed z-[201] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm rounded-[28px] shadow-2xl overflow-hidden flex flex-col"
            style={{ 
              maxHeight: '85vh',
              background: theme.modalBg, 
              border: `1px solid ${theme.border}`,
              boxShadow: '0 40px 120px rgba(0,0,0,0.4)'
            }}>
            
            {/* Header */}
            <div className="flex items-center justify-between p-6 pb-4 border-b" style={{ borderColor: theme.border }}>
              <div>
                <h2 className="text-lg font-black tracking-tight" style={{ color: theme.text }}>Backup & Export</h2>
                <p className="text-[10px] font-bold uppercase tracking-wider opacity-50" style={{ color: theme.text }}>Datele tale sunt în siguranță</p>
              </div>
              <motion.button 
                whileHover={{ rotate: 90, scale: 1.1, background: theme.surface }} 
                whileTap={{ scale: 0.88 }}
                onClick={onClose} 
                className="p-2 rounded-2xl transition-all" 
                style={{ color: theme.text3, background: theme.surface2, border: `1px solid ${theme.border}`, cursor: 'pointer' }}>
                <X size={16} />
              </motion.button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar" style={{ minHeight: 0 }}>
              <div className="space-y-3">
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={exportBackup}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl text-left transition-all"
                  style={{ background: `${theme.accent}10`, border: `1px solid ${theme.accent}30` }}>
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg"
                    style={{ background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})`, color: '#fff' }}>
                    <Download size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-black" style={{ color: theme.text }}>Exportă Backup</p>
                    <p className="text-[11px] font-medium opacity-60" style={{ color: theme.text }}>Grile, statistici, notițe — tot</p>
                  </div>
                </motion.button>

                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={importBackup}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl text-left transition-all"
                  style={{ background: `${theme.success}10`, border: `1px solid ${theme.success}30` }}>
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg"
                    style={{ background: theme.success, color: '#fff' }}>
                    <Upload size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-black" style={{ color: theme.text }}>Importă Backup</p>
                    <p className="text-[11px] font-medium opacity-60" style={{ color: theme.text }}>Restaurează dintr-un fișier JSON</p>
                  </div>
                </motion.button>
              </div>

              {/* Status */}
              <AnimatePresence>
                {status !== 'idle' && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="mt-6 flex items-center gap-3 p-4 rounded-2xl text-xs font-bold"
                    style={{
                      background: status === 'ok' ? `${theme.success}12` : `${theme.danger}12`,
                      border: `1px solid ${status === 'ok' ? theme.success + '30' : theme.danger + '30'}`,
                      color: status === 'ok' ? theme.success : theme.danger,
                    }}>
                    {status === 'ok' ? <Check size={16} strokeWidth={3} /> : <AlertCircle size={16} />}
                    {msg}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
    </Portal>
  );
}
