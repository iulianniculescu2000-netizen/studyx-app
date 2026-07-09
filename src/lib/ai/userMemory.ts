/**
 * Long-term, per-profile memory for the AI assistant (Task 4).
 *
 * Unlike the conversational thread (which is per-session) or the SM-2 stats
 * (which are per-question), this layer remembers *patterns* about the student:
 * which topics they struggle with, where they're strong, and how they tend to
 * study. It is persisted in IndexedDB via the shared wrapper (src/lib/idb.ts)
 * and injected into AI requests as a compressed system fragment.
 *
 * All updates are additive and tolerant of missing data — a fresh profile just
 * yields an empty summary.
 */
import { idbGet, idbRemove, idbSet } from '../idb';
import type { Confidence } from '../../types';

const KEY_PREFIX = 'studyx-user-memory-';
const RECENT_MISTAKES_LIMIT = 50;
const TOPIC_RECENT_WINDOW = 10; // outcomes kept per topic to derive a trend
const SESSION_LENGTH_WINDOW = 20;
const CONFIDENCE_WINDOW = 100;
const MIN_HOUR_SAMPLES = 5; // before we trust a "best hour"

export type TopicTrend = 'improving' | 'stable' | 'worsening';

export interface WeakTopicMemory {
  topic: string;
  errorCount: number;
  lastSeen: number; // timestamp
  trend: TopicTrend;
}

export interface StrongTopicMemory {
  topic: string;
  successRate: number; // 0-1
}

export interface UserMemoryStore {
  profileId: string;
  weakTopics: WeakTopicMemory[];
  strongTopics: StrongTopicMemory[];
  studyPatterns: {
    preferredSessionLength: number; // minutes
    bestPerformanceHour: number | null; // 0-23
    averageConfidence: number; // 0-1
  };
  recentMistakes: Array<{
    questionId: string;
    questionText: string;
    topic: string;
    date: number; // timestamp
  }>;
  lastUpdated: number;
  // ── Internal aggregates (not part of the public schema, used to derive the
  // fields above incrementally). Kept on the same record for simplicity. ──
  _topics: Record<string, { correct: number; total: number; lastSeen: number; recent: boolean[] }>;
  _hourStats: Record<string, { correct: number; total: number }>;
  _sessionLengths: number[]; // minutes, rolling
  _confidences: number[]; // 0/0.5/1, rolling
}

/** One graded answer from a finished session. */
export interface SessionResultItem {
  questionId: string;
  questionText: string;
  topic: string;
  correct: boolean;
  confidence?: Confidence;
}

export interface SessionResults {
  items: SessionResultItem[];
  durationSeconds: number;
  finishedAt: number;
}

function key(profileId: string) {
  return `${KEY_PREFIX}${profileId}`;
}

function emptyMemory(profileId: string): UserMemoryStore {
  return {
    profileId,
    weakTopics: [],
    strongTopics: [],
    studyPatterns: { preferredSessionLength: 0, bestPerformanceHour: null, averageConfidence: 0 },
    recentMistakes: [],
    lastUpdated: Date.now(),
    _topics: {},
    _hourStats: {},
    _sessionLengths: [],
    _confidences: [],
  };
}

export async function getUserMemory(profileId: string): Promise<UserMemoryStore | null> {
  if (!profileId) return null;
  try {
    const stored = await idbGet<UserMemoryStore>(key(profileId));
    return stored ?? null;
  } catch {
    return null;
  }
}

function confidenceValue(confidence?: Confidence): number | null {
  if (confidence === 'blackout') return 0;
  if (confidence === 'guess') return 0.5;
  if (confidence === 'confident') return 1;
  return null;
}

/** Trend from a topic's recent outcome window: compare older half vs newer half. */
function deriveTrend(recent: boolean[]): TopicTrend {
  if (recent.length < 4) return 'stable';
  const mid = Math.floor(recent.length / 2);
  const older = recent.slice(0, mid);
  const newer = recent.slice(mid);
  const rate = (arr: boolean[]) => arr.filter(Boolean).length / arr.length;
  const delta = rate(newer) - rate(older);
  if (delta > 0.15) return 'improving';
  if (delta < -0.15) return 'worsening';
  return 'stable';
}

