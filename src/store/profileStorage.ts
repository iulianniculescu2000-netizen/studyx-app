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
const QUOTA_TOAST_ID = 'profile-storage-quota';
const QUARANTINE_SUFFIX = '__corrupt-';
/** How many quarantined copies to keep per namespace before pruning the oldest. */
const QUARANTINE_KEEP = 3;
type LoadMarker<T> = T & { __corrupt?: boolean; __namespace?: string };

export type ProfileStorageErrorKind = 'quota' | 'unknown';

/**
 * Thrown when a save did not reach storage. This exists so a failed write can
 * never be mistaken for a successful one: callers that import data need to know
 * the work is still only in memory.
 */
export class ProfileStorageError extends Error {
  readonly kind: ProfileStorageErrorKind;
  readonly namespace: string;

  constructor(kind: ProfileStorageErrorKind, namespace: string, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'ProfileStorageError';
    this.kind = kind;
    this.namespace = namespace;
  }
}

export function isProfileStorageError(value: unknown): value is ProfileStorageError {
  return value instanceof ProfileStorageError;
}

function classifyWriteError(err: unknown): ProfileStorageErrorKind {
  const name = (err as { name?: string } | null)?.name ?? '';
  const message = String((err as { message?: string } | null)?.message ?? '');
  // Browsers disagree on the name; Firefox uses NS_ERROR_DOM_QUOTA_REACHED.
  if (/quota/i.test(name) || /quota/i.test(message) || name === 'NS_ERROR_DOM_QUOTA_REACHED') {
    return 'quota';
  }
  return 'unknown';
}

/** Every quarantined blob currently held for a profile, newest first. */
export function listQuarantinedKeys(profileId: string): string[] {
  const prefix = `studyx-p-${profileId}-`;
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (key && key.startsWith(prefix) && key.includes(QUARANTINE_SUFFIX)) keys.push(key);
  }
  return keys.sort().reverse();
}

/**
 * Copies a blob we could not read to a timestamped backup key.
 *
 * The original is deliberately left in place: if this copy fails (we may be out
 * of space, which is how the app got into trouble in the first place), the only
 * remaining copy must not be one we just deleted. Autosave may later overwrite
 * the original, and that is exactly what the backup is here to survive.
 */
function quarantine(profileId: string, ns: string, raw: string) {
  try {
    localStorage.setItem(`${LS_KEY(profileId, ns)}${QUARANTINE_SUFFIX}${Date.now()}`, raw);
    const mine = listQuarantinedKeys(profileId).filter((key) => key.startsWith(`${LS_KEY(profileId, ns)}${QUARANTINE_SUFFIX}`));
    mine.slice(QUARANTINE_KEEP).forEach((key) => localStorage.removeItem(key));
  } catch {
    // Out of space — the untouched original is still the best copy we have.
  }
  useToastStore.getState().upsertToast(
    CORRUPT_TOAST_ID,
    `Datele „${ns}" nu au putut fi citite. Am pastrat o copie de siguranta si am pornit de la zero pentru aceasta sectiune.`,
    'warning',
    9000,
  );
}

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
        // Deliberately NOT returning here: the localStorage copy below is often
        // intact, and bailing out early turned a recoverable disk problem into
        // an empty profile.
        useSaveStatusStore.getState().setRecovering('Recuperam datele profilului');
        useToastStore.getState().upsertToast(CORRUPT_TOAST_ID, `Am detectat un fisier corupt in ${diskData.__namespace ?? ns}. Incerc copia locala.`, 'warning', 5200);
      } else if (diskData) {
        const validated = validateSnapshot<T>(ns as ProfileNamespace, diskData);
        if (validated) return validated;
      }
    }

    // 2. Fallback to LocalStorage
    const raw = localStorage.getItem(LS_KEY(profileId, ns));
    if (raw) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        // Unreadable, but not worthless — keep the bytes for recovery.
        quarantine(profileId, ns, raw);
        parsed = undefined;
      }
      if (parsed !== undefined) {
        const validated = validateSnapshot<T>(ns as ProfileNamespace, parsed);
        if (validated) return validated;
        // Parsed fine but doesn't match the expected shape (e.g. a schema
        // change). Previously this was deleted outright.
        quarantine(profileId, ns, raw);
      }
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
      const success = await window.electronAPI.storageSave(profileId, ns, serialized);
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
    const kind = classifyWriteError(err);
    useSaveStatusStore.getState().setError(
      kind === 'quota' ? 'Spatiu insuficient — NU s-a salvat' : 'Eroare la salvare',
    );
    // The save-status pill clears itself after ~3s, which is far too quiet for
    // "your work is not on disk". Losing data deserves a toast that stays put.
    useToastStore.getState().upsertToast(
      QUOTA_TOAST_ID,
      kind === 'quota'
        ? 'Spatiul de stocare al browserului este plin. Modificarile NU au fost salvate — elibereaza spatiu sau foloseste aplicatia de desktop.'
        : 'Salvarea a esuat. Modificarile sunt doar in memorie — nu inchide aplicatia pana nu reusesti sa salvezi.',
      'error',
      30_000,
    );
    // Rethrow so importers and profile swaps can no longer mistake a failed
    // write for a successful one.
    throw new ProfileStorageError(kind, ns, `Nu am putut salva "${ns}".`, { cause: err });
  } finally {
    resolveLock();
  }
}

export async function saveProfileNamespace(profileId: string, namespace: ProfileNamespace) {
  await write(profileId, namespace, snapshotFor(namespace));
}

/**
 * Synchronous, best-effort flush of every namespace straight to localStorage.
 *
 * The normal path (`write()`) always crosses at least one microtask boundary
 * (`await previousLock` yields even when the lock is already resolved), and on
 * top of that autosave itself waits 2.8s debounce + up to 2.4s of idle-task
 * deferral before it even attempts a write (`useProfileLifecycle.ts`) — a
 * multi-second window where a recent change (e.g. a quiz the AI agent just
 * created) exists only in memory. `pagehide`/`visibilitychange` handlers fire
 * on reload/close, but the browser does not wait for async work started in
 * them to finish, so the async flush they trigger is not a reliable safety
 * net on its own. This bypasses the lock, the Electron disk-save round trip,
 * and the unchanged-snapshot dedupe check — call it first, synchronously,
 * before doing anything else in an unload handler; the (still-async)
 * `saveProfileData` can run after for its normal error toasts / disk save,
 * since the matching cached snapshot makes it a no-op if this already wrote
 * the same data.
 */
export function flushProfileDataSync(profileId: string) {
  const namespaces: ProfileNamespace[] = ['quizzes', 'folders', 'stats', 'notes'];
  for (const ns of namespaces) {
    try {
      const serialized = JSON.stringify(snapshotFor(ns));
      const cacheKey = `${profileId}:${ns}`;
      if (lastSerializedSnapshot.get(cacheKey) === serialized) continue;
      localStorage.setItem(LS_KEY(profileId, ns), serialized);
      lastSerializedSnapshot.set(cacheKey, serialized);
    } catch (err) {
      // Best-effort on the way out — nothing more we can do synchronously;
      // the async path still surfaces quota/write errors during normal use.
      console.error(`[Storage] Sync flush failed for "${ns}":`, err);
    }
  }
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
