import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface TutorialStore {
  active: boolean;
  currentStep: number;
  completedProfiles: string[]; // profileIds that completed the tutorial
  _hasHydrated: boolean;
  startTutorial: () => void;
  /** `total` is the number of steps in the tour being shown; the tour owns that count, not the store. */
  nextStep: (total: number) => void;
  prevStep: () => void;
  skipTutorial: (profileId: string) => void;
  completeTutorial: (profileId: string) => void;
  resetTutorial: () => void;
  isCompleted: (profileId: string) => boolean;
}

export const useTutorialStore = create<TutorialStore>()(
  persist(
    (set, get) => ({
      active: false,
      currentStep: 0,
      completedProfiles: [],
      _hasHydrated: false,

      startTutorial: () => set({ active: true, currentStep: 0 }),

      nextStep: (total) => {
        const next = get().currentStep + 1;
        if (next >= total) {
          set({ active: false, currentStep: 0 });
        } else {
          set({ currentStep: next });
        }
      },

      prevStep: () => set((s) => ({ currentStep: Math.max(0, s.currentStep - 1) })),

      skipTutorial: (profileId) => set((s) => ({
        active: false,
        currentStep: 0,
        completedProfiles: s.completedProfiles.includes(profileId)
          ? s.completedProfiles
          : [...s.completedProfiles, profileId],
      })),

      completeTutorial: (profileId) => set((s) => ({
        active: false,
        currentStep: 0,
        completedProfiles: s.completedProfiles.includes(profileId)
          ? s.completedProfiles
          : [...s.completedProfiles, profileId],
      })),

      resetTutorial: () => set({ active: false, currentStep: 0 }),

      isCompleted: (profileId) => get().completedProfiles.includes(profileId),
    }),
    {
      name: 'studyx-tutorial-v2',
      onRehydrateStorage: () => () => {
        useTutorialStore.setState({ _hasHydrated: true });
      },
    }
  )
);
