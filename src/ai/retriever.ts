import { cosineSimilarity, embedText } from './embeddings';
import { getVaultChunks } from './vectorStore';
import type { RetrievedChunk, UserProfileData } from './types';

// ─── BM25 Parameters ──────────────────────────────────────────────────────────
const BM25_K1 = 1.5;  // saturation term frequency
const BM25_B = 0.75;  // length normalization
const tokenCache = new Map<string, string[]>();

function getChunkCacheKey(id: string, text: string) {
  return `${id}:${text.length}`;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2);
}

function getCachedTokens(id: string, text: string) {
  const cacheKey = getChunkCacheKey(id, text);
  const cached = tokenCache.get(cacheKey);
  if (cached) return cached;
  const tokens = tokenize(text);
  tokenCache.set(cacheKey, tokens);
  return tokens;
}

function bm25Score(
  queryTokens: string[],
  docTokens: string[],
  avgDocLength: number,
  idfMap: Map<string, number>
): number {
  const tf = new Map<string, number>();
  for (const t of docTokens) tf.set(t, (tf.get(t) ?? 0) + 1);
  const docLen = docTokens.length;

  let score = 0;
  for (const qt of queryTokens) {
    const tfVal = tf.get(qt) ?? 0;
    if (tfVal === 0) continue;
    const idf = idfMap.get(qt) ?? 0;
    const numerator = tfVal * (BM25_K1 + 1);
    const denominator = tfVal + BM25_K1 * (1 - BM25_B + BM25_B * (docLen / avgDocLength));
    score += idf * (numerator / denominator);
  }
  return score;
}

function buildIdfMap(queryTokens: string[], allDocs: string[][]): Map<string, number> {
  const N = allDocs.length;
  const map = new Map<string, number>();
  const uniqueQueryTokens = [...new Set(queryTokens)];
  for (const qt of queryTokens) {
    if (map.has(qt)) continue;
    let df = 0;
    for (const doc of allDocs) {
      if (doc.includes(qt)) df += 1;
    }
    map.set(qt, Math.log((N - df + 0.5) / (df + 0.5) + 1));
  }
  uniqueQueryTokens.forEach((token) => {
    if (!map.has(token)) map.set(token, 0);
  });
  return map;
}

export async function retrieveRelevantChunks(
  query: string,
  userProfile: UserProfileData | null,
  k = 10
): Promise<RetrievedChunk[]> {
  if (!query) return [];

  const allChunks = await getVaultChunks();
  if (allChunks.length === 0) return [];

  // ─── Pregătire date ───────────────────────────────────────────────────────
  const queryEmbedding = embedText(query);
  const queryTokens = tokenize(query);

  const weakTopics = new Set(
    (userProfile?.recentMistakes ?? []).map(m => m.topic.toLowerCase())
  );
  const mistakeBank = new Set(
    (userProfile?.mistakeBank ?? []).map(m => m.questionId)
  );
  const recentMistakes = new Set(
    (userProfile?.recentMistakes ?? []).map(m => m.questionId)
  );

  // ─── BM25 setup ───────────────────────────────────────────────────────────
  const allDocTokens = allChunks.map((chunk) => getCachedTokens(chunk.id, chunk.text));
  const avgDocLength = allDocTokens.reduce((s, d) => s + d.length, 0) / (allDocTokens.length || 1);
  const idfMap = buildIdfMap(queryTokens, allDocTokens);

  // ─── Scoring hibrid ───────────────────────────────────────────────────────
  const results = allChunks.map((chunk, i) => {
    const semanticScore = cosineSimilarity(queryEmbedding, chunk.embedding);

    const rawBm25 = bm25Score(queryTokens, allDocTokens[i], avgDocLength, idfMap);
    // Normalizăm BM25 la [0,1] raportat la max posibil
    const maxBm25 = queryTokens.length * Math.log(allChunks.length + 1);
    const bm25Normalized = maxBm25 > 0 ? Math.min(rawBm25 / maxBm25, 1) : 0;

    // Boost pentru topicuri slabe (utilizatorul a greșit acolo)
    const weaknessBoost = weakTopics.has(chunk.topic.toLowerCase()) ? 0.30 : 0;

    // Boost pentru greșeli recente (repetare spaced)
    const recencyBoost = recentMistakes.has(chunk.id) ? 0.20 : 0;

    // Boost pentru banca de greșeli (greșit de mai multe ori)
    const mistakeBankBoost = mistakeBank.has(chunk.id) ? 0.15 : 0;

    // *** PONDERILE CHEIE: BM25 dominant, semantic complementar ***
    // Motivul: embeddings locale nu sunt semantice, BM25 e mult mai precis
    const score =
      bm25Normalized * 0.55 +
      semanticScore * 0.25 +
      weaknessBoost +
      recencyBoost +
      mistakeBankBoost;

    return {
      id: chunk.id,
      text: chunk.text,
      topic: chunk.topic,
      source: chunk.source,
      difficulty: chunk.difficulty,
      score,
      keywordScore: bm25Normalized,
      semanticScore,
      recencyBoost,
      weaknessBoost,
    } as RetrievedChunk;
  });

  return results
    .filter(r => r.score > 0.05) // prag mai mic — nu ratem context relevant
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}
