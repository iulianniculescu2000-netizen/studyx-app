import type { Difficulty, Question } from '../types';
import { groqRequest, groqStream } from '../lib/groq';
import { logAIDebug } from './debug';
import { runAIPipeline } from './pipeline';
import {
  buildExplanationPrompt,
  buildHintPrompt,
  buildMnemonicPrompt,
  buildQuestionPrompt,
  buildWrongOptionsPrompt,
} from './prompts';
import { retrieveRelevantChunks } from './retriever';
import type {
  AIAnalysisResult,
  AIContextPayload,
  AINextQuestionState,
  AIQuestionRequest,
  AIQuestionResult,
  AdaptiveDifficultyInput,
  ChunkRecord,
  ExplainWrongOptionsResult,
  HintResult,
  QuestionGenerationResponse,
  RetrievedChunk,
  UserProfileData,
} from './types';
import { loadUserProfile, updateUserProfileAfterAnswer, getWeakTopicsForProfile, generateFromMistakes } from './UserProfile';
import { validateJson } from './validator';

type ContextChunk = ChunkRecord | RetrievedChunk;
export type ChatMode = 'grounded' | 'explain' | 'summarize' | 'diagram' | 'test' | 'mnemonic';

interface ChatResponseOptions {
  mode?: ChatMode;
  hasContext?: boolean;
  scopedSourceName?: string;
  studyContext?: string;
  focusTopics?: string[];
}

async function buildRelevantContext(query: string, limit: number, userProfile?: UserProfileData | null) {
  const chunks = await retrieveRelevantChunks(query, userProfile ?? null, limit);
  return {
    chunks,
    summary: chunks.map((chunk) => `[Sursă: ${chunk.source}]\n${chunk.text}`).join('\n\n'),
  };
}

function uniqueSourceList(chunks: ContextChunk[]) {
  const seen = new Set<string>();
  const sources: string[] = [];

  chunks.forEach((chunk) => {
    const label = `${chunk.source} - ${chunk.topic}`;
    if (seen.has(label)) return;
    seen.add(label);
    sources.push(label);
  });

  return sources;
}

function clampConfidence(value: number | undefined, fallback = 0.72) {
  if (typeof value !== 'number' || Number.isNaN(value)) return fallback;
  return Math.min(1, Math.max(0, value));
}

function normalizeQuestion(question: QuestionGenerationResponse['questions'][number], index: number): Question {
  return {
    id: crypto.randomUUID().replace(/-/g, '').slice(0, 12),
    text: question.text,
    options: question.options.map((option, optionIndex) => ({
      id: `${index}-${optionIndex}-${crypto.randomUUID().replace(/-/g, '').slice(0, 6)}`,
      text: option.text,
      isCorrect: option.isCorrect,
    })),
    explanation: question.explanation,
    tags: question.tags,
    difficulty: (question.difficulty as Difficulty) ?? 'medium',
  };
}

function normalizeAnalysisResult(result: AIAnalysisResult, context: AIContextPayload): AIAnalysisResult {
  const chunks = (context.chunks as ContextChunk[] | undefined) ?? [];
  const fallbackSources = uniqueSourceList(chunks).slice(0, 4);
  const contextScores = chunks
    .map((chunk) => ('score' in chunk ? chunk.score : 0))
    .filter((score) => typeof score === 'number' && Number.isFinite(score));
  const averageScore = contextScores.length > 0
    ? contextScores.reduce((sum, score) => sum + score, 0) / contextScores.length
    : 0.72;

  return {
    ...result,
    confidence: clampConfidence(result.confidence, averageScore),
    rule: result.rule?.trim() || 'Compară mai atent mecanismul-cheie și elimină variantele care nu îl susțin.',
    missingConcept: result.missingConcept?.trim() || context.query,
    recommendedTopic: result.recommendedTopic?.trim() || chunks[0]?.topic || 'Concept de bază',
    relatedConcepts: (result.relatedConcepts ?? []).filter(Boolean).slice(0, 5),
    sources: (result.sources ?? []).filter(Boolean).slice(0, 4).length > 0
      ? (result.sources ?? []).filter(Boolean).slice(0, 4)
      : fallbackSources,
  };
}

