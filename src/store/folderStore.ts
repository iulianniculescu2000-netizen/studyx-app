import { create } from 'zustand';
import type { Folder, QuizColor } from '../types';

function uid() { return crypto.randomUUID().replace(/-/g, '').slice(0, 12); }

interface FolderStore {
  folders: Folder[];
  addFolder: (name: string, emoji: string, color: QuizColor, parentId?: string | null) => string;
  updateFolder: (id: string, updates: Partial<Folder>) => void;
  deleteFolder: (id: string) => void;
  reorderFolders: (ids: string[]) => void;
  _hydrate: (data: { folders: Folder[] }) => void;
  _snapshot: () => { folders: Folder[] };
}

export const useFolderStore = create<FolderStore>()(
  (set, get) => ({
    folders: [],

    addFolder: (name, emoji, color, parentId = null) => {
      const id = `f-${uid()}`;
      set((s) => ({
        folders: [...s.folders, { id, name, emoji, color, parentId: parentId ?? null, createdAt: Date.now() }],
      }));
      return id;
    },

    updateFolder: (id, updates) =>
      set((s) => {
        const parentId = updates.parentId ?? undefined;
        if (parentId === id) return s;

        const descendants = new Set<string>();
        const collect = (folderId: string) => {
          s.folders
            .filter((folder) => folder.parentId === folderId)
            .forEach((folder) => {
              descendants.add(folder.id);
              collect(folder.id);
            });
        };
        collect(id);

        if (parentId && descendants.has(parentId)) return s;
        return { folders: s.folders.map((f) => (f.id === id ? { ...f, ...updates } : f)) };
      }),

    deleteFolder: (id) =>
      set((s) => {
        const toDelete = new Set([id]);
        let changed = true;
        while (changed) {
          changed = false;
          for (const folder of s.folders) {
            if (folder.parentId && toDelete.has(folder.parentId) && !toDelete.has(folder.id)) {
              toDelete.add(folder.id);
              changed = true;
            }
          }
        }
        return { folders: s.folders.filter((f) => !toDelete.has(f.id)) };
      }),

    reorderFolders: (ids) =>
      set((s) => ({
        folders: ids.map((id) => s.folders.find((f) => f.id === id)!).filter(Boolean),
      })),

    _hydrate: (data) => set({ folders: data.folders ?? [] }),
    _snapshot: () => ({ folders: get().folders }),
  })
);
