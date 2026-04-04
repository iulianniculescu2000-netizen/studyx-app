import { create } from 'zustand';
import { chunkText } from '../ai/chunker';
import { setAIDebugEnabled, isAIDebugEnabled } from '../ai/debug';
import { addChunksToVault, clearVault, removeChunksBySource, searchVault } from '../ai/vectorStore';
import { idbGet, idbSet } from '../lib/idb';

export type AIModel = 'llama-3.3-70b-versatile' | 'llama-3.1-8b-instant' | 'mixtral-8x7b-32768';
export type AIKnowledgeSourceType = 'pdf' | 'txt' | 'manual' | 'docx' | 'image';

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
  debugMode: boolean;
  knowledgeSources: AIKnowledgeSource[];
  isHydrated: boolean;
  setApiKey: (key: string) => void;
  setModel: (model: AIModel) => void;
  setDebugMode: (enabled: boolean) => void;
  addKnowledgeSource: (name: string, content: string, type: AIKnowledgeSourceType) => Promise<void>;
  removeKnowledgeSource: (id: string) => Promise<void>;
  clearKnowledgeSources: () => Promise<void>;
  getKnowledgeContext: (query: string, maxChars?: number) => Promise<string>;
  hasKey: () => boolean;
  _hydrate: () => Promise<void>;
}

const LS_KEY = 'studyx-ai-settings';

function loadSettingsFromLS(): { apiKey: string; model: AIModel; debugMode: boolean } {
  try {
    const raw = localStorage.getItem(LS_KEY) || localStorage.getItem('studyx-ai');
    if (!raw) return { apiKey: '', model: 'llama-3.3-70b-versatile', debugMode: isAIDebugEnabled() };
    const p = JSON.parse(raw);
    return {
      apiKey: p.apiKey ?? '',
      model: p.model ?? 'llama-3.3-70b-versatile',
      debugMode: p.debugMode ?? isAIDebugEnabled(),
    };
  } catch {
    return { apiKey: '', model: 'llama-3.3-70b-versatile', debugMode: isAIDebugEnabled() };
  }
}

function saveSettingsToLS(apiKey: string, model: AIModel, debugMode: boolean) {
  try { localStorage.setItem(LS_KEY, JSON.stringify({ apiKey, model, debugMode })); } catch {}
}

const initialSettings = loadSettingsFromLS();

export const useAIStore = create<AIStore>()((set, get) => ({
  ...initialSettings,
  knowledgeSources: [],
  isHydrated: false,
  setApiKey: (key) => {
    const trimmed = key.trim();
    set({ apiKey: trimmed });
    saveSettingsToLS(trimmed, get().model, get().debugMode);
  },
  setModel: (model) => {
    set({ model });
    saveSettingsToLS(get().apiKey, model, get().debugMode);
  },
  setDebugMode: (enabled) => {
    set({ debugMode: enabled });
    setAIDebugEnabled(enabled);
    saveSettingsToLS(get().apiKey, get().model, enabled);
  },
  addKnowledgeSource: async (name, content, type) => {
    const cleanName = (name || 'Sursa AI').trim().slice(0, 120);
    const normalized = content.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    if (normalized.length < 20) return;
    
    const entry: AIKnowledgeSource = {
      id: crypto.randomUUID().replace(/-/g, '').slice(0, 12),
      name: cleanName || 'Sursa AI',
      content: normalized,
      type,
      addedAt: Date.now(),
    };
    
    const next = [...get().knowledgeSources, entry];
    set({ knowledgeSources: next });
    
    await idbSet('ai-knowledge-sources', next);
    
    // Process into chunks and vectors for RAG
    const chunks = chunkText(normalized, cleanName);
    await addChunksToVault(chunks, cleanName);
  },
  removeKnowledgeSource: async (id) => {
    const target = get().knowledgeSources.find(s => s.id === id);
    const next = get().knowledgeSources.filter((s) => s.id !== id);
    set({ knowledgeSources: next });
    await idbSet('ai-knowledge-sources', next);
    if (target) {
      await removeChunksBySource(target.name);
    }
  },
  clearKnowledgeSources: async () => {
    set({ knowledgeSources: [] });
    await idbSet('ai-knowledge-sources', []);
    await clearVault();
  },
  getKnowledgeContext: async (query, maxChars = 20000) => {
    if (!query || get().knowledgeSources.length === 0) return '';
    
    // RAG: Find the most relevant chunks from the entire indexed library
    const results = await searchVault(query, 10);

    if (results.length === 0) return '';

    let out = 'CONTEXT RELEVANT DIN BIBLIOTECA TA:\n';
    for (const chunk of results) {
      const block = `\n[Sursă: ${chunk.source}]\n${chunk.text}\n`;
      if ((out + block).length > maxChars) break;
      out += block;
    }
    
    return out.trim();
  },
  hasKey: () => {
    const key = get().apiKey.trim();
    return key.startsWith('gsk_') && key.length > 20;
  },
  _hydrate: async () => {
    if (get().isHydrated) return;
    try {
      const rawOld = localStorage.getItem('studyx-ai');
      let loaded: AIKnowledgeSource[] = [];
      if (rawOld) {
        const p = JSON.parse(rawOld);
        if (Array.isArray(p.knowledgeSources) && p.knowledgeSources.length > 0) {
          loaded = p.knowledgeSources;
          await idbSet('ai-knowledge-sources', loaded);
          localStorage.removeItem('studyx-ai');
        }
      } else {
        const idbData = await idbGet<AIKnowledgeSource[]>('ai-knowledge-sources');
        if (idbData) loaded = idbData;
      }
      set({ knowledgeSources: loaded, isHydrated: true });
    } catch (e) {
      set({ knowledgeSources: [], isHydrated: true });
    }
  },
}));

// Hydrate on mount
useAIStore.getState()._hydrate();