export class QuestionGenerator {
  static async generate(profile: UserProfileData | null, request: AIQuestionRequest): Promise<AIQuestionResult> {
    const weakTopics = request.weakTopics ?? (profile ? getWeakTopicsForProfile(profile.profileId) : []);
    const difficulty = request.difficulty ?? profile?.currentDifficulty ?? 'medium';
    const query = request.context || 'Cunoștințe medicale generale';
    let context: AIContextPayload;

    if (request.prefetchedContext) {
      context = {
        ...request.prefetchedContext,
        query: request.prefetchedContext.query || query,
        summary: request.prefetchedContext.summary
          || ((request.prefetchedContext.chunks ?? []).map((chunk) => `[Sursă: ${chunk.source}]\n${chunk.text}`).join('\n\n')),
        weakTopics: request.prefetchedContext.weakTopics ?? weakTopics,
        level: request.prefetchedContext.level ?? difficulty,
      };
    } else {
      const { chunks, summary } = await buildRelevantContext(query, 10);
      context = {
        summary,
        chunks,
        query,
        weakTopics,
        level: difficulty,
      };
    }

    const parsed = await runAIPipeline<QuestionGenerationResponse>({
      retrieve: () => context.summary,
      generate: async () => {
        const prompt = buildQuestionPrompt(profile, weakTopics, difficulty, context);
        return groqRequest({
          task: 'questions',
          messages: [
            { role: 'system', content: prompt },
            { role: 'user', content: `Generează ${request.count ?? 1} întrebări în JSON strict, exclusiv în limba română, pe baza contextului furnizat.` },
          ],
        });
      },
      validate: (raw) => {
        const result = validateJson<QuestionGenerationResponse>(raw);
        return result.ok && result.value?.questions?.length ? result.value : null;
      },
      fix: async (_raw, error) => (
        groqRequest({
          task: 'questions',
          messages: [
            { role: 'system', content: 'Repară JSON-ul și returnează doar JSON valid, fără trailing commas și fără text suplimentar. Păstrează conținutul în română.' },
            { role: 'user', content: `JSON-ul anterior a fost invalid: ${error}` },
          ],
        })
      ),
    });

    return {
      questions: parsed.questions.map(normalizeQuestion),
      sources: uniqueSourceList((context.chunks as ContextChunk[] | undefined) ?? []),
      mode: request.mode ?? 'standard',
    };
  }
}

export class WeaknessAnalyzer {
  static getWeakTopics(profileId: string) {
    return getWeakTopicsForProfile(profileId);
  }
}

export class AdaptiveDifficulty {
  static getAdaptiveDifficulty({ accuracy, streak, time }: AdaptiveDifficultyInput): 'easy' | 'medium' | 'hard' {
    let score = 0;
    if (accuracy >= 80) score += 2;
    else if (accuracy < 50) score -= 2;
    if (streak >= 7) score += 2;
    else if (streak >= 3) score += 1;
    if (typeof time === 'number' && time < 20) score -= 1;
    if (score >= 2) return 'hard';
    if (score <= -1) return 'easy';
    return 'medium';
  }
}

export class LearningStrategist {
  static getNextQuestion(state: AINextQuestionState) {
    const nextTopic = state.weakTopics[0]?.topic ?? state.recentMistakes[0]?.topic ?? 'Topic general';
    const difficulty = AdaptiveDifficulty.getAdaptiveDifficulty({
      accuracy: state.accuracy,
      streak: state.streak,
      time: state.availableTime,
    });

    return { topic: nextTopic, difficulty };
  }
}

