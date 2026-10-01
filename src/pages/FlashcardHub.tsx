import { motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { localDateStr } from '../lib/studyPlan';
import { useTheme } from '../theme/ThemeContext';
import { useQuizStore } from '../store/quizStore';
import { useStatsStore } from '../store/statsStore';
import { useAIStore } from '../store/aiStore';
import { useUserStore } from '../store/userStore';
import { useToastStore } from '../store/toastStore';
import { friendlyAIError, rateLimitWaitSeconds } from '../lib/ai/friendlyError';
import { suggestFlashcardFolder } from '../lib/flashcardPlacement';
import { useFolderStore } from '../store/folderStore';
import { useFlashcardHubSession, getFlashcardResume, type FlashcardResumeHandle } from '../store/flashcardHubSessionStore';
import { FlashcardGenerationInterrupted, NoNewFlashcardsError, notesToFlashcards } from '../lib/groq';
import { buildMistakeFlashcardQuiz } from '../lib/adaptiveStudy';
import { extractCaptionedImagesFromPdf, renderPdfPagesAsImages, renderPdfPagesWithText, resizeImageFile, type CaptionedPdfImage, type PdfFlashcardPageSnapshot } from '../lib/imageProcessing';
import { flashcardImageKey, flashcardImageRef, putFlashcardImage } from '../lib/flashcardImageStore';
import { isFlashcardDeck } from '../lib/deckKind';
import { CARD_COLOR_MAP } from '../theme/colorMaps';
import type { Difficulty, Folder, Question } from '../types';
import { suggestFolderAppearance } from '../lib/folderAppearance';
import {
  FlashcardDeckGrid,
  FlashcardHubActions,
  GeneratedDeckCard,
  ReviewHeroCard,
  type GeneratedDeckInfo,
} from './flashcard-hub/sections';
import { AnkiImportModal } from './flashcard-hub/AnkiImportModal';

function generateId() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
}

const OPTION_IDS = ['a', 'b', 'c', 'd', 'e', 'f'];
const FLASHCARD_ANSWER_SOFT_LIMIT = 210;
const VISUAL_FLASHCARD_IMAGE_MAX_EDGE = 1680;
const PHOTO_CARD_PROMPT = 'Privește imaginea și descrie aspectul clinic.';
const LAST_FOLDER_LS_KEY = 'studyx-flashcard-last-folder';

/**
 * Builds one flashcard per course photo: the image on the front, the verbatim
 * caption on the back. Nothing is rewritten — the AI only decided these were
 * captioned photos worth turning into cards. Images are stored in IndexedDB and
 * referenced by tag so the quiz snapshot stays small.
 */
function buildPhotoCardQuestion(entry: CaptionedPdfImage, quizId: string): Question {
  return {
    id: generateId(),
    text: PHOTO_CARD_PROMPT,
    imageUrl: flashcardImageRef(quizId, entry.tag),
    multipleCorrect: false,
    difficulty: 'medium' as Difficulty,
    explanation: `${entry.section} · imaginea ${entry.tag}`,
    options: [{
      id: OPTION_IDS[0] ?? generateId(),
      text: normalizeFlashcardCopy(entry.caption),
      isCorrect: true,
    }],
    tags: ['foto', entry.tag],
  };
}

