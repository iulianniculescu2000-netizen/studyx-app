import { create } from 'zustand';
import { chunkText } from '../ai/chunker';
import { setAIDebugEnabled, isAIDebugEnabled } from '../ai/debug';
import { addChunksToVault, clearVault, removeChunksBySource } from '../ai/vectorStore';
import { retrieveRelevantChunks } from '../ai/retriever';
import { idbGet, idbSet } from '../lib/idb';

export type AIModel = 'llama-3.3-70b-versatile' | 'llama-3.1-8b-instant' | 'mixtral-8x7b-32768';
export type AIKnowledgeSourceType = 'pdf' | 'txt' | 'manual' | 'docx' | 'image';

export interface AIKnowledgeSource {
  id: string;
  name: string;
  type: AIKnowledgeSourceType;
  addedAt: number;
  charCount: number;
  wordCount: number;
  chunkCount: number;
  qualityScore: number;
  warnings?: string[];
  preview: string;
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
  addKnowledgeSource: (
    name: string,
    content: string,
    type: AIKnowledgeSourceType,
    options?: { onIndexProgress?: (progress: { processed: number; total: number; percent: number }) => void }
  ) => Promise<void>;
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
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ apiKey, model, debugMode }));
  } catch (err) {
    console.error('[AIStore] Failed to save settings to localStorage:', err);
  }
}

function normalizeKnowledgeContent(content: string) {
  return content
    .replace(/\r\n/g, '\n')
    .replace(/-\n(?=\p{Ll})/gu, '')
    .replace(/[^\S\n]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function scoreKnowledgeQuality(content: string) {
  const letters = (content.match(/\p{L}/gu) ?? []).length;
  const digits = (content.match(/\p{N}/gu) ?? []).length;
  const spaces = (content.match(/\s/gu) ?? []).length;
  const usefulRatio = (letters + digits + spaces) / Math.max(content.length, 1);
  const newlineRatio = (content.match(/\n/gu) ?? []).length / Math.max(content.length, 1);
  const qualityScore = Math.max(0, Math.min(100, Math.round((usefulRatio * 80) + (Math.min(newlineRatio * 600, 20)))));
  const warnings: string[] = [];

  if (qualityScore < 45) warnings.push('Textul pare extras slab si poate contine zgomot.');
  if (content.length > 350000) warnings.push('Document mare: indexarea poate dura mai mult.');

  return { qualityScore, warnings };
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
  addKnowledgeSource: async (name, content, type, options) => {
    const cleanName = (name || 'Sursa AI').trim().slice(0, 120);
    const normalized = normalizeKnowledgeContent(content);
    if (normalized.length < 20) return;
    const { qualityScore, warnings } = scoreKnowledgeQuality(normalized);
    const sourceId = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
    const chunks = chunkText(normalized, cleanName, normalized.length > 180000 ? 1400 : 1200, normalized.length > 180000 ? 180 : 200);
    
    const entry: AIKnowledgeSource = {
      id: sourceId,
      name: cleanName || 'Sursa AI',
      type,
      addedAt: Date.now(),
      charCount: normalized.length,
      wordCount: normalized.split(/\s+/).filter(Boolean).length,
      chunkCount: chunks.length,
      qualityScore,
      warnings,
      preview: normalized.slice(0, 150),
    };
    
    const next = [...get().knowledgeSources, entry];
    set({ knowledgeSources: next });
    
    await idbSet('ai-knowledge-sources', next);
    
    await addChunksToVault(chunks, cleanName, sourceId, {
      onProgress: options?.onIndexProgress,
    });
  },
  removeKnowledgeSource: async (id) => {
    const target = get().knowledgeSources.find(s => s.id === id);
    const next = get().knowledgeSources.filter((s) => s.id !== id);
    set({ knowledgeSources: next });
    await idbSet('ai-knowledge-sources', next);
    if (target) {
      await removeChunksBySource(target.id);
    }
  },
  clearKnowledgeSources: async () => {
    set({ knowledgeSources: [] });
    await idbSet('ai-knowledge-sources', []);
    await clearVault();
  },
  getKnowledgeContext: async (query, maxChars = 20000) => {
    if (!query || get().knowledgeSources.length === 0) return '';
    
    const results = await retrieveRelevantChunks(query, null, 10);

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
      let loaded: unknown[] = [];
      if (rawOld) {
        const p = JSON.parse(rawOld);
        if (Array.isArray(p.knowledgeSources) && p.knowledgeSources.length > 0) {
          loaded = p.knowledgeSources;
          localStorage.removeItem('studyx-ai');
        }
      } else {
        const idbData = await idbGet<unknown[]>('ai-knowledge-sources');
        if (idbData) loaded = idbData;
      }

      // Migrate legacy sources that might still have 'content' instead of charCount/wordCount
      const migrated: AIKnowledgeSource[] = loaded.map(item => {
        const s = item as Record<string, unknown>; // Cast locally to check properties
        if (s && typeof s === 'object' && 'content' in s) {
          const contentStr = s.content as string;
          return {
            id: s.id as string,
            name: s.name as string,
            type: s.type as AIKnowledgeSourceType,
            addedAt: s.addedAt as number,
            charCount: contentStr.length,
            wordCount: contentStr.split(/\s+/).filter(Boolean).length,
            chunkCount: 0,
            qualityScore: 60,
            preview: contentStr.slice(0, 150)
          };
        }
        const existing = item as AIKnowledgeSource;
        return {
          ...existing,
          chunkCount: existing.chunkCount ?? 0,
          qualityScore: existing.qualityScore ?? 60,
        };
      });

      if (rawOld || migrated.some((s, i) => s !== (loaded[i] as unknown))) {
        await idbSet('ai-knowledge-sources', migrated);
      }

      set({ knowledgeSources: migrated, isHydrated: true });
    } catch {
      set({ knowledgeSources: [], isHydrated: true });
    }
  },
}));

// Hydrate on mount
useAIStore.getState()._hydrate();
