import { create } from 'zustand';

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  duration: number;
}

interface ToastStore {
  toasts: Toast[];
  add: (message: string, type?: Toast['type'], duration?: number) => void;
  remove: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  add: (message, type = 'info', duration = 3000) => {
    const id = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
    set((s) => ({ toasts: [...s.toasts, { id, message, type, duration }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, duration);
  },
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const toast = {
  success: (msg: string, dur?: number) => useToastStore.getState().add(msg, 'success', dur),
  error: (msg: string, dur?: number) => useToastStore.getState().add(msg, 'error', dur),
  info: (msg: string, dur?: number) => useToastStore.getState().add(msg, 'info', dur),
  warning: (msg: string, dur?: number) => useToastStore.getState().add(msg, 'warning', dur),
};
