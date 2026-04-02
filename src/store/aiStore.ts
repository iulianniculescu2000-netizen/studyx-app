import { create } from 'zustand';

export type AIModel = 'llama-3.3-70b-versatile' | 'llama-3.1-8b-instant' | 'mixtral-8x7b-32768';
export type AIKnowledgeSourceType = 'pdf' | 'txt' | 'manual';

export interface AIKnowledgeSource {
  id: string;
  name: string;
  content: string;
  type: AIKnowledgeSourceType;
  addedAt: number;
}

interface AIStore {
  apiKey: string;
  model: AIModel;
  knowledgeSources: AIKnowledgeSource[];
  setApiKey: (key: string) => void;
  setModel: (model: AIModel) => void;
  addKnowledgeSource: (name: string, content: string, type: AIKnowledgeSourceType) => void;
  removeKnowledgeSource: (id: string) => void;
  clearKnowledgeSources: () => void;
  getKnowledgeContext: (maxChars?: number) => string;
  hasKey: () => boolean;
}

const LS_KEY = 'studyx-ai';

function loadFromLS(): { apiKey: string; model: AIModel; knowledgeSources: AIKnowledgeSource[] } {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { apiKey: '', model: 'llama-3.3-70b-versatile', knowledgeSources: [] };
    const p = JSON.parse(raw);
    const list = Array.isArray(p.knowledgeSources) ? p.knowledgeSources : [];
    return {
      apiKey: p.apiKey ?? '',
      model: p.model ?? 'llama-3.3-70b-versatile',
      knowledgeSources: list
        .filter((x) => x && typeof x.id === 'string' && typeof x.content === 'string')
        .slice(-30),
    };
  } catch {
    return { apiKey: '', model: 'llama-3.3-70b-versatile', knowledgeSources: [] };
  }
}

function saveToLS(apiKey: string, model: AIModel, knowledgeSources: AIKnowledgeSource[]) {
  try { localStorage.setItem(LS_KEY, JSON.stringify({ apiKey, model, knowledgeSources })); } catch {}
}

export const useAIStore = create<AIStore>()((set, get) => ({
  ...loadFromLS(),
  setApiKey: (key) => {
    const trimmed = key.trim();
    set({ apiKey: trimmed });
    saveToLS(trimmed, get().model, get().knowledgeSources);
  },
  setModel: (model) => {
    set({ model });
    saveToLS(get().apiKey, model, get().knowledgeSources);
  },
  addKnowledgeSource: (name, content, type) => {
    const cleanName = (name || 'Sursa AI').trim().slice(0, 120);
    const normalized = content.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    if (normalized.length < 60) return;
    const entry: AIKnowledgeSource = {
      id: crypto.randomUUID().replace(/-/g, '').slice(0, 12),
      name: cleanName || 'Sursa AI',
      content: normalized.slice(0, 30000),
      type,
      addedAt: Date.now(),
    };
    const next = [...get().knowledgeSources, entry].slice(-30);
    set({ knowledgeSources: next });
    saveToLS(get().apiKey, get().model, next);
  },
  removeKnowledgeSource: (id) => {
    const next = get().knowledgeSources.filter((s) => s.id !== id);
    set({ knowledgeSources: next });
    saveToLS(get().apiKey, get().model, next);
  },
  clearKnowledgeSources: () => {
    set({ knowledgeSources: [] });
    saveToLS(get().apiKey, get().model, []);
  },
  getKnowledgeContext: (maxChars = 6000) => {
    const sources = [...get().knowledgeSources].sort((a, b) => b.addedAt - a.addedAt);
    if (sources.length === 0) return '';
    let out = '';
    for (const s of sources) {
      const block = `\n[SURSA: ${s.name} | ${s.type.toUpperCase()}]\n${s.content}\n`;
      if ((out + block).length > maxChars) break;
      out += block;
    }
    return out.trim();
  },
  hasKey: () => {
    const key = get().apiKey.trim();
    return key.startsWith('gsk_') && key.length > 20;
  },
}));
