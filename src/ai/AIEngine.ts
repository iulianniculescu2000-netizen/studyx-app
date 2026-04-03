import type { Question } from '../types';
import { buildContext } from './contextBuilder';
import { logAIDebug } from './debug';
import { runAIPipeline } from './pipeline';
import { buildExplanationPrompt, buildHintPrompt, buildMnemonicPrompt, buildQuestionPrompt, buildWrongOptionsPrompt } from './prompts';
import { loadUserProfile, updateUserProfileAfterAnswer, getWeakTopicsForProfile, generateFromMistakes } from './UserProfile';
import { validateJson } from './validator';
import type {
  AIAnalysisResult,
  AINextQuestionState,
  AIQuestionRequest,
  AIQuestionResult,
  AdaptiveDifficultyInput,
  ExplainWrongOptionsResult,
  HintResult,
  QuestionGenerationResponse,
  UserProfileData,
} from './types';
import { groqRequest } from '../lib/groq';

function normalizeQuestion(question: QuestionGenerationResponse['questions'][number], index: number): Question {
  return {
    id: crypto.randomUUID().replace(/-/g, '').slice(0, 12),
    text: question.text,
    options: question.options.map((option, optionIndex) => ({
      id: `${index}-${optionIndex}-${crypto.randomUUID().replace(/-/g, '').slice(0, 6)}`,
      text: option.text,
      isCorrect: option.isCorrect,
    })),
    explanation: question.explanation,
    tags: question.tags,
    difficulty: question.difficulty ?? 'medium',
  };
}

export class QuestionGenerator {
  static async generate(profile: UserProfileData | null, request: AIQuestionRequest): Promise<AIQuestionResult> {
    const weakTopics = request.weakTopics ?? (profile ? getWeakTopicsForProfile(profile.profileId) : []);
    const difficulty = request.difficulty ?? profile?.currentDifficulty ?? 'medium';
    const context = buildContext(request.context, profile);

    const parsed = await runAIPipeline<QuestionGenerationResponse>({
      retrieve: () => context.summary,
      generate: async () => {
        const prompt = buildQuestionPrompt(profile, weakTopics, difficulty, context);
        return groqRequest({
          task: 'questions',
          messages: [
            { role: 'system', content: prompt },
            { role: 'user', content: `Generate ${request.count ?? 1} questions in strict JSON based on the supplied context.` },
          ],
        });
      },
      validate: (raw) => {
        const result = validateJson<QuestionGenerationResponse>(raw);
        return result.ok && result.value?.questions?.length ? result.value : null;
      },
      fix: async (_raw, error) =>
        groqRequest({
          task: 'questions',
          messages: [
            { role: 'system', content: 'Fix the JSON. Return only valid JSON without trailing commas.' },
            { role: 'user', content: `Previous JSON was invalid: ${error}` },
          ],
        }),
    });

    return {
      questions: parsed.questions.map(normalizeQuestion),
      sources: context.chunks.map((chunk) => `${chunk.source} - ${chunk.topic}`),
      mode: request.mode ?? 'standard',
    };
  }
}

export class WeaknessAnalyzer {
  static getWeakTopics(profileId: string) {
    return getWeakTopicsForProfile(profileId);
  }
}

export class AdaptiveDifficulty {
  static getAdaptiveDifficulty({ accuracy, streak, time }: AdaptiveDifficultyInput): 'easy' | 'medium' | 'hard' {
    let score = 0;
    if (accuracy >= 80) score += 2;
    else if (accuracy < 50) score -= 2;
    if (streak >= 7) score += 2;
    else if (streak >= 3) score += 1;
    if (typeof time === 'number' && time < 20) score -= 1;
    if (score >= 2) return 'hard';
    if (score <= -1) return 'easy';
    return 'medium';
  }
}

export class LearningStrategist {
  static getNextQuestion(state: AINextQuestionState) {
    const nextTopic = state.weakTopics[0]?.topic ?? state.recentMistakes[0]?.topic ?? 'General';
    const difficulty = AdaptiveDifficulty.getAdaptiveDifficulty({
      accuracy: state.accuracy,
      streak: state.streak,
      time: state.availableTime,
    });
    return { topic: nextTopic, difficulty };
  }
}

