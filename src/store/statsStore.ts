import { create } from 'zustand';
import type { Confidence, QuestionStat, StudyStreak } from '../types';

const EMPTY_STREAK: StudyStreak = {
  currentStreak: 0,
  longestStreak: 0,
  lastStudyDate: '',
  studyDates: [],
};

interface StatsStore {
  questionStats: Record<string, QuestionStat>;
  streak: StudyStreak;
  totalStudyTime: number;
  recordAnswer: (quizId: string, questionId: string, correct: boolean, confidence?: Confidence) => void;
  recordStudySession: (durationSeconds: number) => void;
  getDueQuestions: () => QuestionStat[];
  getWeakQuestions: (limit?: number) => QuestionStat[];
  getAccuracy: (quizId?: string) => number;
  getStatsByTag: (quizzes: import('../types').Quiz[]) => Record<string, { correct: number; total: number }>;
  _hydrate: (data: { questionStats: Record<string, QuestionStat>; streak: StudyStreak; totalStudyTime: number }) => void;
  _snapshot: () => { questionStats: Record<string, QuestionStat>; streak: StudyStreak; totalStudyTime: number };
  reset: () => void;
}

function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

type SM2Quality = 0 | 1 | 2 | 3 | 4 | 5;

/**
 * Map the answer outcome + self-assessed confidence to an SM-2 quality grade.
 *
 *   blackout            → 0  (always a lapse, even if the answer was correct)
 *   guess     + wrong   → 1
 *   confident + wrong   → 2
 *   guess     + correct → 3
 *   (no rating)+ correct → 4
 *   confident + correct → 5
 *   (no rating)+ wrong  → 1
 */
function qualityFromOutcome(correct: boolean, confidence?: Confidence): SM2Quality {
  if (confidence === 'blackout') return 0;
  if (!correct) return confidence === 'confident' ? 2 : 1;
  if (confidence === 'confident') return 5;
  if (confidence === 'guess') return 3;
  return 4; // correct, no explicit rating
}

/**
 * SuperMemo-2 (SM-2) algorithm, quality-driven (Anki/professional SRS).
 * `consecutiveCorrect` plays the role of SM-2 "repetitions".
 */
function calcNextReview(
  stat: QuestionStat,
  correct: boolean,
  confidence?: Confidence,
): { nextReview: number; interval: number; eFactor: number; consecutiveCorrect: number } {
  const quality = qualityFromOutcome(correct, confidence);
  const eFactor = stat.eFactor ?? 2.5;
  const interval = stat.interval ?? 0;
  const n = stat.consecutiveCorrect ?? 0;

  if (quality < 3) {
    // Lapse: restart the learning phase. SM-2 leaves EF untouched on failure.
    return {
      nextReview: Date.now() + 86400000, // 1 zi
      interval: 1,
      eFactor,
      consecutiveCorrect: 0,
    };
  }

  // Standard SM-2 ease-factor update from the quality grade.
  const newEF = Math.max(1.3, eFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));

  let newInterval: number;
  if (n === 0) newInterval = 1;
  else if (n === 1) newInterval = 6;
  else newInterval = Math.round(interval * newEF);

  // Cap la 1 an pentru studenți la medicină (memorie pe termen lung)
  newInterval = Math.min(newInterval, 365);

  return {
    nextReview: Date.now() + newInterval * 86400000,
    interval: newInterval,
    eFactor: newEF,
    consecutiveCorrect: n + 1,
  };
}

