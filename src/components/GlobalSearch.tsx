import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Search, X, BookOpen, FileQuestion, ArrowRight, Command } from 'lucide-react';
import { useQuizStore } from '../store/quizStore';
import { useTheme } from '../theme/ThemeContext';
import { useUIStore } from '../store/uiStore';
import { useAdaptiveMotion } from '../hooks/useAdaptiveMotion';
import { CARD_COLOR_MAP } from '../theme/colorMaps';
import { type Theme } from '../theme/themes';

interface SearchResult {
  type: 'quiz' | 'question' | 'action';
  quizId: string;
  questionId?: string;
  quizTitle: string;
  quizEmoji: string;
  quizColor: string;
  label: string;
  sub?: string;
  href: string;
}

interface QuickAction {
  id: string;
  label: string;
  sub: string;
  href: string;
  icon: 'quiz' | 'question' | 'settings';
}

function normalizeSearchText(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

function toQuestionCountLabel(count: number) {
  return `${count} ${count === 1 ? 'întrebare' : 'întrebări'}`;
}

export default function GlobalSearch() {
  const theme = useTheme();
  const navigate = useNavigate();
  const { quizzes } = useQuizStore();
  const setChatOpen = useUIStore((state) => state.setChatOpen);
  const { calmMotion, performanceLite } = useAdaptiveMotion();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const quickActions = useMemo<QuickAction[]>(() => [
    { id: 'new-quiz', label: 'Creează grilă nouă', sub: 'Ajungi direct în editorul de grile', href: '/create', icon: 'quiz' },
    { id: 'review', label: 'Recapitulare zilnică', sub: 'Pornește întrebările scadente acum', href: '/daily-review', icon: 'question' },
    { id: 'vault', label: 'Biblioteca AI', sub: 'Importă cursuri, verifică sursele și organizează baza de cunoștințe', href: '/vault', icon: 'quiz' },
    { id: 'chat', label: 'Deschide chatul AI', sub: 'Continuă o explicație direct din asistentul StudyX', href: '/vault', icon: 'question' },
    { id: 'stats', label: 'Deschide statisticile', sub: 'Vezi progresul, acuratețea și trendurile', href: '/stats', icon: 'quiz' },
    { id: 'settings', label: 'Setări și AI', sub: 'Temă, backup, performanță și configurare AI', href: '/settings', icon: 'settings' },
  ], []);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        setQuery('');
        setActiveIdx(0);
        setOpen(true);
      }

      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (!open) return;
    const focusId = window.setTimeout(() => inputRef.current?.focus(), 50);
    return () => window.clearTimeout(focusId);
  }, [open]);

  const results = useMemo<SearchResult[]>(() => {
    if (query.trim().length < 1) return [];

    const normalizedQuery = normalizeSearchText(query);
    const out: SearchResult[] = [];

    for (const quiz of quizzes) {
      if (
        normalizeSearchText(quiz.title).includes(normalizedQuery)
        || normalizeSearchText(quiz.description).includes(normalizedQuery)
        || normalizeSearchText(quiz.category).includes(normalizedQuery)
        || (quiz.tags ?? []).some((tag) => normalizeSearchText(tag).includes(normalizedQuery))
      ) {
        const isFlashcard = (quiz.tags ?? []).includes('flashcard');
        const quizHref = isFlashcard ? `/flashcards/session/${quiz.id}` : `/quiz/${quiz.id}`;
        out.push({
          type: 'quiz',
          quizId: quiz.id,
          quizTitle: quiz.title,
          quizEmoji: quiz.emoji,
          quizColor: quiz.color,
          label: quiz.title,
          sub: `${toQuestionCountLabel(quiz.questions.length)} · ${quiz.category}`,
          href: quizHref,
        });
      }

      for (const question of quiz.questions) {
        const isFlashcard = (quiz.tags ?? []).includes('flashcard');
        const quizHref = isFlashcard ? `/flashcards/session/${quiz.id}` : `/quiz/${quiz.id}`;
        if (normalizeSearchText(question.text).includes(normalizedQuery)) {
          out.push({
            type: 'question',
            quizId: quiz.id,
            questionId: question.id,
            quizTitle: quiz.title,
            quizEmoji: quiz.emoji,
            quizColor: quiz.color,
            label: question.text,
            sub: quiz.title,
            href: quizHref,
          });
        }

        if ((question.tags ?? []).some((tag) => normalizeSearchText(tag).includes(normalizedQuery))) {
          out.push({
            type: 'question',
            quizId: quiz.id,
            questionId: question.id,
            quizTitle: quiz.title,
            quizEmoji: quiz.emoji,
            quizColor: quiz.color,
            label: question.text,
            sub: `${quiz.title} · ${(question.tags ?? []).join(', ')}`,
            href: quizHref,
          });
        }
      }

      if (out.length >= 20) break;
    }

    return out;
  }, [query, quizzes]);

  const quickActionResults = useMemo<SearchResult[]>(
    () => quickActions.map((action) => ({
      type: 'action',
      quizId: action.id,
      quizTitle: action.label,
      quizEmoji: action.icon === 'settings' ? '⚙️' : action.icon === 'question' ? '🧠' : '✨',
      quizColor: action.icon === 'settings' ? 'teal' : action.icon === 'question' ? 'purple' : 'blue',
      label: action.label,
      sub: action.sub,
      href: action.href,
    })),
    [quickActions],
  );

  const navigableResults = query.trim().length === 0 ? quickActionResults : results;
  const safeActiveIdx = navigableResults.length > 0
    ? Math.min(activeIdx, navigableResults.length - 1)
    : 0;

  const handleSelect = useCallback((result: SearchResult) => {
    setOpen(false);
    navigate(result.href);
  }, [navigate]);

  const handleQuickAction = useCallback((action: QuickAction) => {
    setOpen(false);
    if (action.id === 'chat') {
      setChatOpen(true);
      return;
    }
    navigate(action.href);
  }, [navigate, setChatOpen]);

  useEffect(() => {
    if (!open) return;

    const handler = (event: KeyboardEvent) => {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActiveIdx((index) => Math.min(index + 1, Math.max(navigableResults.length - 1, 0)));
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveIdx((index) => Math.max(index - 1, 0));
      }

      if (event.key === 'Enter' && navigableResults[safeActiveIdx]) {
        const result = navigableResults[safeActiveIdx];
        if (query.trim().length === 0 && result.type === 'action') {
          handleQuickAction(quickActions[safeActiveIdx]);
        } else {
          handleSelect(result);
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeIdx, handleQuickAction, handleSelect, navigableResults, open, query, quickActions, safeActiveIdx]);

  const handleQueryChange = (value: string) => {
    setQuery(value);
    setActiveIdx(0);
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={calmMotion ? { duration: 0.12 } : { duration: 0.15 }}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-50"
            style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: performanceLite ? 'blur(3px)' : 'blur(7px)' }}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -12 }}
            transition={calmMotion ? { duration: 0.18, ease: 'easeOut' } : { duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="fixed left-1/2 z-50 w-full max-w-[min(720px,calc(100vw-24px))] -translate-x-1/2"
            style={{ top: 'clamp(72px, 12vh, 132px)', paddingInline: 12 }}
          >
            <div className="premium-modal overflow-hidden rounded-[30px] shadow-2xl">
              <div
                className="flex items-center gap-3 px-4 py-4 sm:px-5"
                style={{ borderBottom: `1px solid ${theme.border}` }}
              >
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-2xl flex-shrink-0"
                  style={{ background: theme.surface2, border: `1px solid ${theme.border}` }}
                >
                  <Search size={18} style={{ color: theme.text3 }} />
                </div>

                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Caută grile, întrebări, taguri sau acțiuni..."
                  value={query}
                  onChange={(event) => handleQueryChange(event.target.value)}
                  className="flex-1 bg-transparent text-base font-semibold"
                  style={{ color: theme.text, outline: 'none', border: 'none' }}
                />

                {query && (
                  <motion.button
                    whileHover={calmMotion ? undefined : { scale: 1.05, rotate: 90 }}
                    whileTap={{ scale: 0.92 }}
                    onClick={() => setQuery('')}
                    className="press-feedback rounded-2xl p-2"
                    style={{ background: theme.surface2, color: theme.text3 }}
                  >
                    <X size={15} />
                  </motion.button>
                )}

                <div
                  className="hidden items-center gap-2 rounded-2xl px-3 py-2 text-[11px] font-semibold sm:flex"
                  style={{ background: theme.surface2, color: theme.text3, border: `1px solid ${theme.border}` }}
                >
                  <kbd className="font-mono">Esc</kbd>
                  <span>închide</span>
                </div>
              </div>

              <div className="custom-scrollbar max-h-[min(62vh,540px)] overflow-y-auto">
                {query.trim().length === 0 ? (
                  <div className="px-4 py-5 sm:px-5">
                    <div className="mb-4 flex items-center justify-center gap-1.5" style={{ color: theme.text3 }}>
                      <Command size={14} />
                      <span className="text-sm font-mono">K</span>
                    </div>

                    <p className="mx-auto mb-5 max-w-md text-center text-sm leading-relaxed" style={{ color: theme.text3 }}>
                      Caută rapid orice grilă, întrebare sau pornește o acțiune fără să ieși din fluxul de lucru.
                    </p>

                    <div className="space-y-2">
                      {quickActionResults.map((result, index) => (
                        <ResultRow
                          key={result.quizId}
                          result={result}
                          isActive={safeActiveIdx === index}
                          colors={CARD_COLOR_MAP[result.quizColor] ?? CARD_COLOR_MAP.blue}
                          theme={theme}
                          onSelect={() => handleQuickAction(quickActions[index])}
                          onHover={() => setActiveIdx(index)}
                        />
                      ))}
                    </div>
                  </div>
                ) : results.length === 0 ? (
                  <div className="px-4 py-12 text-center sm:px-5">
                    <div
                      className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[22px]"
                      style={{ background: theme.surface2, border: `1px solid ${theme.border}`, color: theme.text3 }}
                    >
                      <Search size={26} />
                    </div>
                    <p className="mb-1 text-base font-semibold" style={{ color: theme.text }}>Nu am găsit rezultate</p>
                    <p className="text-sm" style={{ color: theme.text3 }}>Încearcă alt cuvânt-cheie pentru "{query}".</p>
                  </div>
                ) : (
                  <div className="py-2">
                    {results.some((result) => result.type === 'quiz') && (
                      <div className="px-4 py-2 sm:px-5">
                        <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: theme.text3 }}>
                          Grile
                        </span>
                      </div>
                    )}

                    {results.filter((result) => result.type === 'quiz').map((result) => {
                      const colors = CARD_COLOR_MAP[result.quizColor] ?? CARD_COLOR_MAP.blue;
                      const globalIdx = results.indexOf(result);

                      return (
                        <ResultRow
                          key={`quiz-${result.quizId}`}
                          result={result}
                          isActive={safeActiveIdx === globalIdx}
                          colors={colors}
                          theme={theme}
                          onSelect={() => handleSelect(result)}
                          onHover={() => setActiveIdx(globalIdx)}
                        />
                      );
                    })}

                    {results.some((result) => result.type === 'question') && (
                      <div className="mt-1 px-4 py-2 sm:px-5">
                        <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: theme.text3 }}>
                          Întrebări
                        </span>
                      </div>
                    )}

                    {results.filter((result) => result.type === 'question').map((result) => {
                      const colors = CARD_COLOR_MAP[result.quizColor] ?? CARD_COLOR_MAP.blue;
                      const globalIdx = results.indexOf(result);

                      return (
                        <ResultRow
                          key={`question-${result.questionId ?? result.label.slice(0, 20)}-${result.quizId}`}
                          result={result}
                          isActive={safeActiveIdx === globalIdx}
                          colors={colors}
                          theme={theme}
                          onSelect={() => handleSelect(result)}
                          onHover={() => setActiveIdx(globalIdx)}
                        />
                      );
                    })}
                  </div>
                )}
              </div>

              {(results.length > 0 || query.trim().length === 0) && (
                <div
                  className="flex items-center gap-3 px-4 py-3 text-xs sm:px-5"
                  style={{ borderTop: `1px solid ${theme.border}`, color: theme.text3 }}
                >
                  <span className="font-mono">↑↓</span> navighează
                  <span className="font-mono">↵</span> selectează
                  <span className="ml-auto">
                    {query.trim().length === 0 ? `${quickActions.length} acțiuni rapide` : `${results.length} rezultate`}
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function ResultRow({
  result,
  isActive,
  colors,
  theme,
  onSelect,
  onHover,
}: {
  result: SearchResult;
  isActive: boolean;
  colors: { badge: string };
  theme: Theme;
  onSelect: () => void;
  onHover: () => void;
}) {
  const Icon = result.type === 'quiz' ? BookOpen : result.type === 'question' ? FileQuestion : Command;

  return (
    <button
      onClick={onSelect}
      onMouseEnter={onHover}
      className="press-feedback w-full rounded-[22px] px-4 py-3 text-left transition-all sm:px-5"
      style={{
        background: isActive ? `linear-gradient(135deg, ${theme.surface2}, ${theme.surface})` : 'transparent',
        boxShadow: isActive ? 'inset 0 1px 0 rgba(255,255,255,0.08), 0 14px 28px rgba(0,0,0,0.06)' : 'none',
      }}
    >
      <div className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-2xl flex-shrink-0"
          style={{ background: `${colors.badge}18`, color: colors.badge, border: `1px solid ${colors.badge}22` }}
        >
          {result.type === 'quiz' ? <span className="text-base">{result.quizEmoji}</span> : <Icon size={15} />}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold" style={{ color: theme.text }}>{result.label}</p>
          {result.sub && (
            <p className="truncate text-xs" style={{ color: theme.text3 }}>{result.sub}</p>
          )}
        </div>

        {isActive && <ArrowRight size={14} style={{ color: theme.text3, flexShrink: 0 }} />}
      </div>
    </button>
  );
}

export function GlobalSearchTrigger() {
  const theme = useTheme();

  return (
    <button
      data-tutorial="global-search"
      onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }))}
      className="press-feedback flex items-center gap-2 rounded-[16px] px-3 py-2 text-xs transition-all"
      style={{ background: theme.surface2, border: `1px solid ${theme.border}`, color: theme.text3 }}
    >
      <Search size={13} />
      <span>Caută</span>
      <kbd className="ml-1 font-mono" style={{ opacity: 0.6 }}>Ctrl+K</kbd>
    </button>
  );
}
