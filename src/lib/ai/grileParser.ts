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
  /** Nearest preceding ALL-CAPS section header (e.g. "CARDIOLOGIE"), if the bank
   *  organizes itself by specialty — best-effort, used to split import into
   *  multiple quizzes instead of one flat dump. */
  specialty?: string;
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
// Separator after the number also covers a bare dash ("3 -") and closing bracket ("3]").
const QUESTION_NUM_RE = /^\s*[*#]?\s*[A-Za-z]?(\d{1,3})\s*(?:[.)\]]|[-–—](?!\d))\s*(.*)$/;
// "Întrebarea 12:" / "Intrebarea 12." / "Question 12:" / "Q12." / "ÎNTREBARE 12" — a labeled
// numbering scheme some exam-generator PDFs use instead of a bare "12.".
const LABELED_QUESTION_NUM_RE =
  /^\s*(?:[îi]ntrebarea?|question|q)\s*[.:]?\s*(\d{1,3})\s*[.):]?\s*(.*)$/i;
const ENDS_STEM_RE = /[:?]\s*$/;
// Letter separator covers ".", ")", a dash, or a bare colon, plus letters wrapped
// in parens ("(a)") — banks are inconsistent about which one they export with.
const LETTER_OPTION_RE = /^\s*\(?([a-eA-E])\)?\s*[.):\-–—]\s*(.*\S)\s*$/;
const DASH_OPTION_RE = /^\s*[-–—•·▪▫◦‣⁃]\s*(.*\S)\s*$/;
const TYPE_MULTIPLE_RE =
  /complement\s+multiplu|alegere\s+multipl[aă]|r[aă]spunsuri?\s+multiple|multiple\s+(?:answer|choice|response)s?|select\s+all\s+that\s+appl(?:y|ies)|select\s+one\s+or\s+more|[([]\s*cm\s*[)\]]/i;
const TYPE_SINGLE_RE =
  /complement\s+simplu|alegere\s+simpl[aă]|r[aă]spuns\s+unic|single\s+(?:answer|choice|response)|select\s+one(?!\s+or\s+more)|[([]\s*cs\s*[)\]]/i;
// A whole line that's JUST the type marker without brackets, e.g. "CM — 4
// răspunsuri corecte" / "CS — răspuns unic" (some banks print this as its own
// caption line right under the stem instead of "(CM)"/"[CS]").
const TYPE_LINE_RE = /^\s*(cm|cs)\s*[-–—:]\s*(?:\d+\s*)?r[aă]spuns(?:uri)?(?:\s+corecte?|\s+unic[aă]?)?\s*$/i;
// Type tag glued onto the END of the stem itself (not its own line): "...: [CM]" / "...(CS)".
const TRAILING_TYPE_RE = /\s*[([]\s*(?:complement\s+multiplu|complement\s+simplu|cm|cs)\s*[)\]]\s*$/i;
// A checkmark glyph some PDF exporters place right before the correct option's
// letter (e.g. "✓ a) Placard edematos") instead of / in addition to color or
// bold. It sits BEFORE the letter, so — same problem as YES_PREFIX_RE below —
// it stops LETTER_OPTION_RE from matching (needs the letter at line start),
// and the whole line (checkmark + letter + text) falls through as raw option
// text instead of being recognized as option "a" and marked correct.
const CHECK_PREFIX_RE = /^\s*[✓✔√☑]\s*/;
// Some banks mark the correct option with an explicit "DA - " ("YES -") text
// prefix instead of (or in addition to) color/bold — e.g. "DA - a) Placard
// edematos". The prefix sits BEFORE the letter, so it also broke plain letter
// detection (a)/b)/… had to be at the start of the line), which silently
// swallowed that whole option into the previous line/stem. Stripped in a
// preprocessing pass below, same as mergeLoneOptionLabels.
const YES_PREFIX_RE = /^\s*(?:DA|YES|CORECT|TRUE|ADEV[AĂ]RAT)\s*[-:–—]\s*(.+)$/i;
// "Din curs: ..." / "Nota: ..." explanation box some banks print right after
// each question (source-material justification or a reviewer's note, not
// part of the grilă). It can wrap across several lines with no marker on the
// continuation lines, so it's handled as a skip-until-next-question state in
// segmentBlocks rather than a regex here.
const EXPLANATION_START_RE = /^\s*(?:din\s+curs|nota)\s*:/i;
// "Raspuns corect: a" / "Răspuns: a, c, d" / "R: b" / "Answer: c" / "Cheie: a"
// / "Soluție: b" / "Varianta corectă: a" / "Key: c" — AND, since real grile banks
// (e.g. the residency question banks) print this with a space instead of a colon
// ("Raspuns corect E"), the colon/equals is optional for the long, unambiguous
// phrases below. It stays MANDATORY for the short/ambiguous single-word markers
// (bare "r"/"key"/"corect"/"cheie") so a colon-less stray word doesn't false-match.
const EXPLICIT_ANSWER_RE =
  /^\s*(?:r[aă]spuns(?:ul)?(?:\s*corecte?)?|varianta?\s*corect[aă])\s*[:=]?\s*([a-eA-E](?:\s*[,;șiȘI/\s]+[a-eA-E])*)\s*\.?\s*$/i;
const EXPLICIT_ANSWER_STRICT_RE =
  /^\s*(?:r|answer|corecte?|chei[ae]?|solu[țt]i[ae]|key)\s*[:=]\s*([a-eA-E](?:\s*[,;șiȘI/\s]+[a-eA-E])*)\s*\.?\s*$/i;
