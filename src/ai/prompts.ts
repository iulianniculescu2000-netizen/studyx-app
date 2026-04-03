import type { Question } from '../types';
import type { AIContextPayload, UserProfileData, WeakTopic } from './types';

export const AI_PERSONALITY =
  'Esti un tutor medical exigent, dar util, pentru studenti la medicina din Romania. Prioritizezi intelegerea, nu memorarea mecanica. Raspunzi exclusiv in limba romana, cu terminologie medicala corecta si formulare clara.';

export const GROUNDING_RULES =
  'Foloseste DOAR contextul furnizat. Daca raspunsul nu exista in context, spune exact "Nu stiu pe baza contextului primit.". Nu inventa informatii medicale si nu completa din presupuneri.';

function difficultyText(difficulty: 'easy' | 'medium' | 'hard') {
  if (difficulty === 'easy') return 'nivel usor, cu memorare de baza si rationament simplu';
  if (difficulty === 'hard') return 'nivel avansat, cu capcane de tip rezidentiat si rationament clinic matur';
  return 'nivel mediu echilibrat, intre memorare si rationament';
}

function weakTopicsText(weakTopics: WeakTopic[]) {
  if (weakTopics.length === 0) return 'niciun topic slab evident';
  return weakTopics.map((topic) => `${topic.topic} (${topic.accuracy}% acuratete)`).join(', ');
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
    ? `Nivel utilizator: ${profile.currentDifficulty}, acuratete globala ${profile.globalAccuracy}%, streak ${profile.streak}.`
    : 'Nivelul utilizatorului nu este disponibil.';
  return [
    AI_PERSONALITY,
    GROUNDING_RULES,
    profileLine,
    `Topicuri slabe: ${weakTopicsText(weakTopics)}.`,
    `Dificultate tinta: ${difficultyText(difficulty)}.`,
    safeContext ? `Context:\n${safeContext}` : 'Context indisponibil.',
    'Genereaza raspunsul doar in romana.',
    'Returneaza JSON strict: {"questions":[{"text":"","options":[{"text":"","isCorrect":true}],"explanation":"","tags":[""],"difficulty":"easy|medium|hard","sources":[""]}]}',
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
    'Explica de ce raspunsul utilizatorului este gresit, identifica tipul erorii, adauga o regula scurta si un mnemonic doar daca ajuta real. Tot raspunsul trebuie sa fie in romana.',
    question ? `Intrebare: ${sanitizeUserInput(question.text)}` : '',
    `Raspuns utilizator: ${sanitizeUserInput(userAnswer)}`,
    `Raspuns corect: ${sanitizeUserInput(correctAnswer)}`,
    contextPayload?.summary ? `Context:\n${contextPayload.summary}` : '',
    'Returneaza JSON strict: {"explanation":"","mistakeType":"","rule":"","confidence":0.0,"missingConcept":"","recommendedTopic":"","relatedConcepts":[""],"sources":[""]}',
  ].filter(Boolean).join('\n\n');
}

export function buildMnemonicPrompt(concept: string, contextPayload?: AIContextPayload) {
  return [
    AI_PERSONALITY,
    GROUNDING_RULES,
    `Creeaza un mnemonic scurt si memorabil pentru: ${sanitizeUserInput(concept)}`,
    contextPayload?.summary ? `Context:\n${contextPayload.summary}` : '',
    'Returneaza JSON strict: {"mnemonic":""}',
  ].filter(Boolean).join('\n\n');
}

export function buildHintPrompt(question: Question, contextPayload?: AIContextPayload) {
  return [
    AI_PERSONALITY,
    GROUNDING_RULES,
    `Intrebare: ${sanitizeUserInput(question.text)}`,
    contextPayload?.summary ? `Context:\n${contextPayload.summary}` : '',
    'Returneaza JSON strict: {"light":"","medium":"","full":""}. Valorile trebuie sa fie in romana si progresive: indiciu usor, indiciu mediu, explicatie completa.',
  ].filter(Boolean).join('\n\n');
}

export function buildWrongOptionsPrompt(question: Question, contextPayload?: AIContextPayload) {
  const options = question.options.map((option) => option.text).join(' | ');
  return [
    AI_PERSONALITY,
    GROUNDING_RULES,
    `Intrebare: ${sanitizeUserInput(question.text)}`,
    `Optiuni: ${sanitizeUserInput(options)}`,
    contextPayload?.summary ? `Context:\n${contextPayload.summary}` : '',
    'Returneaza JSON strict: {"options":[{"option":"","whyWrong":""}]}. Explicatiile trebuie sa fie in romana.',
  ].filter(Boolean).join('\n\n');
}
