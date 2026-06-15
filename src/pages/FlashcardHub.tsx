import { motion } from 'framer-motion';
import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CreditCard } from 'lucide-react';
import { useTheme } from '../theme/ThemeContext';
import { useQuizStore } from '../store/quizStore';
import { useStatsStore } from '../store/statsStore';
import { useAIStore } from '../store/aiStore';
import { useUserStore } from '../store/userStore';
import { useFolderStore } from '../store/folderStore';
import { notesToFlashcards } from '../lib/groq';
import { buildMistakeFlashcardQuiz } from '../lib/adaptiveStudy';
import { extractCaptionedImagesFromPdf, renderPdfPagesAsImages, renderPdfPagesWithText, resizeImageFile, type CaptionedPdfImage, type PdfFlashcardPageSnapshot } from '../lib/imageProcessing';
import { flashcardImageKey, flashcardImageRef, putFlashcardImage } from '../lib/flashcardImageStore';
import { isFlashcardDeck } from '../lib/deckKind';
import { CARD_COLOR_MAP } from '../theme/colorMaps';
import type { Difficulty, Question } from '../types';
import { suggestFolderAppearance } from '../lib/folderAppearance';
import { FlashcardDeckGrid, FlashcardHubActions } from './flashcard-hub/sections';

function generateId() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
}

const OPTION_IDS = ['a', 'b', 'c', 'd', 'e', 'f'];
const FLASHCARD_ANSWER_SOFT_LIMIT = 210;
const VISUAL_FLASHCARD_IMAGE_MAX_EDGE = 1680;
const USE_NATIVE_TEXT_ONLY_PDF_IMPORT = false;
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
    for (const sentence of sentences) {
      const candidate = `${answer} ${sentence}`.trim();
      if (candidate.length > FLASHCARD_ANSWER_SOFT_LIMIT) break;
      answer = candidate;
      if (answer.length >= 120) break;
    }

    if (answer) {
      explanation = cleaned.slice(answer.length).trim().replace(/^[,;:\-\s]+/, '');
    }
  }

  if (!answer) {
    const softCut = cleaned.lastIndexOf(' ', FLASHCARD_ANSWER_SOFT_LIMIT);
    const splitIndex = softCut > 96 ? softCut : FLASHCARD_ANSWER_SOFT_LIMIT;
    answer = `${cleaned.slice(0, splitIndex).trim()}...`;
    explanation = cleaned.slice(splitIndex).trim().replace(/^[,;:\-\s]+/, '');
  }

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

