import { motion, AnimatePresence } from 'framer-motion';
import { useState, useRef, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { Play, Clock, ChevronLeft, Trophy, RotateCcw, Layers, Download, Pencil, Copy, Search, GraduationCap, Archive, ArchiveRestore, Timer, CreditCard, FileText, Bot, SendHorizonal, Loader2, X, BookOpen } from 'lucide-react';
import { useQuizStore } from '../store/quizStore';
import { useTheme } from '../theme/ThemeContext';
import QuizImage from '../components/QuizImage';
import { useAIStore } from '../store/aiStore';
import { useStatsStore } from '../store/statsStore';
import { groqStream } from '../lib/groq';
import type { QuizImportData } from '../types';
import { HERO_COLOR_MAP } from '../theme/colorMaps';
import { type Theme } from '../theme/themes';

const diffColor = (t: Theme) => ({ easy: t.success, medium: '#FF9F0A', hard: '#FF453A' });
const diffLabel = { easy: 'Ușor', medium: 'Mediu', hard: 'Dificil' };

/**
 * Normalize Romanian diacritics that lie outside Windows-1252 so jsPDF's
 * built-in Helvetica font renders them without "?" glyphs.
 * â (U+00E2) and î (U+00EE) are in Latin-1 and render fine.
 */
function fixPdfText(s: string): string {
  return s
    .replace(/ă/g, 'a').replace(/Ă/g, 'A')
    .replace(/ș/g, 's').replace(/Ș/g, 'S')
    .replace(/ş/g, 's').replace(/Ş/g, 'S')  // cedilla variant
    .replace(/ț/g, 't').replace(/Ț/g, 'T')
    .replace(/ţ/g, 't').replace(/Ţ/g, 'T'); // cedilla variant
}

export default function QuizDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { quizzes, getSessionsForQuiz, getBestScore, duplicateQuiz, toggleArchive } = useQuizStore();
  const theme = useTheme();
  const { questionStats } = useStatsStore();
  const quiz = quizzes.find((q) => q.id === id);
  const [qSearch, setQSearch] = useState('');
  const { hasKey } = useAIStore();
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatAbortRef = useRef<AbortController | null>(null);

  // Cancel any in-flight stream on unmount
  useEffect(() => () => { chatAbortRef.current?.abort(); }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const sendChat = async (overrideText?: string) => {
    const text = (overrideText ?? chatInput).trim();
    if (!text || chatLoading) return;
    setChatInput('');
    const userMsg = { role: 'user' as const, content: text };
    setChatMessages((m) => [...m, userMsg]);
    setChatLoading(true);

    const systemPrompt = `Ești un asistent de studiu medical. Ajuți un student să înțeleagă grila "${quiz!.title}" (${quiz!.category}).

Întrebările din grilă:
${quiz!.questions.slice(0, 15).map((q, i) => {
  const correct = q.options.filter(o => o.isCorrect).map(o => o.text).join(' / ');
  return `${i + 1}. ${q.text}\n   ✓ ${correct}${q.explanation ? `\n   💡 ${q.explanation}` : ''}`;
}).join('\n\n')}

Comportament:
- Răspunde concis și clar în română
- Explică conceptele medicale cu exemple practice când e util
- Dacă ești întrebat despre o întrebare specifică, explică conceptul medical din spatele ei
- Nu vorbi despre structura grilei sau formatul tehnic`;

    const history = [...chatMessages, userMsg].map((m) => ({ role: m.role, content: m.content }));
    const messages = [{ role: 'system' as const, content: systemPrompt }, ...history];

    let assistantMsg = '';
    setChatMessages((m) => [...m, { role: 'assistant', content: '' }]);

    const controller = new AbortController();
    chatAbortRef.current = controller;

    try {
      await groqStream(messages, (chunk) => {
        assistantMsg += chunk;
        setChatMessages((m) => {
          const updated = [...m];
          updated[updated.length - 1] = { role: 'assistant', content: assistantMsg };
          return updated;
        });
      }, 0.7, controller.signal);
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'AbortError') return; // user navigated away — no error shown
      const errorMessage = e instanceof Error ? e.message : 'Eroare necunoscută.';
      setChatMessages((m) => {
        const updated = [...m];
        updated[updated.length - 1] = { role: 'assistant', content: `Eroare: ${errorMessage}` };
        return updated;
      });
    } finally {
      setChatLoading(false);
    }
  };

  if (!quiz) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="mb-4" style={{ color: theme.text2 }}>Grila nu a fost găsită.</p>
          <Link to="/quizzes" style={{ color: theme.accent }}>Înapoi</Link>
        </div>
      </div>
    );
  }

  const sessions = getSessionsForQuiz(quiz.id);
  const bestScore = getBestScore(quiz.id);
  const colors = HERO_COLOR_MAP[quiz.color] ?? HERO_COLOR_MAP.blue;
  const estimatedTime = quiz.questions.length * 30;

  const handleDuplicate = () => {
    const newId = duplicateQuiz(quiz.id);
    if (newId) navigate(`/quiz/${newId}`);
  };
  const multipleCount = quiz.questions.filter((q) => q.multipleCorrect).length;
  const formatTime = (s: number) => s < 60 ? `~${s}s` : `~${Math.ceil(s / 60)} min`;

  const exportPDF = async () => {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const pageW = 210;
    const margin = 18;
    const contentW = pageW - margin * 2;
    let y = margin;

    const addLine = (text: string, size: number, bold = false, color: [number, number, number] = [30, 30, 30]) => {
      doc.setFontSize(size);
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.setTextColor(...color);
      const lines = doc.splitTextToSize(fixPdfText(text), contentW);
      lines.forEach((line: string) => {
        if (y > 277) { doc.addPage(); y = margin; }
        doc.text(line, margin, y);
        y += size * 0.45;
      });
      y += 1;
    };

    // Title
    addLine(quiz.emoji + ' ' + quiz.title, 18, true, [10, 100, 255]);
    addLine(quiz.description, 11, false, [80, 80, 80]);
    addLine(`Categorie: ${quiz.category} · ${quiz.questions.length} întrebări`, 10, false, [120, 120, 120]);
    y += 4;

    for (let qi = 0; qi < quiz.questions.length; qi++) {
      const q = quiz.questions[qi];
      if (y > 260) { doc.addPage(); y = margin; }
      addLine(`${qi + 1}. ${q.text}`, 12, true);

      // Add image if present
      if (q.imageUrl) {
        try {
          const imgFormat = q.imageUrl.includes('image/png') ? 'PNG' : 'JPEG';
          const imgProps = doc.getImageProperties(q.imageUrl);
          const maxW = contentW * 0.5;
          const ratio = imgProps.height / imgProps.width;
          const imgH = Math.min(maxW * ratio, 50);
          const imgW = imgH / ratio;
          if (y + imgH > 277) { doc.addPage(); y = margin; }
          doc.addImage(q.imageUrl, imgFormat, margin, y, imgW, imgH);
          y += imgH + 3;
        } catch (err) {
          console.error('[QuizDetail] PDF image error:', err);
        }
      }

      q.options.forEach((opt, oi) => {
        const letter = String.fromCharCode(65 + oi);
        const color: [number, number, number] = opt.isCorrect ? [30, 160, 80] : [60, 60, 60];
        addLine(`   ${letter}. ${opt.text}${opt.isCorrect ? ' ✓' : ''}`, 10, opt.isCorrect, color);
      });
      if (q.explanation) {
        addLine(`   💡 ${q.explanation}`, 9, false, [100, 100, 150]);
      }
      y += 3;
    }

    doc.save(`${quiz.title.replace(/\s+/g, '-').toLowerCase()}.pdf`);
  };

  const exportQuiz = () => {
    const data: QuizImportData = {
      title: quiz.title,
      description: quiz.description,
      emoji: quiz.emoji,
      category: quiz.category,
      color: quiz.color,
      shuffleQuestions: quiz.shuffleQuestions,
      shuffleAnswers: quiz.shuffleAnswers,
      questions: quiz.questions.map((q) => ({
        text: q.text,
        multipleCorrect: q.multipleCorrect,
        explanation: q.explanation,
        difficulty: q.difficulty,
        options: q.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect })),
      })),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${quiz.title.replace(/\s+/g, '-').toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportAnki = async () => {
    const q = quizzes.find(q => q.id === id);
    if (!q) return;

    const rows = q.questions.flatMap(question => {
      const correct = question.options.find(o => o.isCorrect);
      const wrongs = question.options.filter(o => !o.isCorrect).map(o => o.text).join(' | ');
      if (!correct) return [];
      const front = question.text.replace(/"/g, '""');
      const back = [
        `Răspuns corect: ${correct.text}`,
        question.explanation ? `Explicație: ${question.explanation}` : '',
        `Variante greșite: ${wrongs}`,
      ].filter(Boolean).join('<br>').replace(/"/g, '""');
      return [`"${front}","${back}"`];
    });

    const csv = ['#separator:Semicolon', '#html:true', ...rows].join('\n');

    if (window.electronAPI?.saveCsvFile) {
      await window.electronAPI.saveCsvFile({
        defaultPath: `${q.title}-anki.csv`,
        content: csv,
      });
    } else {
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `${q.title}-anki.csv`; a.click();
      URL.revokeObjectURL(url);
    }
  };

  const wrongCount = Object.entries(questionStats)
    .filter(([k, s]) => k.startsWith(id + ':') && s.timesWrong > 0).length;

  return (
    <>
    <div className="h-full overflow-y-auto px-8 py-8">
      <div className="max-w-2xl mx-auto">

        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <Link to="/quizzes"
            className="flex items-center gap-1.5 text-sm hover:opacity-80 transition-all"
            style={{ color: theme.text3 }}>
            <ChevronLeft size={15} />Toate grilele
          </Link>
        </motion.div>

        {/* Hero card */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="rounded-[32px] p-8 mb-8 relative overflow-hidden"
          style={{ 
            background: colors.gradient, 
            boxShadow: `0 24px 60px ${colors.glow}`,
          }}>
          {/* Subtle patterns/orbs */}
          <div className="absolute top-0 right-0 w-64 h-64 rounded-full blur-[80px] pointer-events-none"
            style={{ background: 'rgba(255,255,255,0.15)' }} />
          
          <div className="relative z-10">
            <div className="text-6xl mb-6 drop-shadow-xl">{quiz.emoji}</div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mb-4"
              style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', backdropFilter: 'blur(10px)' }}>
              <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              {quiz.category}
            </div>
            <h1 className="text-4xl font-black text-white mb-3 tracking-tight leading-tight">{quiz.title}</h1>
            <p className="text-white/80 mb-8 max-w-lg font-medium leading-relaxed">{quiz.description}</p>

            <div className="flex items-center gap-6 flex-wrap">
              <div className="flex items-center gap-2 text-white/90 text-xs font-bold uppercase tracking-wider">
                <Clock size={16} className="opacity-70" />{formatTime(estimatedTime)}
              </div>
              <div className="flex items-center gap-2 text-white/90 text-xs font-bold uppercase tracking-wider">
                <BookOpen size={16} className="opacity-70" />{quiz.questions.length} întrebări
              </div>
              {multipleCount > 0 && (
                <div className="flex items-center gap-2 text-white/90 text-xs font-bold uppercase tracking-wider">
                  <Layers size={16} className="opacity-70" />{multipleCount} multi
                </div>
              )}
              {bestScore !== null && (
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider px-3 py-1.5 rounded-xl" 
                  style={{ background: 'rgba(255,214,10,0.25)', color: '#FFD60A', border: '1px solid rgba(255,214,10,0.3)' }}>
                  <Trophy size={14} fill="#FFD60A" />Record: {bestScore}%
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Primary Actions Grid */}
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }} className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <Link to={`/play/${quiz.id}`}
            className="flex items-center justify-center gap-3 py-5 rounded-2xl font-black text-white text-lg shadow-2xl transition-all hover:scale-[1.03] active:scale-[0.97]"
            style={{ background: colors.gradient, boxShadow: `0 12px 32px ${colors.glow}` }}>
            <Play size={22} fill="white" />
            {sessions.length > 0 ? 'Reia Studiu' : 'Începe Grila'}
          </Link>
          <Link to={`/play/${quiz.id}`} state={{ mode: 'exam' }}
            className="flex items-center justify-center gap-3 py-5 rounded-2xl font-black text-lg transition-all hover:scale-[1.03] active:scale-[0.97] shadow-lg"
            style={{ background: theme.surface, border: `1px solid ${theme.border}`, color: theme.text }}>
            <GraduationCap size={22} />
            Simulare Examen
          </Link>
        </motion.div>

        {/* Secondary Study Modes */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
          className="flex gap-3 mb-8 overflow-x-auto pb-2 scrollbar-none">
          <Link to={`/play/${quiz.id}`} state={{ mode: 'timed' }}
            className="flex-1 min-w-[140px] flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all hover:bg-white/5 active:scale-[0.98]"
            style={{ background: theme.surface, border: `1px solid ${theme.border}`, color: theme.text2 }}>
            <Timer size={16} />Cronometrat
          </Link>
          <Link to={`/flashcards/session/${quiz.id}?mode=all`}
            className="flex-1 min-w-[140px] flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all hover:bg-white/5 active:scale-[0.98]"
            style={{ background: theme.surface, border: `1px solid ${theme.border}`, color: theme.text2 }}>
            <CreditCard size={16} />Flashcarduri
          </Link>
          <button
            onClick={() => {
              const wrongQIds = Object.entries(questionStats)
                .filter(([k, s]) => k.startsWith(id + ':') && s.timesWrong > 0)
                .map(([k]) => k.split(':')[1]);
              if (wrongQIds.length === 0) return;
              navigate(`/play/${id}`, { state: { wrongQuestionsOnly: wrongQIds } });
            }}
            disabled={wrongCount === 0}
            className="flex-1 min-w-[140px] flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all hover:bg-red-500/5 active:scale-[0.98] disabled:opacity-30"
            style={{ background: theme.surface, border: `1px solid ${wrongCount > 0 ? theme.danger + '40' : theme.border}`, color: wrongCount > 0 ? theme.danger : theme.text3 }}>
            <RotateCcw size={16} />Greșeli ({wrongCount})
          </button>
        </motion.div>

        {/* AI Buddy Bar */}
        {hasKey() ? (
          <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}
            onClick={() => { setShowChat(true); window.dispatchEvent(new CustomEvent('studyx:chat', { detail: { open: true } })); }}
            className="w-full flex items-center justify-between gap-4 p-4 rounded-2xl mb-8 group transition-all"
            style={{ background: `linear-gradient(135deg, ${theme.accent}12, ${theme.accent2}08)`, border: `1px solid ${theme.accent}30` }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg transition-transform group-hover:scale-110"
                style={{ background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})` }}>
                <Bot size={20} className="text-white" />
              </div>
              <div className="text-left">
                <p className="text-sm font-black" style={{ color: theme.text }}>Asistent AI Personal</p>
                <p className="text-[10px] font-bold uppercase tracking-wider opacity-50" style={{ color: theme.text }}>Discută despre conceptele din această grilă</p>
              </div>
            </div>
            <div className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all group-hover:translate-x-1"
              style={{ background: `${theme.accent}20`, color: theme.accent }}>
              Deschide Chat →
            </div>
          </motion.button>
        ) : (
          <div className="w-full flex items-center gap-3 p-4 rounded-2xl mb-8"
            style={{ background: theme.surface2, border: `1px solid ${theme.border}` }}>
            <Bot size={18} style={{ color: theme.text3 }} />
            <span className="text-xs font-medium flex-1" style={{ color: theme.text3 }}>Activează AI în Setări pentru tutorat personalizat.</span>
            <button onClick={() => window.dispatchEvent(new CustomEvent('studyx:open-ai-settings'))}
              className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg transition-all hover:bg-white/5"
              style={{ background: theme.surface, border: `1px solid ${theme.border}`, color: theme.accent }}>
              Configurare
            </button>
          </div>
        )}

        {/* Utility Actions (Grid) */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-8">
          {[
            { label: 'Edit', icon: Pencil, action: () => navigate(`/create?edit=${quiz.id}`), color: theme.accent },
            { label: 'Copy', icon: Copy, action: handleDuplicate, color: theme.text2 },
            { label: 'JSON', icon: Download, action: exportQuiz, color: theme.text2 },
            { label: 'PDF', icon: FileText, action: exportPDF, color: theme.text2 },
            { label: 'Anki', icon: Download, action: exportAnki, color: theme.text2 },
            { label: quiz.archived ? 'Restore' : 'Archive', icon: quiz.archived ? ArchiveRestore : Archive, action: () => toggleArchive(quiz.id), color: quiz.archived ? theme.warning : theme.text3 },
          ].map((btn) => (
            <button key={btn.label} onClick={btn.action}
              className="flex flex-col items-center gap-1.5 py-3 rounded-2xl transition-all hover:scale-[1.05] active:scale-[0.95]"
              style={{ background: theme.surface, border: `1px solid ${theme.border}` }}>
              <btn.icon size={16} style={{ color: btn.color }} />
              <span className="text-[10px] font-black uppercase tracking-tighter opacity-60" style={{ color: theme.text }}>{btn.label}</span>
            </button>
          ))}
        </div>

        {/* Questions preview */}
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-3xl p-6 mb-8"
          style={{ background: theme.surface, border: `1px solid ${theme.border}`, boxShadow: '0 4px 20px rgba(0,0,0,0.04)' }}>
          <div className="flex items-center justify-between mb-6 gap-4">
            <div>
              <h2 className="text-base font-black tracking-tight" style={{ color: theme.text }}>Conținut Grilă</h2>
              <p className="text-[10px] font-bold uppercase tracking-wider opacity-50" style={{ color: theme.text }}>{quiz.questions.length} întrebări totale</p>
            </div>
            {quiz.questions.length > 5 && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-2xl flex-1 max-w-[220px] transition-all focus-within:ring-2"
                style={{ 
                  background: theme.surface2, 
                  border: `1px solid ${theme.border2}`, 
                  ['--ring-color' as string]: `${theme.accent}33` 
                } as React.CSSProperties}>
                <Search size={14} style={{ color: theme.text3 }} />
                <input
                  type="text" placeholder="Caută în întrebări..." value={qSearch}
                  onChange={e => setQSearch(e.target.value)}
                  className="flex-1 text-xs font-medium bg-transparent"
                  style={{ color: theme.text, outline: 'none', border: 'none' }}
                />
              </div>
            )}
          </div>
          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {quiz.questions
              .map((q, actualIdx) => ({ q, actualIdx }))
              .filter(({ q }) => !qSearch || q.text.toLowerCase().includes(qSearch.toLowerCase()))
              .map(({ q, actualIdx }) => (
              <div key={q.id} className="p-4 rounded-2xl transition-all hover:bg-white/5 border border-transparent hover:border-white/10"
                style={{ background: theme.surface2 }}>
                <div className="flex items-start gap-3">
                  <span className="text-[10px] font-black opacity-30 mt-1" style={{ color: theme.text }}>
                    {String(actualIdx + 1).padStart(2, '0')}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium leading-relaxed" style={{ color: theme.text2 }}>{q.text}</p>
                    {q.imageUrl && (
                      <div className="mt-3 rounded-xl overflow-hidden shadow-md">
                        <QuizImage src={q.imageUrl} maxHeight={120} />
                      </div>
                    )}
                    <div className="flex items-center gap-2 mt-3">
                      {q.multipleCorrect && (
                        <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg shadow-sm" 
                          style={{ background: `linear-gradient(135deg, ${theme.accent2}, ${theme.accent})`, color: '#fff' }}>Multi</span>
                      )}
                      {q.difficulty && (
                        <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg border shadow-sm"
                          style={{ background: `${diffColor(theme)[q.difficulty]}15`, color: diffColor(theme)[q.difficulty], borderColor: `${diffColor(theme)[q.difficulty]}30` }}>
                          {diffLabel[q.difficulty as keyof typeof diffLabel]}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>

    {/* AI Chat Drawer */}
    <AnimatePresence>
      {showChat && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100]" style={{ background: 'rgba(0,0,0,0.4)' }}
            onClick={() => { setShowChat(false); window.dispatchEvent(new CustomEvent('studyx:chat', { detail: { open: false } })); }} />
          <motion.div
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 350, damping: 32 }}
            className="fixed right-0 top-0 bottom-0 z-[101] flex flex-col"
            style={{ width: 380, background: theme.modalBg, borderLeft: `1px solid ${theme.border}` }}>
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 flex-shrink-0" style={{ borderBottom: `1px solid ${theme.border}` }}>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})` }}>
                <Bot size={15} className="text-white" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold" style={{ color: theme.text }}>Chat AI</p>
                <p className="text-xs truncate" style={{ color: theme.text3 }}>{quiz!.title}</p>
              </div>
              <motion.button whileHover={{ rotate: 90 }} whileTap={{ scale: 0.88 }}
                onClick={() => { setShowChat(false); window.dispatchEvent(new CustomEvent('studyx:chat', { detail: { open: false } })); }} 
                style={{ color: theme.text3, cursor: 'pointer' }}>
                <X size={16} />
              </motion.button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {chatMessages.length === 0 && (
                <div className="text-center py-12">
                  <div className="text-4xl mb-3">🤖</div>
                  <p className="text-sm font-medium" style={{ color: theme.text }}>Întreabă-mă orice</p>
                  <p className="text-xs mt-1" style={{ color: theme.text3 }}>despre această grilă de întrebări</p>
                  <div className="mt-4 space-y-2">
                    {['Explică conceptele cheie', 'Care sunt capcanele frecvente?', 'Cum memorez mai ușor?'].map((s) => (
                      <button key={s} onClick={() => sendChat(s)}
                        className="w-full text-left text-xs px-3 py-2 rounded-xl transition-all hover:opacity-80"
                        style={{ background: theme.surface2, color: theme.text2 }}>
                        {s} →
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {chatMessages.map((msg, i) => (
                <motion.div key={i}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className="max-w-[88%] px-3.5 py-2.5 text-sm leading-relaxed"
                    style={{
                      background: msg.role === 'user'
                        ? `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})`
                        : theme.surface2,
                      color: msg.role === 'user' ? '#fff' : theme.text,
                      borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                    }}>
                    {msg.content
                      ? msg.role === 'assistant'
                        ? <span dangerouslySetInnerHTML={{ __html:
                            msg.content
                              .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                              .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                              .replace(/\*(.+?)\*/g, '<em>$1</em>')
                              .replace(/\n/g, '<br/>')
                          }} />
                        : msg.content
                      : <span style={{ opacity: 0.4 }}>…</span>}
                  </div>
                </motion.div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div className="px-4 py-3 flex-shrink-0" style={{ borderTop: `1px solid ${theme.border}` }}>
              <div className="flex gap-2">
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); } }}
                  placeholder="Pune o întrebare..."
                  className="flex-1 text-sm px-3 py-2.5 rounded-xl"
                  style={{ background: theme.surface2, border: `1px solid ${theme.border}`, color: theme.text, outline: 'none' }}
                />
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => sendChat()}
                  disabled={!chatInput.trim() || chatLoading}
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{
                    background: chatInput.trim() && !chatLoading
                      ? `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})`
                      : theme.surface2,
                    color: chatInput.trim() && !chatLoading ? '#fff' : theme.text3,
                  }}>
                  {chatLoading ? <Loader2 size={14} className="animate-spin" /> : <SendHorizonal size={14} />}
                </motion.button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
    </>
  );
}
