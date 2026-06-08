import { describe, expect, it } from 'vitest';
import type { Question } from '../types';
import {
  buildAnalysisFallback,
  buildClarificationFallback,
  buildHintFallback,
  buildMnemonicFallback,
  getAnswerTextForOptionIds,
  getCorrectAnswerText,
} from '../helpers/quizAi';

const sampleQuestion: Question = {
  id: 'q1',
  text: 'Care este antibioticul de prima intentie?',
  explanation: 'Prima intentie ramane varianta cu spectru tintit si profil bun de siguranta.',
  difficulty: 'medium',
  tags: ['infectii', 'antibiotice'],
  options: [
    { id: 'a', text: 'Amoxicilina', isCorrect: true },
    { id: 'b', text: 'Vancomicina', isCorrect: false },
    { id: 'c', text: 'Colistina', isCorrect: false },
  ],
};

describe('quizAi helpers', () => {
  it('builds a progressive local hint fallback', () => {
    const hint = buildHintFallback(sampleQuestion);

    expect(hint.light).toContain('infectii');
    expect(hint.medium.length).toBeGreaterThan(20);
    expect(hint.full).toContain('Amoxicilina');
  });

  it('builds a usable local analysis fallback', () => {
    const analysis = buildAnalysisFallback({
      question: sampleQuestion,
      userAnswer: 'Vancomicina',
      correctAnswer: getCorrectAnswerText(sampleQuestion),
      isCorrect: false,
    });

    expect(analysis.explanation).toContain('Amoxicilina');
    expect(analysis.recommendedTopic).toBe('infectii');
    expect(analysis.relatedConcepts).toContain('antibiotice');
  });

  it('returns readable answer text helpers', () => {
    expect(getCorrectAnswerText(sampleQuestion)).toBe('Amoxicilina');
    expect(getAnswerTextForOptionIds(sampleQuestion.options, ['b'])).toBe('Vancomicina');
    expect(getAnswerTextForOptionIds(sampleQuestion.options, [])).toBe('niciun raspuns');
  });

  it('creates a deterministic mnemonic fallback', () => {
    const mnemonic = buildMnemonicFallback('infectii bacteriene', 'Amoxicilina');

    expect(mnemonic).toContain('infectii bacteriene');
    expect(mnemonic).toContain('Amoxicilina');
  });

  it('builds a clarification fallback from the same analysis rules', () => {
    const clarification = buildClarificationFallback(sampleQuestion, 'Vancomicina', 'Amoxicilina');

    expect(clarification).toContain('Amoxicilina');
    expect(clarification).toContain('Vancomicina');
  });
});
