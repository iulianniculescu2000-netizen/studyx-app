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
import { getVaultChunksBySource } from '../../ai/vectorStore';
import { generateQuestions, getUserProfile } from '../../ai/AIEngine';
import { generateFromMistakes, getWeakTopicsForProfile } from '../../ai/UserProfile';
import { useQuizStore } from '../../store/quizStore';
import { useFolderStore } from '../../store/folderStore';
import { useAIStore } from '../../store/aiStore';
import { useUserStore } from '../../store/userStore';
import { suggestFolderAppearance } from '../folderAppearance';
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

export type AgentActionType =
  | 'create_folder'
  | 'create_library_folder'
  | 'generate_quiz_pack'
  | 'generate_from_mistakes'
  | 'create_flashcards'
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
  folder?: string;
  quiz?: string;
  packCount?: number;
  questionsPerPack?: number;
  /** For create_flashcards: number of cards to generate. */
  count?: number;
  /** For generate_quiz_pack: single-answer (complement simplu) vs multi-answer. */
  questionType?: 'single' | 'multiple';
  difficulty?: 'auto' | 'easy' | 'medium' | 'hard';
  /** For create_study_plan: exam name, number of study days, hours per day. */
  examName?: string;
  studyDays?: number;
  hoursPerDay?: number;
}

export interface AgentPlan {
  isCommand: boolean;
  reply: string;
  steps: AgentStep[];
  needsConfirm: boolean;
  confirmReason?: string;
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

const COMMAND_HINTS = /\b(cre(e|ea)z|creaz|adaug|genere|fa(-| )?mi|fa(ce)?|mut(a|ă)|redenume|sterg|șterg|organiz|pune|baga|bag(ă)?|fol?der|subfolder|grile|grila|set(ul|uri)?|pachet|atlas|biblioteca|gre(ș|s)el|gre(ș|s)esc|recapitul)\b/i;

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

function buildPlannerPrompt() {
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
    '{"isCommand": true|false, "reply": "confirmare scurtă în română", "steps": [ ...pași... ]}',
    '',
    'Dacă mesajul NU e o comandă de acțiune (ci o întrebare normală), pune "isCommand": false și "steps": [].',
    '',
    'Acțiuni disponibile (folosește exact aceste nume):',
    '- create_folder: {"action":"create_folder","name":"Nume","parent":"NumeFolderParinte (optional, pt subfolder)"}',
    '- create_library_folder: {"action":"create_library_folder","name":"Nume","parent":"NumeFolderParinte (optional, pt subfolder de bibliotecă)"}  // folder pt cursuri în Bibliotecă',
    '- generate_quiz_pack: {"action":"generate_quiz_pack","source":"nume curs din bibliotecă","folder":"nume folder destinatie (optional)","packCount":N,"questionsPerPack":N,"questionType":"single|multiple","difficulty":"auto|easy|medium|hard"}',
    '- generate_from_mistakes: {"action":"generate_from_mistakes","count":N,"folder":"nume folder destinatie (optional)","questionType":"single|multiple"}  // grile de recapitulare țintite pe greșelile salvate ale studentului (NU are nevoie de sursă)',
    '- create_flashcards: {"action":"create_flashcards","source":"nume curs din bibliotecă","folder":"nume folder destinatie (optional)","count":N}  // deck de flashcarduri (active recall) dintr-un curs',
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
    '- "flashcard"/"flashcarduri"/"carduri"/"fișe" cerute explicit → create_flashcards cu "count" = numărul cerut (implicit 15). NU confunda cu grile.',
    '- "greșeli"/"greșesc"/"unde greșesc"/"recapitulare greșeli"/"din ce am greșit" → generate_from_mistakes (NU cere sursă; folosește banca de greșeli).',
    '- "rezumă"/"rezumat"/"sinteză" pentru un curs din bibliotecă → summarize_document.',
    '- "complement multiplu"/"răspunsuri multiple"/"mai multe răspunsuri corecte" → questionType:"multiple". "complement simplu"/"un singur răspuns" → questionType:"single". Implicit "single".',
    '- "grilă"/"grile"/"întrebări"/"întrebare" = NUMĂRUL DE ÎNTREBĂRI (questionsPerPack). "set"/"seturi"/"pachet"/"pachete" = NUMĂRUL DE PACHETE (packCount).',
    '- IMPLICIT packCount = 1. Pune packCount > 1 DOAR dacă userul cere explicit mai multe "seturi"/"pachete", SAU dacă numărul de întrebări depășește 60 (abia atunci împarte în pachete de maxim 60 fiecare).',
    '- NU inventa numere și NU exagera. Exemple: "2 grile" → packCount:1, questionsPerPack:2. "10 întrebări" → packCount:1, questionsPerPack:10. "3 seturi a câte 20" → packCount:3, questionsPerPack:20. "150 de grile" → packCount:3, questionsPerPack:50.',
    '- Atenție: un număr lângă numele cursului (ex. "Cursul 2") NU e un număr de grile, e parte din numele cursului.',
    '- Folosește DOAR cursuri care există în bibliotecă (lista de mai jos). Dacă nu identifici cursul, pune isCommand:false și explică în reply ce lipsește.',
    '',
    `Cursuri în bibliotecă: ${sources.length ? sources.join(' | ') : '(niciunul)'}`,
    `Foldere grile: ${quizFolderNames.length ? quizFolderNames.join(' | ') : '(niciunul)'}`,
    `Foldere bibliotecă: ${libFolderNames.length ? libFolderNames.join(' | ') : '(niciunul)'}`,
    `Seturi existente: ${quizTitles.length ? quizTitles.join(' | ') : '(niciunul)'}`,
  ].join('\n');
}

