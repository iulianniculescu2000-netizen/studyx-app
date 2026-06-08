import type { QuizColor } from '../../types';

export type StudioChatSource = {
  id: string;
  name: string;
};

export type StudioChatFolder = {
  id: string;
  name: string;
  emoji: string;
  color: QuizColor;
};

export type ParsedStudioCommand = {
  shouldGenerate: boolean;
  packCount: number | null;
  questionsPerPack: number | null;
  difficulty: 'auto' | 'easy' | 'medium' | 'hard' | null;
  sourceName: string | null;
  folderName: string | null;
};

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function titleCase(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((entry) => entry.charAt(0).toUpperCase() + entry.slice(1))
    .join(' ');
}

function matchEntityByName<T extends { name: string }>(text: string, items: T[]) {
  const normalizedText = normalize(text);
  let best: T | null = null;
  let bestScore = 0;

  for (const item of items) {
    const candidate = normalize(item.name);
    if (!candidate) continue;

    if (normalizedText.includes(candidate)) {
      const score = candidate.length;
      if (score > bestScore) {
        best = item;
        bestScore = score;
      }
    }
  }

  return best;
}

function extractFirstNumber(patterns: RegExp[], text: string) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const value = Number(match[1]);
      if (Number.isFinite(value) && value > 0) return value;
    }
  }
  return null;
}

function extractNamedTarget(patterns: RegExp[], text: string) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    const value = match?.[1]?.trim();
    if (value) return titleCase(value.replace(/^["']|["']$/g, '').trim());
  }
  return null;
}

export function parseStudioChatCommand(text: string): ParsedStudioCommand {
  const normalized = normalize(text);
  const asksForQuiz = /\b(grile|grila|intrebari|intrebare|quiz|pachete|seturi|batch)\b/.test(normalized);
  const asksForGeneration = /\b(genereaza|creeaza|fa mi|fa mi te rog|vreau|pregateste|construieste|produce)\b/.test(normalized);

  const packCount = extractFirstNumber([
    /(\d+)\s+(?:pachete|seturi|batch(?:uri)?)/i,
    /(?:fa|genereaza|creeaza|vreau)\s+(\d+)\s+(?:de\s+)?(?:pachete|seturi)/i,
  ], text);

  const questionsPerPack = extractFirstNumber([
    /a\s+c(?:a|ă)te\s+(\d+)\s+(?:de\s+)?(?:grile|intrebari|întrebări|intrebari)/i,
    /(?:cu|cate|câte)\s+(\d+)\s+(?:de\s+)?(?:grile|intrebari|întrebări)\s+(?:pe|per)\s+(?:pachet|set|batch)/i,
    /(\d+)\s+(?:de\s+)?(?:grile|intrebari|întrebări)\s+(?:pe|per)\s+(?:pachet|set|batch)/i,
  ], text);

  const folderName = extractNamedTarget([
    /(?:in|în)\s+folder(?:ul)?\s+["“]?([^"”.,\n]+)["”]?/i,
    /(?:salveaza|salvează|pune)\s+(?:le\s+)?(?:in|în)\s+["“]?([^"”.,\n]+)["”]?/i,
  ], text);

  const sourceName = extractNamedTarget([
    /(?:din|pentru)\s+curs(?:ul)?\s+["“]?([^"”.,\n]+)["”]?/i,
    /(?:din|pentru)\s+document(?:ul)?\s+["“]?([^"”.,\n]+)["”]?/i,
    /(?:din|pentru)\s+["“]([^"”]+)["”]/i,
  ], text);

  let difficulty: ParsedStudioCommand['difficulty'] = null;
  if (/\b(auto|adaptiv|automat)\b/.test(normalized)) difficulty = 'auto';
  else if (/\b(usor|ușor|easy)\b/.test(normalized)) difficulty = 'easy';
  else if (/\b(mediu|medium)\b/.test(normalized)) difficulty = 'medium';
  else if (/\b(dificil|greu|hard)\b/.test(normalized)) difficulty = 'hard';

  return {
    shouldGenerate: asksForQuiz && asksForGeneration,
    packCount,
    questionsPerPack,
    difficulty,
    sourceName,
    folderName,
  };
}

export function resolveStudioSourceFromCommand<T extends StudioChatSource>(
  text: string,
  sources: T[],
  scopedSource?: T | null,
) {
  const directMatch = matchEntityByName(text, sources);
  if (directMatch) return directMatch;
  if (scopedSource && sources.some((source) => source.id === scopedSource.id)) return scopedSource;
  if (sources.length === 1) return sources[0];
  return null;
}

export function resolveStudioFolderFromCommand<T extends StudioChatFolder>(
  text: string,
  folders: T[],
  selectedFolder?: T | null,
) {
  if (/\b(neclasificat|neclasificate|fara folder|fără folder)\b/i.test(normalize(text))) {
    return { kind: 'uncategorized' as const };
  }

  const directMatch = matchEntityByName(text, folders);
  if (directMatch) {
    return { kind: 'existing' as const, folder: directMatch };
  }

  const namedFolder = parseStudioChatCommand(text).folderName;
  if (namedFolder) {
    return { kind: 'create' as const, name: namedFolder };
  }

  if (selectedFolder) {
    return { kind: 'existing' as const, folder: selectedFolder };
  }

  return { kind: 'uncategorized' as const };
}

export function buildStudioCommandHelp(sources: StudioChatSource[], folders: StudioChatFolder[]) {
  const sourceHint = sources.slice(0, 3).map((source) => source.name).join(', ');
  const folderHint = folders.slice(0, 3).map((folder) => folder.name).join(', ');

  return [
    'Poți scrie direct în chat, de exemplu:',
    '1. Fă-mi 12 pachete a câte 20 de grile din cursul Cardiologie în folderul Rezidențiat.',
    '2. Generează 6 seturi a câte 15 întrebări din documentul Fiziologie, dificultate mediu.',
    sourceHint ? `Surse detectate acum: ${sourceHint}.` : 'Nu ai încă documente indexate în Bibliotecă.',
    folderHint ? `Foldere disponibile: ${folderHint}.` : 'Nu ai încă foldere; pot crea unul direct din comandă.',
  ].join('\n');
}
