/**
 * Validation Helper - Validare date pentru StudyX
 * Asigur integritatea datelor pentru quiz-uri, intrebari si profiluri.
 */

import type { Option, Question, Quiz } from '../types';

const PATTERNS = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  url: /^https?:\/\/.+/,
  quizTitle: /^[a-zA-Z0-9\u0100-\u017F\s\-_.!?,()]{3,100}$/,
  questionText: /^.{10,1000}$/,
  optionText: /^.{1,200}$/,
  profileName: /^[a-zA-Z0-9\u0100-\u017F\s\-_]{2,30}$/,
} as const;

const ERROR_MESSAGES = {
  required: 'Acest câmp este obligatoriu',
  invalidEmail: 'Email invalid',
  invalidUrl: 'URL invalid',
  quizTitle: 'Titlul quiz-ului trebuie sa aibie între 3-100 caractere',
  questionText: 'Textul întrebarii trebuie sa aibie între 10-1000 caractere',
  optionText: 'Textul opțiunii trebuie sa aibie între 1-200 caractere',
  profileName: 'Numele profilului trebuie sa aibie între 2-30 caractere',
  minOptions: 'Cel puțin două opțiuni sunt necesare',
  maxOptions: 'Maximum 10 opțiuni permise',
  minQuestions: 'Cel puțin o întrebare este necesară',
  maxQuestions: 'Maximum 100 întrebări permise',
  correctOption: 'Cel puțin o opțiune corectă este necesară',
  duplicateOptions: 'Opțiunile nu pot fi duplicate',
} as const;

export function validateString(value: string, pattern: RegExp): boolean {
  return pattern.test(value.trim());
}

export function isValidEmail(email: string): boolean {
  return validateString(email, PATTERNS.email);
}

export function isValidUrl(url: string): boolean {
  return validateString(url, PATTERNS.url);
}

export function validateQuizTitle(title: string): {
  isValid: boolean;
  error?: string;
} {
  if (!title?.trim()) {
    return { isValid: false, error: ERROR_MESSAGES.required };
  }

  if (!validateString(title, PATTERNS.quizTitle)) {
    return { isValid: false, error: ERROR_MESSAGES.quizTitle };
  }

  return { isValid: true };
}

export function validateQuestionText(text: string): {
  isValid: boolean;
  error?: string;
} {
  if (!text?.trim()) {
    return { isValid: false, error: ERROR_MESSAGES.required };
  }

  if (!validateString(text, PATTERNS.questionText)) {
    return { isValid: false, error: ERROR_MESSAGES.questionText };
  }

  return { isValid: true };
}

export function validateOptionText(text: string): {
  isValid: boolean;
  error?: string;
} {
  if (!text?.trim()) {
    return { isValid: false, error: ERROR_MESSAGES.required };
  }

  if (!validateString(text, PATTERNS.optionText)) {
    return { isValid: false, error: ERROR_MESSAGES.optionText };
  }

  return { isValid: true };
}

