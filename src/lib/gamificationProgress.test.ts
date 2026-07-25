import { describe, expect, it } from 'vitest';
import {
  computeCategoryMastery,
  masteryProgress,
  perfectSessionCount,
  questionsAnsweredThisWeek,
} from './gamificationProgress';
import type { QuestionStat, Quiz, QuizSession } from '../types';

const NOW = new Date('2026-07-25T12:00:00Z').getTime();
const DAY = 86_400_000;

function quiz(id: string, category: string, questionIds: string[]): Quiz {
  return {
    id, title: id, description: '', emoji: '📘', category, color: 'blue', createdAt: 1,
    questions: questionIds.map((qid) => ({
      id: qid, text: qid,
      options: [{ id: 'a', text: 'A', isCorrect: true }, { id: 'b', text: 'B', isCorrect: false }],
    })),
  };
}

function stat(quizId: string, questionId: string, correct: number, wrong: number): [string, QuestionStat] {
  return [`${quizId}:${questionId}`, {
    questionId, quizId, timesCorrect: correct, timesWrong: wrong,
    lastSeen: NOW, nextReview: NOW + DAY, interval: 1, eFactor: 2.5, consecutiveCorrect: correct,
  }];
}

function session(finishedAt: number, score: number, total: number): QuizSession {
  return { id: String(finishedAt), quizId: 'q', answers: {}, startedAt: finishedAt - 60_000, finishedAt, score, total, mode: 'study' };
}

describe('computeCategoryMastery', () => {
  it('counts only questions from the matching subject', () => {
    const quizzes = [quiz('a', 'Anatomie', ['a1', 'a2']), quiz('c', 'Cardiologie', ['c1'])];
    const stats = Object.fromEntries([
      stat('a', 'a1', 9, 1),
      stat('a', 'a2', 10, 0),
      stat('c', 'c1', 1, 9),
    ]);

    const mastery = computeCategoryMastery(quizzes, stats);
    const anatomy = mastery.find((m) => m.category === 'Anatomie')!;

    expect(anatomy.answeredQuestions).toBe(2);
    expect(anatomy.accuracy).toBe(95);
    expect(mastery.find((m) => m.category === 'Cardiologie')!.accuracy).toBe(10);
  });

  it('ignores questions that were never attempted', () => {
    const quizzes = [quiz('a', 'Anatomie', ['a1', 'a2', 'a3'])];
    const stats = Object.fromEntries([stat('a', 'a1', 5, 0)]);
    expect(computeCategoryMastery(quizzes, stats)[0].answeredQuestions).toBe(1);
  });

  it('returns nothing when nothing has been studied', () => {
    expect(computeCategoryMastery([quiz('a', 'Anatomie', ['a1'])], {})).toEqual([]);
  });
});

describe('masteryProgress', () => {
  it('counts only a subject the user is actually holding at the required accuracy', () => {
    const result = masteryProgress([
      { category: 'Cardiologie', answeredQuestions: 80, accuracy: 55 },
      { category: 'Anatomie', answeredQuestions: 40, accuracy: 93 },
    ]);
    expect(result).toEqual({ category: 'Anatomie', answeredQuestions: 40 });
  });

  it('reports zero when no subject meets the bar', () => {
    const result = masteryProgress([{ category: 'Cardiologie', answeredQuestions: 200, accuracy: 60 }]);
    expect(result).toEqual({ category: null, answeredQuestions: 0 });
  });
});

describe('questionsAnsweredThisWeek', () => {
  it('adds up only the last seven days', () => {
    const total = questionsAnsweredThisWeek([
      session(NOW - 2 * DAY, 5, 10),
      session(NOW - 6 * DAY, 3, 5),
      session(NOW - 20 * DAY, 10, 40),
    ], NOW);
    expect(total).toBe(15);
  });

  it('is zero with no recent activity', () => {
    expect(questionsAnsweredThisWeek([session(NOW - 30 * DAY, 1, 10)], NOW)).toBe(0);
  });
});

describe('perfectSessionCount', () => {
  it('counts only fully correct sessions', () => {
    expect(perfectSessionCount([
      session(NOW, 10, 10),
      session(NOW, 9, 10),
      session(NOW, 0, 0),
    ])).toBe(1);
  });
});
