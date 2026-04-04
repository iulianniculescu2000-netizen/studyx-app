import { idbGet, idbSet, idbRemove } from '../lib/idb';
import { embedText, cosineSimilarity } from './embeddings';
import type { ChunkRecord } from './types';

const VECTORS_KEY = 'studyx-vectors-v1';

// We keep a lightweight memory index for fast searches
let vectorCache: ChunkRecord[] | null = null;

export async function addChunksToVault(chunks: { text: string; id: string }[], sourceName: string) {
  const current = await getVaultChunks();
  
  // Create records with embeddings
  const newRecords: ChunkRecord[] = chunks.map(c => ({
    id: c.id,
    text: c.text,
    source: sourceName,
    embedding: embedText(c.text), // Note: In a real heavy app, this would be a Worker
    topic: sourceName,
    difficulty: 'medium',
    createdAt: Date.now()
  }));

  const merged = [...current, ...newRecords];
  vectorCache = merged;
  await idbSet(VECTORS_KEY, merged);
  return newRecords.length;
}

export async function getVaultChunks(): Promise<ChunkRecord[]> {
  if (vectorCache) return vectorCache;
  const data = await idbGet<ChunkRecord[]>(VECTORS_KEY);
  vectorCache = Array.isArray(data) ? data : [];
  return vectorCache;
}

export async function searchVault(query: string, k = 5): Promise<ChunkRecord[]> {
  const all = await getVaultChunks();
  if (all.length === 0) return [];

  const queryVector = embedText(query);
  
  const scored = all.map(chunk => ({
    chunk,
    score: cosineSimilarity(queryVector, chunk.embedding)
  }));

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map(s => s.chunk);
}

export async function clearVault() {
  vectorCache = [];
  await idbRemove(VECTORS_KEY);
}

export async function removeChunksBySource(sourceName: string) {
  const current = await getVaultChunks();
  const next = current.filter(c => c.source !== sourceName);
  vectorCache = next;
  await idbSet(VECTORS_KEY, next);
}
