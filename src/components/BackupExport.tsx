import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, Upload, Check, AlertCircle } from 'lucide-react';
import { useTheme } from '../theme/ThemeContext';
import { useAdaptiveMotion } from '../hooks/useAdaptiveMotion';
import Portal from './Portal';
import { useQuizStore } from '../store/quizStore';
import { useFolderStore } from '../store/folderStore';
import { useStatsStore } from '../store/statsStore';
import { useNotesStore } from '../store/notesStore';
import { useAIStore } from '../store/aiStore';
import { useUserStore } from '../store/userStore';
import {
  isQuizSnapshot, isFolderSnapshot, isStatsSnapshot, isNotesSnapshot, isAiSnapshot,
  flushProfileDataSync, saveProfileData,
} from '../store/profileStorage';
import type { Quiz, QuizSession, Folder, QuestionStat, StudyStreak } from '../types';
import type { AIKnowledgeSource, AILibraryFolder } from '../store/aiStore';

interface BackupExportProps {
  open: boolean;
  onClose: () => void;
}

interface ParsedBackup {
  version: number;
  quizzes?: Quiz[];
  sessions?: QuizSession[];
  folders?: Folder[];
  stats?: { questionStats: Record<string, QuestionStat>; streak: StudyStreak; totalStudyTime: number };
  notes?: Record<string, string>;
  ai?: { knowledgeSources: AIKnowledgeSource[]; libraryFolders: AILibraryFolder[] };
}

