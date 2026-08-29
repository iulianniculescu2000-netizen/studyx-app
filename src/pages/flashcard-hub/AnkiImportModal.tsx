import { AnimatePresence, motion } from 'framer-motion';
import { useRef, useState } from 'react';
import { AlertCircle, Check, ChevronDown, FolderTree, Loader2, Upload, Volume2, X as XIcon } from 'lucide-react';
import type { Folder, Quiz } from '../../types';
import type { Theme } from '../../theme/themes';
import { parseApkg } from '../../lib/anki/ankiParser';
import { mapAnkiCollectionToDecks, planFolderChain, type MappedAnkiDeck } from '../../lib/anki/ankiImport';
import { suggestFolderAppearance } from '../../lib/folderAppearance';
import { useFolderStore } from '../../store/folderStore';
import { useQuizStore } from '../../store/quizStore';

type Phase = 'pick' | 'parsing' | 'summary' | 'importing' | 'error';

function folderPath(folders: Folder[], folder: Folder) {
  const byId = new Map(folders.map((item) => [item.id, item]));
  const names = [folder.name];
  let parent = folder.parentId ? byId.get(folder.parentId) : undefined;
  const guard = new Set([folder.id]);
  while (parent && !guard.has(parent.id)) {
    guard.add(parent.id);
    names.unshift(parent.name);
    parent = parent.parentId ? byId.get(parent.parentId) : undefined;
  }
  return names.join(' / ');
}

