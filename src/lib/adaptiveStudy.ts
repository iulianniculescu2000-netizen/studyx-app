import type { Question, QuestionStat, Quiz } from '../types';
import { generateFromMistakes, getWeakTopicsForProfile } from '../ai/UserProfile';

function uid() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
}

function cloneQuestion(question: Question): Question {
  return {
    ...question,
    id: uid(),
    options: question.options.map((option) => ({ ...option, id: uid() })),
  };
}

function getQuestionStatMap(stats: Record<string, QuestionStat>) {
  return new Map(Object.values(stats).map((stat) => [`${stat.quizId}:${stat.questionId}`, stat] as const));
}

export function buildMistakeFlashcardQuiz(
  profileId: string,
  quizzes: Quiz[],
  stats: Record<string, QuestionStat>,
): Quiz | null {
  const mistakes = generateFromMistakes(profileId);
  const statMap = getQuestionStatMap(stats);

  const questions: Question[] = [];

  for (const mistake of mistakes) {
      const located = quizzes
        .map((quiz) => ({ quiz, question: quiz.questions.find((entry) => entry.id === mistake.questionId) }))
        .find((entry) => entry.question);
      if (!located?.question) continue;

      const original = located.question;
      const stat = statMap.get(`${located.quiz.id}:${original.id}`);
      const answerText = original.options.filter((option) => option.isCorrect).map((option) => option.text).join(', ');

      questions.push({
        id: uid(),
        text: `Unde ai ezitat: ${original.text}`,
        multipleCorrect: false,
        difficulty: original.difficulty ?? 'medium',
        explanation: [
          mistake.explanation,
          mistake.missingConcept ? `Concept lipsa: ${mistake.missingConcept}.` : '',
          stat ? `Istoric: ${stat.timesWrong} greseli, ${stat.timesCorrect} raspunsuri corecte.` : '',
        ].filter(Boolean).join(' '),
        tags: [...new Set([...(original.tags ?? []), 'mistake-bank', mistake.topic])],
        options: [
          { id: uid(), text: answerText || mistake.correctAnswer, isCorrect: true },
        ],
      });

      if (questions.length >= 20) break;
  }

  if (questions.length === 0) return null;

  return {
    id: uid(),
    title: 'Flashcards din greseli',
    description: `Carduri create din cele mai importante ${questions.length} greseli recente.`,
    emoji: '🧠',
    color: 'orange',
    category: 'Altele',
    folderId: null,
    shuffleQuestions: true,
    shuffleAnswers: false,
    tags: ['mistake-bank', 'flashcards', 'recovery'],
    questions,
    createdAt: Date.now(),
  };
}

export function buildWeaknessRecoveryQuiz(
  profileId: string,
  quizzes: Quiz[],
  stats: Record<string, QuestionStat>,
): Quiz | null {
  const weakTopics = getWeakTopicsForProfile(profileId);
  const statMap = getQuestionStatMap(stats);
  const scoredQuestions = quizzes
    .flatMap((quiz) => quiz.questions.map((question) => {
      const stat = statMap.get(`${quiz.id}:${question.id}`);
      const tags = question.tags ?? [];
      const topicBoost = weakTopics.find((topic) => tags.includes(topic.topic));
      const accuracy = stat ? stat.timesCorrect / Math.max(stat.timesCorrect + stat.timesWrong, 1) : 0.5;
      const dueBoost = stat && stat.nextReview > 0 && stat.nextReview <= Date.now() ? 0.4 : 0;
      const wrongWeight = stat ? Math.min(stat.timesWrong * 0.12, 0.72) : 0;
      const topicWeight = topicBoost ? Math.max((100 - topicBoost.accuracy) / 100, 0.18) : 0;
      const score = dueBoost + wrongWeight + topicWeight + (1 - accuracy) * 0.4;
      return { quiz, question, score };
    }))
    .filter((entry) => entry.score > 0.18)
    .sort((left, right) => right.score - left.score);

  const questions = scoredQuestions
    .slice(0, 12)
    .map((entry) => cloneQuestion(entry.question));

  if (questions.length === 0) return null;

  const focusTopics = weakTopics.slice(0, 3).map((topic) => topic.topic);

  return {
    id: uid(),
    title: 'Weakness Recovery Session',
    description: focusTopics.length > 0
      ? `Sesiune ghidata pentru ${focusTopics.join(', ')}.`
      : 'Sesiune ghidata din intrebarile unde ai cea mai mare nevoie de consolidare.',
    emoji: '🎯',
    color: 'red',
    category: 'Altele',
    folderId: null,
    shuffleQuestions: true,
    shuffleAnswers: true,
    tags: ['recovery', 'weakness', ...focusTopics],
    questions,
    createdAt: Date.now(),
  };
}

export function buildAdaptiveExamQuiz(
  profileId: string,
  quizzes: Quiz[],
  stats: Record<string, QuestionStat>,
): Quiz | null {
  const weakTopics = getWeakTopicsForProfile(profileId);
  const statMap = getQuestionStatMap(stats);
  const pool = quizzes.flatMap((quiz) => quiz.questions.map((question) => {
    const stat = statMap.get(`${quiz.id}:${question.id}`);
    const attempts = stat ? stat.timesCorrect + stat.timesWrong : 0;
    const accuracy = stat ? stat.timesCorrect / Math.max(attempts, 1) : 0.55;
    const topicPenalty = weakTopics.some((topic) => (question.tags ?? []).includes(topic.topic)) ? 0.25 : 0;
    const difficultyWeight = question.difficulty === 'hard' ? 0.24 : question.difficulty === 'medium' ? 0.16 : 0.08;
    const score = (1 - accuracy) * 0.45 + topicPenalty + difficultyWeight + Math.min(attempts * 0.03, 0.18);
    return { quiz, question, score };
  }));

  const sorted = [...pool].sort((left, right) => right.score - left.score);
  const selected = sorted.slice(0, 18).map((entry) => cloneQuestion(entry.question));
  if (selected.length === 0) return null;

  const hardCount = Math.max(4, Math.floor(selected.length * 0.35));
  const mediumCount = Math.max(6, Math.floor(selected.length * 0.4));
  const easyCount = Math.max(2, selected.length - hardCount - mediumCount);

  const easy = selected.filter((question) => (question.difficulty ?? 'medium') === 'easy').slice(0, easyCount);
  const medium = selected.filter((question) => (question.difficulty ?? 'medium') === 'medium').slice(0, mediumCount);
  const hard = selected.filter((question) => (question.difficulty ?? 'medium') === 'hard').slice(0, hardCount);
  const fallback = selected.filter((question) => !easy.includes(question) && !medium.includes(question) && !hard.includes(question));
  const examQuestions = [...easy, ...medium, ...hard, ...fallback].slice(0, 18);

  return {
    id: uid(),
    title: 'Adaptive Exam Mode',
    description: 'Simulare de examen construita din istoricul tau, cu accent pe lacune si dificultate progresiva.',
    emoji: '🎓',
    color: 'purple',
    category: 'Altele',
    folderId: null,
    shuffleQuestions: false,
    shuffleAnswers: true,
    penaltyMode: true,
    tags: ['adaptive-exam', 'simulation', ...weakTopics.slice(0, 2).map((topic) => topic.topic)],
    questions: examQuestions,
    createdAt: Date.now(),
  };
}
