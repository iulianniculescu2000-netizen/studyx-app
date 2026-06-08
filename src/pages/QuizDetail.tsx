import { motion } from 'framer-motion';
import { lazy, Suspense, useEffect, useState, type CSSProperties } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Archive,
  ArchiveRestore,
  BookOpen,
  Bot,
  ChevronLeft,
  Clock,
  Copy,
  CreditCard,
  Download,
  FileText,
  GraduationCap,
  Layers,
  Pencil,
  Play,
  RotateCcw,
  Search,
  Timer,
  Trophy,
} from 'lucide-react';
import QuizImage from '../components/QuizImage';
import { useAIStore } from '../store/aiStore';
import { useQuizStore } from '../store/quizStore';
import { useStatsStore } from '../store/statsStore';
import { useUIStore } from '../store/uiStore';
import { HERO_COLOR_MAP } from '../theme/colorMaps';
import { useTheme } from '../theme/ThemeContext';
import { type Theme } from '../theme/themes';
import type { QuizImportData } from '../types';

const QuizDetailChatDrawer = lazy(() => import('../components/quiz-detail/QuizDetailChatDrawer'));

const diffColor = (t: Theme) => ({ easy: t.success, medium: '#FF9F0A', hard: '#FF453A' });
const diffLabel = { easy: 'Ușor', medium: 'Mediu', hard: 'Dificil' };

/**
 * Normalize Romanian diacritics that lie outside Windows-1252 so jsPDF's
 * built-in Helvetica font renders them without fallback glyph issues.
 * a-circumflex and i-circumflex are already safe in Latin-1.
 */
function fixPdfText(text: string): string {
  return text
    .replace(/[\u0103]/g, 'a')
    .replace(/[\u0102]/g, 'A')
    .replace(/[\u0219\u015F]/g, 's')
    .replace(/[\u0218\u015E]/g, 'S')
    .replace(/[\u021B\u0163]/g, 't')
    .replace(/[\u021A\u0162]/g, 'T');
}

