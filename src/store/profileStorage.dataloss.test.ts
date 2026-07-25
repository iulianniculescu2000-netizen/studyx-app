/**
 * Regression tests for the four ways profile data could be destroyed silently.
 *
 * Every case here starts from the same premise: the user has real work on disk,
 * something goes wrong at load or save time, and the app must never respond by
 * throwing that work away without telling anyone.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  isProfileStorageError,
  listQuarantinedKeys,
  loadProfileData,
  saveProfileNamespace,
} from './profileStorage';
import { useQuizStore } from './quizStore';
import { useToastStore } from './toastStore';
import type { Quiz } from '../types';

const PROFILE = 'p-test';
const QUIZ_KEY = `studyx-p-${PROFILE}-quizzes`;

function makeQuiz(id: string): Quiz {
  return {
    id,
    title: id,
    description: '',
    emoji: '📘',
    category: 'test',
    color: 'blue',
    questions: [],
    createdAt: 1,
  };
}

/** A payload big enough that a real browser would reject it. */
function realWork() {
  return { quizzes: [makeQuiz('munca-de-6-luni')], sessions: [] };
}

/**
 * Simulates a full disk. Spies on the `localStorage` object itself, not
 * `Storage.prototype` — `src/test/setup.ts` swaps in a plain stub object that
 * never touches the prototype.
 */
function withFullStorage(run: () => Promise<void>) {
  const spy = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
    const err = new Error('QuotaExceededError');
    err.name = 'QuotaExceededError';
    throw err;
  });
  return run().finally(() => spy.mockRestore());
}

/**
 * `src/test/setup.ts` installs `window.electronAPI` as a non-configurable
 * property, so the object can only be mutated in place, not replaced.
 */
const electronAPI = window.electronAPI as unknown as Record<string, unknown>;

beforeEach(() => {
  localStorage.clear();
  useQuizStore.getState()._hydrate({ quizzes: [], sessions: [] });
  useToastStore.setState({ toasts: [] });
  // Browser build: no disk path, so everything goes through localStorage.
  electronAPI.storageLoad = undefined;
  electronAPI.storageSave = undefined;
});

describe('save failures must not look like success', () => {
  it('rejects when localStorage is out of quota, instead of resolving', async () => {
    useQuizStore.getState()._hydrate(realWork());
    await withFullStorage(async () => {
      // The import flow awaits this and treats a resolve as "saved".
      await expect(saveProfileNamespace(PROFILE, 'quizzes')).rejects.toThrow();
    });
  });

  it('tags a quota failure so callers can special-case it', async () => {
    useQuizStore.getState()._hydrate(realWork());
    await withFullStorage(async () => {
      const error = await saveProfileNamespace(PROFILE, 'quizzes').catch((e: unknown) => e);
      expect(isProfileStorageError(error)).toBe(true);
      expect((error as { kind: string }).kind).toBe('quota');
    });
  });

  it('warns the user with a toast that outlives the transient save indicator', async () => {
    useQuizStore.getState()._hydrate(realWork());
    await withFullStorage(async () => {
      await saveProfileNamespace(PROFILE, 'quizzes').catch(() => undefined);
      const toasts = useToastStore.getState().toasts;
      expect(toasts.length).toBeGreaterThan(0);
      expect(toasts.some((t) => t.type === 'error')).toBe(true);
      // The save-status pill self-clears after 3.2s; the toast must not.
      expect(toasts.some((t) => (t.duration ?? 0) > 10_000)).toBe(true);
    });
  });
});

describe('unreadable data must be preserved, never destroyed', () => {
  it('quarantines a corrupt blob rather than letting autosave overwrite it', async () => {
    localStorage.setItem(QUIZ_KEY, '{"quizzes":[{"id":"munca-de-6-luni"'); // truncated JSON

    await loadProfileData(PROFILE);

    // Loading empty is acceptable; losing the bytes is not.
    const quarantined = listQuarantinedKeys(PROFILE);
    expect(quarantined.length).toBeGreaterThan(0);
    const preserved = localStorage.getItem(quarantined[0]);
    expect(preserved).toContain('munca-de-6-luni');
  });

  it('quarantines a schema-mismatched blob instead of deleting it outright', async () => {
    // Valid JSON, but missing `sessions` — exactly what one future schema change looks like.
    localStorage.setItem(QUIZ_KEY, JSON.stringify({ quizzes: [makeQuiz('munca-de-6-luni')] }));

    await loadProfileData(PROFILE);

    const quarantined = listQuarantinedKeys(PROFILE);
    expect(quarantined.length).toBeGreaterThan(0);
    expect(localStorage.getItem(quarantined[0])).toContain('munca-de-6-luni');
  });

  it('tells the user their data was set aside', async () => {
    localStorage.setItem(QUIZ_KEY, '{ broken');
    await loadProfileData(PROFILE);
    expect(useToastStore.getState().toasts.length).toBeGreaterThan(0);
  });
});

describe('a corrupt disk file must not hide an intact local copy', () => {
  it('falls through to localStorage when Electron reports __corrupt', async () => {
    localStorage.setItem(QUIZ_KEY, JSON.stringify(realWork()));
    electronAPI.storageLoad = () => Promise.resolve({ __corrupt: true, __namespace: 'quizzes' });

    await loadProfileData(PROFILE);

    expect(useQuizStore.getState().quizzes.map((q) => q.id)).toEqual(['munca-de-6-luni']);
  });
});
