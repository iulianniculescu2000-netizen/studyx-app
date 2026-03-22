export interface Option {
  id: string;
  text: string;
  isCorrect: boolean;
}

export type Difficulty = 'easy' | 'medium' | 'hard';
export type QuizColor = 'blue' | 'purple' | 'green' | 'orange' | 'pink' | 'red' | 'teal';

export interface Question {
  id: string;
  text: string;
  imageUrl?: string; // base64 data URL or external URL
  options: Option[];
  explanation?: string;
  multipleCorrect?: boolean;
  difficulty?: Difficulty;
  tags?: string[];
}

export interface Quiz {
  id: string;
  title: string;
  description: string;
  emoji: string;
  category: string;
  folderId?: string | null;
  questions: Question[];
  createdAt: number;
  updatedAt?: number;
  color: QuizColor;
  shuffleQuestions?: boolean;
  shuffleAnswers?: boolean;
  pinned?: boolean;
  archived?: boolean;
  tags?: string[];
  /** Rezidențiat scoring: -0.25 pts per wrong option selected, +1 per correct */
  penaltyMode?: boolean;
}

export interface Folder {
  id: string;
  name: string;
  emoji: string;
  color: QuizColor;
  createdAt: number;
  parentId?: string | null;
}

export interface QuizSession {
  id: string;
  quizId: string;
  answers: Record<string, string[]>;
  startedAt: number;
  finishedAt?: number;
  score: number;
  total: number;
  mode: 'study' | 'test' | 'exam';
  timePerQuestion?: Record<string, number>; // questionId -> seconds
  /** Only set when quiz.penaltyMode is true. Score net: +1 correct, -0.25/wrong option */
  penalizedScore?: number;
}

// Spaced repetition per question
export interface QuestionStat {
  questionId: string;
  quizId: string;
  timesCorrect: number;
  timesWrong: number;
  lastSeen: number;
  nextReview: number; // timestamp
  interval: number; // days until next review
  eFactor?: number; // SM-2 ease factor (default 2.5)
}

export interface StudyStreak {
  currentStreak: number;
  longestStreak: number;
  lastStudyDate: string; // YYYY-MM-DD
  studyDates: string[]; // all dates studied
}

// JSON import/export format
export interface QuizImportData {
  title: string;
  description?: string;
  emoji?: string;
  category?: string;
  color?: QuizColor;
  shuffleQuestions?: boolean;
  shuffleAnswers?: boolean;
  questions: {
    text: string;
    imageUrl?: string;
    multipleCorrect?: boolean;
    explanation?: string;
    difficulty?: Difficulty;
    tags?: string[];
    options: { text: string; isCorrect: boolean }[];
  }[];
}
