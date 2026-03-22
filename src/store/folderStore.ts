import { create } from 'zustand';
import type { Folder, QuizColor } from '../types';

function uid() { return crypto.randomUUID().replace(/-/g, '').slice(0, 12); }

interface FolderStore {
  folders: Folder[];
  addFolder: (name: string, emoji: string, color: QuizColor) => string;
  updateFolder: (id: string, updates: Partial<Folder>) => void;
  deleteFolder: (id: string) => void;
  reorderFolders: (ids: string[]) => void;
  _hydrate: (data: { folders: Folder[] }) => void;
  _snapshot: () => { folders: Folder[] };
}

export const useFolderStore = create<FolderStore>()(
  (set, get) => ({
    folders: [],

    addFolder: (name, emoji, color) => {
      const id = `f-${uid()}`;
      set((s) => ({
        folders: [...s.folders, { id, name, emoji, color, createdAt: Date.now() }],
      }));
      return id;
    },

    updateFolder: (id, updates) =>
      set((s) => ({ folders: s.folders.map((f) => (f.id === id ? { ...f, ...updates } : f)) })),

    deleteFolder: (id) =>
      set((s) => ({ folders: s.folders.filter((f) => f.id !== id) })),

    reorderFolders: (ids) =>
      set((s) => ({
        folders: ids.map((id) => s.folders.find((f) => f.id === id)!).filter(Boolean),
      })),

    _hydrate: (data) => set({ folders: data.folders ?? [] }),
    _snapshot: () => ({ folders: get().folders }),
  })
);
