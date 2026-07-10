/**
 * Template-based extractor for pre-written quiz banks ("grile").
 *
 * Unlike the AI generator (which invents new questions from study material),
 * this recognizes questions that ALREADY EXIST in a document and pulls them out
 * faithfully — including which option is correct.
 *
 * The correct answer is almost always encoded in FORMATTING (bold / red) or an
 * explicit key line ("Raspuns corect: a"). Plain text extraction throws the
 * formatting away, so this engine works on structured lines that carry an
 * optional `bold`/`red` flag, letting a .docx (bold preserved via mammoth) and
 * a plain PDF/text feed the exact same logic.
 */

export interface SourceLine {
  text: string;
  bold?: boolean;
  /** Visually marked as correct — a distinct/saturated ink color or highlight. */
  marked?: boolean;
  /** PDF page this line came from (1-based). Only set by the PDF source — used
   *  to associate a question with a clinical photo on the same page. */
  page?: number;
}

/** Normalize for loose text comparison (answer-by-text, dedup): lowercase, no diacritics/punctuation. */
export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface ParsedOption {
  text: string;
  isCorrect: boolean;
}

export type AnswerSource = 'explicit' | 'format' | 'ai' | 'none';
export type Confidence = 'high' | 'medium' | 'low';

export interface ParsedQuestion {
  text: string;
  options: ParsedOption[];
  multipleCorrect: boolean;
  answerSource: AnswerSource;
  confidence: Confidence;
  warnings: string[];
  /** PDF page(s) this question's lines came from — lets the caller attach a
   *  same-page clinical photo (e.g. "Imaginea reprezintă: ..." questions). */
  pages?: number[];
  /** Attached image (data URL), filled in by the caller (grileImport.ts) when
   *  this question's page contains an embedded image. */
  imageUrl?: string;
}

export interface ParseResult {
  questions: ParsedQuestion[];
  stats: {
    total: number;
    withAnswer: number;
    highConfidence: number;
    needsReview: number;
    incomplete: number;
  };
}

// ---- line classification -------------------------------------------------

// Optional leading marker (some banks flag hard questions with "*3." or "#3.").
// Optional single-letter prefix too — image-based grile are often numbered in
// their own sequence, separate from the main bank ("P1.", "P2." for "poză").
const QUESTION_NUM_RE = /^\s*[*#]?\s*[A-Za-z]?(\d{1,3})\s*[.)]\s*(.*)$/;
const ENDS_STEM_RE = /[:?]\s*$/;
const LETTER_OPTION_RE = /^\s*([a-eA-E])\s*[.)]\s+(.*\S)\s*$/;
const DASH_OPTION_RE = /^\s*[-–—•·▪]\s*(.*\S)\s*$/;
const TYPE_MULTIPLE_RE = /complement\s+multiplu|[([]\s*cm\s*[)\]]/i;
const TYPE_SINGLE_RE = /complement\s+simplu|[([]\s*cs\s*[)\]]/i;
// Type tag glued onto the END of the stem itself (not its own line): "...: [CM]" / "...(CS)".
const TRAILING_TYPE_RE = /\s*[([]\s*(?:complement\s+multiplu|complement\s+simplu|cm|cs)\s*[)\]]\s*$/i;
// Some banks mark the correct option with an explicit "DA - " ("YES -") text
// prefix instead of (or in addition to) color/bold — e.g. "DA - a) Placard
// edematos". The prefix sits BEFORE the letter, so it also broke plain letter
// detection (a)/b)/… had to be at the start of the line), which silently
// swallowed that whole option into the previous line/stem. Stripped in a
// preprocessing pass below, same as mergeLoneOptionLabels.
const YES_PREFIX_RE = /^\s*(?:DA|YES|CORECT)\s*[-:–—]\s*(.+)$/i;
// "Raspuns corect: a" / "Răspuns: a, c, d" / "R: b" / "Answer: c"
const EXPLICIT_ANSWER_RE =
  /^\s*(?:r[aă]spuns(?:\s*corect)?|r|answer|corect)\s*[:=]\s*([a-eA-E](?:\s*[,;șiȘI/\s]+[a-eA-E])*)\s*\.?\s*$/i;
// Moodle-style key that names the answer TEXT: "The correct answer is: Verruca"
const ANSWER_TEXT_RE =
  /^\s*(?:the\s+)?(?:correct\s+answers?\s+(?:is|are)|r[aă]spuns(?:ul)?\s+corect\s+este)\s*:?\s*(.+\S)\s*$/i;
// Noise lines to ignore (Moodle exports, feedback).
const SKIP_LINE_RE =
  /^\s*(?:select\s+one(?:\s+or\s+more)?|your\s+answer\s+is\s+(?:correct|incorrect)|question\s+\d+|marks?\s*:|mark\s+\d|flag\s+question|not\s+flagged)\b/i;

function letterToIndex(letter: string): number {
  return letter.trim().toLowerCase().charCodeAt(0) - 97; // a->0
}

function parseAnswerLetters(raw: string): number[] {
  const letters = raw.match(/[a-eA-E]/g) ?? [];
  const idx = letters.map((l) => letterToIndex(l));
  return [...new Set(idx)].filter((i) => i >= 0 && i < 26);
}

