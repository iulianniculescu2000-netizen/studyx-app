/**
 * Semantic-aware chunker for large medical documents.
 * Splits safely even when a paragraph is much larger than the target chunk size.
 */

function normalizeText(text: string) {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function splitOversizedSegment(segment: string, chunkSize: number): string[] {
  if (segment.length <= chunkSize) return [segment];

  const separators = ['\n\n', '\n', '. ', '; ', ', ', ' '];
  for (const separator of separators) {
    if (!segment.includes(separator)) continue;

    const parts = segment.split(separator);
    const result: string[] = [];
    let current = '';

    for (const part of parts) {
      const next = current ? `${current}${separator}${part}` : part;
      if (next.length <= chunkSize) {
        current = next;
        continue;
      }

      if (current) result.push(current.trim());
      if (part.length > chunkSize) {
        result.push(...splitOversizedSegment(part, chunkSize));
        current = '';
      } else {
        current = part;
      }
    }

    if (current.trim()) result.push(current.trim());
    if (result.length > 1) return result;
  }

  const windows: string[] = [];
  for (let start = 0; start < segment.length; start += chunkSize) {
    windows.push(segment.slice(start, start + chunkSize).trim());
  }
  return windows.filter(Boolean);
}

export function chunkText(
  text: string,
  sourceName: string,
  chunkSize = 1200,
  overlap = 200
): { text: string; id: string }[] {
  const normalized = normalizeText(text);
  if (!normalized) return [];

  const paragraphs = normalized.split('\n\n').flatMap((paragraph) => splitOversizedSegment(paragraph, chunkSize));
  const chunks: { text: string; id: string }[] = [];

  let index = 0;
  for (let i = 0; i < paragraphs.length; i++) {
    let content = paragraphs[i].trim();
    if (!content) continue;

    if (i > 0 && overlap > 0) {
      const previousTail = paragraphs[i - 1].slice(-overlap).trim();
      if (previousTail) {
        content = `${previousTail}\n${content}`.trim();
      }
    }

    if (content.length > chunkSize + overlap) {
      for (const segment of splitOversizedSegment(content, chunkSize)) {
        if (segment.trim().length > 40) {
          chunks.push({ text: segment.trim(), id: `${sourceName}-${index++}` });
        }
      }
      continue;
    }

    if (content.length > 40) {
      chunks.push({ text: content, id: `${sourceName}-${index++}` });
    }
  }

  return chunks;
}
