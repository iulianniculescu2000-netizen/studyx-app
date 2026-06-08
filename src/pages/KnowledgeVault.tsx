import { AnimatePresence, motion } from 'framer-motion';
import { useMemo, useRef, useState, type ChangeEvent } from 'react';
import {
  ArrowRight,
  Bot,
  Brain,
  Database,
  FileText,
  FileType,
  Image,
  Layers3,
  Library,
  Loader2,
  MessageSquare,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { useTheme } from '../theme/ThemeContext';
import { useAIStore, type AIKnowledgeSource, type AIKnowledgeSourceType } from '../store/aiStore';
import { useToastStore } from '../store/toastStore';
import { useUIStore } from '../store/uiStore';
import { useAdaptiveMotion } from '../hooks/useAdaptiveMotion';

function SourceStatusBadge({
  source,
  theme,
}: {
  source: AIKnowledgeSource;
  theme: ReturnType<typeof useTheme>;
}) {
  if (source.indexStatus === 'error') {
    return (
      <span
        className="rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider"
        style={{ background: `${theme.danger}18`, color: theme.danger }}
      >
        Eroare
      </span>
    );
  }

  if (source.indexStatus === 'indexing') {
    return (
      <span
        className="rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider"
        style={{ background: `${theme.accent}18`, color: theme.accent }}
      >
        Indexare {Math.round(source.indexProgress ?? 0)}%
      </span>
    );
  }

  return (
    <span
      className="rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider"
      style={{ background: `${theme.success}18`, color: theme.success }}
    >
      Gata
    </span>
  );
}

export default function KnowledgeVault() {
  const theme = useTheme();
  const { calmMotion, performanceLite } = useAdaptiveMotion();
  const knowledgeSources = useAIStore((state) => state.knowledgeSources);
  const addKnowledgeSource = useAIStore((state) => state.addKnowledgeSource);
  const removeKnowledgeSource = useAIStore((state) => state.removeKnowledgeSource);
  const addToast = useToastStore((state) => state.addToast);
  const setChatOpen = useUIStore((state) => state.setChatOpen);

  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [processStep, setProcessStep] = useState('');
  const [readerOpen, setReaderOpen] = useState(false);
  const [readerLoading, setReaderLoading] = useState(false);
  const [readerContent, setReaderContent] = useState('');
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(
    () => knowledgeSources
      .filter((source) => source.name.toLowerCase().includes(search.toLowerCase()) || source.preview.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => b.addedAt - a.addedAt),
    [knowledgeSources, search],
  );

  const selectedSource = useMemo(
    () => knowledgeSources.find((source) => source.id === selectedSourceId) ?? null,
    [knowledgeSources, selectedSourceId],
  );

  const totalWords = useMemo(
    () => knowledgeSources.reduce((acc, source) => acc + source.wordCount, 0),
    [knowledgeSources],
  );

  const stats = useMemo(() => ({
    averageQuality: Math.round(
      knowledgeSources.reduce((acc, source) => acc + (source.qualityScore ?? 60), 0) / Math.max(knowledgeSources.length, 1),
    ),
    indexingCount: knowledgeSources.filter((source) => source.indexStatus === 'indexing').length,
    failedCount: knowledgeSources.filter((source) => source.indexStatus === 'error').length,
    chunkCount: knowledgeSources.reduce((acc, source) => acc + (source.chunkCount ?? 0), 0),
  }), [knowledgeSources]);

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

  const yieldToPaint = async () => {
    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, 0);
    });
  };

  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) {
      return;
    }

    setLoading(true);
    setProcessStep(files.length > 1 ? `Pregătim ${files.length} fișiere...` : 'Pregătim documentul...');
    await yieldToPaint();

    try {
      for (const [index, file] of files.entries()) {
        const filePrefix = files.length > 1 ? `[${index + 1}/${files.length}] ` : '';
        const name = file.name.toLowerCase();
        const isPdf = name.endsWith('.pdf');
        const isDocx = name.endsWith('.docx');
        const isImage = /\.(jpe?g|png|webp|bmp)$/i.test(name);

        let text = '';
        let type: AIKnowledgeSourceType = 'txt';

        setProcessStep(`${filePrefix}Citim ${file.name}...`);
        await yieldToPaint();

        if (isPdf) {
          const { parsePDF } = await import('../ai/pdfParser');
          text = await withTimeout(parsePDF(file), 20000, `Importul PDF pentru ${file.name} a expirat.`);
          type = 'pdf';
        } else if (isDocx) {
          const { parseDocx } = await import('../ai/docxParser');
          text = await withTimeout(parseDocx(file), 15000, `Importul DOCX pentru ${file.name} a expirat.`);
          type = 'docx';
        } else if (isImage) {
          setProcessStep(`${filePrefix}Analizăm imaginea (OCR)...`);
          await yieldToPaint();
          const { parseImageOCR } = await import('../ai/ocrParser');
          text = await withTimeout(parseImageOCR(file), 60000, `OCR-ul pentru ${file.name} durează prea mult.`);
          type = 'image';
        } else {
          text = await withTimeout(file.text(), 10000, `Citirea fișierului ${file.name} a expirat.`);
        }

        if (text.trim().length < 5) {
          addToast(`Conținut insuficient în ${file.name}`, 'warning');
          continue;
        }

        setProcessStep(`${filePrefix}Trimitem ${file.name} în indexare...`);
        await yieldToPaint();
        await withTimeout(
          addKnowledgeSource(file.name, text, type, {
            onIndexProgress: ({ percent }: { percent: number }) => {
              setProcessStep(`${filePrefix}Indexăm ${file.name}... ${percent}%`);
            },
          }),
          20000,
          `Indexarea pentru ${file.name} s-a blocat.`,
        );

        addToast(`"${file.name}" a intrat în indexare. Poți continua să folosești aplicația.`, 'success');
      }
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Eroare la procesarea fișierelor.', 'error');
    } finally {
      setLoading(false);
      setProcessStep('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const openReader = async (source: AIKnowledgeSource) => {
    setSelectedSourceId(source.id);
    setReaderOpen(true);

    if (source.indexStatus === 'indexing') {
      setReaderLoading(false);
      setReaderContent('Documentul este încă în indexare. Vizualizarea devine disponibilă după finalizare.');
      return;
    }

    if (source.indexStatus === 'error') {
      setReaderLoading(false);
      setReaderContent(source.indexError || 'Importul a intrat în eroare. Reimportă documentul.');
      return;
    }

    setReaderLoading(true);
    try {
      const { getVaultChunksBySource } = await import('../ai/vectorStore');
      const chunks = await getVaultChunksBySource(source.id);
      const previewText = chunks
        .slice(0, 8)
        .map((chunk) => chunk.text.trim())
        .filter(Boolean)
        .join('\n\n');
      setReaderContent(previewText || 'Nu am găsit încă fragmente pentru această sursă.');
    } catch (error) {
      console.error('[KnowledgeVault] Reader load failed:', error);
      setReaderContent('Nu am putut încărca conținutul pentru această sursă.');
    } finally {
      setReaderLoading(false);
    }
  };

  const askAIAboutSource = (source: AIKnowledgeSource) => {
    setChatOpen(true);
    window.dispatchEvent(new CustomEvent('studyx:ai-prompt', {
      detail: {
        open: true,
        mode: 'summarize',
        sourceId: source.id,
        sourceName: source.name,
        resetConversation: true,
        prompt: `Analizează documentul "${source.name}" și rezumă-mi ideile-cheie, punctele sensibile și ce merită învățat prioritar din el.`,
      },
    }));
  };

  const openAIStudioForSource = (source?: AIKnowledgeSource) => {
    const targetSource = source ?? selectedSource ?? filtered.find((entry) => entry.indexStatus === 'ready') ?? null;

    setChatOpen(true);
    window.dispatchEvent(new CustomEvent('studyx:ai-prompt', {
      detail: {
        open: true,
        view: 'studio',
        mode: 'summarize',
        sourceId: targetSource?.id,
        sourceName: targetSource?.name,
        resetConversation: true,
        prompt: targetSource
          ? `Generează pentru "${targetSource.name}" pachete de grile adaptate și ajută-mă să aleg setările potrivite.`
          : 'Vreau să generez pachete de grile dintr-un curs și să aleg unde se salvează.',
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
                <h1 className="page-title-compact" style={{ color: theme.text }}>
                  Biblioteca <span style={{ color: theme.accent }}>AI</span>
                </h1>
              </div>
              <p className="max-w-md text-sm font-medium opacity-60" style={{ color: theme.text }}>
                Centrul tău local de date. AI-ul StudyX folosește aceste documente pentru răspunsuri mai serioase și pachete generate inteligent.
              </p>
            </div>

            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
              <motion.button
                whileHover={calmMotion ? undefined : { scale: 1.02 }}
                whileTap={calmMotion ? undefined : { scale: 0.98 }}
                onClick={() => openAIStudioForSource()}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border px-5 py-3 font-bold transition-all sm:w-auto"
                style={{ background: `${theme.accent}14`, borderColor: `${theme.accent}24`, color: theme.accent }}
              >
                <Layers3 size={18} /> AI Studio
              </motion.button>

              <motion.button
                whileHover={calmMotion ? undefined : { scale: 1.02 }}
                whileTap={calmMotion ? undefined : { scale: 0.98 }}
                onClick={() => setChatOpen(true)}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border px-5 py-3 font-bold transition-all sm:w-auto"
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
                whileHover={calmMotion ? undefined : { scale: 1.02 }}
                whileTap={calmMotion ? undefined : { scale: 0.98 }}
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                className="flex w-full items-center justify-center gap-3 rounded-2xl px-6 py-3 font-black text-white shadow-xl transition-all sm:w-auto sm:min-w-[180px]"
                style={{ background: theme.accent, boxShadow: `0 8px 24px ${theme.accent}40` }}
              >
                {loading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" /> Procesăm...
                  </>
                ) : (
                  <>
                    <Plus size={18} /> Adaugă documente
                  </>
                )}
              </motion.button>
            </div>
          </div>

          {loading && processStep && (
            <div
              className="mt-4 inline-flex rounded-full px-4 py-2 text-xs font-bold"
              style={{ background: `${theme.accent}12`, border: `1px solid ${theme.accent}22`, color: theme.accent }}
            >
              {processStep}
            </div>
          )}
        </motion.div>

        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'Documente', value: knowledgeSources.length, icon: <Library size={18} />, color: theme.accent },
            { label: 'Total cuvinte', value: totalWords.toLocaleString(), icon: <FileType size={18} />, color: theme.accent2 },
            { label: 'Fragmente RAG', value: stats.chunkCount.toLocaleString(), icon: <Brain size={18} />, color: theme.success },
            { label: 'Calitate medie', value: `${stats.averageQuality}%`, icon: <Bot size={18} />, color: theme.warning },
          ].map((item) => (
            <div
              key={item.label}
              className="premium-shadow rounded-[24px] p-5 glass-panel"
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
              <div className="text-2xl font-black tracking-tight" style={{ color: theme.text }}>
                {item.value}
              </div>
            </div>
          ))}
        </div>

        {knowledgeSources.length > 0 && (
          <div className="mb-8 flex flex-wrap gap-2.5">
            <span className="rounded-full px-3 py-1.5 text-[11px] font-bold" style={{ background: `${theme.accent}14`, border: `1px solid ${theme.accent}22`, color: theme.accent }}>
              {stats.indexingCount} în indexare
            </span>
            <span className="rounded-full px-3 py-1.5 text-[11px] font-bold" style={{ background: `${theme.danger}14`, border: `1px solid ${theme.danger}22`, color: theme.danger }}>
              {stats.failedCount} cu eroare
            </span>
          </div>
        )}

        <div className="space-y-6">
          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 opacity-40">
              <Search size={18} style={{ color: theme.text }} />
            </div>
            <input
              type="text"
              placeholder="Caută în bibliotecă..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full rounded-[20px] py-4 pl-12 pr-4 text-sm font-medium transition-all focus:ring-2"
              style={{ background: theme.surface, border: `1px solid ${theme.border}`, color: theme.text, outline: 'none' }}
            />
          </div>

          <AnimatePresence mode="popLayout">
            {filtered.length === 0 ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-20 text-center">
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl" style={{ background: `${theme.accent}15` }}>
                  <Library size={28} style={{ color: theme.accent }} />
                </div>
                <p className="mb-1 text-base font-bold" style={{ color: theme.text }}>
                  {search ? 'Niciun document găsit.' : 'Biblioteca ta este goală.'}
                </p>
              </motion.div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {filtered.map((source, index) => {
                  const isReady = source.indexStatus !== 'indexing' && source.indexStatus !== 'error';

                  return (
                    <motion.div
                      key={source.id}
                      layout
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ delay: index * 0.02 }}
                      className="group premium-shadow flex flex-wrap items-start gap-4 rounded-[22px] p-4 glass-panel"
                      style={{ background: theme.surface, border: `1px solid ${theme.border}` }}
                    >
                      <div
                        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl shadow-inner"
                        style={{
                          background: source.type === 'image' ? '#FF9F0A15' : `${theme.accent}15`,
                          color: source.type === 'image' ? '#FF9F0A' : theme.accent,
                        }}
                      >
                        {source.type === 'image' ? <Image size={22} /> : <FileText size={22} />}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <h3 className="truncate text-[15px] font-bold" style={{ color: theme.text }}>
                            {source.name}
                          </h3>
                          <span className="rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider" style={{ background: theme.surface2, color: theme.text3 }}>
                            {source.type}
                          </span>
                          <SourceStatusBadge source={source} theme={theme} />
                        </div>

                        <p className="truncate text-[11px] font-medium opacity-50" style={{ color: theme.text }}>
                          {source.preview}
                        </p>

                        {source.indexStatus === 'indexing' && (
                          <div className="mt-3">
                            <div className="h-1.5 overflow-hidden rounded-full" style={{ background: theme.surface2 }}>
                              <div
                                className="h-full rounded-full transition-all"
                                style={{ width: `${Math.max(4, Math.round(source.indexProgress ?? 0))}%`, background: `linear-gradient(90deg, ${theme.accent}, ${theme.accent2})` }}
                              />
                            </div>
                          </div>
                        )}

                        {source.indexStatus === 'error' && source.indexError && (
                          <p className="mt-2 text-[10px] font-semibold" style={{ color: theme.danger }}>
                            {source.indexError}
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

                      <div className="hidden items-center gap-2 lg:flex">
                        <button
                          onClick={() => void openReader(source)}
                          disabled={!isReady}
                          className="rounded-2xl px-3 py-2 text-[11px] font-black uppercase tracking-[0.14em]"
                          style={{ background: theme.surface2, border: `1px solid ${theme.border}`, color: theme.text, opacity: isReady ? 1 : 0.45 }}
                        >
                          Deschide
                        </button>
                        <button
                          onClick={() => isReady && askAIAboutSource(source)}
                          disabled={!isReady}
                          className="rounded-2xl px-3 py-2 text-[11px] font-black uppercase tracking-[0.14em]"
                          style={{ background: `${theme.accent}15`, border: `1px solid ${theme.accent}25`, color: theme.accent, opacity: isReady ? 1 : 0.45 }}
                        >
                          Întreabă AI
                        </button>
                        <button
                          onClick={() => isReady && openAIStudioForSource(source)}
                          disabled={!isReady}
                          className="rounded-2xl px-3 py-2 text-[11px] font-black uppercase tracking-[0.14em]"
                          style={{ background: theme.surface2, border: `1px solid ${theme.border}`, color: theme.text2, opacity: isReady ? 1 : 0.45 }}
                        >
                          AI Studio
                        </button>
                      </div>

                      <button
                        onClick={() => removeKnowledgeSource(source.id)}
                        className="flex h-10 w-10 items-center justify-center rounded-xl text-red-500 opacity-100 transition-all hover:bg-red-500/10 lg:opacity-0 lg:group-hover:opacity-100"
                      >
                        <Trash2 size={18} />
                      </button>

                      <div className="flex w-full flex-wrap gap-2 lg:hidden">
                        <button
                          onClick={() => void openReader(source)}
                          disabled={!isReady}
                          className="flex-1 rounded-2xl px-3 py-2 text-[11px] font-black uppercase tracking-[0.14em]"
                          style={{ background: theme.surface2, border: `1px solid ${theme.border}`, color: theme.text, opacity: isReady ? 1 : 0.45 }}
                        >
                          Deschide
                        </button>
                        <button
                          onClick={() => isReady && askAIAboutSource(source)}
                          disabled={!isReady}
                          className="flex-1 rounded-2xl px-3 py-2 text-[11px] font-black uppercase tracking-[0.14em]"
                          style={{ background: `${theme.accent}15`, border: `1px solid ${theme.accent}25`, color: theme.accent, opacity: isReady ? 1 : 0.45 }}
                        >
                          Întreabă AI
                        </button>
                        <button
                          onClick={() => isReady && openAIStudioForSource(source)}
                          disabled={!isReady}
                          className="flex-1 rounded-2xl px-3 py-2 text-[11px] font-black uppercase tracking-[0.14em]"
                          style={{ background: theme.surface2, border: `1px solid ${theme.border}`, color: theme.text2, opacity: isReady ? 1 : 0.45 }}
                        >
                          AI Studio
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </AnimatePresence>
        </div>
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
              style={{ backdropFilter: performanceLite ? 'blur(4px)' : 'blur(8px)' }}
            />
            <motion.div
              initial={{ opacity: 0, y: 28, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.98 }}
              className="premium-modal fixed inset-x-3 top-16 bottom-3 z-[60] mx-auto flex max-w-5xl flex-col overflow-hidden rounded-[30px] sm:inset-x-4 sm:top-20 sm:bottom-4 sm:rounded-[34px]"
            >
              <div className="flex flex-wrap items-start justify-between gap-4 border-b px-5 py-4 sm:px-6 sm:py-5" style={{ borderColor: theme.border }}>
                <div className="min-w-0">
                  <div className="text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: theme.text3 }}>
                    Vizualizare document
                  </div>
                  <h2 className="mt-1 truncate text-2xl font-black tracking-tight" style={{ color: theme.text }}>
                    {selectedSource.name}
                  </h2>
                </div>
                <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap">
                  <button
                    onClick={() => selectedSource.indexStatus === 'ready' && askAIAboutSource(selectedSource)}
                    disabled={selectedSource.indexStatus !== 'ready'}
                    className="flex-1 rounded-2xl px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.14em] sm:flex-none"
                    style={{ background: `${theme.accent}15`, border: `1px solid ${theme.accent}25`, color: theme.accent, opacity: selectedSource.indexStatus === 'ready' ? 1 : 0.45 }}
                  >
                    Întreabă AI <ArrowRight size={14} className="ml-1 inline-block" />
                  </button>
                  <button
                    onClick={() => selectedSource.indexStatus === 'ready' && openAIStudioForSource(selectedSource)}
                    disabled={selectedSource.indexStatus !== 'ready'}
                    className="flex-1 rounded-2xl px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.14em] sm:flex-none"
                    style={{ background: theme.surface2, border: `1px solid ${theme.border}`, color: theme.text2, opacity: selectedSource.indexStatus === 'ready' ? 1 : 0.45 }}
                  >
                    AI Studio
                  </button>
                  <button
                    onClick={() => setReaderOpen(false)}
                    className="rounded-2xl p-2.5"
                    style={{ background: theme.surface2, border: `1px solid ${theme.border}`, color: theme.text3 }}
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6 sm:py-5">
                {readerLoading ? (
                  <div className="space-y-3">
                    <div className="skeleton-block h-4 w-2/3 rounded-full" />
                    <div className="skeleton-block h-4 w-full rounded-full" />
                    <div className="skeleton-block h-4 w-5/6 rounded-full" />
                  </div>
                ) : (
                  <div className="rounded-[28px] p-6" style={{ background: theme.surface2, border: `1px solid ${theme.border}` }}>
                    <pre className="whitespace-pre-wrap break-words text-sm leading-7" style={{ color: theme.text, fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}>
                      {readerContent}
                    </pre>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
