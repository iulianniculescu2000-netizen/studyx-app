import { motion, AnimatePresence } from 'framer-motion';
import { useMemo, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CreditCard, Clock, CheckCircle, Circle, Play, BookOpen, FileText, Bot, Loader2, AlertCircle, Upload } from 'lucide-react';
import { useTheme } from '../theme/ThemeContext';
import { useQuizStore } from '../store/quizStore';
import { useStatsStore } from '../store/statsStore';
import { useAIStore } from '../store/aiStore';
import { notesToFlashcards } from '../lib/groq';
import { CARD_COLOR_MAP } from '../theme/colorMaps';
import type { Question, Difficulty } from '../types';
import { parsePDF } from '../ai/pdfParser';

function generateId() { return crypto.randomUUID().replace(/-/g, '').slice(0, 12); }
const OPTION_IDS = ['a', 'b', 'c', 'd', 'e', 'f'];

function MasteryRing({ pct, color }: { pct: number; color: string }) {
  const r = 20;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct / 100);
  return (
    <div className="relative w-12 h-12 flex-shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 48 48">
        <circle cx="24" cy="24" r={r} fill="none" stroke={`${color}28`} strokeWidth="3.5" />
        <motion.circle
          cx="24" cy="24" r={r} fill="none" stroke={color} strokeWidth="3.5"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: 'easeOut', delay: 0.2 }}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[10px] font-bold" style={{ color }}>{pct}%</span>
      </div>
    </div>
  );
}