export default function QuizDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { quizzes, getSessionsForQuiz, getBestScore, duplicateQuiz, toggleArchive } = useQuizStore();
  const { questionStats } = useStatsStore();
  const { hasKey } = useAIStore();
  const theme = useTheme();

  const [qSearch, setQSearch] = useState('');
  const [showChat, setShowChat] = useState(false);
  const [quickCount, setQuickCount] = useState(20);

  const setChatOpen = useUIStore((state) => state.setChatOpen);
  const lockFloatingUI = useUIStore((state) => state.lockFloatingUI);
  const unlockFloatingUI = useUIStore((state) => state.unlockFloatingUI);

  const quiz = quizzes.find((candidate) => candidate.id === id);

  useEffect(() => {
    if (!showChat) return;

    setChatOpen(false);
    lockFloatingUI('quiz-detail-chat');

    return () => {
      unlockFloatingUI('quiz-detail-chat');
    };
  }, [lockFloatingUI, setChatOpen, showChat, unlockFloatingUI]);

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
  const multipleCount = quiz.questions.filter((question) => question.multipleCorrect).length;
  const wrongCount = Object.entries(questionStats)
    .filter(([key, stats]) => key.startsWith(`${quiz.id}:`) && stats.timesWrong > 0)
    .length;
  const quickPracticeOptions = [10, 20, 40, 60, 100].filter((count) => count <= quiz.questions.length);
  const effectiveQuickCount = Math.min(quickCount, quiz.questions.length);

  const formatTime = (seconds: number) => (seconds < 60 ? `~${seconds}s` : `~${Math.ceil(seconds / 60)} min`);

  const handleDuplicate = () => {
    const newId = duplicateQuiz(quiz.id);
    if (newId) {
      navigate(`/quiz/${newId}`);
    }
  };

  const exportPDF = async () => {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const pageWidth = 210;
    const margin = 18;
    const contentWidth = pageWidth - margin * 2;
    let y = margin;

    const addLine = (
      text: string,
      size: number,
      bold = false,
      color: [number, number, number] = [30, 30, 30],
    ) => {
      doc.setFontSize(size);
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.setTextColor(...color);
      const lines = doc.splitTextToSize(fixPdfText(text), contentWidth);

      lines.forEach((line: string) => {
        if (y > 277) {
          doc.addPage();
          y = margin;
        }

        doc.text(line, margin, y);
        y += size * 0.45;
      });

      y += 1;
    };

    addLine(`${quiz.emoji} ${quiz.title}`, 18, true, [10, 100, 255]);
    addLine(quiz.description, 11, false, [80, 80, 80]);
    addLine(`Categorie: ${quiz.category} · ${quiz.questions.length} întrebări`, 10, false, [120, 120, 120]);
    y += 4;

    quiz.questions.forEach((question, questionIndex) => {
      if (y > 260) {
        doc.addPage();
        y = margin;
      }

      addLine(`${questionIndex + 1}. ${question.text}`, 12, true);

      if (question.imageUrl) {
        try {
          const imageFormat = question.imageUrl.includes('image/png') ? 'PNG' : 'JPEG';
          const imageProps = doc.getImageProperties(question.imageUrl);
          const maxWidth = contentWidth * 0.5;
          const ratio = imageProps.height / imageProps.width;
          const imageHeight = Math.min(maxWidth * ratio, 50);
          const imageWidth = imageHeight / ratio;

          if (y + imageHeight > 277) {
            doc.addPage();
            y = margin;
          }

          doc.addImage(question.imageUrl, imageFormat, margin, y, imageWidth, imageHeight);
          y += imageHeight + 3;
        } catch (error) {
          console.error('[QuizDetail] PDF image error:', error);
        }
      }

      question.options.forEach((option, optionIndex) => {
        const letter = String.fromCharCode(65 + optionIndex);
        const color: [number, number, number] = option.isCorrect ? [30, 160, 80] : [60, 60, 60];
        addLine(`   ${letter}. ${option.text}${option.isCorrect ? ' [corect]' : ''}`, 10, option.isCorrect, color);
      });

      if (question.explanation) {
        addLine(`   Explicație: ${question.explanation}`, 9, false, [100, 100, 150]);
      }

      y += 3;
    });

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
      questions: quiz.questions.map((question) => ({
        text: question.text,
        multipleCorrect: question.multipleCorrect,
        explanation: question.explanation,
        difficulty: question.difficulty,
        options: question.options.map((option) => ({ text: option.text, isCorrect: option.isCorrect })),
      })),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${quiz.title.replace(/\s+/g, '-').toLowerCase()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const exportAnki = async () => {
    const rows = quiz.questions.flatMap((question) => {
      const correct = question.options.find((option) => option.isCorrect);
      if (!correct) return [];

      const wrongs = question.options
        .filter((option) => !option.isCorrect)
        .map((option) => option.text)
        .join(' | ');

      const front = question.text.replace(/"/g, '""');
      const back = [
        `Răspuns corect: ${correct.text}`,
        question.explanation ? `Explicație: ${question.explanation}` : '',
        wrongs ? `Variante greșite: ${wrongs}` : '',
      ]
        .filter(Boolean)
        .join('<br>');

      return [`"${front}";"${back.replace(/"/g, '""')}"`];
    });

    const csv = ['#separator:Semicolon', '#html:true', ...rows].join('\n');

    if (window.electronAPI?.saveCsvFile) {
      await window.electronAPI.saveCsvFile({
        defaultPath: `${quiz.title}-anki.csv`,
        content: csv,
      });
      return;
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${quiz.title}-anki.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const searchWrapperStyle = {
    background: theme.surface2,
    border: `1px solid ${theme.border2}`,
    ['--ring-color' as string]: `${theme.accent}33`,
  } as CSSProperties;

  return (
    <>
      <div className="h-full overflow-y-auto px-8 py-8">
        <div className="max-w-2xl mx-auto">
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
            <Link
              to="/quizzes"
              className="flex items-center gap-1.5 text-sm hover:opacity-80 transition-all"
              style={{ color: theme.text3 }}
            >
              <ChevronLeft size={15} />
              Toate grilele
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-[32px] p-8 mb-8 relative overflow-hidden"
            style={{
              background: colors.gradient,
              boxShadow: `0 24px 60px ${colors.glow}`,
            }}
          >
            <div
              className="absolute top-0 right-0 w-64 h-64 rounded-full blur-[80px] pointer-events-none"
              style={{ background: 'rgba(255,255,255,0.15)' }}
            />

            <div className="relative z-10">
              <div className="text-6xl mb-6 drop-shadow-xl">{quiz.emoji}</div>
              <div
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mb-4"
                style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', backdropFilter: 'blur(10px)' }}
              >
                <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                {quiz.category}
              </div>
              <h1 className="text-4xl font-black text-white mb-3 tracking-tight leading-tight">{quiz.title}</h1>
              <p className="text-white/80 mb-8 max-w-lg font-medium leading-relaxed">{quiz.description}</p>

              <div className="flex items-center gap-6 flex-wrap">
                <div className="flex items-center gap-2 text-white/90 text-xs font-bold uppercase tracking-wider">
                  <Clock size={16} className="opacity-70" />
                  {formatTime(estimatedTime)}
                </div>
                <div className="flex items-center gap-2 text-white/90 text-xs font-bold uppercase tracking-wider">
                  <BookOpen size={16} className="opacity-70" />
                  {quiz.questions.length} întrebări
                </div>
                {multipleCount > 0 && (
                  <div className="flex items-center gap-2 text-white/90 text-xs font-bold uppercase tracking-wider">
                    <Layers size={16} className="opacity-70" />
                    {multipleCount} multi
                  </div>
                )}
                {bestScore !== null && (
                  <div
                    className="flex items-center gap-2 text-xs font-black uppercase tracking-wider px-3 py-1.5 rounded-xl"
                    style={{
                      background: 'rgba(255,214,10,0.25)',
                      color: '#FFD60A',
                      border: '1px solid rgba(255,214,10,0.3)',
                    }}
                  >
                    <Trophy size={14} fill="#FFD60A" />
                    Record: {bestScore}%
                  </div>
                )}
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8"
          >
            <Link
              to={`/play/${quiz.id}`}
              className="flex items-center justify-center gap-3 py-5 rounded-2xl font-black text-white text-lg shadow-2xl transition-all hover:scale-[1.03] active:scale-[0.97]"
              style={{ background: colors.gradient, boxShadow: `0 12px 32px ${colors.glow}` }}
            >
              <Play size={22} fill="white" />
              {sessions.length > 0 ? 'Reia Studiul' : 'Începe Grila'}
            </Link>
            <Link
              to={`/play/${quiz.id}`}
              state={{ mode: 'exam' }}
              className="flex items-center justify-center gap-3 py-5 rounded-2xl font-black text-lg transition-all hover:scale-[1.03] active:scale-[0.97] shadow-lg"
              style={{ background: theme.surface, border: `1px solid ${theme.border}`, color: theme.text }}
            >
              <GraduationCap size={22} />
              Simulare Examen
            </Link>
          </motion.div>

          {quiz.questions.length > 20 && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.16 }}
              className="rounded-3xl p-5 mb-8"
              style={{ background: theme.surface, border: `1px solid ${theme.border}` }}
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-black" style={{ color: theme.text }}>Quick pe bucăți</p>
                  <p className="text-xs mt-1" style={{ color: theme.text3 }}>
                    Alege o sesiune mică acum; restul rămâne pentru următorul bloc.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {quickPracticeOptions.map((count) => (
                    <button
                      key={count}
                      onClick={() => setQuickCount(count)}
                      className="rounded-xl px-3 py-2 text-xs font-black transition-all"
                      style={{
                        background: effectiveQuickCount === count ? `${theme.accent}22` : theme.surface2,
                        border: `1px solid ${effectiveQuickCount === count ? `${theme.accent}55` : theme.border}`,
                        color: effectiveQuickCount === count ? theme.accent : theme.text2,
                      }}
                    >
                      {count}
                    </button>
                  ))}
                  <Link
                    to={`/play/${quiz.id}`}
                    state={{ practiceCount: effectiveQuickCount }}
                    className="flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
                    style={{ background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})` }}
                  >
                    <Play size={14} fill="white" />
                    Pornește {effectiveQuickCount}
                  </Link>
                </div>
              </div>
            </motion.div>
          )}

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="flex gap-3 mb-8 overflow-x-auto pb-2 scrollbar-none"
          >
            <Link
              to={`/play/${quiz.id}`}
              state={{ mode: 'timed' }}
              className="flex-1 min-w-[140px] flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all hover:bg-white/5 active:scale-[0.98]"
              style={{
                background: `linear-gradient(180deg, ${theme.surface}, ${theme.surface2})`,
                border: `1px solid ${theme.border}`,
                color: theme.text2,
                boxShadow: '0 10px 24px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.08)',
              }}
            >
              <Timer size={16} />
              Cronometrat
            </Link>
            <Link
              to={`/flashcards/session/${quiz.id}?mode=all`}
              className="flex-1 min-w-[140px] flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all hover:bg-white/5 active:scale-[0.98]"
              style={{
                background: `linear-gradient(180deg, ${theme.surface}, ${theme.surface2})`,
                border: `1px solid ${theme.border}`,
                color: theme.text2,
                boxShadow: '0 10px 24px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.08)',
              }}
            >
              <CreditCard size={16} />
              Flashcarduri
            </Link>
            <button
              onClick={() => {
                const wrongQuestionIds = Object.entries(questionStats)
                  .filter(([key, stats]) => key.startsWith(`${quiz.id}:`) && stats.timesWrong > 0)
                  .map(([key]) => key.split(':')[1]);

                if (wrongQuestionIds.length === 0) return;
                navigate(`/play/${quiz.id}`, { state: { wrongQuestionsOnly: wrongQuestionIds } });
              }}
              disabled={wrongCount === 0}
              className="flex-1 min-w-[140px] flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all hover:bg-red-500/5 active:scale-[0.98] disabled:opacity-30"
              style={{
                background: `linear-gradient(180deg, ${theme.surface}, ${theme.surface2})`,
                border: `1px solid ${wrongCount > 0 ? `${theme.danger}40` : theme.border}`,
                color: wrongCount > 0 ? theme.danger : theme.text3,
                boxShadow: '0 10px 24px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.08)',
              }}
            >
              <RotateCcw size={16} />
              Greșeli ({wrongCount})
            </button>
          </motion.div>

              {hasKey ? (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.25 }}
              onClick={() => {
                setShowChat(true);
              }}
              className="w-full flex items-center justify-between gap-4 p-4 rounded-2xl mb-8 group transition-all"
              style={{
                background: `linear-gradient(135deg, ${theme.accent}12, ${theme.accent2}08)`,
                border: `1px solid ${theme.accent}30`,
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg transition-transform group-hover:scale-110"
                  style={{ background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})` }}
                >
                  <Bot size={20} className="text-white" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-black" style={{ color: theme.text }}>Asistent AI personal</p>
                  <p className="text-[10px] font-bold uppercase tracking-wider opacity-50" style={{ color: theme.text }}>
                    Discută despre conceptele din această grilă
                  </p>
                </div>
              </div>
              <div
                className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all group-hover:translate-x-1"
                style={{ background: `${theme.accent}20`, color: theme.accent }}
              >
                Deschide chat
              </div>
            </motion.button>
          ) : (
            <div
              className="w-full flex items-center gap-3 p-4 rounded-2xl mb-8"
              style={{ background: theme.surface2, border: `1px solid ${theme.border}` }}
            >
              <Bot size={18} style={{ color: theme.text3 }} />
              <span className="text-xs font-medium flex-1" style={{ color: theme.text3 }}>
                Activează AI din Setări pentru tutorat personalizat.
              </span>
              <button
                onClick={() => window.dispatchEvent(new CustomEvent('studyx:open-ai-settings'))}
                className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg transition-all hover:bg-white/5"
                style={{ background: theme.surface, border: `1px solid ${theme.border}`, color: theme.accent }}
              >
                Configurare
              </button>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2 mb-8 sm:grid-cols-6">
            {[
              { label: 'Editează', icon: Pencil, action: () => navigate(`/create?edit=${quiz.id}`), color: theme.accent },
              { label: 'Copiază', icon: Copy, action: handleDuplicate, color: theme.text2 },
              { label: 'JSON', icon: Download, action: exportQuiz, color: theme.text2 },
              { label: 'PDF', icon: FileText, action: exportPDF, color: theme.text2 },
              { label: 'Anki', icon: Download, action: exportAnki, color: theme.text2 },
              {
                label: quiz.archived ? 'Restaurează' : 'Arhivează',
                icon: quiz.archived ? ArchiveRestore : Archive,
                action: () => toggleArchive(quiz.id),
                color: quiz.archived ? theme.warning : theme.text3,
              },
            ].map((button) => (
              <button
                key={button.label}
                onClick={button.action}
                className="flex flex-col items-center gap-1.5 py-3 rounded-2xl transition-all hover:scale-[1.05] active:scale-[0.95]"
                style={{
                  background: `linear-gradient(180deg, ${theme.surface}, ${theme.surface2})`,
                  border: `1px solid ${theme.border}`,
                  boxShadow: '0 12px 26px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.08)',
                }}
              >
                <button.icon size={16} style={{ color: button.color }} />
                <span className="text-[10px] font-black uppercase tracking-tighter opacity-60" style={{ color: theme.text }}>
                  {button.label}
                </span>
              </button>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="rounded-3xl p-6 mb-8"
            style={{
              background: theme.surface,
              border: `1px solid ${theme.border}`,
              boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
            }}
          >
            <div className="flex items-center justify-between mb-6 gap-4">
              <div>
                <h2 className="text-base font-black tracking-tight" style={{ color: theme.text }}>Conținut grilă</h2>
                <p className="text-[10px] font-bold uppercase tracking-wider opacity-50" style={{ color: theme.text }}>
                  {quiz.questions.length} întrebări totale
                </p>
              </div>
              {quiz.questions.length > 5 && (
                <div
                  className="flex items-center gap-2 px-3 py-2 rounded-2xl flex-1 max-w-[220px] transition-all focus-within:ring-2"
                  style={searchWrapperStyle}
                >
                  <Search size={14} style={{ color: theme.text3 }} />
                  <input
                    type="text"
                    placeholder="Caută în întrebări..."
                    value={qSearch}
                    onChange={(event) => setQSearch(event.target.value)}
                    className="flex-1 text-xs font-medium bg-transparent"
                    style={{ color: theme.text, outline: 'none', border: 'none' }}
                  />
                </div>
              )}
            </div>

            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {quiz.questions
                .map((question, actualIndex) => ({ question, actualIndex }))
                .filter(({ question }) => !qSearch || question.text.toLowerCase().includes(qSearch.toLowerCase()))
                .map(({ question, actualIndex }) => (
                  <div
                    key={question.id}
                    className="p-4 rounded-2xl transition-all hover:bg-white/5 border border-transparent hover:border-white/10"
                    style={{ background: theme.surface2 }}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-[10px] font-black opacity-30 mt-1" style={{ color: theme.text }}>
                        {String(actualIndex + 1).padStart(2, '0')}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium leading-relaxed" style={{ color: theme.text2 }}>
                          {question.text}
                        </p>
                        {question.imageUrl && (
                          <div className="mt-3 rounded-xl overflow-hidden shadow-md">
                            <QuizImage src={question.imageUrl} maxHeight={120} />
                          </div>
                        )}
                        <div className="flex items-center gap-2 mt-3">
                          {question.multipleCorrect && (
                            <span
                              className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg shadow-sm"
                              style={{ background: `linear-gradient(135deg, ${theme.accent2}, ${theme.accent})`, color: '#fff' }}
                            >
                              Multi
                            </span>
                          )}
                          {question.difficulty && (
                            <span
                              className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg border shadow-sm"
                              style={{
                                background: `${diffColor(theme)[question.difficulty]}15`,
                                color: diffColor(theme)[question.difficulty],
                                borderColor: `${diffColor(theme)[question.difficulty]}30`,
                              }}
                            >
                              {diffLabel[question.difficulty]}
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

      <Suspense fallback={null}>
        <QuizDetailChatDrawer
          open={showChat}
          quiz={quiz}
          onClose={() => {
            setShowChat(false);
          }}
        />
      </Suspense>
    </>
  );
}
