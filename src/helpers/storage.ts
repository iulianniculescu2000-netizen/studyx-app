/**
 * Storage Helper - Management storage pentru StudyX
 * Backup, restore, cleanup automat \u0219i storage quota management
 */


// Storage keys
export const STORAGE_KEYS = {
  PROFILES: 'studyx-profiles',
  QUIZZES: 'studyx-quizzes',
  STATS: 'studyx-stats',
  SETTINGS: 'studyx-settings',
  AI_CACHE: 'studyx-ai-cache',
  BACKUPS: 'studyx-backups',
  LAST_BACKUP: 'studyx-last-backup',
  STORAGE_INFO: 'studyx-storage-info'
} as const;

// Storage limits (in bytes)
export const STORAGE_LIMITS = {
  MAX_TOTAL_SIZE: 50 * 1024 * 1024, // 50MB
  MAX_SINGLE_ITEM: 5 * 1024 * 1024, // 5MB
  MAX_BACKUPS: 10,
  MAX_CACHE_SIZE: 10 * 1024 * 1024 // 10MB
} as const;

// Backup metadata
interface BackupMetadata {
  id: string;
  timestamp: number;
  version: string;
  size: number;
  type: 'manual' | 'auto';
  description?: string;
  itemCounts: {
    profiles: number;
    quizzes: number;
    stats: number;
  };
}

// Backup data structure
interface BackupData {
  metadata: BackupMetadata;
  data: Record<string, unknown>;
}

// Last backup structure
interface LastBackup {
  id: string;
  timestamp: number;
}

/**
 * Ob\u021bine dimensiunea unui item în bytes
 */
export function getItemSize(item: unknown): number {
  try {
    return new Blob([JSON.stringify(item)]).size;
  } catch {
    return 0;
  }
}

/**
 * Ob\u021bine informa\u021bii despre storage
 */
export function getStorageInfo(): {
  totalSize: number;
  itemCounts: Record<string, number>;
  quotaUsed: number;
  quotaRemaining: number;
} {
  const itemCounts: Record<string, number> = {};
  let totalSize = 0;

  Object.values(STORAGE_KEYS).forEach(key => {
    try {
      const item = localStorage.getItem(key);
      if (item) {
        itemCounts[key] = 1;
        totalSize += getItemSize(item);
      } else {
        itemCounts[key] = 0;
      }
    } catch {
      itemCounts[key] = 0;
    }
  });

  const quotaUsed = (totalSize / STORAGE_LIMITS.MAX_TOTAL_SIZE) * 100;
  const quotaRemaining = Math.max(0, STORAGE_LIMITS.MAX_TOTAL_SIZE - totalSize);

  return {
    totalSize,
    itemCounts,
    quotaUsed,
    quotaRemaining
  };
}

/**
 * Salveaz\u0103 un item cu verificare dimensiune
 */
export function setStorageItem(key: string, value: unknown): {
  success: boolean;
  error?: string;
} {
  try {
    const serialized = JSON.stringify(value);
    const size = getItemSize(value);

    // Verificare dimensiune item
    if (size > STORAGE_LIMITS.MAX_SINGLE_ITEM) {
      return {
        success: false,
        error: `Item prea mare (${Math.round(size / 1024 / 1024)}MB). Maxim: ${Math.round(STORAGE_LIMITS.MAX_SINGLE_ITEM / 1024 / 1024)}MB`
      };
    }

    // Verificare spa\u021biu disponibil
    const storageInfo = getStorageInfo();
    if (storageInfo.quotaRemaining < size) {
      return {
        success: false,
        error: 'Spa\u021biu insuficient în storage'
      };
    }

    localStorage.setItem(key, serialized);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: `Eroare salvare: ${error instanceof Error ? error.message : 'Eroare necunoscut\u0103'}`
    };
  }
}

/**
 * Ob\u021bine un item din storage
 */
export function getStorageItem<T = unknown>(key: string): {
  success: boolean;
  data?: T;
  error?: string;
} {
  try {
    const item = localStorage.getItem(key);
    if (!item) {
      return { success: false, error: 'Item inexistent' };
    }

    const data = JSON.parse(item) as T;
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: `Eroare citire: ${error instanceof Error ? error.message : 'Eroare necunoscut\u0103'}`
    };
  }
}

