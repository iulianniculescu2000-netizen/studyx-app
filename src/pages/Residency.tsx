import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight, HelpCircle, Layers, Loader2, MessageCircle, Play, Plus, Scissors, Stethoscope, Library, HeartPulse, BookOpen } from 'lucide-react';
import { useTheme } from '../theme/ThemeContext';
import { useAIStore } from '../store/aiStore';
import { useQuizStore } from '../store/quizStore';
import { useUIStore } from '../store/uiStore';
import { useToastStore } from '../store/toastStore';
import { useAdaptiveMotion } from '../hooks/useAdaptiveMotion';
import RezidentiatTutorial, { REZIDENTIAT_TUTORIAL_OPEN_EVENT } from '../components/RezidentiatTutorial';
import BookShelf from '../components/residency/BookShelf';
import ImportPanel from '../components/residency/ImportPanel';
import { useRezidentiatOverview, useResidencyBooks } from '../components/residency/useResidencyData';
import { disciplineKey } from '../lib/rezidentiatOverview';
import { startKumarDeck } from '../lib/startKumarDeck';
import { REZIDENTIAT_ROOT_NAME } from '../lib/rezidentiatRoot';
import { adoptStrayResidencyQuizzes } from '../lib/rezidentiatPlacement';

const number = (value: number) => value.toLocaleString('ro-RO');

function DisciplineIcon({ name, size = 20 }: { name: string; size?: number }) {
  const key = disciplineKey(name);
  if (key === 'chirurgie') return <Scissors size={size} />;
  if (key === 'medicina-interna') return <HeartPulse size={size} />;
  return <Stethoscope size={size} />;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  return <h2 className="mb-2 px-1 text-[12px] font-medium tracking-wide" style={{ color: theme.text3 }}>{children}</h2>;
}

function ResourceRow({
  icon,
  title,
  detail,
  onClick,
  busy,
  first,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
  onClick: () => void;
  busy?: boolean;
  first?: boolean;
}) {
  const theme = useTheme();
  return (
    <button
      type="button"
      onClick={onClick}
      className="fine-row flex w-full items-center gap-3 px-4 py-3 text-left"
      style={{ borderRadius: 0, borderTop: first ? undefined : '1px solid var(--hairline)' }}
    >
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px]" style={{ background: `${theme.accent}18`, color: theme.accentText }}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-semibold" style={{ color: theme.text }}>{title}</div>
        <div className="truncate text-[12px]" style={{ color: theme.text3 }}>{detail}</div>
      </div>
      {busy ? <Loader2 size={16} className="animate-spin" style={{ color: theme.text3 }} /> : <ChevronRight size={16} style={{ color: theme.text3 }} />}
    </button>
  );
}

