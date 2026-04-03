import type { ValidateJsonResult } from './types';

function extractJson(raw: string) {
  const cleaned = raw.replace(/```json/gi, '```').replace(/```/g, '').trim();
  const firstBrace = cleaned.indexOf('{');
  const firstBracket = cleaned.indexOf('[');
  const start = [firstBrace, firstBracket].filter((value) => value >= 0).sort((a, b) => a - b)[0];
  if (start === undefined) return cleaned;
  const lastBrace = cleaned.lastIndexOf('}');
  const lastBracket = cleaned.lastIndexOf(']');
  const end = Math.max(lastBrace, lastBracket);
  if (end < start) return cleaned.slice(start);
  return cleaned.slice(start, end + 1);
}

function repairJson(raw: string) {
  return extractJson(raw)
    .replace(/,\s*([}\]])/g, '$1')
    .replace(/\u201c|\u201d/g, '"')
    .replace(/\u2018|\u2019/g, "'");
}

export function validateJson<T>(raw: string): ValidateJsonResult<T> {
  try {
    return { ok: true, value: JSON.parse(extractJson(raw)) as T };
  } catch {
    const repaired = repairJson(raw);
    try {
      return { ok: true, value: JSON.parse(repaired) as T, repaired };
    } catch (repairError) {
      return {
        ok: false,
        error: repairError instanceof Error ? repairError.message : 'JSON invalid',
        repaired,
      };
    }
  }
}
