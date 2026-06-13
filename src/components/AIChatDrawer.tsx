import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  Bot,
  BookOpen,
  Check,
  ChevronDown,
  FolderOpen,
  ImageIcon,
  Layers3,
  Loader2,
  PanelRightClose,
  PanelRightOpen,
  SendHorizonal,
  Sparkles,
  Square,
  Target,
  Wand2,
  X,
} from 'lucide-react';
import { useTheme } from '../theme/ThemeContext';
import { useUIStore } from '../store/uiStore';
import { useUserStore } from '../store/userStore';
import { useStatsStore } from '../store/statsStore';
import { useQuizStore } from '../store/quizStore';
import { useAIStore } from '../store/aiStore';
import { useFolderStore } from '../store/folderStore';
import { useToastStore } from '../store/toastStore';
import { useAdaptiveMotion } from '../hooks/useAdaptiveMotion';
import { useViewportProfile } from '../hooks/useViewportProfile';
import { buildPerformanceSummary, buildUserContextString } from '../lib/aiContext';
import { isDocumentHidden } from '../lib/asyncGuard';
import { generateQuizPackagesFromSource } from '../lib/ai/batchQuizGeneration';
import {
  STUDIO_MAX_PACK_COUNT,
  STUDIO_MAX_QUESTIONS_PER_PACK,
  clampStudioPackCount,
  clampStudioQuestionCount,
} from '../lib/ai/studioGeneration';
import {
  buildStudioCommandHelp,
  parseStudioChatCommand,
  resolveStudioFolderFromCommand,
  resolveStudioSourceFromCommand,
} from '../lib/ai/studioChatCommands';
import {
  describeStep,
  executeAgentPlan,
  looksLikeAgentCommand,
  planAgentCommand,
  type AgentPlan,
} from '../lib/ai/agent';
import { useAgentJobsStore } from '../store/agentJobsStore';
import { desktopNotify } from '../lib/desktopNotify';
import { getWeakTopicsForProfile } from '../ai/UserProfile';
import type { Folder } from '../types';
import AgentJobCard from './ai-chat/AgentJobCard';
import {
  CHAT_MODES,
  buildFollowUpSuggestions,
  buildRecommendedActions,
  formatMessage,
  getContextState,
  type ChatMessage,
  type ChatMode,
  type Citation,
} from './ai-chat/shared';

let aiChatRuntimePromise: Promise<{
  generateChatResponse: typeof import('../ai/AIEngine').generateChatResponse;
  generateChatResponseStream: typeof import('../ai/AIEngine').generateChatResponseStream;
  retrieveRelevantChunks: typeof import('../ai/retriever').retrieveRelevantChunks;
  getVaultChunksBySource: typeof import('../ai/vectorStore').getVaultChunksBySource;
}> | null = null;

function loadAIChatRuntime() {
  if (!aiChatRuntimePromise) {
    aiChatRuntimePromise = Promise.all([
      import('../ai/AIEngine'),
      import('../ai/retriever'),
      import('../ai/vectorStore'),
    ]).then(([engine, retriever, vectorStore]) => ({
      generateChatResponse: engine.generateChatResponse,
      generateChatResponseStream: engine.generateChatResponseStream,
      retrieveRelevantChunks: retriever.retrieveRelevantChunks,
      getVaultChunksBySource: vectorStore.getVaultChunksBySource,
    }));
  }

  return aiChatRuntimePromise;
}

type DrawerView = 'chat' | 'studio';
type StudioDifficulty = 'auto' | 'easy' | 'medium' | 'hard';
type StudioOption = {
  value: string;
  label: string;
  hint?: string;
};

function diversifyChunks<T extends { source: string; score: number }>(
  chunks: T[],
  limit: number,
): T[] {
  const bySource = new Map<string, T[]>();
  for (const chunk of chunks) {
    const group = bySource.get(chunk.source) ?? [];
    group.push(chunk);
    bySource.set(chunk.source, group);
  }
  const result: T[] = [];
  for (const group of bySource.values()) {
    if (result.length >= Math.min(3, limit)) break;
    result.push(group[0]);
  }
  for (const chunk of chunks) {
    if (result.length >= limit) break;
    if (!result.includes(chunk)) result.push(chunk);
  }
  return result;
}

function extractRelevantExcerpt(chunkText: string, query: string, maxLen = 220): string {
  const clean = chunkText.replace(/\s+/g, ' ').trim();
  const sentences = clean.match(/[^.!?]+[.!?]*/g) ?? [clean];
  const queryWords = new Set(
    query.toLowerCase().split(/\s+/).filter((w) => w.length > 3),
  );
  let bestSentence = sentences[0];
  let bestScore = -1;
  for (const sentence of sentences) {
    const lower = sentence.toLowerCase();
    const matches = [...queryWords].filter((w) => lower.includes(w)).length;
    if (matches > bestScore) {
      bestScore = matches;
      bestSentence = sentence;
    }
  }
  const idx = clean.indexOf(bestSentence);
  if (idx >= 0) {
    return clean.slice(Math.max(0, idx - 10), idx + bestSentence.length + 60).slice(0, maxLen);
  }
  return clean.slice(0, maxLen);
}

function formatFolderPath(folders: Folder[], folder: Folder) {
  const byId = new Map(folders.map((item) => [item.id, item]));
  const names = [folder.name];
  let parent = folder.parentId ? byId.get(folder.parentId) : undefined;
  const guard = new Set([folder.id]);
  while (parent && !guard.has(parent.id)) {
    guard.add(parent.id);
    names.unshift(parent.name);
    parent = parent.parentId ? byId.get(parent.parentId) : undefined;
  }
  return names.join(' / ');
}