export default function Residency() {
  const theme = useTheme();
  const navigate = useNavigate();
  const { calmMotion } = useAdaptiveMotion();
  const addToast = useToastStore((state) => state.addToast);
  const setChatOpen = useUIStore((state) => state.setChatOpen);
  const addLibraryFolder = useAIStore((state) => state.addLibraryFolder);
  const overview = useRezidentiatOverview();
  const { books, addBookHref, hasLibraryRoot } = useResidencyBooks();
  const [showBooks, setShowBooks] = useState(false);

  // Sets an AI agent filed straight into the section root are moved into "Grile" so none is stranded.
  // Runs once the profile's data is in the stores: with empty stores it would find nothing and never run again.
  const hydrated = useQuizStore((state) => state._hasHydrated);
  useEffect(() => { if (hydrated) adoptStrayResidencyQuizzes(); }, [hydrated]);
  const [startingDeck, setStartingDeck] = useState(false);

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

  // Before the profile loads every list is empty: showing "nothing yet" (or offering to add every bank) would be wrong.
  if (!hydrated) return <div className="h-full" aria-busy="true" />;

  const { disciplines, resume, totalQuestions, totalSpecialties } = overview;
  const hasBank = disciplines.length > 0;

  return (
    <div className="h-full overflow-y-auto px-4 py-6 sm:px-8 sm:py-10">
      <RezidentiatTutorial />
      <div className="mx-auto max-w-3xl space-y-7">
        <motion.header initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="page-title-compact" style={{ color: theme.text }}>Rezidențiat</h1>
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent(REZIDENTIAT_TUTORIAL_OPEN_EVENT))}
                aria-label="Vezi tutorialul secțiunii Rezidențiat"
                title="Tur rapid"
                className="fine-row press-feedback flex h-7 w-7 items-center justify-center rounded-full"
                style={{ color: theme.text3 }}
              >
                <HelpCircle size={16} />
              </button>
            </div>
            <p className="mt-1 text-[13px]" style={{ color: theme.text3 }}>
              {hasBank
                ? `${disciplines.filter((d) => d.specialties.some((s) => !s.loose)).length} discipline · ${totalSpecialties} specialități · ${number(totalQuestions)} grile`
                : 'Grile reale, cărți și carduri, într-un singur loc.'}
            </p>
          </div>
          <Link
            to={addBookHref}
            aria-label="Adaugă o carte"
            title="Adaugă o carte"
            className="fine-row press-feedback flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full"
            style={{ background: theme.surface2, color: theme.text2 }}
          >
            <Plus size={18} />
          </Link>
        </motion.header>

        {resume && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.04 }}
            className="flex items-center gap-3.5 rounded-2xl px-4 py-3.5"
            style={{ background: theme.surface, border: '1px solid var(--hairline)' }}
          >
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[12px]" style={{ background: `${theme.accent}18`, color: theme.accentText }}>
              <Play size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11.5px]" style={{ color: theme.text3 }}>Continuă</div>
              <div className="truncate text-[14.5px] font-semibold" style={{ color: theme.text }}>{resume.quiz.title}</div>
            </div>
            <Link
              to={`/quiz/${resume.quiz.id}`}
              className="press-feedback rounded-full px-4 py-2 text-[13px] font-semibold text-white transition-[filter] duration-300 hover:brightness-110"
              style={{ background: theme.accent }}
            >
              Reia
            </Link>
          </motion.div>
        )}

        {hasBank && (
          <section>
            <SectionLabel>DISCIPLINE</SectionLabel>
            <div className="grid gap-3 sm:grid-cols-2">
              {disciplines.map((discipline, index) => (
                <motion.div
                  key={discipline.folder.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.06 + index * 0.04 }}
                >
                  <Link
                    to={`/rezidentiat/${discipline.folder.id}`}
                    className="fine-card press-feedback block rounded-2xl p-4"
                    style={{ background: theme.surface }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex h-10 w-10 items-center justify-center rounded-[12px]" style={{ background: `${theme.accent}18`, color: theme.accentText }}>
                        <DisciplineIcon name={discipline.folder.name} />
                      </div>
                      <ChevronRight size={16} style={{ color: theme.text3 }} />
                    </div>
                    <div className="mt-3 text-[16px] font-semibold" style={{ color: theme.text }}>{discipline.folder.name}</div>
                    <div className="text-[12.5px]" style={{ color: theme.text3 }}>
                      {discipline.specialties.length} specialități · {number(discipline.questionCount)} grile
                    </div>
                    <div className="mt-3.5 h-1 overflow-hidden rounded-full" style={{ background: 'var(--fill-subtle)' }}>
                      <div className="h-full rounded-full" style={{ width: `${discipline.progress}%`, background: theme.accent }} />
                    </div>
                    <div className="mt-1.5 text-[11.5px]" style={{ color: theme.text3 }}>{discipline.progress}% parcurs</div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </section>
        )}

        <section>
          <SectionLabel>RESURSE</SectionLabel>
          <div className="overflow-hidden rounded-2xl" style={{ background: theme.surface, border: '1px solid var(--hairline)' }}>
            <ResourceRow
              first
              icon={<Layers size={18} />}
              title="Carduri Kumar"
              detail="Concepte cheie din manual, pe capitole"
              onClick={() => void openKumarDeck()}
              busy={startingDeck}
            />
            <ResourceRow
              icon={<Library size={18} />}
              title="Cărțile tale"
              detail={books.length > 0 ? `${books.length} ${books.length === 1 ? 'carte' : 'cărți'} · capitole, discuții și grile generate` : 'Nicio carte adăugată încă'}
              onClick={() => setShowBooks((open) => !open)}
            />
            <ResourceRow
              icon={<MessageCircle size={18} />}
              title="Întreabă din cărți"
              detail="Răspunsuri cu trimitere la capitol"
              onClick={() => setChatOpen(true)}
            />
          </div>
        </section>

        {showBooks && (
          hasLibraryRoot ? (
            <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <SectionLabel>CĂRȚILE TALE</SectionLabel>
              <BookShelf books={books} addBookHref={addBookHref} calmMotion={calmMotion} emptyMessage="Secțiunea e goală — adaugă prima carte." />
            </motion.section>
          ) : (
            <div className="rounded-2xl px-5 py-8 text-center" style={{ background: theme.surface, border: '1px solid var(--hairline)' }}>
              <BookOpen size={26} style={{ color: theme.accentText, margin: '0 auto 10px' }} />
              <p className="mx-auto mb-4 max-w-sm text-sm" style={{ color: theme.text3 }}>
                Creează secțiunea Rezidențiat în bibliotecă, apoi încarcă acolo cărțile de referință.
              </p>
              <button
                type="button"
                onClick={() => addLibraryFolder(REZIDENTIAT_ROOT_NAME, '🩺')}
                className="press-feedback rounded-full px-5 py-2 text-[13px] font-semibold text-white"
                style={{ background: theme.accent }}
              >
                Creează secțiunea
              </button>
            </div>
          )
        )}

        <ImportPanel />
      </div>
    </div>
  );
}
