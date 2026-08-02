import { useAIStore } from '../store/aiStore';
import { getMedicalSystemPrompt } from './aiContext';
import { logAIDebug } from '../ai/debug';
import type { AIRequestTask } from '../ai/types';
import { createRequestGovernor } from './aiRequestGovernor';
import { extractJsonArrayLenient } from './jsonExtract';
import { logDiagnosticEvent } from '../store/diagnosticsStore';
import { useToastStore } from '../store/toastStore';
import { buildQuestionTypeInstruction, type QuestionType } from './ai/questionTypes';

/**
 * Providers don't agree on an error shape: Groq/Google follow the OpenAI
 * `{error:{message}}` convention, but Cerebras returns FastAPI-style
 * `{detail: "..."}` (confirmed live: a 403 came back as `{"detail":"Not
 * authenticated"}`, not `{error:{message}}`) — sometimes `detail` is even an
 * array of validation objects. Reading only `.error.message` silently found
 * nothing for Cerebras and fell through to `res.statusText`, which some
 * fetch implementations leave empty, producing a blank "Eroare ... API:" with
 * no explanation at all. This checks every shape API providers actually use.
 */
async function extractApiErrorMessage(res: Response): Promise<string> {
  const body = await res.json().catch(() => null) as
    | { error?: { message?: string } | string; detail?: string | Array<{ msg?: string }>; message?: string }
    | null;
  if (body) {
    if (typeof body.error === 'string') return body.error;
    if (body.error?.message) return body.error.message;
    if (typeof body.detail === 'string') return body.detail;
    if (Array.isArray(body.detail) && body.detail.length > 0) {
      return body.detail.map((d) => d.msg).filter(Boolean).join('; ') || JSON.stringify(body.detail);
    }
    if (body.message) return body.message;
  }
  return res.statusText || `HTTP ${res.status}`;
}

export type GroqMessagePart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string; detail?: 'low' | 'high' | 'auto' } };

export interface GroqMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | GroqMessagePart[];
}

/** Groq Llama 4 Scout — vision-capable, fast, cost-efficient. */
export const GROQ_VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';

/** Returns true if the given provider supports multimodal (image) requests. */
export function supportsVision(provider: string): boolean {
  // Vision uses Groq's Llama 4 Scout model specifically, so it's Groq-only.
  return provider === 'groq';
}

export interface GeneratedQuestion {
  text: string;
  options: { text: string; isCorrect: boolean }[];
  explanation?: string;
  tags?: string[];
  reference?: string;
  type?: QuestionType;
}

function buildKnowledgeQuery(messages: GroqMessage[]): string {
  const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
  if (!lastUserMsg) return 'Context medical general';
  if (typeof lastUserMsg.content === 'string') {
    return lastUserMsg.content.slice(0, 1200).trim() || 'Context medical general';
  }
  const textPart = lastUserMsg.content.find((p): p is Extract<GroqMessagePart, { type: 'text' }> => p.type === 'text');
  return (textPart?.text ?? '').slice(0, 1200).trim() || 'Context medical general';
}

const TASK_TEMPERATURE: Record<AIRequestTask, number> = {
  questions: 0.3,
  explanation: 0.3,
  mnemonic: 0.8,
  hint: 0.4,
  chat: 0.5,
  analysis: 0.4,
};

const TASK_MAX_TOKENS: Record<AIRequestTask, number> = {
  questions: 2200,
  explanation: 1800,
  mnemonic: 300,
  hint: 500,
  chat: 2000,
  analysis: 1000,
};

function sanitizeKey(key: string): string {
  // eslint-disable-next-line no-control-regex
  return key.replace(/[^\x00-\x7F]/g, '').trim();
}

function getProviderConfig(provider: ReturnType<typeof useAIStore.getState>['provider']) {
  if (provider === 'google') {
    return {
      name: 'Google Gemini',
      // Google exposes an OpenAI-compatible endpoint, so the same chat-completions
      // request/response shape works with a Bearer API key.
      endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
      keyHint: 'Cheia API Google Gemini nu este configurata. Mergi la Setari AI.',
    };
  }

  if (provider === 'cerebras') {
    return {
      name: 'Cerebras',
      // Cerebras is OpenAI-compatible — 1M free tokens/day, very fast.
      endpoint: 'https://api.cerebras.ai/v1/chat/completions',
      keyHint: 'Cheia API Cerebras nu este configurata. Mergi la Setari AI.',
    };
  }

  return {
    name: 'Groq',
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
    keyHint: 'Cheia API Groq nu este configurata. Mergi la Setari AI.',
  };
}

/** Default model to use when we fall back to another provider mid-request. */
const FALLBACK_MODEL: Record<'groq' | 'google' | 'cerebras', string> = {
  groq: 'llama-3.3-70b-versatile',
  google: 'gemini-2.5-flash',
  cerebras: 'gpt-oss-120b',
};

type ProviderId = 'groq' | 'google' | 'cerebras';

const PROVIDER_ORDER: ProviderId[] = ['groq', 'google', 'cerebras'];

/**
 * How long we keep starting requests on a fallback provider after switching away
 * from a rate-limited one, before giving the primary another shot. Without this,
 * every single request would re-hit the still-limited primary first and eat its
 * retry attempts before falling back again.
 */
const FALLBACK_STICKY_MS = 10 * 60 * 1000;

/** In-memory only (per app session) — which provider we're currently "stuck" on. */
let stickyFallback: { provider: ProviderId; primary: ProviderId; until: number } | null = null;

