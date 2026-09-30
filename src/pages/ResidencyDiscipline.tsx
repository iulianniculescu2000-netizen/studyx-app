import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Layers, Loader2, Play, Plus, Shuffle } from 'lucide-react';
import { useTheme } from '../theme/ThemeContext';
import type { Quiz } from '../types';
import { useToastStore } from '../store/toastStore';
import { useQuizStore } from '../store/quizStore';
import { useFolderStore } from '../store/folderStore';
import { useAdaptiveMotion } from '../hooks/useAdaptiveMotion';
import BookShelf from '../components/residency/BookShelf';
import { useRezidentiatOverview, useResidencyBooks } from '../components/residency/useResidencyData';
import { bookDisciplineHint, disciplineKey, type SpecialtyOverview } from '../lib/rezidentiatOverview';
import { startKumarDeck } from '../lib/startKumarDeck';
import { startQuizMix } from '../lib/quizMixSession';
import { REZIDENTIAT_BANKS } from '../lib/rezidentiatBank';
import { REZIDENTIAT_AI_FLASHCARDS_FOLDER_NAME } from '../lib/rezidentiatRoot';

type Tab = 'specialitati' | 'carti' | 'carduri';
const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'specialitati', label: 'Specialități' },
  { id: 'carti', label: 'Cărți' },
  { id: 'carduri', label: 'Carduri' },
];

const number = (value: number) => value.toLocaleString('ro-RO');

/** "Cardiologie — Test 3" → "Test 3": the specialty is already the heading above it. */
function shortTitle(title: string, specialty: string): string {
  const stripped = title.replace(specialty, '').replace(/^[\s—–:-]+/, '').trim();
  return stripped || title;
}

/** Which bundled bank a quiz came from, so one specialty's tests can be shown grouped by source. */
function bankLabel(quiz: { tags?: string[] }): string {
  const tag = quiz.tags?.find((t) => t.startsWith('rezidentiat-bank:'));
  if (!tag && quiz.tags?.includes('ai-studio')) return 'Generate cu AI';
  return REZIDENTIAT_BANKS.find((bank) => bank.tag === tag)?.label ?? 'Alte grile';
}

