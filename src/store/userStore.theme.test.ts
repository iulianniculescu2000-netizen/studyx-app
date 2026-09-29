import { beforeEach, describe, expect, it } from 'vitest';
import { useUserStore } from './userStore';
import { DEFAULT_THEME_ID, normalizeThemeId } from '../theme/themes';

describe('single-theme migration', () => {
  beforeEach(() => {
    localStorage.clear();
    useUserStore.getState().reset();
  });

  it('maps any retired theme id to the one that remains', () => {
    for (const legacy of ['obsidian', 'pearl', 'bigsur', 'aurora', 'midnight', 'amber', 'auto', undefined, 42]) {
      expect(normalizeThemeId(legacy)).toBe(DEFAULT_THEME_ID);
    }
  });

  it('migrates a saved v2 state: every profile keeps its data, only the theme changes', () => {
    const migrate = useUserStore.persist.getOptions().migrate!;
    const migrated = migrate(
      {
        themeId: 'pearl',
        activeProfileId: 'p1',
        username: 'Ana',
        profiles: [
          { id: 'p1', username: 'Ana', themeId: 'amber', gradient: 'g1', createdAt: 1 },
          { id: 'p2', username: 'Radu', themeId: 'obsidian', gradient: 'g2', createdAt: 2 },
        ],
      },
      2,
    ) as { themeId: string; activeProfileId: string; profiles: { id: string; username: string; themeId: string; createdAt: number }[] };

    expect(migrated.themeId).toBe('glass');
    expect(migrated.activeProfileId).toBe('p1');
    expect(migrated.profiles.map((p) => [p.id, p.username, p.themeId, p.createdAt])).toEqual([
      ['p1', 'Ana', 'glass', 1],
      ['p2', 'Radu', 'glass', 2],
    ]);
  });

  it('keeps new and changed profiles on the single theme', () => {
    const id = useUserStore.getState().addProfile('Maria', 'obsidian' as never);
    useUserStore.getState().switchProfile(id);
    useUserStore.getState().setTheme('pearl' as never);

    const state = useUserStore.getState();
    expect(state.themeId).toBe('glass');
    expect(state.profiles.find((p) => p.id === id)?.themeId).toBe('glass');
  });
});