function recompute(memory: UserMemoryStore): void {
  const topicEntries = Object.entries(memory._topics);

  memory.weakTopics = topicEntries
    .filter(([, s]) => s.total >= 2 && s.correct / s.total < 0.6)
    .map(([topic, s]) => ({
      topic,
      errorCount: s.total - s.correct,
      lastSeen: s.lastSeen,
      trend: deriveTrend(s.recent),
    }))
    .sort((a, b) => b.errorCount - a.errorCount)
    .slice(0, 10);

  memory.strongTopics = topicEntries
    .filter(([, s]) => s.total >= 3 && s.correct / s.total >= 0.8)
    .map(([topic, s]) => ({ topic, successRate: Math.round((s.correct / s.total) * 100) / 100 }))
    .sort((a, b) => b.successRate - a.successRate)
    .slice(0, 10);

  // Best performance hour (needs enough samples to be meaningful).
  let bestHour: number | null = null;
  let bestRate = -1;
  for (const [hour, s] of Object.entries(memory._hourStats)) {
    if (s.total < MIN_HOUR_SAMPLES) continue;
    const rate = s.correct / s.total;
    if (rate > bestRate) {
      bestRate = rate;
      bestHour = Number(hour);
    }
  }

  const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
  memory.studyPatterns = {
    preferredSessionLength: Math.round(avg(memory._sessionLengths)),
    bestPerformanceHour: bestHour,
    averageConfidence: Math.round(avg(memory._confidences) * 100) / 100,
  };
}

/**
 * Merge a finished session into the profile's long-term memory. Safe to call
 * fire-and-forget; failures are swallowed so they never break the session flow.
 */
export async function updateUserMemory(profileId: string, results: SessionResults): Promise<void> {
  if (!profileId || results.items.length === 0) return;
  try {
    const memory = (await getUserMemory(profileId)) ?? emptyMemory(profileId);
    // Backfill internal aggregates for memories saved before this layer existed.
    memory._topics ??= {};
    memory._hourStats ??= {};
    memory._sessionLengths ??= [];
    memory._confidences ??= [];

    const hour = String(new Date(results.finishedAt).getHours());
    const hourStat = memory._hourStats[hour] ?? { correct: 0, total: 0 };

    for (const item of results.items) {
      const topic = (item.topic || 'general').toLowerCase();
      const stat = memory._topics[topic] ?? { correct: 0, total: 0, lastSeen: 0, recent: [] };
      stat.total += 1;
      if (item.correct) stat.correct += 1;
      stat.lastSeen = results.finishedAt;
      stat.recent = [...stat.recent, item.correct].slice(-TOPIC_RECENT_WINDOW);
      memory._topics[topic] = stat;

      hourStat.total += 1;
      if (item.correct) hourStat.correct += 1;

      const conf = confidenceValue(item.confidence);
      if (conf !== null) {
        memory._confidences = [...memory._confidences, conf].slice(-CONFIDENCE_WINDOW);
      }

      if (!item.correct) {
        memory.recentMistakes = [
          { questionId: item.questionId, questionText: item.questionText, topic, date: results.finishedAt },
          ...memory.recentMistakes,
        ].slice(0, RECENT_MISTAKES_LIMIT);
      }
    }

    memory._hourStats[hour] = hourStat;
    if (results.durationSeconds > 0) {
      memory._sessionLengths = [...memory._sessionLengths, results.durationSeconds / 60].slice(-SESSION_LENGTH_WINDOW);
    }

    recompute(memory);
    memory.lastUpdated = Date.now();
    await idbSet(key(profileId), memory);
  } catch {
    // Long-term memory is best-effort; never disrupt the study flow.
  }
}

const TREND_LABEL: Record<TopicTrend, string> = {
  improving: 'în creștere',
  stable: 'stabil',
  worsening: 'în scădere',
};

/**
 * Compressed (~200 token) natural-language summary for injection into AI
 * requests as a system fragment. Returns '' when there's nothing to say.
 */
export async function getUserMemorySummary(profileId: string): Promise<string> {
  const memory = await getUserMemory(profileId);
  if (!memory) return '';

  const parts: string[] = [];

  if (memory.weakTopics.length > 0) {
    const list = memory.weakTopics
      .slice(0, 3)
      .map((t) => `${t.topic} (${t.errorCount} greșeli, ${TREND_LABEL[t.trend]})`)
      .join(', ');
    parts.push(`Are dificultăți cu: ${list}.`);
  }

  if (memory.strongTopics.length > 0) {
    const list = memory.strongTopics
      .slice(0, 3)
      .map((t) => `${t.topic} (${Math.round(t.successRate * 100)}%)`)
      .join(', ');
    parts.push(`Performanță bună la: ${list}.`);
  }

  const { preferredSessionLength, bestPerformanceHour, averageConfidence } = memory.studyPatterns;
  const patternBits: string[] = [];
  if (preferredSessionLength > 0) patternBits.push(`sesiuni tipice ~${preferredSessionLength} min`);
  if (bestPerformanceHour !== null) patternBits.push(`mai productiv în jurul orei ${bestPerformanceHour}:00`);
  if (averageConfidence > 0) patternBits.push(`încredere medie ${Math.round(averageConfidence * 100)}%`);
  if (patternBits.length > 0) parts.push(`Tipar de studiu: ${patternBits.join(', ')}.`);

  return parts.join(' ');
}

export async function resetUserMemory(profileId: string): Promise<void> {
  if (!profileId) return;
  try {
    await idbRemove(key(profileId));
  } catch {
    // ignore — nothing to clean up if the store is unavailable
  }
}
