import { useEffect, useRef } from 'react';
import { useFolderStore } from '../store/folderStore';
import { useNotesStore } from '../store/notesStore';
import { useQuizStore } from '../store/quizStore';
import { useStatsStore } from '../store/statsStore';
import { loadProfileData, saveProfileData, saveProfileNamespace } from '../store/profileStorage';
import { cancelIdleTask, scheduleIdleTask } from '../lib/idleTaskScheduler';

type AddToast = (message: string, type?: 'success' | 'error' | 'warning' | 'info', duration?: number) => void;

type Options = {
  activeProfileId: string | null;
  isSwapping: boolean;
  setIsSwapping: (value: boolean) => void;
  resetSaveStatus: () => void;
  addToast: AddToast;
};

export function useProfileLifecycle({
  activeProfileId,
  isSwapping,
  setIsSwapping,
  resetSaveStatus,
  addToast,
}: Options) {
  const prevProfileIdRef = useRef<string | null>(null);
  const saveTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const saveIdleRef = useRef<Record<string, number>>({});

  useEffect(() => {
    const swapProfile = async () => {
      const current = activeProfileId;
      const prev = prevProfileIdRef.current;

      if (prev === current) return;
      if (isSwapping) return;

      setIsSwapping(true);
      try {
        if (prev) {
          await saveProfileData(prev);
        }

        if (current) {
          await loadProfileData(current);
        }

        prevProfileIdRef.current = current;
      } catch {
        addToast('Eroare la schimbarea profilului.', 'error');
      } finally {
        setIsSwapping(false);
        resetSaveStatus();
      }
    };

    void swapProfile();
  }, [activeProfileId, addToast, isSwapping, resetSaveStatus, setIsSwapping]);

  useEffect(() => {
    if (!activeProfileId) return;

    const namespaces: Array<'quizzes' | 'folders' | 'stats' | 'notes'> = ['quizzes', 'folders', 'stats', 'notes'];

    const clearScheduledSave = (namespace: 'quizzes' | 'folders' | 'stats' | 'notes') => {
      const key = `${activeProfileId}:${namespace}`;
      const timer = saveTimersRef.current[key];
      if (timer) {
        clearTimeout(timer);
        delete saveTimersRef.current[key];
      }
      const idleHandle = saveIdleRef.current[key];
      if (typeof idleHandle === 'number') {
        cancelIdleTask(idleHandle);
        delete saveIdleRef.current[key];
      }
    };

    const persistNamespace = (namespace: 'quizzes' | 'folders' | 'stats' | 'notes') => {
      const key = `${activeProfileId}:${namespace}`;
      clearScheduledSave(namespace);
      void saveProfileNamespace(activeProfileId, namespace).catch(() => {
        // Auto-save errors handled silently - user sees save status
      }).finally(() => {
        delete saveIdleRef.current[key];
      });
    };

    const scheduleSave = (namespace: 'quizzes' | 'folders' | 'stats' | 'notes') => {
      const key = `${activeProfileId}:${namespace}`;
      clearScheduledSave(namespace);

      saveTimersRef.current[key] = setTimeout(() => {
        delete saveTimersRef.current[key];
        if (document.visibilityState === 'hidden') {
          persistNamespace(namespace);
          return;
        }
        saveIdleRef.current[key] = scheduleIdleTask(
          () => persistNamespace(namespace),
          {
            timeoutMs: namespace === 'stats' ? 1200 : 2400,
            dedupeKey: `profile-save:${key}`,
          },
        );
      }, namespace === 'stats' ? 1600 : 2800);
    };

    const flushPending = async () => {
      namespaces.forEach(clearScheduledSave);
      await saveProfileData(activeProfileId);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        void flushPending();
      }
    };

    const handlePageHide = () => {
      void flushPending();
    };

    const u1 = useQuizStore.subscribe(() => scheduleSave('quizzes'));
    const u2 = useFolderStore.subscribe(() => scheduleSave('folders'));
    const u3 = useStatsStore.subscribe(() => scheduleSave('stats'));
    const u4 = useNotesStore.subscribe(() => scheduleSave('notes'));
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      u1();
      u2();
      u3();
      u4();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
      void flushPending();
    };
  }, [activeProfileId]);

  useEffect(() => {
    if (!window.electronAPI?.onAppClose) return;

    const unsub = window.electronAPI.onAppClose(async () => {
      if (activeProfileId) {
        try {
          await saveProfileData(activeProfileId);
        } catch {
          // Silent fail on close - critical path
        }
      }
      window.electronAPI?.destroy();
    });

    return () => unsub();
  }, [activeProfileId]);
}
