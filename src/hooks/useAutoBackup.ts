import { useEffect } from 'react';

const BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours (Daily)
const LAST_BACKUP_KEY = 'studyx-last-auto-backup';

/**
 * Runs a weekly auto-backup of all localStorage data to
 * Documents/StudyX-Backups (Electron only).
 * The backup is triggered once per week, on app startup.
 *
 * @param activeProfileId – backup only fires when a profile is active
 */
export function useAutoBackup(activeProfileId: string | null) {
  useEffect(() => {
    if (!activeProfileId) return;

    if (!window.electronAPI?.autoBackup) return; // not Electron
    const electronAPI = window.electronAPI;

    const lastBackup = parseInt(localStorage.getItem(LAST_BACKUP_KEY) ?? '0', 10);
    const now = Date.now();

    if (now - lastBackup < BACKUP_INTERVAL_MS) return; // not yet due

    // Collect all StudyX localStorage keys
    const snapshot: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('studyx')) {
        const val = localStorage.getItem(key);
        if (val) snapshot[key] = val;
      }
    }

    const payload = JSON.stringify({
      exportedAt: new Date().toISOString(),
      appVersion: '1.0.0',
      profileId: activeProfileId,
      stores: snapshot,
    }, null, 2);

    electronAPI.autoBackup(payload)
      .then((result) => {
        if (result.success) {
          localStorage.setItem(LAST_BACKUP_KEY, String(now));
          console.info('[StudyX] Auto-backup saved to', result.path);
        } else {
          console.warn('[StudyX] Auto-backup failed:', result.error);
        }
      })
      .catch((e: unknown) => console.warn('[StudyX] Auto-backup error:', e));
  }, [activeProfileId]);
}
