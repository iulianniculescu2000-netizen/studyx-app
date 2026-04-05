import { idbGet, idbSet, idbRemove } from '../lib/idb';
import { embedText, cosineSimilarity } from './embeddings';
import type { ChunkRecord } from './types';

const VECTOR_INDEX_KEY = 'studyx-vectors-index-v2';

interface VectorSourceIndexEntry {
  sourceId: string;
  source: string;
  key: string;
  count: number;
  updatedAt: number;
}

let vectorCache: ChunkRecord[] | null = null;
let indexCache: VectorSourceIndexEntry[] | null = null;
let writeLock: Promise<void> = Promise.resolve();

function getSourceStorageKey(sourceId: string) {
  return `studyx-vectors-source-${sourceId}`;
}

async function withLock<T>(operation: () => Promise<T>): Promise<T> {
  const previousLock = writeLock;
  let resolveLock: (value: void) => void;
  writeLock = new Promise<void>((resolve) => { resolveLock = resolve; });

  try {
    await previousLock;
    return await operation();
  } finally {
    resolveLock!(undefined);
  }
}

async function getVectorIndex(): Promise<VectorSourceIndexEntry[]> {
  if (indexCache) return indexCache;
  const data = await idbGet<VectorSourceIndexEntry[]>(VECTOR_INDEX_KEY);
  indexCache = Array.isArray(data) ? data : [];
  return indexCache;
}

async function saveVectorIndex(entries: VectorSourceIndexEntry[]) {
  indexCache = entries;
  await idbSet(VECTOR_INDEX_KEY, entries);
}

export async function addChunksToVault(
  chunks: { text: string; id: string }[],
  sourceName: string,
  sourceId: string
) {
  return withLock(async () => {
    const key = getSourceStorageKey(sourceId);
    const newRecords: ChunkRecord[] = chunks.map((chunk) => ({
      id: chunk.id,
      sourceId,
      text: chunk.text,
      source: sourceName,
      embedding: embedText(chunk.text),
      topic: sourceName,
      difficulty: 'medium',
      createdAt: Date.now(),
    }));

    await idbSet(key, newRecords);

    const currentIndex = await getVectorIndex();
    const nextIndex = [
      ...currentIndex.filter((entry) => entry.sourceId !== sourceId),
      { sourceId, source: sourceName, key, count: newRecords.length, updatedAt: Date.now() },
    ];
    await saveVectorIndex(nextIndex);

    vectorCache = null;
    return newRecords.length;
  });
}

export async function getVaultChunks(): Promise<ChunkRecord[]> {
  if (vectorCache) return vectorCache;

  const index = await getVectorIndex();
  const perSource = await Promise.all(index.map((entry) => idbGet<ChunkRecord[]>(entry.key)));
  vectorCache = perSource.flatMap((items) => Array.isArray(items) ? items : []);
  return vectorCache;
}

export async function getVaultChunksBySource(sourceId: string): Promise<ChunkRecord[]> {
  const index = await getVectorIndex();
  const target = index.find((entry) => entry.sourceId === sourceId);
  if (!target) return [];
  const items = await idbGet<ChunkRecord[]>(target.key);
  return Array.isArray(items) ? items : [];
}

export async function searchVault(query: string, k = 5): Promise<ChunkRecord[]> {
  const all = await getVaultChunks();
  if (all.length === 0) return [];

  const queryVector = embedText(query);
  return all
    .map((chunk) => ({ chunk, score: cosineSimilarity(queryVector, chunk.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((entry) => entry.chunk);
}

export async function clearVault() {
  await withLock(async () => {
    const index = await getVectorIndex();
    await Promise.all(index.map((entry) => idbRemove(entry.key)));
    await idbRemove(VECTOR_INDEX_KEY);
    vectorCache = [];
    indexCache = [];
  });
}

export async function removeChunksBySource(sourceId: string) {
  await withLock(async () => {
    const index = await getVectorIndex();
    const target = index.find((entry) => entry.sourceId === sourceId);
    if (!target) return;

    await idbRemove(target.key);
    await saveVectorIndex(index.filter((entry) => entry.sourceId !== sourceId));
    vectorCache = null;
  });
}
