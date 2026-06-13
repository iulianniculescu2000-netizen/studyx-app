import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { chunkDocument } from '../ai/chunker';
import { addChunksToVault, clearVault, removeChunksBySource, searchVault } from '../ai/vectorStore';

export type AIModel =
  | 'llama-3.3-70b-versatile'
  | 'llama-3.1-8b-instant'
  | 'mixtral-8x7b-32768'
  | 'deepseek-chat'
  | 'deepseek-reasoner';

export type AIProvider = 'groq' | 'deepseek';

export type AIKnowledgeSourceType = 'txt' | 'pdf' | 'docx' | 'image';
export type AIKnowledgeSourceStatus = 'indexing' | 'ready' | 'error';

export interface AILibraryFolder {
  id: string;
  name: string;
  emoji: string;
  createdAt: number;
}

export interface AIKnowledgeSource {
  id: string;
  name: string;
  type: AIKnowledgeSourceType;
  preview: string;
  charCount: number;
  wordCount: number;
  chunkCount: number;
  qualityScore: number;
  addedAt: number;
  indexStatus: AIKnowledgeSourceStatus;
  indexProgress: number;
  indexError?: string;
  /** Library folder this course belongs to (null = unfiled). */
  folderId?: string | null;
}

export interface AIResponse {
  id: string;
  content: string;
  confidence: number;
  metadata?: {
    type: 'analysis' | 'recommendation' | 'prediction' | 'generation' | 'general' | 'error';
    category?: string;
    sources?: string[];
  };
  timestamp: Date;
}


export type AIMemoryMode = 'grounded' | 'explain' | 'summarize' | 'diagram' | 'test' | 'mnemonic' | string;

export interface AIStudyMemoryProfile {
  profileId: string;
  createdAt: number;
  updatedAt: number;
  interactions: number;
  modeUsage: Record<string, number>;
  sourceUsage: Record<string, number>;
  activeHours: Record<string, number>;
  signals: {
    likesDiagrams: number;
    likesSummaries: number;
    likesTests: number;
    likesMnemonics: number;
    prefersStepByStep: number;
    asksForExamFocus: number;
    usesLibraryContext: number;
  };
  averagePromptLength: number;
  lastMode?: AIMemoryMode;
  lastSourceName?: string;
  recentTopics: string[];
}

export interface AIInteractionMemoryInput {
  mode: AIMemoryMode;
  prompt: string;
  scopedSourceName?: string | null;
  citationsCount?: number;
}

interface AddKnowledgeSourceOptions {
  onIndexProgress?: (progress: { processed: number; total: number; percent: number }) => void;
}

export interface AIState {
  isProcessing: boolean;
  currentRequest: string | null;
  lastResponse: AIResponse | null;
  error: string | null;
  apiKey: string;
  provider: AIProvider;
  model: AIModel;
  hasKey: boolean;
  isHydrated: boolean;
  knowledgeSources: AIKnowledgeSource[];
  libraryFolders: AILibraryFolder[];
  cache: {
    size: number;
    lastCleared: number | null;
  };
  studyMemory: Record<string, AIStudyMemoryProfile>;
}

export interface AIActions {
  setProcessing: (processing: boolean) => void;
  setCurrentRequest: (request: string | null) => void;
  setLastResponse: (response: AIResponse | null) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  setApiKey: (apiKey: string) => void;
  setProvider: (provider: AIProvider) => void;
  setModel: (model: AIModel) => void;
  setHasKey: (hasKey: boolean) => void;
  addKnowledgeSource: (
    name: string,
    text: string,
    type?: AIKnowledgeSourceType,
    options?: AddKnowledgeSourceOptions,
  ) => Promise<AIKnowledgeSource>;
  removeKnowledgeSource: (sourceId: string) => Promise<void>;
  addLibraryFolder: (name: string, emoji?: string) => string;
  renameLibraryFolder: (folderId: string, name: string) => void;
  deleteLibraryFolder: (folderId: string) => void;
  moveSourceToLibraryFolder: (sourceId: string, folderId: string | null) => void;
  getKnowledgeContext: (query: string, maxChars?: number) => Promise<string>;
  clearCache: () => void;
  updateCacheSize: () => void;
  recordAIInteraction: (profileId: string, input: AIInteractionMemoryInput) => void;
  getAIMemoryContext: (profileId: string) => string;
  clearAIMemory: (profileId?: string) => void;
  markHydrated: () => void;
  reset: () => void;
}