/**
 * Provider chain: the active provider first, then any OTHER provider that has a
 * saved key. When one hits its free-tier limit (or errors), callers transparently
 * continue on the next — so the three free tiers act like one big pool.
 *
 * If we recently switched away from `primaryProvider` due to a failure, requests
 * start on that fallback provider instead (still trying `primaryProvider` later in
 * the chain, in case it already recovered) until FALLBACK_STICKY_MS elapses.
 */
function buildProviderChain(
  primaryProvider: ProviderId,
  primaryModel: string,
  providerKeys: Partial<Record<ProviderId, string>>,
): Array<{ provider: ProviderId; key: string; model: string }> {
  if (stickyFallback && stickyFallback.until <= Date.now()) stickyFallback = null;

  const startProvider =
    stickyFallback &&
    stickyFallback.primary === primaryProvider &&
    sanitizeKey(providerKeys[stickyFallback.provider] ?? '')
      ? stickyFallback.provider
      : primaryProvider;

  const modelFor = (p: ProviderId) => (p === primaryProvider ? primaryModel : FALLBACK_MODEL[p]);
  const ordered = [startProvider, ...PROVIDER_ORDER.filter((p) => p !== startProvider)];

  const chain: Array<{ provider: ProviderId; key: string; model: string }> = [];
  for (const p of ordered) {
    const k = sanitizeKey(providerKeys[p] ?? '');
    if (k) chain.push({ provider: p, key: k, model: modelFor(p) });
  }
  return chain;
}

/**
 * Records which provider actually served a request and, when it's a fallback
 * (not the user's configured primary), notifies the user once via toast so
 * they know the app quietly switched — e.g. "Limita Groq atinsă — am trecut
 * automat pe Google Gemini." Clears the sticky state once the primary answers
 * again (it recovered on its own).
 */
function trackProviderOutcome(provider: ProviderId, primaryProvider: ProviderId, providerName: string) {
  if (provider === primaryProvider) {
    stickyFallback = null;
    return;
  }
  const isNewSwitch = !stickyFallback || stickyFallback.provider !== provider;
  stickyFallback = { provider, primary: primaryProvider, until: Date.now() + FALLBACK_STICKY_MS };
  if (isNewSwitch) {
    useToastStore.getState().addToast(
      `Limita cheii curente a fost atinsă — am trecut automat pe ${providerName}.`,
      'info',
      6000,
    );
  }
}

/**
 * Run a chat-completions request against ONE provider, with in-provider retries
 * on 429. When a fallback provider is available we retry less (fail fast → switch);
 * on the last provider we ride out per-minute rate limits with more attempts.
 */
async function attemptOnProvider(
  cfg: { name: string; endpoint: string },
  link: { key: string; model: string },
  finalMessages: GroqMessage[],
  temperature: number,
  maxTokens: number,
  task: AIRequestTask,
  hasFallback: boolean,
  abortSignal?: AbortSignal,
): Promise<string> {
  const maxAttempts = hasFallback ? 2 : 4;
  let lastError = 'Eroare necunoscuta';
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await fetch(cfg.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${link.key}` },
        body: JSON.stringify({ model: link.model, messages: finalMessages, temperature, max_tokens: maxTokens }),
        signal: abortSignal,
      });

      if (!response.ok) {
        const msg = await extractApiErrorMessage(response);
        if (response.status === 429 && attempt < maxAttempts - 1) {
          const retryAfter = response.headers.get('retry-after');
          const delayMs = getRetryDelayMs(attempt, retryAfter);
          logAIDebug('groq:ratelimit', { task, provider: cfg.name, retryAfter, delayMs });
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          continue;
        }
        throw new Error(msg);
      }

      const data = await response.json();
      const output = (data.choices?.[0]?.message?.content ?? '').trim();
      logAIDebug('groq:response', { task, provider: cfg.name, output });
      return output;
    } catch (error: unknown) {
      lastError = error instanceof Error ? error.message : String(error);
      logAIDebug('groq:error', { task, provider: cfg.name, attempt, error: lastError });
      if (attempt < maxAttempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, getRetryDelayMs(attempt, null)));
      }
    }
  }
  throw new Error(lastError);
}

/**
 * Live check that an API key is actually accepted by the provider — beyond the
 * format check (gsk_/AIza prefix). Sends a 1-token request so we can tell the
 * user "cheie respinsă" instead of showing a misleading green check when the key
 * is expired/invalid and generation will silently fall back to local templates.
 */
export async function validateApiKey(
  provider: ReturnType<typeof useAIStore.getState>['provider'],
  key: string,
): Promise<{ ok: boolean; error?: string; warning?: string }> {
  const cleanKey = sanitizeKey(key);
  if (!cleanKey) return { ok: false, error: 'Cheia este goală.' };

  const config = getProviderConfig(provider);
  const testModel =
    provider === 'google' ? 'gemini-2.0-flash' : provider === 'cerebras' ? 'gpt-oss-120b' : 'llama-3.1-8b-instant';

  try {
    const res = await fetch(config.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cleanKey}` },
      body: JSON.stringify({
        model: testModel,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1,
        stream: false,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (res.ok) return { ok: true };

    const message = await extractApiErrorMessage(res);
    if (res.status === 401 || res.status === 403) {
      return { ok: false, error: `Cheie respinsă de ${config.name} (${res.status}). Verifică sau regenerează cheia.` };
    }
    if (res.status === 429) {
      // A 429 only happens AFTER the key authenticates (an invalid key returns
      // 401/403), so the key is valid — it just hit the rate limit during this
      // test ping. Treat as success with a soft note, not a hard failure.
      return { ok: true, warning: 'Cheie validă. Ai atins temporar limita de rate (free tier) — AI-ul merge, doar lasă câteva secunde între cereri.' };
    }
    return { ok: false, error: `Eroare ${config.name} (${res.status}): ${message}` };
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      return { ok: false, error: 'Verificarea a expirat — verifică conexiunea la internet.' };
    }
    return { ok: false, error: error instanceof Error ? error.message : 'Nu am putut contacta serverul AI.' };
  }
}

