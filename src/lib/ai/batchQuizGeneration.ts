import { generateQuestions, getAdaptiveDifficulty, getUserProfile } from '../../ai/AIEngine';
import { getWeakTopicsForProfile } from '../../ai/UserProfile';
import { getVaultChunksBySource } from '../../ai/vectorStore';
import type { Difficulty, Folder, Quiz } from '../../types';
import {
  STUDIO_AI_BATCH_SIZE,
  STUDIO_MAX_PACK_COUNT,
  STUDIO_MAX_QUESTIONS_PER_PACK,
  buildFallbackQuestionsFromChunks,
  buildStudioContextPayload,
  clampStudioPackCount,
  clampStudioQuestionCount,
  isStudioQuestionQualityAcceptable,
} from './studioGeneration';

type BatchDifficulty = Difficulty | 'auto';

interface BatchGenerationOptions {
  sourceId: string;
  sourceName: string;
  folder: Folder | null;
  folderId: string | null;
  packCount: number;
  questionsPerPack: number;
  difficulty: BatchDifficulty;
  activeProfileId: string | null;
  existingQuizzes?: Quiz[];
}

function uid() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
}

function questionSignature(question: Quiz['questions'][number]) {
  const correct = question.options.find((option) => option.isCorrect)?.text ?? '';
  return `${question.text}::${correct}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
}

function pickPackDifficulty(requested: BatchDifficulty, activeProfileId: string | null): Difficulty {
  if (requested !== 'auto') return requested;
  if (!activeProfileId) return 'medium';

  const profile = getUserProfile(activeProfileId);
  return getAdaptiveDifficulty({
    accuracy: profile.globalAccuracy,
    streak: profile.streak,
    time: profile.availableTime,
  });
}

export async function generateQuizPackagesFromSource({
  sourceId,
  sourceName,
  folder,
  folderId,
  packCount,
  questionsPerPack,
  difficulty,
  activeProfileId,
  existingQuizzes = [],
}: BatchGenerationOptions) {
  const chunks = await getVaultChunksBySource(sourceId);
  if (chunks.length === 0) {
    throw new Error('Nu am găsit suficient conținut indexat pentru documentul selectat.');
  }

  const targetDifficulty = pickPackDifficulty(difficulty, activeProfileId);
  const weakTopics = activeProfileId ? getWeakTopicsForProfile(activeProfileId) : [];
  const profile = activeProfileId ? getUserProfile(activeProfileId) : null;
  const normalizedPackCount = clampStudioPackCount(packCount);
  const normalizedQuestionCount = clampStudioQuestionCount(questionsPerPack);

  const quizzes: Quiz[] = [];
  const warnings: string[] = [];
  let aiQuestionCount = 0;
  let fallbackQuestionCount = 0;
  const globalSeenQuestionSignatures = new Set(
    existingQuizzes
      .flatMap((quiz) => quiz.questions.map(questionSignature)),
  );

  for (let packIndex = 0; packIndex < normalizedPackCount; packIndex += 1) {
    const packQuestions: Quiz['questions'] = [];
    const seenQuestionSignatures = new Set<string>(globalSeenQuestionSignatures);
    let aiError: string | null = null;

    for (let offset = 0; offset < normalizedQuestionCount; offset += STUDIO_AI_BATCH_SIZE) {
      const batchCount = Math.min(STUDIO_AI_BATCH_SIZE, normalizedQuestionCount - offset);
      const contextPayload = buildStudioContextPayload({
        sourceName,
        chunks,
        packIndex: packIndex + Math.floor(offset / STUDIO_AI_BATCH_SIZE),
        totalPacks: normalizedPackCount,
        difficulty: targetDifficulty,
        weakTopics,
      });

      try {
        const result = await generateQuestions({
          context: contextPayload.query,
          prefetchedContext: contextPayload,
          count: batchCount,
          difficulty: targetDifficulty,
          weakTopics,
          userProfile: profile ?? undefined,
          mode: 'standard',
        });

        result.questions
          .filter((question) => isStudioQuestionQualityAcceptable(question, sourceName))
          .filter((question) => !seenQuestionSignatures.has(questionSignature(question)))
          .forEach((question) => {
            packQuestions.push(question);
            seenQuestionSignatures.add(questionSignature(question));
            globalSeenQuestionSignatures.add(questionSignature(question));
          });
      } catch (error) {
        aiError = error instanceof Error ? error.message : 'Generarea AI a eșuat pentru acest batch.';
        break;
      }
    }

    aiQuestionCount += packQuestions.length;

    if (packQuestions.length < normalizedQuestionCount) {
      const fallbackQuestions = buildFallbackQuestionsFromChunks({
        sourceName,
        chunks,
        count: normalizedQuestionCount - packQuestions.length,
        difficulty: targetDifficulty,
        packIndex,
      }).filter((question) => !seenQuestionSignatures.has(questionSignature(question)));

      fallbackQuestions.forEach((question) => {
        packQuestions.push(question);
        seenQuestionSignatures.add(questionSignature(question));
        globalSeenQuestionSignatures.add(questionSignature(question));
      });
      fallbackQuestionCount += fallbackQuestions.length;
    }

    if (aiError) {
      warnings.push(`Pachetul ${packIndex + 1} a folosit fallback local: ${aiError}`);
    }

    if (packQuestions.length === 0) {
      throw new Error(aiError ?? 'Nu am reușit să generăm întrebări pentru documentul selectat.');
    }

    const titleSuffix = normalizedPackCount === 1 ? 'Set premium' : `Set premium ${packIndex + 1}`;
    const title = `${sourceName} · ${titleSuffix}`;

    quizzes.push({
      id: uid(),
      title,
      description: `Generat de AI Studio din documentul "${sourceName}" cu ${packQuestions.length} întrebări și dificultate ${targetDifficulty}.`,
      emoji: folder?.emoji ?? '\u{1F9E0}',
      category: folder?.name ?? 'AI Studio',
      folderId,
      color: folder?.color ?? 'blue',
      questions: packQuestions,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      shuffleQuestions: true,
      shuffleAnswers: true,
      tags: ['ai-studio', 'document-pack', sourceName],
    });
  }

  return {
    quizzes,
    difficulty: targetDifficulty,
    sourceCount: chunks.length,
    aiQuestionCount,
    fallbackQuestionCount,
    warnings,
    limits: {
      maxPacks: STUDIO_MAX_PACK_COUNT,
      maxQuestionsPerPack: STUDIO_MAX_QUESTIONS_PER_PACK,
    },
  };
}
