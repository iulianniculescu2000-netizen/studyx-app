/**
 * Per-profile data persistence.
 * Prioritizes Disk Storage (Electron) to bypass LocalStorage 5MB limit.
 */

import { useQuizStore } from './quizStore';
import { useFolderStore } from './folderStore';
import { useStatsStore } from './statsStore';
import { useNotesStore } from './notesStore';
import type { Quiz, QuizSession, Folder, QuestionStat, StudyStreak } from '../types';

const LS_KEY = (profileId: string, ns: string) => `studyx-p-${profileId}-${ns}`;

// Mutex lock to prevent overlapping disk writes
let writeLock: Promise<void> = Promise.resolve();

async function read<T>(profileId: string, ns: string, legacyKey?: string): Promise<T | null> {
  try {
    // 1. Try Disk Storage (Electron only)
    if (window.electronAPI?.storageLoad) {
      const diskData = await window.electronAPI.storageLoad(profileId, ns);
      if (diskData) return diskData as T;
    }

    // 2. Fallback to LocalStorage
    const raw = localStorage.getItem(LS_KEY(profileId, ns));
    if (raw) return JSON.parse(raw) as T;

    // 3. Legacy Migration
    if (legacyKey) {
      const legacyRaw = localStorage.getItem(legacyKey);
      if (legacyRaw) {
        const parsed = JSON.parse(legacyRaw);
        const data = parsed?.state ?? parsed;
        await write(profileId, ns, data);
        localStorage.removeItem(legacyKey);
        return data as T;
      }
    }
    return null;
  } catch {
    return null;
  }
}

async function write(profileId: string, ns: string, data: unknown) {
  const previousLock = writeLock;
  let resolveLock!: () => void;
  writeLock = new Promise<void>((resolve) => { resolveLock = resolve; });

  try {
    await previousLock;
    // 1. Try Disk Storage (Premium Path)
    if (window.electronAPI?.storageSave) {
      const success = await window.electronAPI.storageSave(profileId, ns, data);
      if (success) {
        // Clear LS to save space if disk save worked
        localStorage.removeItem(LS_KEY(profileId, ns));
        return;
      }
    }

    // 2. Fallback to LocalStorage (Browser or error)
    localStorage.setItem(LS_KEY(profileId, ns), JSON.stringify(data));
  } catch (err) {
    console.error('[Storage] Write failed:', err);
  } finally {
    resolveLock();
  }
}

/** Save all current store state for a profile */
export async function saveProfileData(profileId: string) {
  // write() internally queues operations, but Promise.all initiates them concurrently.
  // Because they write to different namespaces, concurrent writes are safe at the IPC level,
  // but the internal write() lock makes them sequential anyway.
  await Promise.all([
    write(profileId, 'quizzes', useQuizStore.getState()._snapshot()),
    write(profileId, 'folders', useFolderStore.getState()._snapshot()),
    write(profileId, 'stats', useStatsStore.getState()._snapshot()),
    write(profileId, 'notes', useNotesStore.getState()._snapshot()),
  ]);
}

/** Load store state for a profile */
export async function loadProfileData(profileId: string) {
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
}