function extractJsonArray(raw: string): string | null {
  // Slicing to the last `]` used to land on an inner `options` array whenever a
  // reply was cut short by max_tokens, so the batch failed to parse and every
  // complete question in it was thrown away. This keeps the finished ones.
  return extractJsonArrayLenient(raw);
}

function detectLanguage(text: string): string {
  const s = text.slice(0, 500).toLowerCase();
  if (/\b(și|sau|este|sunt|nu|cu|de|în|la|pe|pentru|că|care|din|prin)\b/.test(s)) return 'română';
  if (/\b(et|ou|est|sont|ne|pas|avec|de|dans|pour|que|qui|du|par)\b/.test(s)) return 'franceză';
  if (/\b(und|oder|ist|sind|nicht|mit|von|in|für|das|die|der|den)\b/.test(s)) return 'germană';
  return 'engleză';
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

export function isDuplicateQuestion(newText: string, existingTexts: string[]): boolean {
  const norm = newText.toLowerCase().trim().slice(0, 120);
  return existingTexts.some(existing => {
    const e = existing.toLowerCase().trim().slice(0, 120);
    const maxLen = Math.max(norm.length, e.length);
    if (maxLen === 0) return false;
    const dist = levenshtein(norm, e);
    return (1 - dist / maxLen) > 0.8;
  });
}

// ── Anti-Hallucination Validator ──────────────────────────────────────────────
// Ensures AI output is coherent: exactly 1 correct option, non-empty, non-duplicate options.
export function isValidQuestion(q: GeneratedQuestion): boolean {
  if (!q.text?.trim() || !Array.isArray(q.options) || q.options.length < 2) return false;
  // Reject a stem that is ABOUT the output format ("returnează în format JSON"),
  // not any stem that merely contains those words. The old substring test threw
  // away perfectly good medical questions — "Din ce este format nefronul?" is
  // ordinary Romanian, and every such question vanished silently.
  if (/\b(format|formatul)\s+(json|de\s+r[aă]spuns)\b|\bjson\b/i.test(q.text)) return false;

  const corrects = q.options.filter(o => o.isCorrect === true);
  // Hallucination check 1: must have exactly one correct option
  if (corrects.length !== 1) return false;
  // Hallucination check 2: correct option must have non-empty text
  if (!corrects[0].text?.trim()) return false;
  // Hallucination check 3: every option needs real text. An empty distractor
  // used to be skipped by the duplicate scan below and so passed validation,
  // leaving a blank choice in a saved quiz.
  if (q.options.some(o => !o.text?.trim())) return false;

  // Hallucination check 4: no two options may say the same thing — previously
  // only distractor-vs-correct was compared, so the AI could repeat the same
  // wrong answer twice and it was accepted.
  const normalized = q.options.map(o => o.text.toLowerCase().trim());
  for (let i = 0; i < normalized.length; i += 1) {
    for (let j = i + 1; j < normalized.length; j += 1) {
      const maxLen = Math.max(normalized[i].length, normalized[j].length);
      if (maxLen === 0) return false;
      if (levenshtein(normalized[i], normalized[j]) / maxLen < 0.07) return false; // >93% identical
    }
  }
  return true;
}

// ── Smart Context Chunking ────────────────────────────────────────────────────
// Splits long medical texts into overlapping chunks that fit within the AI context window.
function chunkText(text: string, maxSize = 4500, overlap = 350, maxChunks = 4): string[] {
  if (text.length <= maxSize) return [text];
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length && chunks.length < maxChunks) {
    let end = Math.min(start + maxSize, text.length);
    if (end < text.length) {
      // Prefer natural paragraph/sentence breaks over arbitrary cuts
      const floor = start + Math.floor(maxSize * 0.55);
      const breakAt = [
        text.lastIndexOf('\n\n', end),
        text.lastIndexOf('\n', end),
        text.lastIndexOf('. ', end),
        text.lastIndexOf(' ', end),
      ].find(p => p > floor && p > -1);
      if (breakAt !== undefined) end = breakAt + 1;
    }
    chunks.push(text.slice(start, end));
    if (end >= text.length) break;
    start = end - overlap;
  }
  return chunks;
}

// ── Request Queue & Rate Limiting ──────────────────────────────────────────
// Two governors:
//  - groqGovernor: chat / stream / analysis / hints — serial, generous spacing
//  - generationGovernor: question generation — 2 concurrent, tighter spacing
const groqGovernor = createRequestGovernor({ concurrency: 1, baseSpacingMs: 400 });
const generationGovernor = createRequestGovernor({ concurrency: 2, baseSpacingMs: 450 });

function getRetryDelayMs(attempt: number, retryAfterHeader: string | null) {
  const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : 0;
  const retryAfterMs = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
    ? retryAfterSeconds * 1000
    : 0;
  const exponentialBackoffMs = 2500 * 2 ** attempt;
  const jitterMs = Math.floor(Math.random() * 450);
  return Math.max(retryAfterMs, exponentialBackoffMs) + jitterMs;
}

