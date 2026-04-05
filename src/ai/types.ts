import type { Difficulty, Question, QuestionStat } from '../types';

export type AIRequestTask =
  | 'questions'
  | 'explanation'
  | 'mnemonic'
  | 'hint'
  | 'chat'
  | 'analysis';

export interface WeakTopic {
  topic: string;
  accuracy: number;
  wrongCount: number;
  total: number;
  recencyScore: number;
}

export interface RecentMistake {
  questionId: string;
  topic: string;
  answer: string;
  correctAnswer: string;
  mistakeType?: string;
  timestamp: number;
}

export interface MistakeBankEntry {
  id: string;
  questionId: string;
  questionText: string;
  topic: string;
  userAnswer: string;
  correctAnswer: string;
  explanation?: string;
  mistakeType?: string;
  missingConcept?: string;
  recommendedTopic?: string;
  mnemonic?: string;
  sourceRefs?: string[];
  createdAt: number;
  wrongCount: number;
}

export interface UserProfileData {
  profileId: string;
  globalAccuracy: number;
  topicAccuracy: Record<string, { correct: number; total: number; accuracy: number }>;
  recentMistakes: RecentMistake[];
  mistakeBank: MistakeBankEntry[];
  currentDifficulty: Difficulty;
  streak: number;
  recentQuestions: string[];
  availableTime?: number;
  examModeEnabled?: boolean;
  updatedAt: number;
}

export interface RetrievedChunk {
  id: string;
  text: string;
  topic: string;
  source: string;
  difficulty: Difficulty;
  score: number;
  keywordScore: number;
  semanticScore: number;
  recencyBoost: number;
  weaknessBoost: number;
}

export interface AIContextPayload {
  query: string;
  summary: string;
  chunks?: ChunkRecord[] | RetrievedChunk[];
  weakTopics?: WeakTopic[];
  recentMistakes?: RecentMistake[];
  level?: Difficulty;
  availableTime?: number;
}

export interface AIAnalysisResult {
  explanation: string;
  mistakeType: string;
  rule: string;
  confidence: number;
  missingConcept?: string;
  recommendedTopic?: string;
  relatedConcepts?: string[];
  sources?: string[];
}

export interface AIQuestionRequest {
  context: string;
  count?: number;
  difficulty?: Difficulty;
  weakTopics?: WeakTopic[];
  userProfile?: UserProfileData;
  mode?: 'standard' | 'exam' | 'tutor';
}

export interface AIQuestionResult {
  questions: Question[];
  sources: string[];
  mode: 'standard' | 'exam' | 'tutor';
}

export interface AINextQuestionState {
  previousQuestions: string[];
  weakTopics: WeakTopic[];
  recentMistakes: RecentMistake[];
  accuracy: number;
  streak: number;
  availableTime?: number;
  preferredDifficulty?: Difficulty;
}

export interface AdaptiveDifficultyInput {
  accuracy: number;
  streak: number;
  time?: number;
}

export interface ChunkRecord {
  id: string;
  sourceId?: string;
  text: string;
  topic: string;
  source: string;
  difficulty: Difficulty;
  embedding: number[];
  createdAt: number;
}

export interface CoverageRecord {
  topic: string;
  coverageScore: number;
  lastUpdated: number;
}

export interface ValidateJsonResult<T> {
  ok: boolean;
  value?: T;
  error?: string;
  repaired?: string;
}

export interface QuestionGenerationResponse {
  questions: Array<{
    text: string;
    options: Array<{ text: string; isCorrect: boolean }>;
    explanation: string;
    tags?: string[];
    difficulty?: Difficulty;
    sources?: string[];
  }>;
}

export interface HintResult {
  light: string;
  medium: string;
  full: string;
}

export interface TutorSessionState {
  currentTopic: string;
  difficulty: Difficulty;
  progress: number;
  questionIds: string[];
}

export interface ExplainWrongOptionsResult {
  options: Array<{ option: string; whyWrong: string }>;
}

export type TopicStatsMap = Record<string, { correct: number; total: number; wrong: number; lastWrongAt: number }>;

export interface WeakTopicInput {
  stats: Record<string, QuestionStat>;
  questions: Array<Pick<Question, 'id' | 'tags' | 'text'>>;
}
