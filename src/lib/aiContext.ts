/**
 * aiContext.ts
 *
 * Construiește contextul de performanță al utilizatorului pentru apelurile AI,
 * astfel încât răspunsurile să fie mai bine adaptate și mai utile pentru studiu.
 */
import type { Quiz } from '../types';

export interface PerformanceSummary {
  totalAnswered: number;
  globalAccuracy: number;
  dueCount: number;
  weakTopics: { tag: string; accuracy: number }[];
  strongTopics: { tag: string; accuracy: number }[];
  streakDays: number;
}

export function buildPerformanceSummary(
  questionStats: Record<string, { timesCorrect: number; timesWrong: number }>,
  streak: { currentStreak: number },
  getDueQuestions: () => unknown[],
  getAccuracy: () => number,
  getStatsByTag: (quizzes: Quiz[]) => Record<string, { correct: number; total: number }>,
  quizzes: Quiz[],
): PerformanceSummary {
  const tagStats = getStatsByTag(quizzes);
  const totalAnswered = Object.values(questionStats)
    .reduce((sum, stats) => sum + stats.timesCorrect + stats.timesWrong, 0);

  const topicList = Object.entries(tagStats)
    .map(([tag, stats]) => ({
      tag,
      accuracy: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0,
      total: stats.total,
    }))
    .filter((topic) => topic.total >= 3)
    .sort((a, b) => a.accuracy - b.accuracy);

  return {
    totalAnswered,
    globalAccuracy: getAccuracy(),
    dueCount: getDueQuestions().length,
    weakTopics: topicList.slice(0, 3),
    strongTopics: topicList.slice(-3).reverse(),
    streakDays: streak?.currentStreak ?? 0,
  };
}

export function buildUserContextString(summary: PerformanceSummary): string {
  if (summary.totalAnswered === 0) return '';

  const parts: string[] = [
    `Student medical: ${summary.totalAnswered} întrebări rezolvate, acuratețe ${summary.globalAccuracy}%.`,
  ];

  if (summary.streakDays > 0) {
    parts.push(`Streak curent: ${summary.streakDays} ${summary.streakDays === 1 ? 'zi' : 'zile'} consecutive.`);
  }

  if (summary.dueCount > 0) {
    parts.push(`${summary.dueCount} itemi sunt programați pentru recapitulare azi.`);
  }

  if (summary.weakTopics.length > 0) {
    parts.push(`Puncte slabe: ${summary.weakTopics.map((topic) => `${topic.tag} ${topic.accuracy}%`).join(', ')}.`);
  }

  if (summary.strongTopics.length > 0) {
    parts.push(`Puncte forte: ${summary.strongTopics.map((topic) => `${topic.tag} ${topic.accuracy}%`).join(', ')}.`);
  }

  if (summary.globalAccuracy >= 80) {
    parts.push('Poți susține întrebări mai provocatoare și sinteze mai dense.');
  } else if (summary.globalAccuracy < 55) {
    parts.push('Ajută mai mult explicațiile etapizate, recapitularea scurtă și verificările frecvente.');
  }

  return parts.join(' ');
}

export function getMedicalSystemPrompt(
  role: 'tutor' | 'examiner' | 'explainer' | 'advisor',
  userContext?: string,
): string {
  const base: Record<string, string> = {
    tutor:
      'Ești un mentor medical senior pentru studenți la medicină și rezidenți din România. ' +
      'Explici cu precizie clinică, folosind terminologie medicală românească și structură clară. ' +
      'Răspunsurile sunt concise, memorabile și bine organizate. ' +
      'Când este util, menționezi referințe precum Harrison, Gomella sau ghiduri europene.',

    examiner:
      'Ești un examinator medical expert, specializat în Rezidențiat și licență medicală în România. ' +
      'Creezi întrebări cu capcane corecte, diferențiale relevante și scenarii clinice plauzibile. ' +
      'Respecți structura clară a grilei și gradarea dificultății.',

    explainer:
      'Ești un profesor de medicină clinică. Explici de ce un răspuns este corect sau greșit, ' +
      'care este mecanismul-cheie și de ce distractorii nu se potrivesc. ' +
      'Răspunzi direct, în română, fără introduceri inutile.',

    advisor:
      'Ești un consilier de studiu medical personalizat pentru studenți din România care se pregătesc pentru examen. ' +
      'Analizezi performanța și oferi recomandări concrete, specifice și ușor de aplicat. ' +
      'Tonul este motivant, realist și orientat pe progres.',
  };

  const prompt = base[role] ?? base.tutor;
  if (userContext && userContext.trim().length > 20) {
    return `${prompt}\n\nPROFIL STUDENT:\n${userContext}`;
  }

  return prompt;
}