export function validateOptions(options: Option[]): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!options || options.length === 0) {
    errors.push(ERROR_MESSAGES.required);
    return { isValid: false, errors };
  }

  if (options.length < 2) {
    errors.push(ERROR_MESSAGES.minOptions);
  }

  if (options.length > 10) {
    errors.push(ERROR_MESSAGES.maxOptions);
  }

  options.forEach((option, index) => {
    const validation = validateOptionText(option.text);
    if (!validation.isValid) {
      errors.push(`Opțiunea ${index + 1}: ${validation.error}`);
    }
  });

  const optionTexts = options.map((option) => option.text.trim().toLowerCase());
  const duplicates = optionTexts.filter((text, index) => optionTexts.indexOf(text) !== index);
  if (duplicates.length > 0) {
    errors.push(ERROR_MESSAGES.duplicateOptions);
  }

  if (!options.some((option) => option.isCorrect)) {
    errors.push(ERROR_MESSAGES.correctOption);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export function validateQuestion(question: Question): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  const textValidation = validateQuestionText(question.text);
  if (!textValidation.isValid) {
    errors.push(`Text întrebare: ${textValidation.error}`);
  }

  const optionsValidation = validateOptions(question.options);
  if (!optionsValidation.isValid) {
    errors.push(...optionsValidation.errors);
  }

  if (question.imageUrl && !isValidUrl(question.imageUrl)) {
    errors.push('URL imagine invalid');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export function validateQuiz(quiz: Partial<Quiz>): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  const titleValidation = validateQuizTitle(quiz.title || '');
  if (!titleValidation.isValid) {
    errors.push(`Titlu: ${titleValidation.error}`);
  }

  if (quiz.description && quiz.description.length > 500) {
    errors.push('Descrierea nu poate avea mai mult de 500 caractere');
  }

  if (!quiz.questions || quiz.questions.length === 0) {
    errors.push(ERROR_MESSAGES.minQuestions);
  } else {
    if (quiz.questions.length > 100) {
      errors.push(ERROR_MESSAGES.maxQuestions);
    }

    quiz.questions.forEach((question, index) => {
      const questionValidation = validateQuestion(question);
      if (!questionValidation.isValid) {
        errors.push(`Întrebarea ${index + 1}: ${questionValidation.errors.join(', ')}`);
      }
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export function validateProfileName(name: string): {
  isValid: boolean;
  error?: string;
} {
  if (!name?.trim()) {
    return { isValid: false, error: ERROR_MESSAGES.required };
  }

  if (!validateString(name, PATTERNS.profileName)) {
    return { isValid: false, error: ERROR_MESSAGES.profileName };
  }

  return { isValid: true };
}

export function sanitizeString(input: string): string {
  return input
    .trim()
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/\son\w+=(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/<\/?[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function sanitizeQuiz(quiz: Partial<Quiz>): Partial<Quiz> {
  return {
    ...quiz,
    title: quiz.title ? sanitizeString(quiz.title) : '',
    description: quiz.description ? sanitizeString(quiz.description) : '',
    questions: quiz.questions?.map((question) => ({
      ...question,
      text: sanitizeString(question.text),
      explanation: question.explanation ? sanitizeString(question.explanation) : question.explanation,
      options: question.options.map((option) => ({
        ...option,
        text: sanitizeString(option.text),
      })),
    })),
  };
}

export function validateUserInput(input: unknown, type: 'text' | 'email' | 'url' = 'text'): {
  isValid: boolean;
  error?: string;
  sanitized?: string;
} {
  if (typeof input !== 'string') {
    return { isValid: false, error: 'Input invalid' };
  }

  const sanitized = sanitizeString(input);

  switch (type) {
    case 'email':
      return {
        isValid: isValidEmail(sanitized),
        error: isValidEmail(sanitized) ? undefined : ERROR_MESSAGES.invalidEmail,
        sanitized,
      };
    case 'url':
      return {
        isValid: isValidUrl(sanitized),
        error: isValidUrl(sanitized) ? undefined : ERROR_MESSAGES.invalidUrl,
        sanitized,
      };
    default:
      return {
        isValid: sanitized.length > 0,
        error: sanitized.length > 0 ? undefined : ERROR_MESSAGES.required,
        sanitized,
      };
  }
}

export function validateStorageData(data: unknown): {
  isValid: boolean;
  error?: string;
} {
  if (!data) {
    return { isValid: false, error: 'Date lipsă' };
  }

  if (typeof data !== 'object') {
    return { isValid: false, error: 'Format date invalid' };
  }

  try {
    JSON.stringify(data);
    return { isValid: true };
  } catch {
    return { isValid: false, error: 'Date corupte' };
  }
}

export const ValidationHelper = {
  validateString,
  isValidEmail,
  isValidUrl,
  validateQuizTitle,
  validateQuestionText,
  validateOptionText,
  validateOptions,
  validateQuestion,
  validateQuiz,
  validateProfileName,
  sanitizeString,
  sanitizeQuiz,
  validateUserInput,
  validateStorageData,
  ERROR_MESSAGES,
  PATTERNS,
};

export default ValidationHelper;