export async function analyzeAnswer(
  profileId: string,
  payload: { question: Question; userAnswer: string; correctAnswer: string; isCorrect: boolean },
) {
  const query = `${payload.question.text} ${payload.correctAnswer}`;
  const profile = loadUserProfile(profileId);
  const { chunks, summary } = await buildRelevantContext(query, 5, profile);

  const context: AIContextPayload = {
    summary,
    chunks,
    query,
    level: payload.question.difficulty,
  };

  const rawAnalysis = await runAIPipeline<AIAnalysisResult>({
    retrieve: () => context.summary,
    generate: async () => (
      groqRequest({
        task: 'explanation',
        messages: [
          { role: 'system', content: buildExplanationPrompt(payload.userAnswer, payload.correctAnswer, payload.question, context) },
          { role: 'user', content: 'Analizează răspunsul și returnează JSON-ul solicitat, exclusiv în limba română.' },
        ],
      })
    ),
    validate: (raw) => {
      const result = validateJson<AIAnalysisResult>(raw);
      return result.ok && result.value?.explanation ? result.value : null;
    },
    fix: async (_raw, error) => (
      groqRequest({
        task: 'explanation',
        messages: [
          { role: 'system', content: 'Repară JSON-ul invalid și păstrează exact aceeași schemă. Nu adăuga text în afara JSON-ului. Păstrează valorile în română.' },
          { role: 'user', content: `JSON invalid: ${error}` },
        ],
      })
    ),
  });

  const analysis = normalizeAnalysisResult(rawAnalysis, context);
  const nextProfile = updateUserProfileAfterAnswer(profileId, { ...payload, analysis });
  return { analysis, profile: nextProfile };
}

export async function generateQuestions(request: AIQuestionRequest) {
  const profile = request.userProfile ?? null;
  return QuestionGenerator.generate(profile, request);
}

export function getNextQuestion(state: AINextQuestionState) {
  return LearningStrategist.getNextQuestion(state);
}

export async function generateHint(question: Question) {
  const query = question.text;
  const { chunks, summary } = await buildRelevantContext(query, 4);

  const context: AIContextPayload = {
    summary,
    query,
    chunks,
    level: question.difficulty,
  };

  return runAIPipeline<HintResult>({
    retrieve: () => context.summary,
    generate: () => (
      groqRequest({
        task: 'hint',
        messages: [
          { role: 'system', content: buildHintPrompt(question, context) },
          { role: 'user', content: 'Returnează indicii progresive în JSON, integral în română.' },
        ],
      })
    ),
    validate: (raw) => {
      const result = validateJson<HintResult>(raw);
      return result.ok && result.value?.full ? result.value : null;
    },
  });
}

export async function generateMnemonicForConcept(concept: string, correctAnswer: string) {
  const query = `${concept} ${correctAnswer}`;
  const { chunks, summary } = await buildRelevantContext(query, 3);

  const context: AIContextPayload = {
    summary,
    query,
    chunks,
  };

  const raw = await groqRequest({
    task: 'mnemonic',
    messages: [
      { role: 'system', content: buildMnemonicPrompt(concept, context) },
      { role: 'user', content: `Creează un mnemonic creativ în JSON, integral în română, pentru a reține răspunsul "${correctAnswer}" la conceptul "${concept}".` },
    ],
  });

  const parsed = validateJson<{ mnemonic: string }>(raw);
  return parsed.value?.mnemonic ?? '';
}

export async function explainWrongOptions(question: Question) {
  const { chunks, summary } = await buildRelevantContext(question.text, 4);

  const context: AIContextPayload = {
    summary,
    query: question.text,
    chunks,
    level: question.difficulty,
  };

  const raw = await groqRequest({
    task: 'explanation',
    messages: [
      { role: 'system', content: buildWrongOptionsPrompt(question, context) },
      { role: 'user', content: 'Analizează opțiunile și returnează JSON, integral în română.' },
    ],
  });

  const parsed = validateJson<ExplainWrongOptionsResult>(raw);
  return parsed.value?.options ?? [];
}

export class AITutorSession {
  static build(profileId: string) {
    const profile = loadUserProfile(profileId);
    const weakTopics = getWeakTopicsForProfile(profileId);
    return {
      currentTopic: weakTopics[0]?.topic ?? 'Topic general',
      difficulty: profile.currentDifficulty,
      progress: 0,
      questionIds: profile.recentQuestions,
    };
  }
}