export const useStatsStore = create<StatsStore>()(
  (set, get) => ({
    questionStats: {},
    streak: { ...EMPTY_STREAK },
    totalStudyTime: 0,

    recordAnswer: (quizId, questionId, correct, confidence) => {
      const key = `${quizId}:${questionId}`;
      set((s) => {
        const existing: QuestionStat = s.questionStats[key] ?? {
          questionId, quizId,
          timesCorrect: 0, timesWrong: 0,
          lastSeen: 0, nextReview: 0, interval: 0, eFactor: 2.5,
          consecutiveCorrect: 0,
        };

        const review = calcNextReview(existing, correct, confidence);

        const updated: QuestionStat = {
          ...existing,
          timesCorrect: existing.timesCorrect + (correct ? 1 : 0),
          timesWrong: existing.timesWrong + (correct ? 0 : 1),
          lastSeen: Date.now(),
          nextReview: review.nextReview,
          interval: review.interval,
          eFactor: review.eFactor,
          consecutiveCorrect: review.consecutiveCorrect,
          ...(confidence ? { lastConfidence: confidence } : {}),
        };

        return { questionStats: { ...s.questionStats, [key]: updated } };
      });
    },

    recordStudySession: (durationSeconds) => {
      const today = getToday();
      set((s) => {
        const dates = s.streak.studyDates;
        if (dates.includes(today)) {
          return { totalStudyTime: s.totalStudyTime + durationSeconds };
        }
        const newDates = [...dates, today].sort();
        
        // Accurate consecutive days streak calculation
        let current = 0;
        const checkDate = new Date(today);
        
        while (true) {
          const dateStr = checkDate.toISOString().split('T')[0];
          if (newDates.includes(dateStr)) {
            current++;
            checkDate.setDate(checkDate.getDate() - 1);
          } else {
            break;
          }
        }

        return {
          totalStudyTime: s.totalStudyTime + durationSeconds,
          streak: {
            currentStreak: current,
            longestStreak: Math.max(s.streak.longestStreak, current),
            lastStudyDate: today,
            studyDates: newDates.slice(-365),
          },
        };
      });
    },

    getDueQuestions: () => {
      const now = Date.now();
      return Object.values(get().questionStats).filter(
        (s) => s.nextReview > 0 && s.nextReview <= now
      );
    },

    getWeakQuestions: (limit = 10) => {
      const seen = Object.values(get().questionStats).filter((s) => s.timesCorrect + s.timesWrong > 0);
      // SM-2 weakness: low ease factor or not yet stabilized (repetitions < 2).
      const weak = seen.filter((s) => (s.eFactor ?? 2.5) < 2.0 || (s.consecutiveCorrect ?? 0) < 2);
      const pool = weak.length > 0 ? weak : seen;
      return pool
        .sort((a, b) => {
          const efA = a.eFactor ?? 2.5;
          const efB = b.eFactor ?? 2.5;
          if (efA !== efB) return efA - efB; // weakest ease factor first
          const totalA = a.timesCorrect + a.timesWrong;
          const totalB = b.timesCorrect + b.timesWrong;
          const accA = a.timesCorrect / totalA;
          const accB = b.timesCorrect / totalB;
          if (accA !== accB) return accA - accB;
          return totalB - totalA;
        })
        .slice(0, limit);
    },

    getAccuracy: (quizId) => {
      const stats = Object.values(get().questionStats).filter(
        (s) => !quizId || s.quizId === quizId
      );
      if (!stats.length) return 0;
      const total = stats.reduce((a, s) => a + s.timesCorrect + s.timesWrong, 0);
      const correct = stats.reduce((a, s) => a + s.timesCorrect, 0);
      return total > 0 ? Math.round((correct / total) * 100) : 0;
    },

    getStatsByTag: (quizzes) => {
      const stats = get().questionStats;
      const result: Record<string, { correct: number; total: number }> = {};
      quizzes.forEach(quiz => {
        const quizTags = quiz.tags ?? [];
        quiz.questions.forEach(q => {
          const key = `${quiz.id}:${q.id}`;
          const s = stats[key];
          if (!s) return;
          // Per-question tags are the real topic granularity (that's what every other
          // weak-topic calculation in the app uses) — quiz-level tags were shadowing them
          // entirely, so a quiz without its own `tags` counted for nothing here even when
          // every question inside it was properly tagged.
          const tags = q.tags?.length ? q.tags : quizTags;
          tags.forEach(tag => {
            if (!result[tag]) result[tag] = { correct: 0, total: 0 };
            result[tag].correct += s.timesCorrect;
            result[tag].total += s.timesCorrect + s.timesWrong;
          });
        });
      });
      return result;
    },

    _hydrate: (data) => set({
      questionStats: data.questionStats ?? {},
      streak: data.streak ?? { ...EMPTY_STREAK },
      totalStudyTime: data.totalStudyTime ?? 0,
    }),
    _snapshot: () => ({
      questionStats: get().questionStats,
      streak: get().streak,
      totalStudyTime: get().totalStudyTime,
    }),
    reset: () => set({
      questionStats: {},
      streak: { ...EMPTY_STREAK },
      totalStudyTime: 0,
    }),
  })
);
