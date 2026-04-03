import type { Question } from '../types';
import type { AIContextPayload, UserProfileData, WeakTopic } from './types';

export const AI_PERSONALITY =
  'You are a strict but helpful medical tutor. You prioritize understanding over memorization.';

export const GROUNDING_RULES =
  'Use ONLY the provided context. If the answer is not in the context, say "I don\'t know". Do NOT invent medical information.';

function difficultyText(difficulty: 'easy' | 'medium' | 'hard') {
  if (difficulty === 'easy') return 'basic recall and simple reasoning';
  if (difficulty === 'hard') return 'residency-level traps and advanced reasoning';
  return 'balanced medium difficulty';
}

function weakTopicsText(weakTopics: WeakTopic[]) {
  if (weakTopics.length === 0) return 'none';
  return weakTopics.map((topic) => `${topic.topic} (${topic.accuracy}% accuracy)`).join(', ');
}

export function sanitizeUserInput(input: string) {
  return input
    .replace(/<\|.*?\|>/g, '')
    .replace(/system prompt/gi, '')
    .replace(/ignore previous instructions/gi, '')
    .replace(/\u0000/g, '')
    .trim();
}

export function buildQuestionPrompt(
  profile: UserProfileData | null,
  weakTopics: WeakTopic[],
  difficulty: 'easy' | 'medium' | 'hard',
  contextPayload?: AIContextPayload
) {
  const safeContext = contextPayload?.summary ?? '';
  const profileLine = profile
    ? `User level: ${profile.currentDifficulty}, global accuracy ${profile.globalAccuracy}%, streak ${profile.streak}.`
    : 'User level unavailable.';
  return [
    AI_PERSONALITY,
    GROUNDING_RULES,
    profileLine,
    `Weak topics: ${weakTopicsText(weakTopics)}.`,
    `Target difficulty: ${difficultyText(difficulty)}.`,
    safeContext ? `Context:\n${safeContext}` : 'Context unavailable.',
    'Return strict JSON: {"questions":[{"text":"","options":[{"text":"","isCorrect":true}],"explanation":"","tags":[""],"difficulty":"easy|medium|hard","sources":[""]}]}',
  ].join('\n\n');
}

export function buildExplanationPrompt(
  userAnswer: string,
  correctAnswer: string,
  question?: Question,
  contextPayload?: AIContextPayload
) {
  return [
    AI_PERSONALITY,
    GROUNDING_RULES,
    'Explain why the answer is wrong, identify the error type, add one rule and one short mnemonic if useful.',
    question ? `Question: ${sanitizeUserInput(question.text)}` : '',
    `User answer: ${sanitizeUserInput(userAnswer)}`,
    `Correct answer: ${sanitizeUserInput(correctAnswer)}`,
    contextPayload?.summary ? `Context:\n${contextPayload.summary}` : '',
    'Return strict JSON: {"explanation":"","mistakeType":"","rule":"","confidence":0.0,"missingConcept":"","recommendedTopic":"","relatedConcepts":[""],"sources":[""]}',
  ].filter(Boolean).join('\n\n');
}

export function buildMnemonicPrompt(concept: string, contextPayload?: AIContextPayload) {
  return [
    AI_PERSONALITY,
    GROUNDING_RULES,
    `Create a short mnemonic for: ${sanitizeUserInput(concept)}`,
    contextPayload?.summary ? `Context:\n${contextPayload.summary}` : '',
    'Return strict JSON: {"mnemonic":""}',
  ].filter(Boolean).join('\n\n');
}

export function buildHintPrompt(question: Question, contextPayload?: AIContextPayload) {
  return [
    AI_PERSONALITY,
    GROUNDING_RULES,
    `Question: ${sanitizeUserInput(question.text)}`,
    contextPayload?.summary ? `Context:\n${contextPayload.summary}` : '',
    'Return strict JSON: {"light":"","medium":"","full":""}',
  ].filter(Boolean).join('\n\n');
}

export function buildWrongOptionsPrompt(question: Question, contextPayload?: AIContextPayload) {
  const options = question.options.map((option) => option.text).join(' | ');
  return [
    AI_PERSONALITY,
    GROUNDING_RULES,
    `Question: ${sanitizeUserInput(question.text)}`,
    `Options: ${sanitizeUserInput(options)}`,
    contextPayload?.summary ? `Context:\n${contextPayload.summary}` : '',
    'Return strict JSON: {"options":[{"option":"","whyWrong":""}]}',
  ].filter(Boolean).join('\n\n');
}
