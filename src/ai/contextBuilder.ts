import type { AIContextPayload, UserProfileData } from './types';
import { retrieveRelevantChunks } from './retriever';

export function estimateTokens(input: string) {
  return Math.ceil(input.length / 4);
}

export function truncateContextIfNeeded(blocks: string[], maxTokens = 2500) {
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
  return texts.map((text) => {
    const lines = text.split('\n').filter(Boolean);
    return lines.slice(0, 3).join(' ').slice(0, 320);
  });
}

export async function buildContext(query: string, userProfile: UserProfileData | null): Promise<AIContextPayload> {
  const chunks = await retrieveRelevantChunks(query, userProfile);
  const rawBlocks = chunks.map((chunk, index) => `[${index + 1}] ${chunk.source} | ${chunk.topic}\n${chunk.text}`);
  const safeBlocks = truncateContextIfNeeded(rawBlocks);
  const compressed = safeBlocks.length < rawBlocks.length ? summarizeChunks(rawBlocks) : safeBlocks;

  return {
    query,
    summary: compressed.join('\n\n'),
    chunks,
    weakTopics: Object.entries(userProfile?.topicAccuracy ?? {})
      .map(([topic, stats]) => ({
        topic,
        accuracy: stats.accuracy,
        wrongCount: stats.total - stats.correct,
        total: stats.total,
        recencyScore: 0,
      }))
      .sort((a, b) => a.accuracy - b.accuracy)
      .slice(0, 5),
    recentMistakes: userProfile?.recentMistakes ?? [],
    level: userProfile?.currentDifficulty ?? 'medium',
    availableTime: userProfile?.availableTime,
  };
}
