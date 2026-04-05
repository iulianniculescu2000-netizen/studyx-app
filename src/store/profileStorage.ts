/**
 * Per-profile data persistence.
 * Prioritizes Disk Storage (Electron) to bypass LocalStorage 5MB limit.
 */

import { useQuizStore } from './quizStore';
import { useFolderStore } from './folderStore';
import { useStatsStore } from './statsStore';
import { useNotesStore } from './notesStore';
import type { Quiz, QuizSession, Folder, QuestionStat, StudyStreak } from '../types';
import { useSaveStatusStore } from './saveStatusStore';
import { useToastStore } from './toastStore';

const LS_KEY = (profileId: string, ns: string) => `studyx-p-${profileId}-${ns}`;
type ProfileNamespace = 'quizzes' | 'folders' | 'stats' | 'notes';
const CORRUPT_TOAST_ID = 'profile-storage-corrupt';
type LoadMarker<T> = T & { __corrupt?: boolean; __namespace?: string };

// Mutex lock to prevent overlapping disk writes
let writeLock: Promise<void> = Promise.resolve();
const lastSerializedSnapshot = new Map<string, string>();

function snapshotFor(namespace: ProfileNamespace) {
  switch (namespace) {
    case 'quizzes':
      return useQuizStore.getState()._snapshot();
    case 'folders':
      return useFolderStore.getState()._snapshot();
    case 'stats':
      return useStatsStore.getState()._snapshot();
    case 'notes':
      return useNotesStore.getState()._snapshot();
  }
}

function isQuizSnapshot(value: unknown): value is { quizzes: Quiz[]; sessions: QuizSession[] } {
  if (!value || typeof value !== 'object') return false;
  const data = value as Record<string, unknown>;
  return Array.isArray(data.quizzes) && Array.isArray(data.sessions);
}

function isFolderSnapshot(value: unknown): value is { folders: Folder[] } {
  if (!value || typeof value !== 'object') return false;
  return Array.isArray((value as Record<string, unknown>).folders);
}

function isStatsSnapshot(value: unknown): value is { questionStats: Record<string, QuestionStat>; streak: StudyStreak; totalStudyTime: number } {
  if (!value || typeof value !== 'object') return false;
  const data = value as Record<string, unknown>;
  const streak = data.streak as Record<string, unknown> | undefined;
  return !!streak
    && typeof data.questionStats === 'object'
    && typeof data.totalStudyTime === 'number'
    && typeof streak.currentStreak === 'number'
    && typeof streak.longestStreak === 'number'
    && typeof streak.lastStudyDate === 'string'
    && Array.isArray(streak.studyDates);
}

function isNotesSnapshot(value: unknown): value is { notes: Record<string, string> } {
  if (!value || typeof value !== 'object') return false;
  const notes = (value as Record<string, unknown>).notes;
  return !!notes && typeof notes === 'object' && !Array.isArray(notes);
}

function validateSnapshot<T>(namespace: ProfileNamespace, data: unknown): T | null {
  switch (namespace) {
    case 'quizzes':
      return (isQuizSnapshot(data) ? data : null) as T | null;
    case 'folders':
      return (isFolderSnapshot(data) ? data : null) as T | null;
    case 'stats':
      return (isStatsSnapshot(data) ? data : null) as T | null;
    case 'notes':
      return (isNotesSnapshot(data) ? data : null) as T | null;
  }
}

