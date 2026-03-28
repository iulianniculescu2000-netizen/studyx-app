/**
 * rollback.ts
 *
 * Saves a full snapshot of quizzes + sessions + folders BEFORE any
 * content-update installation. The user can restore from Settings if
 * something goes wrong.
 */

const ROLLBACK_KEY = 'studyx-rollback-snapshot';

export interface RollbackSnapshot {
  savedAt: number;         // Unix ms
  label: string;           // e.g. "Înainte de instalare: Dermatologie"
  quizzes: unknown[];
  sessions: unknown[];
  folders: unknown[];
}

/** Persist snapshot to localStorage. Overwrites any previous snapshot. */
export function saveRollbackSnapshot(
  quizzes: unknown[],
  sessions: unknown[],
  folders: unknown[],
  label: string
): void {
  const snapshot: RollbackSnapshot = {
    savedAt: Date.now(),
    label,
    quizzes,
    sessions,
    folders,
  };
  try {
    localStorage.setItem(ROLLBACK_KEY, JSON.stringify(snapshot));
  } catch {
    // localStorage quota exceeded — silently skip
  }
}

/** Returns the stored snapshot, or null if none exists. */
export function getRollbackSnapshot(): RollbackSnapshot | null {
  try {
    const raw = localStorage.getItem(ROLLBACK_KEY);
    return raw ? (JSON.parse(raw) as RollbackSnapshot) : null;
  } catch {
    return null;
  }
}

/** Removes the stored snapshot (call after successful rollback or manually). */
export function clearRollbackSnapshot(): void {
  localStorage.removeItem(ROLLBACK_KEY);
}

/** Human-readable date from savedAt timestamp. */
export function formatSnapshotDate(savedAt: number): string {
  return new Date(savedAt).toLocaleString('ro-RO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