const DEFAULT_MODEL: AIModel = 'llama-3.3-70b-versatile';
const PROVIDER_MODELS: Record<AIProvider, AIModel[]> = {
  groq: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'],
  deepseek: ['deepseek-reasoner', 'deepseek-chat'],
};

function isValidProviderKey(provider: AIProvider, apiKey: string) {
  const trimmed = apiKey.trim();
  if (!trimmed) return false;
  if (provider === 'groq') return trimmed.startsWith('gsk_') && trimmed.length > 20;
  return trimmed.startsWith('sk-') && trimmed.length > 20;
}

function getDefaultModelForProvider(provider: AIProvider): AIModel {
  return provider === 'deepseek' ? 'deepseek-reasoner' : DEFAULT_MODEL;
}

function normalizeProviderModel(provider: AIProvider, model: AIModel | string | undefined): AIModel {
  if (model && PROVIDER_MODELS[provider].includes(model as AIModel)) {
    return model as AIModel;
  }
  return getDefaultModelForProvider(provider);
}

const createDefaultState = (): AIState => ({
  isProcessing: false,
  currentRequest: null,
  lastResponse: null,
  error: null,
  apiKey: '',
  provider: 'groq',
  model: DEFAULT_MODEL,
  hasKey: false,
  isHydrated: false,
  knowledgeSources: [],
  libraryFolders: [],
  cache: {
    size: 0,
    lastCleared: null,
  },
  studyMemory: {},
});

function createMemoryProfile(profileId: string): AIStudyMemoryProfile {
  const now = Date.now();
  return {
    profileId,
    createdAt: now,
    updatedAt: now,
    interactions: 0,
    modeUsage: {},
    sourceUsage: {},
    activeHours: {},
    signals: {
      likesDiagrams: 0,
      likesSummaries: 0,
      likesTests: 0,
      likesMnemonics: 0,
      prefersStepByStep: 0,
      asksForExamFocus: 0,
      usesLibraryContext: 0,
    },
    averagePromptLength: 0,
    recentTopics: [],
  };
}

function incrementSignal(current: number, active: boolean) {
  return active ? Math.min(current + 1, 999) : current;
}

function inferTopics(prompt: string) {
  const cleaned = prompt
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]+/g, ' ');
  const stopWords = new Set([
    'care', 'este', 'sunt', 'vreau', 'pentru', 'despre', 'din', 'prin', 'cum', 'imi', 'explica',
    'rezuma', 'schema', 'testeaza', 'intrebare', 'intrebari', 'curs', 'document', 'the', 'and',
  ]);
  return cleaned
    .split(/\s+/)
    .filter((word) => word.length >= 5 && !stopWords.has(word))
    .slice(0, 4);
}

function buildMemoryContext(memory?: AIStudyMemoryProfile) {
  if (!memory || memory.interactions < 3) return '';

  const n = memory.interactions;
  const instructions: string[] = [];

  // ── Dominant study subject ────────────────────────────────────────────────
  const topSource = Object.entries(memory.sourceUsage)
    .sort((a, b) => b[1] - a[1])[0]?.[0];
  if (topSource) {
    instructions.push(`Subiectul principal de studiu al acestui utilizator este „${topSource}" — ancorează explicațiile în acest domeniu când e posibil.`);
  }

  // ── Response length ───────────────────────────────────────────────────────
  if (memory.averagePromptLength < 50 && n >= 5) {
    instructions.push('Utilizatorul pune întrebări scurte — preferă răspunsuri concise (max 3 paragrafe); nu adăuga context nesolicitat.');
  } else if (memory.averagePromptLength > 130 && n >= 5) {
    instructions.push('Utilizatorul formulează întrebări ample — răspunde structurat și complet, cu titluri și bullet-uri când clarifică.');
  }

  // ── Style signals (activate after 3+ hits for reliability) ────────────────
  const sig = memory.signals;
  if (sig.usesLibraryContext >= 4) {
    instructions.push('Utilizatorul citează des din bibliotecă — ancorează ÎNTOTDEAUNA răspunsul în contextul extras din cursuri; marchează cu „📚" când vine din biblioteca lui.');
  }
  if (sig.likesDiagrams >= 3) instructions.push('Când există un mecanism, diferențial sau algoritm, include OBLIGATORIU o schemă cu săgeți sau tabel compact — nu-l sări.');
  if (sig.likesSummaries >= 3) instructions.push('Termină fiecare răspuns cu o sinteză de 2-3 rânduri cu ideile-cheie.');
  if (sig.likesTests >= 3) instructions.push('După orice explicație, propune spontan 1-2 întrebări rapide de verificare.');
  if (sig.likesMnemonics >= 3) instructions.push('La concepte greu de reținut, adaugă un mnemonic scurt fără să fii cerut.');
  if (sig.prefersStepByStep >= 3) instructions.push('Explică mecanismele pas cu pas (1. → 2. → 3.) înainte de concluzie.');
  if (sig.asksForExamFocus >= 3) instructions.push('Marchează explicit ce e „foarte probabil la examen" și care sunt capcanele frecvente.');

  // ── Dominant chat mode ────────────────────────────────────────────────────
  const topMode = Object.entries(memory.modeUsage).sort((a, b) => b[1] - a[1])[0]?.[0];
  if (topMode && topMode !== 'grounded') {
    const modeHint: Record<string, string> = {
      explain: 'Utilizatorul preferă modul Explică — aprofundează mecanismele chiar dacă nu sunt explicit cerute.',
      diagram: 'Utilizatorul preferă modul Scheme — privilegiază reprezentările vizuale textuale.',
      summarize: 'Utilizatorul preferă sinteze — fii direct și dens, fără introduceri lungi.',
      test: 'Utilizatorul preferă modul Test — poți propune mini-quiz-uri spontan.',
      mnemonic: 'Utilizatorul iubește mnemonicele — include-le la fiecare concept nou.',
    };
    if (modeHint[topMode]) instructions.push(modeHint[topMode]);
  }

  // ── Recent topics ─────────────────────────────────────────────────────────
  const recent = memory.recentTopics.slice(0, 4);
  if (recent.length > 0) {
    instructions.push(`Topicuri studiate recent: ${recent.join(', ')} — folosește-le ca referință pentru analogii și exemple.`);
  }

  if (instructions.length === 0) return '';

  return `PROFIL ÎNVĂȚAT (${n} interacțiuni):\n${instructions.map((i) => `• ${i}`).join('\n')}`;
}

