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

function calcNextReview(stat: QuestionStat, correct: boolean): { nextReview: number; interval: number; eFactor?: number } {
  const eFactor = stat.eFactor ?? 2.5;
  if (!correct) {
    // Wrong: reset interval to 1 day, reduce E-factor
    const newEF = Math.max(1.3, eFactor - 0.2);
    return { nextReview: Date.now() + 86400000, interval: 1, eFactor: newEF };
  }
  // Correct: SM-2 interval calculation
  const n = stat.timesCorrect + 1;
  let interval: number;
  if (n === 1) interval = 1;
  else if (n === 2) interval = 3;
  else interval = Math.round((stat.interval ?? 3) * eFactor);
  interval = Math.min(interval, 180); // cap at 6 months
  const newEF = Math.min(2.7, eFactor + 0.1);
  return { nextReview: Date.now() + interval * 86400000, interval, eFactor: newEF };
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
          lastSeen: 0, nextReview: 0, interval: 0,
        };
        const review = calcNextReview(existing, correct);
        const updated: QuestionStat = {
          ...existing,
          timesCorrect: existing.timesCorrect + (correct ? 1 : 0),
          timesWrong: existing.timesWrong + (correct ? 0 : 1),
          lastSeen: Date.now(),
          ...review,
          eFactor: review.eFactor ?? existing.eFactor ?? 2.5,
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
        
        // Calculate streak by counting consecutive calendar days backwards
        let current = 0;
        let checkDate = new Date(today);
        
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
            studyDates: newDates.slice(-365), // Keep last year
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
          // Tie-break: more attempts = more relevant
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
