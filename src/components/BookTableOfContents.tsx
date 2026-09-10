import { useMemo, useState } from 'react';
import { ChevronRight, Library } from 'lucide-react';
import { useTheme } from '../theme/ThemeContext';
import type { AIKnowledgeSource } from '../store/aiStore';
import { useSourceChapters, type SourceChapter } from '../hooks/useSourceChapters';
import { KUMAR_TABLE_OF_CONTENTS } from '../data/rezidentiat/kumarTableOfContents';
import { REZIDENTIAT_LIBRARY_BOOKS } from '../lib/rezidentiatLibrary';
import { getChapterFullText } from '../lib/ai/bookChapterText';
import BookChapterReaderModal from './BookChapterReaderModal';

type Theme = ReturnType<typeof useTheme>;

const KUMAR_BOOK = REZIDENTIAT_LIBRARY_BOOKS.find((b) => b.id === 'kumar-clark');

function normalizeTitle(title: string): string {
  return title.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

interface ReaderState {
  title: string;
  pageLabel?: string;
  loading: boolean;
  content: string;
}

/**
 * "Cuprins" — reading-only table of contents, separate from BookChapters
 * (which stays scoped to the curated Tematica headings used for AI
 * generation). Lawrence and Sinopsis show that same curated list, but with
 * full chapter text instead of AI actions. Kumar shows its real 41-chapter
 * printed structure (titles + pages) for reference, but only the entries that
 * match an already-indexed heading for this source are actually readable —
 * the raw extracted text doesn't contain every chapter's body (verified, not
 * assumed; see kumarTableOfContents.ts), so the rest are marked unavailable
 * instead of silently missing or guessed.
 */
export default function BookTableOfContents({ source, theme }: { source: AIKnowledgeSource; theme: Theme }) {
  const isKumar = KUMAR_BOOK !== undefined && source.name === KUMAR_BOOK.name;
  const { chapters: indexedChapters, loading: indexedLoading } = useSourceChapters(source.id);
  const [reader, setReader] = useState<ReaderState | null>(null);

  const kumarEntries = useMemo(() => {
    if (!isKumar) return [];
    const byNormalizedTitle = new Map<string, SourceChapter>(
      indexedChapters.map((chapter) => [normalizeTitle(chapter.label), chapter]),
    );
    return KUMAR_TABLE_OF_CONTENTS.map((entry) => ({
      entry,
      indexed: byNormalizedTitle.get(normalizeTitle(entry.title)) ?? null,
    }));
  }, [indexedChapters, isKumar]);

  const openChapter = async (heading: string, label: string, pageLabel?: string) => {
    setReader({ title: label, pageLabel, loading: true, content: '' });
    const text = await getChapterFullText(source.id, heading);
    setReader({ title: label, pageLabel, loading: false, content: text });
  };

  if (indexedLoading) {
    return (
      <div className="space-y-2 py-4">
        <div className="skeleton-block h-10 rounded-xl" />
        <div className="skeleton-block h-10 rounded-xl" />
      </div>
    );
  }

  if (isKumar) {
    return (
      <div className="py-4">
        <div className="mb-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: theme.text3 }}>
          <Library size={13} /> Cuprins ({KUMAR_TABLE_OF_CONTENTS.length} capitole)
        </div>
        <div className="space-y-1.5">
          {kumarEntries.map(({ entry, indexed }) => (
            <button
              key={entry.number}
              disabled={!indexed}
              onClick={() => indexed && void openChapter(indexed.heading, entry.title, `pagina ${entry.page}`)}
              className="flex w-full items-center justify-between gap-3 rounded-xl px-3.5 py-2.5 text-left transition-colors disabled:cursor-default"
              style={{ background: theme.surface2, opacity: indexed ? 1 : 0.5 }}
            >
              <span className="min-w-0 truncate text-[13px] font-semibold" style={{ color: indexed ? theme.text2 : theme.text3 }}>
                {entry.number}. {entry.title}
              </span>
              <span className="flex flex-shrink-0 items-center gap-2 text-[11px] font-medium" style={{ color: theme.text3 }}>
                pag. {entry.page}
                {indexed ? <ChevronRight size={13} /> : <span className="text-[10px] italic">text indisponibil</span>}
              </span>
            </button>
          ))}
        </div>
        {reader && (
          <BookChapterReaderModal
            title={reader.title}
            pageLabel={reader.pageLabel}
            loading={reader.loading}
            content={reader.content}
            onClose={() => setReader(null)}
          />
        )}
      </div>
    );
  }

  if (indexedChapters.length === 0) return null;

  return (
    <div className="py-4">
      <div className="mb-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: theme.text3 }}>
        <Library size={13} /> Cuprins ({indexedChapters.length} capitole)
      </div>
      <div className="space-y-1.5">
        {indexedChapters.map((chapter) => (
          <button
            key={chapter.heading}
            onClick={() => void openChapter(chapter.heading, chapter.label)}
            className="flex w-full items-center justify-between gap-3 rounded-xl px-3.5 py-2.5 text-left transition-colors hover:bg-white/5"
            style={{ background: theme.surface2 }}
          >
            <span className="min-w-0 truncate text-[13px] font-semibold" style={{ color: theme.text2 }}>{chapter.label}</span>
            <ChevronRight size={13} className="flex-shrink-0" style={{ color: theme.text3 }} />
          </button>
        ))}
      </div>
      {reader && (
        <BookChapterReaderModal
          title={reader.title}
          pageLabel={reader.pageLabel}
          loading={reader.loading}
          content={reader.content}
          onClose={() => setReader(null)}
        />
      )}
    </div>
  );
}
