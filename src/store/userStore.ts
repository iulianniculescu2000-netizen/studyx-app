import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ThemeId } from '../theme/themes';

const AVATAR_GRADIENTS = [
  'linear-gradient(135deg, #0A84FF, #5E5CE6)',
  'linear-gradient(135deg, #AF52DE, #FF375F)',
  'linear-gradient(135deg, #FF9F0A, #FF6B00)',
  'linear-gradient(135deg, #30D158, #32ADE6)',
  'linear-gradient(135deg, #FF453A, #FF375F)',
  'linear-gradient(135deg, #5AC8FA, #5E5CE6)',
];

export interface Profile {
  id: string;
  username: string;
  themeId: ThemeId;
  gradient: string;
  createdAt: number;
}

interface UserStore {
  profiles: Profile[];
  activeProfileId: string | null;
  // Synced from active profile — kept for backward compat across all components
  username: string | null;
  themeId: ThemeId;
  // Actions
  addProfile: (name: string, themeId: ThemeId) => string;
  setUsername: (name: string) => void; // legacy: used by Welcome, creates + activates profile
  setTheme: (id: ThemeId) => void;
  switchProfile: (id: string) => void;
  removeProfile: (id: string) => void;
  logout: () => void;
}

export const useUserStore = create<UserStore>()(
  persist(
    (set, get) => ({
      profiles: [],
      activeProfileId: null,
      username: null,
      themeId: 'obsidian',

      addProfile: (name, themeId) => {
        const id = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
        const gradient = AVATAR_GRADIENTS[get().profiles.length % AVATAR_GRADIENTS.length];
        const profile: Profile = { id, username: name.trim(), themeId, gradient, createdAt: Date.now() };
        set((s) => ({ profiles: [...s.profiles, profile] }));
        return id;
      },

      setUsername: (name) => {
        // Creates a new profile from the current temp themeId and activates it
        const themeId = get().themeId;
        const id = get().addProfile(name, themeId);
        const profile = get().profiles.find((p) => p.id === id)!;
        set({ activeProfileId: id, username: profile.username, themeId: profile.themeId });
      },

      setTheme: (id) => {
        set((s) => ({
          themeId: id,
          profiles: s.activeProfileId
            ? s.profiles.map((p) => (p.id === s.activeProfileId ? { ...p, themeId: id } : p))
            : s.profiles,
        }));
      },

      switchProfile: (id) => {
        const profile = get().profiles.find((p) => p.id === id);
        if (!profile) return;
        set({ activeProfileId: id, username: profile.username, themeId: profile.themeId });
      },

      removeProfile: (id) => {
        const wasActive = get().activeProfileId === id;
        set((s) => ({
          profiles: s.profiles.filter((p) => p.id !== id),
          ...(wasActive ? { activeProfileId: null, username: null } : {}),
        }));
      },

      logout: () => set({ activeProfileId: null, username: null }),
    }),
    {
      name: 'studyx-user',
      version: 2,
      migrate: (persisted) => persisted as any,
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        // Migrate old single-user format to profiles array
        if (state.username && (!state.profiles || state.profiles.length === 0)) {
          const id = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
          const profile: Profile = {
            id,
            username: state.username,
            themeId: state.themeId ?? 'obsidian',
            gradient: AVATAR_GRADIENTS[0],
            createdAt: Date.now(),
          };
          state.profiles = [profile];
          state.activeProfileId = id;
        }
        // Sync username/themeId from active profile
        if (state.activeProfileId && state.profiles) {
          const active = state.profiles.find((p) => p.id === state.activeProfileId);
          if (active) {
            state.username = active.username;
            state.themeId = active.themeId;
          }
        }
      },
    }
  )
);
