import { findOrCreateAiFlashcardsFolder } from './rezidentiatRoot';
import { mergeBuiltInDeck } from './rezidentiatFlashcards';

/**
 * Loads the bundled Kumar flashcard deck into the quiz store (or refreshes it
 * if it's already there) and returns the deck id to open, or null if the deck
 * couldn't be loaded.
 *
 * The shipped deck can be corrected between versions, so an existing deck gets
 * its content refreshed — but a card the user already has study history on
 * never disappears (see `mergeBuiltInDeck`).
 */
export async function startKumarDeck(): Promise<string | null> {
  const { useRezidentiatStore } = await import('../store/rezidentiatStore');
  const quizData = await useRezidentiatStore.getState().loadKumarFlashcards();
  if (!quizData) return null;

  const { useQuizStore } = await import('../store/quizStore');
  const quizStore = useQuizStore.getState();
  const existing = quizStore.quizzes.find((q) => q.id === quizData.id);

  if (existing) {
    const { useStatsStore } = await import('../store/statsStore');
    const stats = useStatsStore.getState().questionStats;
    quizStore.updateQuiz(quizData.id, {
      questions: mergeBuiltInDeck(existing.questions, quizData.questions, (questionId) => `${quizData.id}:${questionId}` in stats),
      title: quizData.title,
    });
  } else {
    quizStore.addQuiz({ ...quizData, folderId: findOrCreateAiFlashcardsFolder() });
  }
  return quizData.id;
}
