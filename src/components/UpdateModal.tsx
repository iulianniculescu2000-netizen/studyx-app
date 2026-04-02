/**
 * UpdateModal.tsx
 *
 * Premium update center — two sections:
 *   1. System Update  — version info, changelog, download / install
 *   2. Content Packs  — optional quiz bundles; installs with auto-folder creation
 *
 * Rendered via Portal so it always appears above every stacking context.
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Download, RefreshCw, Check, Package2, RotateCcw,
  AlertCircle, ArrowDownCircle, Sparkles, BookOpen,
  FolderPlus, ChevronRight,
} from 'lucide-react';
import { useTheme } from '../theme/ThemeContext';
import { useUpdateStore, type ContentUpdate } from '../store/updateStore';
import { useQuizStore } from '../store/quizStore';
import { useFolderStore } from '../store/folderStore';
import { saveRollbackSnapshot } from '../lib/rollback';
import Portal from './Portal';
import type { Quiz } from '../types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function uid() { return crypto.randomUUID().replace(/-/g, '').slice(0, 12); }

/** Downloads & parses a content pack JSON from GitHub */
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
  if (!res.ok) throw new Error(`Eroare rețea: HTTP ${res.status}`);
  return res.json();
}

// ── Sub-components ────────────────────────────────────────────────────────────

/** Pulsing status dot */
function PulseDot({ color }: { color: string }) {
  return (
    <motion.span
      animate={{ scale: [1, 1.5, 1], opacity: [1, 0.4, 1] }}
      transition={{ duration: 1.8, repeat: Infinity }}
      style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }}
    />
  );
}

/** A single content pack card */
function ContentPackCard({
  pack,
  installed,
  installing,
  justInstalled,
  onInstall,
}: {
  pack: ContentUpdate;
  installed: boolean;
  installing: boolean;
  justInstalled: boolean;
  onInstall: () => void;
}) {
  const theme = useTheme();

  const COLOR_MAP: Record<string, string> = {
    blue: '#0A84FF', purple: '#5E5CE6', green: '#30D158',
    orange: '#FF9F0A', pink: '#FF375F', red: '#FF453A', teal: '#5AC8FA',
  };
  const accent = COLOR_MAP[pack.color] ?? theme.accent;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        background: installed || justInstalled ? `${accent}08` : theme.surface2,
        border: `1px solid ${installed || justInstalled ? accent + '30' : theme.border}`,
        borderRadius: 14,
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
      }}
    >
      {/* Emoji bubble */}
      <div style={{
        width: 44, height: 44, borderRadius: 12, flexShrink: 0,
        background: `${accent}18`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 22,
      }}>
        {pack.emoji}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: theme.text }}>{pack.subject}</span>
          {(installed || justInstalled) && (
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
              background: `${theme.success}20`, color: theme.success,
            }}>✓ Instalat</span>
          )}
        </div>
        <div style={{ fontSize: 12, color: theme.text2, marginBottom: 4, lineHeight: 1.4 }}>
          {pack.description}
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: theme.text3 }}>
            <BookOpen size={10} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} />
            {pack.questionCount} {pack.questionCount === 1 ? 'întrebare' : 'întrebări'}
          </span>
          <span style={{ fontSize: 11, color: theme.text3 }}>
            <FolderPlus size={10} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} />
            Folder automat: {pack.subject}
          </span>
          <span style={{ fontSize: 11, color: theme.text3 }}>{pack.publishedAt}</span>
        </div>
      </div>

      {/* Action button */}
      <div style={{ flexShrink: 0 }}>
        {installed || justInstalled ? (
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: `${theme.success}20`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Check size={16} color={theme.success} />
          </div>
        ) : installing ? (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <RefreshCw size={16} color={theme.accent} />
          </motion.div>
        ) : (
          <motion.button
            onClick={onInstall}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.93 }}
            style={{
              padding: '8px 16px', borderRadius: 10, border: 'none', cursor: 'pointer',
              background: `linear-gradient(135deg, ${accent}, ${accent}CC)`,
              color: '#fff', fontSize: 13, fontWeight: 700,
              display: 'flex', alignItems: 'center', gap: 6,
              boxShadow: `0 4px 12px ${accent}40`,
            }}
          >
            <Download size={13} />
            Instalează
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────

