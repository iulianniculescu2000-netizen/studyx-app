import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = new Map<string, unknown>();
vi.mock('../lib/idb', () => ({
  idbGet: async (key: string) => db.get(key),
  idbSet: async (key: string, value: unknown) => { db.set(key, value); },
  idbRemove: async (key: string) => { db.delete(key); },
}));

let releaseEmbedding: (() => void) | null = null;
vi.mock('./embeddings', () => ({
  embedBatch: (texts: string[]) => new Promise<number[][]>((resolve) => {
    releaseEmbedding = () => resolve(texts.map(() => [0, 1]));
  }),
  embedText: async () => [0, 1],
  cosineSimilarity: () => 0,
}));

type VectorModule = typeof import('./vectorStore');
let vectors: VectorModule;

const indexOf = (profile: string) => (db.get(`studyx-vectors-index-v2:${profile}`) as Array<{ sourceId: string }> | undefined) ?? [];

beforeEach(async () => {
  db.clear();
  releaseEmbedding = null;
  vi.resetModules();
  vectors = await import('./vectorStore');
});

describe('indexing that outlives a profile switch', () => {
  it('writes the document to the profile it was added in, and nothing to the new one', async () => {
    await vectors.setVectorStoreProfile('A');
    const job = vectors.addChunksToVault([{ id: 'c1', text: 'Capitol despre mielom multiplu' }], 'curs.pdf', 'src-a');
    await vi.waitFor(() => expect(releaseEmbedding).not.toBeNull());

    await vectors.setVectorStoreProfile('B'); // user switches profile while embedding runs
    releaseEmbedding?.();
    await job;

    expect(indexOf('A').map((entry) => entry.sourceId)).toEqual(['src-a']);
    expect(indexOf('B')).toEqual([]);
    // B must not see A's document...
    expect(await vectors.getVaultChunksBySource('src-a')).toEqual([]);
    // ...and A still has it after switching back.
    await vectors.setVectorStoreProfile('A');
    expect((await vectors.getVaultChunksBySource('src-a')).map((chunk) => chunk.id)).toEqual(['c1']);
  });

  it('does not let a read started before the switch fill the new profile\'s cache', async () => {
    await vectors.setVectorStoreProfile('A');
    db.set('studyx-vectors-index-v2:A', [{ sourceId: 'old', source: 'x', key: 'k-old', count: 1, updatedAt: 1 }]);
    db.set('k-old', [{ id: 'o1', sourceId: 'old', text: 't', source: 'x', embedding: [0, 1], topic: 't', difficulty: 'medium', createdAt: 1 }]);

    const slowRead = vectors.getVaultChunks();
    await vectors.setVectorStoreProfile('B'); // switch before the read resolves
    await slowRead;

    expect(await vectors.getVaultChunks()).toEqual([]); // B has nothing; A's chunks were not cached for B
  });
});
