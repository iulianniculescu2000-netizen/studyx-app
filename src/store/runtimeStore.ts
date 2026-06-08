import { create } from 'zustand';
import type { PerformanceMode } from '../lib/deviceTier';

type RuntimeFeatureFlags = {
  diagnosticsPanel: boolean;
  backgroundQueue: boolean;
  safeStartup: boolean;
};

interface RuntimeStore {
  performanceMode: PerformanceMode;
  lowPowerMode: boolean;
  featureFlags: RuntimeFeatureFlags;
  setPerformanceMode: (mode: PerformanceMode) => void;
  setLowPowerMode: (enabled: boolean) => void;
  setFeatureFlag: <K extends keyof RuntimeFeatureFlags>(flag: K, enabled: RuntimeFeatureFlags[K]) => void;
}

const LS_KEY = 'studyx-runtime-settings';

function loadRuntimeSettings() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) {
      return {
        performanceMode: 'auto' as PerformanceMode,
        lowPowerMode: false,
        featureFlags: {
          diagnosticsPanel: true,
          backgroundQueue: true,
          safeStartup: true,
        },
      };
    }
    const parsed = JSON.parse(raw) as Partial<RuntimeStore>;
    return {
      performanceMode: parsed.performanceMode ?? 'auto',
      lowPowerMode: parsed.lowPowerMode ?? false,
      featureFlags: {
        diagnosticsPanel: parsed.featureFlags?.diagnosticsPanel ?? true,
        backgroundQueue: parsed.featureFlags?.backgroundQueue ?? true,
        safeStartup: parsed.featureFlags?.safeStartup ?? true,
      },
    };
  } catch {
    return {
      performanceMode: 'auto' as PerformanceMode,
      lowPowerMode: false,
      featureFlags: {
        diagnosticsPanel: true,
        backgroundQueue: true,
        safeStartup: true,
      },
    };
  }
}

function persist(state: Pick<RuntimeStore, 'performanceMode' | 'lowPowerMode' | 'featureFlags'>) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  } catch {
    // Non-fatal: runtime tuning still works for this session.
  }
}

const initial = loadRuntimeSettings();

export const useRuntimeStore = create<RuntimeStore>()((set, get) => ({
  ...initial,
  setPerformanceMode: (performanceMode) => {
    set({ performanceMode });
    persist({
      performanceMode,
      lowPowerMode: get().lowPowerMode,
      featureFlags: get().featureFlags,
    });
  },
  setLowPowerMode: (lowPowerMode) => {
    set({ lowPowerMode });
    persist({
      performanceMode: get().performanceMode,
      lowPowerMode,
      featureFlags: get().featureFlags,
    });
  },
  setFeatureFlag: (flag, enabled) => {
    const featureFlags = { ...get().featureFlags, [flag]: enabled };
    set({ featureFlags });
    persist({
      performanceMode: get().performanceMode,
      lowPowerMode: get().lowPowerMode,
      featureFlags,
    });
  },
}));