// ── Core API ──────────────────────────────────────────────────────────────────
export async function groqRequest({
  task,
  messages,
  temperature,
  maxTokens,
  abortSignal,
  skipLibraryContext,
}: {
  task: AIRequestTask;
  messages: GroqMessage[];
  temperature?: number;
  maxTokens?: number;
  abortSignal?: AbortSignal;
  skipLibraryContext?: boolean;
}): Promise<string> {
  const governor = task === 'questions' ? generationGovernor : groqGovernor;
  return governor.run(task, async () => {
    const state = useAIStore.getState();
    const primaryProvider = state.provider;
    const primaryKey = sanitizeKey(state.apiKey);
    if (!primaryKey) throw new Error(getProviderConfig(primaryProvider).keyHint);
    const effectiveKeys: Partial<Record<ProviderId, string>> = { ...state.providerKeys, [primaryProvider]: primaryKey };

    const kb = skipLibraryContext ? '' : await state.getKnowledgeContext(buildKnowledgeQuery(messages), 6000);
    const finalMessages: GroqMessage[] = kb
      ? [
          {
            role: 'system',
            content:
              'Context suplimentar din biblioteca locală a utilizatorului. ' +
              'Folosește-l doar când este relevant medical și nu inventa informații absente.\n\n' +
              kb,
          },
          ...messages,
        ]
      : messages;

    const finalTemperature = temperature ?? TASK_TEMPERATURE[task] ?? 0.5;
    const finalMaxTokens = maxTokens ?? TASK_MAX_TOKENS[task] ?? 1200;

    if (abortSignal?.aborted) throw new Error('Request aborted before start');

    const chain = buildProviderChain(primaryProvider, state.model, effectiveKeys);

    let lastError = 'Eroare necunoscuta';
    for (let ci = 0; ci < chain.length; ci++) {
      const link = chain[ci];
      const cfg = getProviderConfig(link.provider);
      const next = chain[ci + 1];
      logAIDebug('groq:request', {
        task,
        provider: link.provider,
        model: link.model,
        temperature: finalTemperature,
        maxTokens: finalMaxTokens,
        messagesCount: messages.length,
      });
      try {
        const result = await attemptOnProvider(cfg, link, finalMessages, finalTemperature, finalMaxTokens, task, !!next, abortSignal);
        trackProviderOutcome(link.provider, primaryProvider, cfg.name);
        return result;
      } catch (error: unknown) {
        lastError = error instanceof Error ? error.message : String(error);
        logAIDebug('groq:providerFailed', { provider: link.provider, error: lastError });
        if (next) {
          logDiagnosticEvent({
            area: 'ai',
            level: 'warning',
            title: 'Trec pe alt provider AI',
            detail: `${cfg.name} indisponibil (${lastError}). Continui automat pe ${getProviderConfig(next.provider).name}.`,
          });
        }
      }
    }

    logDiagnosticEvent({ area: 'ai', level: 'error', title: 'AI indisponibil', detail: `Task ${task}: ${lastError}` });
    throw new Error(`Eroare AI: ${lastError}`);
  });
}

export async function groqChat(
  messages: GroqMessage[],
  temperature = 0.7,
  options: { skipLibraryContext?: boolean; task?: AIRequestTask; maxTokens?: number } = {},
): Promise<string> {
  return groqRequest({
    task: options.task ?? 'chat',
    messages,
    temperature,
    maxTokens: options.maxTokens ?? 4096,
    skipLibraryContext: options.skipLibraryContext,
  });
}

/**
 * Single-turn vision request — sends an image (data URL) + text prompt to
 * Llama 4 Scout on Groq. Groq-only (see supportsVision).
 */
export async function groqVisionRequest(
  imageDataUrl: string,
  prompt: string,
  abortSignal?: AbortSignal,
): Promise<string> {
  const { apiKey, provider } = useAIStore.getState();
  if (!supportsVision(provider)) {
    throw new Error('Vision necesită Groq. Schimbă providerul în setări AI.');
  }
  const key = sanitizeKey(apiKey);
  if (!key) throw new Error('Cheia API Groq nu este configurată. Mergi la Setări AI.');

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: GROQ_VISION_MODEL,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: imageDataUrl, detail: 'low' } },
            { type: 'text', text: prompt },
          ],
        },
      ],
      max_tokens: 800,
      temperature: 0.3,
    }),
    signal: abortSignal,
  });

  if (!res.ok) {
    throw new Error(await extractApiErrorMessage(res));
  }
  const data = await res.json();
  return ((data.choices?.[0]?.message?.content as string | undefined) ?? '').trim();
}

