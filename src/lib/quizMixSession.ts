import { useQuizStore } from '../store/quizStore';
import type { Folder, Quiz } from '../types';

/**
 * Builds one combined session out of several quizzes (e.g. every test of a
 * specialty) and returns its id, ready to play. A repeat run replaces the
 * previous combined session for the same folder, so they never pile up.
 */
export function startQuizMix(folder: Pick<Folder, 'id' | 'name' | 'emoji' | 'color'>, sets: Quiz[], title?: string): string | null {
  const questions = sets.flatMap((quiz) => quiz.questions);
  if (questions.length === 0) return null;

  const { quizzes, addQuiz, deleteQuiz } = useQuizStore.getState();
  const sessionTag = `folder-session:${folder.id}`;
  const stale = quizzes.find((quiz) => quiz.tags?.includes(sessionTag));
  if (stale) deleteQuiz(stale.id, { keepImages: true });

  const now = Date.now();
  const mix: Quiz = {
    id: crypto.randomUUID().replace(/-/g, '').slice(0, 12),
    title: title ?? `${folder.name} — sesiune completă`,
    description: `Combină ${sets.length} seturi, ${questions.length} întrebări.`,
    emoji: folder.emoji,
    category: folder.name,
    kind: 'quiz',
    folderId: folder.id,
    color: folder.color,
    questions,
    createdAt: now,
    updatedAt: now,
    shuffleQuestions: true,
    shuffleAnswers: false,
    tags: [sessionTag],
  };
  addQuiz(mix);
  return mix.id;
}