/**
 * \u0218terge un item din storage
 */
export function removeStorageItem(key: string): boolean {
  try {
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

/**
 * Creeaz\u0103 backup automat
 */
export function createAutoBackup(): {
  success: boolean;
  error?: string;
  backupId?: string;
} {
  try {
    const backupData: Record<string, unknown> = {};
    const itemCounts = { profiles: 0, quizzes: 0, stats: 0 };

    // Colectare date pentru backup
    Object.entries(STORAGE_KEYS).forEach(([name, key]) => {
      if (key === STORAGE_KEYS.BACKUPS || key === STORAGE_KEYS.LAST_BACKUP) return;

      const result = getStorageItem(key);
      if (result.success && result.data) {
        backupData[name] = result.data;
        
        // Num\u0103rare item-uri
        if (key === STORAGE_KEYS.PROFILES) {
          itemCounts.profiles = Array.isArray(result.data) ? result.data.length : 1;
        } else if (key === STORAGE_KEYS.QUIZZES) {
          itemCounts.quizzes = Array.isArray(result.data) ? result.data.length : 1;
        } else if (key === STORAGE_KEYS.STATS) {
          itemCounts.stats = 1;
        }
      }
    });

    // Creare metadata backup
    const backupId = `backup_${Date.now()}`;
    const metadata: BackupMetadata = {
      id: backupId,
      timestamp: Date.now(),
      version: '1.0.0',
      size: getItemSize(backupData),
      type: 'auto',
      itemCounts
    };

    // Salvare backup
    const backupResult = setStorageItem(`${STORAGE_KEYS.BACKUPS}_${backupId}`, {
      metadata,
      data: backupData
    });

    if (!backupResult.success) {
      return backupResult;
    }

    // Actualizare ultimul backup
    setStorageItem(STORAGE_KEYS.LAST_BACKUP, {
      id: backupId,
      timestamp: Date.now()
    });

    // Cleanup backup-uri vechi
    cleanupOldBackups();

    return {
      success: true,
      backupId
    };
  } catch (error) {
    return {
      success: false,
      error: `Eroare creare backup: ${error instanceof Error ? error.message : 'Eroare necunoscut\u0103'}`
    };
  }
}

/**
 * Creeaz\u0103 backup manual
 */
export function createManualBackup(description?: string): {
  success: boolean;
  error?: string;
  backupId?: string;
} {
  try {
    const backupData: Record<string, unknown> = {};
    const itemCounts = { profiles: 0, quizzes: 0, stats: 0 };

    // Colectare date pentru backup
    Object.entries(STORAGE_KEYS).forEach(([name, key]) => {
      if (key === STORAGE_KEYS.BACKUPS || key === STORAGE_KEYS.LAST_BACKUP) return;

      const result = getStorageItem(key);
      if (result.success && result.data) {
        backupData[name] = result.data;
        
        if (key === STORAGE_KEYS.PROFILES) {
          itemCounts.profiles = Array.isArray(result.data) ? result.data.length : 1;
        } else if (key === STORAGE_KEYS.QUIZZES) {
          itemCounts.quizzes = Array.isArray(result.data) ? result.data.length : 1;
        } else if (key === STORAGE_KEYS.STATS) {
          itemCounts.stats = 1;
        }
      }
    });

    // Creare metadata backup
    const backupId = `manual_backup_${Date.now()}`;
    const metadata: BackupMetadata = {
      id: backupId,
      timestamp: Date.now(),
      version: '1.0.0',
      size: getItemSize(backupData),
      type: 'manual',
      description,
      itemCounts
    };

    // Salvare backup
    const backupResult = setStorageItem(`${STORAGE_KEYS.BACKUPS}_${backupId}`, {
      metadata,
      data: backupData
    });

    if (!backupResult.success) {
      return backupResult;
    }

    // Actualizare ultimul backup
    setStorageItem(STORAGE_KEYS.LAST_BACKUP, {
      id: backupId,
      timestamp: Date.now()
    });

    // Cleanup backup-uri vechi
    cleanupOldBackups();

    return {
      success: true,
      backupId
    };
  } catch (error) {
    return {
      success: false,
      error: `Eroare creare backup manual: ${error instanceof Error ? error.message : 'Eroare necunoscut\u0103'}`
    };
  }
}

/**
 * Ob\u021bine lista de backup-uri
 */
export function getBackupList(): BackupMetadata[] {
  const backups: BackupMetadata[] = [];

  // Iterare prin toate cheile de storage
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(STORAGE_KEYS.BACKUPS)) {
      try {
        const result = getStorageItem<BackupData>(key);
        if (result.success && result.data) {
          backups.push(result.data.metadata);
        }
      } catch {
        // Ignor\u0103 backup-uri corupte
      }
    }
  }

  // Sortare dup\u0103 timestamp (cele mai noi primele)
  return backups.sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * Restore din backup
 */
export function restoreFromBackup(backupId: string): {
  success: boolean;
  error?: string;
  restored?: string[];
} {
  try {
    const backupKey = `${STORAGE_KEYS.BACKUPS}_${backupId}`;
    const backupResult = getStorageItem<BackupData>(backupKey);

    if (!backupResult.success || !backupResult.data) {
      return { success: false, error: 'Backup inexistent sau corupt' };
    }

    const backup = backupResult.data;
    const restored: string[] = [];

    // Restore date
    Object.entries(backup.data).forEach(([name, data]) => {
      const storageKey = STORAGE_KEYS[name as keyof typeof STORAGE_KEYS];
      if (storageKey) {
        const setResult = setStorageItem(storageKey, data);
        if (setResult.success) {
          restored.push(name);
        }
      }
    });

    return {
      success: true,
      restored
    };
  } catch (error) {
    return {
      success: false,
      error: `Eroare restore: ${error instanceof Error ? error.message : 'Eroare necunoscut\u0103'}`
    };
  }
}

/**
 * \u0218terge un backup
 */
export function deleteBackup(backupId: string): boolean {
  try {
    return removeStorageItem(`${STORAGE_KEYS.BACKUPS}_${backupId}`);
  } catch {
    return false;
  }
}

/**
 * Cleanup backup-uri vechi (p\u00e2streaz\u0103 doar cele mai noi)
 */
export function cleanupOldBackups(): {
  deleted: number;
  spaceFreed: number;
} {
  const backups = getBackupList();
  const maxBackups = STORAGE_LIMITS.MAX_BACKUPS;
  
  if (backups.length <= maxBackups) {
    return { deleted: 0, spaceFreed: 0 };
  }

  let deleted = 0;
  let spaceFreed = 0;

  // \u0218terge cele mai vechi backup-uri
  const backupsToDelete = backups.slice(maxBackups);
  backupsToDelete.forEach(backup => {
    if (deleteBackup(backup.id)) {
      deleted++;
      spaceFreed += backup.size;
    }
  });

  return { deleted, spaceFreed };
}

/**
 * Cleanup cache AI
 */
export function cleanupAICache(): {
  deleted: number;
  spaceFreed: number;
} {
  try {
    const cacheResult = getStorageItem(STORAGE_KEYS.AI_CACHE);
    if (!cacheResult.success || !cacheResult.data) {
      return { deleted: 0, spaceFreed: 0 };
    }

    const cacheSize = getItemSize(cacheResult.data);
    removeStorageItem(STORAGE_KEYS.AI_CACHE);

    return {
      deleted: 1,
      spaceFreed: cacheSize
    };
  } catch {
    return { deleted: 0, spaceFreed: 0 };
  }
}

/**
 * Cleanup complet storage
 */
export function cleanupStorage(): {
  deleted: number;
  spaceFreed: number;
  errors: string[];
} {
  const errors: string[] = [];
  let totalDeleted = 0;
  let totalSpaceFreed = 0;

  try {
    // Cleanup backup-uri vechi
    const backupCleanup = cleanupOldBackups();
    totalDeleted += backupCleanup.deleted;
    totalSpaceFreed += backupCleanup.spaceFreed;

    // Cleanup AI cache
    const cacheCleanup = cleanupAICache();
    totalDeleted += cacheCleanup.deleted;
    totalSpaceFreed += cacheCleanup.spaceFreed;

    // Cleanup date corupte
    Object.values(STORAGE_KEYS).forEach(key => {
      try {
        const item = localStorage.getItem(key);
        if (item) {
          JSON.parse(item); // Verificare dac\u0103 e valid
        }
      } catch {
        if (removeStorageItem(key)) {
          totalDeleted++;
        }
        errors.push(`\u0218ters item corupt: ${key}`);
      }
    });

  } catch (error) {
    errors.push(`Eroare cleanup: ${error instanceof Error ? error.message : 'Eroare necunoscut\u0103'}`);
  }

  return {
    deleted: totalDeleted,
    spaceFreed: totalSpaceFreed,
    errors
  };
}

/**
 * Export date pentru migrare
 */
export function exportData(): {
  success: boolean;
  data?: string;
  error?: string;
} {
  try {
    const exportData: Record<string, unknown> = {};
    const storageInfo = getStorageInfo();

    // Colectare toate datele (f\u0103r\u0103 backup-uri)
    Object.entries(STORAGE_KEYS).forEach(([name, key]) => {
      if (key === STORAGE_KEYS.BACKUPS) return;

      const result = getStorageItem(key);
      if (result.success && result.data) {
        exportData[name] = result.data;
      }
    });

    const exportPackage = {
      version: '1.0.0',
      timestamp: Date.now(),
      storageInfo,
      data: exportData
    };

    return {
      success: true,
      data: JSON.stringify(exportPackage, null, 2)
    };
  } catch (error) {
    return {
      success: false,
      error: `Eroare export: ${error instanceof Error ? error.message : 'Eroare necunoscut\u0103'}`
    };
  }
}

/**
 * Import date din migrare
 */
export function importData(jsonData: string): {
  success: boolean;
  imported?: string[];
  error?: string;
} {
  try {
    const importPackage = JSON.parse(jsonData);
    const imported: string[] = [];

    // Validare format
    if (!importPackage.version || !importPackage.data) {
      return { success: false, error: 'Format export invalid' };
    }

    // Import date
    Object.entries(importPackage.data).forEach(([name, data]) => {
      const storageKey = STORAGE_KEYS[name as keyof typeof STORAGE_KEYS];
      if (storageKey) {
        const setResult = setStorageItem(storageKey, data);
        if (setResult.success) {
          imported.push(name);
        }
      }
    });

    return {
      success: true,
      imported
    };
  } catch (error) {
    return {
      success: false,
      error: `Eroare import: ${error instanceof Error ? error.message : 'Eroare necunoscut\u0103'}`
    };
  }
}

/**
 * Verificare s\u0103n\u0103tate storage
 */
export function checkStorageHealth(): {
  isHealthy: boolean;
  issues: string[];
  recommendations: string[];
} {
  const issues: string[] = [];
  const recommendations: string[] = [];

  const storageInfo = getStorageInfo();
  
  // Verificare spa\u021biu
  if (storageInfo.quotaUsed > 80) {
    issues.push(`Storage aproape plin (${storageInfo.quotaUsed.toFixed(1)}%)`);
    recommendations.push('Efectueaz\u0103 cleanup pentru a elibera spa\u021biu');
  }

  // Verificare backup recent
  const lastBackup = getStorageItem<LastBackup>(STORAGE_KEYS.LAST_BACKUP);
  if (!lastBackup.success || (Date.now() - (lastBackup.data?.timestamp || 0)) > 7 * 24 * 60 * 60 * 1000) {
    issues.push('Nu exist\u0103 backup recent');
    recommendations.push('Creeaz\u0103 un backup manual');
  }

  // Verificare date corupte
  Object.values(STORAGE_KEYS).forEach(key => {
    try {
      const item = localStorage.getItem(key);
      if (item) {
        JSON.parse(item);
      }
    } catch {
      issues.push(`Date corupte în: ${key}`);
      recommendations.push(`\u0218terge sau restore pentru: ${key}`);
    }
  });

  return {
    isHealthy: issues.length === 0,
    issues,
    recommendations
  };
}

// Export pentru utilizare u\u0219oar\u0103
export const StorageHelper = {
  STORAGE_KEYS,
  STORAGE_LIMITS,
  getItemSize,
  getStorageInfo,
  setStorageItem,
  getStorageItem,
  removeStorageItem,
  createAutoBackup,
  createManualBackup,
  getBackupList,
  restoreFromBackup,
  deleteBackup,
  cleanupOldBackups,
  cleanupAICache,
  cleanupStorage,
  exportData,
  importData,
  checkStorageHealth
};

export default StorageHelper;