export async function groqStream(
  messages: GroqMessage[],
  onChunk: (text: string) => void,
  temperature = 0.7,
  abortSignal?: AbortSignal,
  skipLibraryContext = false,
): Promise<string> {
  if (abortSignal?.aborted) {
    throw new Error('Stream aborted before start');
  }
  return groqGovernor.run('chat', async () => {
    const state = useAIStore.getState();
    const primaryKey = sanitizeKey(state.apiKey);
    if (!primaryKey) throw new Error(getProviderConfig(state.provider).keyHint);
    const kb = skipLibraryContext ? '' : await state.getKnowledgeContext(buildKnowledgeQuery(messages), 4500);
    const finalMessages: GroqMessage[] = kb
      ? [
          {
            role: 'system',
            content:
              'Context suplimentar din biblioteca locală a utilizatorului. ' +
              'Folosește-l strict ca referință, fără halucinații.\n\n' +
              kb,
          },
          ...messages,
        ]
      : messages;

    const timeoutSignal = AbortSignal.timeout(60_000);
    const combinedSignal = abortSignal
      ? AbortSignal.any([abortSignal, timeoutSignal])
      : timeoutSignal;

    // Try each provider in the chain for the INITIAL connection only — once bytes
    // start streaming to the UI we commit to that provider (switching mid-stream
    // would mean discarding partial output the user already sees).
    const primaryProvider = state.provider;
    const effectiveKeys: Partial<Record<ProviderId, string>> = { ...state.providerKeys, [primaryProvider]: primaryKey };
    const chain = buildProviderChain(primaryProvider, state.model, effectiveKeys);
    let res: Response | null = null;
    let providerName = getProviderConfig(primaryProvider).name;
    let lastError = 'Eroare necunoscuta';

    for (let ci = 0; ci < chain.length; ci++) {
      const link = chain[ci];
      const cfg = getProviderConfig(link.provider);
      try {
        const attempt = await fetch(cfg.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${link.key}` },
          body: JSON.stringify({ model: link.model, messages: finalMessages, temperature, max_tokens: 4096, stream: true }),
          signal: combinedSignal,
        });
        if (attempt.ok) {
          res = attempt;
          providerName = cfg.name;
          trackProviderOutcome(link.provider, primaryProvider, cfg.name);
          break;
        }
        lastError = await extractApiErrorMessage(attempt);
        logDiagnosticEvent({
          area: 'ai',
          level: 'warning',
          title: chain[ci + 1] ? 'Trec pe alt provider AI' : 'Stream AI oprit',
          detail: chain[ci + 1]
            ? `${cfg.name} indisponibil (${lastError}). Continui automat pe ${getProviderConfig(chain[ci + 1].provider).name}.`
            : lastError,
        });
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
      }
    }

    if (!res) throw new Error(`Eroare ${providerName} API: ${lastError}`);
    if (!res.body) throw new Error('Răspuns fără corp — încearcă din nou.');

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let full = '';
    let carry = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        const tail = carry + decoder.decode();
        if (tail.trim()) {
          const trimmed = tail.replace(/^data: /, '').trim();
          if (trimmed && trimmed !== '[DONE]') {
            try {
              const json = JSON.parse(trimmed);
              const delta = json.choices?.[0]?.delta?.content ?? '';
              if (delta) { full += delta; onChunk(delta); }
            } catch (err) {
              console.error(err);
            }
          }
        }
        break;
      }
      const chunk = carry + decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');
      carry = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.replace(/^data: /, '').trim();
        if (!trimmed || trimmed === '[DONE]') continue;
        try {
          const json = JSON.parse(trimmed);
          const delta = json.choices?.[0]?.delta?.content ?? '';
          if (delta) { full += delta; onChunk(delta); }
        } catch (err) {
          console.error(err);
        }
      }
    }
    return full;
  });
}

// ── Question Generation (with chunking + anti-hallucination) ──────────────────
export async function generateQuestionsFromText(
  text: string,
  count = 5,
  difficulty = 3,
  existingQuestionTexts: string[] = [],
  onProgress?: (generated: number, total: number) => void,
  questionTypes?: QuestionType[],
): Promise<GeneratedQuestion[]> {
  const cleanText = text
    .replace(/\f/g, '\n').replace(/^\s*\d{1,4}\s*$/gm, '')
    .replace(/[ \t]{3,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();

  if (cleanText.length < 80)
    throw new Error('Textul extras din PDF este prea scurt. Încearcă un alt PDF sau un fișier text.');

  const language = detectLanguage(cleanText);
  const diffMap: Record<number, string> = {
    1: 'UȘOR: întrebări directe, terminologie de bază.',
    2: 'UȘOR-MEDIU: concepte de bază cu raționament simplu.',
    3: 'MEDIU: mix memorare și raționament clinic standard.',
    4: 'DIFICIL: raționament complex, diagnostice diferențiale, capcane subtile.',
    5: 'EXPERT: termeni medicali rari, capcane sofisticate, prezentări atipice — nivel rezidențiat.',
  };
  const difficultyInstruction = diffMap[Math.max(1, Math.min(5, difficulty))] ?? diffMap[3];
  const systemPrompt = getMedicalSystemPrompt('examiner') +
    `\nCreezi întrebări EXCLUSIV din textul primit. LIMBĂ: ${language}. DIFICULTATE: ${difficultyInstruction}`;

  // ── Smart chunking: split long texts into digestible pieces ──────────────────
  const chunks = chunkText(cleanText, 6500, 400, Math.max(2, Math.min(10, Math.ceil(count / 10))));
  const perChunk = Math.max(1, Math.ceil(count / chunks.length));

  const allQuestions: GeneratedQuestion[] = [];
  const seenTexts: string[] = [...existingQuestionTexts];

  for (const chunk of chunks) {
    if (allQuestions.length >= count) break;
    const needed = Math.min(perChunk, count - allQuestions.length);
    const typeInstruction = questionTypes && questionTypes.length > 0
      ? `\n${buildQuestionTypeInstruction(needed, questionTypes)}`
      : '';
    const typeFormatField = questionTypes && questionTypes.length > 0 ? ',"type":""' : '';

    const userPrompt = `Creează exact ${needed} întrebări grilă bazate EXCLUSIV pe textul de mai jos.

REGULI:
- Un singur răspuns corect (isCorrect: true), 3 distractori plauzibili
- Distractori: din ACEEAȘI categorie, lungime similară cu răspunsul corect, plauzibili medical dar greșiți; NU folosi "toate de mai sus", "niciunul", "ambele A și B"
- Câmp "explanation": justificare medicală (2-3 fraze): de ce varianta corectă e corectă + de ce fiecare distractor e greșit
- Câmp "tags": 3-5 cuvinte cheie ex: ["cardiologie","fibrilație"]
- Câmp "reference": referință Harrison/Gomella sau "" dacă nu există
- NU genera întrebări despre JSON/format
- Răspunde DOAR cu JSON pur, fără markdown${typeInstruction}

TEXT:
---
${chunk.slice(0, 5000)}
---

Format (${needed} obiecte):
[{"text":"?","options":[{"text":"A","isCorrect":false},{"text":"B","isCorrect":true},{"text":"C","isCorrect":false},{"text":"D","isCorrect":false},{"text":"E","isCorrect":false}],"explanation":"...","tags":["tag"],"reference":""${typeFormatField}}]`;
    logAIDebug('generateQuestionsFromText.prompt', { questionTypes, needed, userPrompt });

    let raw = '';
    let lastError = '';
    for (let attempt = 0; attempt < 3; attempt++) {
      const msgs: GroqMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ];
      if (attempt > 0) {
        msgs.push({ role: 'assistant', content: raw });
        msgs.push({ role: 'user', content: `Eroare JSON: ${lastError}. Returnează DOAR array JSON valid.` });
      }
      try {
        raw = await groqChat(msgs, 0.2, { skipLibraryContext: true, task: 'questions' });
        if (raw.includes('[') && raw.includes(']')) break;
        lastError = 'Nu conține array JSON';
      } catch (e: unknown) {
        lastError = e instanceof Error ? e.message : String(e);
        if (attempt === 2 && allQuestions.length === 0)
          throw new Error(`Eroare API după 3 încercări: ${lastError}`);
      }
    }

    const jsonStr = extractJsonArray(raw);
    if (!jsonStr) continue; // bad chunk — try next

    let parsed: GeneratedQuestion[];
    try { parsed = JSON.parse(jsonStr) as GeneratedQuestion[]; }
    catch { continue; }

    // ── Anti-hallucination filter + deduplication ────────────────────────────
    const valid = parsed
      .filter(isValidQuestion)
      .filter(q => !isDuplicateQuestion(q.text, seenTexts));

    valid.forEach(q => seenTexts.push(q.text));
    allQuestions.push(...valid);
    onProgress?.(Math.min(allQuestions.length, count), count);
  }

  // ── Silent regeneration pass ──────────────────────────────────────────────
  // If we're still short, make one more targeted call emphasizing the gap.
  if (allQuestions.length < count && chunks.length > 0) {
    const missing = count - allQuestions.length;
    const avoidHint = seenTexts.slice(0, 3).map(t => t.slice(0, 60)).join(' | ');
    const regenPrompt = `Creează exact ${missing} întrebări grilă SUPLIMENTARE din textul de mai jos.
IMPORTANT: Întrebările trebuie să fie COMPLET DIFERITE de: "${avoidHint}"

TEXT:
---
${chunks[0].slice(0, 5000)}
---

Format: [{"text":"?","options":[{"text":"A","isCorrect":false},{"text":"B","isCorrect":true},{"text":"C","isCorrect":false},{"text":"D","isCorrect":false},{"text":"E","isCorrect":false}],"explanation":"...","tags":[],"reference":""}]`;

    try {
      const regenRaw = await groqChat([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: regenPrompt },
      ], 0.35, { skipLibraryContext: true, task: 'questions' });
      const regenJson = extractJsonArray(regenRaw);
      if (regenJson) {
        const regenParsed = JSON.parse(regenJson) as GeneratedQuestion[];
        const regenValid = regenParsed
          .filter(isValidQuestion)
          .filter(q => !isDuplicateQuestion(q.text, seenTexts));
        allQuestions.push(...regenValid);
      }
    } catch { /* silent — partial results are better than a total failure */ }
  }

  if (allQuestions.length === 0)
    throw new Error('Răspuns AI invalid — încearcă din nou sau verifică textul PDF.');

  return allQuestions.slice(0, count);
}

export async function generateClinicalCase(
  text: string,
  count = 3
): Promise<GeneratedQuestion[]> {
  const cleanText = text
    .replace(/\f/g, '\n').replace(/[ \t]{3,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, 8000);

  if (cleanText.length < 80)
    throw new Error('Textul este prea scurt pentru generarea de cazuri clinice.');

  const language = detectLanguage(cleanText);
  const userPrompt = `Creează ${count} cazuri clinice bazate EXCLUSIV pe textul de mai jos. Limbă: ${language}.

STRUCTURA OBLIGATORIE:
- "text": istoricul pacientului detaliat (sex, vârstă, simptome, analize) + întrebarea clinică
  Ex: "Pacient 45 ani, bărbat, dispnee 3 săptămâni, edeme gambiere. FCC=110. Rx: cardiomegalie. Diagnostic?"
- "options": 5 opțiuni (A-E), un singur răspuns corect — formatul de la rezidențiat
- "explanation": argumentare medicală (3-4 fraze)
- "tags": 3-5 cuvinte cheie
- "reference": Harrison/Gomella sau ""

TEXT:
---
${cleanText}
---

Format JSON pur (${count} cazuri):
[{"text":"Pacient...?","options":[{"text":"A","isCorrect":false},{"text":"B","isCorrect":true},{"text":"C","isCorrect":false},{"text":"D","isCorrect":false},{"text":"E","isCorrect":false}],"explanation":"...","tags":["tag"],"reference":""}]`;

  let raw = '';
  for (let attempt = 0; attempt < 3; attempt++) {
    raw = await groqChat([
      { role: 'system', content: getMedicalSystemPrompt('examiner') + '\nGenerează cazuri clinice EXCLUSIV din textul primit.' },
      { role: 'user', content: userPrompt },
    ], 0.3, { skipLibraryContext: true, task: 'questions' });
    if (raw.includes('[') && raw.includes(']')) break;
  }

  const jsonStr = extractJsonArray(raw);
  if (!jsonStr) throw new Error('Nu s-a putut genera cazul clinic — încearcă din nou.');

  let parsed: GeneratedQuestion[];
  try { parsed = JSON.parse(jsonStr) as GeneratedQuestion[]; }
  catch { throw new Error('JSON invalid — încearcă din nou.'); }

  return parsed.filter(isValidQuestion);
}

function normalizeFlashcardKey(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 140);
}

function isDuplicateFlashcard(front: string, existingFronts: string[]) {
  const normalized = normalizeFlashcardKey(front);
  if (!normalized) return true;

  return existingFronts.some((existing) => {
    const candidate = normalizeFlashcardKey(existing);
    if (!candidate) return false;
    if (candidate === normalized) return true;
    const maxLen = Math.max(candidate.length, normalized.length);
    if (maxLen < 24) return candidate.includes(normalized) || normalized.includes(candidate);
    return 1 - levenshtein(candidate, normalized) / maxLen > 0.82;
  });
}

export async function notesToFlashcards(
  notesText: string,
  options: {
    count?: number;
    avoidFronts?: string[];
    sourceName?: string;
  } = {},
): Promise<{ front: string; back: string }[]> {
  if (!notesText || notesText.trim().length < 20)
    throw new Error('Notitele sunt prea scurte pentru conversie in flashcarduri.');

  const targetCount = Math.max(1, Math.min(100, Math.round(options.count ?? 15)));
  const cleanText = notesText
    .replace(/\f/g, '\n')
    .replace(/[ \t]{3,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  const maxChunks = Math.max(4, Math.min(14, Math.ceil(targetCount / 8)));
  const chunks = chunkText(cleanText, 5200, 420, maxChunks);
  const batchSize = 10;
  const generated: { front: string; back: string }[] = [];
  const seenFronts = [...(options.avoidFronts ?? [])];

  for (let index = 0; index < chunks.length && generated.length < targetCount; index += 1) {
    const requested = Math.min(batchSize, targetCount - generated.length);
    const avoidList = seenFronts.slice(-35).map((front) => `- ${front.slice(0, 120)}`).join('\n');
    const userPrompt = `Transforma textul medical de mai jos in exact ${requested} flashcarduri ultra-eficiente pentru examen.
REGULI:
- "front": intrebare de active recall, clara si specifica
- "back": raspuns critic, scurt si explicativ; include mecanismul daca ajuta memorarea
- Acopera definitii, mecanisme, semne clinice, diagnostic, tratament, capcane si diferente intre concepte apropiate.
- Nu repeta carduri deja existente.
- Nu formula carduri despre document/PDF/pagina; intreaba despre continutul medical.
- Raspunde strict cu array JSON valid, fara markdown.
${avoidList ? `CARDURI DE EVITAT (deja exista sau au fost generate):\n${avoidList}\n` : ''}

TEXT SURSA${options.sourceName ? ` (${options.sourceName})` : ''}:
---
${chunks[index]}
---

Format: [{"front":"?","back":"..."}]`;

    let raw = '';
    for (let attempt = 0; attempt < 3; attempt++) {
      raw = await groqChat([
        { role: 'system', content: getMedicalSystemPrompt('tutor') + '\nEsti expert in transformarea cursurilor medicale dense in flashcarduri de tip Active Recall, fara repetitii si fara umplutura.' },
        { role: 'user', content: userPrompt },
      ], attempt === 0 ? 0.32 : 0.45, { skipLibraryContext: true, task: 'questions' });
      if (raw.includes('[') && raw.includes(']')) break;
    }

    const jsonStr = extractJsonArray(raw);
    if (!jsonStr) continue;

    try {
      const parsed = JSON.parse(jsonStr) as { front: string; back: string }[];
      parsed
        .filter(f => f.front?.trim() && f.back?.trim())
        .filter(f => !isDuplicateFlashcard(f.front, seenFronts))
        .forEach((flashcard) => {
          if (generated.length >= targetCount) return;
          generated.push({
            front: flashcard.front.trim(),
            back: flashcard.back.trim(),
          });
          seenFronts.push(flashcard.front);
        });
    } catch {
      // Continue with the next chunk; partial high-quality output is better than losing the deck.
    }
  }

  if (generated.length === 0) {
    throw new Error('Nu s-au putut genera flashcardurile. Textul ar putea fi prea complex sau ilizibil.');
  }

  return generated.slice(0, targetCount);
}

export async function explainWrongAnswer(
  questionText: string,
  userAnswer: string,
  correctAnswer: string,
  userContext?: string
): Promise<string> {
  const forgotContext = /am uitat contextul/i.test(userAnswer);
  const studentAnswerLine = forgotContext
    ? 'Studentul foloseste flashcardul pentru active recall si nu a formulat raspunsul din memorie.'
    : `Raspunsul studentului: "${userAnswer}".`;

  return groqChat([
    { role: 'system', content: getMedicalSystemPrompt('explainer', userContext) },
    {
      role: 'user',
      content: `Explică SCURT și DIRECT. Maxim 4-5 propoziții totale, fără eseuri.

Întâi verifică medical dacă "${correctAnswer}" este chiar răspunsul corect (grila poate fi generată automat și greșită). Dacă e greșit, începe cu „⚠️ Grila pare greșită — corect este de fapt «...»" și explică; nu apăra o cheie eronată.

Dacă e corect, FORMAT:
1. De ce "${correctAnswer}" e corect — 1-2 propoziții cu mecanismul cheie.
2. De ce răspunsul ales cade — 1 propoziție, direct.
3. Regula scurtă de reținut pentru examen — 1 propoziție memorabilă.

Nu repeta întrebarea. Nu enumera toate variantele. Răspunde în română.

Întrebare: ${questionText}
${studentAnswerLine}
Răspuns marcat ca corect în grilă: "${correctAnswer}"`,
    },
  ], 0.3);
}

// ── New smart AI functions ──────────────────────────────────────────────────────

/**
 * Streaming inline explanation for a revealed answer in QuizPlay.
 * Explains the correct answer + why wrong options are wrong.
 * Personalized via userContext.
 */
export async function explainAnswerInline(
  questionText: string,
  options: { text: string; isCorrect: boolean }[],
  onChunk: (text: string) => void,
  signal?: AbortSignal,
  userContext?: string
): Promise<void> {
  const correct = options.find(o => o.isCorrect)?.text ?? '';
  const wrong = options.filter(o => !o.isCorrect).map(o => `"${o.text}"`).join(', ');

  await groqStream([
    { role: 'system', content: getMedicalSystemPrompt('explainer', userContext) },
    {
      role: 'user',
      content: `Intrebare: "${questionText}"
Raspuns marcat ca CORECT in grila: "${correct}"
Variante marcate ca gresite: ${wrong}

Aceasta grila a putut fi generata automat, deci cheia poate contine erori.
PASUL 0 — VERIFICA medical daca "${correct}" este chiar raspunsul corect:
- Daca este corect: explica normal.
- Daca este GRESIT (alta varianta e corecta sau enuntul/cheia au o eroare): spune RASPICAT din prima propozitie, ex: "⚠️ Atentie: grila pare gresita — raspunsul corect real este «...», nu «${correct}»", apoi explica de ce. NU justifica o cheie gresita.

Daca cheia este corecta, explica pentru un student la medicina:
- de ce varianta corecta este buna,
- de ce fiecare varianta gresita pica si cand ar putea deveni corecta,
- mecanismul fiziologic/fiziopatologic,
- capcana de examen,
- regula scurta de retinut.

Raspunde in romana, concis, dar fara superficialitate.`,
    },
  ], onChunk, 0.3, signal);
}

/**
 * Generates a personalized daily study recommendation for Dashboard.
 * Falls back to a deterministic tip if no AI key or user data.
 */
export async function generateStudyRecommendation(
  userContext: string,
  dueCount: number,
  weakTopics: string[]
): Promise<string> {
  if (!userContext) {
    if (dueCount > 0) return `Ai ${dueCount} întrebări de recapitulat azi. Începe cu ele pentru a menține SM-2 activ!`;
    return 'Rezolvă prima sesiune de grile pentru a activa recomandările personalizate AI!';
  }

  return groqChat([
    { role: 'system', content: getMedicalSystemPrompt('advisor', userContext) },
    {
      role: 'user',
      content: `Recomandă-mi ce să studiez azi.${dueCount > 0 ? ` Am ${dueCount} întrebări de recapitulat.` : ''}${weakTopics.length > 0 ? ` Cele mai slabe topicuri: ${weakTopics.join(', ')}.` : ''} Maxim 2 fraze scurte, concrete.`,
    },
  ], 0.5);
}

/**
 * Generates a medical mnemonic for a hard question answered wrong repeatedly.
 */
/**
 * Streams a personalized weak-spot analysis report.
 * Call from Stats page after gathering category-level accuracy data.
 */
export async function generateWeakSpotReport(
  data: {
    weakCategories: { name: string; accuracy: number; quizCount: number }[];
    totalAccuracy: number;
    streak: number;
    totalAnswered: number;
    recentMistakeTopics: string[];
  },
  onChunk: (text: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  const hasData = data.weakCategories.length > 0 || data.recentMistakeTopics.length > 0 || data.totalAnswered > 0;
  if (!hasData) {
    onChunk('Nu există suficiente date de studiu. Rezolvă câteva sesiuni de grile pentru a activa raportul personalizat!');
    return;
  }
  const weakList = data.weakCategories
    .slice(0, 6)
    .map(c => `• ${c.name}: ${c.accuracy}% (${c.quizCount} grile)`)
    .join('\n');
  const mistakeTopics = data.recentMistakeTopics.slice(0, 6).join(', ');
  await groqStream(
    [
      { role: 'system', content: getMedicalSystemPrompt('advisor') },
      {
        role: 'user',
        content: `Analizează datele de studiu ale studentului și generează un raport SCURT, SPECIFIC și MOTIVANT.

DATE:
- Acuratețe globală: ${data.totalAccuracy}%
- Streak actual: ${data.streak} zile
- Total răspunsuri date: ${data.totalAnswered}
${weakList ? `\nCATEGORII CU ACURATEȚE SCĂZUTĂ:\n${weakList}` : ''}
${mistakeTopics ? `\nTOPICURI CU GREȘELI RECENTE: ${mistakeTopics}` : ''}

INSTRUCȚIUNI:
- 3-5 fraze, fără bullet points, ton de tutor
- Identifică zona cea mai problematică și explică DE CE poate fi dificilă
- O recomandare concretă și acționabilă pentru săptămâna asta
- Un sfat tactic pentru examen legat de punctele slabe
- Închide cu o notă de încurajare sinceră bazată pe datele actuale
- Limbă: română, stil direct și cald`,
      },
    ],
    onChunk,
    0.5,
    signal,
  );
}

export async function generateMnemonic(
  questionText: string,
  correctAnswer: string
): Promise<string> {
  return groqChat([
    {
      role: 'system',
      content: `Ești expert în mnemonice medicale (ex: "CRAB" pentru mielom multiplu). 
Scop: Creează un ajutor de memorare (acronim, poveste scurtă, rimă sau asociere vizuală amuzantă) care să lege conceptul din întrebare de răspunsul corect.
Limba: Română.
Stil: Creativ, ușor de reținut, chiar și puțin absurd pentru a favoriza memorarea. Max 2-3 fraze.`,
    },
    {
      role: 'user',
      content: `Am nevoie de o mnemonică pentru a reține că răspunsul corect este "${correctAnswer}" pentru întrebarea: "${questionText}"`,
    },
  ], 0.85);
}
