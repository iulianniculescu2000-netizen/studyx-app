/**
 * Conversational agent for StudyX.
 *
 * Turns a natural-language command ("creează folderul Dermato și fă-mi 50 de grile
 * din cursul de micoze acolo") into a validated plan of concrete actions, then
 * executes them against the app stores — creating folders, generating quiz packs,
 * organizing the library, etc. The LLM only *plans*; execution is deterministic
 * local code, so there is no risk of the model "hallucinating" a destructive op.
 */
import { groqRequest, notesToFlashcards } from '../groq';
import { generateQuizPackagesFromSource } from './batchQuizGeneration';
import { clampStudioPackCount, clampStudioQuestionCount } from './studioGeneration';
import { DEFAULT_EXAM_STYLE, EXAM_STYLE_META, detectExamStyle, examStyleTags, type ExamStyle } from './examStyle';
import { getVaultChunksBySource } from '../../ai/vectorStore';
import { generateQuestions, generateQuestionsFromTopic, getUserProfile } from '../../ai/AIEngine';
import { generateFromMistakes, getWeakTopicsForProfile } from '../../ai/UserProfile';
import { useQuizStore } from '../../store/quizStore';
import { useFolderStore } from '../../store/folderStore';
import { useAIStore } from '../../store/aiStore';
import { useUserStore } from '../../store/userStore';
import { useQuizChatContextStore } from '../../store/quizChatContextStore';
import { suggestFolderAppearance } from '../folderAppearance';
import { extractJsonFromText } from '../quizImport';
import type { Difficulty, Folder, Question, Quiz } from '../../types';

function shortId() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
}

/** Reconstruct a source document's text from its indexed vault chunks (capped). */
async function loadSourceText(sourceId: string, maxChars = 24000): Promise<string> {
  const chunks = await getVaultChunksBySource(sourceId);
  if (chunks.length === 0) return '';
  let out = '';
  for (const chunk of chunks) {
    if (out.length + chunk.text.length > maxChars) {
      out += chunk.text.slice(0, Math.max(0, maxChars - out.length));
      break;
    }
    out += (out ? '\n\n' : '') + chunk.text;
  }
  return out;
}

function buildAgentFlashcard(front: string, back: string): Question {
  return {
    id: shortId(),
    text: front.trim(),
    multipleCorrect: false,
    difficulty: 'medium',
    explanation: '',
    options: [{ id: 'a', text: back.trim(), isCorrect: true }],
  };
}

/**
 * Flashcards straight from the model's medical knowledge, for subjects with no
 * matching course in the library. Mirrors `notesToFlashcards`, minus the source
 * text: same card shape, same dedupe-by-front, same top-up when the model
 * returns fewer cards than asked.
 */
async function generateTopicFlashcards(
  topic: string,
  count: number,
): Promise<Array<{ front: string; back: string }>> {
  const target = Math.max(1, Math.min(100, Math.round(count)));

  const request = async (needed: number, avoid: string[]) => {
    const raw = await groqRequest({
      task: 'analysis',
      messages: [
        {
          role: 'system',
          content: [
            'Ești profesor de medicină și creezi flashcarduri de memorare activă pentru studenți români.',
            'Fața cardului este o întrebare scurtă și precisă; spatele este răspunsul complet, dar concis (maximum 2 propoziții).',
            'Acoperă definiții, mecanisme, criterii, diferențiale, indicații, complicații și capcane de examen — nu repeta același concept.',
            'Nu inventa doze, scoruri sau valori pe care nu le știi sigur.',
            'Răspunde STRICT cu JSON valid, fără markdown și fără text în plus:',
            '{"cards":[{"front":"întrebare","back":"răspuns"}]}',
          ].join('\n'),
        },
        {
          role: 'user',
          content: [
            `Creează exact ${needed} flashcarduri despre: ${topic}.`,
            'Scrie exclusiv în limba română.',
            avoid.length > 0
              ? `Evită aceste fețe deja folosite:\n${avoid.slice(-40).map((front) => `- ${front}`).join('\n')}`
              : '',
          ].filter(Boolean).join('\n\n'),
        },
      ],
      temperature: 0.4,
      maxTokens: 4000,
      skipLibraryContext: true,
    });

    const parsed = extractJsonFromText(raw) as { cards?: Array<{ front?: unknown; back?: unknown }> } | null;
    return Array.isArray(parsed?.cards) ? parsed.cards : [];
  };

  const cards: Array<{ front: string; back: string }> = [];
  const seen = new Set<string>();

  const collect = (batch: Array<{ front?: unknown; back?: unknown }>) => {
    for (const entry of batch) {
      const front = typeof entry?.front === 'string' ? entry.front.trim() : '';
      const back = typeof entry?.back === 'string' ? entry.back.trim() : '';
      if (front.length < 3 || back.length < 2) continue;
      const key = normalizeName(front);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      cards.push({ front, back });
      if (cards.length >= target) return;
    }
  };

  collect(await request(target, []));

  // One top-up round: models routinely return 20 cards when asked for 30.
  if (cards.length < target) {
    collect(await request(target - cards.length, cards.map((card) => card.front)));
  }

  return cards.slice(0, target);
}

export type AgentActionType =
  | 'create_folder'
  | 'create_library_folder'
  | 'generate_quiz_pack'
  | 'generate_quiz_topic'
  | 'generate_from_mistakes'
  | 'correct_answer'
  | 'create_flashcards'
  | 'create_flashcards_topic'
  | 'summarize_document'
  | 'create_study_plan'
  | 'move_quiz'
  | 'rename_quiz'
  | 'delete_quiz'
  | 'rename_folder'
  | 'delete_folder';

export interface AgentStep {
  action: AgentActionType;
  name?: string;
  newName?: string;
  parent?: string;
  source?: string;
  /** For generate_quiz_topic: freeform subject when no library course matches (e.g. "fiziologia plămânului"). */
  topic?: string;
  folder?: string;
  quiz?: string;
  packCount?: number;
  questionsPerPack?: number;
  /** For create_flashcards: number of cards to generate. */
  count?: number;
  /** For generate_quiz_pack: single-answer (complement simplu) vs multi-answer. */
  questionType?: 'single' | 'multiple';
  /** Which track: rezidențiat (5 variante A-E) or a plain subject quiz (4, A-D). */
  examStyle?: ExamStyle;
  difficulty?: 'auto' | 'easy' | 'medium' | 'hard';
  /** For create_study_plan: exam name, number of study days, hours per day. */
  examName?: string;
  studyDays?: number;
  hoursPerDay?: number;
  /** For correct_answer: exact quiz/question identity (never guessed from text). */
  quizId?: string;
  questionId?: string;
  correctOptionIds?: string[];
  /** Human-readable letter(s) for correctOptionIds ("varianta C"), resolved once at plan time — so the confirm card can show exactly what will change instead of a vague "updating the answer". */
  correctLabel?: string;
  reasoning?: string;
  groundedIn?: 'course' | 'general' | 'user_claim';
}

export interface AgentPlan {
  isCommand: boolean;
  reply: string;
  steps: AgentStep[];
  needsConfirm: boolean;
  confirmReason?: string;
  /**
   * True when the message clearly wanted an action but the planner is missing
   * something it needs to build valid steps (which course, which folder, how
   * many). `reply` then holds the actual question to ask back — callers must
   * show it and keep routing the user's next message through the agent
   * instead of silently falling through to normal chat, or the clarifying
   * question becomes a dead end.
   */
  needsClarification?: boolean;
}

export interface AgentContext {
  defaultPackCount: number;
  defaultQuestionsPerPack: number;
}

export interface AgentRunResult {
  summary: string;
  createdQuizIds: string[];
  errors: string[];
  undo: (() => void) | null;
}

const QUESTION_CONFIRM_THRESHOLD = 80;
// Freeform-topic generation (no matched library course — the model's own
// medical knowledge, not grounded in the user's material) is the case most
// likely to run on a misheard/misread subject. A large batch there is already
// near the per-request maximum, so it never trips the blanket 80-question
// threshold above — this catches it separately, before tokens are spent on
// possibly the wrong topic.
const TOPIC_CONFIRM_THRESHOLD = 30;
const DESTRUCTIVE_ACTIONS: AgentActionType[] = ['delete_quiz', 'delete_folder'];

/**
 * Deterministic extraction of quiz counts + question type straight from the
 * user's wording. The LLM planner is unreliable at counting ("3 grile" became
 * "3×10"), so we override its numbers whenever the phrasing is unambiguous.
 *
 * Rules:
 *  - "N grile/întrebări" with NO pack word  → questionsPerPack=N, packCount=1
 *  - "N seturi/pachete"                     → packCount=N
 *  - "N seturi a câte M (grile)"            → packCount=N, questionsPerPack=M
 *  - numbers attached to a name ("Cursul 1") are ignored (not before a keyword)
 */
export interface QuizIntentOverride {
  packCount?: number;
  questionsPerPack?: number;
  questionType?: 'single' | 'multiple';
}

