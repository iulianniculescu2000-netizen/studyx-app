/**
 * aiContext.ts
 *
 * Builds user performance context strings injected into every AI call,
 * making responses personalized and medically targeted.
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

/**
 * Builds a full performance summary from raw statsStore data.
 * Call this once and pass to buildUserContextString + getMedicalSystemPrompt.
 */
export function buildPerformanceSummary(
  questionStats: Record<string, { timesCorrect: number; timesWrong: number }>,
  streak: { currentStreak: number },
  getDueQuestions: () => unknown[],
  getAccuracy: () => number,
  getStatsByTag: (quizzes: Quiz[]) => Record<string, { correct: number; total: number }>,
  quizzes: Quiz[]
): PerformanceSummary {
  const tagStats = getStatsByTag(quizzes);
  const totalAnswered = Object.values(questionStats)
    .reduce((sum, s) => sum + s.timesCorrect + s.timesWrong, 0);

  const topicList = Object.entries(tagStats)
    .map(([tag, s]) => ({
      tag,
      accuracy: s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0,
      total: s.total,
    }))
    .filter(t => t.total >= 3) // only topics with enough data
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

/**
 * Returns a compact context string to inject into AI system prompts.
 * Empty string if not enough data (no hallucination risk from fake stats).
 */
export function buildUserContextString(summary: PerformanceSummary): string {
  if (summary.totalAnswered === 0) return '';

  const parts: string[] = [
    `Student medical: ${summary.totalAnswered} întrebări rezolvate, acuratețe ${summary.globalAccuracy}%.`,
  ];
  if (summary.streakDays > 1) parts.push(`Streak: ${summary.streakDays} zile consecutive.`);
  if (summary.dueCount > 0) parts.push(`${summary.dueCount} de recapitulat azi (SM-2).`);
  if (summary.weakTopics.length > 0)
    parts.push(`Puncte slabe: ${summary.weakTopics.map(t => `${t.tag} ${t.accuracy}%`).join(', ')}.`);
  if (summary.strongTopics.length > 0)
    parts.push(`Puncte forte: ${summary.strongTopics.map(t => `${t.tag} ${t.accuracy}%`).join(', ')}.`);

  return parts.join(' ');
}

/**
 * Returns the appropriate medical system prompt for each AI role.
 * Optionally injects user performance context.
 *
 * Roles:
 *  - 'tutor'    → mentor medical senior (QuizDetail chat, general)
 *  - 'examiner' → examinator Rezidențiat (QuizCreate generation)
 *  - 'explainer'→ profesor care explică greșeli (QuizPlay, QuizResults)
 *  - 'advisor'  → consilier studiu personalizat (Dashboard)
 */
export function getMedicalSystemPrompt(
  role: 'tutor' | 'examiner' | 'explainer' | 'advisor',
  userContext?: string
): string {
  const base: Record<string, string> = {
    tutor:
      'Ești un mentor medical senior pentru studenți la medicină și rezidenți din România. ' +
      'Explici cu precizie clinică folosind terminologie medicală românească. ' +
      'Răspunsuri concise (max 5 fraze), clare, memorabile. ' +
      'Când e cazul, menționezi referința din Harrison, Gomella sau ghiduri europene.',

    examiner:
      'Ești un examinator medical expert specializat în Rezidențiat și Licență medicală din România. ' +
      'Creezi întrebări cu capcane subtile, diagnostice diferențiale relevante, situații clinice realiste. ' +
      'Respecti structura examenului românesc: 4 variante, 1 singur corect, dificultate graduală. ' +
      'Referințe standard: Harrison\'s Principles, Gomella, ghiduri europene (ESC, ERS, EASL).',

    explainer:
      'Ești un profesor de medicină clinică. Explici DE CE un răspuns este corect sau greșit: ' +
      'mecanismul patogenetic, semnificația clinică, de ce distractorii sunt incorecți. ' +
      'Limbă română, max 4 fraze, precise și memorabile. ' +
      'Nu repeta întrebarea. Mergi direct la explicație.',

    advisor:
      'Ești un consilier de studiu medical personalizat pentru studenți din România care se pregătesc de Rezidențiat. ' +
      'Analizezi performanța și dai recomandări concrete, specifice, acționabile. ' +
      'Ton: direct, motivant, realist. Max 2-3 fraze scurte. ' +
      'Nu generaliza — fii specific la topicurile slabe din profilul studentului.',
  };

  const prompt = base[role] ?? base.tutor;
  if (userContext && userContext.trim().length > 20) {
    return `${prompt}\n\nPROFIL STUDENT: ${userContext}`;
  }
  return prompt;
}
