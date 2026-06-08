import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Key, Cpu, Eye, EyeOff, ExternalLink, Check, 
  Library, Trash2, Upload, FileText, Image,
  Loader2
} from 'lucide-react';
import { useTheme } from '../theme/ThemeContext';
import { useAIStore, type AIModel, type AIProvider } from '../store/aiStore';
import Portal from './Portal';

const PROVIDERS: { id: AIProvider; name: string; desc: string; keyHint: string; docs: string }[] = [
  {
    id: 'groq',
    name: 'Groq',
    desc: 'Rapid pentru chat si generare de grile',
    keyHint: 'gsk_...',
    docs: 'https://console.groq.com/keys',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    desc: 'Rationament puternic pentru explicatii si sinteze',
    keyHint: 'sk-...',
    docs: 'https://platform.deepseek.com/api_keys',
  },
];

const MODELS: Record<AIProvider, { id: AIModel; name: string; desc: string; speed: string }[]> = {
  groq: [
    { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', desc: 'Cel mai inteligent', speed: 'Rapid' },
    { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B', desc: 'Ultra rapid', speed: 'Instant' },
    { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', desc: 'Echilibrat, context mare', speed: 'Rapid' },
  ],
  deepseek: [
    { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner', desc: 'Cel mai bun pentru raționament', speed: 'Smart' },
    { id: 'deepseek-chat', name: 'DeepSeek Chat', desc: 'Rapid pentru chat și sinteze', speed: 'Rapid' },
  ],
};

interface AISettingsProps {
  open: boolean;
  onClose: () => void;
}

export default function AISettings({ open, onClose }: AISettingsProps) {
  const theme = useTheme();
  const {
    apiKey, provider, model, setApiKey, setProvider, setModel,
    knowledgeSources, addKnowledgeSource, removeKnowledgeSource
  } = useAIStore();
  
  const [draft, setDraft] = useState(apiKey);
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const [libraryError, setLibraryError] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processStep, setProcessProcessingStep] = useState('');
  
  const fileRef = useRef<HTMLInputElement>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (open) setDraft(apiKey);
  }, [open, apiKey]);

  useEffect(() => () => {
    if (savedTimerRef.current) {
      clearTimeout(savedTimerRef.current);
    }
  }, []);

  const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number, message: string) => {
    let timeoutId: ReturnType<typeof window.setTimeout>;
    try {
      return await Promise.race<T>([
        promise,
        new Promise<T>((_, reject) => {
          timeoutId = window.setTimeout(() => reject(new Error(message)), timeoutMs);
        }),
      ]);
    } finally {
      window.clearTimeout(timeoutId!);
    }
  };

  const activeProvider = PROVIDERS.find((entry) => entry.id === provider) ?? PROVIDERS[0];
  const modelOptions = MODELS[provider] ?? MODELS.groq;
  const isValidKey = (k: string) => {
    const trimmed = k.trim();
    if (!trimmed) return true;
    return provider === 'groq'
      ? trimmed.startsWith('gsk_') && trimmed.length > 20
      : trimmed.startsWith('sk-') && trimmed.length > 20;
  };
  const keyInvalid = draft.trim().length > 0 && !isValidKey(draft);

  const handleSave = () => {
    const trimmed = draft.trim();
    if (trimmed && !isValidKey(trimmed)) {
      setSaved(false);
      return;
    }
    setApiKey(trimmed);
    setSaved(true);
    if (savedTimerRef.current) {
      clearTimeout(savedTimerRef.current);
    }
    savedTimerRef.current = setTimeout(() => setSaved(false), 2000);
  };

  const handleKnowledgeFile = async (file: File) => {
    setIsProcessing(true);
    setLibraryError('');
    
    try {
      const name = file.name.toLowerCase();
      const isPdf = name.endsWith('.pdf');
      const isDocx = name.endsWith('.docx');
      const isImage = /\.(jpe?g|png|webp|bmp)$/i.test(name);
      
      let text = '';
      let type: 'txt' | 'pdf' | 'docx' | 'image' = 'txt';

      setProcessProcessingStep('Citim fișierul...');
      if (isPdf) {
        const { parsePDF } = await import('../ai/pdfParser');
        text = await withTimeout(parsePDF(file), 20000, `Importul PDF pentru ${file.name} a expirat.`);
        type = 'pdf';
      } else if (isDocx) {
        const { parseDocx } = await import('../ai/docxParser');
        text = await withTimeout(parseDocx(file), 15000, `Importul DOCX pentru ${file.name} a expirat.`);
        type = 'docx';
      } else if (isImage) {
        setProcessProcessingStep('Analizăm imaginea (OCR)...');
        const { parseImageOCR } = await import('../ai/ocrParser');
        text = await withTimeout(parseImageOCR(file), 60000, `OCR-ul pentru ${file.name} a expirat.`);
        type = 'image';
      } else {
        text = await withTimeout(file.text(), 10000, `Citirea fisierului ${file.name} a expirat.`);
      }

      if (text.trim().length < 20) {
        throw new Error('Conținut insuficient.');
      }

      setProcessProcessingStep('Fragmentăm și indexăm...');
      await withTimeout(
        addKnowledgeSource(file.name, text, type),
        20000,
        `Indexarea pentru ${file.name} s-a blocat. Incearca din nou dupa restart.`,
      );
    } catch (err: unknown) {
      setLibraryError(err instanceof Error ? err.message : 'Eroare la import.');
    } finally {
      setIsProcessing(false);
      setProcessProcessingStep('');
    }
  };

  const importPdf = () => {
    fileRef.current?.setAttribute('accept', '.pdf');
    fileRef.current?.click();
  };

  const importDocx = () => {
    fileRef.current?.setAttribute('accept', '.docx');
    fileRef.current?.click();
  };

  const importImage = () => {
    fileRef.current?.setAttribute('accept', 'image/*');
    fileRef.current?.click();
  };

  const importTxt = () => {
    fileRef.current?.setAttribute('accept', '.txt,.md');
    fileRef.current?.click();
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
              onClick={onClose}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.93, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.93, y: 20 }}
              transition={{ type: 'spring', stiffness: 360, damping: 28 }}
              className="fixed z-[201] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-xl rounded-[28px] shadow-2xl overflow-hidden flex flex-col premium-modal"
              style={{
                maxHeight: '85vh',
                WebkitAppRegion: 'no-drag',
              } as React.CSSProperties}
            >
              <input
                ref={fileRef}
                type="file"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleKnowledgeFile(file);
                  e.target.value = '';
                }}
              />

              {/* Header */}
              <div className="flex items-center justify-between p-6 pb-4 border-b" style={{ borderColor: theme.border }}>
                <div>
                  <h2 className="text-lg font-black tracking-tight" style={{ color: theme.text }}>Setări AI</h2>
                  <p className="text-[10px] font-bold uppercase tracking-wider opacity-50" style={{ color: theme.text }}>
                    Provider, model si biblioteca AI
                  </p>
                </div>
                <motion.button
                  whileHover={{ rotate: 90, scale: 1.1, background: theme.surface }}
                  whileTap={{ scale: 0.9 }}
                  onClick={onClose}
                  className="p-2 rounded-2xl transition-all"
                  style={{ color: theme.text3, background: theme.surface2, border: `1px solid ${theme.border}`, cursor: 'pointer' }}
                >
                  <X size={16} />
                </motion.button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-6 pt-5 custom-scrollbar" style={{ minHeight: 0 }}>
                {/* API Key */}
                <div className="mb-6">
                  <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.1em] mb-2.5 opacity-60" style={{ color: theme.text }}>
                    <Key size={12} /> Cheie API {activeProvider.name}
                  </label>
                  <div className="relative">
                    <input
                      type={showKey ? 'text' : 'password'}
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                      placeholder={activeProvider.keyHint}
                      className="w-full px-4 py-3 rounded-2xl text-sm pr-10 font-medium"
                      style={{ background: theme.surface2, border: `1px solid ${theme.border}`, color: theme.text, outline: 'none' }}
                    />
                    <button onClick={() => setShowKey(!showKey)} className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg hover:bg-white/5 transition-colors" style={{ color: theme.text3 }}>
                      {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  <a href={activeProvider.docs} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[11px] font-bold mt-2.5 hover:underline" style={{ color: theme.accent }}>
                    <ExternalLink size={11} /> Deschide pagina pentru cheie
                  </a>
                  {keyInvalid && (
                    <p className="mt-2 text-[11px] font-bold" style={{ color: theme.danger }}>
                      Cheia nu se potrivește cu providerul selectat.
                    </p>
                  )}
                </div>

                <div className="mb-6">
                  <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.1em] mb-2.5 opacity-60" style={{ color: theme.text }}>
                    <Cpu size={12} /> Provider AI
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {PROVIDERS.map((entry) => {
                      const active = provider === entry.id;
                      return (
                        <button
                          key={entry.id}
                          onClick={() => {
                            setProvider(entry.id);
                            setSaved(false);
                          }}
                          className="flex min-h-[82px] items-start gap-3 rounded-2xl px-4 py-3 text-left transition-all"
                          style={{
                            background: active ? `${theme.accent}14` : theme.surface2,
                            border: `1px solid ${active ? theme.accent + '50' : theme.border}`,
                          }}
                        >
                          <div className="flex-1">
                            <p className="text-sm font-black" style={{ color: theme.text }}>{entry.name}</p>
                            <p className="mt-1 text-[11px] font-medium leading-5 opacity-60" style={{ color: theme.text }}>{entry.desc}</p>
                          </div>
                          {active && <div className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 shadow-lg"><Check size={12} color="white" strokeWidth={4} /></div>}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Model Selection */}
                <div className="mb-8">
                  <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.1em] mb-2.5 opacity-60" style={{ color: theme.text }}>
                    <Cpu size={12} /> Model AI
                  </label>
                  <div className="space-y-2">
                    {modelOptions.map((m) => (
                      <button key={m.id} onClick={() => setModel(m.id)} className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-left transition-all"
                        style={{
                          background: model === m.id ? `${theme.accent}14` : theme.surface2,
                          border: `1px solid ${model === m.id ? theme.accent + '50' : theme.border}`,
                        }}>
                        <div className="flex-1">
                          <p className="text-sm font-bold" style={{ color: theme.text }}>{m.name}</p>
                          <p className="text-[11px] font-medium opacity-50" style={{ color: theme.text }}>{m.desc} · {m.speed}</p>
                        </div>
                        {model === m.id && <div className="w-6 h-6 rounded-full flex items-center justify-center bg-blue-500 shadow-lg"><Check size={12} color="white" strokeWidth={4} /></div>}
                      </button>
                    ))}
                  </div>
                </div>

                <motion.button whileHover={{ scale: keyInvalid ? 1 : 1.02 }} whileTap={{ scale: keyInvalid ? 1 : 0.97 }} onClick={handleSave} disabled={keyInvalid} className="w-full py-3.5 rounded-2xl font-black text-sm text-white shadow-xl mb-8 disabled:opacity-45"
                  style={{ background: saved ? theme.success : keyInvalid ? theme.surface2 : `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})`, color: keyInvalid ? theme.text3 : '#fff' }}>
                  {saved ? 'Salvat!' : 'Salvează Configurarea'}
                </motion.button>

                {/* Knowledge Library */}
                <div className="rounded-[28px] p-1 border" style={{ borderColor: theme.border, background: theme.isDark ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.03)' }}>
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2" style={{ color: theme.text }}>
                        <Library size={14} />
                        <span className="text-[11px] font-black uppercase tracking-[0.12em]">Biblioteca AI ({knowledgeSources.length})</span>
                      </div>
                    </div>

                    <motion.div
                      onDragEnter={() => setDragActive(true)}
                      onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                      onDragLeave={() => setDragActive(false)}
                      onDrop={(e) => { e.preventDefault(); setDragActive(false); const f = e.dataTransfer.files?.[0]; if (f) handleKnowledgeFile(f); }}
                      className="rounded-[24px] p-5 mb-4 text-center border-2 border-dashed transition-all"
                      style={{ 
                        borderColor: dragActive ? theme.accent : theme.border,
                        background: dragActive ? `${theme.accent}15` : theme.surface
                      }}
                    >
                      {isProcessing ? (
                        <div className="py-2">
                          <Loader2 size={24} className="animate-spin mx-auto mb-3" style={{ color: theme.accent }} />
                          <p className="text-sm font-bold" style={{ color: theme.text }}>{processStep}</p>
                        </div>
                      ) : (
                        <>
                          <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg"
                            style={{ background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})`, color: '#fff' }}>
                            <Upload size={20} />
                          </div>
                          <p className="text-sm font-black mb-4" style={{ color: theme.text }}>Încarcă materiale de studiu</p>
                          <div className="grid grid-cols-2 gap-2">
                            <button onClick={importPdf} className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black uppercase bg-blue-500 text-white"><Upload size={12} /> PDF</button>
                            <button onClick={importDocx} className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black uppercase bg-indigo-600 text-white"><FileText size={12} /> DOCX</button>
                            <button onClick={importImage} className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black uppercase bg-orange-500 text-white"><Image size={12} /> Imagine</button>
                            <button onClick={importTxt} className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black uppercase bg-emerald-600 text-white"><FileText size={12} /> TXT</button>
                          </div>
                        </>
                      )}
                    </motion.div>

                    {libraryError && <p className="text-[10px] font-bold text-red-500 mb-4 text-center">{libraryError}</p>}

                    <div className="space-y-2">
                      {knowledgeSources.slice().reverse().map(s => (
                        <div key={s.id} className="flex items-center gap-3 p-3 rounded-2xl border" style={{ background: theme.surface, borderColor: theme.border }}>
                          <FileText size={16} style={{ color: theme.accent }} />
                          <div className="flex-1 min-w-0 text-left">
                            <p className="text-xs font-bold truncate" style={{ color: theme.text }}>{s.name}</p>
                            <p className="text-[9px] opacity-50 uppercase font-black" style={{ color: theme.text }}>{s.charCount} caractere</p>
                            <p
                              className="mt-1 text-[9px] font-black uppercase"
                              style={{
                                color: s.indexStatus === 'error'
                                  ? theme.danger
                                  : s.indexStatus === 'indexing'
                                    ? theme.accent
                                    : theme.success,
                              }}
                            >
                              {s.indexStatus === 'error'
                                ? 'Import cu eroare'
                                : s.indexStatus === 'indexing'
                                  ? `Indexare ${Math.round(s.indexProgress ?? 0)}%`
                                  : 'Pregatit pentru AI'}
                            </p>
                          </div>
                          <button onClick={() => removeKnowledgeSource(s.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-500"><Trash2 size={14} /></button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </Portal>
  );
}
