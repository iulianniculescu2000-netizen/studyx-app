import type { Folder, Quiz, QuestionStat, QuizSession } from '../types';
import { isRezidentiatQuiz } from './rezidentiatBank';
import { findRezidentiatRootFolder } from './rezidentiatRoot';

export interface SpecialtyOverview {
  folder: Folder;
  quizzes: Quiz[];
  questionCount: number;
  answered: number;
  /** Rounded 0–100 share of this specialty's questions answered at least once. */
  progress: number;
}

export interface DisciplineOverview {
  folder: Folder;
  specialties: SpecialtyOverview[];
  quizCount: number;
  questionCount: number;
  answered: number;
  progress: number;
}

export interface ResumeTarget {
  quiz: Quiz;
  disciplineId: string | null;
  lastPlayedAt: number;
}

export interface RezidentiatOverview {
  disciplines: DisciplineOverview[];
  totalQuestions: number;
  totalSpecialties: number;
  resume: ResumeTarget | null;
}

const percent = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

/** Natural order so "Test 2" sorts before "Test 10". */
const byTitle = (a: Quiz, b: Quiz) => a.title.localeCompare(b.title, 'ro', { numeric: true });

/**
 * Derives the Rezidențiat → discipline → specialty tree straight from the
 * folders the bank importer already builds, plus how much of it the user has
 * touched (a question counts once it has any recorded attempt).
 */
export function buildRezidentiatOverview(
  folders: Folder[],
  quizzes: Quiz[],
  questionStats: Record<string, QuestionStat>,
  sessions: QuizSession[],
): RezidentiatOverview {
  const root = findRezidentiatRootFolder(folders);
  if (!root) return { disciplines: [], totalQuestions: 0, totalSpecialties: 0, resume: null };

  const bankQuizzes = quizzes.filter((q) => !q.archived && q.kind !== 'flashcard' && isRezidentiatQuiz(q));
  const quizzesByFolder = new Map<string, Quiz[]>();
  for (const quiz of bankQuizzes) {
    if (!quiz.folderId) continue;
    const list = quizzesByFolder.get(quiz.folderId) ?? [];
    list.push(quiz);
    quizzesByFolder.set(quiz.folderId, list);
  }

  const answeredIn = (quiz: Quiz) =>
    quiz.questions.reduce((sum, question) => {
      const stat = questionStats[`${quiz.id}:${question.id}`];
      return sum + (stat && stat.timesCorrect + stat.timesWrong > 0 ? 1 : 0);
    }, 0);

  const disciplines: DisciplineOverview[] = folders
    .filter((f) => f.parentId === root.id)
    .map((disciplineFolder) => {
      const specialties: SpecialtyOverview[] = folders
        .filter((f) => f.parentId === disciplineFolder.id)
        .map((specialtyFolder) => {
          const list = (quizzesByFolder.get(specialtyFolder.id) ?? []).slice().sort(byTitle);
          const questionCount = list.reduce((sum, q) => sum + q.questions.length, 0);
          const answered = list.reduce((sum, q) => sum + answeredIn(q), 0);
          return { folder: specialtyFolder, quizzes: list, questionCount, answered, progress: percent(answered, questionCount) };
        })
        .filter((s) => s.quizzes.length > 0)
        .sort((a, b) => a.folder.name.localeCompare(b.folder.name, 'ro'));
      const questionCount = specialties.reduce((sum, s) => sum + s.questionCount, 0);
      const answered = specialties.reduce((sum, s) => sum + s.answered, 0);
      return {
        folder: disciplineFolder,
        specialties,
        quizCount: specialties.reduce((sum, s) => sum + s.quizzes.length, 0),
        questionCount,
        answered,
        progress: percent(answered, questionCount),
      };
    })
    .filter((d) => d.specialties.length > 0)
    .sort((a, b) => a.folder.name.localeCompare(b.folder.name, 'ro'));

  const quizById = new Map(bankQuizzes.map((q) => [q.id, q]));
  const disciplineOfFolder = new Map<string, string>();
  for (const discipline of disciplines) {
    for (const specialty of discipline.specialties) disciplineOfFolder.set(specialty.folder.id, discipline.folder.id);
  }
  let resume: ResumeTarget | null = null;
  for (const session of sessions) {
    const quiz = quizById.get(session.quizId);
    if (!quiz) continue;
    const at = session.finishedAt ?? session.startedAt;
    if (!resume || at > resume.lastPlayedAt) {
      resume = { quiz, disciplineId: quiz.folderId ? disciplineOfFolder.get(quiz.folderId) ?? null : null, lastPlayedAt: at };
    }
  }

  return {
    disciplines,
    totalQuestions: disciplines.reduce((sum, d) => sum + d.questionCount, 0),
    totalSpecialties: disciplines.reduce((sum, d) => sum + d.specialties.length, 0),
    resume,
  };
}

type DisciplineId = 'chirurgie' | 'medicina-interna';

const plain = (value: string) => value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Which discipline a reference book belongs to, by its name — null when it spans several (e.g. Sinopsis). */
export function bookDisciplineHint(bookName: string): DisciplineId | null {
  const name = plain(bookName);
  if (/lawrence|chirurg/.test(name)) return 'chirurgie';
  if (/kumar|clark|medicina intern/.test(name)) return 'medicina-interna';
  return null;
}

/** The same key for a discipline folder name, so books and folders compare without diacritics. */
export function disciplineKey(name: string): DisciplineId | null {
  const n = plain(name);
  if (/chirurg/.test(n)) return 'chirurgie';
  if (/medicina intern/.test(n)) return 'medicina-interna';
  return null;
}
