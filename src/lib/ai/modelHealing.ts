/**
 * Self-healing for provider model IDs.
 *
 * Providers deprecate/decommission models on their own schedule (Groq killed
 * `llama-3.3-70b-versatile` and `llama-3.1-8b-instant` on 2026-08-16, with
 * `mixtral-8x7b-32768` gone over a year earlier) — a hardcoded model string
 * quietly goes from "works" to "every request fails" with no warning. Two
 * layers guard against that recurring:
 *
 *  1. Reactive (`isModelUnavailableError` + `nextCandidateModel`, used by
 *     `groqRequest`'s retry loop): when a request fails with a "model doesn't
 *     exist/was decommissioned" style error, immediately retry on the next
 *     known-good candidate for that same provider instead of surfacing the
 *     error, and — if it was the user's configured model — persist the swap
 *     so it's fixed going forward, not just for this one request.
 *  2. Proactive (`checkModelAvailability`, run once/day at startup): asks the
 *     provider's own `/models` list which IDs are currently live and swaps
 *     away from the configured one before the user ever hits an error.
 */
import { useAIStore, type AIModel, type AIProvider } from '../../store/aiStore';
import { useToastStore } from '../../store/toastStore';

type ProviderId = 'groq' | 'google' | 'cerebras';

/**
 * Known-good models per provider, in preference order. Kept separate from
 * `PROVIDER_MODELS` in `aiStore.ts` (the user-facing picker) so this list can
 * include models we want to silently fall back to without necessarily
 * offering them all as manual choices.
 */
const MODEL_CANDIDATES: Record<ProviderId, AIModel[]> = {
  groq: ['openai/gpt-oss-120b', 'openai/gpt-oss-20b'],
  google: ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.5-pro'],
  cerebras: ['gpt-oss-120b', 'qwen-3-235b-a22b-instruct-2507', 'zai-glm-4.7'],
};

const MODELS_ENDPOINT: Record<ProviderId, string> = {
  groq: 'https://api.groq.com/openai/v1/models',
  google: 'https://generativelanguage.googleapis.com/v1beta/openai/models',
  cerebras: 'https://api.cerebras.ai/v1/models',
};

/**
 * Matches the error shapes providers actually send for a dead model —
 * verified live against Groq's `"The model \`X\` does not exist or you do
 * not have access to it."`. The rest cover the OpenAI-style wording other
 * providers (and Groq itself, in other error paths) use for the same thing.
 *
 * Two independent checks rather than one proximity regex: model IDs routinely
 * contain periods ("llama-3.3-70b", "gpt-4.1"), and a single `model...phrase`
 * pattern with a `[^.]*` gap breaks the moment the ID between them has a dot
 * in it — which is most of them.
 */
const UNAVAILABLE_PHRASE_RE = /does not exist|not[ _]found|no longer (?:exist|available|supported)|has been decommissioned|is decommissioned|deprecated/i;

export function isModelUnavailableError(message: string): boolean {
  if (/\bdecommissioned\b/i.test(message)) return true;
  return /\bmodel\b/i.test(message) && UNAVAILABLE_PHRASE_RE.test(message);
}

/** First candidate for this provider that isn't the one that just failed, or null if there's nothing left to try. */
export function nextCandidateModel(provider: ProviderId, failedModel: string): AIModel | null {
  return MODEL_CANDIDATES[provider].find((candidate) => candidate !== failedModel) ?? null;
}

/**
 * Called after a reactive swap succeeds. Only persists (and only notifies
 * the user) when the model that died was their own configured default —
 * a fallback-provider's hardcoded model swapping mid-request needs no
 * user-facing change, since `FALLBACK_MODEL` isn't something the user set.
 */
export function healPrimaryModelChoice(
  provider: AIProvider,
  primaryProvider: AIProvider,
  deadModel: string,
  workingModel: AIModel,
  providerName: string,
) {
  if (provider !== primaryProvider) return;
  useAIStore.getState().setModel(workingModel);
  useToastStore.getState().addToast(
    `${providerName} nu mai oferă modelul "${deadModel}" — am trecut automat pe ${workingModel} și am salvat schimbarea.`,
    'info',
    7000,
  );
}

interface ModelListResponse {
  data?: Array<{ id?: string }>;
}

const LAST_CHECK_KEY = 'studyx-model-health-check';
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

function isKnownProvider(provider: AIProvider): provider is ProviderId {
  return provider === 'groq' || provider === 'google' || provider === 'cerebras';
}

/**
 * Proactive check: asks the active provider which models are currently live
 * and swaps away from the configured one if it's gone — before the user's
 * next request would have failed on it. Throttled to once/day per provider
 * (a hardcoded model doesn't change more often than that, and this is a
 * network call on every app boot otherwise). Fails silently on any network
 * or parsing error — this is a nice-to-have, never something that should
 * block startup or surface as an error of its own.
 */
export async function checkModelAvailability(): Promise<void> {
  const state = useAIStore.getState();
  const { provider, model, apiKey } = state;
  if (!isKnownProvider(provider) || !apiKey.trim()) return;

  const throttleKey = `${LAST_CHECK_KEY}:${provider}`;
  const last = Number(localStorage.getItem(throttleKey) ?? 0);
  if (Date.now() - last < CHECK_INTERVAL_MS) return;

  try {
    const res = await fetch(MODELS_ENDPOINT[provider], {
      headers: { Authorization: `Bearer ${apiKey.trim()}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return; // key issues etc. — the reactive layer + existing key validation cover that
    const body = await res.json() as ModelListResponse;
    const liveIds = new Set((body.data ?? []).map((entry) => entry.id).filter((id): id is string => !!id));
    if (liveIds.size === 0) return; // an empty/malformed list is more likely a parsing miss than a truth

    localStorage.setItem(throttleKey, String(Date.now()));
    if (liveIds.has(model)) return;

    const replacement = MODEL_CANDIDATES[provider].find((candidate) => liveIds.has(candidate))
      ?? MODEL_CANDIDATES[provider][0];
    healPrimaryModelChoice(provider, provider, model, replacement, providerDisplayName(provider));
  } catch {
    // Offline, timeout, CORS, whatever — silently skip. The reactive layer
    // still catches a genuinely dead model the next time it's actually used.
  }
}

function providerDisplayName(provider: ProviderId): string {
  if (provider === 'google') return 'Google Gemini';
  if (provider === 'cerebras') return 'Cerebras';
  return 'Groq';
}