export class ExamSimulator {
  static async generate(profileId: string, context: string) {
    const profile = loadUserProfile(profileId);
    return generateQuestions({
      context,
      count: 10,
      difficulty: 'hard',
      weakTopics: getWeakTopicsForProfile(profileId),
      userProfile: { ...profile, examModeEnabled: true },
      mode: 'exam',
    });
  }
}

export function getAdaptiveDifficulty(input: AdaptiveDifficultyInput) {
  return AdaptiveDifficulty.getAdaptiveDifficulty(input);
}

function deepCleanText(text: string): string {
  if (!text) return '';
  // eslint-disable-next-line no-control-regex
  const controlCharsRe = new RegExp('[\\x00-\\x08\\x0B\\x0C\\x0E-\\x1F\\x7F-\\x9F]', 'g');
  return text
    .replace(controlCharsRe, '')
    .replace(/\s+/g, ' ')
    .trim();
}

logAIDebug('AIEngine:init', 'inițializat');

function buildChatSystemPrompt(contextSummary: string, options: ChatResponseOptions) {
  const mode = options.mode ?? 'grounded';
  const hasContext = options.hasContext ?? Boolean(contextSummary.trim());
  const studyContext = deepCleanText(options.studyContext ?? '');
  const focusTopics = (options.focusTopics ?? []).map((topic) => deepCleanText(topic)).filter(Boolean);

  const modeInstructions: Record<ChatMode, string[]> = {
    grounded: [
      'Rol: bibliotecar clinic. Pleacă din fragmentele găsite, apoi conectează cu noțiuni medicale stabile doar când este necesar.',
      'Extrage ce pare important pentru examen: definiții, criterii, mecanisme, diferențiale, complicații, tratamente și capcane recurente.',
      'Dacă vezi detalii foarte rare, istorice sau decorative, marchează-le ca probabilitate mică, fără să promiți că profesorul nu le va cere.',
    ],
    explain: [
      'Rol: profesor care face lucrurile să se lege. Explică în pași: definiție -> mecanism -> clinic/paraclinic -> capcană -> regulă scurtă.',
      'Pentru grile, nu spune "studentul a ales". Scrie direct: "C este răspunsul corect deoarece..." și apoi explică de ce celelalte variante cad.',
      'Pentru variante greșite, spune și în ce context ar fi putut deveni corecte, dacă există un astfel de context.',
    ],
    summarize: [
      'Rol: editor de curs pentru examen. Comprimă agresiv fără să pierzi mecanismele.',
      'Folosește segmentele: "Foarte probabil", "Posibil", "Puțin probabil", "Capcane", "Regula de 30 secunde".',
      'Pune accent pe ce ar transforma profesorul ușor într-o grilă: diferențe, excepții, indicații, contraindicații, triade, criterii.',
    ],
    diagram: [
      'Rol: arhitect de scheme. Transformă conținutul în structură vizuală textuală, nu în eseu.',
      'Când există mecanism, folosește lanțuri cu săgeți: cauză -> proces -> manifestare -> consecință -> capcană.',
      'Când există diferențial, folosește tabel compact. Când există conduită, folosește algoritm pas-cu-pas.',
      'După schemă, adaugă 3-5 "noduri de examen" care sunt cele mai probabile de întrebat.',
    ],
    test: [
      'Rol: examinator. Creează întrebări care verifică mecanismul, diferențialul și capcana, nu doar definiții.',
      'Nu da răspunsurile imediat decât dacă utilizatorul cere explicit; când le dai, explică varianta corectă și de ce distractorii sunt plauzibili dar greșiți.',
      'Adaptează dificultatea la topicurile vulnerabile dacă apar în profil.',
    ],
    mnemonic: [
      'Rol: coach de memorie medicală. Creează 2-3 mnemonice scurte, memorabile și corecte medical.',
      'Leagă mnemonic-ul de mecanism sau diferențial, nu doar de primele litere.',
      'Spune pe scurt când se folosește și ce confuzie previne.',
    ],
  };

  return [
    'Ești asistentul medical virtual premium din StudyX: empatic, clar, organizat și riguros.',
    '',
    'STIL:',
    '- răspunde exclusiv în limba română',
    '- folosește paragrafe scurte și liste doar când clarifică; evită blocuri dense de text',
    '- dacă utilizatorul cere ceva practic, oferă pași concreți numerotați',
    '- folosește formatare curată: titluri scurte cu emoji relevant (ex: 🔑 Mecanism, ⚠️ Capcană, 📋 Regulă), bullets cu liniuță sau săgeți, enumerări clare',
    '- evită steluțele markdown (* **) vizibile — folosește titluri cu emoji în loc',
    '- când o schemă, un algoritm sau un tabel ar scurta înțelegerea cu 50%+, include-l fără să aștepți să fie cerut explicit',
    '- dimensiunea răspunsului trebuie să fie proporțională cu complexitatea întrebării: simplu → scurt și direct, complex → structurat și complet',
    '',
    'INTELIGENȚĂ DE EXAMEN:',
    '- estimează probabilitatea de întrebare pe baza structurii cursului: definiții, clasificări, criterii, diferențiale, indicații, complicații și excepții sunt de obicei mai testabile',
    '- marchează transparent: "foarte probabil", "posibil", "puțin probabil"; nu afirma niciodată că ceva sigur nu se cere',
    '- când spui că ceva e puțin probabil, explică de ce: prea rar, prea granular, fără valoare diferențială, detaliu istoric sau neancorat în context',
    '- pentru grile cu variante, formulează direct răspunsul: "C este răspunsul corect deoarece..."; apoi explică A/B/D: de ce sunt greșite și când ar fi devenit corecte',
    '- folosește biblioteca drept memorie principală, dar completează cu cunoștințe medicale generale stabile când contextul e incomplet',
    '',
    'REGULI DE GROUNDING:',
    '- prioritizează contextul extras din biblioteca utilizatorului când este relevant',
    '- nu inventa surse, citate, ghiduri, scoruri sau detalii din documente',
    '- dacă biblioteca nu oferă destul context, spune explicit asta și separă ce urmează ca explicație medicală generală',
    ...(options.scopedSourceName ? [`- document țintă curent: ${options.scopedSourceName}`] : []),
    ...(focusTopics.length > 0 ? [`- topicuri vulnerabile de urmărit: ${focusTopics.join(', ')}`] : []),
    '',
    `MOD ACTIV: ${mode.toUpperCase()}`,
    ...modeInstructions[mode],
    '',
    studyContext ? `PROFIL DE STUDIU ȘI ADAPTARE:\n${studyContext}\n` : '',
    hasContext
      ? `CONTEXT DIN BIBLIOTECA UTILIZATORULUI:\n${deepCleanText(contextSummary)}`
      : 'NU EXISTĂ CONTEXT SPECIFIC DIN BIBLIOTECA UTILIZATORULUI PENTRU ACEASTĂ ÎNTREBARE.',
  ].join('\n');
}

