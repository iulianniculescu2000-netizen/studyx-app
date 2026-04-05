import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Search, X, BookOpen, FileQuestion, ArrowRight, Command } from 'lucide-react';
import { useQuizStore } from '../store/quizStore';
import { useTheme } from '../theme/ThemeContext';
import { CARD_COLOR_MAP } from '../theme/colorMaps';
import { type Theme } from '../theme/themes';

interface SearchResult {
  type: 'quiz' | 'question';
  quizId: string;
  questionId?: string;
  quizTitle: string;
  quizEmoji: string;
  quizColor: string;
  label: string;
  sub?: string;
  href: string;
}

export default function GlobalSearch() {
  const theme = useTheme();
  const navigate = useNavigate();
  const { quizzes } = useQuizStore();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Cmd+K / Ctrl+K opens
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setQuery('');
        setActiveIdx(0);
        setOpen(true);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const results = useMemo<SearchResult[]>(() => {
    if (query.trim().length < 1) return [];
    const q = query.toLowerCase();
    const out: SearchResult[] = [];
    for (const quiz of quizzes) {
      if (quiz.title.toLowerCase().includes(q) || quiz.description.toLowerCase().includes(q)) {
        out.push({
          type: 'quiz',
          quizId: quiz.id,
          quizTitle: quiz.title,
          quizEmoji: quiz.emoji,
          quizColor: quiz.color,
          label: quiz.title,
          sub: `${quiz.questions.length} ${quiz.questions.length === 1 ? 'întrebare' : 'întrebări'} · ${quiz.category}`,
          href: `/quiz/${quiz.id}`,
        });
      }
      for (const question of quiz.questions) {
        if (question.text.toLowerCase().includes(q)) {
          out.push({
            type: 'question',
            quizId: quiz.id,
            questionId: question.id,
            quizTitle: quiz.title,
            quizEmoji: quiz.emoji,
            quizColor: quiz.color,
            label: question.text,
            sub: quiz.title,
            href: `/quiz/${quiz.id}`,
          });
        }
      }
      if (out.length >= 20) break;
    }
    return out;
  }, [query, quizzes]);

  const handleSelect = useCallback((result: SearchResult) => {
    setOpen(false);
    navigate(result.href);
  }, [navigate]);

  // Arrow key navigation
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, results.length - 1)); }
      if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); }
      if (e.key === 'Enter' && results[activeIdx]) { handleSelect(results[activeIdx]); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, results, activeIdx, handleSelect]);

  // Handle activeIdx reset inside the input change instead of useEffect
  const handleQueryChange = (val: string) => {
    setQuery(val);
    setActiveIdx(0);
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-50"
            style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="fixed top-[18%] left-1/2 z-50 w-full max-w-xl -translate-x-1/2"
            style={{ paddingInline: 16 }}
          >
            <div className="rounded-2xl overflow-hidden shadow-2xl"
              style={{ background: theme.modalBg, border: `1px solid ${theme.border}`, backdropFilter: 'blur(40px)' }}>

              {/* Search input row */}
              <div className="flex items-center gap-3 px-4 py-3.5"
                style={{ borderBottom: `1px solid ${theme.border}` }}>
                <Search size={18} style={{ color: theme.text3, flexShrink: 0 }} />
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Caută grile, întrebări..."
                  value={query}
                  onChange={e => handleQueryChange(e.target.value)}
                  className="flex-1 bg-transparent text-base font-medium"
                  style={{ color: theme.text, outline: 'none', border: 'none' }}
                />
                {query && (
                  <motion.button 
                    whileHover={{ scale: 1.1, rotate: 90 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setQuery('')} 
                    style={{ color: theme.text3, cursor: 'pointer' }}>
                    <X size={15} />
                  </motion.button>
                )}
                <kbd className="text-xs px-1.5 py-0.5 rounded-lg font-mono flex-shrink-0"
                  style={{ background: theme.surface2, color: theme.text3 }}>
                  Esc
                </kbd>
              </div>

              {/* Results */}
              <div className="max-h-80 overflow-y-auto">
                {query.trim().length === 0 ? (
                  <div className="px-4 py-8 text-center">
                    <div className="flex items-center justify-center gap-1.5 mb-2" style={{ color: theme.text3 }}>
                      <Command size={14} />
                      <span className="text-sm font-mono">K</span>
                    </div>
                    <p className="text-sm" style={{ color: theme.text3 }}>
                      Caută orice grilă sau întrebare
                    </p>
                  </div>
                ) : results.length === 0 ? (
                  <div className="px-4 py-8 text-center">
                    <p className="text-2xl mb-2">🔍</p>
                    <p className="text-sm" style={{ color: theme.text3 }}>Niciun rezultat pentru „{query}"</p>
                  </div>
                ) : (
                  <div className="py-1.5">
                    {/* Group header if we have quizzes */}
                    {results.some(r => r.type === 'quiz') && (
                      <div className="px-4 py-1.5">
                        <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: theme.text3 }}>
                          Grile
                        </span>
                      </div>
                    )}
                    {results.filter(r => r.type === 'quiz').map((result) => {
                      const colors = CARD_COLOR_MAP[result.quizColor] ?? CARD_COLOR_MAP.blue;
                      const globalIdx = results.indexOf(result);
                      return (
                        <ResultRow key={`quiz-${result.quizId}`}
                          result={result} isActive={activeIdx === globalIdx}
                          colors={colors} theme={theme}
                          onSelect={() => handleSelect(result)}
                          onHover={() => setActiveIdx(globalIdx)}
                        />
                      );
                    })}

                    {results.some(r => r.type === 'question') && (
                      <div className="px-4 py-1.5 mt-1">
                        <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: theme.text3 }}>
                          Întrebări
                        </span>
                      </div>
                    )}
                    {results.filter(r => r.type === 'question').map((result) => {
                      const colors = CARD_COLOR_MAP[result.quizColor] ?? CARD_COLOR_MAP.blue;
                      const globalIdx = results.indexOf(result);
                      return (
                        <ResultRow key={`q-${result.questionId ?? result.label.slice(0, 20)}-${result.quizId}`}
                          result={result} isActive={activeIdx === globalIdx}
                          colors={colors} theme={theme}
                          onSelect={() => handleSelect(result)}
                          onHover={() => setActiveIdx(globalIdx)}
                        />
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Footer */}
              {results.length > 0 && (
                <div className="px-4 py-2 flex items-center gap-3 text-xs"
                  style={{ borderTop: `1px solid ${theme.border}`, color: theme.text3 }}>
                  <span className="font-mono">↑↓</span> navighează
                  <span className="font-mono">↵</span> selectează
                  <span className="ml-auto">{results.length} rezultate</span>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function ResultRow({ result, isActive, colors, theme, onSelect, onHover }: {
  result: SearchResult;
  isActive: boolean;
  colors: { badge: string };
  theme: Theme;
  onSelect: () => void;
  onHover: () => void;
}) {
  const Icon = result.type === 'quiz' ? BookOpen : FileQuestion;
  return (
    <button
      onClick={onSelect}
      onMouseEnter={onHover}
      className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all"
      style={{ background: isActive ? theme.surface2 : 'transparent' }}
    >
      <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: `${colors.badge}18`, color: colors.badge }}>
        {result.type === 'quiz'
          ? <span className="text-base">{result.quizEmoji}</span>
          : <Icon size={15} />
        }
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: theme.text }}>{result.label}</p>
        {result.sub && (
          <p className="text-xs truncate" style={{ color: theme.text3 }}>{result.sub}</p>
        )}
      </div>
      {isActive && <ArrowRight size={14} style={{ color: theme.text3, flexShrink: 0 }} />}
    </button>
  );
}

/** Trigger button shown in TitleBar or anywhere */
export function GlobalSearchTrigger() {
  const theme = useTheme();
  return (
    <button
      data-tutorial="global-search"
      onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }))}
      className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs transition-all hover:opacity-80"
      style={{ background: theme.surface2, border: `1px solid ${theme.border}`, color: theme.text3 }}>
      <Search size={13} />
      <span>Caută</span>
      <kbd className="font-mono ml-1" style={{ opacity: 0.6 }}>Ctrl+K</kbd>
    </button>
  );
}