// ---- block model ---------------------------------------------------------

interface Block {
  questionLines: SourceLine[];
  optionLines: SourceLine[];
  explicitAnswer?: number[]; // option indices from a "Raspuns corect: a" line
  explicitAnswerText?: string; // answer named by text: "The correct answer is: X"
  typeIsMultiple?: boolean; // from a "Complement multiplu" marker
}

/**
 * Group raw lines into per-question blocks. A block starts at a numbered line
 * (`3.` / `3)`) or, when the document has no numbering (typical .docx export),
 * at a bold line ending in ":".
 */
function segmentBlocks(lines: SourceLine[]): Block[] {
  const cleaned = lines
    .map((l) => ({ ...l, text: l.text.replace(/ /g, ' ').trim() }))
    .filter((l) => l.text.length > 0);

  const hasNumbering = cleaned.some((l) => QUESTION_NUM_RE.test(l.text));

  // Strips a type tag glued onto the end of the stem ("...: [CM]") and reports
  // whether it means multi-answer, so a document that never puts CS/CM on its
  // own line still gets a clean stem and a confident multipleCorrect flag.
  const stripTrailingType = (stem: string): { stem: string; typeIsMultiple?: boolean } => {
    const m = stem.match(TRAILING_TYPE_RE);
    if (!m || m.index === undefined) return { stem };
    const tag = m[0];
    return { stem: stem.slice(0, m.index).trimEnd(), typeIsMultiple: TYPE_MULTIPLE_RE.test(tag) };
  };

  const isQuestionStart = (l: SourceLine): { start: boolean; text?: string; typeIsMultiple?: boolean } => {
    const m = l.text.match(QUESTION_NUM_RE);
    if (m) {
      const { stem, typeIsMultiple } = stripTrailingType(m[2]);
      return { start: true, text: stem, typeIsMultiple };
    }
    // Fallback for un-numbered docx: a bold line that reads like a stem.
    if (!hasNumbering && l.bold && /[:?]\s*$/.test(l.text) && l.text.length > 12) {
      return { start: true, text: l.text };
    }
    return { start: false };
  };

  const blocks: Block[] = [];
  let current: Block | null = null;
  // Once the stem is closed (first option seen, or stem ended with ":"), bare
  // lines are options — this is what makes bold-marked docx lists work.
  let optionsOpen = false;

  for (const line of cleaned) {
    const q = isQuestionStart(line);
    if (q.start) {
      const stem = q.text ?? line.text;
      current = { questionLines: [{ ...line, text: stem }], optionLines: [], typeIsMultiple: q.typeIsMultiple };
      blocks.push(current);
      optionsOpen = ENDS_STEM_RE.test(stem);
      continue;
    }
    if (!current) continue; // preamble/junk before the first question

    // Moodle / exam-export noise ("Select one:", "Your answer is correct", …).
    if (SKIP_LINE_RE.test(line.text)) continue;

    // Explicit answer key line (by letter).
    const ans = line.text.match(EXPLICIT_ANSWER_RE);
    if (ans) {
      current.explicitAnswer = parseAnswerLetters(ans[1]);
      continue;
    }
    // Explicit answer key by TEXT ("The correct answer is: Verruca").
    const ansText = line.text.match(ANSWER_TEXT_RE);
    if (ansText) {
      current.explicitAnswerText = ansText[1];
      continue;
    }
    // Type marker (CS/CM) on its own line.
    if (TYPE_MULTIPLE_RE.test(line.text)) {
      current.typeIsMultiple = true;
      continue;
    }
    if (TYPE_SINGLE_RE.test(line.text)) {
      current.typeIsMultiple = current.typeIsMultiple ?? false;
      continue;
    }

    if (LETTER_OPTION_RE.test(line.text) || DASH_OPTION_RE.test(line.text)) {
      current.optionLines.push(line);
      optionsOpen = true;
    } else if (optionsOpen) {
      // Bare line after options opened — a wrapped or unprefixed (docx) option.
      current.optionLines.push(line);
    } else if (ENDS_STEM_RE.test(line.text)) {
      // Stem line ending in ":" / "?": finish the stem and open options.
      current.questionLines.push(line);
      optionsOpen = true;
    } else {
      // Still accumulating a multi-line question stem.
      current.questionLines.push(line);
    }
  }

  return blocks;
}

// ---- option + answer extraction -----------------------------------------

function extractOptions(block: Block): { text: string; bold: boolean; marked: boolean }[] {
  return block.optionLines.map((l) => {
    const letter = l.text.match(LETTER_OPTION_RE);
    if (letter) return { text: letter[2].trim(), bold: !!l.bold, marked: !!l.marked };
    const dash = l.text.match(DASH_OPTION_RE);
    if (dash) return { text: dash[1].trim(), bold: !!l.bold, marked: !!l.marked };
    return { text: l.text.trim(), bold: !!l.bold, marked: !!l.marked };
  });
}

