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

describe('chunk overlap', () => {
  /** Distinct numbered sentences so an overlap is easy to spot across chunks. */
  function numberedBody(count: number): string {
    return Array.from({ length: count }, (_, i) => `Propozitia numarul ${i} descrie un aspect clinic relevant pentru examen si contine text suficient.`).join('\n\n');
  }

  it('repeats the tail of a chunk at the start of the next one', async () => {
    const processor = new DocumentProcessor();
    const { chunks } = await processor.processDocument(numberedBody(40), 'Manual.pdf', {
      chunkSize: 400,
      overlap: 120,
    });

    expect(chunks.length).toBeGreaterThan(1);
    // Every chunk after the first must begin with text that also appears in its
    // predecessor — that shared window is what keeps a sentence split across the
    // boundary findable from both sides.
    for (let i = 1; i < chunks.length; i++) {
      const opening = chunks[i].text.slice(0, 30);
      expect(chunks[i - 1].text, `chunk ${i} should overlap chunk ${i - 1}`).toContain(opening);
    }
  });

  it('produces no overlap when the caller asks for none', async () => {
    const processor = new DocumentProcessor();
    const { chunks } = await processor.processDocument(numberedBody(40), 'Manual.pdf', {
      chunkSize: 400,
      overlap: 0,
    });

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].text).not.toContain(chunks[1].text.slice(0, 30));
  });

  it('never carries text across a chapter boundary', async () => {
    const text = [
      'CARDIOLOGIE',
      numberedBody(10).replace(/Propozitia/g, 'CARDIO'),
      'PNEUMOLOGIE',
      numberedBody(10).replace(/Propozitia/g, 'PNEUMO'),
    ].join('\n\n');

    const processor = new DocumentProcessor();
    const { chunks } = await processor.processDocument(text, 'Manual.pdf', {
      chunkSize: 400,
      overlap: 120,
      knownHeadings: CHAPTERS,
    });

    // Overlap must not smuggle cardiology text into a pneumology chunk.
    const leaked = chunks.filter((c) => c.metadata.heading === 'PNEUMOLOGIE' && c.text.includes('CARDIO numarul'));
    expect(leaked.map((c) => c.text.slice(0, 60))).toEqual([]);
  });

  it('merges an undersized trailing chunk instead of dropping its text', async () => {
    const processor = new DocumentProcessor();
    const tail = 'Coada scurta.';
    const { chunks } = await processor.processDocument(`${numberedBody(6)}\n\n${tail}`, 'Manual.pdf', {
      chunkSize: 400,
      overlap: 0,
      minChunkLength: 200,
    });

    expect(chunks.some((c) => c.text.includes(tail))).toBe(true);
  });
});
