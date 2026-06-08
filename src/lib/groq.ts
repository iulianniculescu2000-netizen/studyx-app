import { useAIStore } from '../store/aiStore';
import { HEART_IMG, ECG_IMG, CELL_IMG, DNA_IMG, NEURON_IMG } from '../data/sampleImages';
import { getMedicalSystemPrompt } from './aiContext';
import { logAIDebug } from '../ai/debug';
import type { AIRequestTask } from '../ai/types';
import { createRequestGovernor } from './aiRequestGovernor';
import { logDiagnosticEvent } from '../store/diagnosticsStore';

export interface GroqMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GeneratedQuestion {
  text: string;
  options: { text: string; isCorrect: boolean }[];
  explanation?: string;
  tags?: string[];
  reference?: string;
}

function buildKnowledgeQuery(messages: GroqMessage[]): string {
  const lastUserMessage = [...messages].reverse().find((message) => message.role === 'user')?.content ?? '';
  return lastUserMessage.slice(0, 1200).trim() || 'Context medical general';
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
  explanation: 1300,
  mnemonic: 300,
  hint: 500,
  chat: 1200,
  analysis: 1000,
};

function sanitizeKey(key: string): string {
  // eslint-disable-next-line no-control-regex
  return key.replace(/[^\x00-\x7F]/g, '').trim();
}

function getProviderConfig(provider: ReturnType<typeof useAIStore.getState>['provider']) {
  if (provider === 'deepseek') {
    return {
      name: 'DeepSeek',
      endpoint: 'https://api.deepseek.com/chat/completions',
      keyHint: 'Cheia API DeepSeek nu este configurata. Mergi la Setari AI.',
    };
  }

  return {
    name: 'Groq',
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
    keyHint: 'Cheia API Groq nu este configurata. Mergi la Setari AI.',
  };
}

