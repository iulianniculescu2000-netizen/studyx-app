/**
 * Chapter-attribution tests for the chunker.
 *
 * These matter for the Residency feature: "generate a quiz from chapter X" is
 * only as good as the heading attached to each chunk. Text tagged with the
 * wrong chapter silently pulls the previous chapter's material into the new
 * chapter's questions.
 */
import { describe, expect, it } from 'vitest';
import { DocumentProcessor } from './documentProcessor';

const CHAPTERS = ['CARDIOLOGIE', 'PNEUMOLOGIE'];

/** Body text long enough to look like real prose but short of the chunk size. */
function body(marker: string, repeats: number): string {
  return Array.from({ length: repeats }, (_, i) => `${marker} paragraful ${i} cu text de umplutura pentru a simula continut real de manual.`).join('\n\n');
}

describe('heading attribution', () => {
  it('does not tag the previous chapter\'s text with the next chapter\'s heading', async () => {
    const text = [
      'CARDIOLOGIE',
      body('CARDIO', 6),
      'PNEUMOLOGIE',
      body('PNEUMO', 6),
    ].join('\n\n');

    const processor = new DocumentProcessor();
    const { chunks } = await processor.processDocument(text, 'Manual.pdf', { knownHeadings: CHAPTERS });

    const misattributed = chunks.filter((c) => c.metadata.heading === 'PNEUMOLOGIE' && c.text.includes('CARDIO paragraful'));
    expect(
      misattributed.map((c) => c.text.slice(0, 80)),
      'chunks holding cardiology text must not be labelled PNEUMOLOGIE',
    ).toEqual([]);
  });

  it('does not tag the next chapter\'s text with the previous heading', async () => {
    const text = [
      'CARDIOLOGIE',
      body('CARDIO', 6),
      'PNEUMOLOGIE',
      body('PNEUMO', 6),
    ].join('\n\n');

    const processor = new DocumentProcessor();
    const { chunks } = await processor.processDocument(text, 'Manual.pdf', { knownHeadings: CHAPTERS });

    const misattributed = chunks.filter((c) => c.metadata.heading === 'CARDIOLOGIE' && c.text.includes('PNEUMO paragraful'));
    expect(misattributed.map((c) => c.text.slice(0, 80))).toEqual([]);
  });

  it('still attributes both chapters to something', async () => {
    const text = [
      'CARDIOLOGIE',
      body('CARDIO', 6),
      'PNEUMOLOGIE',
      body('PNEUMO', 6),
    ].join('\n\n');

    const processor = new DocumentProcessor();
    const { chunks } = await processor.processDocument(text, 'Manual.pdf', { knownHeadings: CHAPTERS });

    const headings = new Set(chunks.map((c) => c.metadata.heading));
    expect(headings.has('CARDIOLOGIE')).toBe(true);
    expect(headings.has('PNEUMOLOGIE')).toBe(true);
  });

  it('reports a sane average chunk size for an empty document', async () => {
    const processor = new DocumentProcessor();
    const result = await processor.processDocument('', 'Gol.pdf');
    expect(Number.isFinite(result.statistics.averageChunkSize)).toBe(true);
  });
});
