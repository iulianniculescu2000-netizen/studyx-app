/**
 * AI safety net for the grile extractor.
 *
 * When the template engine can't find the correct answer (no bold/color/key —
 * e.g. plain scanned text), we ask the user's own AI to pick it. Answers found
 * this way are marked `answerSource: 'ai'` with medium confidence and a warning,
 * so the review screen always flags them for a human check — the AI never
 * silently overrides a formatting-derived answer.
 */
import { groqRequest } from '../groq';
import { extractJsonFromText } from '../quizImport';
import type { ParsedQuestion } from './grileParser';

const BATCH_SIZE = 12;
const AI_TEXT_LIMIT = 9000; // chars per AI extraction call

interface AIExtractedQuestion {
  question?: string;
  multipleCorrect?: boolean;
  options?: { text?: string; correct?: boolean }[];
}

/**
 * Fallback for documents the template engine can't structure (odd layout, no
 * numbering/markers): hand the raw text to the AI and ask it to pull out the
 * grile. Everything it returns is `answerSource: 'ai'` (flagged for review).
 */
export async function extractGrileFromTextWithAI(text: string): Promise<ParsedQuestion[]> {
  const clipped = text.replace(/\s+\n/g, '\n').slice(0, AI_TEXT_LIMIT).trim();
  if (clipped.length < 40) return [];

  const prompt = [
    'Ești examinator de Medicină. Textul de mai jos conține întrebări grilă, posibil formatate dezordonat.',
    'Extrage fiecare întrebare EXACT cum e scrisă (nu traduce, nu reformula), cu variantele ei.',
    'Dacă răspunsul corect este indicat (marcat, subliniat, cu „R:", cheie), pune "correct": true la acea variantă; altfel toate false.',
    'Răspunde DOAR cu JSON valid, fără text în plus:',
    '[{"question":"enunț","multipleCorrect":false,"options":[{"text":"varianta","correct":true},{"text":"varianta","correct":false}]}]',
    '',
    'TEXT:',
    clipped,
  ].join('\n');

  const raw = await groqRequest({
    task: 'questions',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.1,
    maxTokens: 2400,
    skipLibraryContext: true,
  });

  const parsed = extractJsonFromText(raw) as AIExtractedQuestion[];
  if (!Array.isArray(parsed)) return [];

  const out: ParsedQuestion[] = [];
  for (const item of parsed) {
    const stem = (item.question ?? '').trim();
    const options = (item.options ?? [])
      .map((o) => ({ text: (o.text ?? '').trim(), isCorrect: !!o.correct }))
      .filter((o) => o.text);
    if (!stem || options.length < 2) continue;
    const hasAnswer = options.some((o) => o.isCorrect);
    out.push({
      text: stem,
      options,
      multipleCorrect: !!item.multipleCorrect || options.filter((o) => o.isCorrect).length > 1,
      answerSource: hasAnswer ? 'ai' : 'none',
      confidence: hasAnswer ? 'medium' : 'low',
      warnings: ['Recunoscut de AI — verifică.'],
    });
  }
  return out;
}

function letterToIndex(letter: string): number {
  return letter.trim().toLowerCase().charCodeAt(0) - 97;
}

interface AIAnswer {
  i: number;
  correct: string[];
}

function buildPrompt(batch: ParsedQuestion[]): string {
  const items = batch
    .map((q, idx) => {
      const opts = q.options
        .map((o, oi) => `   ${String.fromCharCode(97 + oi)}) ${o.text}`)
        .join('\n');
      return `${idx + 1}. ${q.text}\n${opts}`;
    })
    .join('\n\n');

  return [
    'Ești examinator de Medicină. Pentru fiecare întrebare grilă de mai jos, indică litera/literele răspunsului corect.',
    'Răspunde DOAR cu JSON valid, fără text în plus, în forma exactă:',
    '[{"i": 1, "correct": ["a"]}, {"i": 2, "correct": ["b","d"]}]',
    'Reguli: "i" = numărul întrebării; "correct" = literele opțiunilor corecte (una sau mai multe). Nu inventa opțiuni. Dacă nu ești sigur, alege cea mai probabilă variantă.',
    '',
    items,
  ].join('\n');
}

async function inferBatch(batch: ParsedQuestion[]): Promise<Map<number, number[]>> {
  const raw = await groqRequest({
    task: 'questions',
    messages: [{ role: 'user', content: buildPrompt(batch) }],
    temperature: 0.1,
    skipLibraryContext: true,
  });

  const parsed = extractJsonFromText(raw) as AIAnswer[];
  const result = new Map<number, number[]>();
  if (!Array.isArray(parsed)) return result;

  for (const item of parsed) {
    if (!item || typeof item.i !== 'number' || !Array.isArray(item.correct)) continue;
    const q = batch[item.i - 1];
    if (!q) continue;
    const indices = item.correct
      .map((l) => letterToIndex(String(l)))
      .filter((i) => i >= 0 && i < q.options.length);
    if (indices.length > 0) result.set(item.i - 1, [...new Set(indices)]);
  }
  return result;
}

/**
 * Fill in answers for questions the template engine left unanswered.
 * Returns a new array; untouched questions are returned as-is.
 */
export async function inferAnswersWithAI(
  questions: ParsedQuestion[],
  onProgress?: (done: number, total: number) => void,
): Promise<ParsedQuestion[]> {
  const targetIdx = questions
    .map((q, i) => ({ q, i }))
    .filter(({ q }) => q.answerSource === 'none' && q.options.length >= 2);

  if (targetIdx.length === 0) return questions;

  const updated = [...questions];
  let done = 0;

  for (let start = 0; start < targetIdx.length; start += BATCH_SIZE) {
    const slice = targetIdx.slice(start, start + BATCH_SIZE);
    try {
      const answers = await inferBatch(slice.map((s) => s.q));
      answers.forEach((indices, localIdx) => {
        const globalIdx = slice[localIdx].i;
        const q = updated[globalIdx];
        updated[globalIdx] = {
          ...q,
          options: q.options.map((o, oi) => ({ ...o, isCorrect: indices.includes(oi) })),
          multipleCorrect: q.multipleCorrect || indices.length > 1,
          answerSource: 'ai',
          confidence: 'medium',
          warnings: [...new Set([...q.warnings, 'Răspuns propus de AI — verifică.'])],
        };
      });
    } catch (error) {
      console.error('AI answer inference failed for a batch:', error);
      // Leave this batch's questions unanswered; the review screen still flags them.
    }
    done += slice.length;
    onProgress?.(done, targetIdx.length);
  }

  return updated;
}
