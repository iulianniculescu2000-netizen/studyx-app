import { useEffect, useState } from 'react';
import { getVaultChunksBySource } from '../ai/vectorStore';
import { WHOLE_DOCUMENT_HEADING } from '../lib/ai/chapterQuizGeneration';

export interface SourceChapter {
  heading: string;
  /** Human-readable label — the heading text, or a fallback for undetected structure. */
  label: string;
  chunkCount: number;
}

/**
 * Groups a Knowledge Vault source's chunks by detected heading, in the order headings first
 * appear in the document. Sources with no detected structure (common for scanned/poorly
 * formatted PDFs) come back as a single "Document complet" bucket — chapter-scoped generation
 * always has something to work with, it just isn't granular.
 */
export function useSourceChapters(sourceId: string | null) {
  const [chapters, setChapters] = useState<SourceChapter[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!sourceId) {
      setChapters([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void getVaultChunksBySource(sourceId).then((chunks) => {
      if (cancelled) return;
      const order: string[] = [];
      const counts = new Map<string, number>();
      for (const chunk of chunks) {
        const key = chunk.heading?.trim() || WHOLE_DOCUMENT_HEADING;
        if (!counts.has(key)) order.push(key);
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      setChapters(order.map((heading) => ({
        heading,
        label: heading === WHOLE_DOCUMENT_HEADING ? 'Document complet' : heading,
        chunkCount: counts.get(heading) ?? 0,
      })));
      setLoading(false);
    }).catch(() => {
      if (!cancelled) {
        setChapters([]);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [sourceId]);

  return { chapters, loading };
}
