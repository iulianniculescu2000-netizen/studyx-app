import { create } from 'zustand';
import type { QuestionStat, StudyStreak } from '../types';

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
  recordAnswer: (quizId: string, questionId: string, correct: boolean) => void;
  recordStudySession: (durationSeconds: number) => void;
  getDueQuestions: () => QuestionStat[];
  getWeakQuestions: (limit?: number) => QuestionStat[];
  getAccuracy: (quizId?: string) => number;
  getStatsByTag: (quizzes: import('../types').Quiz[]) => Record<string, { correct: number; total: number }>;
  _hydrate: (data: { questionStats: Record<string, QuestionStat>; streak: StudyStreak; totalStudyTime: number }) => void;
  _snapshot: () => { questionStats: Record<string, QuestionStat>; streak: StudyStreak; totalStudyTime: number };
}

function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * SuperMemo-2 (SM-2) Pro Algorithm
 * Used by Anki and professional SRS systems.
 */
function calcNextReview(stat: QuestionStat, correct: boolean): { nextReview: number; interval: number; eFactor: number } {
  let eFactor = stat.eFactor ?? 2.5;
  let interval = stat.interval ?? 0;
  const n = (stat.timesCorrect + (correct ? 1 : 0));

  if (!correct) {
    // Lapse: Re-learning phase
    // Reduce eFactor (punish ease) and reset interval to 1 day
    eFactor = Math.max(1.3, eFactor - 0.2);
    return { 
      nextReview: Date.now() + 86400000, // 1 day
      interval: 1, 
      eFactor 
    };
  }

  // Correct answer: Calculate next interval
  if (n <= 1) {
    interval = 1;
  } else if (n === 2) {
    interval = 4; // Standard SM-2 leap
  } else {
    interval = Math.round(interval * eFactor);
  }

  // Cap interval at 1 year for medical students (long-term memory)
  interval = Math.min(interval, 365);

  // Slightly increase eFactor for correct answers (reward ease)
  eFactor = Math.min(3.0, eFactor + 0.1);

  return { 
    nextReview: Date.now() + interval * 86400000, 
    interval, 
    eFactor 
  };
}

export const useStatsStore = create<StatsStore>()(
  (set, get) => ({
    questionStats: {},
    streak: { ...EMPTY_STREAK },
    totalStudyTime: 0,

    recordAnswer: (quizId, questionId, correct) => {
      const key = `${quizId}:${questionId}`;
      set((s) => {
        const existing: QuestionStat = s.questionStats[key] ?? {
          questionId, quizId,
          timesCorrect: 0, timesWrong: 0,
          lastSeen: 0, nextReview: 0, interval: 0, eFactor: 2.5
        };
        
        const review = calcNextReview(existing, correct);
        
        const updated: QuestionStat = {
          ...existing,
          timesCorrect: existing.timesCorrect + (correct ? 1 : 0),
          timesWrong: existing.timesWrong + (correct ? 0 : 1),
          lastSeen: Date.now(),
          nextReview: review.nextReview,
          interval: review.interval,
          eFactor: review.eFactor,
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

    getWeakQuestions: (limit = 10) =>
      Object.values(get().questionStats)
        .filter((s) => s.timesCorrect + s.timesWrong > 0)
        .sort((a, b) => {
          const totalA = a.timesCorrect + a.timesWrong;
          const totalB = b.timesCorrect + b.timesWrong;
          const accA = a.timesCorrect / totalA;
          const accB = b.timesCorrect / totalB;
          if (accA !== accB) return accA - accB;
          return totalB - totalA;
        })
        .slice(0, limit),

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
          quizTags.forEach(tag => {
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
  })
);
