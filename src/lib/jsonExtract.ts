/**
 * Pulling JSON out of a model reply.
 *
 * Two failure modes this exists to survive:
 *
 * 1. A conversational preamble. Slicing from the first `{` anywhere in the text
 *    breaks the moment the model writes "Sigur! Iată {desigur} rezultatul:" —
 *    the slice then starts inside the chit-chat.
 * 2. A reply cut off by `max_tokens`. Slicing to the last `]` lands on some
 *    inner array, so the whole batch fails to parse and every complete item in
 *    it is thrown away, even though they were perfectly usable.
 */

function stripFences(raw: string): string {
  return raw.replace(/```(?:json)?/gi, '```').replace(/```/g, '').trim();
}

/**
 * Index just past the balanced value starting at `start`, or -1 if it never
 * closes. String contents are skipped so braces inside text don't count.
 */
function findBalancedEnd(text: string, start: number): number {
  const open = text[start];
  const close = open === '{' ? '}' : ']';
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (escaped) { escaped = false; continue; }
    if (ch === '\\') { if (inString) escaped = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === open) depth += 1;
    else if (ch === close) {
      depth -= 1;
      if (depth === 0) return i + 1;
    }
  }
  return -1;
}

/**
 * The longest self-contained JSON value in the reply that actually parses.
 * Longest rather than first, because a preamble can itself contain something
 * technically parseable while the real payload is the substantial one.
 */
export function extractBalancedJson(raw: string): string | null {
  const cleaned = stripFences(raw);
  let best: string | null = null;

  for (let i = 0; i < cleaned.length; i += 1) {
    const ch = cleaned[i];
    if (ch !== '{' && ch !== '[') continue;
    const end = findBalancedEnd(cleaned, i);
    if (end === -1) continue;
    const candidate = cleaned.slice(i, end);
    if (best !== null && candidate.length <= best.length) continue;
    try {
      JSON.parse(candidate);
      best = candidate;
    } catch {
      // Not JSON — keep scanning.
    }
  }
  return best;
}

/**
 * Rebuilds an array from the complete objects of a truncated one. A reply cut
 * mid-object still usually carries several finished questions before the cut;
 * this keeps those instead of discarding the batch.
 */
export function salvageJsonArrayObjects(raw: string): string | null {
  const cleaned = stripFences(raw);
  const start = cleaned.indexOf('[');
  if (start === -1) return null;

  const objects: string[] = [];
  let i = start + 1;
  while (i < cleaned.length) {
    const ch = cleaned[i];
    if (ch === ']') break;
    if (ch !== '{') { i += 1; continue; }

    const end = findBalancedEnd(cleaned, i);
    if (end === -1) break; // cut off mid-object — keep whatever came before it
    const candidate = cleaned.slice(i, end);
    try {
      JSON.parse(candidate);
      objects.push(candidate);
    } catch {
      // Malformed entry — skip it rather than lose the rest.
    }
    i = end;
  }

  return objects.length > 0 ? `[${objects.join(',')}]` : null;
}

/**
 * A JSON array string ready to parse: the intact array when the reply is whole,
 * otherwise as many complete elements as survived the truncation.
 */
export function extractJsonArrayLenient(raw: string): string | null {
  const balanced = extractBalancedJson(raw);
  if (balanced && balanced.trimStart().startsWith('[')) return balanced;
  return salvageJsonArrayObjects(raw) ?? balanced;
}
