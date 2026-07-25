/**
 * Enhanced document processor for large PDF files
 * Handles complete document reading without truncation
 */

export interface DocumentProcessingOptions {
  chunkSize?: number;
  overlap?: number;
  minChunkLength?: number;
  preserveStructure?: boolean;
  /** When the uploaded source matches a known reference book, its real chapter titles —
   *  checked before the generic heading heuristic, higher precision for those books. */
  knownHeadings?: string[];
}

export interface ProcessedDocument {
  id: string;
  name: string;
  content: string;
  chunks: Array<{
    id: string;
    text: string;
    metadata: {
      startIndex: number;
      endIndex: number;
      wordCount: number;
      charCount: number;
      /** Nearest preceding detected heading/chapter title, if any (best-effort). */
      heading?: string;
    };
  }>;
  statistics: {
    totalChars: number;
    totalWords: number;
    totalChunks: number;
    averageChunkSize: number;
    processingTime: number;
  };
}

export class DocumentProcessor {
  private defaultOptions: DocumentProcessingOptions = {
    chunkSize: 1500,
    overlap: 200,
    minChunkLength: 100,
    preserveStructure: true
  };
  private options: DocumentProcessingOptions;

  constructor(options: DocumentProcessingOptions = {}) {
    this.options = { ...this.defaultOptions, ...options };
  }

