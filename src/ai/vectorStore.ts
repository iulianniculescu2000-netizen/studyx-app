import type { ChunkRecord } from './types';

const STORE_KEY = 'studyx-ai-vectors';

function loadStore(): ChunkRecord[] {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveStore(chunks: ChunkRecord[]) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(chunks.slice(-500)));
  } catch {}
}

export function addChunks(chunks: ChunkRecord[]) {
  const current = loadStore();
  const merged = [...current.filter((item) => !chunks.some((chunk) => chunk.id === item.id)), ...chunks];
  saveStore(merged);
}

export function getAllChunks() {
  return loadStore();
}

export function similaritySearch(query: string, k: number, scoreFn: (chunk: ChunkRecord, query: string) => number) {
  return loadStore()
    .map((chunk) => ({ chunk, score: scoreFn(chunk, query) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}