function SegmentedTabs({ value, onChange }: { value: Tab; onChange: (tab: Tab) => void }) {
  const theme = useTheme();
  return (
    <div role="tablist" className="flex rounded-[10px] p-0.5" style={{ background: 'var(--fill-subtle)' }}>
      {TABS.map((tab) => {
        const active = tab.id === value;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            className="flex-1 rounded-[8px] px-3 py-1.5 text-[12.5px] transition-colors"
            style={{
              background: active ? theme.surface : 'transparent',
              color: active ? theme.text : theme.text2,
              fontWeight: active ? 600 : 500,
              boxShadow: active ? '0 0 0 1px var(--hairline)' : 'none',
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

function SpecialtyDetail({ specialty }: { specialty: SpecialtyOverview }) {
  const theme = useTheme();
  const navigate = useNavigate();
  const sessions = useQuizStore((state) => state.sessions);

  const bestByQuiz = useMemo(() => {
    const best = new Map<string, number>();
    for (const session of sessions) {
      if (!session.finishedAt || session.total <= 0) continue;
      const pct = Math.round((session.score / session.total) * 100);
      if (pct > (best.get(session.quizId) ?? -1)) best.set(session.quizId, pct);
    }
    return best;
  }, [sessions]);

  const groups = useMemo(() => {
    const byLabel = new Map<string, Quiz[]>();
    for (const quiz of specialty.quizzes) {
      const label = bankLabel(quiz);
      byLabel.set(label, [...(byLabel.get(label) ?? []), quiz]);
    }
    return [...byLabel.entries()].map(([label, quizzes]) => ({ label, quizzes }));
  }, [specialty.quizzes]);

  const next = specialty.quizzes.find((quiz) => !bestByQuiz.has(quiz.id)) ?? specialty.quizzes[0];
  const untouched = specialty.answered === 0;

  return (
    <div className="space-y-3">
      <div className="rounded-2xl p-4" style={{ background: theme.surface, border: '1px solid var(--hairline)' }}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-[17px] font-semibold" style={{ color: theme.text }}>{specialty.name}</div>
            <div className="text-[12.5px]" style={{ color: theme.text3 }}>
              {specialty.quizzes.length} teste · {number(specialty.questionCount)} grile · {specialty.progress}% parcurs
            </div>
          </div>
          {next && (
            <Link
              to={`/quiz/${next.id}`}
              className="press-feedback flex flex-shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-semibold text-white transition-[filter] duration-300 hover:brightness-110"
              style={{ background: theme.accent }}
            >
              <Play size={13} /> {untouched ? 'Începe' : 'Continuă'}
            </Link>
          )}
        </div>
        <div className="mt-3 h-1 overflow-hidden rounded-full" style={{ background: 'var(--fill-subtle)' }}>
          <div className="h-full rounded-full" style={{ width: `${specialty.progress}%`, background: theme.accent }} />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {specialty.quizzes.length > 1 && (
            <button
              type="button"
              onClick={() => {
                const id = startQuizMix(specialty.folder, specialty.quizzes, `${specialty.name} — sesiune completă`);
                if (id) navigate(`/play/${id}`);
              }}
              className="fine-chip press-feedback flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-medium"
              style={{ color: theme.text2 }}
            >
              <Shuffle size={13} /> Joacă tot
            </button>
          )}
          <Link
            to={`/create?folder=${specialty.folder.id}`}
            className="fine-chip press-feedback flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-medium"
            style={{ color: theme.text2 }}
          >
            <Plus size={13} /> Grilă nouă
          </Link>
        </div>
      </div>

      {groups.map((group) => (
        <div key={group.label}>
          {groups.length > 1 && (
            <h3 className="mb-1.5 mt-1 px-1 text-[12px] font-medium tracking-wide" style={{ color: theme.text3 }}>{group.label.toUpperCase()}</h3>
          )}
          <div className="overflow-hidden rounded-2xl" style={{ background: theme.surface, border: '1px solid var(--hairline)' }}>
            {group.quizzes.map((quiz, index) => {
              const best = bestByQuiz.get(quiz.id);
              const color = best === undefined ? theme.text3 : best >= 75 ? theme.success : best >= 45 ? theme.warning : theme.danger;
              return (
                <Link
                  key={quiz.id}
                  to={`/quiz/${quiz.id}`}
                  className="fine-row flex items-center gap-3 px-4 py-3"
                  style={{ borderRadius: 0, borderTop: index === 0 ? undefined : '1px solid var(--hairline)' }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-semibold" style={{ color: theme.text }}>{shortTitle(quiz.title, specialty.name)}</div>
                    <div className="text-[12px]" style={{ color: theme.text3 }}>{quiz.questions.length} grile</div>
                  </div>
                  <span className="text-[12.5px] font-semibold" style={{ color }}>{best === undefined ? 'Neîncercat' : `${best}%`}</span>
                  <ChevronRight size={16} style={{ color: theme.text3 }} />
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ResidencyDiscipline() {
  const theme = useTheme();
  const navigate = useNavigate();
  const { calmMotion } = useAdaptiveMotion();
  const { folderId } = useParams<{ folderId: string }>();
  const addToast = useToastStore((state) => state.addToast);
  const overview = useRezidentiatOverview();
  const { books, addBookHref } = useResidencyBooks();
  const folders = useFolderStore((state) => state.folders);
  const quizzes = useQuizStore((state) => state.quizzes);
  const [tab, setTab] = useState<Tab>('specialitati');
  const [searchParams] = useSearchParams();
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get('s'));
  const [startingDeck, setStartingDeck] = useState(false);

  const discipline = overview.disciplines.find((d) => d.folder.id === folderId) ?? null;
  const selected = discipline?.specialties.find((s) => s.folder.id === selectedId) ?? discipline?.specialties[0] ?? null;

  const disciplineBooks = useMemo(() => {
    if (!discipline) return [];
    const key = disciplineKey(discipline.folder.name);
    return key ? books.filter((book) => bookDisciplineHint(book.name) === key) : [];
  }, [books, discipline]);

  const aiDecks = useMemo(() => {
    const folder = folders.find((f) => f.name === REZIDENTIAT_AI_FLASHCARDS_FOLDER_NAME);
    if (!folder) return [];
    return quizzes.filter((q) => q.folderId === folder.id && !q.archived && q.kind === 'flashcard');
  }, [folders, quizzes]);

  if (!discipline) {
    return (
      <div className="h-full overflow-y-auto px-4 py-10 sm:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <p className="mb-3 text-sm" style={{ color: theme.text3 }}>Disciplina nu a fost găsită.</p>
          <Link to="/rezidentiat" className="text-[13px] font-semibold" style={{ color: theme.accent }}>Înapoi la Rezidențiat</Link>
        </div>
      </div>
    );
  }

  const openKumarDeck = async () => {
    if (startingDeck) return;
    setStartingDeck(true);
    try {
      const deckId = await startKumarDeck();
      if (deckId) navigate(`/flashcards/session/${deckId}`);
      else addToast('Setul de carduri nu a putut fi încărcat.', 'error', 5000);
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Setul de carduri nu a putut fi încărcat.', 'error', 5000);
    } finally {
      setStartingDeck(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto px-4 py-6 sm:px-8 sm:py-10">
      <div className="mx-auto max-w-3xl space-y-5">
        <Link to="/rezidentiat" className="press-feedback inline-flex items-center gap-0.5 text-[13.5px] font-medium" style={{ color: theme.accent }}>
          <ChevronLeft size={16} /> Rezidențiat
        </Link>
        <motion.header initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="page-title-compact" style={{ color: theme.text }}>{discipline.folder.name}</h1>
          <p className="mt-1 text-[13px]" style={{ color: theme.text3 }}>
            {discipline.specialties.length} specialități · {number(discipline.questionCount)} grile · {discipline.progress}% parcurs
          </p>
        </motion.header>

        <SegmentedTabs value={tab} onChange={setTab} />

        {tab === 'specialitati' && selected && (
          <div className="grid gap-4 md:grid-cols-[minmax(0,240px)_minmax(0,1fr)]">
            <div
              className="max-h-[60vh] self-start overflow-y-auto rounded-2xl md:sticky md:top-2 md:max-h-[calc(100vh-9rem)]"
              style={{ background: theme.surface, border: '1px solid var(--hairline)' }}
              role="listbox"
              aria-label="Specialități"
            >
              {discipline.specialties.map((specialty, index) => {
                const active = specialty.folder.id === selected.folder.id;
                return (
                  <button
                    key={specialty.folder.id}
                    type="button"
                    role="option"
                    aria-selected={active}
                    data-active={active}
                    onClick={() => setSelectedId(specialty.folder.id)}
                    className="fine-row flex w-full items-center gap-2 px-3.5 py-2.5 text-left"
                    style={{ borderRadius: 0, borderTop: index === 0 ? undefined : '1px solid var(--hairline)', boxShadow: 'none' }}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13.5px] font-semibold" style={{ color: active ? theme.accent : theme.text }}>{specialty.name}</div>
                      <div className="text-[11.5px]" style={{ color: theme.text3 }}>{specialty.quizzes.length} teste · {number(specialty.questionCount)} grile</div>
                    </div>
                    <span className="text-[11.5px] font-semibold" style={{ color: active ? theme.accent : theme.text3 }}>{specialty.progress}%</span>
                  </button>
                );
              })}
            </div>
            <SpecialtyDetail key={selected.folder.id} specialty={selected} />
          </div>
        )}

        {tab === 'carti' && (
          <BookShelf
            books={disciplineBooks}
            addBookHref={addBookHref}
            calmMotion={calmMotion}
            emptyMessage="Nicio carte pentru această disciplină. Cărțile fără disciplină clară (ex. Sinopsis) sunt în ecranul principal, la „Cărțile tale”."
          />
        )}

        {tab === 'carduri' && (
          <div className="space-y-4">
            <div className="overflow-hidden rounded-2xl" style={{ background: theme.surface, border: '1px solid var(--hairline)' }}>
              <button
                type="button"
                onClick={() => void openKumarDeck()}
                className="fine-row flex w-full items-center gap-3 px-4 py-3.5 text-left"
                style={{ borderRadius: 0 }}
              >
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px]" style={{ background: `${theme.accent}18`, color: theme.accent }}>
                  <Layers size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-semibold" style={{ color: theme.text }}>Carduri Kumar</div>
                  <div className="text-[12px]" style={{ color: theme.text3 }}>Concepte cheie din manual, pe capitole</div>
                </div>
                {startingDeck ? <Loader2 size={16} className="animate-spin" style={{ color: theme.text3 }} /> : <ChevronRight size={16} style={{ color: theme.text3 }} />}
              </button>
            </div>
            {aiDecks.length > 0 && (
              <div>
                <h2 className="mb-2 px-1 text-[12px] font-medium tracking-wide" style={{ color: theme.text3 }}>GENERATE DIN CĂRȚI</h2>
                <div className="overflow-hidden rounded-2xl" style={{ background: theme.surface, border: '1px solid var(--hairline)' }}>
                  {aiDecks.map((deck, index) => (
                    <Link
                      key={deck.id}
                      to={`/flashcards/session/${deck.id}`}
                      className="fine-row flex items-center gap-3 px-4 py-3"
                      style={{ borderRadius: 0, borderTop: index === 0 ? undefined : '1px solid var(--hairline)' }}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[14px] font-semibold" style={{ color: theme.text }}>{deck.title}</div>
                        <div className="text-[12px]" style={{ color: theme.text3 }}>{deck.questions.length} carduri</div>
                      </div>
                      <ChevronRight size={16} style={{ color: theme.text3 }} />
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
