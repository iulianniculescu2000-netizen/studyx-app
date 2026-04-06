import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, RefreshCw, Check, Package2, Sparkles, Download, RotateCcw,
  AlertCircle, ArrowDownCircle, BookOpen, FolderPlus, ChevronRight,
} from 'lucide-react';
import { useTheme } from '../theme/ThemeContext';
import { useUpdateStore, type ContentUpdate } from '../store/updateStore';
import { useQuizStore } from '../store/quizStore';
import { useFolderStore } from '../store/folderStore';
import { saveRollbackSnapshot } from '../lib/rollback';
import Portal from './Portal';
import type { Quiz } from '../types';

function uid() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
}

async function fetchContentPack(url: string): Promise<{
  subject: string;
  emoji: string;
  color: string;
  quizzes: Array<{
    title?: string;
    description?: string;
    questions: Array<Record<string, unknown>>;
  }>;
}> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Eroare retea: HTTP ${res.status}`);
  return res.json();
}

function StatusDot({ color }: { color: string }) {
  return (
    <motion.span
      animate={{ scale: [1, 1.4, 1], opacity: [1, 0.45, 1] }}
      transition={{ duration: 1.8, repeat: Infinity }}
      style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }}
    />
  );
}

function VersionPill({ label, value, tone }: { label: string; value: string; tone: string }) {
  const theme = useTheme();
  return (
    <div
      style={{
        background: theme.surface2,
        border: `1px solid ${tone === theme.text ? theme.border : `${tone}28`}`,
        borderRadius: 14,
        padding: '12px 14px',
        boxShadow: theme.isDark ? 'inset 0 1px 0 rgba(255,255,255,0.04)' : 'inset 0 1px 0 rgba(255,255,255,0.8)',
      }}
    >
      <div style={{ fontSize: 10, fontWeight: 700, color: theme.text3, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 15, fontWeight: 800, color: tone, fontFamily: 'monospace' }}>
        {value}
      </div>
    </div>
  );
}

function ContentPackCard({
  pack,
  installed,
  installing,
  onInstall,
}: {
  pack: ContentUpdate;
  installed: boolean;
  installing: boolean;
  onInstall: () => void;
}) {
  const theme = useTheme();
  const accent = {
    blue: '#0A84FF',
    purple: '#5E5CE6',
    green: '#30D158',
    orange: '#FF9F0A',
    pink: '#FF375F',
    red: '#FF453A',
    teal: '#5AC8FA',
  }[pack.color] ?? theme.accent;

  return (
    <div
      style={{
        background: installed ? `${accent}0E` : theme.surface2,
        border: `1px solid ${installed ? `${accent}28` : theme.border}`,
        borderRadius: 18,
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 14,
          background: `${accent}18`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 22,
          flexShrink: 0,
        }}
      >
        {pack.emoji}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 14, fontWeight: 800, color: theme.text }}>{pack.subject}</span>
          {installed && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: 999,
                background: `${theme.success}18`,
                color: theme.success,
              }}
            >
              Instalat
            </span>
          )}
        </div>
        <div style={{ fontSize: 12, color: theme.text2, lineHeight: 1.5, marginBottom: 6 }}>
          {pack.description}
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 11, color: theme.text3 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <BookOpen size={10} />
            {pack.questionCount} intrebari
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <FolderPlus size={10} />
            Folder automat
          </span>
          <span>{pack.publishedAt}</span>
        </div>
      </div>

      {installed ? (
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: `${theme.success}20`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Check size={16} color={theme.success} />
        </div>
      ) : installing ? (
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
        >
          <RefreshCw size={16} color={theme.accent} />
        </motion.div>
      ) : (
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.96 }}
          onClick={onInstall}
          style={{
            padding: '9px 14px',
            borderRadius: 12,
            border: 'none',
            cursor: 'pointer',
            background: `linear-gradient(135deg, ${accent}, ${accent}CC)`,
            color: '#fff',
            fontSize: 13,
            fontWeight: 700,
            boxShadow: `0 10px 22px ${accent}24`,
            flexShrink: 0,
          }}
        >
          Instaleaza
        </motion.button>
      )}
    </div>
  );
}

export default function UpdateModal() {
  const theme = useTheme();
  const {
    showUpdateModal, setShowUpdateModal,
    status, localVersion, manifest, downloadPercent, error,
    checkForUpdate, downloadUpdate, applyUpdate, dismiss,
    installedContentIds, contentInstalling, setContentInstalling, markContentInstalled,
  } = useUpdateStore();
  const addQuiz = useQuizStore((s) => s.addQuiz);
  const { addFolder } = useFolderStore();

  const [contentError, setContentError] = useState<string | null>(null);

  const contentUpdates = manifest?.contentUpdates ?? [];
  const latestVersion = manifest?.latestVersion ?? manifest?.version ?? localVersion;
  const nextVersion = manifest?.version ?? localVersion;
  const hasSystemUpdate = ['available', 'downloading', 'ready', 'error'].includes(status);
  const hasContent = contentUpdates.length > 0;

  const close = () => {
    setShowUpdateModal(false);
    setContentError(null);
  };

  const handleInstallContent = async (pack: ContentUpdate) => {
    setContentError(null);
    setContentInstalling(pack.id);
    try {
      saveRollbackSnapshot(
        useQuizStore.getState().quizzes,
        useQuizStore.getState().sessions,
        useFolderStore.getState().folders,
        `Inainte de instalare: ${pack.subject}`,
      );

      const data = await fetchContentPack(pack.url);
      const existingFolder = useFolderStore.getState().folders.find((f) => f.name.toLowerCase() === pack.subject.toLowerCase());
      const folderId = existingFolder?.id ?? addFolder(pack.subject, pack.emoji, pack.color);

      for (const q of data.quizzes ?? []) {
        const quiz: Quiz = {
          id: uid(),
          title: q.title ?? `${pack.subject} - Set`,
          description: q.description ?? '',
          emoji: pack.emoji,
          category: pack.subject.toLowerCase(),
          folderId,
          questions: (q.questions ?? []).map((qn) => ({
            ...(qn as object),
            id: uid(),
          })) as Quiz['questions'],
          createdAt: Date.now(),
          color: pack.color,
          tags: [pack.subject.toLowerCase()],
        };
        addQuiz(quiz);
      }

      markContentInstalled(pack.id);
    } catch (err: unknown) {
      setContentError(err instanceof Error ? err.message : 'Eroare la instalare');
    } finally {
      setContentInstalling(null);
    }
  };

  return (
    <Portal>
      <AnimatePresence>
        {showUpdateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 20,
              background: 'rgba(0,0,0,0.60)',
              backdropFilter: 'blur(10px)',
            }}
          >
            <motion.div
              initial={{ scale: 0.94, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.94, opacity: 0, y: 20 }}
              transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                maxWidth: 680,
                maxHeight: '90vh',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                borderRadius: 28,
                background: theme.modalBg,
                border: `1px solid ${theme.border}`,
                boxShadow: '0 40px 120px rgba(0,0,0,0.45)',
              }}
            >
              <div
                style={{
                  padding: '22px 24px 18px',
                  borderBottom: `1px solid ${theme.border}`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  background: `linear-gradient(135deg, ${theme.accent}10 0%, transparent 60%)`,
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 14,
                    background: `linear-gradient(135deg, ${theme.accent}30, ${theme.accent2}30)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Package2 size={20} color={theme.accent} />
                </div>
                <div style={{ flex: 1 }}>
                  <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: theme.text }}>
                    Centru actualizari
                  </h2>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: theme.text3 }}>
                    Vezi clar versiunea curenta, urmatorul pas si ultima versiune publicata.
                  </p>
                </div>
                <motion.button
                  whileHover={{ scale: 1.1, rotate: 15 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => checkForUpdate()}
                   title="Verifica actualizari"
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 12,
                    border: 'none',
                    cursor: 'pointer',
                    background: theme.surface2,
                    color: theme.text3,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {status === 'checking' ? (
                    <motion.span animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                      <RefreshCw size={15} />
                    </motion.span>
                  ) : (
                    <RefreshCw size={15} />
                  )}
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.1, rotate: 90 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={close}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 12,
                    border: 'none',
                    cursor: 'pointer',
                    background: theme.surface2,
                    color: theme.text3,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <X size={15} />
                </motion.button>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px 24px', minHeight: 0 }} className="custom-scrollbar">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10, marginBottom: 18 }}>
                  <VersionPill label="Curenta" value={localVersion} tone={theme.text} />
                  <VersionPill label="Urmatoarea" value={nextVersion} tone={theme.accent} />
                  <VersionPill label="Ultima publicata" value={latestVersion} tone={theme.success} />
                </div>

                <div style={{ marginBottom: hasContent ? 28 : 0 }}>
                  <div style={{
                    fontSize: 11, fontWeight: 700, color: theme.text3,
                    textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 20,
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}>
                    <Package2 size={12} />
                    Actualizare Sistem
                  </div>

                  <AnimatePresence mode="wait">
                    {/* Error State */}
                    {status === 'error' && error && (
                      <motion.div key="error"
                        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                        style={{
                          background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.25)',
                          borderRadius: 14, padding: '18px 20px',
                        }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                          <AlertCircle size={16} color="#ef4444" />
                          <span style={{ fontSize: 14, fontWeight: 700, color: '#ef4444' }}>
                            Eroare actualizare
                          </span>
                        </div>
                        <p style={{ margin: '0 0 14px', fontSize: 13, color: theme.text2 }}>{error}</p>
                        <button
                          onClick={() => { dismiss(); checkForUpdate(); }}
                          style={{
                            padding: '8px 16px', borderRadius: 10, border: '1px solid rgba(239,68,68,0.3)',
                            background: 'rgba(239,68,68,0.08)', color: '#ef4444',
                            cursor: 'pointer', fontSize: 13, fontWeight: 600,
                          }}
                        >
                          Incearca din nou
                        </button>
                      </motion.div>
                    )}

                    {/* Up to date State */}
                    {(status === 'up-to-date' || (status === 'idle' && !hasSystemUpdate)) && (
                      <motion.div key="up-to-date"
                        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                        style={{
                          background: `${theme.success}0D`, border: `1px solid ${theme.success}25`,
                          borderRadius: 14, padding: '18px 20px',
                          display: 'flex', alignItems: 'center', gap: 12,
                        }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                          background: `${theme.success}20`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <Check size={18} color={theme.success} />
                        </div>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: theme.text }}>
                            Aplicatia este la zi
                          </div>
                          <div style={{ fontSize: 12, color: theme.text3, marginTop: 2 }}>
                            Versiunea {localVersion} este cea mai recenta.
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {/* Wizard State */}
                    {(status === 'checking' || status === 'available' || status === 'downloading' || status === 'ready') && (
                      <motion.div key="wizard"
                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                        style={{
                           background: theme.surface2,
                           borderRadius: 16,
                           padding: '24px',
                           border: `1px solid ${theme.border}`,
                        }}
                      >
                        {[
                          { id: 'checking', label: 'Verificare', icon: RefreshCw },
                          { id: 'available', label: 'Noua versiune', icon: Sparkles },
                          { id: 'downloading', label: 'Descarcare', icon: Download },
                          { id: 'ready', label: 'Finalizare', icon: RotateCcw }
                        ].map((step, idx, arr) => {
                          const currentIdx = status === 'checking' ? 0 : status === 'available' ? 1 : status === 'downloading' ? 2 : 3;
                          const isActive = idx === currentIdx;
                          const isDone = idx < currentIdx;
                          const isFuture = idx > currentIdx;

                          return (
                            <div key={step.id} style={{ display: 'flex', gap: 16, position: 'relative' }}>
                              {/* Connector line */}
                              {idx < arr.length - 1 && (
                                <div style={{
                                  position: 'absolute', left: 19, top: 40, bottom: -8, width: 2,
                                  background: theme.border, borderRadius: 2, zIndex: 0
                                }}>
                                  <motion.div
                                    initial={{ height: 0 }}
                                    animate={{ height: isDone ? '100%' : '0%' }}
                                    transition={{ duration: 0.4 }}
                                    style={{ width: '100%', background: theme.accent, borderRadius: 2 }}
                                  />
                                </div>
                              )}

                              {/* Step Node */}
                              <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <div style={{
                                  width: 40, height: 40, borderRadius: '50%',
                                  background: isActive ? theme.accent : isDone ? theme.success : theme.surface,
                                  color: isActive || isDone ? '#fff' : theme.text3,
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  boxShadow: isActive ? `0 0 0 4px ${theme.accent}33, 0 4px 12px ${theme.accent}66` : `0 2px 8px rgba(0,0,0,0.1)`,
                                  border: isFuture ? `1px solid ${theme.border}` : 'none',
                                  transition: 'all 0.3s ease'
                                }}>
                                  {/* Pulse effect */}
                                  {isActive && (
                                    <motion.div
                                      animate={{ scale: [1, 1.4, 1], opacity: [0.6, 0, 0.6] }}
                                      transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                                      style={{ position: 'absolute', inset: -2, borderRadius: '50%', border: `2px solid ${theme.accent}` }}
                                    />
                                  )}
                                  {isDone ? <Check size={20} /> : <step.icon size={18} />}
                                </div>
                              </div>

                              {/* Content */}
                              <div style={{ flex: 1, paddingBottom: idx === arr.length - 1 ? 0 : 28, paddingTop: 8, opacity: isFuture ? 0.5 : 1 }}>
                                <div style={{ fontSize: 15, fontWeight: isActive ? 800 : 600, color: isActive ? theme.accent : theme.text, display: 'flex', alignItems: 'center', gap: 8 }}>
                                   {step.label}
                                   {isActive && status === 'checking' && (
                                      <motion.span animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                                         <RefreshCw size={12} color={theme.accent} />
                                      </motion.span>
                                   )}
                                </div>

                                <AnimatePresence mode="sync">
                                  {isActive && (
                                    <motion.div
                                      initial={{ opacity: 0, height: 0, marginTop: 0 }}
                                      animate={{ opacity: 1, height: 'auto', marginTop: 12 }}
                                      exit={{ opacity: 0, height: 0, marginTop: 0 }}
                                      style={{ overflow: 'hidden' }}
                                    >
                                      {/* --- Checking --- */}
                                      {status === 'checking' && (
                                        <div style={{ fontSize: 13, color: theme.text2 }}>
                                          Ne conectam la server pentru a cauta cea mai noua versiune...
                                        </div>
                                      )}

                                      {/* --- Available --- */}
                                      {status === 'available' && manifest && (
                                        <div style={{
                                           background: theme.surface, borderRadius: 12, padding: 16,
                                           border: `1px solid ${theme.border}`
                                        }}>
                                           <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                                              <StatusDot color={theme.accent} />
                                              <span style={{ fontSize: 16, fontWeight: 800, color: theme.text }}>v{manifest.version}</span>
                                              <span style={{ fontSize: 12, color: theme.text3 }}>{manifest.releaseDate}</span>
                                           </div>

                                           {manifest.changes?.length > 0 && (
                                             <ul style={{ margin: '0 0 16px', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
                                               {manifest.changes.map((c, i) => (
                                                 <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: theme.text2, lineHeight: 1.5 }}>
                                                   <ChevronRight size={14} color={theme.accent} style={{ flexShrink: 0, marginTop: 2 }} />
                                                   {c}
                                                 </li>
                                               ))}
                                             </ul>
                                           )}

                                           {manifest.isSequential && (manifest.stepsRemaining ?? 0) > 1 && (
                                             <div style={{
                                               fontSize: 12, color: theme.warning, background: `${theme.warning}12`,
                                               border: `1px solid ${theme.warning}30`, borderRadius: 8, padding: '8px 10px', marginBottom: 16
                                             }}>
                                                Upgrade secvential ({manifest.stepsRemaining} pasi ramasi pana la ultima versiune).
                                             </div>
                                           )}

                                           <motion.button
                                             onClick={downloadUpdate}
                                             whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                                             style={{
                                               width: '100%', padding: '10px 16px', borderRadius: 10, border: 'none',
                                               cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#fff',
                                               background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})`,
                                               display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                               boxShadow: `0 4px 12px ${theme.accent}40`,
                                             }}
                                           >
                                              <Download size={15} /> Incepe descarcarea
                                           </motion.button>
                                        </div>
                                      )}

                                      {/* --- Downloading --- */}
                                      {status === 'downloading' && (
                                        <div style={{
                                           background: theme.surface, borderRadius: 12, padding: 16,
                                           border: `1px solid ${theme.border}`
                                        }}>
                                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, alignItems: 'center' }}>
                                            <span style={{ fontSize: 13, fontWeight: 600, color: theme.text }}>Se descarca pachetul...</span>
                                            <span style={{ fontSize: 13, fontWeight: 800, color: theme.accent, fontFamily: 'monospace' }}>{downloadPercent}%</span>
                                          </div>
                                          <div style={{ height: 6, borderRadius: 3, background: theme.surface2, overflow: 'hidden' }}>
                                            <motion.div
                                              style={{ height: '100%', borderRadius: 3, background: `linear-gradient(90deg, ${theme.accent}, ${theme.accent2})` }}
                                              animate={{ width: `${downloadPercent}%` }}
                                              transition={{ duration: 0.2 }}
                                            />
                                          </div>
                                        </div>
                                      )}

                                      {/* --- Ready --- */}
                                      {status === 'ready' && (
                                        <div style={{
                                           background: `${theme.success}10`, borderRadius: 12, padding: 16,
                                           border: `1px solid ${theme.success}30`
                                        }}>
                                          <p style={{ margin: '0 0 16px', fontSize: 13, color: theme.text2 }}>
                                            Pachetul a fost descarcat cu succes. Reporneste aplicatia pentru a aplica modificarile.
                                          </p>
                                          <motion.button
                                            onClick={applyUpdate}
                                            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                                            style={{
                                              width: '100%', padding: '10px 16px', borderRadius: 10, border: 'none',
                                              cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#fff',
                                              background: `linear-gradient(135deg, ${theme.success}, ${theme.accent})`,
                                              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                              boxShadow: `0 4px 12px ${theme.success}40`,
                                            }}
                                          >
                                            <RotateCcw size={15} /> Reporneste StudyX
                                          </motion.button>
                                        </div>
                                      )}
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            </div>
                          );
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {hasContent && (
                  <div>
                    <div style={{ height: 1, background: theme.border, marginBottom: 24 }} />
                    <div style={{ fontSize: 11, fontWeight: 700, color: theme.text3, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>
                      Continut optional
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {contentUpdates.map((pack) => (
                        <ContentPackCard
                          key={pack.id}
                          pack={pack}
                          installed={installedContentIds.includes(pack.id)}
                          installing={contentInstalling === pack.id}
                          onInstall={() => handleInstallContent(pack)}
                        />
                      ))}
                    </div>

                    {contentError && (
                      <div
                        style={{
                          marginTop: 12,
                          padding: '12px 16px',
                          borderRadius: 12,
                          background: 'rgba(239,68,68,0.08)',
                          border: '1px solid rgba(239,68,68,0.20)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          fontSize: 13,
                          color: '#ef4444',
                        }}
                      >
                        <AlertCircle size={14} />
                        {contentError}
                      </div>
                    )}

                    <div
                      style={{
                        marginTop: 16,
                        padding: '12px 16px',
                        borderRadius: 12,
                        background: theme.surface2,
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 10,
                      }}
                    >
                      <ArrowDownCircle size={14} color={theme.text3} style={{ flexShrink: 0, marginTop: 1 }} />
                      <p style={{ margin: 0, fontSize: 12, color: theme.text3, lineHeight: 1.6 }}>
                        La instalarea unui pachet optional se creeaza automat un folder pentru materie si se salveaza un snapshot de rollback.
                      </p>
                    </div>
                  </div>
                )}

                {!hasContent && !hasSystemUpdate && status !== 'checking' && (
                  <div style={{ textAlign: 'center', padding: '14px 0 4px', fontSize: 13, color: theme.text3 }}>
                    Nu exista continut optional disponibil momentan.
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Portal>
  );
}