// Moodle-style key that names the answer TEXT: "The correct answer is: Verruca"
const ANSWER_TEXT_RE =
  /^\s*(?:the\s+)?(?:correct\s+answers?\s+(?:is|are)|r[aă]spuns(?:ul)?\s+corect\s+este)\s*:?\s*(.+\S)\s*$/i;
// Noise lines to ignore (Moodle exports, feedback). "Select one(/or more)" is
// handled by TYPE_SINGLE_RE/TYPE_MULTIPLE_RE instead, since it also tells us
// whether the question allows multiple correct answers. "nemarcat"/"răspuns
// liber" are informational captions ("unmarked in source" / "free-response
// answer") some banks print instead of lettered options — without this they'd
// be swallowed as a bogus extra option.
const SKIP_LINE_RE =
  /^\s*(?:your\s+answer\s+is\s+(?:correct|incorrect)|question\s+\d+|marks?\s*:|mark\s+\d|flag\s+question|not\s+flagged|answer\s+saved|points?\s+out\s+of|time\s+left|question\s+text|grade\s*:|nemarcat\b|r[aă]spuns\s+liber\b)/i;

// A short ALL-CAPS line with no digits — a section/specialty header some banks print
// inline in the body ("CARDIOLOGIE", "PULMONAR") rather than only in a separate TOC.
// Excludes anything that already looks like a question start so numbering schemes
// with capitalized stems don't get misread as headers.
const SPECIALTY_HEADING_RE = /^[A-ZĂÂÎȘȚ][A-ZĂÂÎȘȚ \-]{2,39}$/;

function isSpecialtyHeading(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 40) return false;
  if (QUESTION_NUM_RE.test(trimmed) || LABELED_QUESTION_NUM_RE.test(trimmed)) return false;
  return SPECIALTY_HEADING_RE.test(trimmed);
}

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
  specialty?: string; // nearest preceding section header, if any
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

  const hasNumbering = cleaned.some((l) => QUESTION_NUM_RE.test(l.text) || LABELED_QUESTION_NUM_RE.test(l.text));

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
    // Labeled numbering some exam-generator PDFs use: "Întrebarea 12:" / "Question 12."
    const lm = l.text.match(LABELED_QUESTION_NUM_RE);
    if (lm) {
      const { stem, typeIsMultiple } = stripTrailingType(lm[2]);
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
  // Set while consuming a "Din curs: ..." explanation box, which can wrap
  // across several unmarked lines — everything is skipped until the next
  // question starts (isQuestionStart resets this below).
  let inExplanation = false;
  // Nearest preceding specialty/section header ("CARDIOLOGIE"), carried into
  // every block created until the next header line updates it.
  let currentSpecialty: string | undefined;

  for (const line of cleaned) {
    if (isSpecialtyHeading(line.text)) {
      currentSpecialty = line.text.trim();
      continue;
    }
    const q = isQuestionStart(line);
    if (q.start) {
      const stem = q.text ?? line.text;
      current = { questionLines: [{ ...line, text: stem }], optionLines: [], typeIsMultiple: q.typeIsMultiple, specialty: currentSpecialty };
      blocks.push(current);
      optionsOpen = ENDS_STEM_RE.test(stem);
      inExplanation = false;
      continue;
    }
    if (!current) continue; // preamble/junk before the first question

    if (inExplanation) continue;
    if (EXPLANATION_START_RE.test(line.text)) {
      inExplanation = true;
      continue;
    }

    // Moodle / exam-export noise ("Select one:", "Your answer is correct", …).
    if (SKIP_LINE_RE.test(line.text)) continue;

    // Explicit answer key line (by letter).
    const ans = line.text.match(EXPLICIT_ANSWER_RE) ?? line.text.match(EXPLICIT_ANSWER_STRICT_RE);
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
    // Type marker (CS/CM), on its own line either bare ("CM — 4 răspunsuri
    // corecte") or as a phrase ("Complement multiplu").
    const typeLine = line.text.match(TYPE_LINE_RE);
    if (typeLine) {
      current.typeIsMultiple = typeLine[1].toLowerCase() === 'cm';
      continue;
    }
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
      specialty: block.specialty,
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
    specialty: block.specialty,
  };
}

// A line that's JUST a letter marker ("A." / "b)") with nothing else. Some PDF
// exporters emit the option label and its text as two separate text runs that
// our line-grouping (keyed on Y-position) can't always tell apart from two real
// lines — without this, "A." and "Carcinom anaplazic tiroidian" become two
// separate bogus options instead of one real one.
const LONE_LABEL_RE = /^\s*\(?([a-eA-E])\)?\s*[.):\-–—]?\s*$/;

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

/**
 * Strip a leading checkmark glyph ("✓ a) Placard edematos") and treat it as a
 * correctness signal, same as bold/color/the "DA -" prefix above. Runs first
 * (before stripYesPrefix/mergeLoneOptionLabels) so the remaining "a) text"
 * can still be recognized by those passes and by LETTER_OPTION_RE.
 */
function stripCheckPrefix(lines: SourceLine[]): SourceLine[] {
  return lines.map((l) => {
    if (!CHECK_PREFIX_RE.test(l.text)) return l;
    return { ...l, text: l.text.replace(CHECK_PREFIX_RE, ''), marked: true };
  });
}

/** Parse a whole document (as formatting-aware lines) into structured questions. */
export function parseGrile(rawLines: SourceLine[]): ParseResult {
  const lines = mergeLoneOptionLabels(stripYesPrefix(stripCheckPrefix(rawLines)));
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
