import { create } from 'zustand';

export type AIModel = 'llama-3.3-70b-versatile' | 'llama-3.1-8b-instant' | 'mixtral-8x7b-32768';

interface AIStore {
  apiKey: string;
  model: AIModel;
  setApiKey: (key: string) => void;
  setModel: (model: AIModel) => void;
  hasKey: () => boolean;
}

const LS_KEY = 'studyx-ai';

function loadFromLS(): { apiKey: string; model: AIModel } {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { apiKey: '', model: 'llama-3.3-70b-versatile' };
    const p = JSON.parse(raw);
    return {
      apiKey: p.apiKey ?? '',
      model: p.model ?? 'llama-3.3-70b-versatile',
    };
  } catch {
    return { apiKey: '', model: 'llama-3.3-70b-versatile' };
  }
}

function saveToLS(apiKey: string, model: AIModel) {
  try { localStorage.setItem(LS_KEY, JSON.stringify({ apiKey, model })); } catch {}
}

export const useAIStore = create<AIStore>()((set, get) => ({
  ...loadFromLS(),
  setApiKey: (key) => {
    const trimmed = key.trim();
    set({ apiKey: trimmed });
    saveToLS(trimmed, get().model);
  },
  setModel: (model) => {
    set({ model });
    saveToLS(get().apiKey, model);
  },
  hasKey: () => {
    const key = get().apiKey.trim();
    return key.startsWith('gsk_') && key.length > 20;
  },
}));
