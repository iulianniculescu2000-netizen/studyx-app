import { create } from 'zustand';
import type { Quiz, QuizSession } from '../types';

function uid() { return crypto.randomUUID().replace(/-/g, '').slice(0, 12); }

interface QuizStore {
  quizzes: Quiz[];
  sessions: QuizSession[];
  _hasHydrated: boolean;
  addQuiz: (quiz: Quiz) => void;
  updateQuiz: (id: string, updates: Partial<Quiz>) => void;
  deleteQuiz: (id: string) => void;
  duplicateQuiz: (id: string) => string | null;
  togglePin: (id: string) => void;
  toggleArchive: (id: string) => void;
  moveToFolder: (quizId: string, folderId: string | null) => void;
  addSession: (session: QuizSession) => void;
  getSessionsForQuiz: (quizId: string) => QuizSession[];
  getBestScore: (quizId: string) => number | null;
  getQuizzesByFolder: (folderId: string | null) => Quiz[];
  bulkDeleteQuizzes: (ids: string[]) => void;
  bulkMoveToFolder: (ids: string[], folderId: string | null) => void;
  cleanupOrphanImages: () => void;
  _hydrate: (data: { quizzes: Quiz[]; sessions: QuizSession[] }) => void;
  _snapshot: () => { quizzes: Quiz[]; sessions: QuizSession[] };
}

export const useQuizStore = create<QuizStore>()(
  (set, get) => ({
    quizzes: [],
    sessions: [],
    _hasHydrated: false,

    addQuiz: (quiz) => set((s) => ({ quizzes: [quiz, ...s.quizzes] })),

    updateQuiz: (id, updates) =>
      set((s) => ({
        quizzes: s.quizzes.map((q) => q.id === id ? { ...q, ...updates, updatedAt: Date.now() } : q),
      })),

    deleteQuiz: (id) =>
      set((s) => ({ quizzes: s.quizzes.filter((q) => q.id !== id) })),

    duplicateQuiz: (id) => {
      const original = get().quizzes.find((q) => q.id === id);
      if (!original) return null;
      const newId = uid();
      const copy: Quiz = {
        ...original,
        id: newId,
        title: `Copie — ${original.title}`,
        createdAt: Date.now(),
        updatedAt: undefined,
        questions: original.questions.map((q) => ({
          ...q,
          id: uid(),
        })),
      };
      set((s) => ({ quizzes: [copy, ...s.quizzes] }));
      return newId;
    },

    togglePin: (id) =>
      set((s) => ({
        quizzes: s.quizzes.map((q) => q.id === id ? { ...q, pinned: !q.pinned } : q),
      })),

    toggleArchive: (id) =>
      set((s) => ({
        quizzes: s.quizzes.map((q) => q.id === id
          ? { ...q, archived: !q.archived, pinned: q.archived ? q.pinned : false }
          : q),
      })),

    moveToFolder: (quizId, folderId) =>
      set((s) => ({
        quizzes: s.quizzes.map((q) => q.id === quizId ? { ...q, folderId } : q),
      })),

    addSession: (session) =>
      set((s) => ({ sessions: [session, ...s.sessions] })),

    getSessionsForQuiz: (quizId) =>
      get().sessions.filter((s) => s.quizId === quizId),

    getBestScore: (quizId) => {
      const sessions = get().sessions.filter((s) => s.quizId === quizId);
      if (!sessions.length) return null;
      return Math.max(...sessions.map((s) => Math.round((s.score / s.total) * 100)));
    },

    getQuizzesByFolder: (folderId) =>
      get().quizzes.filter((q) => {
        if (folderId === null) return !q.folderId;
        return q.folderId === folderId;
      }),

    bulkDeleteQuizzes: (ids) =>
      set((s) => ({ quizzes: s.quizzes.filter((q) => !ids.includes(q.id)) })),

    bulkMoveToFolder: (ids, folderId) =>
      set((s) => ({
        quizzes: s.quizzes.map((q) => ids.includes(q.id) ? { ...q, folderId } : q),
      })),

    cleanupOrphanImages: () => {
      // Images stored as base64 in questions — no action needed for orphan cleanup
      // since images are embedded directly in question data
      // This is a no-op stub for API compatibility
    },

    _hydrate: (data) => set({ quizzes: data.quizzes ?? [], sessions: data.sessions ?? [], _hasHydrated: true }),
    _snapshot: () => ({ quizzes: get().quizzes, sessions: get().sessions }),
  })
);
