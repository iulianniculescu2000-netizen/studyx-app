import { motion } from 'framer-motion';
import { useParams, Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useTheme } from '../theme/ThemeContext';
import { useFolderStore } from '../store/folderStore';
import { useQuizStore } from '../store/quizStore';
import QuizCard from '../components/QuizCard';
import ImportQuizButton from '../components/ImportQuizButton';

const COLOR_HEX: Record<string, string> = {
  blue: '#0A84FF', purple: '#5E5CE6', green: '#30D158',
  orange: '#FF9F0A', pink: '#FF375F', red: '#FF453A', teal: '#5AC8FA',
};

export default function FolderView() {
  const { id } = useParams<{ id: string }>();
  const theme = useTheme();
  const { folders } = useFolderStore();
  const { getQuizzesByFolder } = useQuizStore();

  const isNull = id === 'null';
  const folder = isNull ? null : folders.find(f => f.id === id);
  const folderQuizzes = getQuizzesByFolder(isNull ? null : id ?? null);

  const title = isNull ? '📋 Neclasificate' : folder ? `${folder.emoji} ${folder.name}` : 'Folder';
  const accentColor = folder ? (COLOR_HEX[folder.color] ?? theme.accent) : theme.text3;

  return (
    <div className="h-full overflow-y-auto px-8 py-8">
      <div className="max-w-4xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight" style={{ color: theme.text }}>{title}</h1>
              <p className="text-sm mt-1" style={{ color: theme.text3 }}>
                {folderQuizzes.length} {folderQuizzes.length === 1 ? 'grilă' : 'grile'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <ImportQuizButton targetFolderId={id === 'null' ? null : id} />
              <Link to={`/create?folder=${id}`}
                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-medium text-white"
                style={{ background: `linear-gradient(135deg, ${accentColor}, ${theme.accent2})` }}>
                <Plus size={15} />Grilă nouă
              </Link>
            </div>
          </div>
        </motion.div>

        {folderQuizzes.length === 0 ? (
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