function attachRelevantPdfImages(questions: Question[], pages: PdfFlashcardPageSnapshot[]) {
  if (pages.length === 0 || questions.length === 0) return questions;

  const visualCandidates = pages
    .flatMap((page) => page.visuals.map((visual) => ({ page, visual })))
    .slice(0, 40);
  if (visualCandidates.length === 0) return questions;

  const usedPages = new Set<number>();

  return questions.map((question) => {
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
  const { quizzes, addQuiz } = useQuizStore();
  const folders = useFolderStore((state) => state.folders);
  const addFolder = useFolderStore((state) => state.addFolder);
  const { questionStats, getDueQuestions } = useStatsStore();
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

  // One card per captioned course photo (front = image, back = verbatim caption).
  const generateVisualDeckFromCaptions = async (captioned: CaptionedPdfImage[], sourceName: string) => {
    const deckId = generateId();
    await Promise.all(
      captioned.map((entry) => putFlashcardImage(flashcardImageKey(deckId, entry.tag), entry.imageDataUrl)),
    );

    const questions: Question[] = captioned.map((entry) => buildPhotoCardQuestion(entry, deckId));
    const baseName = sourceName.replace(/\.[^.]+$/, '') || 'Curs';

    addQuiz({
      id: deckId,
      title: `Atlas foto · ${baseName}`,
      description: `${questions.length} carduri vizuale din ${sourceName}. Față = imaginea din curs, spate = descrierea originală.`,
      emoji: '🩺',
      color: selectedFolder?.color ?? 'pink',
      category: selectedFolder?.name ?? 'Atlas vizual',
      folderId: selectedFolder?.id ?? null,
      kind: 'flashcard',
      shuffleQuestions: true,
      shuffleAnswers: false,
      tags: ['ai', 'foto', 'atlas'],
      questions,
      createdAt: Date.now(),
    });

    navigate(`/flashcards/session/${deckId}?mode=all`);
  };

  const existingFlashcardFronts = useMemo(() => (
    quizzes
      .filter((quiz) => (quiz.tags ?? []).some((tag) => /flashcard|deck|ai|pdf/i.test(tag)))
      .flatMap((quiz) => quiz.questions.map((question) => question.text))
  ), [quizzes]);

  const generateDeckFromPdf = async (text: string, sourceName = 'PDF', pages: PdfFlashcardPageSnapshot[] = []) => {
    setAiLoading(true);
    setAiError('');

    try {
      const generated = await notesToFlashcards(text, {
        count: aiCount,
        avoidFronts: existingFlashcardFronts,
        sourceName,
      });
      const questions: Question[] = attachRelevantPdfImages(
        generated.map((entry) => buildFlashcardQuestion(entry.front, entry.back)),
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

      addQuiz({
        id,
        title: `Deck AI · ${new Date().toLocaleDateString('ro-RO')}`,
        description: `Flashcarduri smart generate din ${sourceName}. Imaginile relevante din PDF sunt pastrate pe cardurile potrivite.`,
        emoji: '🤖',
        color: selectedFolder?.color ?? 'purple',
        category: selectedFolder?.name ?? 'AI Flashcards',
        folderId: selectedFolder?.id ?? null,
        kind: 'flashcard',
        shuffleQuestions: true,
        shuffleAnswers: true,
        tags: ['ai', 'pdf'],
        questions,
        createdAt: Date.now(),
      });

      navigate(`/flashcards/session/${id}?mode=all`);
    } catch (error: unknown) {
      setAiError(error instanceof Error ? error.message : 'Eroare la generare.');
    } finally {
      setAiLoading(false);
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
    if (!source || libraryGenerating || aiLoading) return;

    setLibraryGenerating(true);
    setAiError('');
    setAiProgress(`Citesc „${source.name}" din bibliotecă...`);

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
      const generated = await notesToFlashcards(text, {
        count: aiCount,
        avoidFronts: existingFlashcardFronts,
        sourceName: source.name,
      });
      const questions = generated.map((entry) => buildFlashcardQuestion(entry.front, entry.back));
      if (questions.length === 0) {
        throw new Error('AI nu a putut genera flashcarduri din acest curs.');
      }

      const id = generateId();
      addQuiz({
        id,
        title: `Flashcarduri · ${source.name.replace(/\.[^.]+$/, '')}`,
        description: `${questions.length} flashcarduri AI pe subpunctele cursului „${source.name}".`,
        emoji: '🤖',
        color: selectedFolder?.color ?? 'purple',
        category: selectedFolder?.name ?? 'AI Flashcards',
        kind: 'flashcard',
        folderId: selectedFolder?.id ?? null,
        shuffleQuestions: true,
        shuffleAnswers: true,
        tags: ['ai', 'flashcard', 'biblioteca'],
        questions,
        createdAt: Date.now(),
      });

      navigate(`/flashcards/session/${id}?mode=all`);
    } catch (error: unknown) {
      setAiError(error instanceof Error ? error.message : 'Eroare la generarea din bibliotecă.');
    } finally {
      setLibraryGenerating(false);
      setAiProgress('');
    }
  };

  const handlePdfImport = async () => {
    if (USE_NATIVE_TEXT_ONLY_PDF_IMPORT && window.electronAPI?.openPdfFile) {
      const text = await window.electronAPI.openPdfFile();
      if (text) {
        await generateDeckFromPdf(text);
      } else {
        setAiError('Nu s-a putut extrage text din PDF. Încearcă un alt fișier.');
      }
      return;
    }

    const input = fileInputRef.current;
    if (!input) return;
    input.value = '';
    input.click();
  };

  const handleCsvImport = () => {
    const input = csvInputRef.current;
    if (!input) return;
    input.value = '';
    input.click();
  };

  const handlePhotoImport = () => {
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

  const dueQuestions = getDueQuestions();
  const totalDue = dueQuestions.length;

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

  return (
    <div className="h-full overflow-y-auto px-4 sm:px-8 py-6 sm:py-8">
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

      <div className="max-w-4xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <div
                className="w-12 h-12 rounded-[18px] flex items-center justify-center shadow-lg"
                style={{ background: `linear-gradient(135deg, ${theme.accent2} 0%, ${theme.accent} 100%)`, color: '#fff' }}
              >
                <CreditCard size={24} />
              </div>
              <div>
                <h1 className="text-3xl font-black tracking-tight mb-0.5" style={{ color: theme.text }}>
                  Flashcarduri
                </h1>
                <p className="text-[11px] font-black uppercase tracking-widest opacity-60" style={{ color: theme.text }}>
                  Repetare Spațiată · SM-2
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        <FlashcardHubActions
          aiCount={aiCount}
          aiError={aiError}
          aiLoading={aiLoading}
          aiProgress={aiProgress}
          csvError={csvError}
          csvImporting={csvImporting}
          folders={folders}
          hasAI={hasKey}
          photoError={photoError}
          photoImporting={photoImporting}
          theme={theme}
          totalCards={totalCards}
          totalDue={totalDue}
          totalMastered={totalMastered}
          targetFolderId={targetFolderId}
          librarySources={readyLibrarySources.map((source) => ({ id: source.id, name: source.name }))}
          libraryGenerating={libraryGenerating}
          onAiCountChange={setAiCount}
          onCreateFolder={handleCreateFolder}
          onCsvImport={handleCsvImport}
          onLibraryGenerate={generateDeckFromLibrary}
          onMistakeDeckCreate={createMistakeDeck}
          onPhotoImport={handlePhotoImport}
          onPdfImport={handlePdfImport}
          onQuickDeckCreate={createQuickDeck}
          onTargetFolderChange={handleTargetFolderChange}
        />

        <FlashcardDeckGrid decks={decks} folders={folders} theme={theme} />
      </div>
    </div>
  );
}
