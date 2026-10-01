/**
 * Real progress behind the gamification screen.
 *
 * Everything here is derived from what the user actually did. The screen used to
 * describe one thing and measure another — a "100 anatomy quizzes at 90%" badge
 * that counted every question of any subject, a "help 10 colleagues" badge for a
 * feature that does not exist, and a weekly *rank* in a single-user app. Numbers
 * shown next to a claim have to be that claim.
 */
import type { Quiz, QuestionStat, QuizSession } from '../types';

const WEEK_MS = 7 * 86_400_000;

export interface CategoryMastery {
  category: string;
  /** Questions in this category the user has actually attempted. */
  answeredQuestions: number;
  /** Accuracy over those attempts, 0-100. */
  accuracy: number;
}

/**
 * Per-category mastery, strongest first. Categories are the quiz's own subject
 * label, so "anatomy progress" finally means questions from anatomy quizzes.
 */
export function computeCategoryMastery(
  quizzes: Quiz[],
  questionStats: Record<string, QuestionStat>,
): CategoryMastery[] {
  const totals = new Map<string, { answered: number; correct: number; attempts: number }>();

  for (const quiz of quizzes) {
    const category = (quiz.category ?? '').trim() || 'Neclasificate';
    for (const question of quiz.questions) {
      const stat = questionStats[`${quiz.id}:${question.id}`];
      if (!stat) continue;
      const attempts = stat.timesCorrect + stat.timesWrong;
      if (attempts === 0) continue;

      const entry = totals.get(category) ?? { answered: 0, correct: 0, attempts: 0 };
      entry.answered += 1;
      entry.correct += stat.timesCorrect;
      entry.attempts += attempts;
      totals.set(category, entry);
    }
  }

  return [...totals.entries()]
    .map(([category, entry]) => ({
      category,
      answeredQuestions: entry.answered,
      accuracy: entry.attempts > 0 ? Math.round((entry.correct / entry.attempts) * 100) : 0,
    }))
    .sort((a, b) => b.answeredQuestions - a.answeredQuestions);
}

/**
 * Progress toward mastering any one subject: the furthest-along category that is
 * *also* holding the required accuracy. Counting subjects the user is failing
 * would make the badge meaningless.
 */
export function masteryProgress(
  mastery: CategoryMastery[],
  requiredAccuracy = 90,
): { category: string | null; answeredQuestions: number } {
  const qualifying = mastery.filter((entry) => entry.accuracy >= requiredAccuracy);
  if (qualifying.length === 0) return { category: null, answeredQuestions: 0 };
  const best = qualifying[0];
  return { category: best.category, answeredQuestions: best.answeredQuestions };
}

/** Questions answered in the last 7 days — a real weekly figure, not a rank. */
export function questionsAnsweredThisWeek(sessions: QuizSession[], now: number = Date.now()): number {
  return sessions
    .filter((session) => typeof session.finishedAt === 'number' && session.finishedAt >= now - WEEK_MS)
    .reduce((sum, session) => sum + session.total, 0);
}

/** Sessions where every question was answered correctly. */
export function perfectSessionCount(sessions: QuizSession[]): number {
  return sessions.filter((session) => session.total > 0 && session.score === session.total).length;
}

/** Longest run of consecutive study days actually recorded. */
export function bestStreak(currentStreak: number, longestStreak: number): number {
  return Math.max(currentStreak, longestStreak);
}
