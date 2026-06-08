import type { AIAnalysisResult, HintResult } from '../ai/types';
import type { Option, Question } from '../types';

function normalizeInlineText(value?: string | null) {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function pickQuestionTopic(question: Question) {
  return question.tags?.find(Boolean)?.trim() || question.difficulty || 'conceptul-cheie';
}

function pickLeadKeywords(text: string, limit = 3) {
  const words = normalizeInlineText(text)
    .split(/[^A-Za-z0-9]+/)
    .filter((word) => word.length >= 4);
  return uniqueStrings(words).slice(0, limit);
}

function buildAcronym(text: string) {
  const words = normalizeInlineText(text)
    .split(/\s+/)
    .filter((word) => word.length >= 3)
    .slice(0, 5);

  if (words.length === 0) return '';
  return words.map((word) => word[0]?.toUpperCase() ?? '').join('');
}

function summarizeExplanation(explanation?: string, maxLength = 220) {
  const clean = normalizeInlineText(explanation);
  if (!clean) return '';
  if (clean.length <= maxLength) return clean;

  const sentenceBreak = clean.lastIndexOf('. ', maxLength);
  if (sentenceBreak > 80) {
    return `${clean.slice(0, sentenceBreak + 1).trim()}`;
  }

  return `${clean.slice(0, maxLength).trim()}...`;
}

export function getCorrectOptionTexts(options: Option[]) {
  return options.filter((option) => option.isCorrect).map((option) => normalizeInlineText(option.text)).filter(Boolean);
}

export function getCorrectAnswerText(question: Question) {
  return getCorrectOptionTexts(question.options).join(', ');
}

export function getAnswerTextForOptionIds(
  options: Option[],
  selectedIds: string[],
  emptyFallback = 'niciun raspuns',
) {
  const selected = options
    .filter((option) => selectedIds.includes(option.id))
    .map((option) => normalizeInlineText(option.text))
    .filter(Boolean);

  return selected.length > 0 ? selected.join(', ') : emptyFallback;
}

export function buildHintFallback(question: Question): HintResult {
  const topic = pickQuestionTopic(question);
  const correctAnswer = getCorrectAnswerText(question) || 'varianta corecta';
  const explanationSummary = summarizeExplanation(question.explanation, 200);
  const anchorWords = pickLeadKeywords(correctAnswer, 2);
  const keywordHint = anchorWords.length > 0
    ? `Cauta varianta care se leaga direct de ${anchorWords.join(' si ')}.`
    : 'Cauta varianta care respecta criteriul cerut exact in intrebare.';

  return {
    light: `Gandeste-te mai intai la ${topic} si elimina variantele care suna corect, dar nu raspund exact la ce se cere.`,
    medium: `${keywordHint} Verifica mecanismul central, nu doar termenii familiari.`,
    full: explanationSummary
      ? `Raspunsul corect este: ${correctAnswer}. ${explanationSummary}`
      : `Raspunsul corect este: ${correctAnswer}.`,
  };
}

export function buildAnalysisFallback({
  question,
  userAnswer,
  correctAnswer,
  isCorrect,
}: {
  question: Question;
  userAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
}): AIAnalysisResult {
  const topic = pickQuestionTopic(question);
  const explanationSummary = summarizeExplanation(question.explanation, 240);
  const relatedConcepts = uniqueStrings([topic, ...(question.tags ?? [])]).slice(0, 5);
  const rule = explanationSummary || `Compara fiecare varianta doar cu criteriul principal din intrebare si revino la ${topic} cand ai dubii.`;
  const answerLabel = normalizeInlineText(userAnswer);
  const answerPrefix = answerLabel && answerLabel !== 'niciun raspuns'
    ? `Raspunsul tau (${answerLabel})`
    : 'Nu ai confirmat un raspuns';
  const correctOptionLine = correctAnswer
    ? `Varianta corecta este ${correctAnswer}: ea raspunde cel mai direct la mecanismul sau criteriul cerut.`
    : 'Varianta corecta trebuie legata de mecanismul central al intrebarii.';
  const selectedOptionLine = answerLabel && answerLabel !== 'niciun raspuns'
    ? `${answerPrefix} este gresit sau incomplet cand nu explica acel mecanism-cheie.`
    : `${answerPrefix}; trateaza asta ca pe un semn ca trebuie reconstruit rationamentul de la mecanism spre raspuns.`;
  const wrongDistractors = question.options
    .filter((option) => !option.isCorrect)
    .map((option) => normalizeInlineText(option.text))
    .filter((text) => text && text !== answerLabel)
    .slice(0, 2);
  const distractorLine = wrongDistractors.length > 0
    ? `Distractorii precum ${wrongDistractors.join(' / ')} pot suna plauzibil, dar pica daca ii compari strict cu datele din intrebare.`
    : 'Distractorii pica atunci cand ii compari strict cu datele din intrebare, nu cu termenii familiari.';
  const mechanismLine = `Fiziologic/fiziopatologic, porneste de la ${topic}: identifica procesul afectat, apoi semnul clinic, diagnosticul sau tratamentul care decurge logic din el.`;

  const explanation = isCorrect
    ? explanationSummary
      ? `Ai ales corect. ${correctOptionLine} ${mechanismLine} ${explanationSummary}`
      : `Ai ales corect. ${correctOptionLine} ${mechanismLine} Pastreaza in minte criteriul central pentru ${topic}.`
    : explanationSummary
      ? `${selectedOptionLine} ${correctOptionLine} ${distractorLine} ${mechanismLine} ${explanationSummary}`
      : `${selectedOptionLine} ${correctOptionLine} ${distractorLine} ${mechanismLine} Revino la ${topic} si compara mecanismul-cheie cu fiecare optiune.`;

  return {
    explanation,
    mistakeType: isCorrect
      ? 'Raspuns corect consolidat'
      : answerLabel && answerLabel !== 'niciun raspuns'
        ? 'Confuzie intre optiuni apropiate'
        : 'Lipsa de confirmare',
    rule,
    confidence: isCorrect ? 0.74 : 0.58,
    missingConcept: topic,
    recommendedTopic: topic,
    relatedConcepts,
    sources: relatedConcepts.slice(0, 3),
  };
}

export function buildMnemonicFallback(concept: string, correctAnswer: string) {
  const cleanConcept = normalizeInlineText(concept) || 'conceptul';
  const cleanAnswer = normalizeInlineText(correctAnswer) || 'raspunsul corect';
  const acronym = buildAcronym(cleanAnswer);
  const anchor = acronym || pickLeadKeywords(cleanAnswer, 2).join('-') || cleanAnswer.split(/\s+/).slice(0, 2).join(' ');

  return `Leaga ${cleanConcept} de ancora "${anchor}". Cand vezi tema aceasta, repeta imediat: ${cleanAnswer}.`;
}

export function buildClarificationFallback(
  question: Question,
  userAnswerText: string,
  correctAnswerText: string,
) {
  return buildAnalysisFallback({
    question,
    userAnswer: userAnswerText,
    correctAnswer: correctAnswerText,
    isCorrect: false,
  }).explanation;
}
