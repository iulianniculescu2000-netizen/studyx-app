import type { Question, Difficulty } from '../types';
import { logAIDebug } from './debug';
import { runAIPipeline } from './pipeline';
import { buildExplanationPrompt, buildHintPrompt, buildMnemonicPrompt, buildQuestionPrompt, buildWrongOptionsPrompt } from './prompts';
import { loadUserProfile, updateUserProfileAfterAnswer, getWeakTopicsForProfile, generateFromMistakes } from './UserProfile';
import { validateJson } from './validator';
import { retrieveRelevantChunks } from './retriever';
import type {
  AIAnalysisResult,
  AIContextPayload,
  AINextQuestionState,
  AIQuestionRequest,
  AIQuestionResult,
  AdaptiveDifficultyInput,
  ExplainWrongOptionsResult,
  HintResult,
  QuestionGenerationResponse,
  UserProfileData,
  ChunkRecord,
  RetrievedChunk
} from './types';
import { groqRequest } from '../lib/groq';

async function buildRelevantContext(query: string, k: number) {
  const chunks = await retrieveRelevantChunks(query, null, k);
  return {
    chunks,
    summary: chunks.map((chunk) => `[Sursă: ${chunk.source}]\n${chunk.text}`).join('\n\n'),
  };
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

export class QuestionGenerator {
  static async generate(profile: UserProfileData | null, request: AIQuestionRequest): Promise<AIQuestionResult> {
    const weakTopics = request.weakTopics ?? (profile ? getWeakTopicsForProfile(profile.profileId) : []);
    const difficulty = request.difficulty ?? profile?.currentDifficulty ?? 'medium';
    
    // RAG: Find the most relevant chunks from the vault for the generation request
    const { chunks: vaultResults, summary: contextSummary } = await buildRelevantContext(request.context || 'General medical knowledge', 10);
    
    const context: AIContextPayload = {
      summary: contextSummary,
      chunks: vaultResults,
      query: request.context || 'General medical knowledge',
      weakTopics,
      level: difficulty
    };

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
      fix: async (_raw, error) =>
        groqRequest({
          task: 'questions',
          messages: [
            { role: 'system', content: 'Repara JSON-ul. Returneaza doar JSON valid, fara trailing commas si fara text suplimentar. Pastreaza continutul in romana.' },
            { role: 'user', content: `JSON-ul anterior a fost invalid: ${error}` },
          ],
        }),
    });

    return {
      questions: parsed.questions.map(normalizeQuestion),
      sources: (context.chunks as (ChunkRecord | RetrievedChunk)[] | undefined)?.map((chunk) => `${chunk.source} - ${chunk.topic}`) ?? [],
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
  payload: { question: Question; userAnswer: string; correctAnswer: string; isCorrect: boolean }
) {
  // Use RAG to find relevant knowledge for the specific question/answer
  const query = `${payload.question.text} ${payload.correctAnswer}`;
  const { chunks: vaultResults, summary: contextSummary } = await buildRelevantContext(query, 5);

  const context: AIContextPayload = {
    summary: contextSummary,
    chunks: vaultResults,
    query,
    level: payload.question.difficulty
  };

  const analysis = await runAIPipeline<AIAnalysisResult>({
    retrieve: () => context.summary,
    generate: async () =>
      groqRequest({
        task: 'explanation',
        messages: [
          { role: 'system', content: buildExplanationPrompt(payload.userAnswer, payload.correctAnswer, payload.question, context) },
          { role: 'user', content: 'Analizează răspunsul și returnează JSON-ul solicitat, exclusiv în limba română.' },
        ],
      }),
    validate: (raw) => {
      const result = validateJson<AIAnalysisResult>(raw);
      return result.ok && result.value?.explanation ? result.value : null;
    },
      fix: async (_raw, error) =>
        groqRequest({
          task: 'explanation',
          messages: [
            { role: 'system', content: 'Repara JSON-ul invalid si pastreaza exact aceeasi schema. Nu adauga text in afara JSON-ului. Pastreaza valorile in romana.' },
            { role: 'user', content: `JSON invalid: ${error}` },
          ],
        }),
  });

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
  const { chunks: vaultResults, summary: contextSummary } = await buildRelevantContext(query, 4);
  
  const context: AIContextPayload = { 
    summary: contextSummary, 
    query,
    chunks: vaultResults,
    level: question.difficulty
  };

  return runAIPipeline<HintResult>({
    retrieve: () => context.summary,
    generate: () =>
      groqRequest({
        task: 'hint',
        messages: [
          { role: 'system', content: buildHintPrompt(question, context) },
          { role: 'user', content: 'Returnează indicii progresive în JSON, integral în română.' },
        ],
      }),
    validate: (raw) => {
      const result = validateJson<HintResult>(raw);
      return result.ok && result.value?.full ? result.value : null;
    },
  });
}

export async function generateMnemonicForConcept(concept: string, correctAnswer: string) {
  const query = `${concept} ${correctAnswer}`;
  const { chunks: vaultResults, summary: contextSummary } = await buildRelevantContext(query, 3);
  const context: AIContextPayload = { 
    summary: contextSummary, 
    query,
    chunks: vaultResults
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
  const { chunks: vaultResults, summary: contextSummary } = await buildRelevantContext(question.text, 4);
  const context: AIContextPayload = { 
    summary: contextSummary, 
    query: question.text,
    chunks: vaultResults,
    level: question.difficulty
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
  if (!text) return "";
  // regex avoids control characters properly
  // eslint-disable-next-line no-control-regex
  const controlCharsRe = new RegExp('[\\x00-\\x08\\x0B\\x0C\\x0E-\\x1F\\x7F-\\x9F]', 'g');
  return text
    .replace(controlCharsRe, "")
    .replace(/\s+/g, " ")
    .trim();
}

logAIDebug('AIEngine:init', 'initializat');

export async function generateChatResponse(
  message: string, 
  contextSummary: string, 
  history: { role: 'user' | 'assistant'; content: string }[] = []
): Promise<string> {
  const systemPrompt = [
    'Esti asistentul medical virtual premium din StudyX - un AI empatic, inteligent si foarte bine organizat. 🧠',
    '',
    '🎯 **STILUL TAU DE RASPUNS:**',
    '• Raspunde intotdeauna in limba romana, clar, structurat si prietenos',
    '• Foloseste emoji-uri relevante pentru a face conversatia mai placuta (📚, 🧠, 💡, ✅, ❌, ⚡, 🎯, 📝, 🏥)',
    '• Structureaza raspunsurile cu spatii entre paragrafe pentru lizibilitate',
    '• Pentru concepte complexe, foloseste o abordare metodică in pași:',
    '  A) **Ce a cerut utilizatorul** - reformulează cererea',
    '  B) **Analiza conceptelor** - descompune informația logic',
    '  C) **Explicație pas cu pas** - dezvoltă raționamentul',
    '  D) **Concluzie/Aplicație practică** - leagă de context clinic',
    '',
    '📚 **CONTEXTUL BIBLIOTECII:**',
    '• Prioritizeaza contextul extras din biblioteca utilizatorului atunci cand este relevant',
    '• Cand contextul contine surse, mentioneaza pe scurt sursa sau documentul relevant',
    '• Daca raspunsul depaseste contextul disponibil, spune explicit ca acea parte se bazeaza pe cunostinte medicale generale',
    '• Nu inventa citate, ghiduri sau surse inexistente',
    '',
    '💡 **FORMATARE:**',
    '• Foloseste **bold** pentru conceptele cheie',
    '• Foloseste *italic* pentru termeni importanti',
    '• Liste cu puncte pentru enumerări',
    '• Spatii entre paragrafe pentru respiratie vizuala',
    '• Maxim 3-4 emoji-uri per raspuns, plasate strategic',
    '',
    contextSummary ? `📖 **Context din biblioteca ta:**\n${deepCleanText(contextSummary)}` : 'Nu exista context specific furnizat din biblioteca ta.'
  ].join('\n\n');

  // Limit history to last 10 messages to save tokens
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

export function getUserProfile(profileId: string) {
  return loadUserProfile(profileId);
}

export function generateFromMistakeBank(profileId: string) {
  return generateFromMistakes(profileId);
}

logAIDebug('AIEngine:init', 'initializat');