export async function analyzeAnswer(
  profileId: string,
  payload: { question: Question; userAnswer: string; correctAnswer: string; isCorrect: boolean }
) {
  const profile = loadUserProfile(profileId);
  const context = buildContext(`${payload.question.text} ${payload.correctAnswer}`, profile);

  const analysis = await runAIPipeline<AIAnalysisResult>({
    retrieve: () => context.summary,
    generate: async () =>
      groqRequest({
        task: 'explanation',
        messages: [
          { role: 'system', content: buildExplanationPrompt(payload.userAnswer, payload.correctAnswer, payload.question, context) },
          { role: 'user', content: 'Analyze the answer and return strict JSON.' },
        ],
      }),
    validate: (raw) => {
      const result = validateJson<AIAnalysisResult>(raw);
      return result.ok && result.value?.explanation ? result.value : null;
    },
    fix: async (_raw, error) =>
      groqRequest({
        task: 'explanation',
        messages: [
          { role: 'system', content: 'Fix invalid JSON and keep the same schema.' },
          { role: 'user', content: `Invalid JSON: ${error}` },
        ],
      }),
  });

  const nextProfile = updateUserProfileAfterAnswer(profileId, { ...payload, analysis });
  return { analysis, profile: nextProfile };
}

export async function generateQuestions(request: AIQuestionRequest) {
  const profile = request.userProfile ?? null;
  return QuestionGenerator.generate(profile, request);
}

export function getNextQuestion(state: AINextQuestionState) {
  return LearningStrategist.getNextQuestion(state);
}

export async function generateHint(question: Question, profileId: string) {
  const profile = loadUserProfile(profileId);
  const context = buildContext(question.text, profile);
  return runAIPipeline<HintResult>({
    retrieve: () => context.summary,
    generate: () =>
      groqRequest({
        task: 'hint',
        messages: [
          { role: 'system', content: buildHintPrompt(question, context) },
          { role: 'user', content: 'Return hint JSON.' },
        ],
      }),
    validate: (raw) => {
      const result = validateJson<HintResult>(raw);
      return result.ok && result.value?.full ? result.value : null;
    },
  });
}

export async function generateMnemonicForConcept(concept: string, profileId: string) {
  const profile = loadUserProfile(profileId);
  const context = buildContext(concept, profile);
  const raw = await groqRequest({
    task: 'mnemonic',
    messages: [
      { role: 'system', content: buildMnemonicPrompt(concept, context) },
      { role: 'user', content: 'Return strict JSON.' },
    ],
  });
  const parsed = validateJson<{ mnemonic: string }>(raw);
  return parsed.value?.mnemonic ?? '';
}

export async function explainWrongOptions(question: Question, profileId: string) {
  const profile = loadUserProfile(profileId);
  const context = buildContext(question.text, profile);
  const raw = await groqRequest({
    task: 'explanation',
    messages: [
      { role: 'system', content: buildWrongOptionsPrompt(question, context) },
      { role: 'user', content: 'Return strict JSON for wrong options only.' },
    ],
  });
  const parsed = validateJson<ExplainWrongOptionsResult>(raw);
  return parsed.value?.options ?? [];
}

export class AITutorSession {
  static build(profileId: string) {
    const profile = loadUserProfile(profileId);
    const weakTopics = getWeakTopicsForProfile(profileId);
    return {
      currentTopic: weakTopics[0]?.topic ?? 'General',
      difficulty: profile.currentDifficulty,
      progress: 0,
      questionIds: profile.recentQuestions,
    };
  }
}

export class ExamSimulator {
  static async generate(profileId: string, context: string) {
    const profile = loadUserProfile(profileId);
    return generateQuestions({
      context,
      count: 10,
      difficulty: 'hard',
      weakTopics: getWeakTopicsForProfile(profileId),
      userProfile: { ...profile, examModeEnabled: true },
      mode: 'exam',
    });
  }
}

export function getAdaptiveDifficulty(input: AdaptiveDifficultyInput) {
  return AdaptiveDifficulty.getAdaptiveDifficulty(input);
}

export function getUserProfile(profileId: string) {
  return loadUserProfile(profileId);
}

export function generateFromMistakeBank(profileId: string) {
  return generateFromMistakes(profileId);
}

logAIDebug('AIEngine:init', 'loaded');
