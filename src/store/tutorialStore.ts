import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type TutorialStepId =
  | 'welcome'
  | 'sidebar'
  | 'create_quiz'
  | 'import_quiz'
  | 'folders'
  | 'play_modes'
  | 'flashcards'
  | 'review'
  | 'stats'
  | 'notes'
  | 'search'
  | 'ai_setup'
  | 'shortcuts'
  | 'done';

interface TutorialStore {
  active: boolean;
  currentStep: number;
  completedProfiles: string[]; // profileIds that completed the tutorial
  _hasHydrated: boolean;
  startTutorial: () => void;
  nextStep: () => void;
  prevStep: () => void;
  skipTutorial: (profileId: string) => void;
  completeTutorial: (profileId: string) => void;
  resetTutorial: () => void;
  isCompleted: (profileId: string) => boolean;
}

export const TOTAL_STEPS = 14;

export const useTutorialStore = create<TutorialStore>()(
  persist(
    (set, get) => ({
      active: false,
      currentStep: 0,
      completedProfiles: [],
      _hasHydrated: false,

      startTutorial: () => set({ active: true, currentStep: 0 }),

      nextStep: () => {
        const next = get().currentStep + 1;
        if (next >= TOTAL_STEPS) {
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
