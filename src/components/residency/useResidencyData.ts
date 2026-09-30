import { useMemo } from 'react';
import { useAIStore, type AIKnowledgeSource } from '../../store/aiStore';
import { useQuizStore } from '../../store/quizStore';
import { useFolderStore } from '../../store/folderStore';
import { useStatsStore } from '../../store/statsStore';
import { findRezidentiatRootFolder } from '../../lib/rezidentiatRoot';
import { buildRezidentiatOverview, type RezidentiatOverview } from '../../lib/rezidentiatOverview';

/** The Rezidențiat discipline/specialty tree plus the user's progress through it. */
export function useRezidentiatOverview(): RezidentiatOverview {
  const folders = useFolderStore((state) => state.folders);
  const quizzes = useQuizStore((state) => state.quizzes);
  const sessions = useQuizStore((state) => state.sessions);
  const questionStats = useStatsStore((state) => state.questionStats);
  return useMemo(
    () => buildRezidentiatOverview(folders, quizzes, questionStats, sessions),
    [folders, quizzes, questionStats, sessions],
  );
}

/** Reference books filed under the Rezidențiat section of the AI library, and where to add more. */
export function useResidencyBooks(): { books: AIKnowledgeSource[]; addBookHref: string; hasLibraryRoot: boolean } {
  const knowledgeSources = useAIStore((state) => state.knowledgeSources);
  const libraryFolders = useAIStore((state) => state.libraryFolders);
  const root = useMemo(() => findRezidentiatRootFolder(libraryFolders), [libraryFolders]);
  const books = useMemo(
    () => (root ? knowledgeSources.filter((source) => source.folderId === root.id) : []),
    [knowledgeSources, root],
  );
  return { books, addBookHref: root ? `/vault?folder=${root.id}` : '/vault', hasLibraryRoot: !!root };
}
