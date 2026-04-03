import { cosineSimilarity, embedText } from './embeddings';
import { getAllChunks } from './vectorStore';
import type { RetrievedChunk, UserProfileData } from './types';

function keywordScore(query: string, text: string) {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return 0;
  let score = 0;
  const lower = text.toLowerCase();
  for (const token of tokens) {
    if (lower.includes(token)) score += 0.15;
  }
  return Math.min(score, 1);
}

export function retrieveRelevantChunks(query: string, userProfile: UserProfileData | null, k = 6): RetrievedChunk[] {
  const queryEmbedding = embedText(query);
  const weakTopics = new Set((userProfile?.recentMistakes ?? []).map((item) => item.topic.toLowerCase()));
  const recentMistakes = new Set((userProfile?.recentMistakes ?? []).map((item) => item.questionId));

  return getAllChunks()
    .map((chunk) => {
      const semanticScore = cosineSimilarity(queryEmbedding, chunk.embedding);
      const keyword = keywordScore(query, chunk.text);
      const weaknessBoost = weakTopics.has(chunk.topic.toLowerCase()) ? 0.2 : 0;
      const recencyBoost = recentMistakes.has(chunk.id) ? 0.1 : 0;
      const score = semanticScore + keyword + weaknessBoost + recencyBoost;
      return {
        id: chunk.id,
        text: chunk.text,
        topic: chunk.topic,
        source: chunk.source,
        difficulty: chunk.difficulty,
        score,
        keywordScore: keyword,
        semanticScore,
        recencyBoost,
        weaknessBoost,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}