export default function BackupExport({ open, onClose }: BackupExportProps) {
  const theme = useTheme();
  const { calmMotion, performanceLite } = useAdaptiveMotion();
  const [status, setStatus] = useState<'idle' | 'ok' | 'error'>('idle');
  const [msg, setMsg] = useState('');
  const [pendingRestore, setPendingRestore] = useState<ParsedBackup | null>(null);

  const exportBackup = async () => {
    const { quizzes, sessions } = useQuizStore.getState();
    const { folders } = useFolderStore.getState();
    const { questionStats, streak, totalStudyTime } = useStatsStore.getState();
    const { notes } = useNotesStore.getState();
    const { knowledgeSources, libraryFolders } = useAIStore.getState();
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
      ai: { knowledgeSources, libraryFolders },
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
        const data = JSON.parse(text) as Record<string, unknown>;
        if (data.version !== 1) throw new Error('Format nerecunoscut');

        // Validate every field's SHAPE before it's ever allowed near a store —
        // a hand-edited or truncated file used to overwrite live data with
        // whatever garbage happened to parse as JSON.
        //
        // The `as unknown` casts below are load-bearing, not decorative: a
        // type-guard call narrows its exact argument expression for all code
        // that follows, even code inside an unrelated later `if` block — so
        // calling `isQuizSnapshot(data)` would narrow `data` itself, and the
        // NEXT block's `data.folders` access would then fail to typecheck
        // (the narrowed type has no `folders` field). Passing `data as
        // unknown` gives the guard a fresh, non-narrowable expression instead
        // of the tracked `data` reference, so each check stays independent.
        const parsed: ParsedBackup = { version: 1 };
        if (data.quizzes !== undefined && !isQuizSnapshot(data as unknown)) throw new Error('Fișierul are secțiunea de grile coruptă sau incompletă.');
        if (data.quizzes !== undefined) {
          parsed.quizzes = data.quizzes as Quiz[];
          parsed.sessions = data.sessions as QuizSession[] | undefined;
        }
        if (data.folders !== undefined && !isFolderSnapshot(data as unknown)) throw new Error('Fișierul are secțiunea de foldere coruptă sau incompletă.');
        if (data.folders !== undefined) {
          parsed.folders = data.folders as Folder[];
        }
        if (data.stats !== undefined && !isStatsSnapshot(data.stats)) throw new Error('Fișierul are secțiunea de statistici coruptă sau incompletă.');
        if (data.stats !== undefined) {
          parsed.stats = data.stats as ParsedBackup['stats'];
        }
        if (data.notes !== undefined && !isNotesSnapshot(data as unknown)) throw new Error('Fișierul are secțiunea de notițe coruptă sau incompletă.');
        if (data.notes !== undefined) {
          parsed.notes = data.notes as Record<string, string>;
        }
        if (data.ai !== undefined && !isAiSnapshot(data.ai)) throw new Error('Fișierul are secțiunea de bibliotecă AI coruptă sau incompletă.');
        if (data.ai !== undefined) {
          parsed.ai = data.ai as ParsedBackup['ai'];
        }
        // Quizzes reference folders by id — restoring one without the other
        // leaves quizzes pointing at folders that don't exist in the restored
        // set, invisible everywhere `getQuizzesByFolder` is used.
        if (parsed.quizzes && !parsed.folders) {
          throw new Error('Fișierul conține grile fără foldere — nu pot restaura una fără cealaltă în siguranță.');
        }

        setPendingRestore(parsed);
      } catch (err: unknown) {
        setStatus('error');
        setMsg(err instanceof Error ? err.message : 'Fișier invalid');
        setTimeout(() => setStatus('idle'), 4000);
      }
    };
    input.click();
  };

  const applyPendingRestore = async () => {
    if (!pendingRestore) return;
    const data = pendingRestore;
    setPendingRestore(null);

    if (data.quizzes) useQuizStore.setState((s) => ({ ...s, quizzes: data.quizzes!, sessions: data.sessions ?? s.sessions }));
    if (data.folders) useFolderStore.setState((s) => ({ ...s, folders: data.folders! }));
    if (data.stats) useStatsStore.getState()._hydrate(data.stats);
    if (data.notes) useNotesStore.setState((s) => ({ ...s, notes: data.notes! }));
    if (data.ai) useAIStore.getState()._hydrate(data.ai);

    // Land it on disk immediately — the debounced autosave can take several
    // seconds, and a user who reads "restaurat" and force-quits right after
    // (exactly what "repornește aplicația" invites) must not lose the restore.
    const activeProfileId = useUserStore.getState().activeProfileId;
    if (activeProfileId) {
      flushProfileDataSync(activeProfileId);
      try {
        await saveProfileData(activeProfileId);
      } catch {
        // flushProfileDataSync already landed the critical bytes in
        // localStorage; the async path's own toast covers a real failure here.
      }
    }

    setStatus('ok');
    setMsg('Backup restaurat și salvat.');
    setTimeout(() => setStatus('idle'), 4000);
  };

  return (
    <Portal>
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200]"
            style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: performanceLite ? 'blur(2px)' : 'blur(14px)' }}
            onClick={onClose} />

          <motion.div
            initial={{ opacity: 0, scale: 0.93, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.93, y: 20 }}
            transition={calmMotion ? { duration: 0.16, ease: 'easeOut' } : { type: 'spring', stiffness: 360, damping: 28 }}
            className="fixed z-[201] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm rounded-[28px] shadow-2xl overflow-hidden flex flex-col"
            style={{ 
              maxHeight: '85vh',
              background: theme.modalBg, 
              border: `1px solid ${theme.border}`,
              boxShadow: performanceLite ? '0 20px 52px rgba(0,0,0,0.24)' : '0 40px 120px rgba(0,0,0,0.4)'
            }}>
            
            {/* Header */}
            <div className="flex items-center justify-between p-6 pb-4 border-b" style={{ borderColor: theme.border }}>
              <div>
                <h2 className="text-lg font-black tracking-tight" style={{ color: theme.text }}>Backup & Export</h2>
                <p className="text-[10px] font-bold uppercase tracking-wider opacity-50" style={{ color: theme.text }}>Datele tale sunt în siguranță</p>
              </div>
              <motion.button
                whileHover={calmMotion ? undefined : { rotate: 90, scale: 1.1, background: theme.surface }}
                whileTap={calmMotion ? undefined : { scale: 0.88 }}
                onClick={onClose}
                className="p-2 rounded-2xl transition-all"
                style={{ color: theme.text3, background: theme.surface2, border: `1px solid ${theme.border}`, cursor: 'pointer' }}>
                <X size={16} />
              </motion.button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar" style={{ minHeight: 0 }}>
              {pendingRestore ? (
                <div className="space-y-3">
                  <div className="rounded-2xl p-4" style={{ background: `${theme.danger}0c`, border: `1px solid ${theme.danger}30` }}>
                    <p className="mb-2 flex items-center gap-2 text-sm font-black" style={{ color: theme.danger }}>
                      <AlertCircle size={16} /> Sigur restaurezi?
                    </p>
                    <p className="text-[12px] font-medium leading-relaxed" style={{ color: theme.text }}>
                      Se vor înlocui ireversibil datele curente cu cele din fișier:
                    </p>
                    <ul className="mt-2 space-y-1 text-[11px] font-bold opacity-80" style={{ color: theme.text }}>
                      {pendingRestore.quizzes && <li>• {pendingRestore.quizzes.length} grile, {pendingRestore.folders?.length ?? 0} foldere</li>}
                      {pendingRestore.stats && <li>• statisticile de studiu</li>}
                      {pendingRestore.notes && <li>• {Object.keys(pendingRestore.notes).length} notițe</li>}
                      {pendingRestore.ai && <li>• {pendingRestore.ai.knowledgeSources.length} surse din biblioteca AI</li>}
                    </ul>
                  </div>
                  <div className="flex gap-2">
                    <motion.button whileTap={calmMotion ? undefined : { scale: 0.97 }} onClick={() => setPendingRestore(null)}
                      className="flex-1 rounded-2xl py-3 text-xs font-black uppercase tracking-wider"
                      style={{ background: theme.surface2, color: theme.text }}>
                      Anulează
                    </motion.button>
                    <motion.button whileTap={calmMotion ? undefined : { scale: 0.97 }} onClick={() => void applyPendingRestore()}
                      className="flex-1 rounded-2xl py-3 text-xs font-black uppercase tracking-wider text-white"
                      style={{ background: theme.danger }}>
                      Restaurează
                    </motion.button>
                  </div>
                </div>
              ) : (
              <div className="space-y-3">
                <motion.button whileHover={calmMotion ? undefined : { scale: 1.02 }} whileTap={calmMotion ? undefined : { scale: 0.97 }} onClick={exportBackup}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl text-left transition-all"
                  style={{ background: `${theme.accent}10`, border: `1px solid ${theme.accent}30` }}>
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg"
                    style={{ background: theme.accent, color: '#fff' }}>
                    <Download size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-black" style={{ color: theme.text }}>Exportă Backup</p>
                    <p className="text-[11px] font-medium opacity-60" style={{ color: theme.text }}>Grile, foldere, statistici, notițe, bibliotecă AI</p>
                  </div>
                </motion.button>

                <motion.button whileHover={calmMotion ? undefined : { scale: 1.02 }} whileTap={calmMotion ? undefined : { scale: 0.97 }} onClick={importBackup}
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
              )}

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
