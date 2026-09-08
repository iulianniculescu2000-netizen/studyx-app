/**
 * Single source of truth for "the Rezidențiat root folder" name and lookup,
 * shared across the two independent stores that each keep their own folder
 * with this exact name (`useFolderStore`'s quiz folders and `useAIStore`'s
 * AI-library folders — see rezidentiatBank.ts / rezidentiatLibrary.ts).
 *
 * Before this existed, five separate files each declared their own copy of
 * the string 'Rezidențiat' and, in two of them, matched it at ANY folder
 * depth instead of only at the root — since folder creation is completely
 * unconstrained (including from the AI agent), a nested folder someone named
 * "Rezidențiat" would get misidentified as the actual root. Every lookup
 * should go through here instead of re-declaring the name or the check.
 */
import { useFolderStore } from '../store/folderStore';

export const REZIDENTIAT_ROOT_NAME = 'Rezidențiat';
/** Where AI-generated chapter flashcard decks land — kept separate from the discipline/specialty tree the real question banks build, so generated content doesn't get mixed in with verified imports. */
export const REZIDENTIAT_AI_FLASHCARDS_FOLDER_NAME = '🃏 Flashcarduri AI';

interface NamedFolder {
  id: string;
  name: string;
  parentId: string | null | undefined;
}

function normalize(name: string): string {
  return name.trim().toLowerCase();
}

/** True only for a TOP-LEVEL folder named exactly "Rezidențiat" — never a nested one. */
export function isRezidentiatRootFolder(folder: NamedFolder): boolean {
  return !folder.parentId && normalize(folder.name) === normalize(REZIDENTIAT_ROOT_NAME);
}

/** The one true root folder in a folder list, or null if it doesn't exist yet. */
export function findRezidentiatRootFolder<T extends NamedFolder>(folders: T[]): T | null {
  return folders.find(isRezidentiatRootFolder) ?? null;
}

/** Whether `folderId` is the Rezidențiat root itself or nested anywhere under it. */
export function isUnderRezidentiatRoot(folderId: string, folders: NamedFolder[]): boolean {
  let folder = folders.find((f) => f.id === folderId);
  while (folder) {
    if (!folder.parentId) return isRezidentiatRootFolder(folder);
    folder = folders.find((f) => f.id === folder!.parentId);
  }
  return false;
}

/**
 * Finds (or creates) the "🃏 Flashcarduri AI" subfolder under the Rezidențiat
 * root, creating the root itself first if it doesn't exist yet (e.g. no real
 * bank has been imported, but the user generates flashcards straight away).
 * Talks to `useFolderStore` directly — mirrors the pattern already used by
 * `rezidentiatBank.ts`'s `findOrCreateFolder`, just for this one fixed subfolder.
 */
export function findOrCreateAiFlashcardsFolder(): string {
  const { folders, addFolder } = useFolderStore.getState();

  const root = findRezidentiatRootFolder(folders) ?? { id: addFolder(REZIDENTIAT_ROOT_NAME, '🩺', 'blue', null) };
  const existing = folders.find(
    (f) => f.parentId === root.id && f.name.trim().toLowerCase() === REZIDENTIAT_AI_FLASHCARDS_FOLDER_NAME.toLowerCase(),
  );
  if (existing) return existing.id;
  return addFolder(REZIDENTIAT_AI_FLASHCARDS_FOLDER_NAME, '🃏', 'purple', root.id);
}
