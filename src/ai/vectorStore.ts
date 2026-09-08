import { idbGet, idbSet, idbRemove } from '../lib/idb';
import { embedBatch, embedText, cosineSimilarity } from './embeddings';
import type { ChunkRecord } from './types';

const LEGACY_VECTOR_INDEX_KEY = 'studyx-vectors-index-v2';
const legacySourceStorageKey = (sourceId: string) => `studyx-vectors-source-${sourceId}`;

interface VectorSourceIndexEntry {
  sourceId: string;
  source: string;
  key: string;
  count: number;
  updatedAt: number;
}

interface AddChunksOptions {
  batchSize?: number;
  onProgress?: (progress: { processed: number; total: number; percent: number }) => void;
}

let vectorCache: ChunkRecord[] | null = null;
let indexCache: VectorSourceIndexEntry[] | null = null;
let writeLock: Promise<void> = Promise.resolve();
/** Set by `setVectorStoreProfile` — every knowledge source lives under this profile's own keys, never shared across profiles. */
let activeProfileId: string | null = null;

function vectorIndexKey(): string {
  if (!activeProfileId) return LEGACY_VECTOR_INDEX_KEY;
  return `studyx-vectors-index-v2:${activeProfileId}`;
}

function getSourceStorageKey(sourceId: string) {
  if (!activeProfileId) return legacySourceStorageKey(sourceId);
  return `studyx-vectors-source-${activeProfileId}:${sourceId}`;
}

/**
 * Points every subsequent vector-store read/write at this profile's own keys
 * and drops the in-memory caches (they'd otherwise still hold the previous
 * profile's chunks). One-time migration: the very first profile to call this
 * after upgrading inherits whatever was in the old, un-scoped global vector
 * store — otherwise that data would silently vanish for everyone.
 */
export async function setVectorStoreProfile(profileId: string): Promise<void> {
  activeProfileId = profileId;
  vectorCache = null;
  indexCache = null;

  const alreadyMigrated = await idbGet<VectorSourceIndexEntry[]>(vectorIndexKey());
  if (alreadyMigrated) return;

  const legacyIndex = await idbGet<VectorSourceIndexEntry[]>(LEGACY_VECTOR_INDEX_KEY);
  if (!legacyIndex || legacyIndex.length === 0) return;

  const migratedEntries: VectorSourceIndexEntry[] = [];
  for (const entry of legacyIndex) {
    const chunks = await idbGet<ChunkRecord[]>(entry.key);
    if (!chunks) continue;
    const newKey = getSourceStorageKey(entry.sourceId);
    await idbSet(newKey, chunks);
    migratedEntries.push({ ...entry, key: newKey });
  }
  await idbSet(vectorIndexKey(), migratedEntries);
  await idbRemove(LEGACY_VECTOR_INDEX_KEY);
  await Promise.all(legacyIndex.map((entry) => idbRemove(entry.key)));
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
  const data = await idbGet<VectorSourceIndexEntry[]>(vectorIndexKey());
  indexCache = Array.isArray(data) ? data : [];
  return indexCache;
}

async function saveVectorIndex(entries: VectorSourceIndexEntry[]) {
  indexCache = entries;
  await idbSet(vectorIndexKey(), entries);
}

async function yieldToMainThread() {
  await new Promise<void>((resolve) => {
    window.setTimeout(resolve, 0);
  });
}

export async function addChunksToVault(
  chunks: { text: string; id: string; heading?: string }[],
  sourceName: string,
  sourceId: string,
  options: AddChunksOptions = {},
) {
  return withLock(async () => {
    const key = getSourceStorageKey(sourceId);
    const total = chunks.length;
    const batchSize = Math.max(12, options.batchSize ?? 28);
    const newRecords: ChunkRecord[] = [];

    for (let index = 0; index < chunks.length; index += batchSize) {
      const batch = chunks.slice(index, index + batchSize);
      // One batched embedding call per chunk batch instead of one request per
      // chunk — matters when a Google key is configured, since that's real
      // network round-trips (hundreds of chunks would otherwise mean hundreds
      // of requests to index a single document).
      const batchEmbeddings = await embedBatch(batch.map((chunk) => chunk.text));

      batch.forEach((chunk, i) => {
        // Extract a meaningful topic: prefer first phrase before colon/newline over raw first N words
        const rawFirstLine = chunk.text.trim().split('\n')[0].trim();
        const phraseMatch = rawFirstLine.match(/^([^:.\-–—]{6,50})/);
        const smartPhrase = phraseMatch ? phraseMatch[1].trim() : '';
        const cleanSourceBase = sourceName.toLowerCase().replace(/\.(pdf|docx|txt)$/i, '').slice(0, 8);
        const derivedTopic = (smartPhrase.length >= 6 && !smartPhrase.toLowerCase().startsWith(cleanSourceBase))
          ? smartPhrase
          : chunk.text.trim().split(/\s+/).filter((w) => w.length > 2).slice(0, 5).join(' ') || sourceName;

        newRecords.push({
          id: chunk.id,
          sourceId,
          text: chunk.text,
          source: sourceName,
          embedding: batchEmbeddings[i],
          topic: derivedTopic,
          difficulty: 'medium',
          createdAt: Date.now(),
          ...(chunk.heading ? { heading: chunk.heading } : {}),
        });
      });

      const processed = Math.min(index + batch.length, total);
      options.onProgress?.({
        processed,
        total,
        percent: total === 0 ? 100 : Math.round((processed / total) * 100),
      });

      if (processed < total) {
        await yieldToMainThread();
      }
    }

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

  const queryVector = await embedText(query);
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
    await idbRemove(vectorIndexKey());
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
