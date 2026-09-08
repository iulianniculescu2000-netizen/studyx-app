import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  Bot,
  BookOpen,
  ChevronDown,
  Copy,
  CreditCard,
  FolderOpen,
  ImageIcon,
  Info,
  Layers3,
  ListChecks,
  Loader2,
  Maximize2,
  Minimize2,
  MoreHorizontal,
  PanelRightClose,
  PanelRightOpen,
  RotateCcw,
  SendHorizonal,
  Sparkles,
  Square,
  Target,
  Trash2,
  Wand2,
  X,
} from 'lucide-react';
import { useTheme } from '../theme/ThemeContext';
import { useUIStore } from '../store/uiStore';
import { useUserStore } from '../store/userStore';
import { useStatsStore } from '../store/statsStore';
import { useQuizStore } from '../store/quizStore';
import { useAIStore } from '../store/aiStore';
import { useToastStore } from '../store/toastStore';
import { useAgentJobsStore } from '../store/agentJobsStore';
import { useAdaptiveMotion } from '../hooks/useAdaptiveMotion';
import { useViewportProfile } from '../hooks/useViewportProfile';
import { buildPerformanceSummary, buildUserContextString } from '../lib/aiContext';
import { WHOLE_DOCUMENT_HEADING } from '../lib/ai/chapterQuizGeneration';
import {
  STUDIO_MAX_PACK_COUNT,
  STUDIO_MAX_QUESTIONS_PER_PACK,
  clampStudioPackCount,
  clampStudioQuestionCount,
} from '../lib/ai/studioGeneration';
import { detectChatIntent, shouldApplyIntent } from '../lib/ai/intentRouter';
import { EXAM_STYLE_META, type ExamStyle } from '../lib/ai/examStyle';
import { getProfileSummaryText, getWeakTopicsForProfile } from '../ai/UserProfile';
import type { Question, Quiz } from '../types';
import GlassCard from './ui/GlassCard';
import AgentJobCard from './ai-chat/AgentJobCard';
import AIOrb from './ai-chat/AIOrb';
import FreeKeysNotice from './ai-chat/FreeKeysNotice';
import StudioSelect from './ai-chat/StudioSelect';
import { diversifyChunks, extractRelevantExcerpt } from './ai-chat/chatHelpers';
import { CHAT_STORAGE_KEY, useChatMessages } from './ai-chat/useChatMessages';
import { useChatThread } from './ai-chat/useChatThread';
import { useScopedSource } from './ai-chat/useScopedSource';
import { useAgentCommands } from './ai-chat/useAgentCommands';
import { useStudioGeneration } from './ai-chat/useStudioGeneration';
import {
  CHAT_MODES,
  buildFollowUpSuggestions,
  buildProactiveGreeting,
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
  summarizeConversation: typeof import('../ai/AIEngine').summarizeConversation;
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
      summarizeConversation: engine.summarizeConversation,
      retrieveRelevantChunks: retriever.retrieveRelevantChunks,
      getVaultChunksBySource: vectorStore.getVaultChunksBySource,
    }));
  }

  return aiChatRuntimePromise;
}

// Once a thread passes this many messages, older turns are compressed into a
// running summary so we keep continuity without resending the whole transcript.
const CONVERSATION_SUMMARY_THRESHOLD = 12;
const CONVERSATION_RECENT_KEEP = 6;

type DrawerView = 'chat' | 'studio';