function normalizeStep(raw: Record<string, unknown>): AgentStep | null {
  const action = String(raw.action ?? '') as AgentActionType;
  const valid: AgentActionType[] = [
    'create_folder', 'create_library_folder', 'generate_quiz_pack', 'generate_from_mistakes',
    'create_flashcards', 'summarize_document', 'create_study_plan',
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
    folder: str('folder'),
    quiz: str('quiz'),
    packCount: num('packCount') ?? num('packcount'),
    questionsPerPack: num('questionsPerPack') ?? num('questions') ?? num('questionsperpack'),
    count: num('count') ?? num('cards') ?? num('cardCount'),
    questionType: (['single', 'multiple'].includes(str('questionType') ?? str('question_type') ?? '') ? (str('questionType') ?? str('question_type')) : undefined) as AgentStep['questionType'],
    difficulty: (['auto', 'easy', 'medium', 'hard'].includes(diff ?? '') ? diff : undefined) as AgentStep['difficulty'],
    examName: str('examName') ?? str('exam'),
    studyDays: num('studyDays') ?? num('days'),
    hoursPerDay: num('hoursPerDay') ?? num('hours'),
  };
}

export async function planAgentCommand(
  command: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }> = [],
): Promise<AgentPlan> {
  const system = buildPlannerPrompt();
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

  let parsed: { isCommand?: boolean; reply?: string; steps?: unknown };
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
  const intent = extractQuizIntent(command);
  if (intent.packCount || intent.questionsPerPack || intent.questionType) {
    for (const step of steps) {
      if (step.action === 'generate_from_mistakes') {
        if (intent.questionsPerPack !== undefined) step.count = intent.questionsPerPack;
        if (intent.questionType !== undefined) step.questionType = intent.questionType;
        continue;
      }
      if (step.action !== 'generate_quiz_pack') continue;
      if (intent.questionsPerPack !== undefined) step.questionsPerPack = intent.questionsPerPack;
      if (intent.packCount !== undefined) step.packCount = intent.packCount;
      if (intent.questionType !== undefined) step.questionType = intent.questionType;
    }
  }

  const isCommand = Boolean(parsed.isCommand) && steps.length > 0;

  const totalQuestions = steps
    .reduce((sum, step) => {
      if (step.action === 'generate_quiz_pack') return sum + (step.packCount ?? 1) * (step.questionsPerPack ?? 10);
      if (step.action === 'create_flashcards') return sum + (step.count ?? 15);
      if (step.action === 'generate_from_mistakes') return sum + (step.count ?? 10);
      return sum;
    }, 0);
  const hasDestructive = steps.some((step) => DESTRUCTIVE_ACTIONS.includes(step.action));
  const needsConfirm = isCommand && (hasDestructive || totalQuestions > QUESTION_CONFIRM_THRESHOLD);
  const confirmReason = hasDestructive
    ? 'Comanda include ștergeri.'
    : totalQuestions > QUESTION_CONFIRM_THRESHOLD
      ? `Generare mare (~${totalQuestions} întrebări) — poate dura.`
      : undefined;

  return {
    isCommand,
    reply: typeof parsed.reply === 'string' ? parsed.reply : '',
    steps,
    needsConfirm,
    confirmReason,
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
          const folder = resolveQuizFolder(step.folder);
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
          summaryParts.push(`${result.quizzes.length} seturi din „${source.name}"`);
          callbacks.onStep(
            index,
            mostlyFallback ? 'error' : 'done',
            mostlyFallback ? `${result.quizzes.length} seturi (rezervă locală — verifică cheia AI)` : `${result.quizzes.length} seturi`,
          );
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

          const folder = resolveQuizFolder(step.folder);
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

          const folder = resolveQuizFolder(step.folder);
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
          useQuizStore.getState().deleteQuiz(target.id);
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
          const snapshot = folder;
          useFolderStore.getState().deleteFolder(folder.id);
          undoOps.push(() => {
            useFolderStore.getState().addFolder(snapshot.name, snapshot.emoji, snapshot.color, snapshot.parentId ?? null);
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
