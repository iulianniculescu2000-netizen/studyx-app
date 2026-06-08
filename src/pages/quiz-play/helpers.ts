import type { Option } from '../../types';

export function shuffleArray<T>(items: T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const targetIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[targetIndex]] = [copy[targetIndex], copy[index]];
  }
  return copy;
}

export function formatQuizPlayTime(seconds: number) {
  return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
}

export function getCorrectOptionIds(options: Option[]) {
  return options.filter((option) => option.isCorrect).map((option) => option.id);
}

export function isCorrectSelection(selectedIds: string[], correctIds: string[]) {
  return selectedIds.length === correctIds.length && correctIds.every((id) => selectedIds.includes(id));
}

/** 3-state evaluation for multiple-choice grids:
 *  - 'correct':  all correct selected, no wrong selected
 *  - 'partial':  at least one correct, zero wrong selected (missed some correct)
 *  - 'wrong':    any wrong option selected, OR nothing selected
 */
export type AnswerResult = 'correct' | 'partial' | 'wrong';

export function evaluateSelection(selectedIds: string[], correctIds: string[]): AnswerResult {
  if (selectedIds.length === 0) return 'wrong';
  if (isCorrectSelection(selectedIds, correctIds)) return 'correct';
  const hasWrong = selectedIds.some((id) => !correctIds.includes(id));
  if (hasWrong) return 'wrong';
  // Has at least one correct, none wrong → partial
  return 'partial';
}

/** Returns a 0–1 score for a partial answer (used for display only, not the main score). */
export function partialCredit(selectedIds: string[], correctIds: string[]): number {
  if (correctIds.length === 0) return 0;
  const correctSelected = selectedIds.filter((id) => correctIds.includes(id)).length;
  const wrongSelected = selectedIds.filter((id) => !correctIds.includes(id)).length;
  return Math.max(0, (correctSelected - wrongSelected * 0.5) / correctIds.length);
}