export async function generateChatResponse(
  message: string,
  contextSummary: string,
  history: { role: 'user' | 'assistant'; content: string }[] = [],
  options: ChatResponseOptions = {},
): Promise<string> {
  const systemPrompt = buildChatSystemPrompt(contextSummary, options);
  const recentHistory = history.slice(-10);

  return groqRequest({
    task: 'chat',
    messages: [
      { role: 'system', content: systemPrompt },
      ...recentHistory,
      { role: 'user', content: message },
    ],
    skipLibraryContext: true,
  });
}

export async function generateChatResponseStream(
  message: string,
  contextSummary: string,
  history: { role: 'user' | 'assistant'; content: string }[] = [],
  onChunk: (text: string) => void,
  options: ChatResponseOptions = {},
  abortSignal?: AbortSignal,
): Promise<void> {
  const systemPrompt = buildChatSystemPrompt(contextSummary, options);
  const recentHistory = history.slice(-10);

  await groqStream(
    [
      { role: 'system', content: systemPrompt },
      ...recentHistory,
      { role: 'user', content: message },
    ],
    onChunk,
    0.5,
    abortSignal,
    true, // context already injected via systemPrompt — skip internal library search
  );
}

export function getUserProfile(profileId: string) {
  return loadUserProfile(profileId);
}

export function generateFromMistakeBank(profileId: string) {
  return generateFromMistakes(profileId);
}
