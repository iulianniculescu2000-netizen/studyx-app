import type { Option, Difficulty } from './index';

export interface RezidentiatBookChunk {
  id: string;
  bookTitle: string;    // e.g., 'Kumar', 'Lawrence'
  chapter: string;      // e.g., 'Cardiologie'
  subchapter?: string;  
  text: string;         // The actual content chunk
  page?: number;
}

export interface RezidentiatQuestion {
  id: string;
  text: string;
  options: Option[];
  multipleCorrect: boolean;
  explanation?: string;
  category: string;     // e.g., 'Cardiologie'
  sourceBook?: string;  // e.g., 'Kumar'
  difficulty?: Difficulty;
}

export interface RezidentiatQuiz {
  id: string;
  title: string;
  category: string;
  questions: RezidentiatQuestion[];
}

export interface RezidentiatDatabase {
  books: RezidentiatBookChunk[];
  quizzes: RezidentiatQuiz[];
}
