import { create } from 'zustand';

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'up-to-date'
  | 'available'
  | 'downloading'
  | 'ready'
  | 'error';

export interface UpdateManifest {
  version: string;
  releaseDate: string;
  changes: string[];
  files: { path: string; url: string }[];
}

interface UpdateState {
  status: UpdateStatus;
  localVersion: string;
  manifest: UpdateManifest | null;
  downloadPercent: number;
  error: string | null;

  setLocalVersion: (v: string) => void;
  checkForUpdate: () => Promise<void>;
  downloadUpdate: () => Promise<void>;
  applyUpdate: () => void;
  dismiss: () => void;
}

// Import type — Window interface is declared in TitleBar.tsx (global augmentation)
const api = () => (typeof window !== 'undefined' ? window.electronAPI : undefined);

export const useUpdateStore = create<UpdateState>((set, get) => ({
  status: 'idle',
  localVersion: '—',
  manifest: null,
  downloadPercent: 0,
  error: null,

  setLocalVersion: (v) => set({ localVersion: v }),

  checkForUpdate: async () => {
    const electron = api();
    if (!electron?.updaterCheck) return; // Not in Electron
    set({ status: 'checking', error: null });
    try {
      const result = await electron.updaterCheck();
      set({ localVersion: result.localVersion });
      if (result.hasUpdate) {
        set({
          status: 'available',
          manifest: {
            version: result.version,
            releaseDate: result.releaseDate,
            changes: result.changes,
            files: result.files,
          },
        });
      } else {
        set({ status: 'up-to-date', manifest: null });
        // Reset to idle after 4s so the button returns to normal
        setTimeout(() => set((s) => s.status === 'up-to-date' ? { status: 'idle' } : s), 4000);
      }
    } catch (err: any) {
      set({ status: 'error', error: err.message ?? 'Eroare necunoscută' });
    }
  },

  downloadUpdate: async () => {
    const { manifest } = get();
    const electron = api();
    if (!manifest || !electron?.updaterDownload) return;

    set({ status: 'downloading', downloadPercent: 0, error: null });

    // Subscribe to progress events
    let unsubscribe: (() => void) | null = null;
    if (electron.onUpdateProgress) {
      unsubscribe = electron.onUpdateProgress((data: { percent: number }) => {
        set({ downloadPercent: data.percent });
      });
    }

    try {
      await electron.updaterDownload(manifest);
      set({ status: 'ready', downloadPercent: 100 });
    } catch (err: any) {
      set({ status: 'error', error: err.message ?? 'Descărcarea a eșuat' });
    } finally {
      unsubscribe?.();
    }
  },

  applyUpdate: () => {
    api()?.updaterRestart?.();
  },

  dismiss: () => set({ status: 'idle', error: null, manifest: null }),
}));
