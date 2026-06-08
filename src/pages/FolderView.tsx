import { motion } from 'framer-motion';
import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Check, FolderPlus, Plus, X } from 'lucide-react';
import { useTheme } from '../theme/ThemeContext';
import { useFolderStore } from '../store/folderStore';
import { useQuizStore } from '../store/quizStore';
import QuizCard from '../components/QuizCard';
import ImportQuizButton from '../components/ImportQuizButton';
import type { QuizColor } from '../types';

const COLOR_HEX: Record<string, string> = {
  blue: '#0A84FF', purple: '#5E5CE6', green: '#30D158',
  orange: '#FF9F0A', pink: '#FF375F', red: '#FF453A', teal: '#5AC8FA',
};
const FOLDER_COLORS = Object.keys(COLOR_HEX) as QuizColor[];

export default function FolderView() {
  const { id } = useParams<{ id: string }>();
  const theme = useTheme();
  const { folders, addFolder } = useFolderStore();
  const { getQuizzesByFolder } = useQuizStore();
  const [creatingSubfolder, setCreatingSubfolder] = useState(false);
  const [subfolderName, setSubfolderName] = useState('');
  const [subfolderEmoji, setSubfolderEmoji] = useState('📁');
  const [subfolderColor, setSubfolderColor] = useState<QuizColor>('blue');

  const isNull = id === 'null';
  const folder = isNull ? null : folders.find(f => f.id === id);
  const folderQuizzes = getQuizzesByFolder(isNull ? null : id ?? null);
  const childFolders = isNull ? [] : folders.filter((candidate) => candidate.parentId === id);

  const title = isNull ? '📋 Neclasificate' : folder ? `${folder.emoji} ${folder.name}` : 'Folder';
  const accentColor = folder ? (COLOR_HEX[folder.color] ?? theme.accent) : theme.text3;

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
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight" style={{ color: theme.text }}>{title}</h1>
              <p className="text-sm mt-1" style={{ color: theme.text3 }}>
                {folderQuizzes.length} {folderQuizzes.length === 1 ? 'grilă' : 'grile'}
              </p>
              {childFolders.length > 0 && (
                <p className="text-xs mt-1" style={{ color: theme.text3 }}>
                  {childFolders.length} subfoldere
                </p>
              )}
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
            className="mb-6 rounded-2xl p-4"
            style={{ background: theme.surface, border: `1px solid ${theme.border}` }}
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
                const count = getQuizzesByFolder(child.id).length;
                const childColor = COLOR_HEX[child.color] ?? theme.accent;
                return (
                  <Link
                    key={child.id}
                    to={`/folder/${child.id}`}
                    className="rounded-2xl p-4 transition-all hover:scale-[1.02] active:scale-[0.98]"
                    style={{ background: theme.surface, border: `1px solid ${theme.border}`, color: theme.text }}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{child.emoji}</span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-black">{child.name}</div>
                        <div className="text-xs mt-0.5" style={{ color: theme.text3 }}>{count} grile</div>
                      </div>
                      <div className="h-8 w-1 rounded-full" style={{ background: childColor }} />
                    </div>
                  </Link>
                );
              })}
            </div>
          </motion.div>
        )}

        {folderQuizzes.length === 0 && childFolders.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="text-center py-20 rounded-2xl"
            style={{ background: theme.surface, border: `1px solid ${theme.border}` }}>
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {folderQuizzes.map((quiz, i) => (
              <QuizCard key={quiz.id} quiz={quiz} index={i} showDelete />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
