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