async function read<T>(profileId: string, ns: string, legacyKey?: string): Promise<T | null> {
  try {
    // 1. Try Disk Storage (Electron only)
    if (window.electronAPI?.storageLoad) {
      const diskData = await window.electronAPI.storageLoad(profileId, ns) as LoadMarker<unknown> | null;
      if (diskData?.__corrupt) {
        useSaveStatusStore.getState().setRecovering('Recuperam datele profilului');
        useToastStore.getState().upsertToast(CORRUPT_TOAST_ID, `Am detectat un fisier corupt in ${diskData.__namespace ?? ns}. Am revenit la o copie sigura.`, 'warning', 5200);
        return null;
      }
      if (diskData) {
        const validated = validateSnapshot<T>(ns as ProfileNamespace, diskData);
        if (validated) return validated;
      }
    }

    // 2. Fallback to LocalStorage
    const raw = localStorage.getItem(LS_KEY(profileId, ns));
    if (raw) {
      const parsed = JSON.parse(raw);
      const validated = validateSnapshot<T>(ns as ProfileNamespace, parsed);
      if (validated) return validated;
      localStorage.removeItem(LS_KEY(profileId, ns));
    }

    // 3. Legacy Migration
    if (legacyKey) {
      const legacyRaw = localStorage.getItem(legacyKey);
      if (legacyRaw) {
        const parsed = JSON.parse(legacyRaw);
        const data = parsed?.state ?? parsed;
        const validated = validateSnapshot<T>(ns as ProfileNamespace, data);
        if (validated) {
          await write(profileId, ns, validated);
          localStorage.removeItem(legacyKey);
          return validated;
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

async function write(profileId: string, ns: string, data: unknown) {
  const serialized = JSON.stringify(data);
  const cacheKey = `${profileId}:${ns}`;
  if (lastSerializedSnapshot.get(cacheKey) === serialized) return;
  useSaveStatusStore.getState().setSaving();

  const previousLock = writeLock;
  let resolveLock!: () => void;
  writeLock = new Promise<void>((resolve) => { resolveLock = resolve; });

  try {
    await previousLock;
    // 1. Try Disk Storage (Premium Path)
    if (window.electronAPI?.storageSave) {
      const success = await window.electronAPI.storageSave(profileId, ns, data);
      if (success) {
        lastSerializedSnapshot.set(cacheKey, serialized);
        // Clear LS to save space if disk save worked
        localStorage.removeItem(LS_KEY(profileId, ns));
        useSaveStatusStore.getState().setSaved();
        return;
      }
    }

    // 2. Fallback to LocalStorage (Browser or error)
    localStorage.setItem(LS_KEY(profileId, ns), serialized);
    lastSerializedSnapshot.set(cacheKey, serialized);
    useSaveStatusStore.getState().setSaved('Salvat local');
  } catch (err) {
    console.error('[Storage] Write failed:', err);
    useSaveStatusStore.getState().setError('Eroare la salvare');
  } finally {
    resolveLock();
  }
}

export async function saveProfileNamespace(profileId: string, namespace: ProfileNamespace) {
  await write(profileId, namespace, snapshotFor(namespace));
}

/** Save all current store state for a profile */
export async function saveProfileData(profileId: string) {
  await Promise.all([
    saveProfileNamespace(profileId, 'quizzes'),
    saveProfileNamespace(profileId, 'folders'),
    saveProfileNamespace(profileId, 'stats'),
    saveProfileNamespace(profileId, 'notes'),
  ]);
}

/** Load store state for a profile */
export async function loadProfileData(profileId: string) {
  useSaveStatusStore.getState().setRecovering('Incarcam profilul');
  const [quizData, folderData, statsData, notesData] = await Promise.all([
    read<{ quizzes: Quiz[]; sessions: QuizSession[] }>(profileId, 'quizzes', 'studyx-quizzes-v3'),
    read<{ folders: Folder[] }>(profileId, 'folders', 'studyx-folders-v2'),
    read<{ questionStats: Record<string, QuestionStat>; streak: StudyStreak; totalStudyTime: number }>(profileId, 'stats', 'studyx-stats'),
    read<{ notes: Record<string, string> }>(profileId, 'notes', 'studyx-notes'),
  ]);

  useQuizStore.getState()._hydrate(quizData ?? { quizzes: [], sessions: [] });
  useFolderStore.getState()._hydrate(folderData ?? { folders: [] });
  useStatsStore.getState()._hydrate(statsData ?? { 
    questionStats: {}, 
    streak: { currentStreak: 0, longestStreak: 0, lastStudyDate: '', studyDates: [] }, 
    totalStudyTime: 0 
  });
  useNotesStore.getState()._hydrate(notesData ?? { notes: {} });

  lastSerializedSnapshot.set(`${profileId}:quizzes`, JSON.stringify(quizData ?? { quizzes: [], sessions: [] }));
  lastSerializedSnapshot.set(`${profileId}:folders`, JSON.stringify(folderData ?? { folders: [] }));
  lastSerializedSnapshot.set(`${profileId}:stats`, JSON.stringify(statsData ?? {
    questionStats: {},
    streak: { currentStreak: 0, longestStreak: 0, lastStudyDate: '', studyDates: [] },
    totalStudyTime: 0,
  }));
  lastSerializedSnapshot.set(`${profileId}:notes`, JSON.stringify(notesData ?? { notes: {} }));
  useSaveStatusStore.getState().setSaved('Profil sincronizat');
}