export function extractQuizIntent(command: string): QuizIntentOverride {
  const norm = command
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();

  const result: QuizIntentOverride = {};

  const questionWord = '(?:grile|grila|intrebari|intrebare|quiz)';
  const packWord = '(?:seturi|set|pachete|pachet|batch)';

  const packMatch = norm.match(new RegExp(`(\\d+)\\s+(?:de\\s+)?${packWord}`));
  const perPackMatch = norm.match(/a\s+c(?:a|i)?te\s+(\d+)/);
  const questionMatch = norm.match(new RegExp(`(\\d+)\\s+(?:de\\s+)?${questionWord}`));

  const packCount = packMatch ? Number(packMatch[1]) : null;
  const perPack = perPackMatch ? Number(perPackMatch[1]) : null;
  const questionCount = questionMatch ? Number(questionMatch[1]) : null;

  if (packCount && perPack) {
    result.packCount = packCount;
    result.questionsPerPack = perPack;
  } else if (packCount && questionCount) {
    result.packCount = packCount;
    result.questionsPerPack = questionCount;
  } else if (packCount) {
    result.packCount = packCount;
  } else if (questionCount) {
    // "N grile" with no pack word → exactly N questions in a single set.
    result.packCount = 1;
    result.questionsPerPack = questionCount;
  } else if (perPack) {
    result.questionsPerPack = perPack;
  }

  if (/complement\s+multipl|raspuns(?:uri)?\s+multipl|mai multe raspunsuri (?:corecte)?|multiple? (?:corecte|raspunsuri)/.test(norm)) {
    result.questionType = 'multiple';
  } else if (/complement\s+simpl|un singur raspuns|raspuns unic/.test(norm)) {
    result.questionType = 'single';
  }

  return result;
}

function normalizeName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function tokenize(text: string): string[] {
  return text.split(' ').filter((t) => t.length > 1);
}

function findByName<T extends { name: string }>(items: T[], query: string | undefined): T | null {
  if (!query) return null;
  const target = normalizeName(query);
  if (!target) return null;
  const targetTokens = tokenize(target);
  let best: T | null = null;
  let bestScore = 0;
  for (const item of items) {
    const candidate = normalizeName(item.name);
    if (!candidate) continue;
    let score = 0;
    if (candidate === target) {
      score = 1000;
    } else if (candidate.includes(target) || target.includes(candidate)) {
      score = 200 + Math.min(candidate.length, target.length);
    } else {
      // Token-level overlap: exact token matches + partial (one contains the other)
      const candidateTokens = tokenize(candidate);
      const exactMatches = targetTokens.filter((t) => candidateTokens.includes(t)).length;
      const partialMatches = targetTokens.filter((t) =>
        candidateTokens.some((c) => c.includes(t) || t.includes(c)),
      ).length;
      const union = new Set([...targetTokens, ...candidateTokens]).size;
      score = exactMatches * 40 + partialMatches * 10 - (union - exactMatches) * 2;
    }
    if (score > bestScore) { best = item; bestScore = score; }
  }
  return bestScore > 0 ? best : null;
}

/** Romanian inflection: everything here may be followed by a normal word ending. */
const ENDING = '[a-zăâîșț]*';

/**
 * Stems that mark a message as an instruction rather than a question.
 *
 * These used to sit inside `\b(...)\b`, and that closing boundary demanded the
 * stem be the ENTIRE word — which Romanian almost never obliges. "șterg"
 * matched but "șterge" did not, "folder" matched but "folderul" did not, so
 * "șterge folderul Cardiologie" was answered as chit-chat.
 *
 * Short or ambiguous stems stay anchored on purpose: a loose "fa" would swallow
 * "familie" and "facultate", and "card" would swallow "cardiologie".
 */
const COMMAND_PATTERNS = [
  // Actions
  `cre[ea]z${ENDING}`, `creaz${ENDING}`, `adaug${ENDING}`, `gener${ENDING}`,
  `[sș]terg${ENDING}`, `mut[aă]${ENDING}`, `redenum${ENDING}`, `organiz${ENDING}`,
  `import${ENDING}`, `pune${ENDING}`, `bag[aă]\\b`,
  // Imperative "fă" / "fă-mi", kept tight so ordinary "fa..." words don't match.
  'f[aă]\\s*-?\\s*mi\\b', 'f[aă]\\b', 'face\\b',
  // Things the actions operate on
  `fol?der${ENDING}`, `subfolder${ENDING}`, `gril[aăe]${ENDING}`,
  'set(ul|uri|urile)?\\b', `pachet${ENDING}`, `atlas${ENDING}`, `bibliotec${ENDING}`,
  `gre[șs]el${ENDING}`, 'gre[șs]esc', `recapitul${ENDING}`,
  // Flashcards, including the "flascard" typo users type constantly. "card" on
  // its own stays out — it would swallow "cardiologie".
  `flash\\s?card${ENDING}`, `flascard${ENDING}`, `deck${ENDING}`, 'fi[sș]e\\b',
];

const COMMAND_HINTS = new RegExp(`\\b(?:${COMMAND_PATTERNS.join('|')})`, 'i');

/** Cheap pre-filter so normal chat questions never pay for a planning round-trip. */
export function looksLikeAgentCommand(text: string): boolean {
  const value = text.trim();
  if (value.length < 4) return false;
  if (value.endsWith('?') && !COMMAND_HINTS.test(value)) return false;
  return COMMAND_HINTS.test(value);
}

/**
 * Short "do it again" follow-ups ("mai încearcă", "încă o dată", "reia").
 * These carry no course/count of their own, so when the previous command failed
 * the caller must RE-RUN the last real command instead of planning from these
 * words — otherwise the model invents a brand-new (wrong) request.
 */
export function isRetryPhrase(text: string): boolean {
  const norm = text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/[.!?]+$/, '');
  if (!norm || norm.length > 48) return false;
  const RETRY_PATTERNS = [
    /\bmai incearca\b/, /\bincearca din nou\b/, /\bincearca iar\b/, /\breincearca\b/,
    /\binca o data\b/, /\binca odata\b/, /\bmai fa o data\b/, /\bfa din nou\b/,
    /\bmai fa\b/, /\breia\b/, /\brepeta\b/, /\bmai incearca o data\b/,
    /^din nou\b/, /^iar(asi)?\b/, /\btry again\b/, /\bretry\b/,
  ];
  return RETRY_PATTERNS.some((pattern) => pattern.test(norm));
}

// ── In-quiz answer disputes ────────────────────────────────────────────────
// "Cred că e corect și varianta C" — the student disagrees with the marked
// answer while looking at a question (QuizPlay → useQuizChatContextStore).
// This is deliberately SEPARATE from the folder/generation planner above: it
// needs the EXACT quiz/question identity from app state, not something an LLM
// should infer from chat text, and it must never silently guess — general
// medical knowledge is only used when the student explicitly allows it.

function normalizeForMatch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/** Does this message read as "I think the marked answer is wrong / X is also correct"? */
export function looksLikeAnswerDispute(text: string): boolean {
  const norm = normalizeForMatch(text);
  const DISPUTE_PATTERNS = [
    /\bcred c[ăa]\b[\s\S]{0,40}\b(corect|gre[șs]it|varianta|r[ăa]spuns)/,
    /\bnu (e|este|cred c[ăa] e|cred c[ăa] este) corect/,
    /\br[ăa]spuns(ul)? (e|este) gre[șs]it/,
    /\bde fapt (e|este|ar trebui|cred)/,
    /\b(si|și) varianta [a-e]\b/,
    /\bmai e[i]? corect[ăa]?\b/,
  ];
  return DISPUTE_PATTERNS.some((p) => p.test(norm));
}

/** Explicit permission to use general knowledge when no course backs the claim. */
export function grantsGeneralKnowledgePermission(text: string): boolean {
  const norm = normalizeForMatch(text);
  return /\bghice[șs]te\b|\bintuie[șs]te\b|din cuno[șs]tin[țt]ele tale|cunostinte generale|f[ăa]r[ăa] curs|chiar dac[ăa] nu (ai|g[ăa]se[șs]ti)/.test(norm);
}

interface AnswerVerdict {
  agrees?: boolean;
  correctLetters?: string[];
  reasoning?: string;
}

/**
 * Research the student's claim against the current quiz question: check the
 * library first, and only fall back to general medical knowledge if the
 * student explicitly allowed it. Returns an AgentPlan so the SAME confirm-card
 * UI (AgentJobCard) that folder/generation commands use also handles this —
 * without a needsConfirm step, nothing gets mutated.
 */