function buildSourcePreview(text: string) {
  return text
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
}

function estimateQualityScore(text: string, chunkCount: number) {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return 0;

  const alphaRatio = normalized.replace(/[^A-Za-zÀ-ž]/g, '').length / normalized.length;
  const wordCount = normalized.split(/\s+/).filter(Boolean).length;
  const densityBonus = Math.min(20, Math.round(wordCount / Math.max(chunkCount, 1)));
  const readabilityBonus = alphaRatio > 0.65 ? 22 : alphaRatio > 0.45 ? 14 : 6;

  return Math.max(25, Math.min(98, 40 + readabilityBonus + densityBonus));
}

function updateSourceEntry(
  sources: AIKnowledgeSource[],
  sourceId: string,
  updater: (source: AIKnowledgeSource) => AIKnowledgeSource,
) {
  return sources.map((source) => (source.id === sourceId ? updater(source) : source));
}

export const useAIStore = create<AIState & AIActions>()(
  devtools(
    persist(
      (set, get) => ({
        ...createDefaultState(),

        setProcessing: (processing) => set({ isProcessing: processing }, false, 'ai/setProcessing'),
        setCurrentRequest: (request) => set({ currentRequest: request }, false, 'ai/setCurrentRequest'),
        setLastResponse: (response) => set({ lastResponse: response }, false, 'ai/setLastResponse'),
        setError: (error) => set({ error }, false, 'ai/setError'),
        clearError: () => set({ error: null }, false, 'ai/clearError'),

        setApiKey: (apiKey) => {
          const trimmed = apiKey.trim();
          const provider = get().provider;
          set({
            apiKey: trimmed,
            hasKey: isValidProviderKey(provider, trimmed),
          }, false, 'ai/setApiKey');
        },

        setProvider: (provider) => {
          const nextModel = getDefaultModelForProvider(provider);
          const apiKey = get().apiKey;
          set({
            provider,
            model: nextModel,
            hasKey: isValidProviderKey(provider, apiKey),
          }, false, 'ai/setProvider');
        },

        setModel: (model) => set({ model }, false, 'ai/setModel'),
        setHasKey: (hasKey) => set({ hasKey }, false, 'ai/setHasKey'),

        addKnowledgeSource: async (name, text, type = 'txt', options = {}) => {
          const sourceId = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
          const now = Date.now();
          const normalizedText = text.trim();
          const preview = buildSourcePreview(normalizedText);
          const wordCount = normalizedText ? normalizedText.split(/\s+/).filter(Boolean).length : 0;

          const pendingSource: AIKnowledgeSource = {
            id: sourceId,
            name,
            type,
            preview,
            charCount: normalizedText.length,
            wordCount,
            chunkCount: 0,
            qualityScore: estimateQualityScore(normalizedText, 1),
            addedAt: now,
            indexStatus: 'indexing',
            indexProgress: 0,
          };

          set((state) => ({
            knowledgeSources: [pendingSource, ...state.knowledgeSources],
          }), false, 'ai/addKnowledgeSource:start');

          try {
            const chunks = await chunkDocument(normalizedText, name, {
              chunkSize: 1500,
              overlap: 200,
              preserveStructure: true,
              minChunkLength: 100,
            });

            await addChunksToVault(chunks, name, sourceId, {
              onProgress: (progress) => {
                options.onIndexProgress?.(progress);
                set((state) => ({
                  knowledgeSources: updateSourceEntry(state.knowledgeSources, sourceId, (source) => ({
                    ...source,
                    indexProgress: progress.percent,
                  })),
                }), false, 'ai/addKnowledgeSource:progress');
              },
            });

            const readySource: AIKnowledgeSource = {
              ...pendingSource,
              chunkCount: chunks.length,
              qualityScore: estimateQualityScore(normalizedText, chunks.length),
              indexStatus: 'ready',
              indexProgress: 100,
            };

            set((state) => ({
              knowledgeSources: updateSourceEntry(state.knowledgeSources, sourceId, () => readySource),
              cache: {
                ...state.cache,
                size: state.cache.size + chunks.length,
              },
            }), false, 'ai/addKnowledgeSource:complete');

            return readySource;
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Indexarea documentului a eșuat.';
            set((state) => ({
              knowledgeSources: updateSourceEntry(state.knowledgeSources, sourceId, (source) => ({
                ...source,
                indexStatus: 'error',
                indexError: message,
                indexProgress: 0,
              })),
            }), false, 'ai/addKnowledgeSource:error');
            throw error;
          }
        },

        removeKnowledgeSource: async (sourceId) => {
          await removeChunksBySource(sourceId);
          set((state) => ({
            knowledgeSources: state.knowledgeSources.filter((source) => source.id !== sourceId),
          }), false, 'ai/removeKnowledgeSource');
          get().updateCacheSize();
        },

        addLibraryFolder: (name, emoji = '📚') => {
          const trimmed = name.trim();
          const id = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
          if (!trimmed) return id;
          set((state) => ({
            libraryFolders: [
              { id, name: trimmed, emoji, createdAt: Date.now() },
              ...state.libraryFolders,
            ],
          }), false, 'ai/addLibraryFolder');
          return id;
        },

        renameLibraryFolder: (folderId, name) => {
          const trimmed = name.trim();
          if (!trimmed) return;
          set((state) => ({
            libraryFolders: state.libraryFolders.map((folder) => (
              folder.id === folderId ? { ...folder, name: trimmed } : folder
            )),
          }), false, 'ai/renameLibraryFolder');
        },

        deleteLibraryFolder: (folderId) => {
          set((state) => ({
            libraryFolders: state.libraryFolders.filter((folder) => folder.id !== folderId),
            knowledgeSources: state.knowledgeSources.map((source) => (
              source.folderId === folderId ? { ...source, folderId: null } : source
            )),
          }), false, 'ai/deleteLibraryFolder');
        },

        moveSourceToLibraryFolder: (sourceId, folderId) => {
          set((state) => ({
            knowledgeSources: state.knowledgeSources.map((source) => (
              source.id === sourceId ? { ...source, folderId } : source
            )),
          }), false, 'ai/moveSourceToLibraryFolder');
        },

        getKnowledgeContext: async (query, maxChars = 6000) => {
          const readySources = get().knowledgeSources.filter((source) => source.indexStatus === 'ready');
          if (readySources.length === 0) return '';

          const chunks = await searchVault(query, 6);
          if (chunks.length === 0) return '';

          let budget = maxChars;
          const parts: string[] = [];

          for (const chunk of chunks) {
            const segment = `[${chunk.source}] ${chunk.text}`.trim();
            if (segment.length > budget) {
              const sliced = segment.slice(0, Math.max(0, budget)).trim();
              if (sliced) parts.push(sliced);
              break;
            }
            parts.push(segment);
            budget -= segment.length + 2;
            if (budget <= 0) break;
          }

          return parts.join('\n\n');
        },

        clearCache: () => {
          void clearVault();
          set((state) => ({
            cache: {
              ...state.cache,
              size: 0,
              lastCleared: Date.now(),
            },
          }), false, 'ai/clearCache');
        },

        updateCacheSize: () => set((state) => ({
          cache: {
            ...state.cache,
            size: state.knowledgeSources.reduce((sum, source) => sum + source.chunkCount, 0),
          },
        }), false, 'ai/updateCacheSize'),

        recordAIInteraction: (profileId, input) => {
          const prompt = input.prompt.trim();
          if (!profileId || !prompt) return;

          set((state) => {
            const current = state.studyMemory[profileId] ?? createMemoryProfile(profileId);
            const nextInteractions = current.interactions + 1;
            const hour = String(new Date().getHours()).padStart(2, '0');
            const lowerPrompt = prompt.toLowerCase();
            const topics = inferTopics(prompt);
            const recentTopics = [
              ...topics,
              ...current.recentTopics.filter((topic) => !topics.includes(topic)),
            ].slice(0, 12);
            const sourceName = input.scopedSourceName?.trim() || current.lastSourceName;

            const nextMemory: AIStudyMemoryProfile = {
              ...current,
              updatedAt: Date.now(),
              interactions: nextInteractions,
              modeUsage: {
                ...current.modeUsage,
                [input.mode]: (current.modeUsage[input.mode] ?? 0) + 1,
              },
              sourceUsage: sourceName
                ? {
                    ...current.sourceUsage,
                    [sourceName]: (current.sourceUsage[sourceName] ?? 0) + 1,
                  }
                : current.sourceUsage,
              activeHours: {
                ...current.activeHours,
                [hour]: (current.activeHours[hour] ?? 0) + 1,
              },
              signals: {
                likesDiagrams: incrementSignal(current.signals.likesDiagrams, input.mode === 'diagram' || /schema|diagram|tabel|algoritm/.test(lowerPrompt)),
                likesSummaries: incrementSignal(current.signals.likesSummaries, input.mode === 'summarize' || /rezuma|sinteza|scurt|idei/.test(lowerPrompt)),
                likesTests: incrementSignal(current.signals.likesTests, input.mode === 'test' || /test|intreba|quiz|grila/.test(lowerPrompt)),
                likesMnemonics: incrementSignal(current.signals.likesMnemonics, input.mode === 'mnemonic' || /mnemonic|retin|memorez/.test(lowerPrompt)),
                prefersStepByStep: incrementSignal(current.signals.prefersStepByStep, input.mode === 'explain' || /pas cu pas|explica|mecanism|de ce/.test(lowerPrompt)),
                asksForExamFocus: incrementSignal(current.signals.asksForExamFocus, /examen|prof|capcana|probabil|cerut/.test(lowerPrompt)),
                usesLibraryContext: incrementSignal(
                  current.signals.usesLibraryContext,
                  (input.citationsCount ?? 0) > 0,
                ),
              },
              averagePromptLength: Math.round(((current.averagePromptLength * current.interactions) + prompt.length) / nextInteractions),
              lastMode: input.mode,
              lastSourceName: sourceName,
              recentTopics,
            };

            return {
              studyMemory: {
                ...state.studyMemory,
                [profileId]: nextMemory,
              },
            };
          }, false, 'ai/recordAIInteraction');
        },

        getAIMemoryContext: (profileId) => buildMemoryContext(get().studyMemory[profileId]),

        clearAIMemory: (profileId) => set((state) => {
          if (!profileId) return { studyMemory: {} };
          const next = { ...state.studyMemory };
          delete next[profileId];
          return { studyMemory: next };
        }, false, 'ai/clearAIMemory'),

        markHydrated: () => set({ isHydrated: true }, false, 'ai/markHydrated'),

        reset: () => {
          void clearVault();
          set({
            ...createDefaultState(),
            isHydrated: true,
          }, false, 'ai/reset');
        },
      }),
      {
        name: 'ai-store',
        partialize: (state) => ({
          apiKey: state.apiKey,
          provider: state.provider,
          model: state.model,
          hasKey: state.hasKey,
          knowledgeSources: state.knowledgeSources,
          libraryFolders: state.libraryFolders,
          cache: state.cache,
          studyMemory: state.studyMemory,
        }),
        onRehydrateStorage: () => (state) => {
          if (!state) return;
          state.provider = state.provider ?? 'groq';
          state.model = normalizeProviderModel(state.provider, state.model);
          state.hasKey = isValidProviderKey(state.provider, state.apiKey);
          state.isHydrated = true;
          state.libraryFolders = state.libraryFolders ?? [];
          state.cache.size = state.knowledgeSources.reduce((sum, source) => sum + source.chunkCount, 0);
          state.studyMemory = state.studyMemory ?? {};
        },
      },
    ),
  ),
);
