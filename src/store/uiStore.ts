import { create } from 'zustand';

interface UIStore {
  chatOpen: boolean;
  setChatOpen: (open: boolean) => void;
  toggleChat: () => void;
}

export const useUIStore = create<UIStore>((set) => ({
  chatOpen: false,
  setChatOpen: (chatOpen) => {
    set({ chatOpen });
    // Dispatch global event for non-zustand components if any
    window.dispatchEvent(new CustomEvent('studyx:chat', { detail: { open: chatOpen } }));
  },
  toggleChat: () => set((state) => {
    const next = !state.chatOpen;
    window.dispatchEvent(new CustomEvent('studyx:chat', { detail: { open: next } }));
    return { chatOpen: next };
  }),
}));