export async function proposeAnswerCorrection(claim: string, allowGeneralKnowledge: boolean): Promise<AgentPlan> {
  const ctx = useQuizChatContextStore.getState().context;
  if (!ctx) {
    return { isCommand: false, reply: '', steps: [], needsConfirm: false };
  }

  const kb = await useAIStore.getState().getKnowledgeContext(ctx.questionText, 3000);
  const grounded = kb.trim().length > 0;

  if (!grounded && !allowGeneralKnowledge) {
    return {
      isCommand: true,
      reply: 'Nu găsesc niciun curs legat de această întrebare în Biblioteca AI. Vrei să încerc să apreciez din cunoștințe medicale generale (fără sursă sigură)? Spune „da, din cunoștințele tale" dacă vrei să continui.',
      steps: [],
      needsConfirm: false,
    };
  }

  const optionLines = ctx.options
    .map((o, i) => `${String.fromCharCode(97 + i)}) ${o.text}${o.isCorrect ? '  [marcat corect acum]' : ''}`)
    .join('\n');
  const prompt = [
    'Ești examinator de Medicină. Un student contestă răspunsul corect marcat la o grilă.',
    `Întrebare: ${ctx.questionText}`,
    `Variante:\n${optionLines}`,
    `Afirmația studentului: "${claim}"`,
    grounded
      ? `Context relevant din biblioteca studentului — folosește-l ca sursă principală:\n${kb}`
      : 'Nu există context din bibliotecă pentru această întrebare — folosește DOAR cunoștințe medicale generale, stabile, și marchează asta clar în reasoning.',
    'Răspunde STRICT cu JSON, fără text în plus: {"agrees": true|false, "correctLetters": ["a"], "reasoning": "1-2 propoziții, în română"}',
    '"agrees": ești de acord că e nevoie să schimbi ce e marcat corect acum. "correctLetters": literele care AR TREBUI să fie marcate corecte (poate fi identic cu ce e marcat acum dacă agrees:false). Nu inventa fapte medicale.',
  ].join('\n\n');

  let parsed: AnswerVerdict | null = null;
  try {
    const raw = await groqRequest({
      task: 'analysis',
      messages: [{ role: 'user', content: prompt }],
      skipLibraryContext: true,
      temperature: 0.2,
    });
    parsed = extractJsonFromText(raw) as AnswerVerdict;
  } catch {
    return { isCommand: true, reply: 'Nu am putut verifica afirmația acum — încearcă din nou.', steps: [], needsConfirm: false };
  }

  if (!parsed?.agrees || !Array.isArray(parsed.correctLetters) || parsed.correctLetters.length === 0) {
    return {
      isCommand: true,
      reply: parsed?.reasoning ? `Am verificat: ${parsed.reasoning}` : 'Am verificat și răspunsul marcat acum pare corect — nu am motive să-l schimb.',
      steps: [],
      needsConfirm: false,
    };
  }

  const letterToIdx = (l: string) => l.trim().toLowerCase().charCodeAt(0) - 97;
  const correctOptionIds = [...new Set(parsed.correctLetters.map(letterToIdx))]
    .filter((i) => i >= 0 && i < ctx.options.length)
    .map((i) => ctx.options[i].id);

  if (correctOptionIds.length === 0) {
    return {
      isCommand: true,
      reply: 'Am înțeles că vrei o corectare, dar nu am putut identifica exact varianta — specifică litera (a/b/c/d/e).',
      steps: [],
      needsConfirm: false,
    };
  }

  // Resolved from the final (deduped, in-range) correctOptionIds rather than the raw
  // model output, so the label always matches exactly what execution will apply.
  const correctLabel = correctOptionIds.length === 1
    ? `varianta ${String.fromCharCode(65 + ctx.options.findIndex((o) => o.id === correctOptionIds[0]))}`
    : `variantele ${correctOptionIds
        .map((id) => String.fromCharCode(65 + ctx.options.findIndex((o) => o.id === id)))
        .join(', ')}`;

  const step: AgentStep = {
    action: 'correct_answer',
    quizId: ctx.quizId,
    questionId: ctx.questionId,
    correctOptionIds,
    correctLabel,
    reasoning: parsed.reasoning,
    groundedIn: grounded ? 'course' : 'general',
  };

  return {
    isCommand: true,
    reply: `${parsed.reasoning ?? 'Am verificat afirmația ta.'} ${grounded ? '(confirmat din biblioteca ta)' : '(din cunoștințe generale — te rog verifică oricum)'}`,
    steps: [step],
    needsConfirm: true,
    confirmReason: 'Modific răspunsul corect salvat al acestei întrebări.',
  };
}

function extractJsonObject(raw: string): string | null {
  const stripped = raw.replace(/```(?:json)?/gi, '').replace(/```/g, '');
  const start = stripped.indexOf('{');
  const end = stripped.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  return stripped.slice(start, end + 1);
}

/** Render each folder as its full "Parent / Child" path so the planner can see
 *  the subfolder hierarchy and target a nested folder by name. */
function folderPaths(items: Array<{ id: string; name: string; parentId?: string | null }>): string[] {
  const byId = new Map(items.map((folder) => [folder.id, folder]));
  return items.map((folder) => {
    const names = [folder.name];
    const guard = new Set<string>([folder.id]);
    let parent = folder.parentId ? byId.get(folder.parentId) : undefined;
    while (parent && !guard.has(parent.id)) {
      guard.add(parent.id);
      names.unshift(parent.name);
      parent = parent.parentId ? byId.get(parent.parentId) : undefined;
    }
    return names.join(' / ');
  });
}

function buildPlannerPrompt(contextStyle: ExamStyle) {
  const { knowledgeSources, libraryFolders } = useAIStore.getState();
  const folders = useFolderStore.getState().folders;
  const quizzes = useQuizStore.getState().quizzes;

  const sources = knowledgeSources.filter((s) => s.indexStatus === 'ready').slice(0, 40).map((s) => s.name);
  const quizFolderNames = folderPaths(folders).slice(0, 60);
  const libFolderNames = folderPaths(libraryFolders).slice(0, 60);
  const quizTitles = quizzes.slice(0, 60).map((q) => q.title);

  return [
    'Ești motorul de comenzi al aplicației de studiu StudyX. Transformi comanda utilizatorului într-un PLAN de acțiuni JSON.',
    'Răspunde STRICT cu un singur obiect JSON, fără markdown, fără text în plus.',
    '',
    'Format:',
    '{"isCommand": true|false, "needsClarification": true|false, "reply": "confirmare scurtă în română", "steps": [ ...pași... ]}',
    '',
    'Dacă mesajul NU e o comandă de acțiune (ci o întrebare normală, conversație), pune "isCommand": false, "needsClarification": false, "reply": "" și "steps": [].',
    '',
    'Dacă mesajul CLAR cere o acțiune dar îți lipsește o informație esențială ca să construiești pașii corect (ce curs, ce subiect, ce cantitate, ce folder — și nu poți deduce nimic rezonabil din conversație), pune "isCommand": false, "needsClarification": true, "steps": [] și scrie în "reply" O SINGURĂ întrebare scurtă și directă care cere EXACT informația lipsă (nu reformula toată comanda, nu te scuza). Exemple: userul zice doar "fă-mi grile" fără subiect/curs → reply: "Despre ce curs sau subiect vrei grilele?". Userul zice "mută-l în folder" fără să spună care set → reply: "Care set vrei să-l mut?".',
    '- NU folosi needsClarification pentru lucruri pe care le poți rezolva singur cu reguli rezonabile (ex. cantitate nespecificată → foloseste implicit; folder nespecificat → rădăcină). Cere clarificare DOAR când ghicitul ar produce cu adevărat rezultatul greșit (subiect/curs lipsă, țintă ambiguă între mai multe opțiuni asemănătoare).',
    '',
    'Acțiuni disponibile (folosește exact aceste nume):',
    '- create_folder: {"action":"create_folder","name":"Nume","parent":"NumeFolderParinte (optional, pt subfolder)"}',
    '- create_library_folder: {"action":"create_library_folder","name":"Nume","parent":"NumeFolderParinte (optional, pt subfolder de bibliotecă)"}  // folder pt cursuri în Bibliotecă',
    '- generate_quiz_pack: {"action":"generate_quiz_pack","source":"nume curs din bibliotecă","folder":"nume folder destinatie (optional)","packCount":N,"questionsPerPack":N,"questionType":"single|multiple","difficulty":"auto|easy|medium|hard"}',
    '- generate_quiz_topic: {"action":"generate_quiz_topic","topic":"subiectul cerut de user, EXACT cum l-a formulat","folder":"nume folder destinatie (optional)","questionsPerPack":N,"questionType":"single|multiple","difficulty":"auto|easy|medium|hard"}  // grile pe un subiect general (cunoștințe medicale generale ale AI-ului), FĂRĂ curs din bibliotecă',
    '- generate_from_mistakes: {"action":"generate_from_mistakes","count":N,"folder":"nume folder destinatie (optional)","questionType":"single|multiple"}  // grile de recapitulare țintite pe greșelile salvate ale studentului (NU are nevoie de sursă)',
    '- create_flashcards: {"action":"create_flashcards","source":"nume curs din bibliotecă","folder":"nume folder destinatie (optional)","count":N}  // deck de flashcarduri (active recall) DINTR-UN CURS din bibliotecă',
    '- create_flashcards_topic: {"action":"create_flashcards_topic","topic":"subiectul cerut","folder":"nume folder destinatie (optional)","count":N}  // flashcarduri pe un SUBIECT general (cunoștințele medicale ale AI-ului), fără curs din bibliotecă',
    '- summarize_document: {"action":"summarize_document","source":"nume curs din bibliotecă"}  // rezumat structurat pentru examen al unui curs din bibliotecă',
    '- create_study_plan: {"action":"create_study_plan","examName":"Numele examenului","studyDays":N,"hoursPerDay":N}  // plan de studiu personalizat bazat pe biblioteca curentă și SM-2',
    '- move_quiz: {"action":"move_quiz","quiz":"titlu set","folder":"nume folder"}',
    '- rename_quiz: {"action":"rename_quiz","quiz":"titlu actual","newName":"titlu nou"}',
    '- delete_quiz: {"action":"delete_quiz","quiz":"titlu set"}',
    '- rename_folder: {"action":"rename_folder","name":"nume actual","newName":"nume nou"}',
    '- delete_folder: {"action":"delete_folder","name":"nume folder"}',
    '',
    'Reguli:',
    '- Folderele de mai jos pot fi imbricate: un folder scris ca „Parinte / Copil" înseamnă că „Copil" e subfolder al lui „Parinte". Ca să pui ceva într-un subfolder, folosește exact numele subfolderului (ex. „Copil") la câmpul "folder". Ca să creezi un subfolder nou, folosește create_folder cu "parent" = numele folderului părinte.',
    '- Dacă userul cere generare într-un folder care nu există, adaugă întâi un pas create_folder, apoi generate_quiz_pack cu același "folder".',
    '- "flashcard"/"flashcarduri"/"flascarduri"/"carduri"/"fișe" cerute explicit → flashcarduri, NU grile. "count" = numărul cerut (implicit 15).',
    '- Dacă userul NUMEȘTE un curs din bibliotecă → create_flashcards. Dacă cere flashcarduri pe un subiect/temă, sau nu numește niciun curs → create_flashcards_topic. NU pune isCommand:false doar pentru că nu există curs în bibliotecă.',
    '- "greșeli"/"greșesc"/"unde greșesc"/"recapitulare greșeli"/"din ce am greșit" → generate_from_mistakes (NU cere sursă; folosește banca de greșeli).',
    '- "rezumă"/"rezumat"/"sinteză" pentru un curs din bibliotecă → summarize_document.',
    '- "complement multiplu"/"răspunsuri multiple"/"mai multe răspunsuri corecte" → questionType:"multiple". "complement simplu"/"un singur răspuns" → questionType:"single". Implicit "single".',
    `- "examStyle" alege formatul: "residency" = grile ca la rezidențiat, cu 5 variante (A-E); "simple" = grilă clasică de facultate, cu 4 variante (A-D). Implicit (dacă userul nu cere clar unul din cele două): "${contextStyle}" — asta pentru că ${contextStyle === 'residency' ? 'userul discută în secțiunea Rezidențiat' : 'userul discută în afara secțiunii Rezidențiat'}. Pune celălalt format DOAR dacă userul cere explicit (ex. "rezidențiat"/"ca la examen" → residency; "grile simple"/"pentru facultate" → simple).`,
    '- "grilă"/"grile"/"întrebări"/"întrebare" = NUMĂRUL DE ÎNTREBĂRI (questionsPerPack). "set"/"seturi"/"pachet"/"pachete" = NUMĂRUL DE PACHETE (packCount).',
    '- IMPLICIT packCount = 1. Pune packCount > 1 DOAR dacă userul cere explicit mai multe "seturi"/"pachete", SAU dacă numărul de întrebări depășește 60 (abia atunci împarte în pachete de maxim 60 fiecare).',
    '- NU inventa numere și NU exagera. Exemple: "2 grile" → packCount:1, questionsPerPack:2. "10 întrebări" → packCount:1, questionsPerPack:10. "3 seturi a câte 20" → packCount:3, questionsPerPack:20. "150 de grile" → packCount:3, questionsPerPack:50.',
    '- Atenție: un număr lângă numele cursului (ex. "Cursul 2") NU e un număr de grile, e parte din numele cursului.',
    '- Pentru generare de grile: dacă userul NUMEȘTE un curs/sursă și acesta EXISTĂ în bibliotecă (lista de mai jos), folosește generate_quiz_pack. Dacă userul cere grile pe un SUBIECT/temă generală (nu numește un curs, sau cursul numit nu există), folosește generate_quiz_topic cu "topic" = subiectul cerut — NU pune isCommand:false doar pentru că nu există curs în bibliotecă; AI-ul poate genera din cunoștințe medicale generale.',
    '- Folosește isCommand:false DOAR când mesajul chiar nu e o comandă de acțiune (întrebare normală, conversație), nu când lipsește un curs din bibliotecă.',
    '- "topic" (la generate_quiz_topic și create_flashcards_topic) trebuie să fie MEREU un subiect medical concret. Dacă userul face referire la conversație („despre subiectul discutat", „din tema de mai sus", „despre asta", „ce am vorbit acum"), înlocuiește referința cu subiectul real din mesajele anterioare (ex. „embolia pulmonară"). NU scrie niciodată „subiectul discutat", „tema de mai sus" sau alt text-referință în câmpul "topic".',
    '- Dacă referința nu poate fi rezolvată din conversație, pune isCommand:false, needsClarification:true și cere clarificare în "reply".',
    '',
    `Cursuri în bibliotecă: ${sources.length ? sources.join(' | ') : '(niciunul)'}`,
    `Foldere grile: ${quizFolderNames.length ? quizFolderNames.join(' | ') : '(niciunul)'}`,
    `Foldere bibliotecă: ${libFolderNames.length ? libFolderNames.join(' | ') : '(niciunul)'}`,
    `Seturi existente: ${quizTitles.length ? quizTitles.join(' | ') : '(niciunul)'}`,
  ].join('\n');
}