export default function AIChatDrawer() {
  const theme = useTheme();
  const open = useUIStore((state) => state.chatOpen);
  const setChatOpen = useUIStore((state) => state.setChatOpen);
  const floatingUiSuppressed = useUIStore((state) => state.floatingUILocks.length > 0);
  // job.result lives in the global store (not local component state) so the
  // "jump straight in" CTA survives this drawer unmounting mid-job — see the
  // comment on AgentJob.result in agentJobsStore.ts.
  const agentJobs = useAgentJobsStore((state) => state.jobs);
  const activeProfileId = useUserStore((state) => state.activeProfileId);
  const quizzes = useQuizStore((state) => state.quizzes);
  const addQuiz = useQuizStore((state) => state.addQuiz);
  const knowledgeSources = useAIStore((state) => state.knowledgeSources);
  const hasKey = useAIStore((state) => state.hasKey);
  const providerKeys = useAIStore((state) => state.providerKeys);
  const recordAIInteraction = useAIStore((state) => state.recordAIInteraction);
  const memoryContext = useAIStore((state) => (
    activeProfileId ? state.getAIMemoryContext(activeProfileId) : ''
  ));
  const memoryInteractions = useAIStore((state) =>
    activeProfileId ? (state.studyMemory[activeProfileId]?.interactions ?? 0) : 0
  );
  const addToast = useToastStore((state) => state.addToast);
  const questionStats = useStatsStore((state) => state.questionStats);
  const streak = useStatsStore((state) => state.streak);
  const getDueQuestions = useStatsStore((state) => state.getDueQuestions);
  const getAccuracy = useStatsStore((state) => state.getAccuracy);
  const getStatsByTag = useStatsStore((state) => state.getStatsByTag);
  const { calmMotion, performanceLite } = useAdaptiveMotion();
  const { mobile } = useViewportProfile();

  const { scopedSource, setScopedSource, contextCacheRef } = useScopedSource();
  // Rezidențiat gets its own isolated conversation, live anywhere inside that
  // section (the Residency page, its folders, its quizzes) — not just on
  // the /rezidentiat route itself.
  const chatThread = useChatThread();
  const { messages, setMessages, messagesRef, chatEndRef } = useChatMessages({ open, calmMotion, thread: chatThread });
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [thinkingPhase, setThinkingPhase] = useState<string | null>(null);
  const [mode, setMode] = useState<ChatMode>('grounded');
  const [manualMode, setManualMode] = useState(false);
  const [modePickerOpen, setModePickerOpen] = useState(false);
  const navigate = useNavigate();
  const [activeCitationKey, setActiveCitationKey] = useState<string | null>(null);
  const [view, setView] = useState<DrawerView>('chat');
  /** Studio's "how it works" intro + the two static info cards, collapsed by default so the drawer opens straight to the controls you actually use. */
  const [studioInfoOpen, setStudioInfoOpen] = useState(false);
  /** Chat sheet widened to studio size — schemas and tables need the room. */
  const [wideChat, setWideChat] = useState(false);
  /** Secondary header controls (widen, regenerate, clear) live behind one "⋯" instead of competing icons. */
  const [overflowMenuOpen, setOverflowMenuOpen] = useState(false);
  /** Markup of a schema/table opened full-screen from a message. */
  const [zoomedBlock, setZoomedBlock] = useState<string | null>(null);
  const [pastedImage, setPastedImage] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const streamAbortRef = useRef<AbortController | null>(null);
  // Set when the user hits Stop — lets non-abortable generators (flashcards /
  // grile) discard their result instead of surprising the user after a stop.
  const generationAbortedRef = useRef(false);
  // Running compressed summary of older turns + how many messages it covers.
  const conversationSummaryRef = useRef<string>('');
  const summaryCoveredCountRef = useRef<number>(0);
  const summarizingRef = useRef<boolean>(false);

  const readySources = useMemo(
    () => knowledgeSources.filter((source) => source.indexStatus === 'ready'),
    [knowledgeSources],
  );

  const {
    setStudioSourceId,
    studioHeading, setStudioHeading,
    studioFolderId, setStudioFolderId,
    studioPackCount, setStudioPackCount,
    studioQuestionsPerPack, setStudioQuestionsPerPack,
    studioDifficulty, setStudioDifficulty,
    studioExamStyle, setStudioExamStyle,
    studioGenerating, setStudioGenerating,
    generatedSummary,
    selectedStudioSourceId,
    selectedStudioSource,
    selectedStudioFolder,
    studioChapterOptions,
    studioSourceOptions,
    studioFolderOptions,
    tryHandleStudioCommand,
    tryHandleFlashcardCommand,
    handleGeneratePackages,
  } = useStudioGeneration({
    readySources,
    hasKey,
    activeProfileId,
    scopedSource,
    setScopedSource,
    contextCacheRef,
    setMessages,
    setThinkingPhase,
    setView,
    generationAbortedRef,
    loadAIChatRuntime,
  });

  const {
    runAgentJob,
    tryHandleAgentCommand,
    tryHandleAnswerDispute,
    cancelAgentJob,
    editAgentStepParams,
    undoAgentJob,
    retryAgentJob,
  } = useAgentCommands({
    hasKey,
    messagesRef,
    setMessages,
    setThinkingPhase,
    studioPackCount,
    studioQuestionsPerPack,
    chatThread,
  });

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
    const longTermMemory = activeProfileId ? getProfileSummaryText(activeProfileId) : '';
    const longTermText = longTermMemory ? `Memorie pe termen lung: ${longTermMemory}` : '';
    return [baseContext, focusText, memoryContext, longTermText].filter(Boolean).join(' ');
  }, [activeProfileId, memoryContext, performanceSummary, weakTopics]);

  const recommendedActions = useMemo(
    () => buildRecommendedActions(weakTopics, performanceSummary.dueCount, scopedSource?.name),
    [performanceSummary.dueCount, scopedSource?.name, weakTopics],
  );

  const smartMode = useMemo<ChatMode>(() => {
    if (scopedSource) return 'summarize';
    if (performanceSummary.dueCount > 0) return 'summarize';
    return 'grounded';
  }, [performanceSummary.dueCount, scopedSource]);


  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{
        prompt?: string;
        mode?: ChatMode;
        open?: boolean;
        sourceId?: string;
        sourceName?: string;
        heading?: string;
        resetConversation?: boolean;
        view?: DrawerView;
        examStyle?: 'residency';
      }>).detail;

      if (!detail?.prompt) return;
      if (detail.open) setChatOpen(true);
      if (detail.view) setView(detail.view);
      // Explicit request (Residency page) — the Studio's exam-style track is
      // its own toggle, not derived from the prompt text, so a chapter
      // generation dispatched as exam-scoped has to set it directly.
      if (detail.examStyle) setStudioExamStyle(detail.examStyle);
      // Only a chapter-scoped event may move the Studio's chapter selection.
      // Resetting unconditionally meant any plain chat prompt ("Discută
      // răspunsul", "Debrief cu AI Coach") silently threw away a chapter the
      // user had picked in Studio.
      if (detail.heading) setStudioHeading(detail.heading);
      else if (detail.sourceId) setStudioHeading(WHOLE_DOCUMENT_HEADING);

      if (detail.resetConversation) {
        setMessages([]);
        setActiveCitationKey(null);
        setManualMode(false);
        contextCacheRef.current.clear();
        conversationSummaryRef.current = '';
        summaryCoveredCountRef.current = 0;
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
  }, [contextCacheRef, setChatOpen, setMessages, setScopedSource, setStudioHeading, setStudioSourceId, setStudioExamStyle]);

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

  const stopGeneration = () => {
    // Abort the streaming chat if one is live…
    streamAbortRef.current?.abort();
    streamAbortRef.current = null;
    // …and signal the non-streaming generators (flashcards / grile) to drop their
    // result, then release the UI immediately so the button always does something.
    generationAbortedRef.current = true;
    setLoading(false);
    setThinkingPhase(null);
    setStudioGenerating(false);
  };

  // Background context compression: once the thread is long, fold all but the
  // most recent turns into a running summary. Non-blocking — runs after a reply.
  const maybeCompressConversation = async () => {
    if (summarizingRef.current) return;
    const current = messagesRef.current;
    if (current.length < CONVERSATION_SUMMARY_THRESHOLD) return;
    if (current.length - summaryCoveredCountRef.current < CONVERSATION_RECENT_KEEP) return;

    const cutoff = current.length - CONVERSATION_RECENT_KEEP;
    const olderSlice = current
      .slice(0, cutoff)
      .filter((m) => !m.agentJobId && m.content.trim())
      .map(({ role, content }) => ({ role, content }));
    if (olderSlice.length === 0) return;

    summarizingRef.current = true;
    try {
      const { summarizeConversation } = await loadAIChatRuntime();
      const summary = await summarizeConversation(olderSlice, conversationSummaryRef.current);
      if (summary) {
        conversationSummaryRef.current = summary;
        summaryCoveredCountRef.current = cutoff;
      }
    } catch {
      // best-effort — keep the previous summary
    } finally {
      summarizingRef.current = false;
    }
  };

  const sendMessage = async (overrideText?: string, modeOverride?: ChatMode) => {
    const text = (overrideText || input).trim();
    if ((!text && !pastedImage) || loading) return;
    generationAbortedRef.current = false;

    // Auto-detect the conversational mode from the message unless the user has
    // explicitly pinned one (manualMode) or an override is passed in. We apply it
    // to this message's activeMode only (not the persistent `mode` chip) so it
    // doesn't fight the default-mode effect; the chosen mode is surfaced as a
    // badge on the assistant reply.
    let activeMode = modeOverride ?? mode;
    let autoDetectedMode = false;
    if (!modeOverride && !manualMode && text) {
      const intent = detectChatIntent(text);
      if (shouldApplyIntent(intent)) {
        activeMode = intent.mode;
        autoDetectedMode = activeMode !== mode;
      }
    }
    const imageSnapshot = pastedImage;
    const userMsg: ChatMessage = { role: 'user', content: text || '📷 Imagine atașată', mode: activeMode, ...(imageSnapshot ? { hadImage: true } : {}) };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setPastedImage(null);
    setLoading(true);
    setThinkingPhase('Mă gândesc…');
    setActiveCitationKey(null);
    // recordAIInteraction is called after citations are available (below in the streaming path).

    const abortCtrl = new AbortController();
    streamAbortRef.current = abortCtrl;

    try {
      // In-quiz answer disputes take priority over everything else, but only
      // fire when useQuizChatContextStore actually has an active question —
      // otherwise this never intercepts normal conversation.
      const disputeHandled = !imageSnapshot && await tryHandleAnswerDispute(text, activeMode);
      if (disputeHandled) return;

      // Flashcard requests are handled deterministically first so they work even
      // when the LLM planner is rate-limited, and never get misrouted to grile.
      const flashcardHandled = !imageSnapshot && await tryHandleFlashcardCommand(text, activeMode);
      if (flashcardHandled) return;

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
      setThinkingPhase(readySources.length > 0 ? 'Caut în biblioteca ta…' : 'Pregătesc răspunsul…');
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
      setMessages((prev) => [...prev, { role: 'assistant', content: '', citations, suggestions, mode: activeMode, autoMode: autoDetectedMode }]);

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
          conversationSummary: conversationSummaryRef.current,
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
        // Refresh the compressed conversation memory in the background.
        void maybeCompressConversation();
      }
    } catch (err: unknown) {
      if (err instanceof Error && (err.name === 'AbortError' || err.message.includes('aborted'))) return;
      const errorMessage = err instanceof Error ? err.message : 'Nu am putut genera un răspuns.';
      setMessages((prev) => {
        // The streaming path already pushed an empty assistant placeholder
        // (line ~522) before the request could fail — if it never received a
        // single chunk, filling IT with the error avoids leaving a blank
        // bubble sitting above a second, separate error message.
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant' && !last.content) {
          return [...prev.slice(0, -1), { ...last, content: `Eroare: ${errorMessage}` }];
        }
        return [...prev, { role: 'assistant', content: `Eroare: ${errorMessage}` }];
      });
    } finally {
      streamAbortRef.current = null;
      setLoading(false);
      setThinkingPhase(null);
    }
  };

  const closeChat = () => {
    setChatOpen(false);
    setScopedSource(null);
    setActiveCitationKey(null);
    setManualMode(false);
    setView('chat');
    contextCacheRef.current.clear();
  };

  const clearConversation = () => {
    setMessages([]);
    setActiveCitationKey(null);
    conversationSummaryRef.current = '';
    summaryCoveredCountRef.current = 0;
    const activeStorageKey = chatThread === 'rezidentiat' ? `${CHAT_STORAGE_KEY}:rezidentiat` : CHAT_STORAGE_KEY;
    try { localStorage.removeItem(activeStorageKey); } catch { /* ignore */ }
  };

  // ── Per-response actions (hover) ───────────────────────────────────────────
  const copyMessageToClipboard = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      addToast('Răspuns copiat.', 'success');
    } catch {
      addToast('Nu am putut copia răspunsul.', 'error');
    }
  };

  const saveAnswerAsFlashcard = (index: number) => {
    const answer = messages[index];
    const prev = messages[index - 1];
    const front = (prev?.role === 'user' ? prev.content : '').trim() || 'Recapitulare din chat';
    const back = answer.content.trim();
    if (!back) return;
    const card: Question = {
      id: crypto.randomUUID().replace(/-/g, '').slice(0, 12),
      text: front,
      multipleCorrect: false,
      difficulty: 'medium',
      explanation: '',
      options: [{ id: 'a', text: back, isCorrect: true }],
    };
    const deck: Quiz = {
      id: crypto.randomUUID().replace(/-/g, '').slice(0, 12),
      title: `Flashcard din chat · ${new Date().toLocaleDateString('ro-RO')}`,
      description: 'Salvat din conversația cu StudyX AI.',
      emoji: '🃏',
      color: 'purple',
      category: 'AI Flashcards',
      kind: 'flashcard',
      folderId: null,
      shuffleQuestions: false,
      shuffleAnswers: false,
      tags: ['flashcard', 'ai', 'chat'],
      questions: [card],
      createdAt: Date.now(),
    };
    addQuiz(deck);
    addToast('Am salvat un flashcard din răspuns.', 'success');
  };

  const regenerateAnswer = (index: number) => {
    const prev = messages[index - 1];
    if (prev?.role !== 'user') {
      addToast('Nu găsesc întrebarea de regenerat.', 'warning');
      return;
    }
    // The image itself is never kept in history — resending prev.content alone
    // would silently drop it and produce a reply about nothing in particular.
    if (prev.hadImage) {
      addToast('Nu pot regenera un răspuns pentru o imagine — atașeaz-o din nou și retrimite mesajul.', 'warning');
      return;
    }
    void sendMessage(prev.content, messages[index]?.mode);
  };

  const makeQuizFromAnswer = async (index: number) => {
    if (loading) return;
    const prev = messages[index - 1];
    const topic = (prev?.role === 'user' ? prev.content : '').trim() || messages[index].content.slice(0, 140);
    if (!hasKey) {
      addToast('Pentru a genera un set ai nevoie de o cheie AI în Setări.', 'warning');
      return;
    }
    setLoading(true);
    setThinkingPhase('Generez un set din răspuns…');
    try {
      const { generateQuestions, getUserProfile } = await import('../ai/AIEngine');
      const profile = activeProfileId ? getUserProfile(activeProfileId) : undefined;
      const result = await generateQuestions({
        context: topic,
        count: 5,
        weakTopics,
        userProfile: profile,
        mode: 'standard',
      });
      if (result.questions.length === 0) {
        addToast('Nu am putut genera un set din acest subiect.', 'error');
        return;
      }
      const quizId = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
      addQuiz({
        id: quizId,
        title: `Test din chat · ${new Date().toLocaleDateString('ro-RO')}`,
        description: `${result.questions.length} grile generate din conversația cu StudyX AI.`,
        emoji: '🧪',
        color: 'blue',
        category: 'AI Studio',
        kind: 'quiz',
        folderId: null,
        shuffleQuestions: true,
        shuffleAnswers: true,
        tags: ['ai', 'chat'],
        questions: result.questions,
        createdAt: Date.now(),
      });
      setMessages((prev2) => [...prev2, {
        role: 'assistant',
        content: `✅ Am creat **${result.questions.length} grile** pe baza acestui subiect. Le poți rezolva acum.`,
        openRoute: { route: `/play/${quizId}`, label: 'Începe testul' },
      }]);
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Generarea a eșuat.', 'error');
    } finally {
      setLoading(false);
      setThinkingPhase(null);
    }
  };

  // Escape closes the zoom overlay before anything else reacts to the key.
  useEffect(() => {
    if (!zoomedBlock) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      setZoomedBlock(null);
    };
    window.addEventListener('keydown', handleEscape, true);
    return () => window.removeEventListener('keydown', handleEscape, true);
  }, [zoomedBlock]);

  /**
   * Message bodies are injected as HTML, so schemas and wide tables can't carry
   * React handlers. One delegated click lifts the block the user tapped into a
   * full-screen overlay instead.
   */
  const handleZoomableClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null;
    const block = target?.closest?.('[data-sx-zoom]') as HTMLElement | null;
    if (!block) return;
    if (target?.closest('a')) return; // links inside a table keep working
    const clone = block.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('[data-sx-hint]').forEach((hint) => hint.remove());
    setZoomedBlock(clone.innerHTML);
  };

  const renderMessageList = (compact = false) => {
    const threadMessages = messages;
    const recentSourceName = scopedSource?.name
      ?? [...readySources].sort((a, b) => (b.addedAt ?? 0) - (a.addedAt ?? 0))[0]?.name
      ?? null;
    const greeting = buildProactiveGreeting(weakTopics, performanceSummary.dueCount, recentSourceName);

    return (
    <div className={compact ? 'space-y-4' : 'space-y-5'} onClick={handleZoomableClick}>
      {threadMessages.length === 0 ? (
        <div className={`text-center ${compact ? 'py-6' : 'py-8'}`}>
          <FreeKeysNotice
            theme={theme}
            configuredCount={Object.values(providerKeys).filter((key) => (key ?? '').trim().length > 0).length}
            onNavigate={closeChat}
          />
          <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="mb-5 text-5xl">
            🧠
          </motion.div>
          <h4 className="mb-2 text-[1.25rem] font-black tracking-tight" style={{ color: theme.text }}>
            {greeting.title}
          </h4>
          <p className="mb-6 text-sm font-medium leading-relaxed opacity-70" style={{ color: theme.text }}>
            {greeting.proactive
              ? greeting.subtitle
              : mode === 'grounded'
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
                className={`group flex items-start gap-2.5 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {message.role === 'assistant' && (
                  <div className="mt-0.5">
                    <AIOrb theme={theme} size={26} active={isLastAssistant && loading} calm={calmMotion} />
                  </div>
                )}
                <div
                  className={`max-w-[84%] rounded-[24px] p-4 text-sm leading-relaxed shadow-sm ${message.role === 'user' ? 'text-white' : ''}`}
                  style={{
                    background: message.role === 'user' ? theme.accent : theme.surface2,
                    color: message.role === 'user' ? '#fff' : theme.text,
                    borderRadius: message.role === 'user' ? '24px 24px 8px 24px' : '24px 24px 24px 8px',
                    border: message.role === 'assistant' ? `1px solid ${theme.border}` : 'none',
                    boxShadow: message.role === 'user' ? `0 10px 24px ${theme.accent}24` : '0 8px 18px rgba(0,0,0,0.04)',
                  }}
                >
                  {message.role === 'assistant' && message.autoMode && message.mode && (
                    <div
                      className="mb-2 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em]"
                      style={{ background: `${theme.accent}14`, color: theme.accent }}
                      title="Mod ales automat din mesajul tău"
                    >
                      ✨ {CHAT_MODES.find((m) => m.id === message.mode)?.label ?? message.mode}
                    </div>
                  )}

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
                        onRetry={() => void retryAgentJob(message.agentJobId!)}
                        onEditParams={(stepId, patch) => editAgentStepParams(message.agentJobId!, stepId, patch)}
                      />
                      {(() => {
                        const target = agentJobs.find((job) => job.id === message.agentJobId)?.result;
                        if (!target) return null;
                        return (
                          <button
                            onClick={() => {
                              setChatOpen(false);
                              navigate(target.route);
                            }}
                            className="press-feedback mt-2.5 inline-flex items-center gap-2 rounded-[16px] px-4 py-2.5 text-[12px] font-black text-white shadow-lg"
                            style={{ background: theme.accent, boxShadow: `0 8px 20px ${theme.accent}33` }}
                          >
                            <ArrowRight size={14} /> {target.label}
                          </button>
                        );
                      })()}
                    </div>
                  )}

                  {message.role === 'assistant' && message.openRoute && (
                    <button
                      onClick={() => { setChatOpen(false); navigate(message.openRoute!.route); }}
                      className="press-feedback mt-3 inline-flex items-center gap-2 rounded-[16px] px-4 py-2.5 text-[12px] font-black text-white shadow-lg"
                      style={{ background: theme.accent, boxShadow: `0 8px 20px ${theme.accent}33` }}
                    >
                      <ArrowRight size={14} /> {message.openRoute.label}
                    </button>
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

                  {message.role === 'assistant' && !message.agentJobId && message.content.trim() && !(isLastAssistant && loading) && (
                    <div className={`mt-3 flex flex-wrap gap-1.5 transition-opacity duration-150 ${isLastAssistant ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100'}`}>
                      {([
                        { key: 'copy', label: 'Copiază', icon: <Copy size={12} />, onClick: () => void copyMessageToClipboard(message.content) },
                        { key: 'flashcard', label: 'Flashcard', icon: <CreditCard size={12} />, onClick: () => saveAnswerAsFlashcard(index) },
                        { key: 'quiz', label: 'Fă quiz', icon: <ListChecks size={12} />, onClick: () => makeQuizFromAnswer(index) },
                        { key: 'regen', label: 'Regenerează', icon: <RotateCcw size={12} />, onClick: () => regenerateAnswer(index) },
                      ] as const).map((action) => (
                        <button
                          key={action.key}
                          onClick={action.onClick}
                          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors hover:opacity-80"
                          style={{ background: theme.surface, color: theme.text3, border: `1px solid ${theme.border}` }}
                        >
                          {action.icon}
                          {action.label}
                        </button>
                      ))}
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
            <div className="flex items-start gap-2.5 justify-start">
              <div className="mt-0.5">
                <AIOrb theme={theme} size={26} active calm={calmMotion} />
              </div>
              <div
                className="flex items-center gap-2.5 rounded-[22px] border px-4 py-3"
                style={{ background: theme.surface2, borderColor: theme.border }}
              >
                <Loader2 size={16} className="animate-spin" style={{ color: theme.accent }} />
                <span className="text-[13px] font-semibold" style={{ color: theme.text2 }}>
                  {thinkingPhase ?? 'Mă gândesc…'}
                </span>
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
    : mobile
      ? 'min(520px, calc(100vw - 20px))'
      : wideChat
        ? 'min(1080px, calc(100vw - 28px))'
        : 'min(560px, calc(100vw - 28px))';
  const drawerHeight = view === 'studio' || (wideChat && view === 'chat') ? 'min(88vh, 880px)' : 'min(85vh, 860px)';

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
          data-tutorial="ai-chat-button"
          className="fixed right-6 z-[9998] flex h-14 w-14 items-center justify-center rounded-[22px] text-white shadow-2xl press-feedback"
          style={{
            // Sit above the mobile bottom-nav so it doesn't cover the last tab.
            bottom: mobile ? 'calc(74px + env(safe-area-inset-bottom, 0px))' : '24px',
            background: theme.accent,
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
                  <AIOrb theme={theme} size={42} active={loading} calm={calmMotion} />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-black tracking-tight" style={{ color: theme.text }}>
                        StudyX AI{chatThread === 'rezidentiat' ? ' · Rezidențiat' : ''}
                      </h3>
                      <div className="flex items-center gap-1 rounded-full px-2 py-0.5"
                        style={{ background: `${theme.success}18`, border: `1px solid ${theme.success}30` }}>
                        <div className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: theme.success }} />
                        <span className="text-[10px] font-bold" style={{ color: theme.success }}>Online</span>
                      </div>
                    </div>
                    <p className="mt-0.5 text-[11px] font-medium truncate" style={{ color: theme.text3 }}>
                      {chatThread === 'rezidentiat'
                        ? 'Conversație separată, dedicată pregătirii de rezidențiat'
                        : view === 'studio'
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
                            background: active ? theme.accent : 'transparent',
                            color: active ? '#fff' : theme.text3,
                          }}
                        >
                          {entry.icon}
                          {entry.label}
                        </button>
                      );
                    })}
                  </div>

                  <div className="relative">
                    <motion.button
                      whileHover={calmMotion ? undefined : { scale: 1.08 }}
                      whileTap={calmMotion ? undefined : { scale: 0.92 }}
                      onClick={() => setOverflowMenuOpen((value) => !value)}
                      aria-label="Mai multe opțiuni"
                      title="Mai multe opțiuni"
                      className="rounded-2xl p-2.5 transition-colors hover:bg-white/5 press-feedback"
                      style={{
                        color: overflowMenuOpen ? theme.accent : theme.text3,
                        background: overflowMenuOpen ? `${theme.accent}18` : undefined,
                      }}
                    >
                      <MoreHorizontal size={18} />
                    </motion.button>

                    <AnimatePresence>
                      {overflowMenuOpen && (
                        <>
                          <div className="fixed inset-0 z-[10001]" onClick={() => setOverflowMenuOpen(false)} />
                          <motion.div
                            initial={calmMotion ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.97 }}
                            animate={calmMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
                            exit={calmMotion ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.97 }}
                            transition={{ duration: calmMotion ? 0.08 : 0.14 }}
                            className="absolute right-0 top-full z-[10002] mt-2 w-56 overflow-hidden rounded-[18px] border p-1.5"
                            style={{
                              background: theme.isDark ? 'rgba(28,26,34,0.96)' : 'rgba(255,255,255,0.97)',
                              borderColor: theme.border,
                              backdropFilter: performanceLite ? 'blur(10px)' : 'blur(24px) saturate(160%)',
                              boxShadow: '0 24px 60px rgba(0,0,0,0.35)',
                            }}
                          >
                            {view === 'chat' && !mobile && (
                              <button
                                onClick={() => { setWideChat((value) => !value); setOverflowMenuOpen(false); }}
                                className="flex w-full items-center gap-2.5 rounded-[12px] px-3 py-2.5 text-left text-[12.5px] font-bold transition-colors hover:bg-white/5"
                                style={{ color: theme.text }}
                              >
                                {wideChat ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                                {wideChat ? 'Îngustează chatul' : 'Lățește chatul'}
                              </button>
                            )}
                            {(() => {
                              const lastAssistantIndex = [...messages].map((m, i) => ({ m, i })).reverse().find(({ m }) => m.role === 'assistant')?.i;
                              if (lastAssistantIndex === undefined || loading) return null;
                              return (
                                <button
                                  onClick={() => { setOverflowMenuOpen(false); regenerateAnswer(lastAssistantIndex); }}
                                  className="flex w-full items-center gap-2.5 rounded-[12px] px-3 py-2.5 text-left text-[12.5px] font-bold transition-colors hover:bg-white/5"
                                  style={{ color: theme.text }}
                                >
                                  <RotateCcw size={15} />
                                  Regenerează ultimul răspuns
                                </button>
                              );
                            })()}
                            {messages.length > 0 && (
                              <>
                                <div className="my-1 h-px" style={{ background: theme.border }} />
                                <button
                                  onClick={() => { clearConversation(); setOverflowMenuOpen(false); }}
                                  className="flex w-full items-center gap-2.5 rounded-[12px] px-3 py-2.5 text-left text-[12.5px] font-bold transition-colors hover:bg-white/5"
                                  style={{ color: theme.danger }}
                                >
                                  <Trash2 size={15} />
                                  Golește conversația
                                </button>
                              </>
                            )}
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
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


                <div className="relative flex min-h-0 flex-1">
                  <div
                    className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-6 py-5"
                    style={view === 'chat' ? { background: 'linear-gradient(180deg, rgba(255,255,255,0.04), transparent 28%)' } : undefined}
                  >
                    {view === 'studio' && scopedSource && (
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
                          Poți discuta liber despre documentul selectat și, din panoul „Studio", să generezi pachete de grile direct în folderul ales.
                        </p>
                      </div>
                    )}
                    {renderMessageList(view === 'studio')}
                  </div>

                  {/*
                    Studio used to be a permanent 340px grid column whenever its tab was
                    active — it now overlays the chat instead (backdrop + slide-in drawer),
                    so chat keeps full width until you actually open Studio.
                  */}
                  <AnimatePresence>
                    {view === 'studio' && (
                      <>
                        <motion.div
                          key="studio-backdrop"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: calmMotion ? 0.1 : 0.18 }}
                          onClick={() => setView('chat')}
                          className="absolute inset-0 z-10"
                          style={{ background: 'rgba(0,0,0,0.28)' }}
                        />
                        <motion.div
                          key="studio-drawer"
                          initial={calmMotion ? { opacity: 0 } : { x: '100%' }}
                          animate={calmMotion ? { opacity: 1 } : { x: 0 }}
                          exit={calmMotion ? { opacity: 0 } : { x: '100%' }}
                          transition={{ type: 'spring', stiffness: 340, damping: 32 }}
                          className={`custom-scrollbar absolute right-0 top-0 bottom-0 z-20 overflow-y-auto border-l px-5 py-5 ${mobile ? 'w-full' : 'w-full max-w-[320px]'}`}
                          style={{
                            borderColor: theme.border,
                            background: theme.isDark ? 'rgba(20,16,30,0.98)' : 'rgba(255,255,255,0.98)',
                            backdropFilter: 'blur(28px) saturate(160%)',
                            boxShadow: '-24px 0 60px rgba(0,0,0,0.35)',
                          }}
                        >
                      <GlassCard variant="strong" radius="28px" padding="16px">
                        <div className="mb-3 flex items-center gap-2">
                          <div className="flex h-10 w-10 items-center justify-center rounded-2xl" style={{ background: `${theme.accent}18`, color: theme.accent }}>
                            <Wand2 size={18} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: theme.text3 }}>
                              AI Studio
                            </div>
                            <div className="text-sm font-black" style={{ color: theme.text }}>
                              Pachete smart din curs
                            </div>
                          </div>
                          <motion.button
                            whileHover={calmMotion ? undefined : { scale: 1.08, rotate: 90 }}
                            whileTap={calmMotion ? undefined : { scale: 0.9 }}
                            onClick={() => setView('chat')}
                            aria-label="Închide Studio"
                            className="flex-shrink-0 rounded-xl p-2"
                            style={{ color: theme.text3, background: theme.surface2 }}
                          >
                            <X size={15} />
                          </motion.button>
                        </div>

                        <button
                          onClick={() => setStudioInfoOpen((v) => !v)}
                          className="mb-3 flex items-center gap-1.5 text-[10.5px] font-bold"
                          style={{ color: theme.text3 }}
                        >
                          <Info size={12} /> Cum funcționează?
                          <ChevronDown size={11} style={{ transform: studioInfoOpen ? 'rotate(180deg)' : undefined, transition: 'transform 0.2s' }} />
                        </button>
                        <AnimatePresence initial={false}>
                          {studioInfoOpen && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: calmMotion ? 0.12 : 0.2 }}
                              className="overflow-hidden"
                            >
                              <p className="mb-4 text-xs leading-6" style={{ color: theme.text2 }}>
                                Încarci cursul în bibliotecă, alegi documentul și StudyX îți generează batch-uri de grile adaptate profilului tău, apoi le trimite direct în folderul ales.
                              </p>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        <div className="space-y-4">
                          <StudioSelect
                            label="Document sursă"
                            value={selectedStudioSourceId}
                            onChange={(nextValue) => {
                              setStudioSourceId(nextValue);
                              setStudioHeading(WHOLE_DOCUMENT_HEADING);
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

                          {studioChapterOptions.length > 1 && (
                            <StudioSelect
                              label="Capitol"
                              value={studioHeading}
                              onChange={setStudioHeading}
                              options={studioChapterOptions}
                              placeholder="Tot documentul"
                              theme={theme}
                            />
                          )}

                          <StudioSelect
                            label="Folder țintă"
                            value={studioFolderId}
                            onChange={setStudioFolderId}
                            options={studioFolderOptions}
                            placeholder="Alege unde salvăm pachetele"
                            theme={theme}
                          />

                          <div className={studioHeading === WHOLE_DOCUMENT_HEADING ? 'grid grid-cols-2 gap-3' : ''}>
                            {studioHeading === WHOLE_DOCUMENT_HEADING && (
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
                            )}

                            <label className="block">
                              <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: theme.text3 }}>
                                {studioHeading === WHOLE_DOCUMENT_HEADING ? 'Întrebări / pachet' : 'Întrebări'}
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
                                      background: active ? theme.accent : theme.surface,
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

                          <div>
                            <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: theme.text3 }}>
                              Tip de grilă
                            </span>
                            <div className="grid grid-cols-2 gap-2">
                              {(['residency', 'simple'] as ExamStyle[]).map((style) => {
                                const active = studioExamStyle === style;
                                const meta = EXAM_STYLE_META[style];
                                return (
                                  <button
                                    key={style}
                                    onClick={() => setStudioExamStyle(style)}
                                    title={meta.description}
                                    className="rounded-2xl px-3 py-2 text-left"
                                    style={{
                                      background: active ? theme.accent : theme.surface,
                                      border: `1px solid ${active ? 'transparent' : theme.border}`,
                                      color: active ? '#fff' : theme.text,
                                    }}
                                  >
                                    <div className="text-xs font-black uppercase tracking-[0.14em]">{meta.short}</div>
                                    <div className="mt-0.5 text-[10px] font-semibold opacity-80">{meta.description}</div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {studioInfoOpen && (
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
                          )}

                          <button
                            onClick={() => void handleGeneratePackages()}
                            disabled={!selectedStudioSource || studioGenerating}
                            className="press-feedback flex w-full items-center justify-center gap-2 rounded-[22px] px-5 py-3.5 text-sm font-black text-white disabled:opacity-45"
                            style={{
                              background: theme.accent,
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
                      </GlassCard>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>

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
                            background: (input.trim() || pastedImage) ? theme.accent : `${theme.accent}18`,
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
                        {!modePickerOpen ? (
                          <button
                            onClick={() => setModePickerOpen(true)}
                            className="shrink-0 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] whitespace-nowrap transition-all"
                            style={{ background: `${theme.accent}18`, color: theme.accent, border: `1px solid ${theme.accent}30` }}
                            title="Modul răspunsului — apasă pentru a alege manual"
                          >
                            <Sparkles size={11} />
                            {manualMode ? activeModeConfig.shortLabel : 'Auto'}
                            <ChevronDown size={11} />
                          </button>
                        ) : (
                          <div className="flex items-center gap-1 overflow-x-auto">
                            <button
                              onClick={() => { setManualMode(false); setModePickerOpen(false); }}
                              className="shrink-0 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] whitespace-nowrap transition-all"
                              style={{
                                background: !manualMode ? `${theme.accent}20` : 'transparent',
                                color: !manualMode ? theme.accent : theme.text3,
                                border: `1px solid ${!manualMode ? `${theme.accent}40` : 'transparent'}`,
                              }}
                            >
                              <Sparkles size={10} /> Auto
                            </button>
                            {CHAT_MODES.map((entry) => {
                              const active = manualMode && entry.id === mode;
                              return (
                                <button
                                  key={entry.id}
                                  onClick={() => { setMode(entry.id); setManualMode(true); setModePickerOpen(false); }}
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
                        )}
                      </div>
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

      <AnimatePresence>
        {zoomedBlock && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setZoomedBlock(null)}
            className="fixed inset-0 z-[10000] flex items-center justify-center p-4 sm:p-8"
            style={{ background: 'rgba(0,0,0,0.62)', backdropFilter: 'blur(6px)' }}
          >
            <motion.div
              initial={{ scale: 0.97, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.97, opacity: 0 }}
              onClick={(event) => event.stopPropagation()}
              className="relative max-h-full w-full max-w-[1200px] overflow-auto rounded-3xl p-5 sm:p-7"
              style={{ background: theme.surface, border: `1px solid ${theme.border}`, color: theme.text }}
            >
              <button
                onClick={() => setZoomedBlock(null)}
                aria-label="Închide"
                className="absolute right-3 top-3 rounded-2xl p-2 transition-colors hover:bg-white/10"
                style={{ color: theme.text3 }}
              >
                <X size={18} />
              </button>
              <div dangerouslySetInnerHTML={{ __html: zoomedBlock }} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
