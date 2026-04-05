import { motion, AnimatePresence } from 'framer-motion';
import { useState, useRef, useMemo } from 'react';
import {
  Library, Trash2, Search,
  Bot, Brain, Database, Plus,
  FileType, Loader2, Image, FileText, MessageSquare, X, ArrowRight
} from 'lucide-react';
import { useTheme } from '../theme/ThemeContext';
import { useAIStore, type AIKnowledgeSourceType } from '../store/aiStore';
import { useToastStore } from '../store/toastStore';
import { useUIStore } from '../store/uiStore';

export default function KnowledgeVault() {
  const theme = useTheme();
  const { knowledgeSources, addKnowledgeSource, removeKnowledgeSource } = useAIStore();
  const { addToast } = useToastStore();
  const setChatOpen = useUIStore((state) => state.setChatOpen);

  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [processStep, setProcessStep] = useState('');
  const [readerOpen, setReaderOpen] = useState(false);
  const [readerLoading, setReaderLoading] = useState(false);
  const [readerContent, setReaderContent] = useState('');
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const filtered = knowledgeSources
    .filter((source) =>
      source.name.toLowerCase().includes(search.toLowerCase())
      || source.preview.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => b.addedAt - a.addedAt);

  const sourceHealth = useMemo(() => {
    const lowQuality = knowledgeSources.filter((source) => (source.qualityScore ?? 60) < 65);
    const heavySources = knowledgeSources.filter((source) => source.charCount > 180000);
    const warningSources = knowledgeSources.filter((source) => (source.warnings?.length ?? 0) > 0);
    return {
      lowQuality,
      heavySources,
      warningSources,
      averageQuality: Math.round(
        knowledgeSources.reduce((acc, source) => acc + (source.qualityScore ?? 60), 0) / Math.max(knowledgeSources.length, 1),
      ),
    };
  }, [knowledgeSources]);

  const selectedSource = useMemo(
    () => knowledgeSources.find((source) => source.id === selectedSourceId) ?? null,
    [knowledgeSources, selectedSourceId],
  );

  const totalWords = knowledgeSources.reduce((acc, source) => acc + source.wordCount, 0);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    setLoading(true);

    try {
      for (const file of files) {
        const name = file.name.toLowerCase();
        const isPdf = name.endsWith('.pdf');
        const isDocx = name.endsWith('.docx');
        const isImage = /\.(jpe?g|png|webp|bmp)$/i.test(name);

        let text = '';
        let type: AIKnowledgeSourceType = 'txt';

        setProcessStep(`Citim ${file.name}...`);
        if (isPdf) {
          try {
            const { parsePDF } = await import('../ai/pdfParser');
            text = await parsePDF(file);
            type = 'pdf';
          } catch (pdfErr: unknown) {
            addToast(pdfErr instanceof Error ? pdfErr.message : 'Eroare PDF', 'error');
            continue;
          }
        } else if (isDocx) {
          const { parseDocx } = await import('../ai/docxParser');
          text = await parseDocx(file);
          type = 'docx';
        } else if (isImage) {
          setProcessStep(`Analizam imaginea (OCR)...`);
          const { parseImageOCR } = await import('../ai/ocrParser');
          text = await parseImageOCR(file);
          type = 'image';
        } else {
          text = await file.text();
        }

        if (text.trim().length < 5) {
          addToast(`Continut insuficient in ${file.name}`, 'warning');
          continue;
        }

        setProcessStep('Fragmentam si indexam...');
        await addKnowledgeSource(file.name, text, type);
        addToast(`"${file.name}" adaugat cu succes.`, 'success');
      }
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Eroare la procesarea fisierelor.', 'error');
    } finally {
      setLoading(false);
      setProcessStep('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const openReader = async (sourceId: string) => {
    setSelectedSourceId(sourceId);
    setReaderOpen(true);
    setReaderLoading(true);
    try {
      const { getVaultChunksBySource } = await import('../ai/vectorStore');
      const chunks = await getVaultChunksBySource(sourceId);
      const previewText = chunks
        .slice(0, 8)
        .map((chunk) => chunk.text.trim())
        .filter(Boolean)
        .join('\n\n');
      setReaderContent(previewText || 'Nu am gasit inca fragmente pentru aceasta sursa.');
    } catch (err) {
      console.error('[KnowledgeVault] Reader load failed:', err);
      setReaderContent('Nu am putut incarca continutul pentru aceasta sursa.');
    } finally {
      setReaderLoading(false);
    }
  };

  const askAIAboutSource = (sourceName: string) => {
    setChatOpen(true);
    window.dispatchEvent(new CustomEvent('studyx:ai-prompt', {
      detail: {
        open: true,
        prompt: `Analizeaza documentul "${sourceName}" si rezuma-mi ideile-cheie, punctele sensibile si ce merita invatat prioritar din el.`,
      },
    }));
  };

  return (
    <div className="h-full overflow-y-auto px-4 py-6 sm:px-8 sm:py-10">
      <div className="mx-auto max-w-5xl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <div className="mb-2 flex items-center gap-3">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-2xl shadow-lg"
                  style={{ background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})`, color: '#fff' }}
                >
                  <Database size={20} />
                </div>
                <h1 className="text-3xl font-black tracking-tight" style={{ color: theme.text }}>
                  Knowledge <span style={{ color: theme.accent }}>Vault</span>
                </h1>
              </div>
              <p className="max-w-md text-sm font-medium opacity-60" style={{ color: theme.text }}>
                Centrul tau local de date. AI-ul StudyX foloseste aceste documente pentru raspunsuri mai serioase, ancorate in cursurile tale.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setChatOpen(true)}
                className="flex items-center gap-2 rounded-2xl border px-5 py-3 font-bold transition-all"
                style={{ background: theme.surface2, borderColor: theme.border, color: theme.text2 }}
              >
                <MessageSquare size={18} /> Chat AI
              </motion.button>

              <input
                type="file"
                ref={fileInputRef}
                multiple
                accept=".pdf,.docx,.txt,.md,image/*"
                className="hidden"
                onChange={handleFileUpload}
              />

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                className="flex min-w-[180px] items-center justify-center gap-3 rounded-2xl px-6 py-3 font-black text-white shadow-xl transition-all"
                style={{ background: theme.accent, boxShadow: `0 8px 24px ${theme.accent}40` }}
              >
                {loading ? (
                  <><Loader2 size={18} className="animate-spin" /> {processStep.split(' ')[0]}...</>
                ) : (
                  <><Plus size={18} /> Adauga documente</>
                )}
              </motion.button>
            </div>
          </div>
        </motion.div>

        <div className="mb-10 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'Documente', value: knowledgeSources.length, icon: <Library size={18} />, color: theme.accent },
            { label: 'Total cuvinte', value: totalWords.toLocaleString(), icon: <FileType size={18} />, color: theme.accent2 },
            { label: 'Fragmente RAG', value: knowledgeSources.reduce((acc, source) => acc + (source.chunkCount ?? 0), 0).toLocaleString(), icon: <Brain size={18} />, color: theme.success },
            { label: 'Calitate medie', value: `${sourceHealth.averageQuality}%`, icon: <Bot size={18} />, color: theme.warning },
          ].map((item, index) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + index * 0.05 }}
              className="relative overflow-hidden rounded-[24px] p-5 glass-panel premium-shadow"
              style={{ background: theme.surface, border: `1px solid ${theme.border}` }}
            >
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: `${item.color}15`, color: item.color }}>
                  {item.icon}
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest opacity-50" style={{ color: theme.text }}>
                  {item.label}
                </span>
              </div>
              <div className="text-2xl font-black tracking-tight" style={{ color: theme.text }}>{item.value}</div>
            </motion.div>
          ))}
        </div>

        {knowledgeSources.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-10 grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(300px,0.85fr)]"
          >
            <div className="rounded-[28px] p-6 glass-panel premium-shadow" style={{ background: theme.surface, border: `1px solid ${theme.border}` }}>
              <div className="mb-2 text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: theme.text3 }}>
                Smart Import Cleaner
              </div>
              <h2 className="text-xl font-black tracking-tight" style={{ color: theme.text }}>
                Biblioteca AI iti spune ce documente merita curatate
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed" style={{ color: theme.text3 }}>
                Documentele foarte mari sau extrase slab pot cobori relevanta raspunsurilor. Foloseste semnalele de mai jos ca sa stii ce merita refacut cu OCR sau reimportat.
              </p>
              <div className="mt-5 flex flex-wrap gap-2.5">
                <span className="rounded-full px-3 py-1.5 text-[11px] font-bold" style={{ background: theme.surface2, border: `1px solid ${theme.border}`, color: theme.text3 }}>
                  {sourceHealth.lowQuality.length} surse slabe
                </span>
                <span className="rounded-full px-3 py-1.5 text-[11px] font-bold" style={{ background: theme.surface2, border: `1px solid ${theme.border}`, color: theme.text3 }}>
                  {sourceHealth.heavySources.length} fisiere mari
                </span>
                <span className="rounded-full px-3 py-1.5 text-[11px] font-bold" style={{ background: theme.surface2, border: `1px solid ${theme.border}`, color: theme.text3 }}>
                  {sourceHealth.warningSources.length} importuri cu semnale
                </span>
              </div>
            </div>

            <div className="rounded-[28px] p-5 glass-panel premium-shadow" style={{ background: theme.surface, border: `1px solid ${theme.border}` }}>
              <div className="mb-3 text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: theme.text3 }}>
                Recomandari rapide
              </div>
              <div className="space-y-3">
                <div className="rounded-[20px] p-4" style={{ background: theme.surface2, border: `1px solid ${theme.border}` }}>
                  <div className="text-sm font-black" style={{ color: theme.text }}>Surse cu scanare slaba</div>
                  <div className="mt-1 text-sm" style={{ color: theme.text3 }}>
                    {sourceHealth.lowQuality.length > 0 ? `${sourceHealth.lowQuality.length} documente par extrase slab. Refa OCR-ul pentru context mai curat.` : 'Nu avem surse care sa para extrase foarte slab.'}
                  </div>
                </div>
                <div className="rounded-[20px] p-4" style={{ background: theme.surface2, border: `1px solid ${theme.border}` }}>
                  <div className="text-sm font-black" style={{ color: theme.text }}>Surse foarte mari</div>
                  <div className="mt-1 text-sm" style={{ color: theme.text3 }}>
                    {sourceHealth.heavySources.length > 0 ? `${sourceHealth.heavySources.length} documente sunt foarte mari. Merita verificate ca sa aiba chunk-uri utile, nu doar volum.` : 'Nu exista fisiere mari care sa ceara atentie acum.'}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        <div className="space-y-6">
          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 opacity-40">
              <Search size={18} style={{ color: theme.text }} />
            </div>
            <input
              type="text"
              placeholder="Cauta in biblioteca..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full rounded-[20px] py-4 pl-12 pr-4 text-sm font-medium transition-all focus:ring-2"
              style={{ background: theme.surface, border: `1px solid ${theme.border}`, color: theme.text, outline: 'none' } as React.CSSProperties}
            />
          </div>

          <AnimatePresence mode="popLayout">
            {filtered.length === 0 ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-20 text-center">
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl" style={{ background: `${theme.accent}15` }}>
                  <Library size={28} style={{ color: theme.accent }} />
                </div>
                <p className="mb-1 text-base font-bold" style={{ color: theme.text }}>
                  {search ? 'Niciun document gasit.' : 'Biblioteca ta este goala.'}
                </p>
                <p className="text-sm opacity-50" style={{ color: theme.text }}>
                  {search ? 'Incearca alt termen de cautare.' : 'Adauga PDF-uri, DOCX sau imagini pentru a incepe.'}
                </p>
              </motion.div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {filtered.map((source, index) => (
                  <motion.div
                    key={source.id}
                    layout
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: index * 0.02 }}
                    className="group flex items-center gap-4 rounded-[22px] p-4 transition-all hover:translate-x-1 glass-panel premium-shadow"
                    style={{ background: theme.surface, border: `1px solid ${theme.border}` }}
                  >
                    <div
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl shadow-inner"
                      style={{
                        background: source.type === 'pdf' ? `${theme.accent}15` : source.type === 'docx' ? '#2B579A15' : source.type === 'image' ? '#FF9F0A15' : `${theme.accent2}15`,
                        color: source.type === 'pdf' ? theme.accent : source.type === 'docx' ? '#2B579A' : source.type === 'image' ? '#FF9F0A' : theme.accent2,
                      }}
                    >
                      {source.type === 'image' ? <Image size={22} /> : <FileText size={22} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        <h3 className="truncate text-[15px] font-bold" style={{ color: theme.text }}>{source.name}</h3>
                        <span className="rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider" style={{ background: theme.surface2, color: theme.text3 }}>
                          {source.type}
                        </span>
                        <span
                          className="rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider"
                          style={{ background: `${(source.qualityScore ?? 60) >= 70 ? theme.success : theme.warning}18`, color: (source.qualityScore ?? 60) >= 70 ? theme.success : theme.warning }}
                        >
                          {source.qualityScore ?? 60}%
                        </span>
                      </div>
                      <p className="truncate text-[11px] font-medium opacity-50" style={{ color: theme.text }}>{source.preview}</p>
                      <p className="mt-2 text-[10px] font-bold uppercase tracking-tighter" style={{ color: theme.text3 }}>
                        {(source.chunkCount ?? 0).toLocaleString()} fragmente RAG · {source.charCount.toLocaleString()} caractere
                      </p>
                      {source.warnings && source.warnings.length > 0 && (
                        <p className="mt-2 text-[10px] font-semibold" style={{ color: theme.warning }}>
                          {source.warnings[0]}
                        </p>
                      )}
                      <div className="mt-2 flex items-center gap-3 text-[10px] font-bold uppercase tracking-tighter" style={{ color: theme.text3 }}>
                        <span>{source.wordCount} cuvinte</span>
                        <span>•</span>
                        <span>{source.charCount.toLocaleString()} caractere</span>
                        <span>•</span>
                        <span>{new Date(source.addedAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="hidden items-center gap-2 md:flex">
                      <button
                        onClick={() => void openReader(source.id)}
                        className="press-feedback rounded-2xl px-3 py-2 text-[11px] font-black uppercase tracking-[0.14em]"
                        style={{ background: theme.surface2, border: `1px solid ${theme.border}`, color: theme.text }}
                      >
                        Reader
                      </button>
                      <button
                        onClick={() => askAIAboutSource(source.name)}
                        className="press-feedback rounded-2xl px-3 py-2 text-[11px] font-black uppercase tracking-[0.14em]"
                        style={{ background: `${theme.accent}15`, border: `1px solid ${theme.accent}25`, color: theme.accent }}
                      >
                        Intreaba AI
                      </button>
                    </div>
                    <button
                      onClick={() => removeKnowledgeSource(source.id)}
                      className="flex h-10 w-10 items-center justify-center rounded-xl text-red-500 opacity-0 transition-all group-hover:opacity-100 hover:bg-red-500/10"
                    >
                      <Trash2 size={18} />
                    </button>
                  </motion.div>
                ))}
              </div>
            )}
          </AnimatePresence>
        </div>

        {knowledgeSources.length > 0 && (
          <div
            className="relative mt-12 overflow-hidden rounded-[32px] p-8 text-center glass-panel premium-shadow"
            style={{ background: `linear-gradient(135deg, ${theme.accent}10, ${theme.accent2}10)`, border: `1px solid ${theme.accent}20` }}
          >
            <div className="relative z-10">
              <Bot size={40} className="mx-auto mb-4" style={{ color: theme.accent }} />
              <h2 className="mb-2 text-xl font-black" style={{ color: theme.text }}>AI-ul tau este gata</h2>
              <p className="mx-auto mb-6 max-w-sm text-sm font-medium opacity-60" style={{ color: theme.text }}>
                Foloseste biblioteca pentru raspunsuri mai ancorate, mai utile si mai serioase.
              </p>
              <button
                onClick={() => setChatOpen(true)}
                className="rounded-2xl px-8 py-3 text-sm font-black text-white shadow-lg transition-all hover:scale-105 active:scale-95"
                style={{ background: theme.accent }}
              >
                Deschide Chat AI
              </button>
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {readerOpen && selectedSource && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setReaderOpen(false)}
              className="fixed inset-0 z-50 bg-black/35"
              style={{ backdropFilter: 'blur(8px)' }}
            />
            <motion.div
              initial={{ opacity: 0, y: 28, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.98 }}
              className="premium-modal fixed inset-x-4 bottom-4 top-20 z-[60] mx-auto flex max-w-5xl flex-col overflow-hidden rounded-[34px]"
            >
              <div className="flex items-start justify-between gap-4 border-b px-6 py-5" style={{ borderColor: theme.border }}>
                <div className="min-w-0">
                  <div className="text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: theme.text3 }}>
                    Premium Reader
                  </div>
                  <h2 className="mt-1 truncate text-2xl font-black tracking-tight" style={{ color: theme.text }}>
                    {selectedSource.name}
                  </h2>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="rounded-full px-3 py-1 text-[11px] font-bold" style={{ background: theme.surface2, border: `1px solid ${theme.border}`, color: theme.text3 }}>
                      {selectedSource.type}
                    </span>
                    <span className="rounded-full px-3 py-1 text-[11px] font-bold" style={{ background: theme.surface2, border: `1px solid ${theme.border}`, color: theme.text3 }}>
                      {selectedSource.chunkCount} fragmente
                    </span>
                    <span className="rounded-full px-3 py-1 text-[11px] font-bold" style={{ background: theme.surface2, border: `1px solid ${theme.border}`, color: theme.text3 }}>
                      {selectedSource.qualityScore}% calitate
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => askAIAboutSource(selectedSource.name)}
                    className="press-feedback rounded-2xl px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.14em]"
                    style={{ background: `${theme.accent}15`, border: `1px solid ${theme.accent}25`, color: theme.accent }}
                  >
                    Intreaba AI <ArrowRight size={14} className="ml-1 inline-block" />
                  </button>
                  <button
                    onClick={() => setReaderOpen(false)}
                    className="press-feedback rounded-2xl p-2.5"
                    style={{ background: theme.surface2, border: `1px solid ${theme.border}`, color: theme.text3 }}
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              <div className="grid min-h-0 flex-1 gap-0 lg:grid-cols-[minmax(0,1.2fr)_320px]">
                <div className="custom-scrollbar overflow-y-auto px-6 py-5">
                  {readerLoading ? (
                    <div className="space-y-3">
                      <div className="skeleton-block h-4 w-2/3 rounded-full" />
                      <div className="skeleton-block h-4 w-full rounded-full" />
                      <div className="skeleton-block h-4 w-5/6 rounded-full" />
                      <div className="skeleton-block h-4 w-4/5 rounded-full" />
                    </div>
                  ) : (
                    <div className="rounded-[28px] p-6" style={{ background: theme.surface2, border: `1px solid ${theme.border}` }}>
                      <div className="mb-3 text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: theme.text3 }}>
                        Extras indexat
                      </div>
                      <pre
                        className="whitespace-pre-wrap break-words text-sm leading-7"
                        style={{ color: theme.text, fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}
                      >
                        {readerContent}
                      </pre>
                    </div>
                  )}
                </div>

                <div className="border-l px-5 py-5" style={{ borderColor: theme.border, background: 'linear-gradient(180deg, rgba(255,255,255,0.04), transparent)' }}>
                  <div className="text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: theme.text3 }}>
                    Source Quality
                  </div>
                  <div className="mt-4 space-y-3">
                    <div className="rounded-[22px] p-4" style={{ background: theme.surface2, border: `1px solid ${theme.border}` }}>
                      <div className="text-sm font-black" style={{ color: theme.text }}>Semnal general</div>
                      <div className="mt-1 text-sm" style={{ color: theme.text3 }}>
                        {selectedSource.qualityScore >= 78
                          ? 'Sursa pare curata si buna pentru raspunsuri ancorate.'
                          : selectedSource.qualityScore >= 60
                            ? 'Sursa este utila, dar poate merita o reimportare mai curata.'
                            : 'Sursa pare slaba. OCR-ul sau extragerea textului ar trebui refacute.'}
                      </div>
                    </div>
                    <div className="rounded-[22px] p-4" style={{ background: theme.surface2, border: `1px solid ${theme.border}` }}>
                      <div className="text-sm font-black" style={{ color: theme.text }}>Dimensiune</div>
                      <div className="mt-1 text-sm" style={{ color: theme.text3 }}>
                        {selectedSource.charCount.toLocaleString()} caractere si {selectedSource.wordCount.toLocaleString()} cuvinte indexate.
                      </div>
                    </div>
                    {selectedSource.warnings && selectedSource.warnings.length > 0 && (
                      <div className="rounded-[22px] p-4" style={{ background: `${theme.warning}10`, border: `1px solid ${theme.warning}25` }}>
                        <div className="text-sm font-black" style={{ color: theme.warning }}>Avertismente</div>
                        <div className="mt-1 text-sm" style={{ color: theme.text3 }}>
                          {selectedSource.warnings.join(' ')}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