/**
 * Topics that are references to the conversation, not subjects: "grile despre
 * subiectul discutat". Generating on such a string produces garbage questions
 * (or a failed validation), so they are resolved against the thread first.
 */
const REFERENTIAL_TOPIC_RE = new RegExp(
  '^(?:acest[ai]?\\s+|acel[ai]?\\s+|acelasi\\s+|aceeasi\\s+)?' +
  '(?:subiect(?:ul)?|tema|tem[ăa]|capitol(?:ul)?|materi[ae]|noti(?:unea|unile)|chestia|lucrul)?\\s*' +
  '(?:discutat[ăa]?|dezbatut[ăa]?|de mai sus|de dinainte|de dinaintea|anterior[ăa]?|precedent[ăa]?|curent[ăa]?|' +
  'de care am (?:vorbit|discutat)|despre care am (?:vorbit|discutat)|de care vorbeam|de care discutam|' +
  'de aici|de sus|de adineauri|asta|aceasta|acesta|ast[ae]a)\\.?$',
  'i',
);

function stripDiacritics(value: string) {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export function isReferentialTopic(topic: string | undefined): boolean {
  const cleaned = stripDiacritics((topic ?? '').trim().toLowerCase()).replace(/\s+/g, ' ');
  if (!cleaned) return true;
  if (/^(?:ce|despre ce) am (?:vorbit|discutat)/.test(cleaned)) return true;
  // "acelasi subiect" / "aceeasi tema" — a bare demonstrative + noun, no tail.
  if (/^(?:acelasi|aceeasi|acest|aceasta|acel|acea)\s+(?:subiect|tema|capitol|materie|lucru)(?:ul|a)?$/.test(cleaned)) return true;
  return REFERENTIAL_TOPIC_RE.test(cleaned);
}

/**
 * Asks the model what the thread was actually about, so "fă-mi grile despre
 * subiectul discutat" becomes a real subject. Returns null when the
 * conversation gives nothing concrete — the caller then falls back to chat
 * instead of generating questions about a placeholder.
 */
export async function resolveDiscussedTopic(
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
): Promise<string | null> {
  const transcript = history
    .filter((turn) => turn.content && turn.content.trim())
    .slice(-6)
    .map((turn) => `${turn.role === 'user' ? 'Student' : 'Asistent'}: ${turn.content.slice(0, 900)}`)
    .join('\n\n');
  if (!transcript.trim()) return null;

  let raw: string;
  try {
    raw = await groqRequest({
      task: 'analysis',
      messages: [
        {
          role: 'system',
          content: [
            'Primești ultima parte a unei conversații de studiu medical.',
            'Spune care este subiectul medical concret discutat, în maximum 8 cuvinte, în română.',
            'Răspunde DOAR cu subiectul, fără ghilimele, fără explicații și fără propoziții.',
            'Dacă nu există un subiect medical clar, răspunde exact: NONE',
          ].join('\n'),
        },
        { role: 'user', content: transcript },
      ],
      temperature: 0,
      maxTokens: 40,
      skipLibraryContext: true,
    });
  } catch {
    return null;
  }

  const topic = raw
    .replace(/["'`*]/g, '')
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 0);

  if (!topic || /^none$/i.test(topic)) return null;
  // The prompt asks for at most 8 words; anything longer is a sentence, i.e. the
  // model ignored the format and the "topic" would poison the generator.
  if (topic.length < 3 || topic.split(/\s+/).length > 8) return null;
  if (isReferentialTopic(topic)) return null;
  return topic;
}

function normalizeStep(raw: Record<string, unknown>): AgentStep | null {
  const action = String(raw.action ?? '') as AgentActionType;
  const valid: AgentActionType[] = [
    'create_folder', 'create_library_folder', 'generate_quiz_pack', 'generate_quiz_topic', 'generate_from_mistakes',
    'create_flashcards', 'create_flashcards_topic', 'summarize_document', 'create_study_plan',
    'move_quiz', 'rename_quiz', 'delete_quiz', 'rename_folder', 'delete_folder',
  ];
  if (!valid.includes(action)) return null;

  const str = (key: string) => (typeof raw[key] === 'string' ? (raw[key] as string).trim() : undefined);
  const num = (key: string) => (Number.isFinite(Number(raw[key])) ? Number(raw[key]) : undefined);
  const diff = str('difficulty');

  return {
    action,
    name: str('name'),
    newName: str('newName') ?? str('new_name'),
    parent: str('parent'),
    source: str('source'),
    topic: str('topic'),
    folder: str('folder'),
    quiz: str('quiz'),
    packCount: num('packCount') ?? num('packcount'),
    questionsPerPack: num('questionsPerPack') ?? num('questions') ?? num('questionsperpack'),
    count: num('count') ?? num('cards') ?? num('cardCount'),
    questionType: (['single', 'multiple'].includes(str('questionType') ?? str('question_type') ?? '') ? (str('questionType') ?? str('question_type')) : undefined) as AgentStep['questionType'],
    examStyle: (['residency', 'simple'].includes(str('examStyle') ?? str('exam_style') ?? '') ? (str('examStyle') ?? str('exam_style')) : undefined) as AgentStep['examStyle'],
    difficulty: (['auto', 'easy', 'medium', 'hard'].includes(diff ?? '') ? diff : undefined) as AgentStep['difficulty'],
    examName: str('examName') ?? str('exam'),
    studyDays: num('studyDays') ?? num('days'),
    hoursPerDay: num('hoursPerDay') ?? num('hours'),
  };
}

export async function planAgentCommand(
  command: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }> = [],
  contextStyle: ExamStyle = DEFAULT_EXAM_STYLE,
): Promise<AgentPlan> {
  const system = buildPlannerPrompt(contextStyle);
  // Feed the recent turns so follow-ups ("mai încearcă", "acum în Hematologie")
  // resolve against the previous request instead of being planned in isolation.
  const recentTurns = history
    .filter((turn) => turn.content && turn.content.trim())
    .slice(-6)
    .map((turn) => ({ role: turn.role, content: turn.content.slice(0, 600) }));
  const raw = await groqRequest({
    task: 'analysis',
    messages: [
      { role: 'system', content: system },
      ...recentTurns,
      { role: 'user', content: command },
    ],
    temperature: 0.1,
    maxTokens: 1200,
    skipLibraryContext: true,
  });

  const jsonStr = extractJsonObject(raw);
  if (!jsonStr) return { isCommand: false, reply: '', steps: [], needsConfirm: false };

  let parsed: { isCommand?: boolean; needsClarification?: boolean; reply?: string; steps?: unknown };
  try { parsed = JSON.parse(jsonStr); }
  catch { return { isCommand: false, reply: '', steps: [], needsConfirm: false }; }

  const steps = Array.isArray(parsed.steps)
    ? parsed.steps
        .map((entry) => (entry && typeof entry === 'object' ? normalizeStep(entry as Record<string, unknown>) : null))
        .filter((step): step is AgentStep => Boolean(step))
    : [];

  // Deterministic correction: the planner often miscounts ("3 grile" → 3×10)
  // and drops the question type, so override generate_quiz_pack steps with what
  // the user literally wrote whenever the wording is unambiguous.
  // The two tracks matter enough not to leave them to the planner's judgement:
  // "grile de rezidentiat" and "grile simple pentru materie" are read straight
  // from the user's wording, exactly like the counts below.
  // Explicit wording always wins; absent that, fall back to the section the
  // user is actually chatting from (Rezidențiat vs. general) instead of a
  // hardcoded default — a "10 grile despre X" asked outside Rezidențiat must
  // not silently produce a set tagged 'rezidentiat' and hidden from "Toate grilele".
  const requestedStyle = detectExamStyle(command) ?? contextStyle;
  for (const step of steps) {
    if (step.action === 'generate_quiz_pack' || step.action === 'generate_quiz_topic' || step.action === 'generate_from_mistakes') {
      step.examStyle = requestedStyle;
    }
  }

  // Also covers the *_topic variants (generate_quiz_topic, create_flashcards_topic) —
  // used whenever the subject isn't a matched library course, which is the common
  // case for a freeform "fă-mi N grile despre X". They used to be skipped here, so
  // a literal count the user typed ("100 de grile") got silently overwritten by
  // whatever the planner guessed, with no confirmation even for a huge request —
  // clamping happens here too (not just at execution) so the confirm card below
  // shows the number that will actually be generated, not one that quietly
  // shrinks again afterward.
  const intent = extractQuizIntent(command);
  if (intent.packCount || intent.questionsPerPack || intent.questionType) {
    for (const step of steps) {
      if (step.action === 'generate_from_mistakes') {
        if (intent.questionsPerPack !== undefined) step.count = clampStudioQuestionCount(intent.questionsPerPack);
        if (intent.questionType !== undefined) step.questionType = intent.questionType;
      } else if (step.action === 'generate_quiz_pack') {
        if (intent.questionsPerPack !== undefined) step.questionsPerPack = clampStudioQuestionCount(intent.questionsPerPack);
        if (intent.packCount !== undefined) step.packCount = clampStudioPackCount(intent.packCount);
        if (intent.questionType !== undefined) step.questionType = intent.questionType;
      } else if (step.action === 'generate_quiz_topic') {
        // Single-pack mode — a "N seturi" phrasing doesn't apply here (no pack loop),
        // so only the per-request question count is corrected.
        if (intent.questionsPerPack !== undefined) step.questionsPerPack = clampStudioQuestionCount(intent.questionsPerPack);
        if (intent.questionType !== undefined) step.questionType = intent.questionType;
      } else if (step.action === 'create_flashcards_topic') {
        if (intent.questionsPerPack !== undefined) step.count = clampStudioQuestionCount(intent.questionsPerPack);
      }
    }
  }

  // The planner is told to copy the topic verbatim, so "grile despre subiectul
  // discutat" arrives as a placeholder. Resolve it against the thread; if the
  // conversation offers nothing concrete, drop the step rather than generate
  // questions about the phrase itself.
  const referential = steps.filter(
    (step) => (step.action === 'generate_quiz_topic' || step.action === 'create_flashcards_topic')
      && isReferentialTopic(step.topic),
  );
  let droppedReferentialTopic = false;
  if (referential.length > 0) {
    const resolved = await resolveDiscussedTopic([...recentTurns, { role: 'user', content: command }]);
    for (const step of referential) {
      if (resolved) {
        step.topic = resolved;
      } else {
        steps.splice(steps.indexOf(step), 1);
        droppedReferentialTopic = true;
      }
    }
  }

  const isCommand = Boolean(parsed.isCommand) && steps.length > 0;
  // Dropping an unresolved referential topic can empty out an otherwise valid
  // plan without the planner itself ever having flagged the ambiguity — treat
  // that the same as an explicit needsClarification, or the user's "fă-mi
  // grile despre asta" silently falls through to being answered as chit-chat.
  const needsClarification = Boolean(parsed.needsClarification) || (droppedReferentialTopic && steps.length === 0);
  const clarificationReply = typeof parsed.reply === 'string' && parsed.reply.trim()
    ? parsed.reply
    : (needsClarification ? 'Despre ce curs sau subiect vrei să continui?' : '');

  const totalQuestions = steps
    .reduce((sum, step) => {
      if (step.action === 'generate_quiz_pack') return sum + (step.packCount ?? 1) * (step.questionsPerPack ?? 10);
      if (step.action === 'generate_quiz_topic') return sum + (step.questionsPerPack ?? 10);
      if (step.action === 'create_flashcards') return sum + (step.count ?? 15);
      if (step.action === 'create_flashcards_topic') return sum + (step.count ?? 15);
      if (step.action === 'generate_from_mistakes') return sum + (step.count ?? 10);
      return sum;
    }, 0);
  const hasDestructive = steps.some((step) => DESTRUCTIVE_ACTIONS.includes(step.action));
  // Below QUESTION_CONFIRM_THRESHOLD in total but still a large ask on a
  // freeform (ungrounded) topic — surface it before generating, not after,
  // so a misread subject costs a confirm click instead of a wasted batch.
  const largeTopicStep = steps.find((step) => (
    (step.action === 'generate_quiz_topic' && (step.questionsPerPack ?? 10) > TOPIC_CONFIRM_THRESHOLD)
    || (step.action === 'create_flashcards_topic' && (step.count ?? 15) > TOPIC_CONFIRM_THRESHOLD)
  ));
  const needsConfirm = isCommand && (hasDestructive || totalQuestions > QUESTION_CONFIRM_THRESHOLD || Boolean(largeTopicStep));
  const confirmReason = hasDestructive
    ? 'Comanda include ștergeri.'
    : totalQuestions > QUESTION_CONFIRM_THRESHOLD
      ? `Generare mare (~${totalQuestions} întrebări) — poate dura.`
      : largeTopicStep
        ? `Generare mare pe subiect liber („${largeTopicStep.topic}", ~${largeTopicStep.action === 'generate_quiz_topic' ? largeTopicStep.questionsPerPack : largeTopicStep.count} ${largeTopicStep.action === 'generate_quiz_topic' ? 'întrebări' : 'carduri'}) — verifică tema înainte să generez.`
        : undefined;

  return {
    isCommand,
    reply: needsClarification ? clarificationReply : (typeof parsed.reply === 'string' ? parsed.reply : ''),
    steps,
    needsConfirm,
    confirmReason,
    needsClarification,
  };
}

export function describeStep(step: AgentStep): string {
  switch (step.action) {
    case 'create_folder':
      return step.parent ? `Creez subfolderul „${step.name}" în „${step.parent}"` : `Creez folderul „${step.name}"`;
    case 'create_library_folder':
      return step.parent
        ? `Creez subfolderul de bibliotecă „${step.name}" în „${step.parent}"`
        : `Creez folderul de bibliotecă „${step.name}"`;
    case 'generate_quiz_pack': {
      const packs = clampStudioPackCount(step.packCount ?? 1);
      const perPack = clampStudioQuestionCount(step.questionsPerPack ?? 10);
      const dest = step.folder ? ` în „${step.folder}"` : '';
      const typeLabel = step.questionType === 'multiple' ? ' (complement multiplu)' : '';
      const countLabel = packs === 1 ? `${perPack} grile` : `${packs}×${perPack} grile`;
      return `Generez ${countLabel}${typeLabel} din „${step.source}"${dest}`;
    }
    case 'generate_quiz_topic': {
      const n = clampStudioQuestionCount(step.questionsPerPack ?? 10);
      const typeLabel = step.questionType === 'multiple' ? ' (complement multiplu)' : '';
      const dest = step.folder ? ` în „${step.folder}"` : '';
      const styleLabel = EXAM_STYLE_META[step.examStyle ?? DEFAULT_EXAM_STYLE].short;
      return `Generez ${n} grile${typeLabel} despre „${step.topic}" · ${styleLabel}${dest}`;
    }
    case 'correct_answer': {
      const src = step.groundedIn === 'course' ? 'confirmat din biblioteca ta' : step.groundedIn === 'general' ? 'din cunoștințe medicale generale — verifică' : 'după observația ta';
      const answer = step.correctLabel ? ` → devine corectă ${step.correctLabel}` : '';
      return `Actualizez răspunsul corect al întrebării${answer} (${src})`;
    }
    case 'generate_from_mistakes': {
      const n = clampStudioQuestionCount(step.count ?? 10);
      const typeLabel = step.questionType === 'multiple' ? ' (complement multiplu)' : '';
      const dest = step.folder ? ` în „${step.folder}"` : '';
      return `Creez ${n} grile de recapitulare${typeLabel} din greșelile tale${dest}`;
    }
    case 'create_flashcards': {
      const cards = Math.max(1, Math.min(100, step.count ?? 15));
      const dest = step.folder ? ` în „${step.folder}"` : '';
      return `Creez ${cards} flashcarduri din „${step.source}"${dest}`;
    }
    case 'create_flashcards_topic': {
      const cards = Math.max(1, Math.min(100, step.count ?? 15));
      const dest = step.folder ? ` în „${step.folder}"` : '';
      return `Creez ${cards} flashcarduri despre „${step.topic}"${dest}`;
    }
    case 'summarize_document':
      return `Rezum cursul „${step.source}"`;
    case 'move_quiz':
      return `Mut setul „${step.quiz}" în „${step.folder}"`;
    case 'rename_quiz':
      return `Redenumesc „${step.quiz}" → „${step.newName}"`;
    case 'create_study_plan': {
      const days = step.studyDays ?? 7;
      const exam = step.examName ? `„${step.examName}"` : 'examen';
      return `Creez plan de studiu ${days} zile pentru ${exam}`;
    }
    case 'delete_quiz':
      return `Șterg setul „${step.quiz}"`;
    case 'rename_folder':
      return `Redenumesc folderul „${step.name}" → „${step.newName}"`;
    case 'delete_folder':
      return `Șterg folderul „${step.name}"`;
    default:
      return 'Acțiune necunoscută';
  }
}

interface ExecuteCallbacks {
  onStep: (index: number, status: 'running' | 'done' | 'error' | 'skipped', detail?: string) => void;
}

export async function executeAgentPlan(
  plan: AgentPlan,
  ctx: AgentContext,
  callbacks: ExecuteCallbacks,
): Promise<AgentRunResult> {
  const folderStore = useFolderStore.getState();
  const aiStore = useAIStore.getState();
  const activeProfileId = useUserStore.getState().activeProfileId;

  const createdFolderByName = new Map<string, Folder>();
  const createdQuizIds: string[] = [];
  const errors: string[] = [];
  const undoOps: Array<() => void> = [];
  const summaryParts: string[] = [];

  const resolveQuizFolder = (folderName: string | undefined): Folder | null => {
    if (!folderName) return null;
    const created = createdFolderByName.get(normalizeName(folderName));
    if (created) return created;
    return findByName(useFolderStore.getState().folders, folderName);
  };

  /**
   * Destination folder for generated content. A named folder that doesn't exist
   * yet is created instead of silently ignored — "pune-l în Bac" must put it in
   * Bac, not drop the deck at the root because no such folder was there.
   */
  const resolveOrCreateQuizFolder = (folderName: string | undefined): Folder | null => {
    if (!folderName?.trim()) return null;
    const existing = resolveQuizFolder(folderName);
    if (existing) return existing;

    const name = folderName.trim();
    const appearance = suggestFolderAppearance(name);
    const id = folderStore.addFolder(name, appearance.emoji, appearance.color, null);
    const folder: Folder = {
      id,
      name,
      emoji: appearance.emoji,
      color: appearance.color,
      parentId: null,
      createdAt: Date.now(),
    };
    createdFolderByName.set(normalizeName(name), folder);
    undoOps.push(() => useFolderStore.getState().deleteFolder(id));
    summaryParts.push(`folder „${name}"`);
    return folder;
  };

  for (let index = 0; index < plan.steps.length; index += 1) {
    const step = plan.steps[index];
    callbacks.onStep(index, 'running');

    try {
      switch (step.action) {
        case 'create_folder': {
          if (!step.name) throw new Error('Lipsește numele folderului.');
          const parent = resolveQuizFolder(step.parent);
          const appearance = suggestFolderAppearance(step.name);
          const emoji = parent ? '📁' : appearance.emoji;
          const color = appearance.color;
          const id = folderStore.addFolder(step.name, emoji, color, parent?.id ?? null);
          const folder: Folder = { id, name: step.name, emoji, color, parentId: parent?.id ?? null, createdAt: Date.now() };
          createdFolderByName.set(normalizeName(step.name), folder);
          undoOps.push(() => useFolderStore.getState().deleteFolder(id));
          summaryParts.push(`folder „${step.name}"`);
          callbacks.onStep(index, 'done');
          break;
        }

        case 'create_library_folder': {
          if (!step.name) throw new Error('Lipsește numele folderului.');
          const parent = step.parent ? findByName(useAIStore.getState().libraryFolders, step.parent) : null;
          const id = aiStore.addLibraryFolder(step.name, parent ? '📁' : '📚', parent?.id ?? null);
          undoOps.push(() => useAIStore.getState().deleteLibraryFolder(id));
          summaryParts.push(parent ? `subfolder bibliotecă „${step.name}" în „${parent.name}"` : `folder bibliotecă „${step.name}"`);
          callbacks.onStep(index, 'done');
          break;
        }

        case 'generate_quiz_pack': {
          const source = findByName(
            useAIStore.getState().knowledgeSources.filter((s) => s.indexStatus === 'ready'),
            step.source,
          );
          if (!source) throw new Error(`Nu am găsit cursul „${step.source ?? '?'}" în bibliotecă.`);
          const folder = resolveOrCreateQuizFolder(step.folder);
          const packCount = clampStudioPackCount(step.packCount ?? ctx.defaultPackCount);
          const questionsPerPack = clampStudioQuestionCount(step.questionsPerPack ?? ctx.defaultQuestionsPerPack);

          const result = await generateQuizPackagesFromSource({
            sourceId: source.id,
            sourceName: source.name,
            folder,
            folderId: folder?.id ?? null,
            packCount,
            questionsPerPack,
            difficulty: (step.difficulty ?? 'auto') as Difficulty | 'auto',
            questionType: step.questionType ?? 'single',
            examStyle: step.examStyle ?? DEFAULT_EXAM_STYLE,
            activeProfileId,
            existingQuizzes: useQuizStore.getState().quizzes,
          });

          result.quizzes.forEach((quiz) => {
            useQuizStore.getState().addQuiz(quiz);
            createdQuizIds.push(quiz.id);
            undoOps.push(() => useQuizStore.getState().deleteQuiz(quiz.id));
          });
          // Warn when the AI failed and questions came from the local fallback —
          // otherwise the user silently gets low-quality, copied-sentence questions.
          const totalGenerated = result.aiQuestionCount + result.fallbackQuestionCount;
          const mostlyFallback = totalGenerated > 0 && result.fallbackQuestionCount >= totalGenerated / 2;
          if (mostlyFallback) {
            errors.push(`„${source.name}": AI-ul nu a răspuns, am folosit generare locală de rezervă (calitate redusă). Verifică cheia AI în Setări.`);
          }
          if (result.medicallyFlaggedCount > 0) {
            errors.push(`„${source.name}": ${result.medicallyFlaggedCount} întrebări eliminate de verificarea medicală (răspuns marcat greșit).`);
          }
          summaryParts.push(`${result.quizzes.length} seturi din „${source.name}"`);
          callbacks.onStep(
            index,
            mostlyFallback ? 'error' : 'done',
            mostlyFallback ? `${result.quizzes.length} seturi (rezervă locală — verifică cheia AI)` : `${result.quizzes.length} seturi`,
          );
          break;
        }

        case 'correct_answer': {
          if (!step.quizId || !step.questionId || !step.correctOptionIds?.length) {
            throw new Error('Date lipsă pentru corectarea răspunsului.');
          }
          const targetQuiz = useQuizStore.getState().quizzes.find((q) => q.id === step.quizId);
          if (!targetQuiz) throw new Error('Grila nu mai există.');
          const qIndex = targetQuiz.questions.findIndex((q) => q.id === step.questionId);
          if (qIndex === -1) throw new Error('Întrebarea nu mai există în grilă (poate a fost editată).');

          const previousQuestions = targetQuiz.questions;
          const correctIds = new Set(step.correctOptionIds);
          const updatedQuestion: Question = {
            ...previousQuestions[qIndex],
            options: previousQuestions[qIndex].options.map((o) => ({ ...o, isCorrect: correctIds.has(o.id) })),
            multipleCorrect: correctIds.size > 1,
          };
          const nextQuestions = previousQuestions.map((q, i) => (i === qIndex ? updatedQuestion : q));
          useQuizStore.getState().updateQuiz(targetQuiz.id, { questions: nextQuestions });
          undoOps.push(() => useQuizStore.getState().updateQuiz(targetQuiz.id, { questions: previousQuestions }));
          summaryParts.push(`răspuns corectat în „${targetQuiz.title}"`);
          callbacks.onStep(index, 'done', 'Răspuns actualizat');
          break;
        }

        case 'generate_quiz_topic': {
          if (!step.topic) throw new Error('Lipsește subiectul grilelor.');
          const count = clampStudioQuestionCount(step.questionsPerPack ?? ctx.defaultQuestionsPerPack);
          const profile = activeProfileId ? getUserProfile(activeProfileId) : null;
          const difficulty = (step.difficulty && step.difficulty !== 'auto' ? step.difficulty : profile?.currentDifficulty ?? 'medium') as Difficulty;

          // NOT generateQuestions() — that always grounds in the user's library (RAG),
          // which silently mixes in unrelated content when the topic isn't covered
          // there (e.g. asking for "mielom multiplu" pulled in dermatology chunks).
          // A freeform topic like this should use general medical knowledge only.
          const result = await generateQuestionsFromTopic(
            step.topic,
            count,
            difficulty,
            step.questionType ?? 'single',
            profile,
            step.examStyle ?? DEFAULT_EXAM_STYLE,
          );
          if (result.questions.length === 0) throw new Error(`Nu am putut genera grile despre „${step.topic}".`);
          if (result.medicallyFlaggedCount) {
            errors.push(`„${step.topic}": ${result.medicallyFlaggedCount} întrebări eliminate de verificarea medicală (răspuns marcat greșit).`);
          }

          const folder = resolveOrCreateQuizFolder(step.folder);
          const quiz: Quiz = {
            id: shortId(),
            title: step.topic,
            description: `${result.questions.length} grile generate de AI despre „${step.topic}" · ${EXAM_STYLE_META[step.examStyle ?? DEFAULT_EXAM_STYLE].description}.`,
            emoji: '✨',
            color: folder?.color ?? 'blue',
            category: folder?.name ?? 'Altele',
            kind: 'quiz',
            folderId: folder?.id ?? null,
            shuffleQuestions: true,
            shuffleAnswers: true,
            tags: [...examStyleTags(step.examStyle ?? DEFAULT_EXAM_STYLE), 'topic'],
            questions: result.questions,
            createdAt: Date.now(),
          };
          useQuizStore.getState().addQuiz(quiz);
          createdQuizIds.push(quiz.id);
          undoOps.push(() => useQuizStore.getState().deleteQuiz(quiz.id));
          summaryParts.push(`${result.questions.length} grile despre „${step.topic}"`);
          callbacks.onStep(index, 'done', `${result.questions.length} grile`);
          break;
        }

        case 'generate_from_mistakes': {
          if (!activeProfileId) throw new Error('Nu există profil activ pentru banca de greșeli.');
          const mistakes = generateFromMistakes(activeProfileId);
          if (mistakes.length === 0) {
            throw new Error('Nu am găsit greșeli salvate. Rezolvă întâi câteva grile ca să le pot ținti.');
          }
          const profile = getUserProfile(activeProfileId);
          const weakTopics = getWeakTopicsForProfile(activeProfileId);
          const count = clampStudioQuestionCount(step.count ?? 10);
          const focus = Array.from(new Set(
            mistakes.map((m) => m.missingConcept?.trim() || m.topic?.trim()).filter((t): t is string => Boolean(t)),
          )).slice(0, 8);
          const difficulty = (step.difficulty && step.difficulty !== 'auto'
            ? step.difficulty
            : profile.currentDifficulty) as Difficulty;

          const result = await generateQuestions({
            context: `Recapitulare țintită pe greșelile recurente ale studentului: ${focus.join(', ')}`,
            count,
            difficulty,
            weakTopics,
            userProfile: profile,
            mode: 'standard',
            questionType: step.questionType ?? 'single',
          });
          if (result.questions.length === 0) throw new Error('Nu am putut genera grile din greșeli.');
          if (result.medicallyFlaggedCount) {
            errors.push(`Recapitulare greșeli: ${result.medicallyFlaggedCount} întrebări eliminate de verificarea medicală (răspuns marcat greșit).`);
          }

          const folder = resolveOrCreateQuizFolder(step.folder);
          const quiz: Quiz = {
            id: shortId(),
            title: `Recapitulare greșeli · ${new Date().toLocaleDateString('ro-RO')}`,
            description: `${result.questions.length} grile țintite pe conceptele unde greșești des: ${focus.slice(0, 4).join(', ')}.`,
            emoji: '🎯',
            color: folder?.color ?? 'red',
            category: folder?.name ?? 'Recapitulare',
            kind: 'quiz',
            folderId: folder?.id ?? null,
            shuffleQuestions: true,
            shuffleAnswers: true,
            tags: ['ai', 'remediere', 'greseli'],
            questions: result.questions,
            createdAt: Date.now(),
          };
          useQuizStore.getState().addQuiz(quiz);
          createdQuizIds.push(quiz.id);
          undoOps.push(() => useQuizStore.getState().deleteQuiz(quiz.id));
          summaryParts.push(`${result.questions.length} grile de recapitulare din greșeli`);
          callbacks.onStep(index, 'done', `${result.questions.length} grile țintite`);
          break;
        }

        case 'create_flashcards': {
          const source = findByName(
            useAIStore.getState().knowledgeSources.filter((s) => s.indexStatus === 'ready'),
            step.source,
          );
          if (!source) throw new Error(`Nu am găsit cursul „${step.source ?? '?'}" în bibliotecă.`);
          const text = await loadSourceText(source.id);
          if (text.trim().length < 100) throw new Error(`Cursul „${source.name}" nu are destul text indexat pentru flashcarduri.`);

          const count = Math.max(1, Math.min(100, step.count ?? 15));
          const cards = await notesToFlashcards(text, { count, sourceName: source.name });
          if (cards.length === 0) throw new Error(`Nu am putut genera flashcarduri din „${source.name}".`);

          const folder = resolveOrCreateQuizFolder(step.folder);
          const deck: Quiz = {
            id: shortId(),
            title: `Flashcarduri · ${source.name}`,
            description: `Deck de ${cards.length} flashcarduri generate din „${source.name}".`,
            emoji: '🃏',
            color: folder?.color ?? 'purple',
            category: folder?.name ?? 'AI Flashcards',
            kind: 'flashcard',
            folderId: folder?.id ?? null,
            shuffleQuestions: true,
            shuffleAnswers: false,
            tags: ['flashcard', 'ai'],
            questions: cards.map((card) => buildAgentFlashcard(card.front, card.back)),
            createdAt: Date.now(),
          };
          useQuizStore.getState().addQuiz(deck);
          createdQuizIds.push(deck.id);
          undoOps.push(() => useQuizStore.getState().deleteQuiz(deck.id));
          summaryParts.push(`${cards.length} flashcarduri din „${source.name}"`);
          callbacks.onStep(index, 'done', `${cards.length} carduri`);
          break;
        }

        /**
         * Flashcards on a subject rather than a library course. Without this the
         * planner had no valid action for "fă-mi 30 de flashcarduri și pune-le
         * în Bac", so it gave up and answered in chat with a table of cards that
         * were never saved anywhere.
         */
        case 'create_flashcards_topic': {
          const topic = step.topic?.trim();
          if (!topic) throw new Error('Lipsește subiectul pentru flashcarduri.');

          const count = Math.max(1, Math.min(100, step.count ?? 15));
          const cards = await generateTopicFlashcards(topic, count);
          if (cards.length === 0) throw new Error(`Nu am putut genera flashcarduri despre „${topic}".`);

          const folder = resolveOrCreateQuizFolder(step.folder);
          const deck: Quiz = {
            id: shortId(),
            title: `Flashcarduri · ${topic}`,
            description: `Deck de ${cards.length} flashcarduri despre „${topic}".`,
            emoji: '🃏',
            color: folder?.color ?? 'purple',
            category: folder?.name ?? 'AI Flashcards',
            kind: 'flashcard',
            folderId: folder?.id ?? null,
            shuffleQuestions: true,
            shuffleAnswers: false,
            tags: ['flashcard', 'ai'],
            questions: cards.map((card) => buildAgentFlashcard(card.front, card.back)),
            createdAt: Date.now(),
          };
          useQuizStore.getState().addQuiz(deck);
          createdQuizIds.push(deck.id);
          undoOps.push(() => useQuizStore.getState().deleteQuiz(deck.id));
          summaryParts.push(`${cards.length} flashcarduri despre „${topic}"`);
          callbacks.onStep(index, 'done', `${cards.length} carduri`);
          break;
        }

        case 'summarize_document': {
          const source = findByName(
            useAIStore.getState().knowledgeSources.filter((s) => s.indexStatus === 'ready'),
            step.source,
          );
          if (!source) throw new Error(`Nu am găsit cursul „${step.source ?? '?'}" în bibliotecă.`);
          const text = await loadSourceText(source.id, 16000);
          if (text.trim().length < 100) throw new Error(`Cursul „${source.name}" nu are destul text indexat pentru rezumat.`);

          const summaryText = await groqRequest({
            task: 'analysis',
            messages: [
              {
                role: 'system',
                content: [
                  'Ești un editor de curs pentru examen. Rezumi materialul în idei-cheie esențiale.',
                  'Răspunde în română, cu Markdown: titluri scurte, bullet points și un tabel când ajută.',
                  'Marchează „foarte probabil / posibil / puțin probabil" la examen și include capcanele frecvente.',
                ].join('\n'),
              },
              {
                role: 'user',
                content: `Rezumă pentru examen cursul „${source.name}":\n\n${text}`,
              },
            ],
            temperature: 0.3,
            maxTokens: 1600,
            skipLibraryContext: true,
          });

          summaryParts.push(`rezumat „${source.name}"`);
          callbacks.onStep(index, 'done', 'rezumat generat');
          plan.reply = summaryText;
          break;
        }

        case 'create_study_plan': {
          const studyDays = Math.max(1, Math.min(90, step.studyDays ?? 7));
          const hoursPerDay = Math.max(0.5, Math.min(12, step.hoursPerDay ?? 2));
          const examLabel = step.examName ?? 'Examen';
          const sources = useAIStore.getState().knowledgeSources.filter((s) => s.indexStatus === 'ready');
          const dueCount = (useQuizStore.getState() as { quizzes: Quiz[] }).quizzes.length;

          const planText = await groqRequest({
            task: 'analysis',
            messages: [
              {
                role: 'system',
                content: [
                  'Ești un planificator de studiu personalizat pentru studenți la medicină.',
                  'Creezi un plan de studiu realist, specific și motivant, bazat pe resursele disponibile.',
                  'Răspunde în română. Formatează cu zile numerotate și bullet points. Fii concis și acționabil.',
                ].join('\n'),
              },
              {
                role: 'user',
                content: [
                  `Creează un plan de studiu de ${studyDays} zile pentru examenul „${examLabel}", cu ${hoursPerDay}h/zi disponibile.`,
                  sources.length ? `Cursuri disponibile în bibliotecă: ${sources.map((s) => s.name).join(', ')}.` : '',
                  dueCount > 0 ? `Există ${dueCount} seturi de grile create — integrează recapitulare SM-2 zilnică.` : '',
                  'Structurează planul zi cu zi. Ultimele 2 zile = recapitulare generală + grile.',
                ].filter(Boolean).join('\n'),
              },
            ],
            temperature: 0.4,
            maxTokens: 1500,
            skipLibraryContext: true,
          });

          plan.reply = planText;

          // Make the plan actionable: generate ONE bounded "kickoff" set so the
          // user can start day 1 immediately (not just read text). Best-effort.
          let starterCreated = false;
          try {
            const primarySource = sources[0];
            let starter: Quiz | null = null;
            if (primarySource) {
              const packRes = await generateQuizPackagesFromSource({
                sourceId: primarySource.id,
                sourceName: primarySource.name,
                folder: null,
                folderId: null,
                packCount: 1,
                questionsPerPack: 8,
                difficulty: 'auto',
                questionType: 'single',
                activeProfileId,
                existingQuizzes: useQuizStore.getState().quizzes,
              });
              starter = packRes.quizzes[0] ?? null;
              if (starter) starter.title = `Start „${examLabel}"`;
            } else if (activeProfileId) {
              const qRes = await generateQuestions({
                context: examLabel,
                count: 8,
                weakTopics: getWeakTopicsForProfile(activeProfileId),
                userProfile: getUserProfile(activeProfileId),
                mode: 'standard',
              });
              if (qRes.questions.length > 0) {
                starter = {
                  id: shortId(),
                  title: `Start „${examLabel}"`,
                  description: 'Set de pornire pentru planul tău de studiu.',
                  emoji: '🚀',
                  color: 'green',
                  category: 'Plan studiu',
                  kind: 'quiz',
                  folderId: null,
                  shuffleQuestions: true,
                  shuffleAnswers: true,
                  tags: ['ai', 'plan'],
                  questions: qRes.questions,
                  createdAt: Date.now(),
                };
              }
            }
            if (starter) {
              const created = starter;
              useQuizStore.getState().addQuiz(created);
              createdQuizIds.push(created.id);
              undoOps.push(() => useQuizStore.getState().deleteQuiz(created.id));
              starterCreated = true;
            }
          } catch {
            // Plan text is the main deliverable — a failed starter set is non-fatal.
          }

          summaryParts.push(starterCreated
            ? `plan ${studyDays} zile + set de pornire pentru „${examLabel}"`
            : `plan ${studyDays} zile pentru „${examLabel}"`);
          callbacks.onStep(index, 'done', starterCreated ? `${studyDays} zile · set de pornire` : `${studyDays} zile · ${hoursPerDay}h/zi`);
          break;
        }

        case 'move_quiz': {
          const quiz = findByName(useQuizStore.getState().quizzes.map((q) => ({ name: q.title, id: q.id })), step.quiz);
          const folder = resolveQuizFolder(step.folder);
          if (!quiz) throw new Error(`Nu am găsit setul „${step.quiz ?? '?'}".`);
          const previous = useQuizStore.getState().quizzes.find((q) => q.id === quiz.id)?.folderId ?? null;
          useQuizStore.getState().moveToFolder(quiz.id, folder?.id ?? null);
          undoOps.push(() => useQuizStore.getState().moveToFolder(quiz.id, previous));
          summaryParts.push(`mutat „${quiz.name}"`);
          callbacks.onStep(index, 'done');
          break;
        }

        case 'rename_quiz': {
          const quiz = findByName(useQuizStore.getState().quizzes.map((q) => ({ name: q.title, id: q.id })), step.quiz);
          if (!quiz || !step.newName) throw new Error(`Nu am putut redenumi „${step.quiz ?? '?'}".`);
          const previous = useQuizStore.getState().quizzes.find((q) => q.id === quiz.id)?.title ?? '';
          useQuizStore.getState().updateQuiz(quiz.id, { title: step.newName });
          undoOps.push(() => useQuizStore.getState().updateQuiz(quiz.id, { title: previous }));
          summaryParts.push(`redenumit „${step.newName}"`);
          callbacks.onStep(index, 'done');
          break;
        }

        case 'delete_quiz': {
          const match = findByName(useQuizStore.getState().quizzes.map((q) => ({ name: q.title, id: q.id })), step.quiz);
          const target = match ? useQuizStore.getState().quizzes.find((q) => q.id === match.id) : undefined;
          if (!target) throw new Error(`Nu am găsit setul „${step.quiz ?? '?'}".`);
          const snapshot: Quiz = target;
          // Keep the flashcard images: this deletion is undoable, and purging
          // them here left an undone deck with all its pictures missing.
          useQuizStore.getState().deleteQuiz(target.id, { keepImages: true });
          undoOps.push(() => useQuizStore.getState().addQuiz(snapshot));
          summaryParts.push(`șters „${target.title}"`);
          callbacks.onStep(index, 'done');
          break;
        }

        case 'rename_folder': {
          const folder = findByName(useFolderStore.getState().folders, step.name);
          if (!folder || !step.newName) throw new Error(`Nu am putut redenumi folderul „${step.name ?? '?'}".`);
          const previous = folder.name;
          useFolderStore.getState().updateFolder(folder.id, { name: step.newName });
          undoOps.push(() => useFolderStore.getState().updateFolder(folder.id, { name: previous }));
          summaryParts.push(`folder redenumit „${step.newName}"`);
          callbacks.onStep(index, 'done');
          break;
        }

        case 'delete_folder': {
          const folder = findByName(useFolderStore.getState().folders, step.name);
          if (!folder) throw new Error(`Nu am găsit folderul „${step.name ?? '?'}".`);
          // Remember where every affected quiz lived. Undo used to call
          // addFolder, which mints a NEW id, so the folder came back empty and
          // the quizzes stayed detached — an unrecoverable loss of structure.
          const affected = useQuizStore.getState().quizzes
            .filter((quiz): quiz is typeof quiz & { folderId: string } => !!quiz.folderId)
            .map((quiz) => ({ id: quiz.id, folderId: quiz.folderId }));
          const removedFolders = useFolderStore.getState().deleteFolder(folder.id);
          const removedIds = new Set(removedFolders.map((entry) => entry.id));
          const detached = affected.filter((entry) => removedIds.has(entry.folderId));

          undoOps.push(() => {
            useFolderStore.getState().restoreFolders(removedFolders);
            detached.forEach((entry) => useQuizStore.getState().moveToFolder(entry.id, entry.folderId));
          });
          summaryParts.push(`folder șters „${folder.name}"`);
          callbacks.onStep(index, 'done');
          break;
        }

        default:
          callbacks.onStep(index, 'skipped');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Pas eșuat.';
      // Surfaced only as a short message in the confirm card otherwise — log the
      // full error (with stack) so a real crash is diagnosable, not just "X failed".
      console.error(`[Agent] step "${step.action}" failed:`, error);
      errors.push(message);
      callbacks.onStep(index, 'error', message);
    }
  }

  const summary = summaryParts.length
    ? `Gata: ${summaryParts.join(', ')}.`
    : 'Nu am putut finaliza nicio acțiune.';

  return {
    summary: errors.length ? `${summary} (${errors.length} pași cu probleme)` : summary,
    createdQuizIds,
    errors,
    undo: undoOps.length ? () => { undoOps.slice().reverse().forEach((op) => { try { op(); } catch { /* ignore */ } }); } : null,
  };
}
