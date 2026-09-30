import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  FileText,
  FolderPlus,
  Image,
  Layers3,
  Library,
  Loader2,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { useTheme } from '../theme/ThemeContext';
import { useAIStore, type AILibraryFolder, type AIKnowledgeSource, type AIKnowledgeSourceType } from '../store/aiStore';
import { useToastStore } from '../store/toastStore';
import { useUIStore } from '../store/uiStore';
import { useAdaptiveMotion } from '../hooks/useAdaptiveMotion';
import { useSourceChapters } from '../hooks/useSourceChapters';
import { dispatchGenerateFromChapter } from '../lib/ai/chapterEvents';
import ThemedSelect from '../components/ThemedSelect';
import ConfirmDialog from '../components/ConfirmDialog';
import ExamPlanCard from '../components/ExamPlanCard';
import { isRezidentiatRootFolder } from '../lib/rezidentiatRoot';

function SourceStatusBadge({
  source,
  theme,
}: {
  source: AIKnowledgeSource;
  theme: ReturnType<typeof useTheme>;
}) {
  if (source.indexStatus === 'ready' || source.indexStatus === undefined) return null;
  const isError = source.indexStatus === 'error';
  const color = isError ? theme.danger : theme.accent;
  return (
    <span
      className="flex-shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
      style={{ background: `${color}18`, color }}
    >
      {isError ? 'Eroare' : `Indexare ${Math.round(source.indexProgress ?? 0)}%`}
    </span>
  );
}

const FOLDER_EMOJIS = ['📚', '🧠', '🫀', '🩸', '🦷', '🔬', '📋', '🩻', '🧬', '💊'];

type TypeFilter = 'all' | 'pdf' | 'image' | 'indexing';

