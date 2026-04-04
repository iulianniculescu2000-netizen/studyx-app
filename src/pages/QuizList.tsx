import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, Plus, Filter, X, ArrowUpDown, Archive, Tag } from 'lucide-react';
import { useQuizStore } from '../store/quizStore';
import { useTheme } from '../theme/ThemeContext';
import QuizCard from '../components/QuizCard';
import ImportQuizButton from '../components/ImportQuizButton';
import PremiumSelect from '../components/PremiumSelect';

type SortOption = 'newest' | 'oldest' | 'name_az' | 'name_za' | 'most_questions' | 'best_score';

export default function QuizList() {
  const { quizzes, sessions } = useQuizStore();
  const theme = useTheme();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('Toate');
  const [sort, setSort] = useState<SortOption>('newest');
  const [showArchived, setShowArchived] = useState(false);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const ITEMS_PER_PAGE = 20;
  const [page, setPage] = useState(1);

  const activeQuizzes = quizzes.filter(q => !q.archived);
  const archivedQuizzes = quizzes.filter(q => q.archived);

  // Build category list dynamically from actual quiz data
  const categories = ['Toate', ...Array.from(new Set(activeQuizzes.map((q) => q.category).filter(Boolean))).sort()];

  const getBestScoreLocal = (quizId: string) => {
    const qs = sessions.filter(s => s.quizId === quizId);
    if (!qs.length) return 0;
    return Math.max(...qs.map(s => Math.round((s.score / s.total) * 100)));
  };

  const sortFn = (a: typeof quizzes[0], b: typeof quizzes[0]) => {
    switch (sort) {
      case 'newest': return (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt);
      case 'oldest': return (a.updatedAt ?? a.createdAt) - (b.updatedAt ?? b.createdAt);
      case 'name_az': return a.title.localeCompare(b.title, 'ro');
      case 'name_za': return b.title.localeCompare(a.title, 'ro');
      case 'most_questions': return b.questions.length - a.questions.length;
      case 'best_score': return getBestScoreLocal(b.id) - getBestScoreLocal(a.id);
      default: return 0;
    }
  };

  const allTags = Array.from(new Set(activeQuizzes.flatMap(q => q.tags ?? []))).sort();

  const filtered = activeQuizzes.filter((q) => {
    const matchSearch = q.title.toLowerCase().includes(search.toLowerCase()) ||
      q.description.toLowerCase().includes(search.toLowerCase());
    const matchCategory = category === 'Toate' || q.category === category;
    const matchTag = !activeTag || (q.tags ?? []).includes(activeTag);
    return matchSearch && matchCategory && matchTag;
  }).sort(sortFn);

  const paginated = filtered.slice(0, page * ITEMS_PER_PAGE);

  // Reset page when filters change
  useEffect(() => setPage(1), [search, category, activeTag, sort]);

  const SORT_LABELS: Record<SortOption, string> = {
    newest: 'Cele mai noi', oldest: 'Cele mai vechi',
    name_az: 'Nume A→Z', name_za: 'Nume Z→A',
    most_questions: 'Cele mai multe întrebări', best_score: 'Scor maxim',
  };

  return (
    <div className="h-full overflow-y-auto px-4 sm:px-8 py-6 sm:py-8">
      <div className="max-w-5xl mx-auto">

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }} className="mb-8">
          <div className="flex items-end justify-between mb-2 gap-4 flex-wrap">
            <div>
              <h1 className="text-3xl font-black tracking-tight mb-1" style={{ color: theme.text }}>
                Grilele <span style={{
                  background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})`,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}>Tale</span>
              </h1>
              <p className="text-sm font-medium opacity-60" style={{ color: theme.text }}>
                {filtered.length < activeQuizzes.length
                  ? `${filtered.length} din ${activeQuizzes.length} grile filtrate`
                  : `${activeQuizzes.length} grile disponibile în total`}
                {archivedQuizzes.length > 0 && <span> · {archivedQuizzes.length} în arhivă</span>}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div data-tutorial="btn-import"><ImportQuizButton /></div>
              <Link to="/create"
                className="flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-bold text-white shadow-lg shadow-blue-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                style={{ background: `linear-gradient(135deg, ${theme.accent} 0%, ${theme.accent2} 100%)` }}>
                <Plus size={16} />
                Grilă nouă
              </Link>
            </div>
          </div>
        </motion.div>

        {/* Search & Filters Glass Box */}
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }} 
          className="mb-8 p-4 rounded-3xl space-y-4"
          style={{ background: theme.surface, border: `1px solid ${theme.border}`, boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
          
          <div className="flex items-center gap-3 px-4 py-3 rounded-2xl transition-all focus-within:ring-2"
            style={{ background: theme.surface2, border: `1px solid ${theme.border2}`, ringColor: `${theme.accent}40` } as any}>
            <Search size={18} style={{ color: theme.text3 }} />
            <input
              type="text"
              placeholder="Caută în titlu, descriere sau subiect..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent flex-1 text-sm font-medium"
              style={{ color: theme.text, outline: 'none', border: 'none' }}
            />
            {search && (
              <button onClick={() => setSearch('')}
                className="p-1 rounded-full transition-all hover:bg-white/10"
                style={{ color: theme.text3 }}>
                <X size={14} />
              </button>
            )}
          </div>

          <div className="flex flex-col gap-3">
            {allTags.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap px-1">
                <Tag size={12} style={{ color: theme.text3 }} className="mr-1" />
                {allTags.map(tag => (
                  <button key={tag} onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                    className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider transition-all"
                    style={{
                      background: activeTag === tag ? `${theme.accent2}25` : theme.surface2,
                      border: `1px solid ${activeTag === tag ? theme.accent2 + '60' : theme.border2}`,
                      color: activeTag === tag ? theme.accent2 : theme.text3,
                    }}>
                    #{tag.replace(/>/g, ' › ')}
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2 flex-wrap pt-1 border-t" style={{ borderColor: theme.border2 }}>
              <Filter size={14} style={{ color: theme.text3 }} className="mr-2 ml-1" />
              {categories.map((cat) => (
                <button key={cat} onClick={() => setCategory(cat)}
                  className="px-4 py-1.5 rounded-xl text-xs font-bold transition-all"
                  style={{
                    background: category === cat ? `${theme.accent}20` : 'transparent',
                    border: `1px solid ${category === cat ? `${theme.accent}50` : 'transparent'}`,
                    color: category === cat ? theme.accent : theme.text2,
                  }}>
                  {cat}
                </button>
              ))}
              <div className="ml-auto">
                <PremiumSelect
                  value={sort}
                  onChange={(val) => setSort(val as SortOption)}
                  options={(Object.entries(SORT_LABELS) as [SortOption, string][]).map(([k, v]) => ({ value: k, label: v }))}
                  icon={<ArrowUpDown size={12} style={{ color: theme.text3 }} />}
                />
              </div>
            </div>
          </div>
        </motion.div>

        {filtered.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="text-center py-20 rounded-2xl"
            style={{ background: theme.surface, border: `1px solid ${theme.border}` }}>
            <div className="text-6xl mb-4">{search || category !== 'Toate' ? '🔍' : '📭'}</div>
            <p className="font-medium mb-1" style={{ color: theme.text }}>
              {search || category !== 'Toate' ? 'Nicio grilă găsită' : 'Nicio grilă încă'}
            </p>
            <p className="text-sm mb-4" style={{ color: theme.text3 }}>
              {search
                ? `Niciun rezultat pentru "${search}"`
                : category !== 'Toate'
                ? `Nicio grilă în categoria "${category}"`
                : 'Creează prima ta grilă pentru a începe'}
            </p>
            {(search || category !== 'Toate') ? (
              <button onClick={() => { setSearch(''); setCategory('Toate'); setActiveTag(null); }}
                className="text-sm px-4 py-2 rounded-xl transition-all hover:opacity-80"
                style={{ background: `${theme.accent}18`, color: theme.accent }}>
                Resetează filtrele
              </button>
            ) : (
              <Link to="/create" className="text-sm px-4 py-2 rounded-xl transition-all hover:opacity-80 inline-flex items-center gap-1.5"
                style={{ background: `${theme.accent}18`, color: theme.accent }}>
                <Plus size={14} />Grilă nouă
              </Link>
            )}
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginated.map((quiz, i) => (
              <QuizCard key={quiz.id} quiz={quiz} index={i} showDelete />
            ))}
            {filtered.length > paginated.length && (
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onClick={() => setPage(p => p + 1)}
                className="col-span-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-medium transition-all"
                style={{ background: theme.surface, border: `1px solid ${theme.border}`, color: theme.text2 }}>
                Încarcă mai multe ({filtered.length - paginated.length} rămase)
              </motion.button>
            )}
          </div>
        )}

        {/* Archived section */}
        {archivedQuizzes.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-8">
            <button
              onClick={() => setShowArchived(!showArchived)}
              className="flex items-center gap-2 mb-4 text-sm font-medium transition-all hover:opacity-80"
              style={{ color: theme.text3 }}>
              <Archive size={14} />
              Arhivă ({archivedQuizzes.length})
              <span className="text-xs">{showArchived ? '▲' : '▼'}</span>
            </button>
            {showArchived && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 opacity-60">
                {archivedQuizzes.map((quiz, i) => (
                  <QuizCard key={quiz.id} quiz={quiz} index={i} showDelete />
                ))}
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}