export default function FlashcardHub() {
  const theme = useTheme();
  const navigate = useNavigate();
  const { quizzes, addQuiz } = useQuizStore();
  const { questionStats, getDueQuestions } = useStatsStore();
  const { hasKey } = useAIStore();

  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiCount, setAiCount] = useState(10);
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvError, setCsvError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  const generateDeckFromPdf = async (text: string) => {
    setAiLoading(true);
    setAiError('');
    try {
      const generated = await notesToFlashcards(text);
      const questions: Question[] = generated.slice(0, aiCount).map((g) => ({
        id: generateId(),
        text: g.front,
        multipleCorrect: false,
        difficulty: 'medium' as Difficulty,
        explanation: '',
        options: [{ id: OPTION_IDS[0] ?? generateId(), text: g.back, isCorrect: true }],
      }));
      if (questions.length === 0) throw new Error('AI nu a putut transforma PDF-ul în flashcarduri utile.');
      const id = generateId();
      addQuiz({
        id,
        title: `Deck AI · ${new Date().toLocaleDateString('ro-RO')}`,
        description: 'Flashcarduri generate automat din PDF cu AI',
        emoji: '🤖',
        color: 'purple',
        category: 'Altele',
        folderId: null,
        shuffleQuestions: true,
        shuffleAnswers: true,
        tags: ['ai', 'pdf'],
        questions,
        createdAt: Date.now(),
      });
      navigate(`/flashcards/session/${id}?mode=all`);
    } catch (e: any) {
      setAiError(e.message ?? 'Eroare la generare');
    } finally {
      setAiLoading(false);
    }
  };

  const handlePdfImport = async () => {
    if (window.electronAPI?.openPdfFile) {
      const text = await window.electronAPI.openPdfFile();
      if (text) await generateDeckFromPdf(text);
      else setAiError('Nu s-a putut extrage text din PDF. Încearcă un alt fișier.');
      return;
    }
    const input = fileInputRef.current;
    if (!input) return;
    input.value = '';
    input.click();
  };

  /**
   * Import Anki-style CSV/TSV: each row = "front[sep]back"
   * Supports: tab, semicolon, or comma separator; skips #comment lines.
   */
  const handleCsvImport = () => {
    const input = csvInputRef.current;
    if (!input) return;
    input.value = '';
    input.click();
  };

  const processCsvFile = async (file: File) => {
    setCsvImporting(true);
    setCsvError('');
    try {
      const text = await file.text();
      const lines = text.split('\n').filter(l => l.trim() && !l.startsWith('#'));
      if (lines.length === 0) throw new Error('Fișierul CSV este gol sau are doar comentarii.');

      // Detect separator (tab wins, then semicolon, then comma)
      const sep = lines[0].includes('\t') ? '\t' : lines[0].includes(';') ? ';' : ',';

      const questions: Question[] = [];
      for (const line of lines) {
        const parts = line.split(sep);
        if (parts.length < 2) continue;
        // Strip surrounding quotes if present
        const clean = (s: string) => s.trim().replace(/^"(.*)"$/, '$1').replace(/""/g, '"');
        const front = clean(parts[0]);
        const back = clean(parts.slice(1).join(sep)); // back may contain the separator
        if (!front || !back) continue;
        questions.push({
          id: generateId(),
          text: front,
          multipleCorrect: false,
          difficulty: 'medium' as Difficulty,
          explanation: '',
          options: [{ id: 'a', text: back, isCorrect: true }],
        });
      }

      if (questions.length === 0) throw new Error('Nu s-au găsit perechi front/back valide în CSV.');

      const deckId = generateId();
      const fileName = file.name.replace(/\.[^.]+$/, '');
      addQuiz({
        id: deckId,
        title: `Deck Anki · ${fileName}`,
        description: `Importat din ${file.name} (${questions.length} carduri)`,
        emoji: '🗂️',
        color: 'teal',
        category: 'Altele',
        folderId: null,
        shuffleQuestions: true,
        shuffleAnswers: false,
        tags: ['anki', 'import'],
        questions,
        createdAt: Date.now(),
      });
      navigate(`/flashcards/session/${deckId}?mode=all`);
    } catch (e: any) {
      setCsvError(e.message ?? 'Eroare la importul CSV');
    } finally {
      setCsvImporting(false);
    }
  };

  const dueQuestions = getDueQuestions();
  const totalDue = dueQuestions.length;

  // Build deck data per quiz
  const decks = useMemo(() => {
    return quizzes
      .filter(q => !q.archived && q.questions.length > 0)
      .map(quiz => {
        const total = quiz.questions.length;
        const stats = quiz.questions.map(q => questionStats[`${quiz.id}:${q.id}`]);
        const seen = stats.filter(Boolean).length;
        const due = stats.filter(s => s && s.nextReview > 0 && s.nextReview <= Date.now()).length;
        const mastered = stats.filter(s => s && s.timesCorrect >= 3 && s.timesCorrect / (s.timesCorrect + s.timesWrong) >= 0.8).length;
        const masteryPct = total > 0 ? Math.round((mastered / total) * 100) : 0;
        const colors = CARD_COLOR_MAP[quiz.color] ?? CARD_COLOR_MAP.blue;
        return { quiz, total, seen, due, mastered, masteryPct, colors };
      })
      .sort((a, b) => b.due - a.due || b.quiz.questions.length - a.quiz.questions.length);
  }, [quizzes, questionStats]);

  const totalCards = decks.reduce((s, d) => s + d.total, 0);
  const totalMastered = decks.reduce((s, d) => s + d.mastered, 0);

  return (
    <div className="h-full overflow-y-auto px-8 py-8">
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.txt"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.currentTarget.value = '';
          if (!file) return;
          const text = file.name.toLowerCase().endsWith('.pdf') ? await parsePDF(file) : await file.text();
          if (text.trim().length < 100) {
            setAiError('PDF-ul nu conține text suficient.');
            return;
          }
          await generateDeckFromPdf(text);
        }}
      />
      <input
        ref={csvInputRef}
        type="file"
        accept=".csv,.tsv,.txt"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) processCsvFile(f); }}
      />
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
              style={{ background: `${theme.accent2}20`, color: theme.accent2 }}>
              <CreditCard size={20} />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight" style={{ color: theme.text }}>
                Flashcarduri
              </h1>
              <p className="text-sm" style={{ color: theme.text3 }}>
                Repetare spațiată inteligentă · SM-2
              </p>
            </div>
          </div>
        </motion.div>

        {/* AI PDF → Deck */}
        {hasKey() && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="mb-6 rounded-2xl p-4"
            style={{ background: theme.surface, border: `1px solid ${theme.border}` }}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})` }}>
                <Bot size={16} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color: theme.text }}>Generează deck din PDF cu AI</p>
                <p className="text-xs" style={{ color: theme.text3 }}>Importă un curs PDF → AI creează flashcarduri instant</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="flex gap-1">
                  {[5, 10, 15, 20].map(n => (
                    <button key={n} onClick={() => setAiCount(n)}
                      className="w-9 h-8 rounded-lg text-xs font-semibold transition-all"
                      style={{
                        background: aiCount === n ? `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})` : theme.surface2,
                        color: aiCount === n ? '#fff' : theme.text2,
                        border: aiCount === n ? '1px solid transparent' : `1px solid ${theme.border}`,
                        boxShadow: aiCount === n ? `0 10px 24px ${theme.accent}30` : 'none',
                      }}>{n}</button>
                  ))}
                </div>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={handlePdfImport}
                  disabled={aiLoading}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-white"
                  style={{
                    background: aiLoading ? theme.surface2 : `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})`,
                    color: aiLoading ? theme.text3 : 'white',
                  }}>
                  {aiLoading
                    ? <><Loader2 size={13} className="animate-spin" />Generez...</>
                    : <><FileText size={13} />Import PDF</>}
                </motion.button>
              </div>
            </div>
            <AnimatePresence>
              {aiError && (
                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="mt-3 flex items-center gap-2 p-2.5 rounded-xl text-xs"
                  style={{ background: `${theme.danger}12`, border: `1px solid ${theme.danger}30`, color: theme.danger }}>
                  <AlertCircle size={12} />{aiError}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* Anki CSV Import */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-4 rounded-2xl p-4"
          style={{ background: theme.surface, border: `1px solid ${theme.border}` }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: `${theme.accent2}20`, color: theme.accent2 }}>
              <Upload size={16} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold" style={{ color: theme.text }}>Importă deck Anki (CSV)</p>
              <p className="text-xs" style={{ color: theme.text3 }}>Format: front;back sau front{'\t'}back · un card per linie</p>
            </div>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleCsvImport}
              disabled={csvImporting}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold"
              style={{
                background: csvImporting ? theme.surface2 : `${theme.accent2}18`,
                color: csvImporting ? theme.text3 : theme.accent2,
                border: `1px solid ${theme.accent2}30`,
              }}>
              {csvImporting
                ? <><Loader2 size={13} className="animate-spin" />Se importă...</>
                : <><Upload size={13} />Import CSV</>}
            </motion.button>
          </div>
          <AnimatePresence>
            {csvError && (
              <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="mt-3 flex items-center gap-2 p-2.5 rounded-xl text-xs"
                style={{ background: `${theme.danger}12`, border: `1px solid ${theme.danger}30`, color: theme.danger }}>
                <AlertCircle size={12} />{csvError}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Global stats bar */}
        <motion.div data-tutorial="flashcard-hub" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: 'Total carduri', value: totalCards, icon: <CreditCard size={16} />, color: theme.accent },
            { label: 'De recapitulat azi', value: totalDue, icon: <Clock size={16} />, color: totalDue > 0 ? theme.warning : theme.success },
            { label: 'Stăpânite', value: totalMastered, icon: <CheckCircle size={16} />, color: theme.success },
          ].map((s, i) => (
            <motion.div key={s.label}
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 + i * 0.05 }}
              className="rounded-2xl p-4 relative overflow-hidden"
              style={{ background: theme.surface, border: `1px solid ${theme.border}` }}>
              <div className="absolute top-0 left-0 w-16 h-16 rounded-full pointer-events-none"
                style={{ background: `radial-gradient(circle at top left, ${s.color}18, transparent 70%)` }} />
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{ background: `${s.color}18`, color: s.color }}>
                  {s.icon}
                </div>
                <span className="text-xs font-medium" style={{ color: theme.text3 }}>{s.label}</span>
              </div>
              <div className="text-2xl font-bold" style={{ color: theme.text }}>{s.value}</div>
            </motion.div>
          ))}
        </motion.div>

        {/* Review all due button */}
        {totalDue > 0 && (
          <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.18 }}
            className="mb-6 p-4 rounded-2xl flex items-center justify-between"
            style={{
              background: `linear-gradient(135deg, ${theme.warning}18, ${theme.accent}10)`,
              border: `1px solid ${theme.warning}35`,
              boxShadow: `0 4px 24px ${theme.warning}12`,
            }}>
            <div className="flex items-center gap-3">
              <motion.div
                animate={{ scale: [1, 1.12, 1] }}
                transition={{ repeat: Infinity, duration: 2.2, ease: 'easeInOut' }}
                className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                style={{ background: `${theme.warning}22` }}>
                ⚡
              </motion.div>
              <div>
                <p className="font-semibold" style={{ color: theme.text }}>
                  {totalDue} {totalDue === 1 ? 'card' : 'carduri'} de recapitulat azi
                </p>
                <p className="text-sm" style={{ color: theme.text2 }}>Studiu eficient · ~{Math.ceil(totalDue * 0.5)} minute</p>
              </div>
            </div>
            <Link to="/flashcards/session/all"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-white text-sm flex-shrink-0"
              style={{ background: `linear-gradient(135deg, ${theme.warning}, ${theme.accent})`, boxShadow: `0 4px 14px ${theme.warning}30` }}>
              <Play size={14} fill="white" />Recapitulează tot
            </Link>
          </motion.div>
        )}

        {/* Empty state */}
        {decks.length === 0 && (
          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="text-center py-20 rounded-3xl"
            style={{ background: theme.surface, border: `1px solid ${theme.border}` }}>
            <div className="text-5xl mb-4">🃏</div>
            <h3 className="text-lg font-semibold mb-2" style={{ color: theme.text }}>Nicio grilă încă</h3>
            <p className="text-sm mb-6" style={{ color: theme.text3 }}>
              Creează sau importă o grilă pentru a începe studiul cu flashcarduri.
            </p>
            <Link to="/create"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-semibold text-white"
              style={{ background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})` }}>
              <BookOpen size={15} />Creează o grilă
            </Link>
          </motion.div>
        )}

        {/* Decks grid */}
        {decks.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold" style={{ color: theme.text }}>Deck-urile tale</h2>
              <span className="text-sm" style={{ color: theme.text3 }}>{decks.length} {decks.length === 1 ? 'deck' : 'deck-uri'}</span>
            </div>
            <div className="grid grid-cols-1 gap-3">
              {decks.map((deck, i) => (
                <motion.div
                  key={deck.quiz.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + i * 0.05, ease: [0.16, 1, 0.3, 1] }}
                  whileHover={{ y: -1, transition: { duration: 0.15 } }}
                  className="rounded-2xl p-4 relative overflow-hidden"
                  style={{ background: theme.surface, border: `1px solid ${theme.border}` }}
                >
                  {/* Color accent */}
                  <div className="absolute inset-y-0 left-0 w-1 rounded-l-2xl"
                    style={{ background: `linear-gradient(180deg, ${deck.colors.from}, ${deck.colors.to})` }} />

                  <div className="flex items-center gap-4 ml-2">
                    {/* Emoji + title */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2.5 mb-1">
                        <span className="text-2xl leading-none">{deck.quiz.emoji}</span>
                        <div className="min-w-0">
                          <h3 className="font-semibold text-sm leading-snug truncate" style={{ color: theme.text }}>
                            {deck.quiz.title}
                          </h3>
                          <p className="text-xs truncate" style={{ color: theme.text3 }}>
                            {deck.quiz.category} · {deck.total} {deck.total === 1 ? 'card' : 'carduri'}
                          </p>
                        </div>
                      </div>

                      {/* Mini progress bar */}
                      <div className="flex items-center gap-2 mt-2">
                        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: theme.surface2 }}>
                          <motion.div
                            className="h-full rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${deck.masteryPct}%` }}
                            transition={{ duration: 0.8, ease: 'easeOut', delay: 0.3 + i * 0.05 }}
                            style={{ background: `linear-gradient(90deg, ${deck.colors.from}, ${deck.colors.to})` }}
                          />
                        </div>

                        {/* Stats chips */}
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {deck.due > 0 && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                              style={{ background: `${theme.warning}22`, color: theme.warning }}>
                              {deck.due} scadente
                            </span>
                          )}
                          {deck.seen === 0 && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full"
                              style={{ background: theme.surface2, color: theme.text3 }}>
                              Nou
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Mastery ring */}
                    <MasteryRing pct={deck.masteryPct} color={deck.due > 0 ? theme.warning : deck.masteryPct >= 80 ? theme.success : theme.accent} />

                    {/* Action buttons */}
                    <div className="flex flex-col gap-1.5">
                      <Link to={`/flashcards/session/${deck.quiz.id}`}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-white"
                        style={{
                          background: `linear-gradient(135deg, ${deck.colors.from}, ${deck.colors.to})`,
                          boxShadow: `0 10px 24px ${deck.colors.from.replace('0.85', '0.22').replace('0.9', '0.22')}`,
                          minWidth: 124,
                        }}>
                        <Play size={11} fill="white" />
                        {deck.due > 0 ? `${deck.due} scadente` : 'Studiază'}
                      </Link>
                      <Link to={`/flashcards/session/${deck.quiz.id}?mode=all`}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium"
                        style={{ background: theme.surface2, color: theme.text2, border: `1px solid ${theme.border}` }}>
                        <Circle size={10} />Previzualizare
                      </Link>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
