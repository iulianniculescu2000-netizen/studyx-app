import { motion, AnimatePresence } from 'framer-motion';
import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Search, Plus, Filter, X, ArrowUpDown, Archive, Tag, BookOpen, Sparkles } from 'lucide-react';
import { useQuizStore } from '../store/quizStore';
import { useTheme } from '../theme/ThemeContext';
import QuizCard from '../components/QuizCard';
import ImportQuizButton from '../components/ImportQuizButton';
import PremiumSelect from '../components/PremiumSelect';
import { SkeletonList } from '../components/SkeletonCard';

type SortOption = 'newest' | 'oldest' | 'name_az' | 'name_za' | 'most_questions' | 'best_score';

export default function QuizList() {
  const { quizzes, sessions, _hasHydrated } = useQuizStore();
  const theme = useTheme();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('Toate');
  const [sort, setSort] = useState<SortOption>('newest');
  const [showArchived, setShowArchived] = useState(false);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const ITEMS_PER_PAGE = 12;
  const [page, setPage] = useState(1);

  const activeQuizzes = quizzes.filter(q => !q.archived);
  const archivedQuizzes = quizzes.filter(q => q.archived);

  const categories = useMemo(() => 
    ['Toate', ...Array.from(new Set(activeQuizzes.map((q) => q.category).filter(Boolean))).sort()],
    [activeQuizzes]
  );

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

  const allTags = useMemo(() => 
    Array.from(new Set(activeQuizzes.flatMap(q => q.tags ?? []))).sort(),
    [activeQuizzes]
  );

  const filtered = activeQuizzes.filter((q) => {
    const matchSearch = q.title.toLowerCase().includes(search.toLowerCase()) ||
      q.description.toLowerCase().includes(search.toLowerCase());
    const matchCategory = category === 'Toate' || q.category === category;
    const matchTag = !activeTag || (q.tags ?? []).includes(activeTag);
    return matchSearch && matchCategory && matchTag;
  }).sort(sortFn);

  const paginated = filtered.slice(0, page * ITEMS_PER_PAGE);

  const SORT_LABELS: Record<SortOption, string> = {
    newest: 'Cele mai noi', oldest: 'Cele mai vechi',
    name_az: 'Nume A→Z', name_za: 'Nume Z→A',
    most_questions: 'Cele mai multe întrebări', best_score: 'Scor maxim',
  };

  if (!_hasHydrated) {
    return (
      <div className="h-full px-8 py-10 max-w-5xl mx-auto">
        <div className="h-10 w-48 bg-white/5 rounded-2xl mb-10 animate-pulse" />
        <SkeletonList count={8} />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto px-4 sm:px-8 py-6 sm:py-10 custom-scrollbar">
      <div className="max-w-5xl mx-auto">

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
          <div className="flex items-end justify-between mb-4 gap-6 flex-wrap">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg"
                  style={{ background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})`, color: '#fff' }}>
                  <BookOpen size={20} />
                </div>
                <h1 className="text-3xl font-black tracking-tight" style={{ color: theme.text }}>
                  Grilele <span style={{ color: theme.accent }}>Tale</span>
                </h1>
              </div>
              <p className="text-sm font-medium opacity-50" style={{ color: theme.text }}>
                {filtered.length} grile {filtered.length !== activeQuizzes.length ? `filtrate din ${activeQuizzes.length}` : 'disponibile'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div data-tutorial="btn-import"><ImportQuizButton /></div>
              <Link to="/create"
                className="flex items-center gap-2.5 px-6 py-3 rounded-2xl font-black text-white transition-all shadow-xl hover:scale-[1.03] active:scale-[0.97]"
                style={{ background: theme.accent, boxShadow: `0 8px 24px ${theme.accent}40` }}>
                <Plus size={18} strokeWidth={3} />
                Grilă nouă
              </Link>
            </div>
          </div>
        </motion.div>

        {/* Search & Filters Premium Glass Container */}
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }} 
          className="mb-10 p-6 rounded-[32px] glass-panel premium-shadow border border-white/5">
          
          <div className="flex items-center gap-4 px-5 py-4 rounded-2xl transition-all bg-black/5 dark:bg-white/5 border border-white/5 focus-within:border-accent/30 focus-within:bg-transparent">
            <Search size={20} className="opacity-40" style={{ color: theme.text }} />
            <input
              type="text"
              placeholder="Caută în titlu, descriere sau subiect..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="bg-transparent flex-1 text-sm font-bold outline-none border-none"
              style={{ color: theme.text }}
            />
            {search && (
              <button onClick={() => { setSearch(''); setPage(1); }}
                className="p-1.5 rounded-xl hover:bg-white/10 transition-colors"
                style={{ color: theme.text3 }}>
                <X size={16} />
              </button>
            )}
          </div>

          <div className="mt-6 flex flex-col gap-4">
            {allTags.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap px-1">
                <Tag size={14} className="opacity-30 mr-1" style={{ color: theme.text }} />
                {allTags.map(tag => (
                  <button key={tag} onClick={() => { setActiveTag(activeTag === tag ? null : tag); setPage(1); }}
                    className="px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all"
                    style={{
                      background: activeTag === tag ? `${theme.accent2}25` : theme.surface2,
                      border: `1.5px solid ${activeTag === tag ? theme.accent2 + '60' : 'transparent'}`,
                      color: activeTag === tag ? theme.accent2 : theme.text3,
                    }}>
                    #{tag.replace(/>/g, ' › ')}
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2 flex-wrap pt-4 border-t" style={{ borderColor: theme.border }}>
              <Filter size={16} className="opacity-30 mr-2 ml-1" style={{ color: theme.text }} />
              <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-1">
                {categories.map((cat) => (
                  <button key={cat} onClick={() => { setCategory(cat); setPage(1); }}
                    className="px-5 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap"
                    style={{
                      background: category === cat ? `${theme.accent}20` : 'transparent',
                      border: `1.5px solid ${category === cat ? `${theme.accent}50` : 'transparent'}`,
                      color: category === cat ? theme.accent : theme.text2,
                    }}>
                    {cat}
                  </button>
                ))}
              </div>
              <div className="ml-auto min-w-[180px]">
                <PremiumSelect
                  value={sort}
                  onChange={(val) => { setSort(val as SortOption); setPage(1); }}
                  options={(Object.entries(SORT_LABELS) as [SortOption, string][]).map(([k, v]) => ({ value: k, label: v }))}
                  icon={<ArrowUpDown size={14} className="opacity-50" />}
                />
              </div>
            </div>
          </div>
        </motion.div>

        <AnimatePresence mode="popLayout">
          {filtered.length === 0 ? (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              className="text-center py-24 rounded-[40px] glass-panel border border-dashed border-white/10 premium-shadow">
              <div className="w-20 h-20 rounded-3xl mx-auto mb-6 flex items-center justify-center"
                style={{ background: `${theme.accent}12` }}>
                <BookOpen size={36} style={{ color: theme.accent, opacity: 0.6 }} />
              </div>
              <h2 className="text-2xl font-black mb-2" style={{ color: theme.text }}>
                {search || category !== 'Toate' ? 'Nicio grilă găsită' : 'Biblioteca ta este goală'}
              </h2>
              <p className="text-base font-medium opacity-50 mb-8 max-w-sm mx-auto" style={{ color: theme.text }}>
                {search
                  ? `Nu am găsit nimic pentru "${search}". Încearcă un alt termen.`
                  : 'Începe prin a crea prima ta grilă sau importă un fișier de la colegi.'}
              </p>
              <div className="flex items-center justify-center gap-4">
                {(search || category !== 'Toate' || activeTag) && (
                  <button onClick={() => { setSearch(''); setCategory('Toate'); setActiveTag(null); }}
                    className="px-6 py-3 rounded-2xl font-bold transition-all hover:bg-white/5"
                    style={{ color: theme.accent }}>
                    Resetează filtrele
                  </button>
                )}
                <Link to="/create" className="px-8 py-3 rounded-2xl font-black text-sm text-white shadow-xl transition-all hover:scale-105 active:scale-95"
                  style={{ background: theme.accent, boxShadow: `0 8px 24px ${theme.accent}40` }}>
                  <Plus size={18} className="inline mr-2" /> Grilă nouă
                </Link>
              </div>
            </motion.div>
          ) : (
            <motion.div layout className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {paginated.map((quiz, i) => (
                <QuizCard key={quiz.id} quiz={quiz} index={i} showDelete />
              ))}
              
              {filtered.length > paginated.length && (
                <motion.button
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  onClick={() => setPage(p => p + 1)}
                  className="col-span-full flex items-center justify-center gap-3 py-5 rounded-[28px] font-black uppercase tracking-[0.2em] text-xs transition-all glass-panel border border-white/5 hover:border-accent/30"
                  style={{ color: theme.text2 }}>
                  <Sparkles size={16} className="text-accent" /> Încarcă mai multe ({filtered.length - paginated.length} rămase)
                </motion.button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Archived section */}
        {archivedQuizzes.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-12 pt-12 border-t" style={{ borderColor: theme.border }}>
            <button
              onClick={() => setShowArchived(!showArchived)}
              className="flex items-center gap-3 mb-6 px-4 py-2 rounded-xl text-sm font-black uppercase tracking-widest transition-all hover:bg-white/5"
              style={{ color: theme.text3 }}>
              <Archive size={16} />
              Grile Arhivate ({archivedQuizzes.length})
              <motion.span animate={{ rotate: showArchived ? 180 : 0 }}>▼</motion.span>
            </button>
            <AnimatePresence>
              {showArchived && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 0.6 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {archivedQuizzes.map((quiz, i) => (
                      <QuizCard key={quiz.id} quiz={quiz} index={i} showDelete />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </div>
    </div>
  );
}
