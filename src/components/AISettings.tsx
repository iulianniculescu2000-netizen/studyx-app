import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Key,
  Cpu,
  Eye,
  EyeOff,
  ExternalLink,
  Check,
  Library,
  Trash2,
  Upload,
  FileText,
  Bug,
  Sparkles,
} from 'lucide-react';
import { useTheme } from '../theme/ThemeContext';
import { useAIStore, type AIKnowledgeSource, type AIModel } from '../store/aiStore';
import { parsePDF } from '../ai/pdfParser';
import Portal from './Portal';

const MODELS: { id: AIModel; name: string; desc: string; speed: string }[] = [
  { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', desc: 'Cel mai inteligent', speed: 'Rapid' },
  { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B', desc: 'Ultra rapid', speed: 'Instant' },
  { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', desc: 'Echilibrat, context mare', speed: 'Rapid' },
];

interface AISettingsProps {
  open: boolean;
  onClose: () => void;
}

export default function AISettings({ open, onClose }: AISettingsProps) {
  const theme = useTheme();
  const {
    apiKey, model, debugMode, setApiKey, setModel, setDebugMode,
    knowledgeSources, addKnowledgeSource, removeKnowledgeSource, clearKnowledgeSources,
  } = useAIStore();
  const [draft, setDraft] = useState(apiKey);
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const [libraryError, setLibraryError] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) setDraft(apiKey);
  }, [open, apiKey]);

  const isValidKey = (k: string) => k.trim().startsWith('gsk_') && k.trim().length > 20;

  const handleSave = () => {
    const trimmed = draft.trim();
    if (trimmed && !isValidKey(trimmed)) {
      setSaved(false);
      return;
    }
    setApiKey(trimmed);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const addFromRaw = (name: string, text: string, type: 'pdf' | 'txt' | 'manual') => {
    setLibraryError('');
    if (!text || text.trim().length < 60) {
      setLibraryError('Fisierul este prea scurt sau nu contine text util.');
      return;
    }
    addKnowledgeSource(name, text, type);
  };

  const handleKnowledgeFile = async (file: File) => {
    const isPdf = file.name.toLowerCase().endsWith('.pdf');
    const text = isPdf ? await parsePDF(file) : await file.text();
    addFromRaw(file.name, text, isPdf ? 'pdf' : 'txt');
  };

  const importPdf = async () => {
    setLibraryError('');
    try {
      if (window.electronAPI?.openPdfFile) {
        const text = await window.electronAPI.openPdfFile();
        if (!text) {
          setLibraryError('Nu s-a putut extrage text din PDF.');
          return;
        }
        addFromRaw(`PDF ${new Date().toLocaleString('ro-RO')}`, text, 'pdf');
        return;
      }
      fileRef.current?.click();
    } catch {
      setLibraryError('Eroare la importul PDF.');
    }
  };

  const importTxt = async () => {
    setLibraryError('');
    try {
      if (window.electronAPI?.openTextFile) {
        const txt = await window.electronAPI.openTextFile();
        if (!txt) {
          setLibraryError('Nu s-a putut citi fisierul text.');
          return;
        }
        addFromRaw(`TXT ${new Date().toLocaleString('ro-RO')}`, txt, 'txt');
        return;
      }
      fileRef.current?.click();
    } catch {
      setLibraryError('Eroare la importul fisierului text.');
    }
  };

  const summarizeWords = (content: string) => Math.max(1, Math.round(content.trim().split(/\s+/).length));

  const formatAddedAt = (value: number) =>
    new Date(value).toLocaleDateString('ro-RO', { day: '2-digit', month: 'short' });

  const fileTypeLabel = (type: AIKnowledgeSource['type']) => {
    if (type === 'pdf') return 'PDF';
    if (type === 'txt') return 'TXT';
    return 'MANUAL';
  };

  return (
    <Portal>
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[200]"
              style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
              onClick={onClose}
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.93, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.93, y: 20 }}
              transition={{ type: 'spring', stiffness: 360, damping: 28 }}
              className="fixed z-[201] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md rounded-[28px] p-6 shadow-2xl"
              style={{
                background: theme.modalBg,
                border: `1px solid ${theme.border}`,
                boxShadow: theme.isDark
                  ? '0 28px 80px rgba(0,0,0,0.42)'
                  : '0 30px 70px rgba(15,23,42,0.14)',
              }}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".txt,.md,.pdf"
                style={{ display: 'none' }}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.currentTarget.value = '';
                  if (!file) return;
                  try {
                    await handleKnowledgeFile(file);
                  } catch {
                    setLibraryError('Nu s-a putut citi fisierul selectat.');
                  }
                }}
              />

              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-bold" style={{ color: theme.text }}>Setari AI</h2>
                  <p className="text-xs mt-0.5" style={{ color: theme.text3 }}>
                    Powered by Groq. Contextul tau local ramane baza pentru raspunsuri.
                  </p>
                </div>
                <motion.button
                  whileHover={{ rotate: 90, scale: 1.08 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={onClose}
                  className="p-2 rounded-2xl"
                  style={{
                    color: theme.text3,
                    background: theme.surface2,
                    border: `1px solid ${theme.border}`,
                  }}
                >
                  <X size={16} />
                </motion.button>
              </div>

              <div className="mb-5">
                <label className="flex items-center gap-1.5 text-xs font-semibold mb-2" style={{ color: theme.text2 }}>
                  <Key size={12} />
                  Cheie API Groq
                </label>
                <div className="relative">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                    placeholder="gsk_..."
                    className="w-full px-3 py-2.5 rounded-2xl text-sm pr-10"
                    style={{
                      background: theme.surface2,
                      border: `1px solid ${theme.border}`,
                      color: theme.text,
                      outline: 'none',
                      boxShadow: theme.isDark ? 'inset 0 1px 0 rgba(255,255,255,0.05)' : 'inset 0 1px 0 rgba(255,255,255,0.7)',
                    }}
                  />
                  <button
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                    style={{ color: theme.text3 }}
                  >
                    {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                {draft.trim() && !isValidKey(draft) && (
                  <p className="text-xs mt-1" style={{ color: theme.danger }}>
                    Cheia trebuie sa inceapa cu <code>gsk_</code>
                  </p>
                )}
                <a
                  href="https://console.groq.com/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs mt-1.5"
                  style={{ color: theme.accent }}
                >
                  <ExternalLink size={10} />
                  Obtine cheie gratuita la console.groq.com
                </a>
              </div>

              <div className="mb-6">
                <label className="flex items-center gap-1.5 text-xs font-semibold mb-2" style={{ color: theme.text2 }}>
                  <Cpu size={12} />
                  Model AI
                </label>
                <div className="space-y-2">
                  {MODELS.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setModel(m.id)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-left transition-all"
                      style={{
                        background: model === m.id ? `${theme.accent}14` : theme.surface2,
                        border: `1px solid ${model === m.id ? theme.accent + '50' : theme.border}`,
                        boxShadow: model === m.id ? `0 14px 32px ${theme.accent}14` : 'none',
                      }}
                    >
                      <div className="flex-1">
                        <p className="text-sm font-medium" style={{ color: theme.text }}>{m.name}</p>
                        <p className="text-xs" style={{ color: theme.text3 }}>{m.desc} · {m.speed}</p>
                      </div>
                      {model === m.id && (
                        <div
                          className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{ background: theme.accent }}
                        >
                          <Check size={11} color="white" strokeWidth={3} />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleSave}
                className="w-full py-3 rounded-2xl font-semibold text-sm text-white flex items-center justify-center gap-2"
                style={{
                  background: saved ? theme.success : `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})`,
                  boxShadow: saved ? `0 18px 34px ${theme.success}24` : `0 20px 40px ${theme.accent}26`,
                }}
              >
                {saved ? <><Check size={15} />Salvat</> : 'Salveaza'}
              </motion.button>

              <div
                className="mt-3 rounded-2xl p-3"
                style={{
                  background: theme.surface2,
                  border: `1px solid ${theme.border}`,
                  boxShadow: theme.isDark ? 'inset 0 1px 0 rgba(255,255,255,0.05)' : 'inset 0 1px 0 rgba(255,255,255,0.8)',
                }}
              >
                <button
                  onClick={() => setDebugMode(!debugMode)}
                  className="w-full flex items-center justify-between text-left"
                  style={{ color: theme.text }}
                >
                  <span className="flex items-center gap-2 text-xs font-semibold">
                    <Bug size={12} />
                    Debug AI
                  </span>
                  <span className="text-xs" style={{ color: debugMode ? theme.success : theme.text3 }}>
                    {debugMode ? 'Activ' : 'Oprit'}
                  </span>
                </button>
              </div>

              <div
                className="mt-4 rounded-[24px] p-3"
                style={{
                  background: theme.surface2,
                  border: `1px solid ${theme.border}`,
                  boxShadow: theme.isDark
                    ? '0 22px 50px rgba(0,0,0,0.28)'
                    : '0 20px 48px rgba(15,23,42,0.10)',
                }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2" style={{ color: theme.text }}>
                    <Library size={14} />
                    <span className="text-xs font-semibold">Biblioteca AI ({knowledgeSources.length})</span>
                  </div>
                  {knowledgeSources.length > 0 && (
                    <button
                      onClick={clearKnowledgeSources}
                      className="text-xs px-2.5 py-1 rounded-full transition-all"
                      style={{
                        color: theme.danger,
                        background: `${theme.danger}12`,
                        border: `1px solid ${theme.danger}24`,
                      }}
                    >
                      Sterge tot
                    </button>
                  )}
                </div>

                <motion.div
                  whileHover={{ y: -2, scale: 1.01 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 24 }}
                  onDragEnter={(e) => {
                    e.preventDefault();
                    setDragActive(true);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragActive(true);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
                    setDragActive(false);
                  }}
                  onDrop={async (e) => {
                    e.preventDefault();
                    setDragActive(false);
                    const file = e.dataTransfer.files?.[0];
                    if (!file) return;
                    try {
                      await handleKnowledgeFile(file);
                    } catch {
                      setLibraryError('Nu s-a putut importa fisierul tras aici.');
                    }
                  }}
                  className="relative overflow-hidden rounded-[22px] p-4 mb-3"
                  style={{
                    border: `1px solid ${dragActive ? theme.accent : theme.border}`,
                    background: dragActive
                      ? `linear-gradient(135deg, ${theme.accent}1E, ${theme.accent2}18)`
                      : theme.isDark
                        ? `linear-gradient(135deg, ${theme.modalBg}, ${theme.surface})`
                        : `linear-gradient(135deg, rgba(255,255,255,0.96), ${theme.surface2})`,
                    boxShadow: dragActive
                      ? `0 0 0 1px ${theme.accent}40, 0 24px 48px ${theme.accent}24`
                      : theme.isDark
                        ? 'inset 0 1px 0 rgba(255,255,255,0.06), 0 18px 36px rgba(0,0,0,0.22)'
                        : 'inset 0 1px 0 rgba(255,255,255,0.78), 0 18px 36px rgba(15,23,42,0.08)',
                  }}
                >
                  <div
                    aria-hidden="true"
                    className="absolute inset-0"
                    style={{
                      background: dragActive
                        ? `radial-gradient(circle at top right, ${theme.accent}26, transparent 42%)`
                        : `radial-gradient(circle at top right, ${theme.accent}14, transparent 40%)`,
                      pointerEvents: 'none',
                    }}
                  />
                  <div className="relative flex items-start gap-3">
                    <motion.div
                      animate={dragActive ? { y: [-1, -6, -1] } : { y: 0 }}
                      transition={{ duration: 1.6, repeat: dragActive ? Infinity : 0 }}
                      className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
                      style={{
                        background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})`,
                        color: '#fff',
                        boxShadow: `0 14px 30px ${theme.accent}30`,
                      }}
                    >
                      <Upload size={18} />
                    </motion.div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-semibold" style={{ color: theme.text }}>
                          Adauga context pentru AI
                        </p>
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                          style={{
                            color: theme.accent,
                            background: `${theme.accent}14`,
                            border: `1px solid ${theme.accent}22`,
                          }}
                        >
                          <Sparkles size={10} />
                          Smart Library
                        </span>
                      </div>
                      <p className="text-xs leading-5 mb-3" style={{ color: theme.text3 }}>
                        Trage un PDF sau TXT aici ori importa manual. AI va folosi doar acest context ca baza de lucru.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={importPdf}
                          className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl transition-all"
                          style={{
                            background: `${theme.accent}16`,
                            color: theme.accent,
                            border: `1px solid ${theme.accent}30`,
                            boxShadow: `0 10px 20px ${theme.accent}14`,
                          }}
                        >
                          <Upload size={11} />
                          Import PDF
                        </button>
                        <button
                          onClick={importTxt}
                          className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl transition-all"
                          style={{
                            background: `${theme.accent2}16`,
                            color: theme.accent2,
                            border: `1px solid ${theme.accent2}30`,
                            boxShadow: `0 10px 20px ${theme.accent2}12`,
                          }}
                        >
                          <FileText size={11} />
                          Import TXT/MD
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {['PDF parsing', 'drag & drop', 'context grounding'].map((chip) => (
                          <span
                            key={chip}
                            className="text-[10px] px-2 py-1 rounded-full"
                            style={{
                              color: theme.text2,
                              background: theme.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.04)',
                              border: `1px solid ${theme.border}`,
                            }}
                          >
                            {chip}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>

                {libraryError && (
                  <p
                    className="text-xs mb-3 px-3 py-2 rounded-xl"
                    style={{
                      color: theme.danger,
                      background: `${theme.danger}10`,
                      border: `1px solid ${theme.danger}20`,
                    }}
                  >
                    {libraryError}
                  </p>
                )}

                <div style={{ maxHeight: 190, overflowY: 'auto' }}>
                  {knowledgeSources.length === 0 ? (
                    <div
                      className="rounded-2xl px-4 py-5 text-center"
                      style={{
                        border: `1px dashed ${theme.border2}`,
                        background: theme.isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.58)',
                      }}
                    >
                      <div
                        className="mx-auto mb-3 w-12 h-12 rounded-2xl flex items-center justify-center"
                        style={{
                          background: theme.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.05)',
                          color: theme.accent,
                        }}
                      >
                        <Library size={18} />
                      </div>
                      <p className="text-sm font-semibold mb-1" style={{ color: theme.text }}>
                        Biblioteca este goala
                      </p>
                      <p className="text-xs leading-5 max-w-[260px] mx-auto" style={{ color: theme.text3 }}>
                        Adauga cursuri, PDF-uri sau note scurte si transforma setarile AI intr-un centru de studiu real.
                      </p>
                    </div>
                  ) : (
                    knowledgeSources.slice().reverse().map((s) => (
                      <motion.div
                        key={s.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-3 mb-2 rounded-2xl px-3 py-2.5"
                        style={{
                          background: theme.isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.72)',
                          border: `1px solid ${theme.border}`,
                        }}
                      >
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                          style={{
                            background: s.type === 'pdf' ? `${theme.accent}14` : `${theme.accent2}14`,
                            color: s.type === 'pdf' ? theme.accent : theme.accent2,
                          }}
                        >
                          {s.type === 'pdf' ? <Upload size={15} /> : <FileText size={15} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[11px] font-semibold truncate" style={{ color: theme.text, flex: 1 }}>
                              {s.name}
                            </span>
                            <span
                              className="text-[10px] px-1.5 py-0.5 rounded-full shrink-0"
                              style={{
                                color: theme.text2,
                                background: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.05)',
                                border: `1px solid ${theme.border}`,
                              }}
                            >
                              {fileTypeLabel(s.type)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-[10px]" style={{ color: theme.text3 }}>
                            <span>{summarizeWords(s.content)} cuvinte</span>
                            <span>•</span>
                            <span>{formatAddedAt(s.addedAt)}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => removeKnowledgeSource(s.id)}
                          className="w-8 h-8 rounded-xl flex items-center justify-center transition-all"
                          style={{
                            color: theme.text3,
                            background: theme.isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.04)',
                            border: `1px solid ${theme.border}`,
                          }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </motion.div>
                    ))
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </Portal>
  );
}
