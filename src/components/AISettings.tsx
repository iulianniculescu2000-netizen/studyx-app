import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Key, Cpu, Eye, EyeOff, ExternalLink, Check, Library, Trash2, Upload, FileText, Bug } from 'lucide-react';
import { useTheme } from '../theme/ThemeContext';
import { useAIStore, type AIModel } from '../store/aiStore';
import { parsePDF } from '../ai/pdfParser';
import Portal from './Portal';

const MODELS: { id: AIModel; name: string; desc: string; speed: string }[] = [
  { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', desc: 'Cel mai inteligent', speed: '⚡ Rapid' },
  { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B', desc: 'Ultra rapid', speed: '🚀 Instant' },
  { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', desc: 'Echilibrat, context mare', speed: '⚡ Rapid' },
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
  const fileRef = useRef<HTMLInputElement>(null);

  // Sync draft with store when modal opens (or when key changes externally)
  useEffect(() => {
    if (open) setDraft(apiKey);
  }, [open, apiKey]);

  const isValidKey = (k: string) => k.trim().startsWith('gsk_') && k.trim().length > 20;

  const handleSave = () => {
    const trimmed = draft.trim();
    if (trimmed && !isValidKey(trimmed)) {
      // Show inline error without closing — don't persist an invalid key
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
      setLibraryError('Fișierul este prea scurt sau nu conține text util.');
      return;
    }
    addKnowledgeSource(name, text, type);
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
          setLibraryError('Nu s-a putut citi fișierul text.');
          return;
        }
        addFromRaw(`TXT ${new Date().toLocaleString('ro-RO')}`, txt, 'txt');
        return;
      }
      fileRef.current?.click();
    } catch {
      setLibraryError('Eroare la importul fișierului text.');
    }
  };

  return (
    <Portal>
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200]"
            style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.93, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.93, y: 20 }}
            transition={{ type: 'spring', stiffness: 360, damping: 28 }}
            className="fixed z-[201] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md rounded-2xl p-6 shadow-2xl"
            style={{ background: theme.modalBg, border: `1px solid ${theme.border}` }}
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
                  const isPdf = file.name.toLowerCase().endsWith('.pdf');
                  const text = isPdf ? await parsePDF(file) : await file.text();
                  addFromRaw(file.name, text, isPdf ? 'pdf' : 'txt');
                } catch {
                  setLibraryError('Nu s-a putut citi fișierul selectat.');
                }
              }}
            />
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold" style={{ color: theme.text }}>Setări AI</h2>
                <p className="text-xs mt-0.5" style={{ color: theme.text3 }}>Powered by Groq — 14,400 req/zi gratuit</p>
              </div>
              <motion.button whileHover={{ rotate: 90, scale: 1.1 }} whileTap={{ scale: 0.88 }}
                onClick={onClose} className="p-2 rounded-xl" style={{ color: theme.text3, background: theme.surface2 }}>
                <X size={16} />
              </motion.button>
            </div>

            {/* API Key */}
            <div className="mb-5">
              <label className="flex items-center gap-1.5 text-xs font-semibold mb-2" style={{ color: theme.text2 }}>
                <Key size={12} />Cheie API Groq
              </label>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                  placeholder="gsk_..."
                  className="w-full px-3 py-2.5 rounded-xl text-sm pr-10"
                  style={{
                    background: theme.surface2,
                    border: `1px solid ${theme.border}`,
                    color: theme.text,
                    outline: 'none',
                  }}
                />
                <button
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: theme.text3 }}>
                  {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              {draft.trim() && !isValidKey(draft) && (
                <p className="text-xs mt-1" style={{ color: theme.danger }}>
                  Cheia trebuie să înceapă cu <code>gsk_</code>
                </p>
              )}
              <a
                href="https://console.groq.com/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs mt-1.5"
                style={{ color: theme.accent }}
              >
                <ExternalLink size={10} />Obține cheie gratuită la console.groq.com
              </a>
            </div>

            {/* Model picker */}
            <div className="mb-6">
              <label className="flex items-center gap-1.5 text-xs font-semibold mb-2" style={{ color: theme.text2 }}>
                <Cpu size={12} />Model AI
              </label>
              <div className="space-y-2">
                {MODELS.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setModel(m.id)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all"
                    style={{
                      background: model === m.id ? `${theme.accent}14` : theme.surface2,
                      border: `1px solid ${model === m.id ? theme.accent + '50' : 'transparent'}`,
                    }}>
                    <div className="flex-1">
                      <p className="text-sm font-medium" style={{ color: theme.text }}>{m.name}</p>
                      <p className="text-xs" style={{ color: theme.text3 }}>{m.desc} · {m.speed}</p>
                    </div>
                    {model === m.id && (
                      <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ background: theme.accent }}>
                        <Check size={11} color="white" strokeWidth={3} />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Save */}
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleSave}
              className="w-full py-3 rounded-xl font-semibold text-sm text-white flex items-center justify-center gap-2"
              style={{ background: saved ? theme.success : `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})` }}>
              {saved ? <><Check size={15} />Salvat!</> : 'Salvează'}
            </motion.button>

            <div className="mt-3 rounded-xl p-3" style={{ background: theme.surface2, border: `1px solid ${theme.border}` }}>
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

            {/* Knowledge library */}
            <div className="mt-4 rounded-xl p-3" style={{ background: theme.surface2, border: `1px solid ${theme.border}` }}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2" style={{ color: theme.text }}>
                  <Library size={14} />
                  <span className="text-xs font-semibold">Bibliotecă AI ({knowledgeSources.length})</span>
                </div>
                {knowledgeSources.length > 0 && (
                  <button
                    onClick={clearKnowledgeSources}
                    className="text-xs"
                    style={{ color: theme.danger }}
                  >
                    Șterge tot
                  </button>
                )}
              </div>
              <div className="flex gap-2 mb-2">
                <button
                  onClick={importPdf}
                  className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg"
                  style={{ background: `${theme.accent}14`, color: theme.accent, border: `1px solid ${theme.accent}30` }}
                >
                  <Upload size={11} />Import PDF
                </button>
                <button
                  onClick={importTxt}
                  className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg"
                  style={{ background: `${theme.accent2}14`, color: theme.accent2, border: `1px solid ${theme.accent2}30` }}
                >
                  <FileText size={11} />Import TXT/MD
                </button>
              </div>
              {libraryError && (
                <p className="text-xs mb-2" style={{ color: theme.danger }}>{libraryError}</p>
              )}
              <div style={{ maxHeight: 120, overflowY: 'auto' }}>
                {knowledgeSources.length === 0 ? (
                  <p className="text-xs" style={{ color: theme.text3 }}>
                    Adaugă PDF/TXT pentru context AI personalizat.
                  </p>
                ) : (
                  knowledgeSources.slice().reverse().map((s) => (
                    <div key={s.id} className="flex items-center gap-2 mb-1">
                      <span className="text-[11px] truncate" style={{ color: theme.text2, flex: 1 }}>
                        {s.name}
                      </span>
                      <button onClick={() => removeKnowledgeSource(s.id)} style={{ color: theme.text3 }}>
                        <Trash2 size={11} />
                      </button>
                    </div>
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
