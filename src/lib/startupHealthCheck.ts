import { detectDeviceCapabilities } from './deviceTier';
import { deriveHealthStatus } from './healthReporter';
import { idbGet, idbRemove, idbSet } from './idb';
import type { HealthCheckItem } from '../store/diagnosticsStore';

async function probeLocalStorage(): Promise<HealthCheckItem> {
  try {
    const key = 'studyx-health-probe';
    localStorage.setItem(key, 'ok');
    localStorage.removeItem(key);
    return { id: 'local-storage', label: 'Local storage', status: 'ok', detail: 'Persistența locală răspunde normal.' };
  } catch (error) {
    return {
      id: 'local-storage',
      label: 'Local storage',
      status: 'error',
      detail: error instanceof Error ? error.message : 'Persistența locală nu a putut fi accesată.',
    };
  }
}

async function probeIndexedDb(): Promise<HealthCheckItem> {
  try {
    const key = 'studyx-health-probe';
    await idbSet(key, { ok: true, at: Date.now() });
    await idbGet(key);
    await idbRemove(key);
    return { id: 'indexeddb', label: 'IndexedDB', status: 'ok', detail: 'Stocarea extinsă este disponibilă.' };
  } catch (error) {
    return {
      id: 'indexeddb',
      label: 'IndexedDB',
      status: 'warning',
      detail: error instanceof Error ? error.message : 'Stocarea extinsă nu a răspuns complet.',
    };
  }
}

function probeElectronBridge(): HealthCheckItem {
  const available = typeof window !== 'undefined' && !!window.electronAPI;
  return {
    id: 'electron-bridge',
    label: 'Electron bridge',
    status: available ? 'ok' : 'warning',
    detail: available ? 'Bridge-ul nativ este disponibil.' : 'Rulezi fără bridge nativ complet.',
  };
}

function probeDeviceTier(): HealthCheckItem {
  const capabilities = detectDeviceCapabilities();
  return {
    id: 'device-tier',
    label: 'Profil hardware',
    status: capabilities.tier === 'low' ? 'warning' : 'ok',
    detail: `Tier detectat: ${capabilities.tier}, ${capabilities.hardwareConcurrency} thread-uri, ${capabilities.deviceMemory} GB RAM estimat.`,
  };
}

export async function runStartupHealthCheck() {
  const checks = await Promise.all([
    probeLocalStorage(),
    probeIndexedDb(),
    Promise.resolve(probeElectronBridge()),
    Promise.resolve(probeDeviceTier()),
  ]);

  return {
    checks,
    status: deriveHealthStatus(checks),
  };
}
