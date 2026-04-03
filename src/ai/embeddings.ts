import { getCached, setCached } from './cache';

const EMBEDDING_DIM = 128;

function tokenize(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 1);
}

function hashToken(token: string) {
  let hash = 2166136261;
  for (let i = 0; i < token.length; i++) {
    hash ^= token.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
}

export function embedText(text: string) {
  const cached = getCached<number[]>('embedding', text);
  if (cached) return cached;
  const vector = new Array(EMBEDDING_DIM).fill(0);
  const tokens = tokenize(text);
  for (const token of tokens) {
    const hash = hashToken(token);
    const index = hash % EMBEDDING_DIM;
    const sign = hash % 2 === 0 ? 1 : -1;
    vector[index] += sign * (1 + token.length / 10);
  }
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  const normalized = vector.map((value) => value / norm);
  setCached('embedding', text, normalized, 24 * 60 * 60 * 1000);
  return normalized;
}

export function embedBatch(texts: string[]) {
  return texts.map((text) => embedText(text));
}

export function cosineSimilarity(a: number[], b: number[]) {
  let dot = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    dot += a[i] * b[i];
  }
  return dot;
}
