import { motion, AnimatePresence } from 'framer-motion';
import { useMemo, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CreditCard, Clock, CheckCircle, Circle, Play, BookOpen, FileText, Bot, Loader2, AlertCircle, Upload, Sparkles } from 'lucide-react';
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
    } catch (err: unknown) {
      setAiError(err instanceof Error ? err.message : 'Eroare la generare');
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
    } catch (err: unknown) {
      setCsvError(err instanceof Error ? err.message : 'Eroare la importul CSV');
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
    <div className="h-full overflow-y-auto px-4 sm:px-8 py-6 sm:py-8">
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
            setAiError('PDF-ul pare a fi o imagine scanată fără text digital. Încearcă un alt PDF sau folosește secțiunea "Biblioteca AI" pentru a procesa documentul cu OCR înainte.');
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
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-[18px] flex items-center justify-center shadow-lg"
                style={{ background: `linear-gradient(135deg, ${theme.accent2} 0%, ${theme.accent} 100%)`, color: '#fff' }}>
                <CreditCard size={24} />
              </div>
              <div>
                <h1 className="text-3xl font-black tracking-tight mb-0.5" style={{ color: theme.text }}>
                  Flashcarduri
                </h1>
                <p className="text-[11px] font-black uppercase tracking-widest opacity-60" style={{ color: theme.text }}>
                  Repetare Spațiată · SM-2
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Global stats bar */}
        <motion.div data-tutorial="flashcard-hub" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: 'Total carduri', value: totalCards, icon: <CreditCard size={18} />, color: theme.accent },
            { label: 'De recapitulat', value: totalDue, icon: <Clock size={18} />, color: totalDue > 0 ? theme.warning : theme.success },
            { label: 'Stăpânite', value: totalMastered, icon: <CheckCircle size={18} />, color: theme.success },
          ].map((s, i) => (
            <motion.div key={s.label}
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 + i * 0.05 }}
              whileHover={{ y: -2, boxShadow: `0 8px 24px ${s.color}15` }}
              className="rounded-2xl p-4 relative overflow-hidden"
              style={{ background: theme.surface, border: `1px solid ${theme.border}` }}>
              <div className="absolute top-0 left-0 w-20 h-20 rounded-full pointer-events-none"
                style={{ background: `radial-gradient(circle at top left, ${s.color}15, transparent 70%)` }} />
              <div className="flex items-center gap-3 mb-2 relative">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{ background: `${s.color}15`, color: s.color }}>
                  {s.icon}
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider opacity-60" style={{ color: theme.text }}>{s.label}</span>
              </div>
              <div className="text-2xl font-black tracking-tighter relative" style={{ color: theme.text }}>{s.value}</div>
            </motion.div>
          ))}
        </motion.div>

        {/* AI PDF → Deck */}
        {hasKey() && (
          <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="mb-8 p-5 rounded-[28px] relative overflow-hidden"
            style={{ 
              background: `linear-gradient(135deg, ${theme.accent2}15, ${theme.accent}08)`,
              border: `1px solid ${theme.accent2}30`,
              boxShadow: '0 8px 32px rgba(0,0,0,0.12)'
            }}>
            <div className="absolute top-0 right-0 w-40 h-40 rounded-full blur-[60px] pointer-events-none"
              style={{ background: `${theme.accent2}25` }} />

            <div className="relative flex flex-col md:flex-row md:items-center gap-6">
              <div className="w-16 h-16 rounded-3xl flex items-center justify-center flex-shrink-0 shadow-2xl transition-transform hover:rotate-6"
                style={{ background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})`, boxShadow: `0 12px 24px ${theme.accent}40` }}>
                <Bot size={32} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70" style={{ color: theme.accent2 }}>AI Flashcard Generator</span>
                  <div className="w-1 h-1 rounded-full opacity-30" style={{ background: theme.accent2 }} />
                  <Sparkles size={12} className="animate-pulse" style={{ color: theme.accent2 }} />
                </div>
                <p className="text-xl font-black tracking-tight leading-tight" style={{ color: theme.text }}>Transformă cursul în carduri instant</p>
                <p className="text-sm font-medium opacity-50 mt-1.5 leading-relaxed" style={{ color: theme.text }}>Încarcă un PDF și AI-ul va extrage inteligent conceptele cheie pentru tine.</p>
              </div>
              
              <div className="flex flex-col gap-3.5 flex-shrink-0 min-w-[200px]">
                <div className="flex p-1 rounded-[14px] glass-panel border border-white/5" style={{ background: theme.surface2 }}>
                  {[5, 10, 20, 30].map(n => (
                    <button key={n} onClick={() => setAiCount(n)}
                      className="flex-1 py-2 rounded-lg text-[10px] font-black transition-all relative overflow-hidden"
                      style={{
                        background: aiCount === n ? theme.accent : 'transparent',
                        color: aiCount === n ? '#fff' : theme.text3,
                      }}>
                      {aiCount === n && <motion.div layoutId="active-ai-n" className="absolute inset-0 z-0 bg-accent shadow-lg" style={{ background: theme.accent }} />}
                      <span className="relative z-10">{n}</span>
                    </button>
                  ))}
                </div>
                <motion.button
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handlePdfImport}
                  disabled={aiLoading}
                  className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-[18px] font-black text-xs uppercase tracking-widest text-white shadow-2xl transition-all"
                  style={{
                    background: aiLoading ? theme.surface2 : `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})`,
                    boxShadow: aiLoading ? 'none' : `0 12px 30px ${theme.accent}40`,
                  }}>
                  {aiLoading
                    ? <><Loader2 size={16} className="animate-spin" /> Se analizează...</>
                    : <><FileText size={16} /> Selectează PDF</>}
                </motion.button>
              </div>
            </div>
            <AnimatePresence>
              {aiError && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="mt-5 flex items-start gap-3 p-4 rounded-2xl border backdrop-blur-sm"
                  style={{ background: `${theme.danger}08`, borderColor: `${theme.danger}20`, color: theme.danger }}>
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <div className="text-[11px] font-bold leading-relaxed">{aiError}</div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* Anki CSV Import */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="mb-8 rounded-3xl p-5 group transition-all hover:translate-y-[-2px]"
          style={{ background: theme.surface, border: `1px solid ${theme.border}`, boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110"
              style={{ background: `${theme.accent2}15`, color: theme.accent2 }}>
              <Upload size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-black uppercase tracking-wider" style={{ color: theme.text }}>Import Anki / CSV</p>
              <p className="text-xs font-medium opacity-60 mt-1" style={{ color: theme.text }}>Încarcă seturile tale existente din alte aplicații.</p>
            </div>
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleCsvImport}
              disabled={csvImporting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all"
              style={{
                background: csvImporting ? theme.surface2 : `${theme.accent2}15`,
                color: csvImporting ? theme.text3 : theme.accent2,
                border: `1px solid ${theme.accent2}30`,
              }}>
              {csvImporting
                ? <><Loader2 size={14} className="animate-spin" />Importare...</>
                : <><Upload size={14} />Alege Fișier</>}
            </motion.button>
          </div>
          <AnimatePresence>
            {csvError && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                className="mt-4 flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-bold"
                style={{ background: `${theme.danger}15`, border: `1px solid ${theme.danger}30`, color: theme.danger }}>
                <AlertCircle size={14} />{csvError}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Review all due banner */}
        {totalDue > 0 && (
          <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="mb-10 p-5 rounded-[28px] flex flex-col sm:flex-row sm:items-center justify-between gap-5"
            style={{
              background: `linear-gradient(135deg, ${theme.warning}22, ${theme.accent}12)`,
              border: `1px solid ${theme.warning}40`,
              boxShadow: `0 12px 32px ${theme.warning}12`,
            }}>
            <div className="flex items-center gap-4">
              <motion.div
                animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }}
                transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
                className="w-14 h-14 rounded-[20px] flex items-center justify-center text-2xl flex-shrink-0"
                style={{ background: `${theme.warning}25`, border: `1px solid ${theme.warning}40` }}>
                ⚡
              </motion.div>
              <div>
                <p className="font-black text-lg leading-tight" style={{ color: theme.text }}>
                  {totalDue} {totalDue === 1 ? 'card' : 'carduri'} restante
                </p>
                <p className="text-xs font-bold uppercase tracking-wider opacity-60 mt-1" style={{ color: theme.text }}>
                  Timp estimat: ~{Math.ceil(totalDue * 0.5)} minute
                </p>
              </div>
            </div>
            <Link to="/flashcards/session/all"
              className="flex items-center gap-2 px-8 py-3.5 rounded-2xl font-black text-white text-sm shadow-xl transition-all hover:scale-[1.03] active:scale-[0.98]"
              style={{ background: `linear-gradient(135deg, ${theme.warning}, ${theme.accent})`, boxShadow: `0 8px 20px ${theme.warning}40` }}>
              <Play size={16} fill="white" className="animate-pulse" />Recapitulează Tot
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
                  whileHover={{ y: -2, transition: { duration: 0.2 } }}
                  className="rounded-3xl p-5 relative overflow-hidden"
                  style={{ 
                    background: theme.surface, 
                    border: `1px solid ${theme.border}`,
                    boxShadow: '0 4px 20px rgba(0,0,0,0.06)'
                  }}
                >
                  {/* Color accent bar */}
                  <div className="absolute inset-y-0 left-0 w-1.5"
                    style={{ background: deck.colors.badge }} />

                  <div className="flex items-center gap-5 ml-2">
                    {/* Emoji + title */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3.5 mb-2">
                        <div className="text-3xl filter drop-shadow-sm">{deck.quiz.emoji}</div>
                        <div className="min-w-0">
                          <h3 className="font-black text-base leading-tight truncate" style={{ color: theme.text }}>
                            {deck.quiz.title}
                          </h3>
                          <p className="text-[10px] font-black uppercase tracking-wider opacity-50 mt-0.5" style={{ color: theme.text }}>
                            {deck.quiz.category} · {deck.total} carduri
                          </p>
                        </div>
                      </div>

                      {/* Mini progress bar */}
                      <div className="flex items-center gap-3 mt-3">
                        <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: theme.surface2 }}>
                          <motion.div
                            className="h-full rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${deck.masteryPct}%` }}
                            transition={{ duration: 1, ease: 'easeOut', delay: 0.3 + i * 0.05 }}
                            style={{ background: deck.colors.badge }}
                          />
                        </div>

                        {/* Stats chips */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {deck.due > 0 && (
                            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg"
                              style={{ background: `${theme.warning}20`, color: theme.warning }}>
                              {deck.due} restante
                            </span>
                          )}
                          {deck.seen === 0 && (
                            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg"
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
                    <div className="flex flex-col gap-2">
                      <Link to={`/flashcards/session/${deck.quiz.id}`}
                        className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider text-white shadow-lg transition-all hover:scale-[1.05] active:scale-[0.95]"
                        style={{
                          background: deck.colors.badge,
                          boxShadow: `0 8px 20px ${deck.colors.badge}40`,
                          minWidth: 140,
                        }}>
                        <Play size={12} fill="white" />
                        {deck.due > 0 ? 'Recapitulează' : 'Studiază'}
                      </Link>
                      <Link to={`/flashcards/session/${deck.quiz.id}?mode=all`}
                        className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all hover:bg-white/10 active:scale-[0.98]"
                        style={{ background: theme.surface2, color: theme.text2, border: `1px solid ${theme.border2}` }}>
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
