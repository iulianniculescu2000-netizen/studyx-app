import type { Difficulty } from '../types';

export interface Chunk {
  id: string;
  text: string;
  topic: string;
  source: string;
  difficulty: Difficulty;
}

function detectTopic(text: string) {
  const firstLine = text.split('\n')[0]?.trim();
  if (firstLine && firstLine.length < 80) return firstLine;
  const firstSentence = text.split(/[.!?]/)[0]?.trim() ?? 'Topic general';
  return firstSentence.slice(0, 60) || 'Topic general';
}

export function chunkText(text: string, source = 'Biblioteca AI'): Chunk[] {
  const sections = text
    .split(/\n(?=(?:[A-ZĂÂÎȘȚ0-9][^\n]{0,80}:)|(?:- )|(?:\d+\.)|(?:[A-ZĂÂÎȘȚ][A-ZĂÂÎȘȚ ]{4,}))/)
    .map((section) => section.trim())
    .filter(Boolean);

  const chunks = (sections.length > 0 ? sections : [text])
    .flatMap((section) => {
      if (section.length <= 1200) return [section];
      const sentences = section.split(/(?<=[.!?])\s+/);
      const grouped: string[] = [];
      let current = '';
      for (const sentence of sentences) {
        const next = current ? `${current} ${sentence}` : sentence;
        if (next.length > 1200 && current) {
          grouped.push(current.trim());
          current = sentence;
        } else {
          current = next;
        }
      }
      if (current.trim()) grouped.push(current.trim());
      return grouped;
    })
    .filter((section) => section.length > 80);

  return chunks.map((chunk, index) => ({
    id: `chunk-${index}-${Math.random().toString(36).slice(2, 8)}`,
    text: chunk,
    topic: detectTopic(chunk),
    source,
    difficulty: chunk.length > 700 ? 'hard' : chunk.length > 350 ? 'medium' : 'easy',
  }));
}
