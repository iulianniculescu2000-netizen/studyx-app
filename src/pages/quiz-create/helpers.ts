import type { Difficulty, Question, QuizColor } from '../../types';

export const EMOJIS = ['📚', '🧠', '💡', '🔬', '🌍', '💻', '🔢', '🎯', '⚡', '🏆', '🎓', '🌱', '🧪', '🗺️', '📖', '🏛️', '🩺', '💊', '❤️', '🦠', '🔭', '🧬'];

export const COLORS: { id: QuizColor; bg: string }[] = [
  { id: 'blue', bg: 'linear-gradient(135deg, #0A84FF, #5E5CE6)' },
  { id: 'purple', bg: 'linear-gradient(135deg, #5E5CE6, #AF52DE)' },
  { id: 'green', bg: 'linear-gradient(135deg, #30D158, #34C759)' },
  { id: 'orange', bg: 'linear-gradient(135deg, #FF9F0A, #FF6B00)' },
  { id: 'pink', bg: 'linear-gradient(135deg, #FF375F, #FF2D55)' },
  { id: 'red', bg: 'linear-gradient(135deg, #FF453A, #FF3B30)' },
  { id: 'teal', bg: 'linear-gradient(135deg, #5AC8FA, #32ADE6)' },
];

export const CATEGORIES = ['Dermatologie', 'Anatomie', 'Fiziologie', 'Biochimie', 'Farmacologie', 'Patologie', 'Chirurgie', 'Medicină internă', 'Neurologie', 'Microbiologie', 'Histologie', 'Altele'];

export const DIFFICULTIES: { id: Difficulty; label: string; color: string }[] = [
  { id: 'easy', label: 'Ușor', color: '#30D158' },
  { id: 'medium', label: 'Mediu', color: '#FF9F0A' },
  { id: 'hard', label: 'Dificil', color: '#FF453A' },
];

export const OPTION_IDS = ['a', 'b', 'c', 'd', 'e', 'f'];

export function compressImage(dataUrl: string, maxPx = 800, quality = 0.75): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxPx || height > maxPx) {
        if (width > height) {
          height = Math.round((height * maxPx) / width);
          width = maxPx;
        } else {
          width = Math.round((width * maxPx) / height);
          height = maxPx;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export function generateId() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
}

export function newQuestion(): Question {
  return {
    id: generateId(),
    text: '',
    multipleCorrect: false,
    difficulty: 'easy',
    options: [
      { id: 'a', text: '', isCorrect: false },
      { id: 'b', text: '', isCorrect: false },
      { id: 'c', text: '', isCorrect: false },
      { id: 'd', text: '', isCorrect: false },
    ],
    explanation: '',
  };
}
