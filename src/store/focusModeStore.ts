import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface FocusModeStore {
  focusMode: boolean;
  toggleFocusMode: () => void;
  setFocusMode: (v: boolean) => void;
}

export const useFocusModeStore = create<FocusModeStore>()(
  persist(
    (set) => ({
      focusMode: false,
      toggleFocusMode: () => set((s) => ({ focusMode: !s.focusMode })),
      setFocusMode: (v) => set({ focusMode: v }),
    }),
    {
      name: 'studyx-focus-mode',
      // Always reset focus mode on load — it's a UI state, not user data.
      // Persisting only the preference prevents stuck focus mode after crash.
      onRehydrateStorage: () => (state) => {
        // Safety: if the app crashed in focus mode, exit it on next launch
        if (state) state.focusMode = false;
      },
    },
  ),
);