function StudioSelect({
  label,
  value,
  onChange,
  options,
  placeholder,
  theme,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: StudioOption[];
  placeholder: string;
  theme: ReturnType<typeof useTheme>;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value) ?? null;
  const isDisabled = options.length === 0;

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: theme.text3 }}>
        {label}
      </span>
      <button
        type="button"
        onClick={() => {
          if (!isDisabled) {
            setOpen((current) => !current);
          }
        }}
        disabled={isDisabled}
        className="flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all"
        style={{
          background: theme.surface,
          borderColor: open ? `${theme.accent}55` : theme.border,
          color: theme.text,
          boxShadow: open ? `0 0 0 1px ${theme.accent}20` : 'none',
          opacity: isDisabled ? 0.55 : 1,
        }}
      >
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">
            {selected?.label ?? placeholder}
          </div>
          <div className="mt-0.5 truncate text-[11px]" style={{ color: theme.text3 }}>
            {selected?.hint ?? (isDisabled ? 'Nu există opțiuni disponibile.' : 'Apasă pentru a alege.')}
          </div>
        </div>
        <motion.div animate={{ rotate: open ? 180 : 0 }} style={{ color: theme.text3 }}>
          <ChevronDown size={16} />
        </motion.div>
      </button>

      <AnimatePresence>
        {open && !isDisabled && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-30 rounded-[22px] border p-2 shadow-2xl"
            style={{
              background: theme.isDark ? 'rgba(22,22,30,0.96)' : 'rgba(255,255,255,0.96)',
              borderColor: theme.border,
              backdropFilter: 'blur(18px) saturate(155%)',
            }}
          >
            <div className="custom-scrollbar max-h-56 space-y-1 overflow-y-auto">
              {options.map((option) => {
                const active = option.value === value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                    className="flex w-full items-center gap-3 rounded-[18px] px-3 py-2.5 text-left transition-all"
                    style={{
                      background: active ? `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})` : 'transparent',
                      color: active ? '#fff' : theme.text,
                    }}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">
                        {option.label}
                      </div>
                      {option.hint && (
                        <div className="mt-0.5 truncate text-[11px]" style={{ color: active ? 'rgba(255,255,255,0.76)' : theme.text3 }}>
                          {option.hint}
                        </div>
                      )}
                    </div>
                    {active && <Check size={15} />}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function AIChatDrawer() {
  const theme = useTheme();
  const open = useUIStore((state) => state.chatOpen);
  const setChatOpen = useUIStore((state) => state.setChatOpen);
  const floatingUiSuppressed = useUIStore((state) => state.floatingUILocks.length > 0);
  const activeProfileId = useUserStore((state) => state.activeProfileId);
  const quizzes = useQuizStore((state) => state.quizzes);
  const addQuiz = useQuizStore((state) => state.addQuiz);
  const knowledgeSources = useAIStore((state) => state.knowledgeSources);
  const hasKey = useAIStore((state) => state.hasKey);
  const recordAIInteraction = useAIStore((state) => state.recordAIInteraction);
  const memoryContext = useAIStore((state) => (
    activeProfileId ? state.getAIMemoryContext(activeProfileId) : ''
  ));
  const memoryInteractions = useAIStore((state) =>
    activeProfileId ? (state.studyMemory[activeProfileId]?.interactions ?? 0) : 0
  );
  const folders = useFolderStore((state) => state.folders);
  const addFolder = useFolderStore((state) => state.addFolder);
  const addToast = useToastStore((state) => state.addToast);
  const questionStats = useStatsStore((state) => state.questionStats);
  const streak = useStatsStore((state) => state.streak);
  const getDueQuestions = useStatsStore((state) => state.getDueQuestions);
  const getAccuracy = useStatsStore((state) => state.getAccuracy);
  const getStatsByTag = useStatsStore((state) => state.getStatsByTag);
  const { calmMotion, performanceLite } = useAdaptiveMotion();
  const { mobile } = useViewportProfile();

  // Cache context chunks per (text+sourceId) within a session to avoid redundant vault lookups.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contextCacheRef = useRef<Map<string, any[]>>(new Map());

  // v2: bumped to clear old messages with malformed citation.topic === citation.source
  const CHAT_STORAGE_KEY = 'studyx:chat:messages:v2';
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const stored = localStorage.getItem('studyx:chat:messages:v2');
      if (!stored) return [];
      return JSON.parse(stored) as ChatMessage[];
    } catch {
      return [];
    }
  });
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<ChatMode>('grounded');
  const [manualMode, setManualMode] = useState(false);
  const [scopedSource, setScopedSource] = useState<{ id: string; name: string } | null>(null);
  const [activeCitationKey, setActiveCitationKey] = useState<string | null>(null);
  const [view, setView] = useState<DrawerView>('chat');
  const [studioSourceId, setStudioSourceId] = useState<string>('');
  const [studioFolderId, setStudioFolderId] = useState<string>('__uncategorized__');
  const [studioPackCount, setStudioPackCount] = useState(4);
  const [studioQuestionsPerPack, setStudioQuestionsPerPack] = useState(12);
  const [studioDifficulty, setStudioDifficulty] = useState<StudioDifficulty>('auto');
  const [studioGenerating, setStudioGenerating] = useState(false);
  const [generatedSummary, setGeneratedSummary] = useState<string | null>(null);
  const [pastedImage, setPastedImage] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const streamAbortRef = useRef<AbortController | null>(null);
  const pendingAgentPlansRef = useRef<Map<string, AgentPlan>>(new Map());
  const agentUndoRef = useRef<Map<string, (() => void) | null>>(new Map());

  const activeModeConfig = useMemo(
    () => CHAT_MODES.find((entry) => entry.id === mode) ?? CHAT_MODES[0],
    [mode],
  );

  const performanceSummary = useMemo(
    () => buildPerformanceSummary(questionStats, streak, getDueQuestions, getAccuracy, getStatsByTag, quizzes),
    [getAccuracy, getDueQuestions, getStatsByTag, questionStats, quizzes, streak],
  );

  const weakTopics = useMemo(() => {
    const answeredCount = Object.keys(questionStats).length;
    const quizCount = quizzes.length;
    const streakCount = streak.currentStreak;
    if (!activeProfileId || (answeredCount === 0 && quizCount === 0 && streakCount === 0)) {
      return [];
    }
    return getWeakTopicsForProfile(activeProfileId).slice(0, 4);
  }, [activeProfileId, questionStats, quizzes.length, streak.currentStreak]);

  const studyContext = useMemo(() => {
    const baseContext = buildUserContextString(performanceSummary);
    const focusText = weakTopics.length > 0
      ? `Focus recomandat acum: ${weakTopics.map((topic) => `${topic.topic} ${topic.accuracy}%`).join(', ')}.`
      : '';
    return [baseContext, focusText, memoryContext].filter(Boolean).join(' ');
  }, [memoryContext, performanceSummary, weakTopics]);

  const recommendedActions = useMemo(
    () => buildRecommendedActions(weakTopics, performanceSummary.dueCount, scopedSource?.name),
    [performanceSummary.dueCount, scopedSource?.name, weakTopics],
  );

  const smartMode = useMemo<ChatMode>(() => {
    if (scopedSource) return 'summarize';
    if (performanceSummary.dueCount > 0) return 'summarize';
    return 'grounded';
  }, [performanceSummary.dueCount, scopedSource]);

  const readySources = useMemo(
    () => knowledgeSources.filter((source) => source.indexStatus === 'ready'),
    [knowledgeSources],
  );

  const selectedStudioSourceId = studioSourceId || scopedSource?.id || readySources[0]?.id || '';
  const selectedStudioSource = readySources.find((source) => source.id === selectedStudioSourceId) ?? null;
  const selectedStudioFolder = studioFolderId === '__uncategorized__'
    ? null
    : folders.find((folder) => folder.id === studioFolderId) ?? null;
  const studioSourceOptions = useMemo<StudioOption[]>(
    () => readySources.map((source) => ({
      value: source.id,
      label: source.name,
      hint: `${source.chunkCount ?? 0} fragmente indexate`,
    })),
    [readySources],
  );
  const studioFolderOptions = useMemo<StudioOption[]>(
    () => [
      {
        value: '__uncategorized__',
        label: 'Neclasificate',
        hint: 'Grilele rămân fără folder dedicat.',
      },
      ...folders.map((folder) => ({
        value: folder.id,
        label: `${folder.emoji} ${formatFolderPath(folders, folder)}`,
        hint: 'Salvează pachetele direct în acest folder.',
      })),
    ],
    [folders],
  );

  useEffect(() => {
    if (!selectedStudioSourceId && readySources[0]) {
      setStudioSourceId(readySources[0].id);
    }
  }, [readySources, selectedStudioSourceId]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{
        prompt?: string;
        mode?: ChatMode;
        open?: boolean;
        sourceId?: string;
        sourceName?: string;
        resetConversation?: boolean;
        view?: DrawerView;
      }>).detail;

      if (!detail?.prompt) return;
      if (detail.open) setChatOpen(true);
      if (detail.view) setView(detail.view);

      if (detail.resetConversation) {
        setMessages([]);
        setActiveCitationKey(null);
        setManualMode(false);
        contextCacheRef.current.clear();
      }

      if (detail.sourceId && detail.sourceName) {
        setScopedSource({ id: detail.sourceId, name: detail.sourceName });
        setStudioSourceId(detail.sourceId);
        contextCacheRef.current.clear();
      } else if (detail.resetConversation) {
        setScopedSource(null);
      }

      if (detail.mode) {
        setMode(detail.mode);
        setManualMode(true);
      }

      setInput(detail.prompt);
      requestAnimationFrame(() => textareaRef.current?.focus());
    };

    window.addEventListener('studyx:ai-prompt', handler as EventListener);
    return () => window.removeEventListener('studyx:ai-prompt', handler as EventListener);
  }, [setChatOpen]);

  useEffect(() => {
    if (open) {
      chatEndRef.current?.scrollIntoView({ behavior: calmMotion ? 'auto' : 'smooth' });
    }
  }, [messages, open, calmMotion]);

  useEffect(() => {
    try {
      const toSave = messages.slice(-60);
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(toSave));
    } catch {
      // quota exceeded — ignore
    }
  }, [CHAT_STORAGE_KEY, messages]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = '0px';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 128)}px`;
  }, [input]);

  useEffect(() => {
    if (!open || manualMode || mode === smartMode) return;
    setMode(smartMode);
  }, [manualMode, mode, open, smartMode]);

  const buildScopedContext = async (text: string, sourceIdOverride?: string | null) => {
    const { retrieveRelevantChunks, getVaultChunksBySource } = await loadAIChatRuntime();
    const targetSourceId = sourceIdOverride ?? scopedSource?.id ?? null;

    if (!targetSourceId) {
      const candidates = await retrieveRelevantChunks(text, null, 8);
      return diversifyChunks(candidates, 5);
    }

    const source = readySources.find((entry) => entry.id === targetSourceId) ?? scopedSource;
    const scopedChunks = await retrieveRelevantChunks(text, null, 5, { sourceIds: [targetSourceId] });
    if (scopedChunks.length > 0) {
      return scopedChunks.slice(0, 5);
    }

    const fallbackChunks = await getVaultChunksBySource(targetSourceId);
    return fallbackChunks.slice(0, 5).map((chunk) => ({
      id: chunk.id,
      text: chunk.text,
      topic: chunk.topic,
      source: source?.name ?? chunk.source,
      difficulty: chunk.difficulty,
      score: 1,
      keywordScore: 1,
      semanticScore: 1,
      recencyBoost: 0,
      weaknessBoost: 0,
    }));
  };

  const runStudioGeneration = async ({
    source,
    folder,
    packCount,
    questionsPerPack,
    difficulty,
    announceInChat = true,
    forceChatView = true,
    announceMode = 'summarize',
  }: {
    source: NonNullable<typeof selectedStudioSource>;
    folder: typeof selectedStudioFolder;
    packCount: number;
    questionsPerPack: number;
    difficulty: StudioDifficulty;
    announceInChat?: boolean;
    forceChatView?: boolean;
    announceMode?: ChatMode;
  }) => {
    setStudioGenerating(true);
    setGeneratedSummary(null);
    setStudioSourceId(source.id);
    setScopedSource({ id: source.id, name: source.name });
    setStudioFolderId(folder?.id ?? '__uncategorized__');
    setStudioPackCount(packCount);
    setStudioQuestionsPerPack(questionsPerPack);
    setStudioDifficulty(difficulty);

    try {
      const result = await generateQuizPackagesFromSource({
        sourceId: source.id,
        sourceName: source.name,
        folder,
        folderId: folder?.id ?? null,
        packCount,
        questionsPerPack,
        difficulty,
        activeProfileId,
        existingQuizzes: quizzes,
      });

      result.quizzes.forEach((quiz) => addQuiz(quiz));

      const folderLabel = folder?.name ?? 'Neclasificate';
      const summary = result.fallbackQuestionCount > 0
        ? `Am generat ${result.quizzes.length} pachete din "${source.name}" și le-am trimis în folderul "${folderLabel}". ${result.aiQuestionCount} întrebări au venit din AI, iar ${result.fallbackQuestionCount} au fost completate inteligent din document pentru stabilitate. Dificultate folosită: ${result.difficulty}.`
        : `Am generat ${result.quizzes.length} pachete din "${source.name}" și le-am trimis în folderul "${folderLabel}". Dificultate folosită: ${result.difficulty}.`;
      const fullSummary = result.warnings.length > 0
        ? `${summary}\n\nNotă: ${result.warnings[0]}`
        : summary;

      setGeneratedSummary(fullSummary);
      if (announceInChat) {
        setMessages((prev) => [...prev, { role: 'assistant', content: fullSummary, mode: announceMode }]);
      }
      addToast(
        result.fallbackQuestionCount > 0
          ? `${result.quizzes.length} pachete generate. Am completat inteligent și local ce nu a livrat AI-ul.`
          : `${result.quizzes.length} pachete generate cu succes.`,
        'success',
      );
      if (forceChatView) {
        setView('chat');
      }
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Generarea pachetelor a eșuat.';
      addToast(message, 'error');
      if (announceInChat) {
        setMessages((prev) => [...prev, { role: 'assistant', content: `Eroare: ${message}`, mode: announceMode }]);
      }
      return false;
    } finally {
      setStudioGenerating(false);
    }
  };

  const runAgentJob = async (jobId: string) => {
    const plan = pendingAgentPlansRef.current.get(jobId);
    if (!plan) return;
    const jobs = useAgentJobsStore.getState();
    jobs.setJobStatus(jobId, 'running');

    const result = await executeAgentPlan(
      plan,
      { defaultPackCount: studioPackCount, defaultQuestionsPerPack: studioQuestionsPerPack },
      {
        onStep: (index, status, detail) => {
          useAgentJobsStore.getState().setStepStatus(jobId, `s${index}`, status, detail);
        },
      },
    );

    agentUndoRef.current.set(jobId, result.undo);
    const failedAll = result.errors.length > 0 && result.createdQuizIds.length === 0;
    jobs.setJobStatus(jobId, failedAll ? 'error' : 'done', result.summary);

    // If the plan generated a study plan text, surface it in chat now (after execution)
    const studyPlanText = plan.reply && plan.steps.some(s => s.action === 'create_study_plan') ? plan.reply : null;
    pendingAgentPlansRef.current.delete(jobId);

    addToast(result.summary, failedAll ? 'error' : result.errors.length ? 'warning' : 'success');
    if (isDocumentHidden() || !open) {
      void desktopNotify('StudyX — agent', result.summary);
    }

    if (studyPlanText && !failedAll) {
      setMessages((prev) => [...prev, { role: 'assistant', content: studyPlanText }]);
    }
  };

  const tryHandleAgentCommand = async (text: string, activeMode: ChatMode): Promise<boolean> => {
    if (!hasKey || !looksLikeAgentCommand(text)) return false;

    let plan: AgentPlan;
    try {
      plan = await planAgentCommand(text);
    } catch {
      return false;
    }
    if (!plan.isCommand || plan.steps.length === 0) return false;

    const steps = plan.steps.map((step, index) => ({
      id: `s${index}`,
      label: describeStep(step),
      status: 'pending' as const,
    }));
    const jobId = useAgentJobsStore.getState().createJob(
      text,
      steps,
      plan.needsConfirm ? 'awaiting-confirm' : 'running',
    );
    if (plan.needsConfirm) {
      useAgentJobsStore.getState().setJobStatus(jobId, 'awaiting-confirm', plan.confirmReason);
    }
    pendingAgentPlansRef.current.set(jobId, plan);

    setMessages((prev) => [...prev, {
      role: 'assistant',
      content: plan.reply || (plan.needsConfirm ? 'Am pregătit un plan. Confirmă ca să îl execut.' : 'Execut planul...'),
      mode: activeMode,
      agentJobId: jobId,
    }]);

    if (!plan.needsConfirm) {
      await runAgentJob(jobId);
    }
    return true;
  };

  const cancelAgentJob = (jobId: string) => {
    pendingAgentPlansRef.current.delete(jobId);
    useAgentJobsStore.getState().setJobStatus(jobId, 'cancelled', 'Anulat de utilizator.');
  };

  const undoAgentJob = (jobId: string) => {
    const undo = agentUndoRef.current.get(jobId);
    if (!undo) return;
    undo();
    agentUndoRef.current.delete(jobId);
    useAgentJobsStore.getState().setJobStatus(jobId, 'cancelled', 'Acțiunile au fost anulate (undo).');
    addToast('Am anulat acțiunile agentului.', 'info');
  };

  const tryHandleStudioCommand = async (text: string, activeMode: ChatMode) => {
    const parsed = parseStudioChatCommand(text);
    if (!parsed.shouldGenerate) return false;

    setView('studio');

    if (readySources.length === 0) {
      const message = `Nu ai încă documente indexate în Biblioteca AI, deci nu am din ce să generez grile.\n\nÎncarcă un curs în Bibliotecă și apoi poți scrie direct aici comanda.\n\n${buildStudioCommandHelp([], folders)}`;
      setMessages((prev) => [...prev, { role: 'assistant', content: message, mode: activeMode }]);
      addToast('Încarcă mai întâi un curs în Biblioteca AI.', 'warning');
      return true;
    }

    const scopedReadySource = scopedSource
      ? readySources.find((entry) => entry.id === scopedSource.id) ?? null
      : null;
    const source = resolveStudioSourceFromCommand(text, readySources, scopedReadySource);
    if (!source) {
      const sourceList = readySources.slice(0, 6).map((entry) => `- ${entry.name}`).join('\n');
      const message = `Am înțeles că vrei să generez pachete de grile, dar nu e clar din ce document.\n\nSpune-mi explicit cursul sau documentul dorit. Exemple disponibile acum:\n${sourceList}\n\n${buildStudioCommandHelp(readySources, folders)}`;
      setMessages((prev) => [...prev, { role: 'assistant', content: message, mode: activeMode }]);
      addToast('Spune-mi și documentul din care vrei să generez.', 'warning');
      return true;
    }

    const folderResolution = resolveStudioFolderFromCommand(text, folders, selectedStudioFolder);
    let targetFolder = selectedStudioFolder;

    if (folderResolution.kind === 'existing') {
      targetFolder = folderResolution.folder;
    } else if (folderResolution.kind === 'create') {
      const id = addFolder(folderResolution.name, '📚', 'blue');
      targetFolder = {
        id,
        name: folderResolution.name,
        emoji: '📚',
        color: 'blue',
        createdAt: Date.now(),
      };
      addToast(`Am creat folderul "${folderResolution.name}".`, 'success');
    } else {
      targetFolder = null;
    }

    const nextPackCount = clampStudioPackCount(parsed.packCount ?? studioPackCount);
    const nextQuestionCount = clampStudioQuestionCount(parsed.questionsPerPack ?? studioQuestionsPerPack);
    const nextDifficulty = parsed.difficulty ?? studioDifficulty;

    await runStudioGeneration({
      source,
      folder: targetFolder,
      packCount: nextPackCount,
      questionsPerPack: nextQuestionCount,
      difficulty: nextDifficulty,
      announceInChat: true,
      forceChatView: true,
      announceMode: activeMode,
    });

    return true;
  };

  const stopGeneration = () => {
    streamAbortRef.current?.abort();
    streamAbortRef.current = null;
  };

  const sendMessage = async (overrideText?: string, modeOverride?: ChatMode) => {
    const text = (overrideText || input).trim();
    if ((!text && !pastedImage) || loading) return;

    const activeMode = modeOverride ?? mode;
    const imageSnapshot = pastedImage;
    const userMsg: ChatMessage = { role: 'user', content: text || '📷 Imagine atașată', mode: activeMode };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setPastedImage(null);
    setLoading(true);
    setActiveCitationKey(null);
    // recordAIInteraction is called after citations are available (below in the streaming path).

    const abortCtrl = new AbortController();
    streamAbortRef.current = abortCtrl;

    try {
      const agentHandled = !imageSnapshot && await tryHandleAgentCommand(text, activeMode);
      if (agentHandled) return;

      const commandHandled = !imageSnapshot && await tryHandleStudioCommand(text, activeMode);
      if (commandHandled) return;

      // ── Vision path: user pasted an image ────────────────────────────────
      if (imageSnapshot) {
        const { groqVisionRequest, supportsVision } = await import('../lib/groq');
        const { useAIStore: store } = await import('../store/aiStore');
        if (!supportsVision(store.getState().provider)) {
          addToast('Vision necesită Groq. Schimbă providerul în Setări AI.', 'warning');
          setMessages((prev) => [...prev, {
            role: 'assistant',
            content: '⚠️ Analiza imaginilor necesită Groq ca provider. Schimbă în Setări AI.',
          }]);
          return;
        }
        setMessages((prev) => [...prev, { role: 'assistant', content: '', mode: activeMode }]);
        const visionPrompt = text
          ? `${text}\n\nContextul imaginii atașate:`
          : 'Analizează această imagine medicală/clinică. Descrie ce observi, ce diagnostic sau interpretare sugerezi, și ce aspecte sunt relevante pentru un student la medicină.';
        const visionResponse = await groqVisionRequest(imageSnapshot, visionPrompt, abortCtrl.signal);
        const words = visionResponse.split(' ');
        let current = '';
        for (let i = 0; i < words.length; i += 10) {
          current += (current ? ' ' : '') + words.slice(i, i + 10).join(' ');
          setMessages((prev) => {
            const next = [...prev];
            next[next.length - 1] = { ...next[next.length - 1], content: current };
            return next;
          });
          if (i + 10 < words.length) await new Promise((r) => setTimeout(r, 30));
        }
        return;
      }

      // ── Regular streaming chat path ───────────────────────────────────────
      const { generateChatResponseStream } = await loadAIChatRuntime();
      const contextCacheKey = `${text.slice(0, 120)}::${scopedSource?.id ?? ''}`;
      const cachedChunks = contextCacheRef.current.get(contextCacheKey);
      const contextChunks = cachedChunks ?? await buildScopedContext(text);
      if (!cachedChunks) contextCacheRef.current.set(contextCacheKey, contextChunks);
      // Build one citation per source document, keeping the highest-scoring chunk excerpt.
      const citationsBySource = new Map<string, Citation>();
      for (const chunk of contextChunks) {
        const existing = citationsBySource.get(chunk.source);
        if (!existing || chunk.score > existing.score) {
          citationsBySource.set(chunk.source, {
            source: chunk.source,
            topic: chunk.topic,
            score: chunk.score,
            excerpt: extractRelevantExcerpt(chunk.text, text),
          });
        }
      }
      const citations = [...citationsBySource.values()]
        .sort((a, b) => b.score - a.score)
        .slice(0, 4);

      const contextSummary = contextChunks
        .map((chunk, i) => `${i === 0 ? '⭐ ' : ''}[Sursă: ${chunk.source} | Relevanță: ${(chunk.score * 100).toFixed(0)}%]\n${chunk.text}`)
        .join('\n\n---\n\n');

      const historyForAI = [...messages.slice(-14), userMsg]
        .slice(-8)
        .map(({ role, content }) => ({ role, content }));
      const scopePrefix = scopedSource ? `Document țintă: ${scopedSource.name}\n` : '';

      const suggestions = buildFollowUpSuggestions(
        text,
        citations,
        activeMode,
        scopedSource?.name,
        weakTopics[0]?.topic,
      );

      if (activeProfileId) {
        recordAIInteraction(activeProfileId, {
          mode: activeMode,
          prompt: text,
          scopedSourceName: scopedSource?.name,
          citationsCount: citations.length,
        });
      }

      // Add empty assistant message then fill it via streaming.
      setMessages((prev) => [...prev, { role: 'assistant', content: '', citations, suggestions, mode: activeMode }]);

      await generateChatResponseStream(
        text,
        `${scopePrefix}${contextSummary}`,
        historyForAI,
        (chunk) => {
          if (abortCtrl.signal.aborted) return;
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last.role === 'assistant') {
              next[next.length - 1] = { ...last, content: last.content + chunk };
            }
            return next;
          });
        },
        {
          mode: activeMode,
          hasContext: contextChunks.length > 0,
          scopedSourceName: scopedSource?.name,
          studyContext,
          focusTopics: weakTopics.map((topic) => topic.topic),
        },
        abortCtrl.signal,
      );

      // If stream finished but produced no content (API hiccup), show a fallback.
      if (!abortCtrl.signal.aborted) {
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last.role === 'assistant' && !last.content.trim()) {
            next[next.length - 1] = { ...last, content: 'Nu am primit un răspuns de la AI. Verifică conexiunea și încearcă din nou.' };
          }
          return next;
        });
      }
    } catch (err: unknown) {
      if (err instanceof Error && (err.name === 'AbortError' || err.message.includes('aborted'))) return;
      const errorMessage = err instanceof Error ? err.message : 'Nu am putut genera un răspuns.';
      setMessages((prev) => [...prev, { role: 'assistant', content: `Eroare: ${errorMessage}` }]);
    } finally {
      streamAbortRef.current = null;
      setLoading(false);
    }
  };

  const handleGeneratePackages = async () => {
    if (!selectedStudioSource) {
      addToast('Alege mai întâi un document din bibliotecă.', 'warning');
      return;
    }

    await runStudioGeneration({
      source: selectedStudioSource,
      folder: selectedStudioFolder,
      packCount: studioPackCount,
      questionsPerPack: studioQuestionsPerPack,
      difficulty: studioDifficulty,
      announceInChat: true,
      forceChatView: true,
    });
  };

  const closeChat = () => {
    setChatOpen(false);
    setScopedSource(null);
    setActiveCitationKey(null);
    setManualMode(false);
    setView('chat');
    contextCacheRef.current.clear();
  };

  const renderMessageList = (compact = false) => {
    const threadMessages = messages;

    return (
    <div className={compact ? 'space-y-4' : 'space-y-5'}>
      {threadMessages.length === 0 ? (
        <div className={`text-center ${compact ? 'py-6' : 'py-8'}`}>
          <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="mb-5 text-5xl">
            🧠
          </motion.div>
          <h4 className="mb-2 text-[1.25rem] font-black tracking-tight" style={{ color: theme.text }}>
            Cu ce te pot ajuta?
          </h4>
          <p className="mb-6 text-sm font-medium leading-relaxed opacity-70" style={{ color: theme.text }}>
            {mode === 'grounded'
              ? 'Îți răspund pe baza bibliotecii tale, explic concepte medicale și păstrez contextul util pentru examen.'
              : `Ești în modul „${activeModeConfig.label}”. Îți adaptez răspunsul la stilul de lucru ales, fără să pierd contextul util.`}
          </p>

          {(recommendedActions.length > 0 || weakTopics.length > 0 || performanceSummary.dueCount > 0) && (
            <div
              className="luxe-card mb-5 rounded-[24px] p-4 text-left"
              style={{ background: theme.surface2, border: `1px solid ${theme.border}` }}
            >
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="citation-pill inline-flex items-center gap-1.5">
                  <Sparkles size={12} />
                  Focus recomandat
                </span>
                {performanceSummary.dueCount > 0 && (
                  <span className="premium-chip rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em]" style={{ color: theme.text3 }}>
                    {performanceSummary.dueCount} de recapitulat
                  </span>
                )}
                {weakTopics[0] && (
                  <span className="premium-chip rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em]" style={{ color: theme.text3 }}>
                    {weakTopics[0].topic} · {weakTopics[0].accuracy}%
                  </span>
                )}
              </div>

              <div className="grid gap-2.5">
                {recommendedActions.map((action) => (
                  <button
                    key={action.label}
                    onClick={() => {
                      setMode(action.mode);
                      setManualMode(true);
                      void sendMessage(action.prompt, action.mode);
                    }}
                    className="premium-card-hover flex items-center justify-between rounded-[20px] border px-4 py-3 text-left press-feedback"
                    style={{ background: theme.surface, borderColor: theme.border, color: theme.text }}
                  >
                    <div className="min-w-0 pr-3">
                      <div className="text-[11px] font-black uppercase tracking-[0.16em]" style={{ color: theme.text }}>
                        {action.label}
                      </div>
                      <div className="mt-1 text-xs font-medium opacity-65" style={{ color: theme.text }}>
                        {action.helper}
                      </div>
                    </div>
                    <div
                      className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-2xl"
                      style={{ background: `${action.mode === 'test' ? theme.danger : action.mode === 'mnemonic' ? theme.warning : theme.accent}16` }}
                    >
                      <Target
                        size={16}
                        color={action.mode === 'test' ? theme.danger : action.mode === 'mnemonic' ? theme.warning : theme.accent}
                      />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-2.5 px-1">
            {activeModeConfig.emptyPrompts.map((item, index) => (
              <motion.button
                key={item}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + index * 0.08 }}
                onClick={() => void sendMessage(item, mode)}
                className="premium-card-hover w-full rounded-[20px] border p-4 text-left text-[11px] font-black uppercase tracking-wider transition-all press-feedback"
                style={{ background: theme.surface2, borderColor: theme.border, color: theme.text }}
              >
                {item}
              </motion.button>
            ))}
          </div>
        </div>
      ) : (
        <>
          {threadMessages.map((message, index) => {
            const isLastAssistant = message.role === 'assistant' && index === threadMessages.length - 1;
            return (
              <motion.div
                key={`${message.role}-${index}`}
                initial={{ opacity: 0, y: 10, scale: 0.985 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[88%] rounded-[24px] p-4 text-sm leading-relaxed shadow-sm ${message.role === 'user' ? 'text-white' : ''}`}
                  style={{
                    background: message.role === 'user' ? `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})` : theme.surface2,
                    color: message.role === 'user' ? '#fff' : theme.text,
                    borderRadius: message.role === 'user' ? '24px 24px 8px 24px' : '24px 24px 24px 8px',
                    border: message.role === 'assistant' ? `1px solid ${theme.border}` : 'none',
                    boxShadow: message.role === 'user' ? `0 10px 24px ${theme.accent}24` : '0 8px 18px rgba(0,0,0,0.04)',
                  }}
                >
                  {isLastAssistant && loading ? (
                    <>
                      <span className="font-medium" dangerouslySetInnerHTML={{ __html: formatMessage(message.content) }} />
                      <span className="streaming-cursor" style={{ color: theme.accent }}>▌</span>
                    </>
                  ) : (
                    <span className="font-medium" dangerouslySetInnerHTML={{ __html: formatMessage(message.content) }} />
                  )}

                  {message.role === 'assistant' && message.agentJobId && (
                    <div className="mt-3">
                      <AgentJobCard
                        jobId={message.agentJobId}
                        theme={theme}
                        onConfirm={() => void runAgentJob(message.agentJobId!)}
                        onCancel={() => cancelAgentJob(message.agentJobId!)}
                        onUndo={() => undoAgentJob(message.agentJobId!)}
                      />
                    </div>
                  )}

                  {message.role === 'assistant' && message.mode && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="citation-pill">
                        Modul {CHAT_MODES.find((entry) => entry.id === message.mode)?.label ?? message.mode}
                      </span>
                    </div>
                  )}

                  {message.role === 'assistant' && message.citations && message.citations.length > 0 && (
                    <div className="mt-4">
                      <div className="mb-2 flex flex-wrap gap-2">
                        <span className="citation-pill">{getContextState(message.citations)}</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {message.citations.map((citation) => {
                          const citationKey = `${index}-${citation.source}-${citation.topic}`;
                          const isActiveCitation = activeCitationKey === citationKey;
                          return (
                            <button
                              key={citationKey}
                              onClick={() => setActiveCitationKey(isActiveCitation ? null : citationKey)}
                              className="citation-pill transition-all"
                              style={{
                                background: isActiveCitation ? `${theme.accent}18` : undefined,
                                borderColor: isActiveCitation ? `${theme.accent}30` : undefined,
                                color: isActiveCitation ? theme.accent : undefined,
                              }}
                            >
                              {citation.source} · {(citation.score * 100).toFixed(0)}%
                            </button>
                          );
                        })}
                      </div>
                      {message.citations.map((citation) => {
                        const citationKey = `${index}-${citation.source}-${citation.topic}`;
                        if (activeCitationKey !== citationKey) return null;
                        return (
                          <div
                            key={`${citationKey}-excerpt`}
                            className="mt-3 rounded-[18px] p-3 text-xs leading-6"
                            style={{ background: theme.surface, border: `1px solid ${theme.border}`, color: theme.text2 }}
                          >
                            <div className="mb-1 text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: theme.text3 }}>
                              Fragment relevant
                            </div>
                            {citation.excerpt}
                            {citation.excerpt.length >= 220 ? '…' : ''}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {message.role === 'assistant' && (!message.citations || message.citations.length === 0) && (
                    <div className="mt-4">
                      <span className="citation-pill">Răspuns general</span>
                    </div>
                  )}

                  {isLastAssistant && message.suggestions && message.suggestions.length > 0 && !loading && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {message.suggestions.map((suggestion) => (
                        <button
                          key={suggestion}
                          onClick={() => void sendMessage(suggestion, message.mode ?? mode)}
                          className="rounded-full px-3 py-1.5 text-[11px] font-semibold transition-all"
                          style={{ background: theme.surface, color: theme.text2, border: `1px solid ${theme.border}` }}
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}

          {loading && threadMessages[threadMessages.length - 1]?.role === 'user' && (
            <div className="flex justify-start">
              <div
                className="rounded-[22px] border p-4"
                style={{ background: theme.surface2, borderColor: theme.border }}
              >
                <Loader2 size={18} className="animate-spin opacity-40" />
              </div>
            </div>
          )}
        </>
      )}
      <div ref={chatEndRef} />
    </div>
    );
  };

  const drawerWidth = view === 'studio'
    ? (mobile ? 'min(600px, calc(100vw - 20px))' : 'min(1080px, calc(100vw - 28px))')
    : (mobile ? 'min(520px, calc(100vw - 20px))' : 'min(560px, calc(100vw - 28px))');
  const drawerHeight = view === 'studio' ? 'min(88vh, 880px)' : 'min(85vh, 860px)';

  if (floatingUiSuppressed && !open) {
    return null;
  }

  return (
    <>
      {!open && (
        <motion.button
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          whileHover={calmMotion ? undefined : { scale: 1.08, y: -2 }}
          whileTap={calmMotion ? undefined : { scale: 0.92 }}
          onClick={() => setChatOpen(true)}
          aria-label="Deschide chatul AI"
          className="fixed bottom-6 right-6 z-[9998] flex h-14 w-14 items-center justify-center rounded-[22px] text-white shadow-2xl press-feedback"
          style={{
            background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})`,
            boxShadow: `0 10px 30px ${theme.accent}45, 0 2px 8px rgba(0,0,0,0.12)`,
            backdropFilter: performanceLite ? 'blur(8px)' : 'blur(14px)',
          }}
        >
          <Bot size={28} />
          <motion.div
            animate={calmMotion ? undefined : { scale: [1, 1.18, 1], opacity: [0.45, 1, 0.45] }}
            transition={calmMotion ? undefined : { repeat: Infinity, duration: 2 }}
            className="absolute -right-1 -top-1 h-4 w-4 rounded-full border-2 border-white"
            style={{ background: theme.success }}
          />
        </motion.button>
      )}

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeChat}
              className="fixed inset-0 z-[9996] bg-black/18"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.985 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.985 }}
              transition={calmMotion ? { duration: 0.2, ease: 'easeOut' } : { duration: 0.28, ease: [0.2, 0.9, 0.28, 1] }}
              className="assistant-sheet fixed bottom-5 right-5 z-[9999] flex flex-col overflow-hidden rounded-[34px]"
              style={{
                width: drawerWidth,
                height: drawerHeight,
                background: theme.isDark ? 'rgba(18,18,22,0.88)' : 'rgba(252,252,255,0.88)',
                backdropFilter: performanceLite ? 'blur(14px) saturate(124%)' : calmMotion ? 'blur(16px) saturate(132%)' : 'blur(30px) saturate(165%)',
                border: `1px solid ${theme.border}`,
                boxShadow: performanceLite ? '0 18px 36px rgba(0,0,0,0.14)' : calmMotion ? '0 20px 44px rgba(0,0,0,0.16)' : '0 28px 80px rgba(0,0,0,0.22), 0 6px 20px rgba(0,0,0,0.08)',
              }}
            >
              <div className="sheet-handle" />
              <div className="relative z-10 flex h-full flex-col">
                <div className="flex items-center gap-3 border-b px-5 py-4" style={{ borderColor: theme.border }}>
                  <div
                    className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-[18px] shadow-xl"
                    style={{ background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})`, color: '#fff' }}
                  >
                    <Bot size={22} />
                    <motion.div
                      animate={calmMotion ? undefined : { x: ['-100%', '200%'] }}
                      transition={calmMotion ? undefined : { repeat: Infinity, duration: 2.4, ease: 'linear' }}
                      className="absolute inset-0 bg-white/20 skew-x-[-20deg]"
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-black tracking-tight" style={{ color: theme.text }}>StudyX AI</h3>
                      <div className="flex items-center gap-1 rounded-full px-2 py-0.5"
                        style={{ background: `${theme.success}18`, border: `1px solid ${theme.success}30` }}>
                        <div className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: theme.success }} />
                        <span className="text-[10px] font-bold" style={{ color: theme.success }}>Online</span>
                      </div>
                    </div>
                    <p className="mt-0.5 text-[11px] font-medium truncate" style={{ color: theme.text3 }}>
                      {view === 'studio'
                        ? 'Generare grile și pachete din cursuri'
                        : scopedSource
                          ? `Focus activ: ${scopedSource.name}`
                          : weakTopics[0]
                            ? `Arii slabe: ${weakTopics.slice(0, 2).map(t => t.topic).join(', ')}`
                            : memoryInteractions >= 3
                              ? `Te cunoaște după ${memoryInteractions} interacțiuni`
                              : 'Asistent calibrat pe profilul tău de studiu'}
                    </p>
                  </div>

                  <div className="hidden items-center gap-2 rounded-full border px-2 py-1.5 sm:flex" style={{ borderColor: theme.border, background: theme.surface2 }}>
                    {([
                      { id: 'chat', label: 'Chat', icon: <PanelRightClose size={14} /> },
                      { id: 'studio', label: 'Studio', icon: <PanelRightOpen size={14} /> },
                    ] as const).map((entry) => {
                      const active = view === entry.id;
                      return (
                        <button
                          key={entry.id}
                          onClick={() => setView(entry.id)}
                          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em]"
                          style={{
                            background: active ? `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})` : 'transparent',
                            color: active ? '#fff' : theme.text3,
                          }}
                        >
                          {entry.icon}
                          {entry.label}
                        </button>
                      );
                    })}
                  </div>

                  <motion.button
                    whileHover={calmMotion ? undefined : { rotate: 90, scale: 1.08 }}
                    whileTap={calmMotion ? undefined : { scale: 0.92 }}
                    onClick={closeChat}
                    aria-label="Inchide chatul AI"
                    className="rounded-2xl p-2.5 transition-colors hover:bg-white/5 press-feedback"
                    style={{ color: theme.text3 }}
                  >
                    <X size={20} />
                  </motion.button>
                </div>


                {view === 'studio' ? (
                  <div className={`grid min-h-0 flex-1 ${mobile ? 'grid-cols-1' : 'grid-cols-[minmax(0,1.15fr)_340px]'}`}>
                    <div className="custom-scrollbar min-h-0 overflow-y-auto px-6 py-5">
                      {scopedSource && (
                        <div
                          className="mb-4 rounded-[24px] border p-4"
                          style={{ background: theme.surface2, borderColor: theme.border }}
                        >
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            <span className="citation-pill inline-flex items-center gap-1.5">
                              <BookOpen size={12} />
                              Sursă activă
                            </span>
                            <span className="premium-chip rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em]" style={{ color: theme.text3 }}>
                              {scopedSource.name}
                            </span>
                          </div>
                          <p className="text-sm leading-relaxed" style={{ color: theme.text }}>
                            Poți discuta liber despre documentul selectat și, din panoul din dreapta, să generezi pachete de grile direct în folderul ales.
                          </p>
                        </div>
                      )}
                      {renderMessageList(true)}
                    </div>

                    <div className="custom-scrollbar min-h-0 overflow-y-auto border-l px-5 py-5" style={{ borderColor: theme.border, background: 'rgba(255,255,255,0.02)' }}>
                      <div
                        className="rounded-[28px] border p-4"
                        style={{ background: theme.surface2, borderColor: theme.border }}
                      >
                        <div className="mb-3 flex items-center gap-2">
                          <div className="flex h-10 w-10 items-center justify-center rounded-2xl" style={{ background: `${theme.accent}18`, color: theme.accent }}>
                            <Wand2 size={18} />
                          </div>
                          <div>
                            <div className="text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: theme.text3 }}>
                              AI Studio
                            </div>
                            <div className="text-sm font-black" style={{ color: theme.text }}>
                              Pachete smart din curs
                            </div>
                          </div>
                        </div>

                        <p className="mb-4 text-xs leading-6" style={{ color: theme.text2 }}>
                          Încarci cursul în bibliotecă, alegi documentul și StudyX îți generează batch-uri de grile adaptate profilului tău, apoi le trimite direct în folderul ales.
                        </p>

                        <div className="space-y-4">
                          <StudioSelect
                            label="Document sursă"
                            value={selectedStudioSourceId}
                            onChange={(nextValue) => {
                              setStudioSourceId(nextValue);
                              const nextSource = readySources.find((source) => source.id === nextValue);
                              if (nextSource) {
                                setScopedSource({ id: nextSource.id, name: nextSource.name });
                                contextCacheRef.current.clear();
                              }
                            }}
                            options={studioSourceOptions}
                            placeholder="Nu există documente indexate"
                            theme={theme}
                          />

                          <StudioSelect
                            label="Folder țintă"
                            value={studioFolderId}
                            onChange={setStudioFolderId}
                            options={studioFolderOptions}
                            placeholder="Alege unde salvăm pachetele"
                            theme={theme}
                          />

                          <div className="grid grid-cols-2 gap-3">
                            <label className="block">
                              <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: theme.text3 }}>
                                Pachete
                              </span>
                              <input
                                type="number"
                                min={1}
                                max={STUDIO_MAX_PACK_COUNT}
                                value={studioPackCount}
                                onChange={(event) => setStudioPackCount(clampStudioPackCount(Number(event.target.value) || 1))}
                                className="w-full rounded-2xl border px-4 py-3 text-sm font-semibold outline-none"
                                style={{ background: theme.surface, borderColor: theme.border, color: theme.text }}
                              />
                            </label>

                            <label className="block">
                              <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: theme.text3 }}>
                                Întrebări / pachet
                              </span>
                              <input
                                type="number"
                                min={3}
                                max={STUDIO_MAX_QUESTIONS_PER_PACK}
                                value={studioQuestionsPerPack}
                                onChange={(event) => setStudioQuestionsPerPack(clampStudioQuestionCount(Number(event.target.value) || 3))}
                                className="w-full rounded-2xl border px-4 py-3 text-sm font-semibold outline-none"
                                style={{ background: theme.surface, borderColor: theme.border, color: theme.text }}
                              />
                            </label>
                          </div>

                          <div>
                            <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: theme.text3 }}>
                              Dificultate
                            </span>
                            <div className="grid grid-cols-2 gap-2">
                              {([
                                { id: 'auto', label: 'Auto' },
                                { id: 'easy', label: 'Ușor' },
                                { id: 'medium', label: 'Mediu' },
                                { id: 'hard', label: 'Dificil' },
                              ] as const).map((entry) => {
                                const active = studioDifficulty === entry.id;
                                return (
                                  <button
                                    key={entry.id}
                                    onClick={() => setStudioDifficulty(entry.id)}
                                    className="rounded-2xl px-3 py-2 text-xs font-black uppercase tracking-[0.14em]"
                                    style={{
                                      background: active ? `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})` : theme.surface,
                                      border: `1px solid ${active ? 'transparent' : theme.border}`,
                                      color: active ? '#fff' : theme.text,
                                    }}
                                  >
                                    {entry.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          <div className="grid gap-2">
                            <div className="rounded-[20px] border px-4 py-3" style={{ background: theme.surface, borderColor: theme.border }}>
                              <div className="text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: theme.text3 }}>
                                Motor de adaptare
                              </div>
                              <div className="mt-2 text-xs leading-6" style={{ color: theme.text2 }}>
                                {weakTopics[0]
                                  ? `AI-ul ține cont de tema vulnerabilă "${weakTopics[0].topic}" și îți ajustează accentul de generare.`
                                  : 'AI-ul folosește documentul selectat și preferințele actuale pentru a genera pachete curate.'}
                              </div>
                              <div className="mt-2 text-[11px] leading-5" style={{ color: theme.text3 }}>
                                Poți cere până la {STUDIO_MAX_PACK_COUNT} pachete și {STUDIO_MAX_QUESTIONS_PER_PACK} întrebări per pachet. Dacă un apel AI cade, StudyX completează inteligent din document ca să nu pierzi sesiunea.
                              </div>
                            </div>

                            <div className="rounded-[20px] border px-4 py-3" style={{ background: theme.surface, borderColor: theme.border }}>
                              <div className="text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: theme.text3 }}>
                                Destinație
                              </div>
                              <div className="mt-2 flex items-center gap-2 text-sm font-semibold" style={{ color: theme.text }}>
                                <FolderOpen size={14} style={{ color: theme.accent }} />
                                {selectedStudioFolder ? `${selectedStudioFolder.emoji} ${selectedStudioFolder.name}` : 'Neclasificate'}
                              </div>
                            </div>
                          </div>

                          <button
                            onClick={() => void handleGeneratePackages()}
                            disabled={!selectedStudioSource || studioGenerating}
                            className="press-feedback flex w-full items-center justify-center gap-2 rounded-[22px] px-5 py-3.5 text-sm font-black text-white disabled:opacity-45"
                            style={{
                              background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})`,
                              boxShadow: `0 18px 30px ${theme.accent}24`,
                            }}
                          >
                            {studioGenerating ? (
                              <>
                                <Loader2 size={16} className="animate-spin" />
                                Generez pachetele...
                              </>
                            ) : (
                              <>
                                <Layers3 size={16} />
                                Generează pachetele
                              </>
                            )}
                          </button>

                          {generatedSummary && (
                            <div
                              className="rounded-[20px] border px-4 py-3 text-xs leading-6"
                              style={{ background: `${theme.success}10`, borderColor: `${theme.success}25`, color: theme.text }}
                            >
                              {generatedSummary}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    className="custom-scrollbar flex-1 overflow-y-auto px-6 py-5"
                    style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.04), transparent 28%)' }}
                  >
                    {renderMessageList()}
                  </div>
                )}

                <div
                  className="border-t px-4 pt-3 pb-4"
                  style={{ borderColor: theme.border, background: theme.isDark ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.6)' }}
                >
                  <div className="rounded-[24px] p-1" style={{ background: theme.surface2, border: `1px solid ${theme.border}`, boxShadow: `0 2px 12px ${theme.accent}08` }}>
                    {pastedImage && (
                      <div className="relative mx-2 mt-2 mb-1 inline-block">
                        <img
                          src={pastedImage}
                          alt="Imagine atașată"
                          className="h-16 w-auto max-w-[160px] rounded-[12px] object-cover"
                          style={{ border: `1px solid ${theme.border}` }}
                        />
                        <button
                          onClick={() => setPastedImage(null)}
                          className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border text-white"
                          style={{ background: theme.danger, borderColor: theme.surface }}
                        >
                          <X size={10} />
                        </button>
                      </div>
                    )}
                    <div className="relative flex items-end gap-2 rounded-[20px] border px-4 py-3 transition-all"
                      style={{ borderColor: `${theme.accent}30`, background: theme.surface }}>
                      <textarea
                        ref={textareaRef}
                        rows={2}
                        value={input}
                        onChange={(event) => setInput(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' && !event.shiftKey) {
                            event.preventDefault();
                            void sendMessage();
                          }
                        }}
                        onPaste={(event) => {
                          const items = Array.from(event.clipboardData.items);
                          const imgItem = items.find((item) => item.type.startsWith('image/'));
                          if (!imgItem) return;
                          event.preventDefault();
                          const file = imgItem.getAsFile();
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = () => setPastedImage(reader.result as string);
                          reader.readAsDataURL(file);
                        }}
                        placeholder={view === 'studio'
                          ? 'Discută despre document, capcane, ce vrei să generezi...'
                          : activeModeConfig.placeholder}
                        className="custom-scrollbar max-h-36 min-h-[44px] flex-1 resize-none border-none bg-transparent p-0 text-sm font-medium leading-relaxed outline-none focus:ring-0"
                        style={{ color: theme.text, cursor: 'text' }}
                      />
                      {loading ? (
                        <motion.button
                          whileHover={calmMotion ? undefined : { scale: 1.06 }}
                          whileTap={calmMotion ? undefined : { scale: 0.9 }}
                          onClick={stopGeneration}
                          aria-label="Oprește generarea"
                          title="Oprește generarea"
                          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[14px] transition-all press-feedback"
                          style={{ background: `${theme.danger}18`, color: theme.danger }}
                        >
                          <Square size={14} />
                        </motion.button>
                      ) : (
                        <motion.button
                          whileHover={calmMotion ? undefined : { scale: 1.06 }}
                          whileTap={calmMotion ? undefined : { scale: 0.9 }}
                          onClick={() => void sendMessage()}
                          disabled={!input.trim() && !pastedImage}
                          aria-label="Trimite mesajul"
                          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[14px] transition-all press-feedback"
                          style={{
                            background: (input.trim() || pastedImage) ? `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})` : `${theme.accent}18`,
                            color: (input.trim() || pastedImage) ? '#fff' : theme.accent,
                            boxShadow: (input.trim() || pastedImage) ? `0 6px 14px ${theme.accent}40` : 'none',
                            cursor: (input.trim() || pastedImage) ? 'pointer' : 'default',
                          }}
                        >
                          {pastedImage && !input.trim() ? <ImageIcon size={16} /> : <SendHorizonal size={16} />}
                        </motion.button>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2 px-3 py-1.5">
                      <div className="flex items-center gap-1.5 overflow-x-auto min-w-0">
                        {CHAT_MODES.map((entry) => {
                          const active = entry.id === mode;
                          return (
                            <button
                              key={entry.id}
                              onClick={() => { setMode(entry.id); setManualMode(true); }}
                              className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] whitespace-nowrap transition-all"
                              style={{
                                background: active ? `${theme.accent}20` : 'transparent',
                                color: active ? theme.accent : theme.text3,
                                border: `1px solid ${active ? `${theme.accent}40` : 'transparent'}`,
                              }}
                            >
                              {entry.shortLabel}
                            </button>
                          );
                        })}
                      </div>
                      {messages.length > 0 && (
                        <button
                          onClick={() => {
                            setMessages([]);
                            setActiveCitationKey(null);
                            try { localStorage.removeItem(CHAT_STORAGE_KEY); } catch { /* ignore */ }
                          }}
                          className="shrink-0 text-[10px] font-semibold transition-opacity hover:opacity-80"
                          style={{ color: theme.text3 }}
                        >Golește</button>
                      )}
                    </div>

                    {view === 'studio' && readySources.length > 0 && (
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 px-2 pb-1">
                        <div className="text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: theme.text3 }}>
                          Shortcut studio
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => {
                              setView('chat');
                              setMode('diagram');
                              setManualMode(true);
                              if (selectedStudioSource) {
                                setScopedSource({ id: selectedStudioSource.id, name: selectedStudioSource.name });
                                setInput(`Fă-mi o schemă logică din documentul "${selectedStudioSource.name}", cu noduri de examen și capcane.`);
                              }
                            }}
                            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em]"
                            style={{ background: theme.surface, border: `1px solid ${theme.border}`, color: theme.text2 }}
                          >
                            Schema
                            <ArrowRight size={12} />
                          </button>
                          <button
                            onClick={() => {
                              setView('chat');
                              setMode('summarize');
                              setManualMode(true);
                              if (selectedStudioSource) {
                                setScopedSource({ id: selectedStudioSource.id, name: selectedStudioSource.name });
                                setInput(`Rezumă-mi documentul "${selectedStudioSource.name}" în idei-cheie și capcane de examen.`);
                              }
                            }}
                            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em]"
                            style={{ background: theme.surface, border: `1px solid ${theme.border}`, color: theme.text2 }}
                          >
                            Rezumat
                            <ArrowRight size={12} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
