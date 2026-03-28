import { motion, AnimatePresence } from 'framer-motion';
import { useState, useRef, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { Play, Clock, ChevronLeft, Trophy, Star, RotateCcw, Shuffle, Layers, Download, Pencil, Copy, Search, GraduationCap, Archive, ArchiveRestore, Timer, CreditCard, FileText, Bot, SendHorizonal, Loader2, X } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useQuizStore } from '../store/quizStore';
import { useTheme } from '../theme/ThemeContext';
import QuizImage from '../components/QuizImage';
import { useAIStore } from '../store/aiStore';
import { useStatsStore } from '../store/statsStore';
import { groqStream } from '../lib/groq';
import type { QuizImportData } from '../types';
import { HERO_COLOR_MAP } from '../theme/colorMaps';

const diffColor = { easy: '#30D158', medium: '#FF9F0A', hard: '#FF453A' };
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
    } catch (e: any) {
      if (e.name === 'AbortError') return; // user navigated away — no error shown
      setChatMessages((m) => {
        const updated = [...m];
        updated[updated.length - 1] = { role: 'assistant', content: `Eroare: ${e.message}` };
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
        } catch {}
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
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="rounded-3xl p-8 mb-6"
          style={{ background: colors.gradient, boxShadow: `0 20px 60px ${colors.glow}` }}>
          <div className="text-5xl mb-4">{quiz.emoji}</div>
          <div className="inline-block px-2.5 py-1 rounded-full text-xs font-medium mb-3"
            style={{ background: 'rgba(255,255,255,0.2)', color: 'white' }}>
            {quiz.category}
          </div>
          <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">{quiz.title}</h1>
          <p className="text-white/70 mb-5">{quiz.description}</p>

          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-1.5 text-white/70 text-sm">
              <Clock size={14} />{formatTime(estimatedTime)}
            </div>
            <div className="flex items-center gap-1.5 text-white/70 text-sm">
              <Trophy size={14} />{quiz.questions.length} {quiz.questions.length === 1 ? 'întrebare' : 'întrebări'}
            </div>
            {multipleCount > 0 && (
              <div className="flex items-center gap-1.5 text-white/70 text-sm">
                <Layers size={14} />{multipleCount} multi-select
              </div>
            )}
            {quiz.shuffleQuestions && (
              <div className="flex items-center gap-1.5 text-white/70 text-sm">
                <Shuffle size={14} />Amestecat
              </div>
            )}
            {bestScore !== null && (
              <div className="flex items-center gap-1.5 text-sm font-medium" style={{ color: '#FFD60A' }}>
                <Star size={14} fill="#FFD60A" />Best: {bestScore}%
              </div>
            )}
          </div>
        </motion.div>

        {/* Questions preview */}
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl p-5 mb-5"
          style={{ background: theme.surface, border: `1px solid ${theme.border}` }}>
          <div className="flex items-center justify-between mb-3 gap-3">
            <h2 className="text-sm font-semibold flex-shrink-0" style={{ color: theme.text2 }}>
              Întrebări ({quiz.questions.length})
            </h2>
            {quiz.questions.length > 5 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl flex-1 max-w-[200px]"
                style={{ background: theme.surface2, border: `1px solid ${theme.border}` }}>
                <Search size={12} style={{ color: theme.text3, flexShrink: 0 }} />
                <input
                  type="text"
                  placeholder="Caută..."
                  value={qSearch}
                  onChange={e => setQSearch(e.target.value)}
                  className="flex-1 text-xs bg-transparent"
                  style={{ color: theme.text, outline: 'none', border: 'none', minWidth: 0 }}
                />
              </div>
            )}
          </div>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {quiz.questions
              .map((q, actualIdx) => ({ q, actualIdx }))
              .filter(({ q }) => !qSearch || q.text.toLowerCase().includes(qSearch.toLowerCase()))
              .map(({ q, actualIdx }) => (
              <div key={q.id} className="flex items-start gap-3">
                <span className="text-xs font-mono mt-0.5 flex-shrink-0" style={{ color: theme.text3 }}>
                  {String(actualIdx + 1).padStart(2, '0')}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm" style={{ color: theme.text2 }}>{q.text}</p>
                  {q.imageUrl && (
                    <div className="mt-1.5">
                      <QuizImage src={q.imageUrl} maxHeight={64} />
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {q.multipleCorrect && (
                    <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: `${theme.accent2}18`, color: theme.accent2 }}>M</span>
                  )}
                  {q.difficulty && (
                    <span className="text-xs px-1.5 py-0.5 rounded"
                      style={{ background: `${diffColor[q.difficulty]}15`, color: diffColor[q.difficulty] }}>
                      {diffLabel[q.difficulty]}
                    </span>
                  )}
                </div>
              </div>
            ))}
            {qSearch && quiz.questions.filter(q => q.text.toLowerCase().includes(qSearch.toLowerCase())).length === 0 && (
              <p className="text-sm text-center py-3" style={{ color: theme.text3 }}>Niciun rezultat</p>
            )}
          </div>
        </motion.div>

        {/* Score trend chart */}
        {sessions.length >= 2 && (
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="rounded-2xl p-5 mb-5"
            style={{ background: theme.surface, border: `1px solid ${theme.border}` }}>
            <h2 className="text-sm font-semibold mb-4" style={{ color: theme.text2 }}>
              Progres ({sessions.length} sesiuni)
            </h2>
            <ResponsiveContainer width="100%" height={120}>
              <LineChart
                data={[...sessions].reverse().slice(0, 10).map((s, i) => ({
                  nr: `#${i + 1}`,
                  scor: Math.round((s.score / s.total) * 100),
                }))}
                margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={theme.border} />
                <XAxis dataKey="nr" tick={{ fill: theme.text3, fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fill: theme.text3, fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 10, fontSize: 12 }}
                  labelStyle={{ color: theme.text }}
                  formatter={(v: any) => [`${v}%`, 'Scor']}
                />
                <Line type="monotone" dataKey="scor" stroke={theme.accent}
                  strokeWidth={2} dot={{ fill: theme.accent, r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </motion.div>
        )}

        {/* Actions */}
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }} className="space-y-3">
          {/* Primary: Play */}
          <div className="grid grid-cols-2 gap-2">
            <Link to={`/play/${quiz.id}`}
              className="flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-white transition-all hover:opacity-90"
              style={{ background: colors.gradient, boxShadow: `0 8px 30px ${colors.glow}` }}>
              <Play size={18} fill="white" />
              {sessions.length > 0 ? 'Din nou' : 'Începe'}
            </Link>
            <Link to={`/play/${quiz.id}`} state={{ mode: 'exam' }}
              className="flex items-center justify-center gap-2 py-4 rounded-2xl font-bold transition-all hover:opacity-80"
              style={{ background: theme.surface, border: `1px solid ${theme.border2}`, color: theme.text2 }}>
              <GraduationCap size={16} />
              Mod Examen
            </Link>
          </div>
          {/* Study modes row */}
          <div className="grid grid-cols-2 gap-2">
            <Link to={`/play/${quiz.id}`} state={{ mode: 'timed' }}
              className="flex items-center justify-center gap-1.5 py-3 rounded-xl font-medium text-sm transition-all hover:opacity-80"
              style={{ background: theme.surface, border: `1px solid ${theme.border}`, color: theme.text2 }}>
              <Timer size={14} />Cronometrat
            </Link>
            <Link to={`/flashcards/session/${quiz.id}?mode=all`}
              className="flex items-center justify-center gap-1.5 py-3 rounded-xl font-medium text-sm transition-all hover:opacity-80"
              style={{ background: theme.surface, border: `1px solid ${theme.border}`, color: theme.text2 }}>
              <CreditCard size={14} />Flashcarduri
            </Link>
          </div>
          {/* Secondary actions */}
          <div className="grid grid-cols-6 gap-2">
            <Link to={`/create?edit=${quiz.id}`}
              className="flex items-center justify-center gap-1.5 py-3 rounded-xl font-medium text-sm transition-all hover:opacity-80"
              style={{ background: theme.surface, border: `1px solid ${theme.border}`, color: theme.text2 }}>
              <Pencil size={14} />Editează
            </Link>
            <button onClick={handleDuplicate}
              className="flex items-center justify-center gap-1.5 py-3 rounded-xl font-medium text-sm transition-all hover:opacity-80"
              style={{ background: theme.surface, border: `1px solid ${theme.border}`, color: theme.text2 }}>
              <Copy size={14} />Duplică
            </button>
            <button onClick={exportQuiz}
              className="flex items-center justify-center gap-1.5 py-3 rounded-xl font-medium text-sm transition-all hover:opacity-80"
              style={{ background: theme.surface, border: `1px solid ${theme.border}`, color: theme.text2 }}>
              <Download size={14} />JSON
            </button>
            <button onClick={exportPDF}
              className="flex items-center justify-center gap-1.5 py-3 rounded-xl font-medium text-sm transition-all hover:opacity-80"
              style={{ background: theme.surface, border: `1px solid ${theme.border}`, color: theme.text2 }}>
              <FileText size={14} />PDF
            </button>
            <button onClick={exportAnki}
              className="flex items-center justify-center gap-1.5 py-3 rounded-xl font-medium text-sm transition-all hover:opacity-80"
              style={{ background: theme.surface, border: `1px solid ${theme.border}`, color: theme.text2 }}>
              <Download size={14} />Anki
            </button>
            <button onClick={() => toggleArchive(quiz.id)}
              className="flex items-center justify-center gap-1.5 py-3 rounded-xl font-medium text-sm transition-all hover:opacity-80"
              style={{ background: quiz.archived ? `${theme.warning}15` : theme.surface, border: `1px solid ${quiz.archived ? theme.warning : theme.border}`, color: quiz.archived ? theme.warning : theme.text2 }}>
              {quiz.archived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
              {quiz.archived ? 'Dezarhivat' : 'Arhivă'}
            </button>
          </div>
          {sessions.length > 0 && (
            <Link to="/review"
              className="flex items-center justify-center gap-2 py-3 rounded-xl font-medium text-sm transition-all hover:opacity-80"
              style={{ background: theme.surface, border: `1px solid ${theme.border}`, color: theme.text3 }}>
              <RotateCcw size={14} />Recapitulare spațiată
            </Link>
          )}

          {/* Wrong questions practice button */}
          <button
            onClick={() => {
              const wrongQIds = Object.entries(questionStats)
                .filter(([k, s]) => k.startsWith(id + ':') && s.timesWrong > 0)
                .map(([k]) => k.split(':')[1]);
              if (wrongQIds.length === 0) return;
              navigate(`/play/${id}`, { state: { wrongQuestionsOnly: wrongQIds } });
            }}
            disabled={wrongCount === 0}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-medium text-sm transition-all hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: wrongCount > 0 ? `${theme.danger}12` : theme.surface,
              border: `1px solid ${wrongCount > 0 ? theme.danger + '40' : theme.border}`,
              color: wrongCount > 0 ? theme.danger : theme.text3,
            }}>
            <RotateCcw size={14} />
            Practică greșelile {wrongCount > 0 ? `(${wrongCount})` : '(0)'}
          </button>

          {/* AI Chat button */}
          {hasKey() ? (
            <button
              onClick={() => { setShowChat(true); window.dispatchEvent(new CustomEvent('studyx:chat', { detail: { open: true } })); }}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-medium text-sm transition-all hover:opacity-90"
              style={{ background: `linear-gradient(135deg, ${theme.accent}20, ${theme.accent2}20)`, border: `1px solid ${theme.accent}40`, color: theme.accent }}>
              <Bot size={15} />Chat AI despre această grilă
            </button>
          ) : (
            <div className="w-full flex items-center gap-2 py-2.5 px-3 rounded-xl text-sm"
              style={{ background: theme.surface2, border: `1px solid ${theme.border}` }}>
              <Bot size={14} style={{ color: theme.text3 }} />
              <span style={{ color: theme.text3 }} className="flex-1">AI disponibil cu o cheie Groq gratuită</span>
              <button onClick={() => window.dispatchEvent(new CustomEvent('studyx:open-ai-settings'))}
                className="text-xs font-semibold px-2 py-1 rounded-lg transition-all hover:opacity-80"
                style={{ background: `${theme.accent}18`, color: theme.accent }}>
                Configurează →
              </button>
            </div>
          )}
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
                onClick={() => { setShowChat(false); window.dispatchEvent(new CustomEvent('studyx:chat', { detail: { open: false } })); }} style={{ color: theme.text3 }}>
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
