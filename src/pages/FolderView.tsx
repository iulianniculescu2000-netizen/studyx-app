import { motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Check, CalendarDays, FolderPlus, Layers, Plus, Shuffle, X } from 'lucide-react';
import { useTheme } from '../theme/ThemeContext';
import { useFolderStore } from '../store/folderStore';
import { useQuizStore } from '../store/quizStore';
import QuizCard from '../components/QuizCard';
import ImportQuizButton from '../components/ImportQuizButton';
import ExamSplitModal from '../components/ExamSplitModal';
import ConfirmDialog from '../components/ConfirmDialog';
import { isFlashcardDeck } from '../lib/deckKind';
import type { Quiz, QuizColor } from '../types';

const COLOR_HEX: Record<string, string> = {
  blue: '#0A84FF', purple: '#5E5CE6', green: '#30D158',
  orange: '#FF9F0A', pink: '#FF375F', red: '#FF453A', teal: '#5AC8FA',
};
const FOLDER_COLORS = Object.keys(COLOR_HEX) as QuizColor[];

export default function FolderView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const theme = useTheme();
  const { folders, addFolder } = useFolderStore();
  const { getQuizzesByFolder, quizzes: allQuizzes, addQuiz, deleteQuiz } = useQuizStore();
  const [creatingSubfolder, setCreatingSubfolder] = useState(false);
  const [subfolderName, setSubfolderName] = useState('');
  const [subfolderEmoji, setSubfolderEmoji] = useState('📁');
  const [subfolderColor, setSubfolderColor] = useState<QuizColor>('blue');
  const [showExamSplit, setShowExamSplit] = useState(false);
  const [confirmPlayAll, setConfirmPlayAll] = useState(false);

  const isNull = id === 'null';
  const folder = isNull ? null : folders.find(f => f.id === id);
  const folderQuizzes = getQuizzesByFolder(isNull ? null : id ?? null);
  const realQuizzes = folderQuizzes.filter((q) => !isFlashcardDeck(q));
  const childFolders = isNull ? [] : folders.filter((candidate) => candidate.parentId === id);

  const title = isNull ? '📋 Neclasificate' : folder ? `${folder.emoji} ${folder.name}` : 'Folder';
  const accentColor = folder ? (COLOR_HEX[folder.color] ?? theme.accent) : theme.text3;

  // A folder holding only subfolders (e.g. a discipline like "Chirurgie")
  // otherwise always read "0 grile" even when it has hundreds nested a level
  // down — recurse so the count reflects what's actually inside the tree.
  const countRecursive = (folderId: string): number => {
    const own = getQuizzesByFolder(folderId).length;
    const children = folders.filter((f) => f.parentId === folderId);
    return own + children.reduce((sum, child) => sum + countRecursive(child.id), 0);
  };
  const totalQuizCount = useMemo(
    () => (folder ? countRecursive(folder.id) : folderQuizzes.length),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [folder, folders, folderQuizzes.length],
  );
  // Every real (non-flashcard) quiz under this folder, including subfolders —
  // what "Joacă tot folderul" combines into one session.
  const collectQuizzesRecursive = (folderId: string): Quiz[] => {
    const own = getQuizzesByFolder(folderId).filter((q) => !isFlashcardDeck(q));
    const children = folders.filter((f) => f.parentId === folderId);
    return children.reduce((acc, child) => acc.concat(collectQuizzesRecursive(child.id)), own);
  };
  const playableSets = useMemo(
    () => (folder ? collectQuizzesRecursive(folder.id) : realQuizzes),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [folder, folders, allQuizzes],
  );
  const playableQuestionCount = useMemo(
    () => playableSets.reduce((sum, q) => sum + q.questions.length, 0),
    [playableSets],
  );

  const handlePlayFolder = () => {
    if (!folder || playableSets.length === 0) return;
    const mergedQuestions = playableSets.flatMap((q) => q.questions);
    const sessionTag = `folder-session:${folder.id}`;
    // A repeat run shouldn't leave the previous combined session sitting in
    // the folder forever — only the latest one is ever useful.
    const stale = allQuizzes.find((q) => q.tags?.includes(sessionTag));
    if (stale) deleteQuiz(stale.id, { keepImages: true });
    const merged: Quiz = {
      id: crypto.randomUUID().replace(/-/g, '').slice(0, 12),
      title: `${folder.name} — sesiune completă`,
      description: `Combină ${playableSets.length} seturi, ${mergedQuestions.length} întrebări.`,
      emoji: folder.emoji,
      category: folder.name,
      kind: 'quiz',
      folderId: folder.id,
      color: folder.color,
      questions: mergedQuestions,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      shuffleQuestions: true,
      shuffleAnswers: false,
      tags: [sessionTag],
    };
    addQuiz(merged);
    setConfirmPlayAll(false);
    navigate(`/play/${merged.id}`);
  };

  const parentFolder = folder?.parentId ? folders.find((f) => f.id === folder.parentId) : null;
  // The root "Rezidențiat" folder is deliberately absent from "Toate grilele"
  // (kept separate from the year's coursework) — sending its own "back" there
  // would point at a list that never shows it. Its true home is its own page.
  const isRezidentiatRoot = !!folder && !folder.parentId && folder.name.trim().toLowerCase() === 'rezidențiat';
  const backHref = folder
    ? (folder.parentId ? `/folder/${folder.parentId}` : isRezidentiatRoot ? '/rezidentiat' : '/quizzes')
    : null;
  const backLabel = folder ? (parentFolder ? parentFolder.name : isRezidentiatRoot ? 'Rezidențiat' : 'Toate grilele') : null;

  const openSubfolderForm = () => {
    if (!folder) return;
    setSubfolderColor(folder.color);
    setSubfolderEmoji('📁');
    setCreatingSubfolder(true);
  };

  const closeSubfolderForm = () => {
    setCreatingSubfolder(false);
    setSubfolderName('');
    setSubfolderEmoji('📁');
    setSubfolderColor(folder?.color ?? 'blue');
  };

  const handleCreateSubfolder = () => {
    const name = subfolderName.trim();
    if (!folder || !name) return;
    addFolder(name, subfolderEmoji.trim() || '📁', subfolderColor, folder.id);
    closeSubfolderForm();
  };

  return (
    <div className="h-full overflow-y-auto px-8 py-8">
      <div className="max-w-4xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          {backHref && (
            <Link
              to={backHref}
              className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold transition-opacity hover:opacity-80"
              style={{ color: theme.text3 }}
            >
              <ArrowLeft size={15} />Înapoi la {backLabel}
            </Link>
          )}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight" style={{ color: theme.text }}>{title}</h1>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
                  style={{ background: theme.surface2, color: theme.text2 }}
                >
                  <Layers size={12} style={{ opacity: 0.7 }} />
                  {totalQuizCount} {totalQuizCount === 1 ? 'set' : 'seturi'}
                  {childFolders.length > 0 && totalQuizCount !== folderQuizzes.length ? ' în total' : ''}
                </span>
                {childFolders.length > 0 && (
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
                    style={{ background: theme.surface2, color: theme.text2 }}
                  >
                    <FolderPlus size={12} style={{ opacity: 0.7 }} />
                    {childFolders.length} {childFolders.length === 1 ? 'subfolder' : 'subfoldere'}
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {folder && (
                <button
                  type="button"
                  onClick={openSubfolderForm}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-medium transition-all"
                  style={{ background: theme.surface, border: `1px solid ${theme.border}`, color: theme.text }}
                >
                  <FolderPlus size={15} />Subfolder nou
                </button>
              )}
              <ImportQuizButton targetFolderId={id === 'null' ? null : id} />
              {realQuizzes.reduce((n, q) => n + q.questions.length, 0) >= 2 && (
                <button
                  type="button"
                  data-tutorial="btn-exam-split"
                  onClick={() => setShowExamSplit(true)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-medium transition-all"
                  style={{ background: theme.surface2, border: `1px solid ${theme.border2}`, color: theme.text2 }}
                >
                  <CalendarDays size={15} />Distribuie pe zile
                </button>
              )}
              {playableSets.length > 1 && (
                <button
                  type="button"
                  onClick={() => setConfirmPlayAll(true)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold text-white transition-all"
                  style={{ background: theme.success }}
                >
                  <Shuffle size={15} />Joacă tot folderul
                </button>
              )}
              <Link to={`/create?folder=${id}`}
                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-medium text-white"
                style={{ background: `linear-gradient(135deg, ${accentColor}, ${theme.accent2})` }}>
                <Plus size={15} />Grilă nouă
              </Link>
            </div>
          </div>
        </motion.div>

        {folder && creatingSubfolder && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-panel mb-6 rounded-2xl p-4"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <input
                value={subfolderEmoji}
                onChange={(event) => setSubfolderEmoji(event.target.value.slice(0, 4))}
                className="h-11 w-full rounded-xl px-3 text-center text-xl sm:w-16"
                style={{ background: theme.surface2, border: `1px solid ${theme.border}`, color: theme.text }}
                aria-label="Emoji subfolder"
              />
              <input
                value={subfolderName}
                onChange={(event) => setSubfolderName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') handleCreateSubfolder();
                  if (event.key === 'Escape') closeSubfolderForm();
                }}
                autoFocus
                placeholder="Nume subfolder"
                className="h-11 min-w-0 flex-1 rounded-xl px-4 text-sm font-semibold outline-none"
                style={{ background: theme.surface2, border: `1px solid ${theme.border}`, color: theme.text }}
              />
              <div className="flex items-center gap-2">
                {FOLDER_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setSubfolderColor(color)}
                    className="h-8 w-8 rounded-full transition-transform hover:scale-110"
                    style={{
                      background: COLOR_HEX[color],
                      boxShadow: subfolderColor === color ? `0 0 0 3px ${COLOR_HEX[color]}40` : 'none',
                      border: subfolderColor === color ? `2px solid ${theme.text}` : '2px solid transparent',
                    }}
                    aria-label={`Culoare ${color}`}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCreateSubfolder}
                  disabled={!subfolderName.trim()}
                  className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl px-4 text-sm font-black text-white disabled:opacity-50 sm:flex-none"
                  style={{ background: accentColor }}
                >
                  <Check size={15} />Creeaza
                </button>
                <button
                  type="button"
                  onClick={closeSubfolderForm}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-xl"
                  style={{ background: theme.surface2, color: theme.text3, border: `1px solid ${theme.border}` }}
                  aria-label="Inchide formularul"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {childFolders.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
            <h2 className="text-sm font-black uppercase tracking-wider mb-3" style={{ color: theme.text3 }}>
              Subfoldere
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {childFolders.map((child) => {
                const count = countRecursive(child.id);
                const hasSubfolders = folders.some((f) => f.parentId === child.id);
                const childColor = COLOR_HEX[child.color] ?? theme.accent;
                return (
                  <Link
                    key={child.id}
                    to={`/folder/${child.id}`}
                    className="glass-panel group rounded-2xl p-4 transition-all hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.98]"
                    style={{ color: theme.text }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-xl transition-transform group-hover:scale-105"
                        style={{ background: `${childColor}18` }}
                      >
                        {child.emoji}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-black">{child.name}</div>
                        <span
                          className="mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold"
                          style={{ background: theme.surface2, color: theme.text3 }}
                        >
                          {count} {count === 1 ? 'set' : 'seturi'}{hasSubfolders ? ' în total' : ''}
                        </span>
                      </div>
                      <div className="h-8 w-1 flex-shrink-0 rounded-full" style={{ background: childColor }} />
                    </div>
                  </Link>
                );
              })}
            </div>
          </motion.div>
        )}

        {folderQuizzes.length === 0 && childFolders.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="glass-panel premium-shadow text-center py-20 rounded-2xl">
            <div className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center"
              style={{ background: `${accentColor}15` }}>
              <span style={{ fontSize: 28 }}>{folder?.emoji ?? '📋'}</span>
            </div>
            <p className="font-medium mb-1" style={{ color: theme.text }}>Folderul este gol</p>
            <p className="text-sm mb-4" style={{ color: theme.text3 }}>
              Adaugă grile sau importă un fișier JSON
            </p>
            <div className="flex items-center justify-center gap-3">
              {folder && (
                <button
                  type="button"
                  onClick={openSubfolderForm}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium"
                  style={{ background: theme.surface2, color: theme.text, border: `1px solid ${theme.border}` }}
                >
                  <FolderPlus size={14} />Subfolder
                </button>
              )}
              <Link to={`/create?folder=${id}`}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white"
                style={{ background: `linear-gradient(135deg, ${accentColor}, ${theme.accent2})` }}>
                <Plus size={14} />Creează grilă
              </Link>
            </div>
          </motion.div>
        ) : (
          <>
            {childFolders.length > 0 && folderQuizzes.length > 0 && (
              <h2 className="text-sm font-black uppercase tracking-wider mb-3" style={{ color: theme.text3 }}>
                Seturi
              </h2>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {folderQuizzes.map((quiz, i) => (
                <QuizCard key={quiz.id} quiz={quiz} index={i} showDelete />
              ))}
            </div>
          </>
        )}
      </div>

      {showExamSplit && (
        <ExamSplitModal
          folderName={folder?.name ?? 'Neclasificate'}
          folderId={isNull ? null : (id ?? null)}
          color={folder?.color ?? 'blue'}
          category={folder?.name ?? 'Altele'}
          quizzes={realQuizzes}
          onClose={() => setShowExamSplit(false)}
        />
      )}

      <ConfirmDialog
        open={confirmPlayAll}
        variant="default"
        title={`Joci tot folderul „${folder?.name ?? ''}"?`}
        description={`Se combină ${playableSets.length} seturi într-o singură sesiune amestecată, cu ${playableQuestionCount} întrebări în total.`}
        confirmLabel="Începe sesiunea"
        onConfirm={handlePlayFolder}
        onCancel={() => setConfirmPlayAll(false)}
      />
    </div>
  );
}