function buildQuestion(block: Block): ParsedQuestion | null {
  const stem = block.questionLines
    .map((l) => l.text)
    .join(' ')
    .replace(/\s+/g, ' ')
    .replace(/^\*+\s*/, '') // some banks prefix hard questions with "*"
    .trim();

  const rawOptions = extractOptions(block);
  const warnings: string[] = [];
  const pages = [...new Set(
    [...block.questionLines, ...block.optionLines]
      .map((l) => l.page)
      .filter((p): p is number => typeof p === 'number'),
  )];

  if (!stem || stem.length < 6) return null;
  if (rawOptions.length < 2) {
    // A stem with 0–1 options isn't a usable multiple-choice item.
    return {
      text: stem,
      options: rawOptions.map((o) => ({ text: o.text, isCorrect: false })),
      multipleCorrect: false,
      answerSource: 'none',
      confidence: 'low',
      warnings: ['Prea puține variante (nu e grilă completă).'],
      pages: pages.length ? pages : undefined,
    };
  }

  const correct = new Set<number>();
  let answerSource: AnswerSource = 'none';

  if (block.explicitAnswer && block.explicitAnswer.length > 0) {
    block.explicitAnswer.forEach((i) => {
      if (i < rawOptions.length) correct.add(i);
    });
    if (correct.size > 0) answerSource = 'explicit';
  }

  // Answer named by text (Moodle): match it against an option.
  if (answerSource === 'none' && block.explicitAnswerText) {
    const target = normalizeText(block.explicitAnswerText);
    let best = -1;
    let bestScore = 0;
    rawOptions.forEach((o, i) => {
      const opt = normalizeText(o.text);
      if (!opt) return;
      const score = opt === target ? 1 : opt.includes(target) || target.includes(opt) ? 0.8 : 0;
      if (score > bestScore) {
        bestScore = score;
        best = i;
      }
    });
    if (best >= 0 && bestScore >= 0.8) {
      correct.add(best);
      answerSource = 'explicit';
    }
  }

  if (answerSource === 'none') {
    rawOptions.forEach((o, i) => {
      if (o.bold || o.marked) correct.add(i);
    });
    if (correct.size > 0) answerSource = 'format';
  }

  if (answerSource === 'none') {
    warnings.push('Răspuns nemarcat — de verificat.');
  }

  const multipleCorrect = block.typeIsMultiple ?? correct.size > 1;

  const confidence: Confidence =
    answerSource === 'explicit'
      ? 'high'
      : answerSource === 'format'
        ? 'high'
        : 'low';

  return {
    text: stem,
    options: rawOptions.map((o, i) => ({ text: o.text, isCorrect: correct.has(i) })),
    multipleCorrect,
    answerSource,
    confidence,
    warnings,
    pages: pages.length ? pages : undefined,
  };
}

// A line that's JUST a letter marker ("A." / "b)") with nothing else. Some PDF
// exporters emit the option label and its text as two separate text runs that
// our line-grouping (keyed on Y-position) can't always tell apart from two real
// lines — without this, "A." and "Carcinom anaplazic tiroidian" become two
// separate bogus options instead of one real one.
const LONE_LABEL_RE = /^\s*([a-eA-E])\s*[.)]\s*$/;

/** Merge a standalone "A." label into the very next line's text: one option, not two. */
function mergeLoneOptionLabels(lines: SourceLine[]): SourceLine[] {
  const out: SourceLine[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const next = lines[i + 1];
    if (LONE_LABEL_RE.test(line.text) && next && next.text.trim() && !LONE_LABEL_RE.test(next.text)) {
      out.push({
        text: `${line.text.trim()} ${next.text.trim()}`,
        bold: line.bold || next.bold,
        marked: line.marked || next.marked,
      });
      i += 1; // consumed next line too
    } else {
      out.push(line);
    }
  }
  return out;
}

/**
 * Strip a leading "DA - " ("YES -") text marker and treat it as a correctness
 * signal, same as bold/color. It sits BEFORE the option letter (e.g. "DA - a)
 * Placard edematos"), which also broke plain letter detection — a)/b)/… had to
 * be at the very start of the line — silently swallowing that whole option
 * into the previous line/stem instead of recognizing it.
 */
function stripYesPrefix(lines: SourceLine[]): SourceLine[] {
  return lines.map((l) => {
    const m = l.text.match(YES_PREFIX_RE);
    if (!m) return l;
    return { ...l, text: m[1].trim(), marked: true };
  });
}

/** Parse a whole document (as formatting-aware lines) into structured questions. */
export function parseGrile(rawLines: SourceLine[]): ParseResult {
  const lines = mergeLoneOptionLabels(stripYesPrefix(rawLines));
  const blocks = segmentBlocks(lines);
  const questions: ParsedQuestion[] = [];

  for (const block of blocks) {
    const q = buildQuestion(block);
    if (q) questions.push(q);
  }

  const withAnswer = questions.filter((q) => q.answerSource !== 'none').length;
  const highConfidence = questions.filter((q) => q.confidence === 'high').length;
  const incomplete = questions.filter((q) => q.options.length < 2).length;

  return {
    questions,
    stats: {
      total: questions.length,
      withAnswer,
      highConfidence,
      needsReview: questions.length - highConfidence,
      incomplete,
    },
  };
}
