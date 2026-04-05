/**
 * Semantic-Aware Recursive Chunker
 * Împarte textul în fragmente optimizate pentru AI, respectând limitele gramaticale.
 */
export function chunkText(text: string, sourceName: string, chunkSize = 1200, overlap = 200): { text: string; id: string }[] {
  const chunks: { text: string; id: string }[] = [];
  
  // 1. Curățare și normalizare (păstrăm noile linii duble pentru paragrafe)
  const normalizedText = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

  // 2. Separatori ierarhici (de la cel mai mare la cel mai mic)
  const separators = ['\n\n', '\n', '. ', '? ', '! ', '; ', ', ', ' '];

  function recursiveSplit(content: string): string[] {
    if (content.length <= chunkSize) return [content];

    let separator = separators[separators.length - 1];
    for (const s of separators) {
      if (content.includes(s)) {
        separator = s;
        break;
      }
    }

    const parts = content.split(separator);
    const result: string[] = [];
    let currentChunk = "";

    for (const part of parts) {
      if ((currentChunk + separator + part).length <= chunkSize) {
        currentChunk += (currentChunk ? separator : "") + part;
      } else {
        if (currentChunk) result.push(currentChunk);
        currentChunk = part;
      }
    }
    if (currentChunk) result.push(currentChunk);
    return result;
  }

  // 3. Procesare cu Overlap inteligent
  const initialSplits = recursiveSplit(normalizedText);
  let globalIndex = 0;

  for (let i = 0; i < initialSplits.length; i++) {
    let content = initialSplits[i];
    
    // Adăugăm overlap din fragmentul anterior dacă există
    if (i > 0 && overlap > 0) {
      const prev = initialSplits[i - 1];
      const overlapText = prev.slice(-overlap);
      content = overlapText + " " + content;
    }

    if (content.trim().length > 20) {
      chunks.push({
        text: content.trim(),
        id: `${sourceName}-${globalIndex++}`
      });
    }
  }

  return chunks;
}
