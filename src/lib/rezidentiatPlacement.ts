import { useFolderStore } from '../store/folderStore';
import type { Folder } from '../types';
import { REZIDENTIAT_ROOT_NAME, findRezidentiatRootFolder, isUnderRezidentiatRoot } from './rezidentiatRoot';
import { bookDisciplineHint, disciplineKey } from './rezidentiatOverview';

interface NamedFolder {
  id: string;
  name: string;
  parentId?: string | null;
}

export interface ResidencyPlacement {
  disciplineName: string;
  specialtyName: string;
  /** Existing folder ids, when the discipline / specialty is already in the tree. */
  disciplineId: string | null;
  specialtyId: string | null;
}

const DISCIPLINE_NAMES = { chirurgie: 'Chirurgie', 'medicina-interna': 'Medicină internă' } as const;
const STOP_WORDS = new Set(['si', 'de', 'ale', 'al', 'la', 'in', 'cu', 'pe', 'a']);

const plain = (value: string) => value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ');

/**
 * A forgiving name key: diacritics, case, stop-words and word endings are
 * ignored, so "DIABETUL ZAHARAT", "Diabet zaharat" and "Diabetul zaharat" are
 * the same specialty, and "Bolile hepatice" matches "Boli hepatice".
 */
export function specialtyKey(name: string): string {
  return plain(name)
    .split(/\s+/)
    .filter((word) => word && !STOP_WORDS.has(word))
    .map((word) => word.slice(0, 4))
    .join(' ');
}

/** "CARDIOLOGIE" → "Cardiologie"; already-mixed-case titles are left alone. */
export function tidySpecialtyName(raw: string): string {
  const cleaned = raw.replace(/^\s*\d+[.)]?\s*/, '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return cleaned;
  const letters = cleaned.replace(/[^\p{L}]/gu, '');
  const isShouting = letters.length > 3 && letters === letters.toLocaleUpperCase('ro');
  const base = isShouting ? cleaned.toLocaleLowerCase('ro') : cleaned;
  return base.charAt(0).toLocaleUpperCase('ro') + base.slice(1);
}

const bookLabel = (sourceName: string) => sourceName.replace(/\.(pdf|docx|txt|md)$/i, '').trim();

function guessDisciplineFromChapter(chapter: string): 'chirurgie' | 'medicina-interna' {
  return /chirurg|ortoped|urolog|otorino|\borl\b|oftalm|traum|arsur|hernii|plag/.test(plain(chapter)) ? 'chirurgie' : 'medicina-interna';
}

/**
 * Decides where quizzes generated from a book (or one of its chapters) belong
 * in the Rezidențiat tree, reusing folders that already exist — the imported
 * question banks share the same specialties — and only naming new ones.
 *
 * Pure: takes the current quiz folders, returns names (and ids when found).
 */
export function resolveResidencyPlacement(
  sourceName: string,
  chapterHeading: string | null,
  folders: NamedFolder[],
): ResidencyPlacement {
  const root = findRezidentiatRootFolder(folders);
  const disciplineFolders = root ? folders.filter((f) => f.parentId === root.id) : [];
  const specialtyName = chapterHeading ? tidySpecialtyName(chapterHeading) : bookLabel(sourceName);

  // 1. The specialty already exists under some discipline → stay there.
  if (chapterHeading) {
    const wanted = specialtyKey(specialtyName);
    for (const discipline of disciplineFolders) {
      const match = folders.find((f) => f.parentId === discipline.id && specialtyKey(f.name) === wanted);
      if (match) {
        return { disciplineName: discipline.name, specialtyName: match.name, disciplineId: discipline.id, specialtyId: match.id };
      }
    }
  }

  // 2. Otherwise the book (then the chapter's own name) decides the discipline.
  const key = bookDisciplineHint(sourceName) ?? guessDisciplineFromChapter(chapterHeading ?? sourceName);
  const existing = disciplineFolders.find((f) => disciplineKey(f.name) === key);
  const disciplineName = existing?.name ?? DISCIPLINE_NAMES[key];

  // A whole-book pack has no chapter to match; reuse a same-named specialty if it's there.
  const sameName = existing ? folders.find((f) => f.parentId === existing.id && specialtyKey(f.name) === specialtyKey(specialtyName)) : undefined;
  return { disciplineName, specialtyName: sameName?.name ?? specialtyName, disciplineId: existing?.id ?? null, specialtyId: sameName?.id ?? null };
}

/** Finds a same-named child folder, or creates it — case- and diacritic-insensitive on the name. */
function findOrCreateChild(name: string, parentId: string | null, emoji: string): Folder {
  const { folders, addFolder } = useFolderStore.getState();
  const wanted = plain(name).trim();
  const found = folders.find((f) => (f.parentId ?? null) === parentId && plain(f.name).trim() === wanted);
  if (found) return found;
  const id = addFolder(name, emoji, 'blue', parentId);
  return useFolderStore.getState().folders.find((f) => f.id === id) as Folder;
}

/**
 * Makes sure Rezidențiat → discipline → specialty exists for this book/chapter
 * and returns the specialty folder to file the generated quizzes into.
 */
export function ensureResidencyFolder(sourceName: string, chapterHeading: string | null): Folder {
  const placement = resolveResidencyPlacement(sourceName, chapterHeading, useFolderStore.getState().folders);
  const root = findOrCreateChild(REZIDENTIAT_ROOT_NAME, null, '🩺');
  const discipline = placement.disciplineId
    ? (useFolderStore.getState().folders.find((f) => f.id === placement.disciplineId) as Folder)
    : findOrCreateChild(placement.disciplineName, root.id, '📚');
  return placement.specialtyId
    ? (useFolderStore.getState().folders.find((f) => f.id === placement.specialtyId) as Folder)
    : findOrCreateChild(placement.specialtyName, discipline.id, '🩹');
}

/** True when a library source is filed anywhere under the AI library's Rezidențiat section. */
export function isResidencySource(source: { folderId?: string | null }, libraryFolders: NamedFolder[]): boolean {
  return !!source.folderId && isUnderRezidentiatRoot(source.folderId, libraryFolders);
}
