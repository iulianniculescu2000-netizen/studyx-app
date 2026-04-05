import type { AIContextPayload, UserProfileData } from './types';
import { retrieveRelevantChunks } from './retriever';

export function estimateTokens(input: string) {
  // ~3.5 chars/token pentru română (mai verbose decât engleză)
  return Math.ceil(input.length / 3.5);
}

// Mărită de la 2500 → 6000: materialele medicale sunt dense, nu le mai tăia
export function truncateContextIfNeeded(blocks: string[], maxTokens = 6000) {
  const kept: string[] = [];
  let tokens = 0;
  for (const block of blocks) {
    const nextTokens = estimateTokens(block);
    if (tokens + nextTokens > maxTokens) break;
    kept.push(block);
    tokens += nextTokens;
  }
  return kept;
}

export function summarizeChunks(texts: string[]) {
  return texts.map(text => {
    const lines = text.split('\n').filter(Boolean);
    // Iau primele 5 linii în loc de 3 — mai mult context medical util
    return lines.slice(0, 5).join(' ').slice(0, 500);
  });
}

export async function buildContext(
  query: string,
  userProfile: UserProfileData | null
): Promise<AIContextPayload> {
  const chunks = await retrieveRelevantChunks(query, userProfile, 12); // 12 în loc de 10

  const rawBlocks = chunks.map(
    (chunk, index) =>
      `[${index + 1}] Sursă: ${chunk.source} | Topic: ${chunk.topic} | Relevanță: ${(chunk.score * 100).toFixed(0)}%\n${chunk.text}`
  );

  const safeBlocks = truncateContextIfNeeded(rawBlocks);
  // Doar comprimă dacă chiar e nevoie
  const compressed =
    safeBlocks.length < rawBlocks.length
      ? summarizeChunks(rawBlocks.slice(0, safeBlocks.length + 3))
      : safeBlocks;

  const weakTopics = Object.entries(userProfile?.topicAccuracy ?? {})
    .map(([topic, stats]) => ({
      topic,
      accuracy: stats.accuracy,
      wrongCount: stats.total - stats.correct,
      total: stats.total,
      recencyScore: userProfile?.recentMistakes?.find(m => m.topic === topic)?.timestamp ?? 0,
    }))
    .filter(t => t.total > 0)
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 5);

  return {
    query,
    summary: compressed.join('\n\n---\n\n'),
    chunks,
    weakTopics,
    recentMistakes: userProfile?.recentMistakes ?? [],
    level: userProfile?.currentDifficulty ?? 'medium',
    availableTime: userProfile?.availableTime,
  };
}