export default function KnowledgeVault() {
  const theme = useTheme();
  const { performanceLite } = useAdaptiveMotion();
  const knowledgeSources = useAIStore((state) => state.knowledgeSources);
  const addKnowledgeSource = useAIStore((state) => state.addKnowledgeSource);
  const removeKnowledgeSource = useAIStore((state) => state.removeKnowledgeSource);
  const libraryFolders = useAIStore((state) => state.libraryFolders);
  const addLibraryFolder = useAIStore((state) => state.addLibraryFolder);
  const deleteLibraryFolder = useAIStore((state) => state.deleteLibraryFolder);
  const moveSourceToLibraryFolder = useAIStore((state) => state.moveSourceToLibraryFolder);
  const addToast = useToastStore((state) => state.addToast);
  const setChatOpen = useUIStore((state) => state.setChatOpen);
  const [searchParams, setSearchParams] = useSearchParams();
  const deepLinkedSourceRef = useRef<string | null>(null);

  // Navigation: null = top level (folders view), folderId = inside a folder
  const [activeFolderId, setActiveFolderId] = useState<string | null | '__unfiled__'>(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [menuSourceId, setMenuSourceId] = useState<string | null>(null);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [loading, setLoading] = useState(false);
  const [processStep, setProcessStep] = useState('');
  const [readerOpen, setReaderOpen] = useState(false);
  const [readerLoading, setReaderLoading] = useState(false);
  const [readerContent, setReaderContent] = useState('');
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [movingSourceId, setMovingSourceId] = useState<string | null>(null);
  const [creatingSubfolder, setCreatingSubfolder] = useState(false);
  const [newSubfolderName, setNewSubfolderName] = useState('');
  const [folderToDelete, setFolderToDelete] = useState<{ id: string; name: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeFolder = useMemo(
    () => libraryFolders.find((f) => f.id === activeFolderId) ?? null,
    [libraryFolders, activeFolderId],
  );

  const folderCounts = useMemo(() => {
    const counts = new Map<string, number>();
    let unfiled = 0;
    for (const source of knowledgeSources) {
      if (source.folderId) counts.set(source.folderId, (counts.get(source.folderId) ?? 0) + 1);
      else unfiled += 1;
    }
    return { counts, unfiled };
  }, [knowledgeSources]);

  const rootFolders = useMemo(
    () => libraryFolders.filter((folder) => !folder.parentId),
    [libraryFolders],
  );

  const subfoldersByParent = useMemo(() => {
    const map = new Map<string, AILibraryFolder[]>();
    for (const folder of libraryFolders) {
      if (!folder.parentId) continue;
      map.set(folder.parentId, [...(map.get(folder.parentId) ?? []), folder]);
    }
    return map;
  }, [libraryFolders]);

  const activeSubfolders = useMemo(
    () => (activeFolder ? subfoldersByParent.get(activeFolder.id) ?? [] : []),
    [activeFolder, subfoldersByParent],
  );

  // Flat "move to folder" options, labelled with their full path so a subfolder
  // like "Hematologie / Cursuri" is distinguishable from a sibling root folder.
  const libraryFolderOptions = useMemo(() => {
    const byId = new Map(libraryFolders.map((folder) => [folder.id, folder]));
    const pathLabel = (folder: AILibraryFolder) => {
      const names = [folder.name];
      const guard = new Set<string>([folder.id]);
      let parent = folder.parentId ? byId.get(folder.parentId) : undefined;
      while (parent && !guard.has(parent.id)) {
        guard.add(parent.id);
        names.unshift(parent.name);
        parent = parent.parentId ? byId.get(parent.parentId) : undefined;
      }
      return names.join(' / ');
    };
    return libraryFolders.map((folder) => ({ value: folder.id, label: `${folder.emoji} ${pathLabel(folder)}` }));
  }, [libraryFolders]);

  // Breadcrumb chain from the root down to the active folder (inclusive).
  const folderPath = useMemo(() => {
    if (!activeFolder) return [] as AILibraryFolder[];
    const byId = new Map(libraryFolders.map((folder) => [folder.id, folder]));
    const chain: AILibraryFolder[] = [];
    const guard = new Set<string>();
    let current: AILibraryFolder | undefined = activeFolder;
    while (current && !guard.has(current.id)) {
      guard.add(current.id);
      chain.unshift(current);
      current = current.parentId ? byId.get(current.parentId) : undefined;
    }
    return chain;
  }, [activeFolder, libraryFolders]);

  const visibleSources = useMemo(() => {
    let list = knowledgeSources;
    if (activeFolderId === '__unfiled__') {
      list = list.filter((s) => !s.folderId);
    } else if (activeFolderId) {
      list = list.filter((s) => s.folderId === activeFolderId);
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((s) => s.name.toLowerCase().includes(q) || s.preview.toLowerCase().includes(q));
    }
    return list.sort((a, b) => b.addedAt - a.addedAt);
  }, [knowledgeSources, activeFolderId, search]);

  // Unfiltered by the search box — the exam plan card needs every source
  // directly in this folder, not just the ones matching the current query.
  const sourcesInActiveFolder = useMemo(
    () => (activeFolder ? knowledgeSources.filter((s) => s.folderId === activeFolder.id) : []),
    [knowledgeSources, activeFolder],
  );

  const totalWords = useMemo(
    () => knowledgeSources.reduce((acc, s) => acc + s.wordCount, 0),
    [knowledgeSources],
  );

  const stats = useMemo(() => ({
    indexingCount: knowledgeSources.filter((s) => s.indexStatus === 'indexing').length,
    failedCount: knowledgeSources.filter((s) => s.indexStatus === 'error').length,
    chunkCount: knowledgeSources.reduce((acc, s) => acc + (s.chunkCount ?? 0), 0),
  }), [knowledgeSources]);

  const selectedSource = useMemo(
    () => knowledgeSources.find((s) => s.id === selectedSourceId) ?? null,
    [knowledgeSources, selectedSourceId],
  );

  const { chapters: sourceChapters } = useSourceChapters(readerOpen ? selectedSourceId : null);

  const submitNewFolder = () => {
    const name = newFolderName.trim();
    if (!name) { setCreatingFolder(false); return; }
    const emoji = FOLDER_EMOJIS[libraryFolders.length % FOLDER_EMOJIS.length] ?? '📚';
    const id = addLibraryFolder(name, emoji);
    setNewFolderName('');
    setCreatingFolder(false);
    setActiveFolderId(id);
    addToast(`Folderul „${name}" a fost creat.`, 'success');
  };

  const submitNewSubfolder = () => {
    const name = newSubfolderName.trim();
    if (!name || !activeFolder) { setCreatingSubfolder(false); setNewSubfolderName(''); return; }
    const id = addLibraryFolder(name, '📁', activeFolder.id);
    setNewSubfolderName('');
    setCreatingSubfolder(false);
    setActiveFolderId(id);
    addToast(`Subfolderul „${name}" a fost creat.`, 'success');
  };

  const confirmDeleteFolder = () => {
    if (!folderToDelete) return;
    const deletedId = folderToDelete.id;
    const parentOfDeleted = libraryFolders.find((folder) => folder.id === deletedId)?.parentId ?? null;
    deleteLibraryFolder(deletedId);
    addToast(`Folderul „${folderToDelete.name}" șters.`, 'info');
    // If we were viewing the folder we just deleted, step back to its parent.
    if (activeFolderId === deletedId) setActiveFolderId(parentOfDeleted);
    setFolderToDelete(null);
  };

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
    await new Promise<void>((resolve) => { window.setTimeout(resolve, 0); });
  };

  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    setLoading(true);
    setProcessStep(files.length > 1 ? `Pregătim ${files.length} fișiere...` : 'Pregătim documentul...');
    await yieldToPaint();

    // Determine which folder to upload into
    const targetFolderId = activeFolderId === '__unfiled__' ? null
      : (activeFolderId ?? null);

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
        const addedSource = await withTimeout(
          addKnowledgeSource(file.name, text, type, {
            onIndexProgress: ({ percent }: { percent: number }) => {
              setProcessStep(`${filePrefix}Indexăm ${file.name}... ${percent}%`);
            },
          }),
          20000,
          `Indexarea pentru ${file.name} s-a blocat.`,
        );

        // Auto-assign to active folder
        if (targetFolderId && addedSource?.id) {
          moveSourceToLibraryFolder(addedSource.id, targetFolderId);
        }

        addToast(`"${file.name}" a intrat în indexare.`, 'success');
      }
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Eroare la procesarea fișierelor.', 'error');
    } finally {
      setLoading(false);
      setProcessStep('');
      if (fileInputRef.current) fileInputRef.current.value = '';
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
    } catch {
      setReaderContent('Nu am putut încărca conținutul pentru această sursă.');
    } finally {
      setReaderLoading(false);
    }
  };

  // Deep-link from the proactive RAG toast (Task 7): /vault?source=<id> opens
  // that document's reader once, then clears the param.
  useEffect(() => {
    const sourceId = searchParams.get('source');
    if (!sourceId || deepLinkedSourceRef.current === sourceId) return;
    const source = knowledgeSources.find((s) => s.id === sourceId);
    if (!source) return;
    deepLinkedSourceRef.current = sourceId;
    void openReader(source);
    const next = new URLSearchParams(searchParams);
    next.delete('source');
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, knowledgeSources]);

  // Deep-link from other pages (e.g. the Residency bookshelf's "Adaugă carte" button):
  // /vault?folder=<id> selects that folder once, then clears the param.
  const deepLinkedFolderRef = useRef<string | null>(null);
  useEffect(() => {
    const folderId = searchParams.get('folder');
    if (!folderId || deepLinkedFolderRef.current === folderId) return;
    if (!libraryFolders.some((folder) => folder.id === folderId)) return;
    deepLinkedFolderRef.current = folderId;
    setActiveFolderId(folderId);
    const next = new URLSearchParams(searchParams);
    next.delete('folder');
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, libraryFolders]);

  const askAIAboutSource = (source: AIKnowledgeSource) => {
    setChatOpen(true);
    window.dispatchEvent(new CustomEvent('studyx:ai-prompt', {
      detail: {
        open: true,
        view: 'chat', // "Întreabă AI" opens a conversation, not the generator
        mode: 'summarize',
        sourceId: source.id,
        sourceName: source.name,
        resetConversation: true,
        prompt: `Analizează documentul "${source.name}" și rezumă-mi ideile-cheie, punctele sensibile și ce merită învățat prioritar din el.`,
      },
    }));
  };

  const openAIStudioForSource = (source?: AIKnowledgeSource) => {
    const targetSource = source ?? selectedSource ?? visibleSources.find((s) => s.indexStatus === 'ready') ?? null;
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

  const generateFromChapter = (heading: string, label: string) => {
    if (!selectedSource) return;
    setChatOpen(true);
    dispatchGenerateFromChapter(selectedSource, heading, label);
  };

  const isTopLevel = activeFolderId === null;

  const showFolderList = isTopLevel && !search.trim();
  const isSearchingTop = isTopLevel && !!search.trim();
  const showRecents = showFolderList && knowledgeSources.length >= 4;
  const recentSources = showRecents
    ? [...knowledgeSources].sort((a, b) => b.addedAt - a.addedAt).slice(0, 3)
    : [];
  const showEmptyHint = showFolderList && knowledgeSources.length === 0 && rootFolders.length === 0;

  const typeFilteredSources = visibleSources.filter((source) => {
    if (typeFilter === 'all') return true;
    if (typeFilter === 'image') return source.type === 'image';
    if (typeFilter === 'pdf') return source.type !== 'image';
    return source.indexStatus === 'indexing' || source.indexStatus === 'error';
  });

  const headerTitle = isTopLevel
    ? <>Biblioteca <span style={{ color: theme.accent }}>AI</span></>
    : activeFolderId === '__unfiled__'
      ? 'Neclasificate'
      : (activeFolder ? activeFolder.name : 'Bibliotecă');

  const headerSubtitle = isTopLevel
    ? `${knowledgeSources.length} ${knowledgeSources.length === 1 ? 'document' : 'documente'} · ${totalWords.toLocaleString('ro-RO')} cuvinte · ${stats.chunkCount.toLocaleString('ro-RO')} fragmente indexate`
    : `${sourcesInActiveFolder.length || (activeFolderId === '__unfiled__' ? folderCounts.unfiled : 0)} ${(sourcesInActiveFolder.length || (activeFolderId === '__unfiled__' ? folderCounts.unfiled : 0)) === 1 ? 'document' : 'documente'}${activeSubfolders.length > 0 ? ` · ${activeSubfolders.length} ${activeSubfolders.length === 1 ? 'subfolder' : 'subfoldere'}` : ''}`;

  const renderSourceRow = (source: AIKnowledgeSource, index: number) => {
    const isReady = source.indexStatus !== 'indexing' && source.indexStatus !== 'error';
    const menuOpen = menuSourceId === source.id;
    const folderName = source.folderId ? libraryFolders.find((f) => f.id === source.folderId)?.name : null;
    return (
      <motion.div
        key={source.id}
        layout={!performanceLite}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ delay: Math.min(index, 8) * 0.02 }}
        className="relative px-4 py-3"
        style={{ borderTop: index === 0 ? undefined : '1px solid var(--hairline)' }}
      >
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => isReady && void openReader(source)}
            className="flex min-w-0 flex-1 items-center gap-3 text-left"
            aria-label={`Deschide ${source.name}`}
          >
            <div
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px]"
              style={{
                background: source.type === 'image' ? `${theme.warning}18` : `${theme.accent}18`,
                color: source.type === 'image' ? theme.warning : theme.accent,
              }}
            >
              {source.type === 'image' ? <Image size={18} /> : <FileText size={18} />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[14px] font-semibold" style={{ color: theme.text }}>{source.name.replace(/\.(pdf|docx|txt|md)$/i, '')}</div>
              <div className="truncate text-[12px]" style={{ color: theme.text3 }}>
                {source.type.toUpperCase()}
                {(source.chunkCount ?? 0) > 0 && ` · ${source.chunkCount!.toLocaleString('ro-RO')} fragmente`}
                {` · ${source.wordCount.toLocaleString('ro-RO')} cuvinte`}
                {` · ${new Date(source.addedAt).toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' })}`}
                {isSearchingTop && folderName ? ` · ${folderName}` : ''}
              </div>
            </div>
          </button>

          <SourceStatusBadge source={source} theme={theme} />
          <button
            type="button"
            onClick={() => isReady && askAIAboutSource(source)}
            disabled={!isReady}
            className="fine-chip press-feedback hidden rounded-full px-3 py-1.5 text-[12.5px] font-semibold disabled:opacity-40 sm:block"
            style={{ color: theme.accent }}
          >
            Întreabă
          </button>
          <button
            type="button"
            onClick={() => setMenuSourceId(menuOpen ? null : source.id)}
            aria-label="Mai multe acțiuni"
            aria-expanded={menuOpen}
            className="fine-row press-feedback flex h-8 w-8 items-center justify-center rounded-full"
            style={{ color: theme.text3 }}
          >
            <MoreHorizontal size={18} />
          </button>
        </div>

        {source.indexStatus === 'indexing' && (
          <div className="mt-2.5 h-[3px] overflow-hidden rounded-full" style={{ background: 'var(--fill-subtle)' }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(4, Math.round(source.indexProgress ?? 0))}%`, background: theme.accent }} />
          </div>
        )}
        {source.indexStatus === 'error' && source.indexError && (
          <p className="mt-2 text-[11.5px] font-medium" style={{ color: theme.danger }}>{source.indexError}</p>
        )}

        {movingSourceId === source.id && (
          <div className="mt-2.5 flex items-center gap-2" style={{ maxWidth: 320 }}>
            <div className="flex-1">
              <ThemedSelect
                size="sm"
                defaultOpen
                value={source.folderId ?? ''}
                onChange={(folderId) => {
                  moveSourceToLibraryFolder(source.id, folderId || null);
                  setMovingSourceId(null);
                }}
                onRequestClose={() => setMovingSourceId(null)}
                options={[{ value: '', label: '📂 Neclasificate' }, ...libraryFolderOptions]}
              />
            </div>
            <button type="button" onClick={() => setMovingSourceId(null)} aria-label="Renunță" style={{ color: theme.text3 }}><X size={14} /></button>
          </div>
        )}

        {menuOpen && (
          <>
            <button type="button" aria-label="Închide meniul" className="fixed inset-0 z-30 cursor-default" onClick={() => setMenuSourceId(null)} />
            <div
              className="absolute right-3 top-11 z-40 w-52 overflow-hidden rounded-xl py-1"
              style={{ background: theme.modalBg, border: '1px solid var(--hairline)', boxShadow: '0 12px 32px var(--shadow-color-soft)' }}
              role="menu"
            >
              {[
                { label: 'Deschide', run: () => void openReader(source), needsReady: true },
                { label: 'Întreabă AI', run: () => askAIAboutSource(source), needsReady: true },
                { label: 'AI Studio', run: () => openAIStudioForSource(source), needsReady: true },
                { label: 'Mută în folder', run: () => setMovingSourceId(source.id), needsReady: false },
              ].map((item) => (
                <button
                  key={item.label}
                  type="button"
                  role="menuitem"
                  disabled={item.needsReady && !isReady}
                  onClick={() => { setMenuSourceId(null); item.run(); }}
                  className="fine-row block w-full px-3.5 py-2 text-left text-[13px] disabled:opacity-40"
                  style={{ color: theme.text, borderRadius: 0 }}
                >
                  {item.label}
                </button>
              ))}
              <div className="my-1" style={{ borderTop: '1px solid var(--hairline)' }} />
              <button
                type="button"
                role="menuitem"
                onClick={() => { setMenuSourceId(null); removeKnowledgeSource(source.id); }}
                className="fine-row block w-full px-3.5 py-2 text-left text-[13px]"
                style={{ color: theme.danger, borderRadius: 0 }}
              >
                Șterge documentul
              </button>
            </div>
          </>
        )}
      </motion.div>
    );
  };

  const renderFolderRow = (folder: AILibraryFolder, index: number, onOpen: () => void) => {
    const docCount = folderCounts.counts.get(folder.id) ?? 0;
    const subCount = subfoldersByParent.get(folder.id)?.length ?? 0;
    const isEmpty = docCount === 0 && subCount === 0;
    const isRezidentiat = isRezidentiatRootFolder(folder);
    const fragments = knowledgeSources.reduce((sum, s) => (s.folderId === folder.id ? sum + (s.chunkCount ?? 0) : sum), 0);
    return (
      <div key={folder.id} className="group relative" style={{ borderTop: index === 0 ? undefined : '1px solid var(--hairline)' }}>
        <button
          type="button"
          onClick={onOpen}
          className="fine-row flex w-full items-center gap-3 px-4 py-3 text-left"
          style={{ borderRadius: 0 }}
        >
          <div
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px] text-lg"
            style={{ background: isEmpty ? 'var(--fill-subtle)' : `${theme.accent}18`, opacity: isEmpty ? 0.7 : 1 }}
          >
            {folder.emoji ?? '📚'}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[14px] font-semibold" style={{ color: isEmpty ? theme.text2 : theme.text }}>{folder.name}</div>
            <div className="truncate text-[12px]" style={{ color: theme.text3 }}>
              {isEmpty
                ? 'Gol'
                : `${docCount} ${docCount === 1 ? 'document' : 'documente'}${fragments > 0 ? ` · ${fragments.toLocaleString('ro-RO')} fragmente` : ''}${subCount > 0 ? ` · ${subCount} ${subCount === 1 ? 'subfolder' : 'subfoldere'}` : ''}`}
            </div>
          </div>
          {isRezidentiat && !isEmpty && <span className="w-0 sm:w-40" aria-hidden="true" />}
          <ChevronRight size={16} style={{ color: theme.text3 }} />
        </button>
        {isRezidentiat && !isEmpty && (
          <Link
            to="/rezidentiat"
            className="press-feedback absolute right-11 top-1/2 hidden -translate-y-1/2 text-[12.5px] font-semibold sm:block"
            style={{ color: theme.accent }}
          >
            Deschide în Rezidențiat
          </Link>
        )}
        <button
          type="button"
          onClick={() => setFolderToDelete({ id: folder.id, name: folder.name })}
          aria-label={`Șterge folderul ${folder.name}`}
          title="Șterge folderul"
          className="fine-row absolute right-9 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
          style={{ color: theme.danger }}
        >
          <Trash2 size={13} />
        </button>
      </div>
    );
  };

  const FILTERS: Array<{ id: TypeFilter; label: string }> = [
    { id: 'all', label: 'Toate' },
    { id: 'pdf', label: 'Documente' },
    { id: 'image', label: 'Imagini' },
    { id: 'indexing', label: 'În indexare' },
  ];

  return (
    <div className="h-full overflow-y-auto px-4 py-6 sm:px-8 sm:py-10">
      <div className="mx-auto max-w-3xl space-y-6">
        {/* Header */}
        <motion.header initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          {!isTopLevel && (
            <div className="mb-2 flex flex-wrap items-center gap-0.5 text-[13.5px] font-medium">
              <button
                type="button"
                onClick={() => { setActiveFolderId(null); setSearch(''); setTypeFilter('all'); }}
                className="press-feedback inline-flex items-center gap-0.5"
                style={{ color: theme.accent }}
              >
                <ArrowLeft size={15} /> Biblioteca AI
              </button>
              {folderPath.slice(0, -1).map((ancestor) => (
                <span key={ancestor.id} className="flex items-center gap-0.5" style={{ color: theme.text3 }}>
                  <ChevronRight size={13} />
                  <button
                    type="button"
                    onClick={() => { setActiveFolderId(ancestor.id); setSearch(''); setTypeFilter('all'); }}
                    style={{ color: theme.accent }}
                  >
                    {ancestor.name}
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="page-title-compact" style={{ color: theme.text }}>{headerTitle}</h1>
              <p className="mt-1 text-[13px]" style={{ color: theme.text3 }}>{headerSubtitle}</p>
            </div>
            <div className="flex flex-shrink-0 items-center gap-2">
              {!isTopLevel && activeFolder && !creatingSubfolder && (
                <button
                  type="button"
                  onClick={() => setCreatingSubfolder(true)}
                  className="fine-chip press-feedback flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-medium"
                  style={{ color: theme.text2 }}
                >
                  <FolderPlus size={14} /> Subfolder nou
                </button>
              )}
              {isTopLevel && (
                <button
                  type="button"
                  onClick={() => openAIStudioForSource()}
                  className="fine-chip press-feedback flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-medium"
                  style={{ color: theme.text2 }}
                >
                  <Layers3 size={14} /> AI Studio
                </button>
              )}
              <input
                type="file"
                ref={fileInputRef}
                multiple
                accept=".pdf,.docx,.txt,.md,image/*"
                className="hidden"
                onChange={handleFileUpload}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                className="press-feedback flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-semibold text-white transition-[filter] duration-300 hover:brightness-110 disabled:opacity-70"
                style={{ background: theme.accent }}
              >
                {loading ? <><Loader2 size={14} className="animate-spin" /> Procesăm…</> : <><Plus size={14} /> {isTopLevel ? 'Adaugă' : 'Adaugă în folder'}</>}
              </button>
            </div>
          </div>
          {loading && processStep && (
            <div className="mt-3 inline-flex rounded-full px-3.5 py-1.5 text-[12px] font-medium" style={{ background: `${theme.accent}12`, color: theme.accent }}>
              {processStep}
            </div>
          )}
        </motion.header>

        {/* Search (+ type filters inside a folder) */}
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex min-w-[200px] flex-1 items-center gap-2 rounded-[10px] px-3 py-2" style={{ background: 'var(--fill-subtle)' }}>
            <Search size={15} style={{ color: theme.text3 }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={isTopLevel ? 'Caută în toate documentele' : 'Caută în folder'}
              aria-label="Caută documente"
              className="w-full bg-transparent text-[13.5px] outline-none"
              style={{ color: theme.text }}
            />
            {search && (
              <button type="button" onClick={() => setSearch('')} aria-label="Șterge căutarea" style={{ color: theme.text3 }}><X size={14} /></button>
            )}
          </label>
          {!isTopLevel && FILTERS.map((filter) => (
            <button
              key={filter.id}
              type="button"
              data-active={typeFilter === filter.id}
              aria-pressed={typeFilter === filter.id}
              onClick={() => setTypeFilter(filter.id)}
              className="fine-chip press-feedback rounded-full px-3 py-1.5 text-[12.5px] font-medium"
              style={{ color: typeFilter === filter.id ? undefined : theme.text2 }}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {/* ── TOP LEVEL ── */}
        {showRecents && (
          <section>
            <h2 className="mb-2 px-1 text-[12px] font-medium tracking-wide" style={{ color: theme.text3 }}>RECENTE</h2>
            <div className="grid gap-2.5 sm:grid-cols-3">
              {recentSources.map((source) => (
                <button
                  key={source.id}
                  type="button"
                  onClick={() => source.indexStatus !== 'indexing' && source.indexStatus !== 'error' && void openReader(source)}
                  className="fine-card press-feedback rounded-2xl p-3 text-left"
                  style={{ background: theme.surface }}
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-[10px]" style={{ background: `${theme.accent}18`, color: theme.accent }}>
                    {source.type === 'image' ? <Image size={18} /> : <FileText size={18} />}
                  </div>
                  <div className="mt-2.5 truncate text-[13.5px] font-semibold" style={{ color: theme.text }}>{source.name.replace(/\.(pdf|docx|txt|md)$/i, '')}</div>
                  <div className="text-[12px]" style={{ color: theme.text3 }}>
                    {source.folderId ? libraryFolders.find((f) => f.id === source.folderId)?.name ?? 'Bibliotecă' : 'Neclasificate'}
                    {source.indexStatus === 'ready' || source.indexStatus === undefined ? ' · indexat' : source.indexStatus === 'indexing' ? ' · se indexează' : ' · eroare'}
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {showFolderList && (
          <section>
            <h2 className="mb-2 px-1 text-[12px] font-medium tracking-wide" style={{ color: theme.text3 }}>FOLDERE</h2>
            {showEmptyHint ? (
              <div className="rounded-2xl px-5 py-10 text-center" style={{ background: theme.surface, border: '1px solid var(--hairline)' }}>
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: `${theme.accent}18` }}>
                  <Library size={22} style={{ color: theme.accent }} />
                </div>
                <p className="text-[15px] font-semibold" style={{ color: theme.text }}>Biblioteca e goală</p>
                <p className="mx-auto mt-1 max-w-sm text-[13px]" style={{ color: theme.text3 }}>
                  Adaugă PDF-uri, documente Word sau imagini, iar AI-ul le folosește ca sursă pentru răspunsuri.
                </p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl" style={{ background: theme.surface, border: '1px solid var(--hairline)' }}>
                {folderCounts.unfiled > 0 && (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setActiveFolderId('__unfiled__')}
                      className="fine-row flex w-full items-center gap-3 px-4 py-3 text-left"
                      style={{ borderRadius: 0 }}
                    >
                      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px] text-lg" style={{ background: 'var(--fill-subtle)' }}>📂</div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[14px] font-semibold" style={{ color: theme.text }}>Neclasificate</div>
                        <div className="text-[12px]" style={{ color: theme.text3 }}>{folderCounts.unfiled} {folderCounts.unfiled === 1 ? 'document' : 'documente'}</div>
                      </div>
                      <ChevronRight size={16} style={{ color: theme.text3 }} />
                    </button>
                  </div>
                )}
                {rootFolders.map((folder, i) => renderFolderRow(folder, i + (folderCounts.unfiled > 0 ? 1 : 0), () => setActiveFolderId(folder.id)))}
                {creatingFolder && (
                  <div className="flex items-center gap-3 px-4 py-3" style={{ borderTop: '1px solid var(--hairline)' }}>
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px] text-lg" style={{ background: `${theme.accent}18` }}>📚</div>
                    <input
                      autoFocus
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') submitNewFolder();
                        if (e.key === 'Escape') { setCreatingFolder(false); setNewFolderName(''); }
                      }}
                      onBlur={submitNewFolder}
                      placeholder="Nume folder"
                      aria-label="Nume folder nou"
                      className="w-full rounded-[10px] px-3 py-2 text-[14px] font-medium outline-none"
                      style={{ background: 'var(--fill-subtle)', color: theme.text }}
                    />
                  </div>
                )}
              </div>
            )}
            {!creatingFolder && (
              <button
                type="button"
                onClick={() => setCreatingFolder(true)}
                className="press-feedback mt-3 flex items-center gap-1.5 px-1 text-[13px] font-semibold"
                style={{ color: theme.accent }}
              >
                <FolderPlus size={14} /> Folder nou
              </button>
            )}
          </section>
        )}

        {/* ── SEARCH RESULTS (top level) and FOLDER LEVEL: documents ── */}
        {(isSearchingTop || !isTopLevel) && (
          <div className="space-y-5">
            {!isTopLevel && activeFolder && (activeSubfolders.length > 0 || creatingSubfolder) && (
              <section>
                <h2 className="mb-2 px-1 text-[12px] font-medium tracking-wide" style={{ color: theme.text3 }}>SUBFOLDERE</h2>
                <div className="overflow-hidden rounded-2xl" style={{ background: theme.surface, border: '1px solid var(--hairline)' }}>
                  {activeSubfolders.map((folder, i) => renderFolderRow(folder, i, () => { setActiveFolderId(folder.id); setSearch(''); setTypeFilter('all'); }))}
                  {creatingSubfolder && (
                    <div className="flex items-center gap-3 px-4 py-3" style={{ borderTop: activeSubfolders.length > 0 ? '1px solid var(--hairline)' : undefined }}>
                      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px] text-lg" style={{ background: `${theme.accent}18` }}>📁</div>
                      <input
                        autoFocus
                        value={newSubfolderName}
                        onChange={(e) => setNewSubfolderName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') submitNewSubfolder();
                          if (e.key === 'Escape') { setCreatingSubfolder(false); setNewSubfolderName(''); }
                        }}
                        onBlur={submitNewSubfolder}
                        placeholder="Nume subfolder"
                        aria-label="Nume subfolder nou"
                        className="w-full rounded-[10px] px-3 py-2 text-[14px] font-medium outline-none"
                        style={{ background: 'var(--fill-subtle)', color: theme.text }}
                      />
                    </div>
                  )}
                </div>
              </section>
            )}

            {activeFolder && <ExamPlanCard folder={activeFolder} sources={sourcesInActiveFolder} />}

            {typeFilteredSources.length === 0 ? (
              <div className="py-14 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: `${theme.accent}18` }}>
                  <Library size={26} style={{ color: theme.accent }} />
                </div>
                <p className="text-[15px] font-semibold" style={{ color: theme.text }}>
                  {search || typeFilter !== 'all' ? 'Niciun document găsit.' : 'Folderul e gol.'}
                </p>
                <p className="mt-1 text-[13px]" style={{ color: theme.text3 }}>
                  {search || typeFilter !== 'all' ? 'Încearcă altă căutare sau alt filtru.' : 'Adaugă documente cu butonul „Adaugă în folder".'}
                </p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl" style={{ background: theme.surface, border: '1px solid var(--hairline)' }}>
                <AnimatePresence initial={false}>
                  {typeFilteredSources.map((source, index) => renderSourceRow(source, index))}
                </AnimatePresence>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Reader modal */}
      <AnimatePresence>
        {readerOpen && selectedSource && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setReaderOpen(false)}
              className="fixed inset-0 z-50 bg-[var(--overlay)]"
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
                  <div className="text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: theme.text3 }}>Vizualizare document</div>
                  <h2 className="mt-1 truncate text-2xl font-black tracking-tight" style={{ color: theme.text }}>{selectedSource.name}</h2>
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
                  <>
                    {selectedSource.indexStatus === 'ready' && sourceChapters.length > 0 && (
                      <div className="glass-panel mb-5 rounded-[28px] p-5">
                        <div className="mb-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: theme.text3 }}>
                          <Layers3 size={13} /> Capitole detectate
                        </div>
                        <div className="space-y-2">
                          {sourceChapters.map((chapter) => (
                            <div
                              key={chapter.heading}
                              className="glass-panel flex items-center justify-between gap-3 rounded-2xl px-4 py-3"
                            >
                              <div className="min-w-0">
                                <div className="truncate text-sm font-bold" style={{ color: theme.text }}>{chapter.label}</div>
                                <div className="text-[11px] font-medium" style={{ color: theme.text3 }}>{chapter.chunkCount} fragmente indexate</div>
                              </div>
                              <button
                                onClick={() => generateFromChapter(chapter.heading, chapter.label)}
                                className="flex-shrink-0 rounded-xl px-3 py-2 text-[11px] font-black uppercase tracking-[0.1em]"
                                style={{ background: `${theme.accent}15`, border: `1px solid ${theme.accent}25`, color: theme.accent }}
                              >
                                Generează grile
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="glass-panel rounded-[28px] p-6">
                      <pre className="whitespace-pre-wrap break-words text-sm leading-7" style={{ color: theme.text, fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}>
                        {readerContent}
                      </pre>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <ConfirmDialog
        open={folderToDelete !== null}
        title={`Ștergi folderul „${folderToDelete?.name}"?`}
        description="Documentele rămân în Neclasificate, dar subfolderele acestui folder vor fi șterse. Acțiunea nu poate fi anulată."
        confirmLabel="Șterge folderul"
        cancelLabel="Anulează"
        variant="danger"
        onConfirm={confirmDeleteFolder}
        onCancel={() => setFolderToDelete(null)}
      />
    </div>
  );
}
