import { cosineSimilarity, embedText } from './embeddings';
import { getVaultChunks } from './vectorStore';
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

export async function retrieveRelevantChunks(query: string, userProfile: UserProfileData | null, k = 10): Promise<RetrievedChunk[]> {
  if (!query) return [];
  
  const queryEmbedding = embedText(query);
  const weakTopics = new Set((userProfile?.recentMistakes ?? []).map((item) => item.topic.toLowerCase()));
  const recentMistakes = new Set((userProfile?.recentMistakes ?? []).map((item) => item.questionId));

  const allChunks = await getVaultChunks();
  if (allChunks.length === 0) return [];

  return allChunks
    .map((chunk) => {
      const semanticScore = cosineSimilarity(queryEmbedding, chunk.embedding);
      const keyword = keywordScore(query, chunk.text);
      
      // Boost relevance for topics where the user has struggled
      const weaknessBoost = weakTopics.has(chunk.topic.toLowerCase()) ? 0.25 : 0;
      
      // Boost recently seen/wrong information
      const recencyBoost = recentMistakes.has(chunk.id) ? 0.15 : 0;
      
      const score = (semanticScore * 0.7) + (keyword * 0.3) + weaknessBoost + recencyBoost;
      
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
    .filter(res => res.score > 0.1) // Minimum relevance threshold
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}
