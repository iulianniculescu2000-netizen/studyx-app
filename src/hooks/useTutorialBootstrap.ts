import { useEffect, useRef } from 'react';
import { useTutorialStore } from '../store/tutorialStore';

type Options = {
  activeProfileId: string | null;
  pendingTutorialProfileId: string | null;
  clearPendingTutorialProfile: (profileId: string) => void;
  username: string;
  splashVisible: boolean;
  addingProfile: boolean;
  hasHydrated: boolean;
  startTutorial: () => void;
};

export function useTutorialBootstrap({
  activeProfileId,
  pendingTutorialProfileId,
  clearPendingTutorialProfile,
  username,
  splashVisible,
  addingProfile,
  hasHydrated,
  startTutorial,
}: Options) {
  const tutorialArmedProfileRef = useRef<string | null>(null);

  useEffect(() => {
    if (!hasHydrated || !activeProfileId || !username || splashVisible) return;

    const tutorialState = useTutorialStore.getState();
    if (tutorialState.isCompleted(activeProfileId)) {
      tutorialArmedProfileRef.current = activeProfileId;
      clearPendingTutorialProfile(activeProfileId);
      return;
    }
    if (tutorialArmedProfileRef.current === activeProfileId && tutorialState.active) return;

    const delay = pendingTutorialProfileId === activeProfileId ? 220 : (addingProfile ? 350 : 1200);
    const timer = setTimeout(() => {
      const state = useTutorialStore.getState();
      if (!state.active && !state.isCompleted(activeProfileId)) {
        tutorialArmedProfileRef.current = activeProfileId;
        // Tutorial auto-starting - no console needed
        startTutorial();
        clearPendingTutorialProfile(activeProfileId);
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [
    activeProfileId,
    addingProfile,
    clearPendingTutorialProfile,
    hasHydrated,
    pendingTutorialProfileId,
    splashVisible,
    startTutorial,
    username,
  ]);

  useEffect(() => {
    if (!hasHydrated || !activeProfileId || pendingTutorialProfileId !== activeProfileId || splashVisible) return;

    const raf = window.requestAnimationFrame(() => {
      const nested = window.requestAnimationFrame(() => {
        const state = useTutorialStore.getState();
        if (!state.active && !state.isCompleted(activeProfileId)) {
          tutorialArmedProfileRef.current = activeProfileId;
          state.resetTutorial();
          state.startTutorial();
          clearPendingTutorialProfile(activeProfileId);
        }
      });

      return () => window.cancelAnimationFrame(nested);
    });

    return () => window.cancelAnimationFrame(raf);
  }, [activeProfileId, clearPendingTutorialProfile, hasHydrated, pendingTutorialProfileId, splashVisible]);
}