  /**
   * Process document text into chunks without truncation
   */
  async processDocument(
    text: string,
    sourceName: string,
    options?: DocumentProcessingOptions
  ): Promise<ProcessedDocument> {
    const startTime = Date.now();
    const processingOptions = { ...this.options, ...options };
    
    // Normalize text
    const normalizedText = this.normalizeText(text);
    
    // Extract metadata
    const statistics = this.extractStatistics(normalizedText);
    
    // Create chunks
    const chunks = this.createChunks(normalizedText, sourceName, processingOptions);
    
    return {
      id: `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: sourceName,
      content: normalizedText,
      chunks,
      statistics: {
        ...statistics,
        totalChunks: chunks.length,
        // Guard the empty-document case: dividing by 0 produced NaN, which
        // serializes to null and poisons any stats UI reading it.
        averageChunkSize: chunks.length > 0 ? Math.round(statistics.totalChars / chunks.length) : 0,
        processingTime: Date.now() - startTime
      }
    };
  }

  /**
   * Normalize text for processing. Preserves paragraph breaks (needed for
   * createStructureAwareChunks' paragraph split and heading detection) — only
   * horizontal whitespace and excessive blank lines get collapsed.
   */
  private normalizeText(text: string): string {
    return text
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .split('\n').map((line) => line.trim()).join('\n')
      .trim();
  }

  /**
   * Extract document statistics
   */
  private extractStatistics(text: string) {
    const words = text.split(/\s+/).filter(word => word.length > 0);
    return {
      totalChars: text.length,
      totalWords: words.length
    };
  }

  /**
   * Create chunks preserving document structure
   */
  private createChunks(
    text: string,
    sourceName: string,
    options: DocumentProcessingOptions
  ) {
    const { chunkSize = 1500, overlap = 200, minChunkLength = 100, preserveStructure = true, knownHeadings } = options;

    if (preserveStructure) {
      return this.createStructureAwareChunks(text, sourceName, chunkSize, overlap, minChunkLength, knownHeadings);
    } else {
      return this.createSimpleChunks(text, sourceName, chunkSize, overlap, minChunkLength);
    }
  }

  /**
   * Diacritics/case-insensitive normalization shared by known-heading matching.
   */
  private normalizeForHeadingMatch(text: string): string {
    return text
      .toUpperCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Authoritative match against a known reference book's real chapter titles — checked
   * before the generic heuristic, since it's far less likely to false-positive/negative.
   */
  private matchesKnownHeading(paragraph: string, knownHeadings: string[]): boolean {
    const trimmed = paragraph.trim();
    if (!trimmed || trimmed.includes('\n') || trimmed.length > 120) return false;
    const normalizedParagraph = this.normalizeForHeadingMatch(trimmed);
    return knownHeadings.some((heading) => normalizedParagraph.includes(this.normalizeForHeadingMatch(heading)));
  }

  /**
   * Best-effort check for whether a single paragraph is a chapter/section heading
   * rather than body text — short single line, no sentence-ending punctuation,
   * and either an explicit chapter/section marker or a short all-caps title.
   * Conservative on purpose: under-detecting just falls back to one "whole
   * document" bucket in the UI, over-detecting would fragment chapters wrongly.
   */
  private isLikelyHeading(paragraph: string): boolean {
    const trimmed = paragraph.trim();
    if (!trimmed || trimmed.includes('\n')) return false;
    if (trimmed.length < 3 || trimmed.length > 80) return false;
    if (/[.!?]$/.test(trimmed)) return false;

    if (/^(cap(itolul)?|chapter|partea|sec(ț|t)iunea)\s*[\divxlcIVXLC]+/i.test(trimmed)) return true;
    if (/^\d+(\.\d+){0,3}\.?\s+[A-ZĂÂÎȘȚ]/.test(trimmed)) return true;

    const hasLetters = /[a-zA-ZĂÂÎȘȚăâîșț]/.test(trimmed);
    if (hasLetters && trimmed === trimmed.toUpperCase() && trimmed.length <= 60) return true;

    return false;
  }

  /**
   * Create structure-aware chunks (preserves paragraphs and sections)
   */
  private createStructureAwareChunks(
    text: string,
    sourceName: string,
    chunkSize: number,
    overlap: number,
    minChunkLength: number,
    knownHeadings?: string[]
  ) {
    const entries: Array<{ text: string; heading?: string }> = [];
    const paragraphs = text.split(/\n\s*\n/);
    let currentChunk = '';
    let currentHeading: string | undefined;

    /**
     * Trailing slice of a chunk, repeated at the start of the next one so a
     * sentence split across the boundary is still searchable from both sides.
     * Cut at a word boundary to avoid starting on half a word.
     */
    const tailFor = (chunkText: string): string => {
      if (overlap <= 0) return '';
      if (chunkText.length <= overlap) return chunkText;
      const slice = chunkText.slice(-overlap);
      const boundary = slice.search(/\s/);
      return boundary >= 0 ? slice.slice(boundary + 1) : slice;
    };

    const push = (chunkText: string) => {
      const trimmed = chunkText.trim();
      if (trimmed.length > 0) entries.push({ text: trimmed, heading: currentHeading });
    };

    for (const raw of paragraphs) {
      const paragraph = raw.trim();
      if (!paragraph) continue;

      const isHeading = (knownHeadings?.length && this.matchesKnownHeading(paragraph, knownHeadings))
        || this.isLikelyHeading(paragraph);

      if (isHeading) {
        // A chapter title closes the previous chapter's chunk before becoming
        // the current heading — otherwise the previous chapter's trailing text
        // is stored under the NEW chapter's name, and a chapter short enough to
        // sit beside the next one vanishes from the chapter list entirely.
        // Deliberately no overlap here: carrying text across a chapter boundary
        // would reintroduce exactly that mix-up.
        push(currentChunk);
        currentChunk = '';
        currentHeading = paragraph;
      }

      const potentialChunk = currentChunk ? `${currentChunk}\n\n${paragraph}` : paragraph;
      if (potentialChunk.length <= chunkSize) {
        currentChunk = potentialChunk;
        continue;
      }

      const carry = tailFor(currentChunk.trim());
      push(currentChunk);
      currentChunk = '';

      if (paragraph.length > chunkSize) {
        this.splitOversizedText(paragraph, chunkSize).forEach(push);
      } else {
        currentChunk = carry ? `${carry}\n\n${paragraph}` : paragraph;
      }
    }
    push(currentChunk);

    // Fold an undersized chunk into the previous one from the SAME chapter.
    // Merging rather than dropping means `minChunkLength` can never lose text.
    const merged: Array<{ text: string; heading?: string }> = [];
    for (const entry of entries) {
      const previous = merged[merged.length - 1];
      const fitsInPrevious = previous
        && entry.text.length < minChunkLength
        && previous.heading === entry.heading
        && previous.text.length + entry.text.length + 2 <= chunkSize;

      if (fitsInPrevious) {
        previous.text = `${previous.text}\n\n${entry.text}`;
        continue;
      }
      merged.push({ ...entry });
    }

    let globalIndex = 0;
    return merged.map((entry, index) => {
      const chunk = this.createChunk(entry.text, sourceName, index, globalIndex, entry.heading);
      globalIndex += entry.text.length;
      return chunk;
    });
  }

  /**
   * Create simple chunks (fixed size)
   */
  private createSimpleChunks(
    text: string,
    sourceName: string,
    chunkSize: number,
    overlap: number,
    minChunkLength: number
  ) {
    void minChunkLength;
    const chunks: Array<{
      id: string;
      text: string;
      metadata: { startIndex: number; endIndex: number; wordCount: number; charCount: number; };
    }> = [];

    let index = 0;
    let position = 0;

    while (position < text.length) {
      let end = Math.min(position + chunkSize, text.length);
      let chunk = text.slice(position, end);

      // Apply overlap if not the first chunk
      if (position > 0 && overlap > 0) {
        const overlapStart = Math.max(0, position - overlap);
        chunk = text.slice(overlapStart, end);
        position = overlapStart;
      }

      // Ensure minimum chunk length (disabled - include all content)
      if (chunk.length < 1 && end < text.length) {
        end = Math.min(position + 1, text.length);
        chunk = text.slice(position, end);
      }

      chunks.push(this.createChunk(chunk, sourceName, index++, position));
      position = end;
    }

    return chunks;
  }

  /**
   * Split oversized text into smaller pieces
   */
  private splitOversizedText(text: string, maxSize: number): string[] {
    if (text.length <= maxSize) return [text];

    const chunks: string[] = [];
    const separators = ['\n\n', '\n', '. ', '; ', ', ', ' '];

    for (const separator of separators) {
      if (!text.includes(separator)) continue;

      const parts = text.split(separator);
      const result: string[] = [];
      let current = '';

      for (const part of parts) {
        const next = current ? `${current}${separator}${part}` : part;
        if (next.length <= maxSize) {
          current = next;
          continue;
        }

        if (current.trim().length > 0) {
          result.push(current.trim());
        }

        if (part.length > maxSize) {
          result.push(...this.splitOversizedText(part, maxSize));
          current = '';
        } else {
          current = part;
        }
      }

      if (current.trim().length > 0) {
        result.push(current.trim());
      }

      if (result.length > 1) return result;
    }

    // Fallback: fixed-size chunks
    for (let start = 0; start < text.length; start += maxSize) {
      const chunk = text.slice(start, start + maxSize).trim();
      if (chunk.length > 0) {
        chunks.push(chunk);
      }
    }

    return chunks;
  }

  /**
   * Create chunk object with metadata
   */
  private createChunk(
    text: string,
    sourceName: string,
    index: number,
    startIndex: number,
    heading?: string
  ) {
    const words = text.split(/\s+/).filter(word => word.length > 0);
    return {
      id: `${sourceName}-chunk-${index}`,
      text: text.trim(),
      metadata: {
        startIndex,
        endIndex: startIndex + text.length,
        wordCount: words.length,
        charCount: text.length,
        ...(heading ? { heading } : {}),
      }
    };
  }

  /**
   * Validate processed document
   */
  validateDocument(doc: ProcessedDocument): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!doc.content || doc.content.length === 0) {
      errors.push('Document content is empty');
    }

    if (doc.chunks.length === 0) {
      errors.push('No chunks were created');
    }

    if (doc.statistics.totalChunks !== doc.chunks.length) {
      errors.push('Chunk count mismatch');
    }

    // Verify no content is lost
    const reconstructedContent = doc.chunks.map(chunk => chunk.text).join(' ');
    if (Math.abs(reconstructedContent.length - doc.content.length) > 100) {
      errors.push('Significant content loss detected during chunking');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

// Export singleton instance
export const documentProcessor = new DocumentProcessor();

export default DocumentProcessor;
