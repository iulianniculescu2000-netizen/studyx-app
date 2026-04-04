import { motion, AnimatePresence } from 'framer-motion';
import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { StickyNote, Search, Trash2, BookOpen, X, Sparkles, Loader2, CreditCard } from 'lucide-react';
import { useTheme } from '../theme/ThemeContext';
import { useNotesStore } from '../store/notesStore';
import { useQuizStore } from '../store/quizStore';
import { useAIStore } from '../store/aiStore';
import { notesToFlashcards } from '../lib/groq';

export default function Notes() {
  const theme = useTheme();
  const navigate = useNavigate();
  const { notes, deleteNote } = useNotesStore();
  const { quizzes, addQuiz } = useQuizStore();
  const { hasKey } = useAIStore();
  const [search, setSearch] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [aiConverting, setAiConverting] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Build enriched notes list: questionId → { noteText, question, quiz }
  const enriched = useMemo(() => {
    return Object.entries(notes)
      .map(([questionId, text]) => {
        // Find which quiz contains this question
        let quizFound = null;
        let questionFound = null;
        for (const quiz of quizzes) {
          const q = quiz.questions.find(q => q.id === questionId);
          if (q) { quizFound = quiz; questionFound = q; break; }
        }
        return { questionId, text, quiz: quizFound, question: questionFound };
      })
      .filter(n => n.text.trim().length > 0)
      .sort((a, b) => (a.quiz?.title ?? '').localeCompare(b.quiz?.title ?? '', 'ro'));
  }, [notes, quizzes]);

  const filtered = search.trim()
    ? enriched.filter(n =>
        n.text.toLowerCase().includes(search.toLowerCase()) ||
        (n.question?.text ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (n.quiz?.title ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : enriched;

  // Group by quiz
  const grouped = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    for (const n of filtered) {
      const key = n.quiz?.id ?? '__orphan__';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(n);
    }
    return map;
  }, [filtered]);

  return (
    <div className="h-full overflow-y-auto px-8 py-8">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-start justify-between gap-3 mb-1">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: `${theme.warning}20`, color: theme.warning }}>
                <StickyNote size={18} />
              </div>
              <h1 className="text-3xl font-bold tracking-tight" style={{ color: theme.text }}>
                Notițele mele
              </h1>
            </div>
            {enriched.length > 0 && hasKey() && (
              <motion.button
                whileTap={{ scale: 0.97 }}
                disabled={aiConverting}
                onClick={async () => {
                  setAiError(null);
                  setAiConverting(true);
                  try {
                    const allText = enriched
                      .map(n => `Q: ${n.question?.text ?? 'Întrebare'}\nNotiță: ${n.text}`)
                      .join('\n\n');
                    const pairs = await notesToFlashcards(allText);
                    if (pairs.length === 0) throw new Error('Nu s-au generat flashcarduri.');

                    const newQuiz = {
                      id: crypto.randomUUID().replace(/-/g, '').slice(0, 12),
                      title: 'Flashcarduri din notițe',
                      description: `Generat automat din ${enriched.length} notițe`,
                      emoji: '🃏',
                      color: 'purple' as const,
                      category: 'Notițe',
                      questions: pairs.map((p, i) => ({
                        id: `fc-${i}-${Date.now()}`,
                        text: p.front,
                        options: [
                          { id: 'a', text: p.back, isCorrect: true },
                          { id: 'b', text: 'Nu știu', isCorrect: false },
                        ],
                        explanation: p.back,
                        tags: ['flashcard', 'notițe'],
                      })),
                      createdAt: Date.now(),
                    };
                    addQuiz(newQuiz);
                    navigate(`/quiz/${newQuiz.id}`);
                  } catch (e: any) {
                    setAiError(e.message ?? 'Eroare necunoscută.');
                  } finally {
                    setAiConverting(false);
                  }
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-semibold flex-shrink-0"
                style={{
                  background: aiConverting ? theme.surface2 : `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})`,
                  color: aiConverting ? theme.text3 : '#fff',
                  border: `1px solid ${aiConverting ? theme.border : 'transparent'}`,
                }}>
                {aiConverting
                  ? <><Loader2 size={13} className="animate-spin" />Generez...</>
                  : <><Sparkles size={13} /><CreditCard size={13} />AI Flashcarduri</>}
              </motion.button>
            )}
          </div>
          <p className="text-sm ml-12" style={{ color: theme.text3 }}>
            {enriched.length === 0 ? 'Nicio notiță salvată' : `${enriched.length} ${enriched.length === 1 ? 'notiță' : 'notițe'} din ${grouped.size} ${grouped.size === 1 ? 'grilă' : 'grile'}`}
          </p>
          {aiError && (
            <p className="text-xs mt-2 ml-12" style={{ color: theme.danger }}>{aiError}</p>
          )}
        </motion.div>

        {/* Search */}
        {enriched.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="relative mb-6">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: theme.text3 }} />
            <input
              type="text"
              placeholder="Caută în notițe..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-10 py-3 rounded-2xl text-sm"
              style={{
                background: theme.surface,
                border: `1px solid ${theme.border}`,
                color: theme.text,
                outline: 'none',
              }}
            />
            {search && (
              <button onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg"
                style={{ color: theme.text3 }}>
                <X size={14} />
              </button>
            )}
          </motion.div>
        )}

        {/* Empty state */}
        {enriched.length === 0 && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.15 }}
            className="text-center py-20 rounded-3xl"
            style={{ background: theme.surface, border: `1px solid ${theme.border}` }}>
            <div className="text-5xl mb-4">📝</div>
            <h3 className="text-lg font-semibold mb-2" style={{ color: theme.text }}>
              Nicio notiță încă
            </h3>
            <p className="text-sm mb-6" style={{ color: theme.text3 }}>
              Adaugă notițe personale în timp ce rezolvi grile.<br />
              Apar după ce răspunzi la o întrebare.
            </p>
            <Link to="/quizzes"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-semibold text-white"
              style={{ background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})` }}>
              <BookOpen size={15} />Deschide o grilă
            </Link>
          </motion.div>
        )}

        {/* No search results */}
        {enriched.length > 0 && filtered.length === 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="text-center py-16 rounded-3xl"
            style={{ background: theme.surface, border: `1px solid ${theme.border}` }}>
            <div className="text-4xl mb-3">🔍</div>
            <p style={{ color: theme.text3 }}>Nicio notiță nu corespunde căutării.</p>
          </motion.div>
        )}

        {/* Notes grouped by quiz */}
        <div className="space-y-6">
          {Array.from(grouped.entries()).map(([quizId, noteList], gi) => {
            const quiz = noteList[0]?.quiz;
            return (
              <motion.div
                key={quizId}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + gi * 0.06 }}
              >
                {/* Quiz header */}
                <div className="flex items-center gap-2 mb-3">
                  {quiz ? (
                    <Link to={`/quiz/${quiz.id}`}
                      className="flex items-center gap-2 hover:underline"
                      style={{ color: theme.accent }}>
                      <span className="text-lg">{quiz.emoji}</span>
                      <span className="font-semibold text-sm">{quiz.title}</span>
                    </Link>
                  ) : (
                    <div className="flex items-center gap-2" style={{ color: theme.text3 }}>
                      <span>📋</span>
                      <span className="font-semibold text-sm">Grilă ștearsă</span>
                    </div>
                  )}
                  <span className="text-xs px-2 py-0.5 rounded-full"
                    style={{ background: theme.surface2, color: theme.text3 }}>
                    {noteList.length}
                  </span>
                </div>

                {/* Notes cards */}
                <div className="space-y-3">
                  {noteList.map((n, ni) => (
                    <motion.div
                      key={n.questionId}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.15 + gi * 0.06 + ni * 0.04 }}
                      className="group rounded-2xl p-4 relative"
                      style={{ background: theme.surface, border: `1px solid ${theme.border}` }}
                    >
                      {/* Question text */}
                      {n.question && (
                        <p className="text-xs font-medium mb-2 pr-6 line-clamp-2"
                          style={{ color: theme.text3 }}>
                          ❓ {n.question.text}
                        </p>
                      )}

                      {/* Divider */}
                      <div style={{ height: 1, background: theme.border, marginBottom: 8 }} />

                      {/* Note content */}
                      <p className="text-sm whitespace-pre-wrap pr-16" style={{ color: theme.text }}>
                        {n.text}
                      </p>

                      {/* Delete button */}
                      <AnimatePresence>
                        {confirmDelete === n.questionId ? (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="absolute top-3 right-3 flex items-center gap-1"
                          >
                            <button
                              onClick={() => { deleteNote(n.questionId); setConfirmDelete(null); }}
                              className="px-2 py-1 rounded-lg text-xs font-semibold text-white"
                              style={{ background: theme.danger }}>
                              Șterge
                            </button>
                            <button
                              onClick={() => setConfirmDelete(null)}
                              className="px-2 py-1 rounded-lg text-xs"
                              style={{ background: theme.surface2, color: theme.text3 }}>
                              Nu
                            </button>
                          </motion.div>
                        ) : (
                          <motion.button
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setConfirmDelete(n.questionId)}
                            className="absolute top-3 right-3 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                            style={{ color: theme.text3 }}>
                            <Trash2 size={13} />
                          </motion.button>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
