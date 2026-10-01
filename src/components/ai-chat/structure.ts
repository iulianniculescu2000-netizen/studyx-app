/**
 * Rescues badly-shaped model output before it is rendered.
 *
 * Even with a strict format contract, models sometimes return one dense
 * paragraph with the structure inlined ("1. … 2. … 3. …") or escape their own
 * markdown ("\* Probabilitate"). Reading that in a chat bubble is painful, so
 * this pass re-establishes line structure — conservatively: it only splits when
 * the signal is unambiguous, and never touches code fences or tables.
 */

/** Inline enumerations: "… 2. text" where the number opens a new step. */
const INLINE_ENUM_RE = /(?<=[^\s])\s+(?=(?:[2-9]|1\d)\.\s+[A-ZĂÂÎȘȚ(])/g;

/** Inline bold labels used as section leads: "**Mecanism:** …". */
const INLINE_LABEL_RE = /(?<=[^\s])\s+(?=\*\*[^*\n]{2,42}:\*\*)/g;

/** Mid-sentence bullet glyphs. */
const INLINE_BULLET_RE = /\s+[•·]\s+/g;

/** Backslash-escaped markdown the model produced by accident. */
const ESCAPED_MARKDOWN_RE = /\\([*_#|~`\][-])/g;

/** Option verdicts strung together: "C. Heparina …; D. Vitamina K …; B. Plasma …". */
const OPTION_MARKER_RE = /(?:^|[;.:]\s+|\s+—\s+)([A-E])[.)]\s+(?=[A-ZĂÂÎȘȚa-z])/g;

/**
 * Turns a run of per-option verdicts into a lead line plus one indented bullet
 * per option, so "3. C. … ; D. … ; B. …" reads as a real sub-list instead of a
 * sentence with letters buried in it.
 */
function splitOptionVerdicts(line: string): string | null {
  const markers = [...line.matchAll(OPTION_MARKER_RE)];
  if (markers.length < 2) return null;

  // Whatever introduces the run: a bare list marker ("3."), or a real sentence
  // like "Celelalte variante cad pentru că:".
  const rawLead = line.slice(0, markers[0].index!).trim().replace(/[;,.]$/, '');
  const bareMarker = /^(?:[-*•]|\d+)$/.test(rawLead);
  const listPrefix = bareMarker ? `${/^\d+$/.test(rawLead) ? `${rawLead}.` : rawLead} ` : '';
  const leadText = listPrefix ? '' : rawLead;
  const indent = listPrefix ? '  ' : '';

  const items: string[] = [];
  markers.forEach((marker, index) => {
    const start = marker.index! + marker[0].length;
    const end = index + 1 < markers.length ? markers[index + 1].index! : line.length;
    const body = line.slice(start, end).trim().replace(/[;,]$/, '');
    if (body) items.push(`${indent}- **${marker[1]}.** ${body}`);
  });
  if (items.length < 2) return null;

  // With no sentence of its own the run still needs a lead, or the bullets hang
  // off nothing; "Variante:" only restates the labels already there.
  const lead = leadText
    ? `${listPrefix}${leadText}${/[:：]$/.test(leadText) ? '' : ':'}`
    : `${listPrefix}Variante:`;

  return [lead, ...items].join('\n');
}

function structureLine(line: string): string {
  let out = line;

  const long = out.trim().length >= 140;

  // Numbered steps split first: an option run usually lives inside one of them,
  // so splitting the steps keeps each run attached to its own step.
  if (long) {
    const enumerated = out.replace(INLINE_ENUM_RE, '\n');
    if (enumerated !== out) {
      return enumerated
        .split('\n')
        .map((part) => splitOptionVerdicts(part) ?? part)
        .join('\n');
    }
  }

  // Option runs are unreadable at any length, so this one ignores the gate.
  const options = splitOptionVerdicts(out);
  if (options) return options;

  // A short line is already readable — splitting it only adds noise.
  if (!long) return out;

  const labelled = out.replace(INLINE_LABEL_RE, '\n\n');
  if (labelled !== out) return labelled;

  out = out.replace(INLINE_BULLET_RE, '\n- ');
  return out;
}

/**
 * Normalizes raw model text into something the markdown renderer can lay out.
 * Content inside ``` fences and markdown tables is passed through untouched.
 */
export function structureRawText(text: string): string {
  if (!text) return '';

  const lines = text.split('\n');
  const out: string[] = [];
  let inFence = false;

  for (const line of lines) {
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      out.push(line);
      continue;
    }
    if (inFence) {
      out.push(line);
      continue;
    }
    // Stray escapes are always wrong outside code; table rows keep their layout
    // but still get the escapes cleaned up.
    const unescaped = line.replace(ESCAPED_MARKDOWN_RE, '$1');
    out.push(line.includes('|') ? unescaped : structureLine(unescaped));
  }

  return out.join('\n');
}
