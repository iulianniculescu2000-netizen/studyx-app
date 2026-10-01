import { create } from 'zustand';

interface NewFolderDialogState {
  open: boolean;
  parentId: string | null;
  show: (parentId?: string | null) => void;
  hide: () => void;
}

/**
 * Open/closed state of the "Folder nou" dialog, kept out of the Sidebar so that
 * opening it re-renders only the dialog — the sidebar (folder tree, counters,
 * every quiz-derived total) used to re-render in full on each click.
 */
export const useNewFolderDialog = create<NewFolderDialogState>((set) => ({
  open: false,
  parentId: null,
  show: (parentId = null) => set({ open: true, parentId }),
  hide: () => set({ open: false, parentId: null }),
}));
