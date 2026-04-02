import { create } from 'zustand';
import type { QuizColor } from '../types';

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'up-to-date'
  | 'available'
  | 'downloading'
  | 'ready'
  | 'error';

// ── Content update (optional quiz pack) ───────────────────────────────────────
export interface ContentUpdate {
  /** Unique stable ID (e.g. "derm-2024"). Used to track installed packs. */
  id: string;
  /** Display title, e.g. "Dermatologie — 85 grile" */
  title: string;
  /** Subject name used for auto-folder creation, e.g. "Dermatologie" */
  subject: string;
  /** Short description shown in the modal */
  description: string;
  /** Emoji used for the auto-created folder */
  emoji: string;
  /** Color for the auto-created folder */
  color: QuizColor;
  /** Total question count (display only) */
  questionCount: number;
  /** Number of quiz objects in the pack */
  quizCount: number;
  /** URL to the content JSON file (hosted on GitHub raw) */
  url: string;
  /** ISO date string, e.g. "2024-03-28" */
  publishedAt: string;
}

// ── System update manifest ─────────────────────────────────────────────────────
export interface UpdateManifest {
  version: string;
  latestVersion?: string;
  releaseDate: string;
  changes: string[];
  files: { path: string; url: string }[];
  isSequential?: boolean;
  stepsRemaining?: number;
  /** Optional quiz-pack content updates bundled with this manifest */
  contentUpdates?: ContentUpdate[];
}

// ── Persistence helpers ────────────────────────────────────────────────────────
const INSTALLED_KEY = 'studyx-installed-content';

function loadInstalledIds(): string[] {
  try { return JSON.parse(localStorage.getItem(INSTALLED_KEY) ?? '[]'); }
  catch { return []; }
}
function persistInstalledIds(ids: string[]) {
  try { localStorage.setItem(INSTALLED_KEY, JSON.stringify(ids)); } catch { /* quota */ }
}

// ── Store ──────────────────────────────────────────────────────────────────────
interface UpdateState {
  // System update
  status: UpdateStatus;
  localVersion: string;
  manifest: UpdateManifest | null;
  downloadPercent: number;
  error: string | null;

  // Content packs
  installedContentIds: string[];
  contentInstalling: string | null;

  // Modal visibility
  showUpdateModal: boolean;

  // System actions
  setLocalVersion: (v: string) => void;
  checkForUpdate: () => Promise<void>;
  downloadUpdate: () => Promise<void>;
  applyUpdate: () => void;
  dismiss: () => void;

  // Content actions
  markContentInstalled: (id: string) => void;
  setContentInstalling: (id: string | null) => void;

  // Modal actions
  setShowUpdateModal: (v: boolean) => void;
}

// Import type — Window interface is declared in TitleBar.tsx (global augmentation)
const api = () => (typeof window !== 'undefined' ? window.electronAPI : undefined);

export const useUpdateStore = create<UpdateState>((set, get) => ({
  // ── System ──
  status: 'idle',
  localVersion: '—',
  manifest: null,
  downloadPercent: 0,
  error: null,

  // ── Content ──
  installedContentIds: loadInstalledIds(),
  contentInstalling: null,

  // ── Modal ──
  showUpdateModal: false,

  // ── System actions ──
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
            latestVersion: result.latestVersion ?? result.version,
            releaseDate: result.releaseDate,
            changes: result.changes,
            files: result.files,
            isSequential: result.isSequential ?? false,
            stepsRemaining: result.stepsRemaining ?? 1,
            contentUpdates: result.contentUpdates ?? [],
          },
        });
      } else {
        // Still expose content updates even when app is up-to-date
        const contentUpdates: ContentUpdate[] = result.contentUpdates ?? [];
        set({
          status: 'up-to-date',
          manifest: contentUpdates.length
            ? { version: result.localVersion, releaseDate: '', changes: [], files: [], contentUpdates }
            : null,
        });
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
    const electron = api();
    if (!electron?.updaterRestart) {
      set({ status: 'error', error: 'Restart imposibil — redeschide aplicația manual.' });
      return;
    }
    electron.updaterRestart();
  },

  dismiss: () => set({ status: 'idle', error: null, manifest: null }),

  // ── Content actions ──
  markContentInstalled: (id) => {
    const next = [...new Set([...get().installedContentIds, id])];
    persistInstalledIds(next);
    set({ installedContentIds: next });
  },

  setContentInstalling: (id) => set({ contentInstalling: id }),

  // ── Modal actions ──
  setShowUpdateModal: (v) => {
    set({ showUpdateModal: v });
    // Auto-check when modal opens and we haven't checked recently
    if (v && get().status === 'idle') {
      get().checkForUpdate();
    }
  },
}));
