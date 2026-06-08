import { beforeEach, describe, expect, it } from 'vitest';
import {
  createAutoBackup,
  exportData,
  getBackupList,
  getStorageItem,
  importData,
  restoreFromBackup,
  setStorageItem,
  STORAGE_KEYS,
} from '../helpers/storage';

describe('Storage helper', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('stores and retrieves structured data', () => {
    const payload = [{ id: '1', username: 'Test User' }];

    expect(setStorageItem(STORAGE_KEYS.PROFILES, payload).success).toBe(true);

    const result = getStorageItem<typeof payload>(STORAGE_KEYS.PROFILES);
    expect(result.success).toBe(true);
    expect(result.data).toEqual(payload);
  });

  it('exports and imports a valid storage package', () => {
    setStorageItem(STORAGE_KEYS.PROFILES, [{ id: '1', username: 'Exported User' }]);

    const exported = exportData();
    expect(exported.success).toBe(true);
    expect(exported.data).toContain('"data"');

    localStorage.clear();
    const imported = importData(exported.data ?? '');
    expect(imported.success).toBe(true);
    expect(imported.imported).toContain('PROFILES');
  });

  it('creates a backup and restores it', () => {
    const profiles = [{ id: '1', username: 'Backup User' }];
    setStorageItem(STORAGE_KEYS.PROFILES, profiles);

    const backup = createAutoBackup();
    expect(backup.success).toBe(true);
    expect(backup.backupId).toBeDefined();

    setStorageItem(STORAGE_KEYS.PROFILES, []);

    const restored = restoreFromBackup(backup.backupId ?? '');
    expect(restored.success).toBe(true);

    const afterRestore = getStorageItem<typeof profiles>(STORAGE_KEYS.PROFILES);
    expect(afterRestore.data).toEqual(profiles);
  });

  it('lists created backups newest first', () => {
    setStorageItem(STORAGE_KEYS.PROFILES, [{ id: '1', username: 'Backup User' }]);
    createAutoBackup();
    createAutoBackup();

    const backups = getBackupList();
    expect(backups.length).toBeGreaterThan(0);
    expect(backups[0].timestamp).toBeGreaterThanOrEqual(backups[backups.length - 1].timestamp);
  });
});
