/**
 * Conversational agent for StudyX.
 *
 * Turns a natural-language command ("creează folderul Dermato și fă-mi 50 de grile
 * din cursul de micoze acolo") into a validated plan of concrete actions, then
 * executes them against the app stores — creating folders, generating quiz packs,
 * organizing the library, etc. The LLM only *plans*; execution is deterministic
 * local code, so there is no risk of the model "hallucinating" a destructive op.
 */
import { groqRequest } from '../groq';
import { generateQuizPackagesFromSource } from './batchQuizGeneration';
import { clampStudioPackCount, clampStudioQuestionCount } from './studioGeneration';
import { useQuizStore } from '../../store/quizStore';
import { useFolderStore } from '../../store/folderStore';
import { useAIStore } from '../../store/aiStore';
import { useUserStore } from '../../store/userStore';
import type { Difficulty, Folder, Quiz, QuizColor } from '../../types';

export type AgentActionType =
  | 'create_folder'
  | 'create_library_folder'
  | 'generate_quiz_pack'
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
const FOLDER_PALETTE: QuizColor[] = ['purple', 'blue', 'teal', 'green', 'pink', 'orange', 'red'];

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

const COMMAND_HINTS = /\b(cre(e|ea)z|creaz|adaug|genere|fa(-| )?mi|fa(ce)?|mut(a|ă)|redenume|sterg|șterg|organiz|pune|baga|bag(ă)?|fol?der|subfolder|grile|grila|set(ul|uri)?|pachet|atlas|biblioteca)\b/i;

/** Cheap pre-filter so normal chat questions never pay for a planning round-trip. */
export function looksLikeAgentCommand(text: string): boolean {
  const value = text.trim();
  if (value.length < 4) return false;
  if (value.endsWith('?') && !COMMAND_HINTS.test(value)) return false;
  return COMMAND_HINTS.test(value);
}

function extractJsonObject(raw: string): string | null {
  const stripped = raw.replace(/```(?:json)?/gi, '').replace(/```/g, '');
  const start = stripped.indexOf('{');
  const end = stripped.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  return stripped.slice(start, end + 1);
}

function buildPlannerPrompt() {
  const { knowledgeSources, libraryFolders } = useAIStore.getState();
  const folders = useFolderStore.getState().folders;
  const quizzes = useQuizStore.getState().quizzes;

  const sources = knowledgeSources.filter((s) => s.indexStatus === 'ready').slice(0, 40).map((s) => s.name);
  const quizFolderNames = folders.slice(0, 60).map((f) => f.name);
  const libFolderNames = libraryFolders.slice(0, 60).map((f) => f.name);
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
    '- create_library_folder: {"action":"create_library_folder","name":"Nume"}  // folder pt cursuri în Bibliotecă',
    '- generate_quiz_pack: {"action":"generate_quiz_pack","source":"nume curs din bibliotecă","folder":"nume folder destinatie (optional)","packCount":N,"questionsPerPack":N,"difficulty":"auto|easy|medium|hard"}',
    '- create_study_plan: {"action":"create_study_plan","examName":"Numele examenului","studyDays":N,"hoursPerDay":N}  // plan de studiu personalizat bazat pe biblioteca curentă și SM-2',
    '- move_quiz: {"action":"move_quiz","quiz":"titlu set","folder":"nume folder"}',
    '- rename_quiz: {"action":"rename_quiz","quiz":"titlu actual","newName":"titlu nou"}',
    '- delete_quiz: {"action":"delete_quiz","quiz":"titlu set"}',
    '- rename_folder: {"action":"rename_folder","name":"nume actual","newName":"nume nou"}',
    '- delete_folder: {"action":"delete_folder","name":"nume folder"}',
    '',
    'Reguli:',
    '- Dacă userul cere generare într-un folder care nu există, adaugă întâi un pas create_folder, apoi generate_quiz_pack cu același "folder".',
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
    'create_folder', 'create_library_folder', 'generate_quiz_pack', 'create_study_plan',
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
    difficulty: (['auto', 'easy', 'medium', 'hard'].includes(diff ?? '') ? diff : undefined) as AgentStep['difficulty'],
    examName: str('examName') ?? str('exam'),
    studyDays: num('studyDays') ?? num('days'),
    hoursPerDay: num('hoursPerDay') ?? num('hours'),
  };
}

export async function planAgentCommand(command: string): Promise<AgentPlan> {
  const system = buildPlannerPrompt();
  const raw = await groqRequest({
    task: 'analysis',
    messages: [
      { role: 'system', content: system },
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

  const isCommand = Boolean(parsed.isCommand) && steps.length > 0;

  const totalQuestions = steps
    .filter((step) => step.action === 'generate_quiz_pack')
    .reduce((sum, step) => sum + (step.packCount ?? 1) * (step.questionsPerPack ?? 10), 0);
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
      return `Creez folderul de bibliotecă „${step.name}"`;
    case 'generate_quiz_pack': {
      const packs = clampStudioPackCount(step.packCount ?? 1);
      const perPack = clampStudioQuestionCount(step.questionsPerPack ?? 10);
      const dest = step.folder ? ` în „${step.folder}"` : '';
      return `Generez ${packs}×${perPack} grile din „${step.source}"${dest}`;
    }
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
          const color = FOLDER_PALETTE[useFolderStore.getState().folders.length % FOLDER_PALETTE.length];
          const id = folderStore.addFolder(step.name, parent ? '📁' : '📚', color, parent?.id ?? null);
          const folder: Folder = { id, name: step.name, emoji: parent ? '📁' : '📚', color, parentId: parent?.id ?? null, createdAt: Date.now() };
          createdFolderByName.set(normalizeName(step.name), folder);
          undoOps.push(() => useFolderStore.getState().deleteFolder(id));
          summaryParts.push(`folder „${step.name}"`);
          callbacks.onStep(index, 'done');
          break;
        }

        case 'create_library_folder': {
          if (!step.name) throw new Error('Lipsește numele folderului.');
          const id = aiStore.addLibraryFolder(step.name);
          undoOps.push(() => useAIStore.getState().deleteLibraryFolder(id));
          summaryParts.push(`folder bibliotecă „${step.name}"`);
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
            activeProfileId,
            existingQuizzes: useQuizStore.getState().quizzes,
          });

          result.quizzes.forEach((quiz) => {
            useQuizStore.getState().addQuiz(quiz);
            createdQuizIds.push(quiz.id);
            undoOps.push(() => useQuizStore.getState().deleteQuiz(quiz.id));
          });
          summaryParts.push(`${result.quizzes.length} seturi din „${source.name}"`);
          callbacks.onStep(index, 'done', `${result.quizzes.length} seturi`);
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

          summaryParts.push(`plan ${studyDays} zile pentru „${examLabel}"`);
          callbacks.onStep(index, 'done', `${studyDays} zile · ${hoursPerDay}h/zi`);
          // Store the plan text as the step detail so AgentJobCard can surface it.
          plan.reply = planText;
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
