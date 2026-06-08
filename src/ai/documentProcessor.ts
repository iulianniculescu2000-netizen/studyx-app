/**
 * Enhanced document processor for large PDF files
 * Handles complete document reading without truncation
 */

export interface DocumentProcessingOptions {
  chunkSize?: number;
  overlap?: number;
  minChunkLength?: number;
  preserveStructure?: boolean;
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
        averageChunkSize: Math.round(statistics.totalChars / chunks.length),
        processingTime: Date.now() - startTime
      }
    };
  }

  /**
   * Normalize text for processing
   */
  private normalizeText(text: string): string {
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/\s+/g, ' ')
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
    const { chunkSize = 1500, overlap = 200, minChunkLength = 100, preserveStructure = true } = options;
    
    if (preserveStructure) {
      return this.createStructureAwareChunks(text, sourceName, chunkSize, overlap, minChunkLength);
    } else {
      return this.createSimpleChunks(text, sourceName, chunkSize, overlap, minChunkLength);
    }
  }

  /**
   * Create structure-aware chunks (preserves paragraphs and sections)
   */
  private createStructureAwareChunks(
    text: string,
    sourceName: string,
    chunkSize: number,
    overlap: number,
    minChunkLength: number
  ) {
    void overlap;
    void minChunkLength;
    const chunks: Array<{
      id: string;
      text: string;
      metadata: { startIndex: number; endIndex: number; wordCount: number; charCount: number; };
    }> = [];

    // Split by paragraphs first
    const paragraphs = text.split(/\n\s*\n/);
    let currentChunk = '';
    let chunkIndex = 0;
    let globalIndex = 0;

    for (let i = 0; i < paragraphs.length; i++) {
      const paragraph = paragraphs[i].trim();
      if (!paragraph) continue;

      const potentialChunk = currentChunk + (currentChunk ? '\n\n' : '') + paragraph;
      
      if (potentialChunk.length <= chunkSize) {
        currentChunk = potentialChunk;
        continue;
      }

      // Current chunk is too large, save it and start new one
      if (currentChunk.trim().length > 0) {
        chunks.push(this.createChunk(currentChunk.trim(), sourceName, chunkIndex++, globalIndex));
        globalIndex += currentChunk.length;
      }

      // Handle oversized paragraph
      if (paragraph.length > chunkSize) {
        const paragraphChunks = this.splitOversizedText(paragraph, chunkSize, 0);
        for (const chunk of paragraphChunks) {
          if (chunk.trim().length > 0) {
            chunks.push(this.createChunk(chunk.trim(), sourceName, chunkIndex++, globalIndex));
            globalIndex += chunk.length;
          }
        }
        currentChunk = '';
      } else {
        currentChunk = paragraph;
      }
    }

    // Add final chunk
    if (currentChunk.trim().length > 0) {
      chunks.push(this.createChunk(currentChunk.trim(), sourceName, chunkIndex++, globalIndex));
    }

    return chunks;
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
  private splitOversizedText(text: string, maxSize: number, minSize: number): string[] {
    void minSize;
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
          result.push(...this.splitOversizedText(part, maxSize, 0));
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
    startIndex: number
  ) {
    const words = text.split(/\s+/).filter(word => word.length > 0);
    return {
      id: `${sourceName}-chunk-${index}`,
      text: text.trim(),
      metadata: {
        startIndex,
        endIndex: startIndex + text.length,
        wordCount: words.length,
        charCount: text.length
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