function extractJsonArray(raw: string): string | null {
  const stripped = raw.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '');
  const start = stripped.indexOf('[');
  const end = stripped.lastIndexOf(']');
  if (start === -1 || end === -1 || end <= start) return null;
  return stripped.slice(start, end + 1);
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
function isValidQuestion(q: GeneratedQuestion): boolean {
  if (!q.text?.trim() || !Array.isArray(q.options) || q.options.length < 2) return false;
  if (q.text.toLowerCase().includes('json') || q.text.toLowerCase().includes('format')) return false;
  const corrects = q.options.filter(o => o.isCorrect === true);
  // Hallucination check 1: must have exactly one correct option
  if (corrects.length !== 1) return false;
  // Hallucination check 2: correct option must have non-empty text
  if (!corrects[0].text?.trim()) return false;
  // Hallucination check 3: correct option must not be virtually identical to a wrong option
  // (catches cases where AI copies the answer into a distractor with minimal edits)
  const correctNorm = corrects[0].text.toLowerCase().trim();
  const hasPhantomDuplicate = q.options
    .filter(o => !o.isCorrect)
    .some(o => {
      const wrongNorm = (o.text ?? '').toLowerCase().trim();
      if (!wrongNorm) return false;
      const maxLen = Math.max(correctNorm.length, wrongNorm.length);
      return maxLen > 0 && levenshtein(correctNorm, wrongNorm) / maxLen < 0.07; // >93% identical
    });
  return !hasPhantomDuplicate;
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

// ── Image Recommendation ──────────────────────────────────────────────────────
// Returns the most relevant sample medical diagram for a given question's topic.
const IMAGE_KEYWORD_MAP: Array<{ keywords: string[]; image: string }> = [
  {
    keywords: [
      'inimă', 'cardiac', 'atriu', 'ventricul', 'cord', 'mitral', 'aortă',
      'pericardiu', 'coronarian', 'endocard', 'miocard', 'valvă', 'sinusal',
      'heart', 'atrial', 'ventricular', 'tricuspidă', 'pulmonară',
    ],
    image: HEART_IMG,
  },
  {
    keywords: [
      'ecg', 'ekg', 'electrocardiog', 'pqrst', 'fibrilație atrială',
      'tahicardie', 'bradicardie', 'aritmie', 'flutter', 'bloc av',
      'st-', 'qrs', 'interval qt', 'undă p', 'infarct miocardic',
    ],
    image: ECG_IMG,
  },
  {
    keywords: [
      'celulă', 'nucleu', 'mitocondri', 'golgi', 'lizozom', 'ribozom',
      'reticul endoplasmatic', 'eucariot', 'citoplasmă', 'membrană celulară',
      'organit', 'celular', 'procariote',
    ],
    image: CELL_IMG,
  },
  {
    keywords: [
      'adn', 'dna', 'cromozom', 'genă', 'mutație', 'helix', 'nucleotid',
      'baze azotate', 'transcripție', 'translație', 'replicare', 'codon',
      'genomic', 'alele', 'genotip', 'fenotip',
    ],
    image: DNA_IMG,
  },
  {
    keywords: [
      'neuron', 'axon', 'dendrit', 'sinapsă', 'sistem nervos', 'neural',
      'mielină', 'potențial de acțiune', 'neurotransmițător', 'sinaptic',
      'glia', 'neuro', 'acetilcolină', 'dopamină',
    ],
    image: NEURON_IMG,
  },
];

/**
 * Recommends the most relevant sample medical diagram for a question.
 * Returns a data URL string or null if no strong match is found.
 */
export function recommendImage(questionText: string): string | null {
  const text = questionText.toLowerCase();
  let best: { image: string; score: number } | null = null;
  for (const entry of IMAGE_KEYWORD_MAP) {
    const score = entry.keywords.reduce((acc, kw) => acc + (text.includes(kw) ? 1 : 0), 0);
    if (score > 0 && (!best || score > best.score)) {
      best = { image: entry.image, score };
    }
  }
  return best?.image ?? null;
}

// ── Request Queue & Rate Limiting ──────────────────────────────────────────
// Ensures we don't hit Groq's rate limits by controlling concurrency and spacing.
const groqGovernor = createRequestGovernor({ concurrency: 1, baseSpacingMs: 650 });

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
  return groqGovernor.run(task, async () => {
    const { apiKey, provider, model, getKnowledgeContext } = useAIStore.getState();
    const providerConfig = getProviderConfig(provider);
    const key = sanitizeKey(apiKey);
    if (!key) throw new Error(providerConfig.keyHint);
    const kb = skipLibraryContext ? '' : await getKnowledgeContext(buildKnowledgeQuery(messages), 6000);
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

    logAIDebug('groq:request', {
      task,
      provider,
      model,
      temperature: finalTemperature,
      maxTokens: finalMaxTokens,
      messagesCount: messages.length,
    });

    if (abortSignal?.aborted) {
      throw new Error('Request aborted before start');
    }

    let lastError = 'Eroare necunoscuta';
    const maxAttempts = 4;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const response = await fetch(providerConfig.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${key}`,
          },
          body: JSON.stringify({
            model,
            messages: finalMessages,
            temperature: finalTemperature,
            max_tokens: finalMaxTokens,
          }),
          signal: abortSignal,
        });

        if (!response.ok) {
          const err = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
          const msg = err?.error?.message ?? response.statusText;
          if (response.status === 429 && attempt < maxAttempts - 1) { // Rate limit hit
            const retryAfter = response.headers.get('retry-after');
            const delayMs = getRetryDelayMs(attempt, retryAfter);
            logAIDebug('groq:ratelimit', { task, retryAfter, delayMs });
            logDiagnosticEvent({
              area: 'ai',
              level: 'warning',
              title: `Limita ${providerConfig.name} atinsa`,
              detail: `Task ${task}: StudyX pune cererea in pauza ${Math.ceil(delayMs / 1000)}s si reincerca automat.`,
            });
            await new Promise(resolve => setTimeout(resolve, delayMs));
            continue;
          }
          throw new Error(msg);
        }

        const data = await response.json();
        const output = (data.choices?.[0]?.message?.content ?? '').trim();
        logAIDebug('groq:response', { task, output });
        return output;
      } catch (error: unknown) {
        lastError = error instanceof Error ? error.message : String(error);
        logAIDebug('groq:error', { task, attempt, error: lastError });
        if (attempt < maxAttempts - 1) {
          await new Promise((resolve) => setTimeout(resolve, getRetryDelayMs(attempt, null)));
        }
      }
    }

    logDiagnosticEvent({
      area: 'ai',
      level: 'error',
      title: `${providerConfig.name} indisponibil`,
      detail: `Task ${task}: ${lastError}`,
    });
    throw new Error(`Eroare ${providerConfig.name} API: ${lastError}`);
  });
}

export async function groqChat(messages: GroqMessage[], temperature = 0.7): Promise<string> {
  return groqRequest({ task: 'chat', messages, temperature, maxTokens: 4096 });
}

export async function groqStream(
  messages: GroqMessage[],
  onChunk: (text: string) => void,
  temperature = 0.7,
  abortSignal?: AbortSignal
): Promise<string> {
  if (abortSignal?.aborted) {
    throw new Error('Stream aborted before start');
  }
  return groqGovernor.run('chat', async () => {
    const { apiKey, provider, model, getKnowledgeContext } = useAIStore.getState();
    const providerConfig = getProviderConfig(provider);
    const key = sanitizeKey(apiKey);
    if (!key) throw new Error(providerConfig.keyHint);
    const kb = await getKnowledgeContext(buildKnowledgeQuery(messages), 4500);
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

    const res = await fetch(providerConfig.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, messages: finalMessages, temperature, max_tokens: 4096, stream: true }),
      signal: combinedSignal,
    });

    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      const message = err?.error?.message ?? res.statusText;
      logDiagnosticEvent({
        area: 'ai',
        level: 'warning',
        title: 'Stream AI oprit',
        detail: message,
      });
      throw new Error(`Eroare ${providerConfig.name} API: ${message}`);
    }
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
  const chunks = chunkText(cleanText, 4500, 350, Math.max(4, Math.min(14, Math.ceil(count / 8))));
  const perChunk = Math.max(1, Math.ceil(count / chunks.length));

  const allQuestions: GeneratedQuestion[] = [];
  const seenTexts: string[] = [...existingQuestionTexts];

  for (const chunk of chunks) {
    if (allQuestions.length >= count) break;
    const needed = Math.min(perChunk, count - allQuestions.length);

    const userPrompt = `Creează exact ${needed} întrebări grilă bazate EXCLUSIV pe textul de mai jos.

REGULI:
- Un singur răspuns corect (isCorrect: true), 3 distractori plauzibili
- Câmp "explanation": justificare medicală (2-3 fraze)
- Câmp "tags": 3-5 cuvinte cheie ex: ["cardiologie","fibrilație"]
- Câmp "reference": referință Harrison/Gomella sau "" dacă nu există
- NU genera întrebări despre JSON/format
- Răspunde DOAR cu JSON pur, fără markdown

TEXT:
---
${chunk.slice(0, 5000)}
---

Format (${needed} obiecte):
[{"text":"?","options":[{"text":"A","isCorrect":false},{"text":"B","isCorrect":true},{"text":"C","isCorrect":false},{"text":"D","isCorrect":false}],"explanation":"...","tags":["tag"],"reference":""}]`;

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
        raw = await groqChat(msgs, 0.2);
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

Format: [{"text":"?","options":[{"text":"A","isCorrect":false},{"text":"B","isCorrect":true},{"text":"C","isCorrect":false},{"text":"D","isCorrect":false}],"explanation":"...","tags":[],"reference":""}]`;

    try {
      const regenRaw = await groqChat([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: regenPrompt },
      ], 0.35);
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
- "options": 4 opțiuni, un singur răspuns corect
- "explanation": argumentare medicală (3-4 fraze)
- "tags": 3-5 cuvinte cheie
- "reference": Harrison/Gomella sau ""

TEXT:
---
${cleanText}
---

Format JSON pur (${count} cazuri):
[{"text":"Pacient...?","options":[{"text":"A","isCorrect":false},{"text":"B","isCorrect":true},{"text":"C","isCorrect":false},{"text":"D","isCorrect":false}],"explanation":"...","tags":["tag"],"reference":""}]`;

  let raw = '';
  for (let attempt = 0; attempt < 3; attempt++) {
    raw = await groqChat([
      { role: 'system', content: getMedicalSystemPrompt('examiner') + '\nGenerează cazuri clinice EXCLUSIV din textul primit.' },
      { role: 'user', content: userPrompt },
    ], 0.3);
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
      ], attempt === 0 ? 0.32 : 0.45);
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

FORMAT:
1. De ce "${correctAnswer}" e corect — 1-2 propoziții cu mecanismul cheie.
2. De ce răspunsul ales cade — 1 propoziție, direct.
3. Regula scurtă de reținut pentru examen — 1 propoziție memorabilă.

Nu repeta întrebarea. Nu enumera toate variantele. Răspunde în română.

Întrebare: ${questionText}
${studentAnswerLine}
Răspuns corect: "${correctAnswer}"`,
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
Corect: "${correct}"
Gresite: ${wrong}

Explica raspunsul ca pentru un student la medicina:
- incepe direct cu: "${correct}" este raspunsul corect deoarece...
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
