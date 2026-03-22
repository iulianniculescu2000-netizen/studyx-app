/**
 * Per-profile data persistence.
 * Each profile gets its own localStorage keys for quizzes, folders, stats, notes.
 * Migration: on first load for a profile, reads from the old global keys.
 */

import { useQuizStore } from './quizStore';
import { useFolderStore } from './folderStore';
import { useStatsStore } from './statsStore';
import { useNotesStore } from './notesStore';

const key = (profileId: string, ns: string) => `studyx-p-${profileId}-${ns}`;

function read<T>(profileId: string, ns: string, legacyKey?: string): T | null {
  try {
    // Try profile-specific key first
    const raw = localStorage.getItem(key(profileId, ns));
    if (raw) return JSON.parse(raw) as T;
    // One-time migration from old global key — consumed and deleted immediately
    // so new profiles never inherit another profile's data
    if (legacyKey) {
      const legacyRaw = localStorage.getItem(legacyKey);
      if (legacyRaw) {
        const parsed = JSON.parse(legacyRaw);
        const data = parsed?.state ?? parsed;
        // Write to profile key so next load uses the profile-specific key
        write(profileId, ns, data);
        // Delete legacy key — only one profile should ever get this data
        localStorage.removeItem(legacyKey);
        return data as T;
      }
    }
    return null;
  } catch {
    return null;
  }
}

function write(profileId: string, ns: string, data: unknown) {
  try {
    localStorage.setItem(key(profileId, ns), JSON.stringify(data));
  } catch {
    // Storage quota exceeded — ignore
  }
}

/** Save all current store state for a profile */
export function saveProfileData(profileId: string) {
  write(profileId, 'quizzes', useQuizStore.getState()._snapshot());
  write(profileId, 'folders', useFolderStore.getState()._snapshot());
  write(profileId, 'stats', useStatsStore.getState()._snapshot());
  write(profileId, 'notes', useNotesStore.getState()._snapshot());
}

/** Load store state for a profile (migrates from old keys if needed) */
export function loadProfileData(profileId: string) {
  const quizData = read<{ quizzes: any[]; sessions: any[] }>(
    profileId, 'quizzes', 'studyx-quizzes-v3'
  );
  useQuizStore.getState()._hydrate(quizData ?? { quizzes: [], sessions: [] });

  const folderData = read<{ folders: any[] }>(
    profileId, 'folders', 'studyx-folders-v2'
  );
  useFolderStore.getState()._hydrate(folderData ?? { folders: [] });

  const statsData = read<{ questionStats: any; streak: any; totalStudyTime: number }>(
    profileId, 'stats', 'studyx-stats'
  );
  useStatsStore.getState()._hydrate(statsData ?? { questionStats: {}, streak: { currentStreak: 0, longestStreak: 0, lastStudyDate: '', studyDates: [] }, totalStudyTime: 0 });

  const notesData = read<{ notes: Record<string, string> }>(
    profileId, 'notes', 'studyx-notes'
  );
  useNotesStore.getState()._hydrate(notesData ?? { notes: {} });
}