function normalizeFlashcardCopy(value: string) {
  return value
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function splitFlashcardAnswer(rawBack: string) {
  const cleaned = normalizeFlashcardCopy(rawBack);
  if (!cleaned) {
    return {
      answer: 'Răspuns indisponibil.',
      explanation: '',
    };
  }

  if (cleaned.length <= FLASHCARD_ANSWER_SOFT_LIMIT) {
    return { answer: cleaned, explanation: '' };
  }

  const sentences = cleaned.split(/(?<=[.!?])\s+/).filter(Boolean);
  let answer = '';
  let explanation = '';

  if (sentences.length > 1) {
    // Track where the answer ends inside `cleaned`, so the explanation starts exactly after it
    // even when sentences were separated by newlines (which the split above consumed).
    let end = 0;
    for (const sentence of sentences) {
      const sentenceEnd = cleaned.indexOf(sentence, end) + sentence.length;
      const candidate = cleaned.slice(0, sentenceEnd).trim();
      if (candidate.length > FLASHCARD_ANSWER_SOFT_LIMIT) break;
      answer = candidate;
      end = sentenceEnd;
      if (answer.length >= 120) break;
    }

    if (!answer) {
      // The first sentence alone is longer than the limit: keep it whole.
      answer = sentences[0];
      end = cleaned.indexOf(sentences[0]) + sentences[0].length;
    }
    explanation = cleaned.slice(end).trim().replace(/^[,;:\-\s]+/, '');
  }

  // One long sentence (or nothing to split on): show it whole instead of cutting it mid-sentence with "...".
  if (!answer) return { answer: cleaned, explanation: '' };

  return { answer, explanation };
}

function buildFlashcardQuestion(front: string, back: string): Question {
  const normalizedFront = normalizeFlashcardCopy(front);
  const { answer, explanation } = splitFlashcardAnswer(back);

  return {
    id: generateId(),
    text: normalizedFront,
    multipleCorrect: false,
    difficulty: 'medium' as Difficulty,
    explanation,
    options: [{ id: OPTION_IDS[0] ?? generateId(), text: answer, isCorrect: true }],
  };
}

function normalizeMatchText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function pickKeywords(value: string) {
  const stopWords = new Set([
    'care', 'este', 'sunt', 'prin', 'pentru', 'dintre', 'acest', 'aceasta', 'intr', 'intre',
    'what', 'when', 'with', 'from', 'that', 'this', 'the', 'and',
  ]);

  return normalizeMatchText(value)
    .split(' ')
    .filter((word) => word.length >= 5 && !stopWords.has(word))
    .slice(0, 12);
}

/**
 * Images travel inside the deck as data URLs, i.e. inside the profile's localStorage entry (a few MB in
 * all). A handful of modest images is worth it; dozens of full pages would crowd out the user's data.
 */
const MAX_DECK_IMAGES = 10;
const MAX_IMAGE_DATA_URL_CHARS = 260_000;

function attachRelevantPdfImages(questions: Question[], pages: PdfFlashcardPageSnapshot[]) {
  if (pages.length === 0 || questions.length === 0) return questions;

  const visualCandidates = pages
    .flatMap((page) => page.visuals.map((visual) => ({ page, visual })))
    .filter(({ visual }) => visual.dataUrl.length <= MAX_IMAGE_DATA_URL_CHARS)
    .slice(0, 40);
  if (visualCandidates.length === 0) return questions;

  const usedPages = new Set<number>();

  return questions.map((question) => {
    if (usedPages.size >= MAX_DECK_IMAGES) return question;
    const keywords = pickKeywords(`${question.text} ${question.options[0]?.text ?? ''}`);
    let bestCandidate: typeof visualCandidates[number] | null = null;
    let bestScore = 0;

    for (const candidate of visualCandidates) {
      if (usedPages.has(candidate.visual.pageNumber)) continue;
      const pageText = normalizeMatchText(candidate.page.text);
      const score = keywords.reduce((sum, keyword) => sum + (pageText.includes(keyword) ? 1 : 0), 0);
      const visualBoost = candidate.page.wordCount < 120 && score > 0 ? 1 : 0;
      const totalScore = score + visualBoost;
      if (totalScore > bestScore) {
        bestCandidate = candidate;
        bestScore = totalScore;
      }
    }

    if (!bestCandidate || bestScore < 2) return question;
    usedPages.add(bestCandidate.visual.pageNumber);

    return {
      ...question,
      imageUrl: bestCandidate.visual.dataUrl,
      explanation: [
        question.explanation,
        `Imagine relevanta din ${bestCandidate.visual.sourceName}, pagina ${bestCandidate.visual.pageNumber}.`,
      ].filter(Boolean).join('\n\n'),
    };
  });
}

export default function FlashcardHub() {
  const theme = useTheme();
  const navigate = useNavigate();
  const { quizzes, addQuiz, updateQuiz } = useQuizStore();
  const addToast = useToastStore((state) => state.addToast);
  const folders = useFolderStore((state) => state.folders);
  const addFolder = useFolderStore((state) => state.addFolder);
  const { questionStats } = useStatsStore();
  const streak = useStatsStore((state) => state.streak);
  const createSectionRef = useRef<HTMLDivElement>(null);
  const { hasKey, addKnowledgeSource, knowledgeSources } = useAIStore();
  const activeProfileId = useUserStore((state) => state.activeProfileId);

  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiCount, setAiCount] = useState(10);
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvError, setCsvError] = useState('');
  const [photoImporting, setPhotoImporting] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const [aiProgress, setAiProgress] = useState('');
  const [libraryGenerating, setLibraryGenerating] = useState(false);
  const [ankiModalOpen, setAnkiModalOpen] = useState(false);
  // Kept outside the page so leaving and coming back doesn't lose the card or the way to resume.
  const hubSession = useFlashcardHubSession();
  const createdDeck = hubSession.profileId === activeProfileId ? hubSession.createdDeck : null;
  const setCreatedDeck = (next: GeneratedDeckInfo | null | ((previous: GeneratedDeckInfo | null) => GeneratedDeckInfo | null)) => (
    useFlashcardHubSession.getState().setCreatedDeck(activeProfileId, next)
  );
  const setResume = (next: FlashcardResumeHandle | null) => useFlashcardHubSession.getState().setResume(activeProfileId, next);
  const [resuming, setResuming] = useState(false);
  const createdCardRef = useRef<HTMLDivElement>(null);
  const [targetFolderId, setTargetFolderId] = useState<string>(() => {
    if (typeof localStorage === 'undefined') return '__uncategorized__';
    return localStorage.getItem(LAST_FOLDER_LS_KEY) ?? '__uncategorized__';
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const selectedFolder = targetFolderId === '__uncategorized__'
    ? null
    : folders.find((folder) => folder.id === targetFolderId) ?? null;

  // Remember the last chosen folder so AI decks stop landing in "Neclasificate".
  const handleTargetFolderChange = (folderId: string) => {
    setTargetFolderId(folderId);
    try { localStorage.setItem(LAST_FOLDER_LS_KEY, folderId); } catch { /* ignore */ }
  };

  // Create a folder (or subfolder) inline from the flashcard hub — with a
  // name-aware icon/color so it looks intentional, not a generic 📚.
  const handleCreateFolder = (name: string, parentId: string | null): string => {
    const appearance = suggestFolderAppearance(name);
    return addFolder(name, parentId ? '📁' : appearance.emoji, appearance.color, parentId);
  };

  // Where an AI deck goes: the folder picked in "Salvează în", else a folder whose
  // name matches the course, else Neclasificate.
  const resolveGeneratedFolder = (sourceName: string): { folder: Folder | null; suggested: boolean } => {
    if (selectedFolder) return { folder: selectedFolder, suggested: false };
    const match = suggestFlashcardFolder(sourceName, folders);
    return { folder: match, suggested: match !== null };
  };

  // A finished AI deck is announced, not silently opened: a toast says where it
  // landed and the card at the top of the page lets the user move it.
  const announceGeneratedDeck = (deck: {
    id: string;
    title: string;
    count: number;
    folder: Folder | null;
    suggested: boolean;
    /** The AI stopped early: the deck holds what was made and can be resumed. */
    interrupted?: { requested: number; reason: string; waitSeconds: number | null };
  }) => {
    setCreatedDeck({
      id: deck.id,
      title: deck.title,
      count: deck.count,
      folderId: deck.folder?.id ?? null,
      suggested: deck.suggested,
      interrupted: deck.interrupted ? { ...deck.interrupted, at: Date.now() } : undefined,
    });
    const where = deck.folder ? `„${deck.folder.name}"` : 'Neclasificate';
    if (deck.interrupted) {
      addToast(
        `Am creat ${deck.count} din ${deck.interrupted.requested} flashcarduri în ${where}. ${deck.interrupted.reason}`,
        'warning',
        9000,
      );
      return;
    }
    addToast(
      `Flashcardurile au fost generate în ${where}.`,
      'success',
      7000,
      { label: 'Începe', onClick: () => navigate(`/flashcards/session/${deck.id}?mode=all`) },
    );
  };

  // Runs the AI for one deck. If it fails after some cards exist, those come back
  // with the reason instead of being lost, so the deck can be created and resumed.
  const generateCards = async (
    text: string,
    sourceName: string,
    count: number,
    resume?: { startChunk: number; chunkBudget: number; already: number; requested: number; avoidFronts: string[] },
  ): Promise<{
    cards: { front: string; back: string }[];
    interruption: { reason: string; waitSeconds: number | null; nextChunk: number } | null;
  }> => {
    try {
      const cards = await notesToFlashcards(text, {
        count,
        avoidFronts: resume?.avoidFronts ?? existingFlashcardFronts,
        sourceName,
        keepPartialOnError: true,
        startChunk: resume?.startChunk,
        chunkBudget: resume?.chunkBudget,
        onProgress: (done, target) => setAiProgress(
          `Generez flashcardurile... ${(resume?.already ?? 0) + done}/${resume?.requested ?? target}`,
        ),
        onWait: (seconds) => setAiProgress(`Limita modelului AI e atinsă — reiau în ${seconds} s...`),
      });
      return { cards, interruption: null };
    } catch (error: unknown) {
      if (error instanceof FlashcardGenerationInterrupted) {
        return {
          cards: error.partial,
          interruption: { reason: friendlyAIError(error.original), waitSeconds: error.waitSeconds, nextChunk: error.nextChunk },
        };
      }
      throw error;
    }
  };

  // One generation at a time: a second flow would overwrite the card and resume handle of the first.
  const guardBusy = (): boolean => {
    if (!(aiLoading || resuming || libraryGenerating)) return false;
    addToast('Așteaptă să se termine generarea curentă.', 'info', 4000);
    return true;
  };

  const notifyGenerationFailed = (message: string) => {
    // Some messages already open with "Nu s-au putut genera…"; do not say it twice.
    const alreadySaysIt = /^nu s-au (putut )?genera/i.test(message);
    addToast(alreadySaysIt ? message : `Nu s-au generat flashcardurile. ${message}`, 'error', 8000);
  };

  const moveCreatedDeck = (folderId: string) => {
    if (!createdDeck) return;
    const folder = folderId === '__uncategorized__'
      ? null
      : useFolderStore.getState().folders.find((item) => item.id === folderId) ?? null;
    updateQuiz(createdDeck.id, {
      folderId: folder?.id ?? null,
      category: folder?.name ?? 'AI Flashcards',
      ...(folder ? { color: folder.color } : {}),
    });
    setCreatedDeck({ ...createdDeck, folderId: folder?.id ?? null, suggested: false });
  };

  // One card per captioned course photo (front = image, back = verbatim caption).
  const generateVisualDeckFromCaptions = async (captioned: CaptionedPdfImage[], sourceName: string) => {
    const deckId = generateId();
    await Promise.all(
      captioned.map((entry) => putFlashcardImage(flashcardImageKey(deckId, entry.tag), entry.imageDataUrl)),
    );

    const questions: Question[] = captioned.map((entry) => buildPhotoCardQuestion(entry, deckId));
    const baseName = sourceName.replace(/\.[^.]+$/, '') || 'Curs';
    const target = resolveGeneratedFolder(sourceName);
    const title = `Atlas foto · ${baseName}`;

    addQuiz({
      id: deckId,
      title,
      description: `${questions.length} carduri vizuale din ${sourceName}. Față = imaginea din curs, spate = descrierea originală.`,
      emoji: '🩺',
      color: target.folder?.color ?? 'pink',
      category: target.folder?.name ?? 'Atlas vizual',
      folderId: target.folder?.id ?? null,
      kind: 'flashcard',
      shuffleQuestions: true,
      shuffleAnswers: false,
      tags: ['ai', 'foto', 'atlas'],
      questions,
      createdAt: Date.now(),
    });

    announceGeneratedDeck({ id: deckId, title, count: questions.length, folder: target.folder, suggested: target.suggested });
  };

  const existingFlashcardFronts = useMemo(() => (
    quizzes
      .filter((quiz) => (quiz.tags ?? []).some((tag) => /flashcard|deck|ai|pdf/i.test(tag)))
      .flatMap((quiz) => quiz.questions.map((question) => question.text))
  ), [quizzes]);

  const generateDeckFromPdf = async (text: string, sourceName = 'PDF', pages: PdfFlashcardPageSnapshot[] = []) => {
    setAiLoading(true);
    setAiError('');
    const profileAtStart = useUserStore.getState().activeProfileId;

    try {
      const outcome = await generateCards(text, sourceName, aiCount);
      if (useUserStore.getState().activeProfileId !== profileAtStart) {
        addToast('Profilul s-a schimbat în timpul generării, deci pachetul nu a fost salvat.', 'warning', 7000);
        return;
      }
      const questions: Question[] = attachRelevantPdfImages(
        outcome.cards.map((entry) => buildFlashcardQuestion(entry.front, entry.back)),
        pages,
      );

      if (questions.length === 0) {
        throw new Error('AI nu a putut transforma PDF-ul în flashcarduri utile.');
      }

      const id = generateId();
      const sourceAlreadyIndexed = knowledgeSources.some((source) => (
        source.name === sourceName && source.charCount === text.trim().length && source.indexStatus === 'ready'
      ));
      if (!sourceAlreadyIndexed && text.trim().length >= 300) {
        void addKnowledgeSource(sourceName, text, sourceName.toLowerCase().endsWith('.pdf') ? 'pdf' : 'txt').catch((e) => console.error('[StudyX] KB indexing failed for', sourceName, e));
      }

      const target = resolveGeneratedFolder(sourceName);
      const title = `Deck AI · ${new Date().toLocaleDateString('ro-RO')}`;
      addQuiz({
        id,
        title,
        description: `Flashcarduri smart generate din ${sourceName}. Imaginile relevante din PDF sunt pastrate pe cardurile potrivite.`,
        emoji: '🤖',
        color: target.folder?.color ?? 'purple',
        category: target.folder?.name ?? 'AI Flashcards',
        folderId: target.folder?.id ?? null,
        kind: 'flashcard',
        shuffleQuestions: true,
        shuffleAnswers: true,
        tags: ['ai', 'pdf'],
        questions,
        createdAt: Date.now(),
      });

      setResume(outcome.interruption
        ? { deckId: id, text, sourceName, requested: aiCount, nextChunk: outcome.interruption.nextChunk, pages }
        : null);
      announceGeneratedDeck({
        id,
        title,
        count: questions.length,
        folder: target.folder,
        suggested: target.suggested,
        interrupted: outcome.interruption
          ? { requested: aiCount, reason: outcome.interruption.reason, waitSeconds: outcome.interruption.waitSeconds }
          : undefined,
      });
    } catch (error: unknown) {
      const message = friendlyAIError(error);
      setAiError(message);
      notifyGenerationFailed(message);
    } finally {
      setAiLoading(false);
      setAiProgress('');
    }
  };

  // Already-indexed library courses, ready to turn into text flashcards with one
  // click — no need to re-import the PDF. This is the practical "flashcarduri
  // inteligente pe subpuncte" flow that previously only lived in the AI chat.
  const readyLibrarySources = useMemo(
    () => knowledgeSources.filter((source) => source.indexStatus === 'ready'),
    [knowledgeSources],
  );

  const generateDeckFromLibrary = async (sourceId: string) => {
    const source = readyLibrarySources.find((entry) => entry.id === sourceId);
    if (!source || libraryGenerating || aiLoading || resuming) return;

    setLibraryGenerating(true);
    setAiError('');
    setAiProgress(`Citesc „${source.name}" din bibliotecă...`);
    const profileAtStart = useUserStore.getState().activeProfileId;

    try {
      const { getVaultChunksBySource } = await import('../ai/vectorStore');
      const chunks = await getVaultChunksBySource(sourceId);
      let text = '';
      for (const chunk of chunks) {
        text += (text ? '\n\n' : '') + chunk.text;
        if (text.length > 24000) break;
      }
      if (text.trim().length < 80) {
        throw new Error('Cursul nu are destul text indexat pentru flashcarduri.');
      }

      setAiProgress('AI generează cardurile pe subpuncte...');
      const outcome = await generateCards(text, source.name, aiCount);
      if (useUserStore.getState().activeProfileId !== profileAtStart) {
        addToast('Profilul s-a schimbat în timpul generării, deci pachetul nu a fost salvat.', 'warning', 7000);
        return;
      }
      const questions = outcome.cards.map((entry) => buildFlashcardQuestion(entry.front, entry.back));
      if (questions.length === 0) {
        throw new Error('AI nu a putut genera flashcarduri din acest curs.');
      }

      const id = generateId();
      const target = resolveGeneratedFolder(source.name);
      const title = `Flashcarduri · ${source.name.replace(/\.[^.]+$/, '')}`;
      addQuiz({
        id,
        title,
        description: `${questions.length} flashcarduri AI pe subpunctele cursului „${source.name}".`,
        emoji: '🤖',
        color: target.folder?.color ?? 'purple',
        category: target.folder?.name ?? 'AI Flashcards',
        kind: 'flashcard',
        folderId: target.folder?.id ?? null,
        shuffleQuestions: true,
        shuffleAnswers: true,
        tags: ['ai', 'flashcard', 'biblioteca'],
        questions,
        createdAt: Date.now(),
      });

      setResume(outcome.interruption
        ? { deckId: id, text, sourceName: source.name, requested: aiCount, nextChunk: outcome.interruption.nextChunk, pages: [] }
        : null);
      announceGeneratedDeck({
        id,
        title,
        count: questions.length,
        folder: target.folder,
        suggested: target.suggested,
        interrupted: outcome.interruption
          ? { requested: aiCount, reason: outcome.interruption.reason, waitSeconds: outcome.interruption.waitSeconds }
          : undefined,
      });
    } catch (error: unknown) {
      const message = friendlyAIError(error);
      setAiError(message);
      notifyGenerationFailed(message);
    } finally {
      setLibraryGenerating(false);
      setAiProgress('');
    }
  };

  // Picks an interrupted run up where it stopped and adds the new cards to the same deck.
  const resumeGeneration = async () => {
    const resume = getFlashcardResume(activeProfileId);
    const current = createdDeck;
    const deck = resume ? quizzes.find((quiz) => quiz.id === resume.deckId) : undefined;
    if (!resume || !current?.interrupted || !deck || resume.deckId !== current.id || resuming || aiLoading || libraryGenerating) return;

    const profileAtStart = useUserStore.getState().activeProfileId;
    setResuming(true);
    setAiError('');
    const already = deck.questions.length;
    // Functional updates: the user may move the deck while this runs.
    const patchInfo = (changes: Partial<GeneratedDeckInfo>) => setCreatedDeck((previous) => (
      previous && previous.id === current.id ? { ...previous, ...changes } : previous
    ));

    try {
      const outcome = await generateCards(resume.text, resume.sourceName, resume.requested - already, {
        startChunk: resume.nextChunk,
        chunkBudget: resume.requested,
        already,
        requested: resume.requested,
        avoidFronts: [...existingFlashcardFronts, ...deck.questions.map((question) => question.text)],
      });
      // Read the deck now: the user may have edited, or deleted, it while the AI worked.
      const liveDeck = useQuizStore.getState().quizzes.find((quiz) => quiz.id === deck.id);
      if (!liveDeck || useUserStore.getState().activeProfileId !== profileAtStart) {
        setResume(null);
        setCreatedDeck((previous) => (previous && previous.id === current.id ? null : previous));
        addToast('Pachetul nu mai este disponibil, deci cardurile noi nu au fost adăugate.', 'info', 6000);
        return;
      }
      const fresh = attachRelevantPdfImages(
        outcome.cards.map((entry) => buildFlashcardQuestion(entry.front, entry.back)),
        resume.pages,
      );
      updateQuiz(liveDeck.id, { questions: [...liveDeck.questions, ...fresh] });
      const total = liveDeck.questions.length + fresh.length;

      if (outcome.interruption) {
        setResume({ ...resume, nextChunk: outcome.interruption.nextChunk });
        patchInfo({
          count: total,
          interrupted: {
            requested: resume.requested,
            reason: outcome.interruption.reason,
            waitSeconds: outcome.interruption.waitSeconds,
            at: Date.now(),
          },
        });
        addToast(`${total} din ${resume.requested} flashcarduri. ${outcome.interruption.reason}`, 'warning', 9000);
      } else {
        setResume(null);
        patchInfo({ count: total, interrupted: undefined });
        addToast(`Gata: ${total} flashcarduri în pachet.`, 'success', 6000);
      }
    } catch (error: unknown) {
      if (error instanceof NoNewFlashcardsError) {
        setResume(null);
        patchInfo({ interrupted: undefined });
        addToast('Nu am mai găsit carduri noi în textul acestui curs.', 'info', 6000);
      } else {
        const message = friendlyAIError(error);
        notifyGenerationFailed(message);
        patchInfo({
          interrupted: { ...current.interrupted, reason: message, waitSeconds: rateLimitWaitSeconds(error), at: Date.now() },
        });
      }
    } finally {
      setResuming(false);
      setAiProgress('');
    }
  };

  // The Electron-native "text only" branch that used to sit here was gated behind
  // a constant hard-wired to false, so it never ran. The browser file picker path
  // below handles both builds and additionally supports captioned-image decks.
  const handlePdfImport = async () => {
    if (guardBusy()) return;
    const input = fileInputRef.current;
    if (!input) return;
    input.value = '';
    input.click();
  };

  const handleCsvImport = () => {
    if (guardBusy()) return;
    const input = csvInputRef.current;
    if (!input) return;
    input.value = '';
    input.click();
  };

  const handlePhotoImport = () => {
    if (guardBusy()) return;
    const input = photoInputRef.current;
    if (!input) return;
    input.value = '';
    input.click();
  };

  const processCsvFile = async (file: File) => {
    setCsvImporting(true);
    setCsvError('');

    try {
      const text = await file.text();
      const lines = text.split('\n').filter((line) => line.trim() && !line.startsWith('#'));
      if (lines.length === 0) {
        throw new Error('Fișierul CSV este gol sau conține doar comentarii.');
      }

      const separator = lines[0].includes('\t') ? '\t' : lines[0].includes(';') ? ';' : ',';
      const questions: Question[] = [];

      for (const line of lines) {
        const parts = line.split(separator);
        if (parts.length < 2) continue;

        const clean = (value: string) => value.trim().replace(/^"(.*)"$/, '$1').replace(/""/g, '"');
        const front = clean(parts[0]);
        const back = clean(parts.slice(1).join(separator));
        if (!front || !back) continue;

        questions.push(buildFlashcardQuestion(front, back));
      }

      if (questions.length === 0) {
        throw new Error('Nu s-au găsit perechi front/back valide în CSV.');
      }

      const deckId = generateId();
      const fileName = file.name.replace(/\.[^.]+$/, '');

      addQuiz({
        id: deckId,
        title: `Deck Anki · ${fileName}`,
        description: `Importat din ${file.name} (${questions.length} carduri)`,
        emoji: '🗂️',
        color: selectedFolder?.color ?? 'teal',
        category: selectedFolder?.name ?? 'Import',
        folderId: selectedFolder?.id ?? null,
        kind: 'flashcard',
        shuffleQuestions: true,
        shuffleAnswers: false,
        tags: ['anki', 'import'],
        questions,
        createdAt: Date.now(),
      });

      navigate(`/flashcards/session/${deckId}?mode=all`);
    } catch (error: unknown) {
      setCsvError(error instanceof Error ? error.message : 'Eroare la importul CSV.');
    } finally {
      setCsvImporting(false);
    }
  };

  const processPhotoFiles = async (files: File[]) => {
    setPhotoImporting(true);
    setPhotoError('');

    try {
      const visualQuestions: Question[] = [];
      let smartDeckCreated = false;

      for (const file of files) {
        const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
        const isImage = file.type.startsWith('image/') || /\.(jpe?g|png|webp|bmp)$/i.test(file.name);

        if (isPdf) {
          const pageSnapshots = await renderPdfPagesWithText(file, {
            maxLongEdge: VISUAL_FLASHCARD_IMAGE_MAX_EDGE,
            quality: 0.84,
            mimeType: 'image/jpeg',
          });
          const extractedText = pageSnapshots.map((page) => page.text).filter(Boolean).join('\n\n');

          if (hasKey && extractedText.trim().length >= 80) {
            await generateDeckFromPdf(extractedText, file.name, pageSnapshots);
            smartDeckCreated = true;
            continue;
          }

          const pages = await renderPdfPagesAsImages(file, {
            maxLongEdge: VISUAL_FLASHCARD_IMAGE_MAX_EDGE,
            quality: 0.88,
            mimeType: 'image/jpeg',
          });

          pages.forEach((page) => {
            visualQuestions.push({
              id: generateId(),
              text: `Ce concept sau detaliu important trebuie recunoscut in imaginea ${visualQuestions.length + 1}?`,
              imageUrl: page.dataUrl,
              multipleCorrect: false,
              difficulty: 'medium' as Difficulty,
              explanation: `${page.sourceName}, pagina ${page.pageNumber}. Completeaza raspunsul dupa ce verifici materialul sursa; pentru carduri complet automate foloseste PDF digital sau OCR in Biblioteca AI.`,
              options: [{
                id: OPTION_IDS[0] ?? generateId(),
                text: 'Recunoaste imaginea si formuleaza raspunsul esential din materialul sursa.',
                isCorrect: true,
              }],
            });
          });
          continue;
        }

        if (isImage) {
          const dataUrl = await resizeImageFile(file, {
            maxLongEdge: VISUAL_FLASHCARD_IMAGE_MAX_EDGE,
            quality: 0.88,
            mimeType: 'image/jpeg',
          });
          let ocrText = '';
          if (hasKey) {
            try {
              const { parseImageOCR } = await import('../ai/ocrParser');
              ocrText = await parseImageOCR(file);
            } catch {
              ocrText = '';
            }
          }

          if (hasKey && ocrText.trim().length >= 80) {
            const generated = await notesToFlashcards(ocrText, {
              count: Math.min(3, Math.max(1, aiCount)),
              avoidFronts: existingFlashcardFronts,
              sourceName: file.name,
            });
            generated.forEach((entry) => {
              visualQuestions.push({
                ...buildFlashcardQuestion(entry.front, entry.back),
                imageUrl: dataUrl,
                explanation: [
                  splitFlashcardAnswer(entry.back).explanation,
                  `Imagine sursa: ${file.name}.`,
                ].filter(Boolean).join('\n\n'),
              });
            });
            continue;
          }

          visualQuestions.push({
            id: generateId(),
            text: `Ce concept sau detaliu important trebuie recunoscut in imaginea ${visualQuestions.length + 1}?`,
            imageUrl: dataUrl,
            multipleCorrect: false,
            difficulty: 'medium' as Difficulty,
            explanation: `Imagine sursa: ${file.name}. Daca imaginea contine text, activeaza OCR/Biblioteca AI pentru generare complet automata.`,
            options: [{
              id: OPTION_IDS[0] ?? generateId(),
              text: 'Recunoaste imaginea si formuleaza raspunsul esential din materialul sursa.',
              isCorrect: true,
            }],
          });
        }
      }

      if (visualQuestions.length === 0) {
        if (smartDeckCreated) return;
        throw new Error('Nu am gasit imagini valide. Alege JPG, PNG, WEBP, BMP sau un PDF cu poze.');
      }

      const deckId = generateId();
      const firstName = files[0]?.name.replace(/\.[^.]+$/, '') || 'poze';
      const category = firstName.toLowerCase().includes('derm') ? 'Dermatologie' : 'Altele';

      addQuiz({
        id: deckId,
        title: `Deck foto · ${firstName}`,
        description: `Import vizual cu ${visualQuestions.length} carduri din poze/PDF.`,
        emoji: '🖼️',
        color: selectedFolder?.color ?? 'teal',
        category: selectedFolder?.name ?? category,
        folderId: selectedFolder?.id ?? null,
        kind: 'flashcard',
        shuffleQuestions: false,
        shuffleAnswers: false,
        tags: ['flashcard', 'image', 'visual'],
        questions: visualQuestions,
        createdAt: Date.now(),
      });

      navigate(`/flashcards/session/${deckId}?mode=all`);
    } catch (error: unknown) {
      setPhotoError(error instanceof Error ? error.message : 'Eroare la importul imaginilor.');
    } finally {
      setPhotoImporting(false);
    }
  };

  const createMistakeDeck = () => {
    if (!activeProfileId) {
      setAiError('Nu există profil activ pentru a citi banca de greșeli.');
      return;
    }

    const quiz = buildMistakeFlashcardQuiz(activeProfileId, quizzes, questionStats);
    if (!quiz) {
      setAiError('Nu am găsit suficiente greșeli utile pentru a crea flashcarduri.');
      return;
    }

    const targetQuiz = selectedFolder
      ? {
          ...quiz,
          folderId: selectedFolder.id,
          category: selectedFolder.name,
          color: selectedFolder.color,
          emoji: selectedFolder.emoji,
        }
      : quiz;
    addQuiz(targetQuiz);
    navigate(`/flashcards/session/${targetQuiz.id}?mode=all`);
  };

  const createQuickDeck = () => {
    const deckId = generateId();
    const now = Date.now();
    const questions = [
      buildFlashcardQuestion(
        'Care este primul pas cand inveti un concept nou?',
        'Formuleaza definitia in cuvintele tale si noteaza un exemplu concret.',
      ),
      buildFlashcardQuestion(
        'Cum verifici rapid daca ai inteles o lectie?',
        'Inchide materialul si explica ideea principala in 30 de secunde, fara sa copiezi textul.',
      ),
      buildFlashcardQuestion(
        'Ce faci cu o greseala repetata?',
        'O transformi intr-un card scurt: intrebare clara pe fata, raspuns esential pe spate.',
      ),
      buildFlashcardQuestion(
        'Cand este cel mai util un mnemonic?',
        'Cand trebuie sa retii liste, pasi, exceptii sau asocieri care nu se leaga natural intre ele.',
      ),
      buildFlashcardQuestion(
        'Ce inseamna recapitulare activa?',
        'Incerci sa recuperezi raspunsul din memorie inainte sa verifici materialul.',
      ),
      buildFlashcardQuestion(
        'Cum alegi cardurile pentru azi?',
        'Incepi cu restantele, apoi treci la cardurile noi sau la punctele slabe.',
      ),
    ];

    addQuiz({
      id: deckId,
      title: `Deck rapid · ${new Date(now).toLocaleDateString('ro-RO')}`,
      description: 'Deck scurt pentru testarea fluxului de flashcarduri si pentru incalzire.',
      emoji: '🃏',
      color: selectedFolder?.color ?? 'green',
      category: selectedFolder?.name ?? 'Flashcards',
      folderId: selectedFolder?.id ?? null,
      kind: 'flashcard',
      shuffleQuestions: false,
      shuffleAnswers: false,
      tags: ['flashcard', 'deck', 'manual', 'quick'],
      questions,
      createdAt: now,
    });

    navigate(`/flashcards/session/${deckId}?mode=all`);
  };

  const decks = useMemo(() => {
    return quizzes
      .filter((quiz) => !quiz.archived && quiz.questions.length > 0)
      .filter((quiz) => isFlashcardDeck(quiz))
      .map((quiz) => {
        const total = quiz.questions.length;
        const stats = quiz.questions.map((question) => questionStats[`${quiz.id}:${question.id}`]);
        const seen = stats.filter(Boolean).length;
        const due = stats.filter((stat) => stat && stat.nextReview > 0 && stat.nextReview <= Date.now()).length;
        const mastered = stats.filter((stat) => (
          stat
          && stat.timesCorrect >= 3
          && stat.timesCorrect / (stat.timesCorrect + stat.timesWrong) >= 0.8
        )).length;
        const masteryPct = total > 0 ? Math.round((mastered / total) * 100) : 0;
        const accentColor = (CARD_COLOR_MAP[quiz.color] ?? CARD_COLOR_MAP.blue).badge;

        return { quiz, total, seen, due, mastered, masteryPct, accentColor };
      })
      .sort((left, right) => right.due - left.due || right.quiz.questions.length - left.quiz.questions.length);
  }, [quizzes, questionStats]);

  const totalCards = decks.reduce((sum, deck) => sum + deck.total, 0);
  const totalMastered = decks.reduce((sum, deck) => sum + deck.mastered, 0);
  // Summed from the flashcard decks above, not from the store's app-wide due
  // list — that counted every due multiple-choice question too, so the hub
  // advertised far more "carduri restante" than it actually had cards.
  const totalDue = decks.reduce((sum, deck) => sum + deck.due, 0);

  // What the "Începe repetarea" button actually serves: the session for "all"
  // takes every due card plus every card that was never studied.
  const totalFresh = totalCards - decks.reduce((sum, deck) => sum + deck.seen, 0);

  // currentStreak is only recomputed when a session ends, so a streak that was
  // not continued yesterday or today must read as 0 here.
  const activeStreak = useMemo(() => {
    if (streak.currentStreak <= 0) return 0;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const last = streak.lastStudyDate;
    return last === localDateStr() || last === localDateStr(yesterday) ? streak.currentStreak : 0;
  }, [streak.currentStreak, streak.lastStudyDate]);

  const createdDeckId = createdDeck?.id;
  useEffect(() => {
    if (createdDeckId) createdCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [createdDeckId]);

  // The deck may have been deleted since — then there is nothing to confirm or move.
  const visibleCreatedDeck = createdDeck && quizzes.some((quiz) => quiz.id === createdDeck.id) ? createdDeck : null;

  return (
    <div data-tutorial="flashcard-hub" className="h-full overflow-y-auto px-4 py-6 sm:px-8 sm:py-10">
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.txt"
        className="hidden"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.currentTarget.value = '';
          if (!file) return;

          const isPdf = file.name.toLowerCase().endsWith('.pdf');
          setAiLoading(true);
          setAiError('');

          try {
            // Course with captioned photos → one card per image, verbatim caption.
            if (isPdf) {
              setAiProgress('Caut imagini cu descriere în curs...');
              const captioned = await extractCaptionedImagesFromPdf(file, {
                maxLongEdge: VISUAL_FLASHCARD_IMAGE_MAX_EDGE,
                quality: 0.84,
                mimeType: 'image/jpeg',
              }).catch(() => [] as CaptionedPdfImage[]);

              if (captioned.length >= 2) {
                setAiProgress(`Pregătesc ${captioned.length} carduri foto...`);
                await generateVisualDeckFromCaptions(captioned, file.name);
                return;
              }
            }

            // Plain text PDF / TXT → AI generates flashcards from the text.
            setAiProgress('Extrag textul...');
            const pageSnapshots = isPdf
              ? await renderPdfPagesWithText(file, {
                  maxLongEdge: VISUAL_FLASHCARD_IMAGE_MAX_EDGE,
                  quality: 0.84,
                  mimeType: 'image/jpeg',
                })
              : [];
            let text = '';
            if (isPdf) {
              try {
                text = await (await import('../ai/pdfParser')).parsePDF(file);
              } catch {
                text = pageSnapshots.map((page) => page.text).filter(Boolean).join('\n\n');
              }
            } else {
              text = await file.text();
            }

            if (text.trim().length < 60) {
              setAiError('PDF-ul pare să fie scanat fără text digital. Încearcă alt PDF sau procesează-l întâi cu OCR în Biblioteca AI.');
              return;
            }

            setAiProgress('AI generează cardurile...');
            await generateDeckFromPdf(text, file.name, pageSnapshots);
          } catch (error: unknown) {
            setAiError(error instanceof Error ? error.message : 'Eroare la procesarea fișierului.');
          } finally {
            setAiLoading(false);
            setAiProgress('');
          }
        }}
      />

      <input
        ref={csvInputRef}
        type="file"
        accept=".csv,.tsv,.txt"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            void processCsvFile(file);
          }
        }}
      />

      <input
        ref={photoInputRef}
        type="file"
        accept="image/*,.pdf,application/pdf"
        multiple
        className="hidden"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.currentTarget.value = '';
          if (files.length > 0) {
            void processPhotoFiles(files);
          }
        }}
      />

      <div className="mx-auto max-w-3xl space-y-7">
        {/* ── Header (compact, Residency-style) ── */}
        <motion.header
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start justify-between gap-4"
        >
          <div>
            <h1 className="page-title-compact" style={{ color: theme.text }}>
              Flashcarduri
            </h1>
            <p className="mt-1 text-[13px]" style={{ color: theme.text3 }}>
              {decks.length > 0
                ? `${decks.length} ${decks.length === 1 ? 'pachet' : 'pachete'} · ${totalCards} carduri · SM-2`
                : 'Repetare spațiată și carduri inteligente.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => createSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            aria-label="Creează pachet nou"
            title="Creează pachet nou"
            className="fine-row press-feedback flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full"
            style={{ background: theme.surface2, color: theme.text2 }}
          >
            <Plus size={18} />
          </button>
        </motion.header>

        {/* ── Pachet generat: unde a ajuns + mută ── */}
        {visibleCreatedDeck && (
          <div ref={createdCardRef} className="scroll-mt-6">
            <GeneratedDeckCard
              info={visibleCreatedDeck}
              folders={folders}
              theme={theme}
              resuming={resuming}
              progress={aiProgress}
              onMove={moveCreatedDeck}
              onCreateFolder={handleCreateFolder}
              onStart={() => navigate(`/flashcards/session/${visibleCreatedDeck.id}?mode=all`)}
              onResume={() => void resumeGeneration()}
              onDismiss={() => {
                setResume(null);
                setCreatedDeck(null);
              }}
            />
          </div>
        )}

        {/* ── De repetat azi ── */}
        <ReviewHeroCard
          totalDue={totalDue}
          totalFresh={totalFresh}
          totalCards={totalCards}
          totalMastered={totalMastered}
          streak={activeStreak}
          theme={theme}
        />

        {/* ── Pachetele tale ── */}
        <FlashcardDeckGrid decks={decks} folders={folders} theme={theme} />

        {/* ── Creează pachet nou ── */}
        <div ref={createSectionRef} className="scroll-mt-6">
          <FlashcardHubActions
            aiCount={aiCount}
            aiError={aiError}
            aiLoading={aiLoading || resuming}
            aiProgress={aiProgress}
            csvError={csvError}
            csvImporting={csvImporting}
            folders={folders}
            hasAI={hasKey}
            photoError={photoError}
            photoImporting={photoImporting}
            theme={theme}
            targetFolderId={targetFolderId}
            librarySources={readyLibrarySources.map((source) => ({ id: source.id, name: source.name }))}
            libraryGenerating={libraryGenerating || aiLoading || resuming}
            onAiCountChange={setAiCount}
            onCreateFolder={handleCreateFolder}
            onCsvImport={handleCsvImport}
            onAnkiImport={() => { if (!guardBusy()) setAnkiModalOpen(true); }}
            onLibraryGenerate={generateDeckFromLibrary}
            onMistakeDeckCreate={createMistakeDeck}
            onPhotoImport={handlePhotoImport}
            onPdfImport={handlePdfImport}
            onQuickDeckCreate={createQuickDeck}
            onTargetFolderChange={handleTargetFolderChange}
          />
        </div>
      </div>

      {ankiModalOpen && (
        <AnkiImportModal
          folders={folders}
          theme={theme}
          onClose={() => setAnkiModalOpen(false)}
          onImported={(firstQuizId) => {
            setAnkiModalOpen(false);
            if (firstQuizId) navigate(`/flashcards/session/${firstQuizId}?mode=all`);
          }}
        />
      )}
    </div>
  );
}