export default function UpdateModal() {
  const theme = useTheme();

  const {
    showUpdateModal, setShowUpdateModal,
    status, localVersion, manifest, downloadPercent, error,
    checkForUpdate, downloadUpdate, applyUpdate, dismiss,
    installedContentIds, contentInstalling,
    setContentInstalling, markContentInstalled,
  } = useUpdateStore();

  const addQuiz = useQuizStore((s) => s.addQuiz);
  const { addFolder } = useFolderStore();

  const [contentError, setContentError] = useState<string | null>(null);
  const [justInstalledIds, setJustInstalledIds] = useState<Set<string>>(new Set());

  const contentUpdates = manifest?.contentUpdates ?? [];
  const hasSystemUpdate = status === 'available' || status === 'downloading' || status === 'ready' || status === 'error';
  const hasContent = contentUpdates.length > 0;

  const handleInstallContent = async (pack: ContentUpdate) => {
    setContentError(null);
    setContentInstalling(pack.id);
    try {
      // 1. Save rollback snapshot BEFORE any changes
      saveRollbackSnapshot(
        useQuizStore.getState().quizzes,
        useQuizStore.getState().sessions,
        useFolderStore.getState().folders,
        `Înainte de instalare: ${pack.subject}`,
      );

      // 2. Fetch the pack
      const data = await fetchContentPack(pack.url);

      // 3. Find or create the subject folder
      const existingFolder = useFolderStore.getState().folders
        .find((f) => f.name.toLowerCase() === pack.subject.toLowerCase());
      const folderId = existingFolder?.id ?? addFolder(pack.subject, pack.emoji, pack.color);

      // 4. Import quizzes with fresh IDs
      for (const q of data.quizzes ?? []) {
        const quiz: Quiz = {
          id: uid(),
          title: q.title ?? `${pack.subject} — Set`,
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

      // 5. Mark done
      markContentInstalled(pack.id);
      setJustInstalledIds((prev) => new Set([...prev, pack.id]));
    } catch (err: any) {
      setContentError(err.message ?? 'Eroare la instalare');
    } finally {
      setContentInstalling(null);
    }
  };

  const close = () => {
    setShowUpdateModal(false);
    setContentError(null);
  };

  return (
    <Portal>
      <AnimatePresence>
        {showUpdateModal && (
          <motion.div
            key="update-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
            style={{
              position: 'fixed', inset: 0, zIndex: 9999,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(0,0,0,0.60)', backdropFilter: 'blur(10px)',
              padding: '20px',
            }}
          >
            <motion.div
              key="update-modal-card"
              initial={{ scale: 0.92, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 20 }}
              transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              style={{
                background: theme.modalBg,
                borderRadius: 24,
                width: '100%',
                maxWidth: 640,
                maxHeight: '90vh',
                display: 'flex',
                flexDirection: 'column',
                border: `1px solid ${theme.border}`,
                boxShadow: '0 40px 120px rgba(0,0,0,0.5)',
                overflow: 'hidden',
              }}
            >
              {/* ── Header ── */}
              <div style={{
                padding: '22px 24px 18px',
                borderBottom: `1px solid ${theme.border}`,
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                background: `linear-gradient(135deg, ${theme.accent}08 0%, transparent 60%)`,
                flexShrink: 0,
              }}>
                <div style={{
                  width: 42, height: 42, borderRadius: 13, flexShrink: 0,
                  background: `linear-gradient(135deg, ${theme.accent}30, ${theme.accent2}30)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Package2 size={20} color={theme.accent} />
                </div>
                <div style={{ flex: 1 }}>
                  <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: theme.text }}>
                    Centru Actualizări
                  </h2>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: theme.text3 }}>
                    Versiune instalată: <span style={{ fontFamily: 'monospace', color: theme.accent }}>{localVersion}</span>
                  </p>
                </div>
                {/* Check button */}
                <motion.button
                  onClick={() => checkForUpdate()}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.93 }}
                  title="Verifică actualizări"
                  style={{
                    width: 34, height: 34, borderRadius: 10, border: 'none', cursor: 'pointer',
                    background: theme.surface2, color: theme.text3,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  {status === 'checking'
                    ? <motion.span animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                        <RefreshCw size={14} />
                      </motion.span>
                    : <RefreshCw size={14} />
                  }
                </motion.button>
                {/* Close button */}
                <motion.button
                  onClick={close}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.93 }}
                  style={{
                    width: 34, height: 34, borderRadius: 10, border: 'none', cursor: 'pointer',
                    background: theme.surface2, color: theme.text3,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <X size={15} />
                </motion.button>
              </div>

              {/* ── Scrollable body ── */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px 24px' }}>

                {/* ── SECTION 1: System update ── */}
                <div style={{ marginBottom: hasContent ? 28 : 0 }}>
                  <div style={{
                    fontSize: 11, fontWeight: 700, color: theme.text3,
                    textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14,
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}>
                    <Package2 size={12} />
                    Actualizare Sistem
                  </div>

                  <AnimatePresence mode="wait">
                  {/* Checking */}
                  {status === 'checking' && (
                    <motion.div key="checking"
                      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.18 }}
                      style={{
                        background: theme.surface2, borderRadius: 14, padding: '18px 20px',
                        display: 'flex', alignItems: 'center', gap: 12,
                      }}>
                      <motion.span animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                        <RefreshCw size={18} color={theme.accent} />
                      </motion.span>
                      <span style={{ fontSize: 14, color: theme.text2 }}>Se verifică actualizările...</span>
                    </motion.div>
                  )}

                  {/* Up to date */}
                  {(status === 'up-to-date' || status === 'idle') && !hasSystemUpdate && (
                    <motion.div key="up-to-date"
                      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.18 }}
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
                          Aplicația este la zi
                        </div>
                        <div style={{ fontSize: 12, color: theme.text3, marginTop: 2 }}>
                          Versiunea {localVersion} este cea mai recentă.
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Available */}
                  {status === 'available' && manifest && (
                    <motion.div key="available"
                      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.18 }}
                      style={{
                        background: `${theme.accent}08`, border: `1px solid ${theme.accent}25`,
                        borderRadius: 14, overflow: 'hidden',
                      }}>
                      {/* Version badge */}
                      <div style={{
                        padding: '16px 20px',
                        borderBottom: `1px solid ${theme.border}`,
                        display: 'flex', alignItems: 'center', gap: 12,
                      }}>
                        <PulseDot color={theme.accent} />
                        <div style={{ flex: 1 }}>
                          <span style={{ fontSize: 15, fontWeight: 800, color: theme.accent }}>
                            v{manifest.version}
                          </span>
                          {manifest.isSequential && manifest.latestVersion && manifest.latestVersion !== manifest.version && (
                            <span style={{ fontSize: 11, color: theme.text3, marginLeft: 8 }}>
                              (pas obligatoriu spre v{manifest.latestVersion})
                            </span>
                          )}
                          <span style={{ fontSize: 12, color: theme.text3, marginLeft: 10 }}>
                            {manifest.releaseDate}
                          </span>
                        </div>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                          background: `${theme.accent}20`, color: theme.accent,
                        }}>
                          NOU
                        </span>
                      </div>

                      {/* Changelog */}
                      {manifest.changes?.length > 0 && (
                        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${theme.border}` }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: theme.text3, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                            Noutăți
                          </div>
                          <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                            {manifest.changes.map((c, i) => (
                              <li key={i} style={{
                                display: 'flex', alignItems: 'flex-start', gap: 8,
                                fontSize: 13, color: theme.text2, lineHeight: 1.6,
                                marginBottom: i < manifest.changes.length - 1 ? 6 : 0,
                              }}>
                                <ChevronRight size={13} color={theme.accent} style={{ flexShrink: 0, marginTop: 2 }} />
                                {c}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Sequential upgrade hint */}
                      {manifest.isSequential && (manifest.stepsRemaining ?? 0) > 1 && (
                        <div style={{ padding: '12px 20px', borderBottom: `1px solid ${theme.border}` }}>
                          <div style={{
                            fontSize: 12,
                            color: theme.warning,
                            background: `${theme.warning}12`,
                            border: `1px solid ${theme.warning}30`,
                            borderRadius: 10,
                            padding: '8px 10px',
                          }}>
                            Upgrade secvențial activ: după instalarea acestei versiuni, verifică din nou pentru următorul pas
                            ({manifest.stepsRemaining} pași rămași).
                          </div>
                        </div>
                      )}

                      {/* Download button */}
                      <div style={{ padding: '14px 20px' }}>
                        <motion.button
                          onClick={downloadUpdate}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.97 }}
                          style={{
                            width: '100%', padding: '12px 20px', borderRadius: 12, border: 'none',
                            cursor: 'pointer', fontSize: 14, fontWeight: 700, color: '#fff',
                            background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                            boxShadow: `0 4px 16px ${theme.accent}40`,
                          }}
                        >
                          <Download size={15} />
                          Descarcă v{manifest.version}
                        </motion.button>
                      </div>
                    </motion.div>
                  )}

                  {/* Downloading */}
                  {status === 'downloading' && (
                    <motion.div key="downloading"
                      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.18 }}
                      style={{
                        background: `${theme.accent}08`, border: `1px solid ${theme.accent}25`,
                        borderRadius: 14, padding: '20px',
                      }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                        <motion.span animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                          <Download size={16} color={theme.accent} />
                        </motion.span>
                        <span style={{ fontSize: 14, fontWeight: 600, color: theme.text }}>
                          Se descarcă actualizarea...
                        </span>
                        <span style={{ marginLeft: 'auto', fontSize: 14, fontWeight: 700, color: theme.accent, fontFamily: 'monospace' }}>
                          {downloadPercent}%
                        </span>
                      </div>
                      <div style={{ height: 6, borderRadius: 3, background: theme.surface2, overflow: 'hidden' }}>
                        <motion.div
                          style={{ height: '100%', borderRadius: 3, background: `linear-gradient(90deg, ${theme.accent}, ${theme.accent2})` }}
                          animate={{ width: `${downloadPercent}%` }}
                          transition={{ duration: 0.4, ease: 'easeOut' }}
                        />
                      </div>
                      <p style={{ margin: '10px 0 0', fontSize: 11, color: theme.text3, textAlign: 'center' }}>
                        Nu închide aplicația în timpul descărcării
                      </p>
                    </motion.div>
                  )}

                  {/* Ready */}
                  {status === 'ready' && (
                    <motion.div key="ready"
                      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.18 }}
                      style={{
                        background: `${theme.success}0D`, border: `1px solid ${theme.success}25`,
                        borderRadius: 14, padding: '20px',
                      }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                        <Check size={18} color={theme.success} />
                        <span style={{ fontSize: 14, fontWeight: 700, color: theme.text }}>
                          Actualizare descărcată
                        </span>
                      </div>
                      <p style={{ margin: '0 0 14px', fontSize: 13, color: theme.text2 }}>
                        Repornește StudyX pentru a aplica noua versiune. Datele tale sunt salvate.
                      </p>
                      <motion.button
                        onClick={applyUpdate}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.97 }}
                        style={{
                          width: '100%', padding: '12px 20px', borderRadius: 12, border: 'none',
                          cursor: 'pointer', fontSize: 14, fontWeight: 700, color: '#fff',
                          background: `linear-gradient(135deg, ${theme.success}, ${theme.accent})`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                          boxShadow: `0 4px 16px ${theme.success}40`,
                        }}
                      >
                        <RotateCcw size={15} />
                        Repornește acum
                      </motion.button>
                    </motion.div>
                  )}

                  {/* Error */}
                  {status === 'error' && error && (
                    <motion.div key="error"
                      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.18 }}
                      style={{
                        background: `rgba(239,68,68,0.06)`, border: `1px solid rgba(239,68,68,0.25)`,
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
                          padding: '8px 16px', borderRadius: 10, border: `1px solid rgba(239,68,68,0.3)`,
                          background: 'rgba(239,68,68,0.08)', color: '#ef4444',
                          cursor: 'pointer', fontSize: 13, fontWeight: 600,
                        }}
                      >
                        Încearcă din nou
                      </button>
                    </motion.div>
                  )}
                  </AnimatePresence>
                </div>

                {/* ── SECTION 2: Content packs ── */}
                {hasContent && (
                  <div>
                    {/* Divider */}
                    <div style={{ height: 1, background: theme.border, marginBottom: 24 }} />

                    <div style={{
                      fontSize: 11, fontWeight: 700, color: theme.text3,
                      textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14,
                      display: 'flex', alignItems: 'center', gap: 8,
                    }}>
                      <Sparkles size={12} />
                      Conținut Opțional
                      <span style={{
                        marginLeft: 'auto', fontSize: 10, fontWeight: 600,
                        padding: '2px 8px', borderRadius: 20,
                        background: theme.surface2, color: theme.text3,
                      }}>
                        {installedContentIds.filter(id => contentUpdates.some(p => p.id === id)).length}/{contentUpdates.length} instalate
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {contentUpdates.map((pack) => (
                        <ContentPackCard
                          key={pack.id}
                          pack={pack}
                          installed={installedContentIds.includes(pack.id)}
                          installing={contentInstalling === pack.id}
                          justInstalled={justInstalledIds.has(pack.id)}
                          onInstall={() => handleInstallContent(pack)}
                        />
                      ))}
                    </div>

                    {/* Content install error */}
                    <AnimatePresence>
                      {contentError && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          style={{
                            marginTop: 12, padding: '12px 16px', borderRadius: 12,
                            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                            display: 'flex', alignItems: 'center', gap: 8,
                            fontSize: 13, color: '#ef4444',
                          }}
                        >
                          <AlertCircle size={14} />
                          {contentError}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Info note */}
                    <div style={{
                      marginTop: 16, padding: '12px 16px', borderRadius: 12,
                      background: theme.surface2,
                      display: 'flex', alignItems: 'flex-start', gap: 10,
                    }}>
                      <ArrowDownCircle size={14} color={theme.text3} style={{ flexShrink: 0, marginTop: 1 }} />
                      <p style={{ margin: 0, fontSize: 12, color: theme.text3, lineHeight: 1.6 }}>
                        Instalarea unui pachet de conținut creează automat un folder cu numele materiei și importă
                        toate grilele în el. Un snapshot de rollback este salvat automat înainte de fiecare instalare.
                      </p>
                    </div>
                  </div>
                )}

                {/* Empty state — no content updates and up to date */}
                {!hasContent && !hasSystemUpdate && status !== 'checking' && (
                  <div style={{
                    textAlign: 'center', padding: '16px 0 8px',
                    fontSize: 13, color: theme.text3,
                  }}>
                    Nu există conținut opțional disponibil momentan.
                  </div>
                )}

              </div>{/* end scrollable body */}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Portal>
  );
}