export function AnkiImportModal({
  folders,
  theme,
  onClose,
  onImported,
}: {
  folders: Folder[];
  theme: Theme;
  onClose: () => void;
  onImported: (firstQuizId: string | null) => void;
}) {
  const addFolder = useFolderStore((state) => state.addFolder);
  const addQuiz = useQuizStore((state) => state.addQuiz);

  const [phase, setPhase] = useState<Phase>('pick');
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ decks: MappedAnkiDeck[]; stats: { deckCount: number; cardCount: number; clozeCount: number; imageCount: number; skippedAudioCount: number } } | null>(null);
  const [parentFolderId, setParentFolderId] = useState<string>('__root__');
  const [parentPickerOpen, setParentPickerOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parentOptions = [
    { id: '__root__', label: 'Fără folder părinte (rădăcină)' },
    ...folders.map((folder) => ({ id: folder.id, label: folderPath(folders, folder) })),
  ];
  const selectedParentLabel = parentOptions.find((option) => option.id === parentFolderId)?.label ?? 'Fără folder părinte (rădăcină)';

  const handleFilePick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (file: File) => {
    setPhase('parsing');
    setError('');
    try {
      const collection = await parseApkg(file);
      const mapped = await mapAnkiCollectionToDecks(collection);
      if (mapped.decks.length === 0) {
        throw new Error('Nu s-a găsit niciun card în acest pachet Anki.');
      }
      setResult(mapped);
      setPhase('summary');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Eroare la citirea fișierului .apkg.');
      setPhase('error');
    }
  };

  const confirmImport = () => {
    if (!result) return;
    setPhase('importing');

    try {
      const rootParentId = parentFolderId === '__root__' ? null : parentFolderId;
      const folderIdByPath = new Map<string, string>();

      for (const path of planFolderChain(result.decks.map((deck) => deck.path))) {
        const key = path.join('::');
        const segment = path[path.length - 1];
        const parentId = path.length > 1 ? (folderIdByPath.get(path.slice(0, -1).join('::')) ?? rootParentId) : rootParentId;
        const appearance = suggestFolderAppearance(segment);
        folderIdByPath.set(key, addFolder(segment, appearance.emoji, appearance.color, parentId));
      }

      let firstQuizId: string | null = null;
      for (const deck of result.decks) {
        const leafFolderId = deck.path.length > 0 ? (folderIdByPath.get(deck.path.join('::')) ?? rootParentId) : rootParentId;
        const quiz: Quiz = { ...deck.quiz, folderId: leafFolderId };
        addQuiz(quiz);
        if (!firstQuizId) firstQuizId = quiz.id;
      }

      onImported(firstQuizId);
    } catch (err: unknown) {
      // Without this the modal would stay in 'importing' forever — a phase that
      // deliberately hides the close button — leaving a reload as the only exit.
      setError(err instanceof Error ? err.message : 'Salvarea deck-urilor a eșuat.');
      setPhase('error');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)', padding: '2rem 1rem' }}
      onClick={(event) => { if (event.target === event.currentTarget && phase !== 'importing') onClose(); }}
    >
      <motion.div
        initial={{ scale: 0.95, y: 24 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        className="w-full max-w-lg rounded-[28px] p-6 shadow-2xl"
        style={{ background: theme.surface, border: `1px solid ${theme.border}` }}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-[15px] font-black" style={{ color: theme.text }}>Import din Anki (.apkg)</h2>
          {phase !== 'importing' && (
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-xl transition-colors"
              style={{ color: theme.text3, background: theme.surface2 }}
            >
              <XIcon size={16} />
            </button>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".apkg"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.currentTarget.value = '';
            if (file) void handleFileChange(file);
          }}
        />

        {phase === 'pick' && (
          <div className="flex flex-col gap-3">
            <p className="text-[12px] font-medium leading-relaxed opacity-70" style={{ color: theme.text }}>
              Alege fișierul .apkg exportat din Anki. Structura de deck-uri (::) devine foldere imbricate,
              iar fiecare notă devine un card față/spate.
            </p>
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={handleFilePick}
              className="flex w-full items-center justify-center gap-2 rounded-[16px] py-3.5 text-xs font-black uppercase tracking-widest text-white transition-all"
              style={{ background: theme.accent }}
            >
              <Upload size={16} />
              Selectează fișier .apkg
            </motion.button>
          </div>
        )}

        {phase === 'parsing' && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 size={28} className="animate-spin" style={{ color: theme.accent }} />
            <p className="text-xs font-bold" style={{ color: theme.text3 }}>Se citește pachetul Anki...</p>
          </div>
        )}

        {phase === 'error' && (
          <div className="flex flex-col gap-3">
            <div
              className="flex items-start gap-2.5 rounded-2xl border p-3"
              style={{ background: `${theme.danger}08`, borderColor: `${theme.danger}20`, color: theme.danger }}
            >
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              <div className="text-[11px] font-bold leading-relaxed">{error}</div>
            </div>
            <button
              onClick={() => setPhase(result ? 'summary' : 'pick')}
              className="rounded-[16px] py-3 text-[11px] font-black uppercase tracking-wider transition-all"
              style={{ background: theme.surface2, color: theme.text3 }}
            >
              {result ? 'Înapoi la sumar' : 'Încearcă din nou'}
            </button>
          </div>
        )}

        {(phase === 'summary' || phase === 'importing') && result && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Deck-uri', value: result.stats.deckCount },
                { label: 'Carduri', value: result.stats.cardCount },
                { label: 'Imagini', value: result.stats.imageCount },
              ].map((stat) => (
                <div key={stat.label} className="rounded-[14px] p-3 text-center" style={{ background: theme.surface2 }}>
                  <div className="text-lg font-black leading-none" style={{ color: theme.text }}>{stat.value}</div>
                  <div className="mt-1 text-[9px] font-black uppercase tracking-wider opacity-55" style={{ color: theme.text }}>{stat.label}</div>
                </div>
              ))}
            </div>

            {(result.stats.clozeCount > 0 || result.stats.skippedAudioCount > 0) && (
              <div className="flex flex-col gap-1.5 rounded-[14px] border p-3" style={{ borderColor: theme.border, background: theme.surface2 }}>
                {result.stats.clozeCount > 0 && (
                  <p className="text-[10px] font-bold opacity-70" style={{ color: theme.text }}>
                    {result.stats.clozeCount} carduri cloze au fost simplificate la față/spate simplu.
                  </p>
                )}
                {result.stats.skippedAudioCount > 0 && (
                  <p className="flex items-center gap-1.5 text-[10px] font-bold opacity-70" style={{ color: theme.text }}>
                    <Volume2 size={11} />
                    {result.stats.skippedAudioCount} fișiere audio au fost omise (nu sunt redate în StudyX).
                  </p>
                )}
              </div>
            )}

            <div className="max-h-48 overflow-y-auto rounded-[14px] border" style={{ borderColor: theme.border }}>
              {result.decks.map((deck) => (
                <div
                  key={deck.quiz.id}
                  className="flex items-center justify-between gap-2 border-b px-3 py-2 last:border-b-0"
                  style={{ borderColor: theme.border }}
                >
                  <span className="min-w-0 flex-1 truncate text-[11px] font-bold" style={{ color: theme.text }}>
                    {deck.path.join(' / ')}
                  </span>
                  <span className="shrink-0 text-[10px] font-black opacity-55" style={{ color: theme.text }}>
                    {deck.quiz.questions.length}
                  </span>
                </div>
              ))}
            </div>

            <div className="relative">
              <button
                type="button"
                disabled={phase === 'importing'}
                onClick={() => setParentPickerOpen((current) => !current)}
                className="flex w-full items-center gap-2 rounded-[14px] border px-3 py-2.5 text-left transition-all disabled:opacity-60"
                style={{ background: theme.surface2, borderColor: theme.border, color: theme.text }}
              >
                <FolderTree size={14} style={{ color: theme.text3 }} />
                <div className="min-w-0 flex-1">
                  <div className="text-[9px] font-black uppercase tracking-[0.18em]" style={{ color: theme.text3 }}>
                    Folder părinte
                  </div>
                  <div className="mt-0.5 truncate text-xs font-black">{selectedParentLabel}</div>
                </div>
                <ChevronDown size={14} style={{ color: theme.text3 }} />
              </button>

              <AnimatePresence>
                {parentPickerOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    className="custom-scrollbar absolute left-0 right-0 top-[calc(100%+0.4rem)] z-10 max-h-44 overflow-y-auto rounded-[14px] border p-1.5 shadow-2xl"
                    style={{
                      background: theme.isDark ? 'rgba(20,24,30,0.98)' : 'rgba(255,255,255,0.98)',
                      borderColor: theme.border,
                    }}
                  >
                    {parentOptions.map((option) => {
                      const active = option.id === parentFolderId;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => { setParentFolderId(option.id); setParentPickerOpen(false); }}
                          className="flex w-full items-center gap-2 rounded-[10px] px-3 py-2 text-left transition-all"
                          style={{
                            background: active ? theme.accent : 'transparent',
                            color: active ? '#fff' : theme.text,
                          }}
                        >
                          <span className="min-w-0 flex-1 truncate text-xs font-bold">{option.label}</span>
                          {active && <Check size={13} />}
                        </button>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <motion.button
              whileHover={{ scale: phase === 'importing' ? 1 : 1.01 }}
              whileTap={{ scale: phase === 'importing' ? 1 : 0.99 }}
              disabled={phase === 'importing'}
              onClick={confirmImport}
              className="flex w-full items-center justify-center gap-2 rounded-[16px] py-3.5 text-xs font-black uppercase tracking-widest text-white transition-all"
              style={{
                background: phase === 'importing' ? theme.surface2 : theme.accent,
                color: phase === 'importing' ? theme.text3 : '#fff',
              }}
            >
              {phase === 'importing' ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Se importă...
                </>
              ) : (
                <>
                  <Check size={16} />
                  Importă {result.stats.deckCount} deck-uri
                </>
              )}
            </motion.button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
