import { motion, AnimatePresence } from 'framer-motion';
import { useState, useRef, useMemo, memo, useDeferredValue } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Trash2, Check, ChevronLeft, Sparkles, Layers, ImagePlus, X, Pencil, Tag, GripVertical, Eye, Bot, Loader2, FileText, Scale } from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useQuizStore } from '../store/quizStore';
import { useTheme } from '../theme/ThemeContext';
import { useAIStore } from '../store/aiStore';
import type { Question, Option, Difficulty, QuizColor } from '../types';
import type { Theme } from '../theme/themes';

let quizCreateAIPromise: Promise<typeof import('../lib/groq')> | null = null;

function loadQuizCreateAI() {
  if (!quizCreateAIPromise) {
    quizCreateAIPromise = import('../lib/groq');
  }
  return quizCreateAIPromise;
}

const EMOJIS = ['📚', '🧠', '💡', '🔬', '🌍', '💻', '🔢', '🎯', '⚡', '🏆', '🎓', '🌱', '🧪', '🗺️', '📖', '🏛️', '🩺', '💊', '❤️', '🦠', '🔭', '🧬'];
const COLORS: { id: QuizColor; bg: string }[] = [
  { id: 'blue', bg: 'linear-gradient(135deg, #0A84FF, #5E5CE6)' },
  { id: 'purple', bg: 'linear-gradient(135deg, #5E5CE6, #AF52DE)' },
  { id: 'green', bg: 'linear-gradient(135deg, #30D158, #34C759)' },
  { id: 'orange', bg: 'linear-gradient(135deg, #FF9F0A, #FF6B00)' },
  { id: 'pink', bg: 'linear-gradient(135deg, #FF375F, #FF2D55)' },
  { id: 'red', bg: 'linear-gradient(135deg, #FF453A, #FF3B30)' },
  { id: 'teal', bg: 'linear-gradient(135deg, #5AC8FA, #32ADE6)' },
];
const CATEGORIES = ['Dermatologie', 'Anatomie', 'Fiziologie', 'Biochimie', 'Farmacologie', 'Patologie', 'Chirurgie', 'Medicină internă', 'Neurologie', 'Microbiologie', 'Histologie', 'Altele'];
const DIFFICULTIES: { id: Difficulty; label: string; color: string }[] = [
  { id: 'easy', label: 'Ușor', color: '#30D158' },
  { id: 'medium', label: 'Mediu', color: '#FF9F0A' },
  { id: 'hard', label: 'Dificil', color: '#FF453A' },
];

const OPTION_IDS = ['a', 'b', 'c', 'd', 'e', 'f'];

function compressImage(dataUrl: string, maxPx = 800, quality = 0.75): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxPx || height > maxPx) {
        if (width > height) { height = Math.round(height * maxPx / width); width = maxPx; }
        else { width = Math.round(width * maxPx / height); height = maxPx; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

function generateId() { return crypto.randomUUID().replace(/-/g, '').slice(0, 12); }

function SortableQuestionTab({ id, index, isActive, isValid, onClick, theme }: {
  id: string; index: number; isActive: boolean; isValid: boolean; onClick: () => void; theme: Theme;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      className="flex-shrink-0 relative group">
      <button onClick={onClick}
        className="w-9 h-9 rounded-xl text-sm font-medium transition-all"
        style={{
          background: isActive ? `${theme.accent}20` : isValid ? `${theme.success}15` : theme.surface,
          border: `1px solid ${isActive ? theme.accent + '40' : 'transparent'}`,
          color: isActive ? theme.accent : isValid ? theme.success : theme.text3,
        }}>{index + 1}</button>
      <div {...attributes} {...listeners}
        className="absolute -top-1 -right-1 p-0.5 rounded cursor-grab opacity-0 group-hover:opacity-100 transition-all"
        style={{ background: theme.surface2, color: theme.text3 }}>
        <GripVertical size={8} />
      </div>
    </div>
  );
}

const MemoSortableQuestionTab = memo(SortableQuestionTab);

function newQuestion(): Question {
  return {
    id: generateId(),
    text: '',
    multipleCorrect: false,
    difficulty: 'easy',
    options: [
      { id: 'a', text: '', isCorrect: false },
      { id: 'b', text: '', isCorrect: false },
      { id: 'c', text: '', isCorrect: false },
      { id: 'd', text: '', isCorrect: false },
    ],
    explanation: '',
  };
}

export default function QuizCreate() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const targetFolderId = searchParams.get('folder');
  const editId = searchParams.get('edit');
  const { addQuiz, updateQuiz, quizzes } = useQuizStore();
  const theme = useTheme();
  const compact = typeof window !== 'undefined' && (window.innerHeight < 860 || window.innerWidth < 1280);

  // Pre-load existing quiz for edit mode
  const existingQuiz = editId ? quizzes.find((q) => q.id === editId) : null;

  const [step, setStep] = useState<'info' | 'questions'>('info');
  const [title, setTitle] = useState(existingQuiz?.title ?? '');
  const [description, setDescription] = useState(existingQuiz?.description ?? '');
  const [emoji, setEmoji] = useState(existingQuiz?.emoji ?? '📚');
  const [color, setColor] = useState<QuizColor>(existingQuiz?.color ?? 'blue');
  const [category, setCategory] = useState(existingQuiz?.category ?? 'Altele');
  const [shuffleQuestions, setShuffleQuestions] = useState(existingQuiz?.shuffleQuestions ?? false);
  const [shuffleAnswers, setShuffleAnswers] = useState(existingQuiz?.shuffleAnswers ?? false);
  const [penaltyMode, setPenaltyMode] = useState(existingQuiz?.penaltyMode ?? false);
  const [questions, setQuestions] = useState<Question[]>(existingQuiz?.questions ?? [newQuestion()]);
  const [activeQ, setActiveQ] = useState(0);
  const [tags, setTags] = useState<string[]>(existingQuiz?.tags ?? []);
  const [tagInput, setTagInput] = useState('');
  const [previewQ, setPreviewQ] = useState<Question | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIdx = questions.findIndex((q) => q.id === active.id);
      const newIdx = questions.findIndex((q) => q.id === over.id);
      if (oldIdx === -1 || newIdx === -1) return;
      setQuestions((qs) => arrayMove(qs, oldIdx, newIdx));
      setActiveQ(newIdx);
    }
  };

  const currentQ = questions[Math.min(activeQ, questions.length - 1)];

  const updateQuestion = (id: string, updates: Partial<Question>) =>
    setQuestions((qs) => qs.map((q) => (q.id === id ? { ...q, ...updates } : q)));

  const updateOption = (qId: string, optId: string, updates: Partial<Option>) =>
    setQuestions((qs) => qs.map((q) => q.id !== qId ? q : { ...q, options: q.options.map((o) => (o.id === optId ? { ...o, ...updates } : o)) }));

  const toggleCorrect = (qId: string, optId: string) => {
    const q = questions.find((q) => q.id === qId);
    if (!q) return;
    if (q.multipleCorrect) {
      updateOption(qId, optId, { isCorrect: !q.options.find((o) => o.id === optId)?.isCorrect });
    } else {
      setQuestions((qs) => qs.map((q) => q.id !== qId ? q : { ...q, options: q.options.map((o) => ({ ...o, isCorrect: o.id === optId })) }));
    }
  };

  const addQuestion = () => {
    const q = newQuestion();
    setQuestions((qs) => [...qs, q]);
    setActiveQ((prev) => Math.max(prev + 1, questions.length));
  };

  const removeQuestion = (idx: number) => {
    if (questions.length === 1) return;
    setQuestions((qs) => qs.filter((_, i) => i !== idx));
    setActiveQ(Math.max(0, idx - 1));
  };

  const uploadTargetQId = useRef<string | null>(null);

  const handleImageUpload = async (qId: string) => {
    // Try Electron native dialog first
    if (window.electronAPI?.openImageFile) {
      const dataUrl = await window.electronAPI.openImageFile();
      if (dataUrl) {
        const compressed = await compressImage(dataUrl);
        updateQuestion(qId, { imageUrl: compressed });
      }
      return;
    }
    // Fallback: browser file input
    const input = fileInputRef.current;
    if (!input) return;
    
    uploadTargetQId.current = qId;
    input.value = '';
    input.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const qId = uploadTargetQId.current;
    if (!qId) return;
    const file = e.target.files?.[0];
    if (!file) {
      uploadTargetQId.current = null;
      return;
    }
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const result = ev.target?.result as string;
      if (result) {
        const compressed = await compressImage(result);
        updateQuestion(qId, { imageUrl: compressed });
      }
    };
    reader.onerror = () => {};
    reader.readAsDataURL(file);
    uploadTargetQId.current = null;
  };

  const [shakeFields, setShakeFields] = useState<string[]>([]);
  const triggerShake = (fields: string[]) => {
    setShakeFields(fields);
    setTimeout(() => setShakeFields([]), 600);
  };

  // AI generation
  const { hasKey } = useAIStore();
  const [aiText, setAiText] = useState('');
  const [aiCount, setAiCount] = useState(5);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [questionsTab, setQuestionsTab] = useState<'manual' | 'ai'>('manual');

  const handleAIGenerate = async () => {
    if (!aiText.trim()) return;
    setAiLoading(true);
    setAiError('');
    try {
      const { generateQuestionsFromText } = await loadQuizCreateAI();
      const generated = await generateQuestionsFromText(aiText, aiCount);
      const newQs: Question[] = generated.map((g) => ({
        id: generateId(),
        text: g.text,
        multipleCorrect: false,
        difficulty: 'easy' as Difficulty,
        explanation: g.explanation ?? '',
        options: g.options.map((o, i) => ({
          id: OPTION_IDS[i] ?? generateId(),
          text: o.text,
          isCorrect: o.isCorrect,
        })),
      }));
      const nextActiveIndex = questions.length === 1 && !questions[0].text.trim() ? 0 : questions.length;
      setQuestions((qs) => {
        // Remove empty placeholder if it's the only question
        const filtered = qs.length === 1 && !qs[0].text.trim() ? [] : qs;
        return [...filtered, ...newQs];
      });
      setActiveQ(nextActiveIndex);
      setQuestionsTab('manual');
    } catch (err: unknown) {
      setAiError(err instanceof Error ? err.message : 'Eroare necunoscută');
    } finally {
      setAiLoading(false);
    }
  };

  const canProceed = title.trim() && description.trim();
  const deferredQuestions = useDeferredValue(questions);
  const isQValid = (q: Question) =>
    q.text.trim() &&
    q.options.every((o) => o.text.trim()) &&
    q.options.some((o) => o.isCorrect);
  const questionValidity = useMemo(() => deferredQuestions.map((q) => !!isQValid(q)), [deferredQuestions]);
  const canSave = questionValidity.every(Boolean);

  const handleSave = () => {
    if (!canSave || !canProceed) return;
    if (editId && existingQuiz) {
      updateQuiz(editId, {
        title: title.trim(),
        description: description.trim(),
        emoji, color, category,
        shuffleQuestions, shuffleAnswers, penaltyMode,
        tags,
        questions,
      });
      navigate(`/quiz/${editId}`);
    } else {
      addQuiz({
        id: generateId(),
        title: title.trim(),
        description: description.trim(),
        emoji, color, category,
        folderId: targetFolderId && targetFolderId !== 'null' ? targetFolderId : null,
        shuffleQuestions, shuffleAnswers, penaltyMode,
        tags,
        questions,
        createdAt: Date.now(),
      });
      navigate(targetFolderId ? `/folder/${targetFolderId}` : '/quizzes');
    }
  };

  const Toggle = ({ value, onChange, label }: { value: boolean; onChange: () => void; label: string }) => (
    <button onClick={onChange}
      className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm transition-all"
      style={{
        background: value ? `${theme.accent}20` : theme.surface2,
        border: `1px solid ${value ? theme.accent + '40' : theme.border}`,
        color: value ? theme.accent : theme.text3,
      }}>
      <div className="w-4 h-4 rounded-full border-2 flex items-center justify-center"
        style={{ borderColor: value ? theme.accent : theme.border2, background: value ? theme.accent : 'transparent' }}>
        {value && <Check size={9} className="text-white" />}
      </div>
      {label}
    </button>
  );

  return (
    <div className={`h-full overflow-y-auto ${compact ? 'px-4 sm:px-6 py-5 sm:py-6' : 'px-8 py-8'}`}>
      {/* Hidden file input for browser fallback */}
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
      <div className={`${compact ? 'max-w-[920px]' : 'max-w-2xl'} mx-auto`}>

        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className={`flex items-center gap-3 ${compact ? 'mb-6' : 'mb-8'}`}>
          <button onClick={() => step === 'questions' ? setStep('info') : navigate(-1)}
            className="p-2 rounded-xl transition-all hover:opacity-80"
            style={{ background: theme.surface, color: theme.text2 }}>
            <ChevronLeft size={18} />
          </button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: theme.text }}>
              {editId ? 'Editează grila' : 'Grilă nouă'}
            </h1>
            <p className="text-sm" style={{ color: theme.text3 }}>
              {step === 'info' ? 'Pas 1: Informații generale' : `Pas 2: Întrebări (${questions.length})`}
            </p>
          </div>
          <div className="ml-auto flex gap-1">
            {[0, 1].map((i) => (
              <div key={i} className="w-8 h-1 rounded-full transition-all"
                style={{ background: (step === 'info' && i === 0) || (step === 'questions' && i <= 1) ? theme.accent : theme.surface2 }} />
            ))}
          </div>
        </motion.div>

        <AnimatePresence mode="wait">
          {step === 'info' ? (
              <motion.div key="info"
              initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.3 }}
              className={compact ? 'space-y-3' : 'space-y-4'}>

              {/* Emoji */}
              <Panel theme={theme}>
                <Label theme={theme}>Emoji</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {EMOJIS.map((e) => (
                    <button key={e} onClick={() => setEmoji(e)}
                      className="w-10 h-10 rounded-xl text-xl flex items-center justify-center transition-all"
                      style={{ background: emoji === e ? `${theme.accent}20` : theme.surface2, border: `1px solid ${emoji === e ? theme.accent + '40' : 'transparent'}` }}>
                      {e}
                    </button>
                  ))}
                </div>
              </Panel>

              {/* Color */}
              <Panel theme={theme}>
                <Label theme={theme}>Culoare temă</Label>
                <div className="flex gap-2 mt-2">
                  {COLORS.map((c) => (
                    <button key={c.id} onClick={() => setColor(c.id)}
                      className="w-10 h-10 rounded-xl transition-all hover:scale-110 flex items-center justify-center"
                      style={{ background: c.bg, outline: color === c.id ? `2px solid ${theme.text}` : 'none', outlineOffset: '2px' }}>
                      {color === c.id && <Check size={14} className="text-white" />}
                    </button>
                  ))}
                </div>
              </Panel>

              {/* Title */}
              <motion.div
                animate={shakeFields.includes('title') ? { x: [0, -10, 10, -8, 8, -4, 0] } : { x: 0 }}
                transition={{ duration: 0.5 }}>
                <Panel theme={theme} style={{ border: shakeFields.includes('title') ? `1px solid ${theme.danger}` : undefined }}>
                  <Label theme={theme}>Titlu *</Label>
                  <input type="text" placeholder="ex: Capitalele Europei" value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full bg-transparent text-lg font-medium mt-1"
                    style={{ color: theme.text, outline: 'none', border: 'none' }} />
                </Panel>
              </motion.div>

              {/* Description */}
              <motion.div
                animate={shakeFields.includes('desc') ? { x: [0, -10, 10, -8, 8, -4, 0] } : { x: 0 }}
                transition={{ duration: 0.5 }}>
                <Panel theme={theme} style={{ border: shakeFields.includes('desc') ? `1px solid ${theme.danger}` : undefined }}>
                  <Label theme={theme}>Descriere *</Label>
                  <textarea placeholder="Descrie pe scurt conținutul grilei..." value={description}
                    onChange={(e) => setDescription(e.target.value)} rows={3}
                    className="w-full bg-transparent resize-none text-sm mt-1"
                    style={{ color: theme.text, outline: 'none', border: 'none' }} />
                </Panel>
              </motion.div>

              {/* Category */}
              <Panel theme={theme}>
                <Label theme={theme}>Categorie</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {CATEGORIES.map((cat) => (
                    <button key={cat} onClick={() => setCategory(cat)}
                      className="px-3 py-1.5 rounded-full text-sm transition-all"
                      style={{
                        background: category === cat ? `${theme.accent}20` : theme.surface2,
                        border: `1px solid ${category === cat ? theme.accent + '40' : theme.border}`,
                        color: category === cat ? theme.accent : theme.text2,
                      }}>{cat}</button>
                  ))}
                </div>
              </Panel>

              {/* Tags */}
              <Panel theme={theme}>
                <Label theme={theme}>Etichete (opțional)</Label>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {tags.map(tag => (
                    <span key={tag} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium"
                      style={{ background: `${theme.accent}18`, color: theme.accent, border: `1px solid ${theme.accent}30` }}>
                      {tag}
                      <button onClick={() => setTags(ts => ts.filter(t => t !== tag))}><X size={10} /></button>
                    </span>
                  ))}
                  <div className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs"
                    style={{ background: theme.surface2, border: `1px solid ${theme.border}` }}>
                    <Tag size={10} style={{ color: theme.text3 }} />
                    <input
                      type="text" placeholder="Adaugă etichetă..." value={tagInput}
                      onChange={e => setTagInput(e.target.value)}
                      onKeyDown={e => {
                        if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
                          e.preventDefault();
                          const t = tagInput.trim().toLowerCase();
                          if (!tags.includes(t)) setTags(ts => [...ts, t]);
                          setTagInput('');
                        }
                      }}
                      className="bg-transparent outline-none w-28"
                      style={{ color: theme.text, border: 'none' }}
                    />
                  </div>
                </div>
              </Panel>

              {/* Options */}
              <Panel theme={theme}>
                <Label theme={theme}>Opțiuni quiz</Label>
                <div className="flex gap-2 mt-2 flex-wrap">
                  <Toggle value={shuffleQuestions} onChange={() => setShuffleQuestions(!shuffleQuestions)}
                    label="Amestecă întrebările" />
                  <Toggle value={shuffleAnswers} onChange={() => setShuffleAnswers(!shuffleAnswers)}
                    label="Amestecă răspunsurile" />
                </div>
                <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${theme.border}` }}>
                  <div className="text-xs mb-2" style={{ color: theme.text3 }}>Notare medicală</div>
                  <button
                    onClick={() => setPenaltyMode(!penaltyMode)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm transition-all"
                    style={{
                      background: penaltyMode ? 'rgba(239,68,68,0.12)' : theme.surface2,
                      border: `1px solid ${penaltyMode ? 'rgba(239,68,68,0.4)' : theme.border}`,
                      color: penaltyMode ? '#ef4444' : theme.text3,
                    }}>
                    <Scale size={13} />
                    Mod Rezidențiat
                    {penaltyMode && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full font-bold"
                        style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>
                        −0.25/greșit
                      </span>
                    )}
                  </button>
                  {penaltyMode && (
                    <p className="text-xs mt-1.5" style={{ color: theme.text3 }}>
                      Răspuns corect: +1 punct · Opțiune greșită selectată: −0.25 puncte · Scor net ≥ 0
                    </p>
                  )}
                </div>
              </Panel>

              <motion.button
                onClick={() => {
                  if (!canProceed) {
                    const empty = [];
                    if (!title.trim()) empty.push('title');
                    if (!description.trim()) empty.push('desc');
                    triggerShake(empty);
                    return;
                  }
                  setStep('questions');
                }}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                className="w-full py-3.5 rounded-2xl font-semibold text-white"
                style={{ background: `linear-gradient(135deg, ${theme.accent} 0%, ${theme.accent2} 100%)`, opacity: canProceed ? 1 : 0.6 }}>
                Continuă → Adaugă întrebări
              </motion.button>
            </motion.div>
          ) : (
            <motion.div key="questions"
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}>

              {/* Tab switcher: Manual / AI */}
              <div className="flex gap-1 mb-5 p-1 rounded-xl" style={{ background: theme.surface }}>
                {[
                  { id: 'manual' as const, label: 'Manual', icon: <Pencil size={13} /> },
                  { id: 'ai' as const, label: 'Generează cu AI', icon: <Bot size={13} /> },
                ].map((tab) => (
                  <button key={tab.id} onClick={() => setQuestionsTab(tab.id)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all"
                    style={{
                      background: questionsTab === tab.id ? theme.surface : 'transparent',
                      color: questionsTab === tab.id ? theme.text : theme.text3,
                      boxShadow: questionsTab === tab.id ? '0 1px 4px rgba(0,0,0,0.12)' : 'none',
                    }}>
                    {tab.icon}{tab.label}
                  </button>
                ))}
              </div>

              {/* AI Generation Panel */}
              <AnimatePresence mode="wait">
                {questionsTab === 'ai' && (
                  <motion.div key="ai-panel"
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}
                    className="mb-4 rounded-2xl p-5 space-y-4"
                    style={{ background: theme.surface, border: `1px solid ${theme.border}` }}>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                        style={{ background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})` }}>
                        <Bot size={15} className="text-white" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold" style={{ color: theme.text }}>Generator AI de grile</p>
                        <p className="text-xs" style={{ color: theme.text3 }}>Lipește text medical → AI generează întrebări</p>
                      </div>
                    </div>

                    {!hasKey() && (
                      <div className="flex items-center gap-2 p-3 rounded-xl text-sm"
                        style={{ background: `${theme.warning}12`, border: `1px solid ${theme.warning}30`, color: theme.warning }}>
                        ⚠️ Configurează cheia Groq API în Sidebar → Setări AI
                      </div>
                    )}

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-medium" style={{ color: theme.text2 }}>
                          Text sursă (lecție, curs, capitol)
                        </label>
                        {window.electronAPI?.openPdfFile && (
                          <button
                            onClick={async () => {
                              const text = await window.electronAPI!.openPdfFile();
                              if (text) setAiText(text);
                              else setAiError('Nu s-a putut extrage text din PDF. Încearcă să lipești textul manual.');
                            }}
                            className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg"
                            style={{ background: theme.surface2, color: theme.accent, border: `1px solid ${theme.accent}30` }}>
                            <FileText size={11} />Import PDF
                          </button>
                        )}
                      </div>
                      <textarea
                        value={aiText}
                        onChange={(e) => setAiText(e.target.value)}
                        placeholder="Lipește sau scrie textul din care vrei să generezi grile..."
                        rows={7}
                        className="w-full text-sm px-3 py-2.5 rounded-xl resize-none"
                        style={{
                          background: theme.surface2,
                          border: `1px solid ${theme.border}`,
                          color: theme.text,
                          outline: 'none',
                        }}
                      />
                    </div>

                    <div>
                      <label className="text-xs font-medium mb-2 block" style={{ color: theme.text2 }}>Număr de întrebări</label>
                      <div className="flex gap-2">
                        {[3, 5, 8, 10, 15].map(n => (
                          <button key={n} onClick={() => setAiCount(n)}
                            className="flex-1 py-2 rounded-xl text-sm font-semibold transition-all"
                            style={{
                              background: aiCount === n ? `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})` : theme.surface2,
                              color: aiCount === n ? '#fff' : theme.text3,
                              border: `1px solid ${aiCount === n ? theme.accent + '50' : 'transparent'}`,
                            }}>
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>

                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={handleAIGenerate}
                      disabled={aiLoading || !hasKey() || !aiText.trim()}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold"
                      style={{
                        background: aiLoading || !hasKey() || !aiText.trim()
                          ? theme.surface2
                          : `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})`,
                        color: aiLoading || !hasKey() || !aiText.trim() ? theme.text3 : 'white',
                      }}>
                      {aiLoading ? <><Loader2 size={14} className="animate-spin" />Generez...</> : <><Sparkles size={14} />Generează {aiCount} grile</>}
                    </motion.button>

                    {aiError && (
                      <div className="p-3 rounded-xl text-sm" style={{ background: `${theme.danger}12`, border: `1px solid ${theme.danger}30`, color: theme.danger }}>
                        {aiError}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Question tabs — drag to reorder */}
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={questions.map(q => q.id)} strategy={horizontalListSortingStrategy}>
                  <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
                    {questions.map((q, i) => (
                      <MemoSortableQuestionTab key={q.id} id={q.id} index={i}
                        isActive={activeQ === i} isValid={questionValidity[i] ?? false}
                        onClick={() => setActiveQ(i)} theme={theme} />
                    ))}
                    <button onClick={addQuestion}
                      className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:opacity-80"
                      style={{ background: theme.surface, color: theme.text3 }}>
                      <Plus size={15} />
                    </button>
                  </div>
                </SortableContext>
              </DndContext>

              <AnimatePresence mode="wait">
                <motion.div key={currentQ.id}
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}
                  className="space-y-4">

                  <Panel theme={theme}>
                    <div className="flex items-center justify-between mb-2">
                      <Label theme={theme}>Întrebarea {activeQ + 1}</Label>
                      <div className="flex items-center gap-2">
                        {/* Preview button */}
                        <button
                          onClick={() => setPreviewQ(currentQ)}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-all hover:opacity-80"
                          style={{ background: theme.surface2, color: theme.text3 }}>
                          <Eye size={11} />Previzualizare
                        </button>
                        {/* Multiple correct toggle */}
                        <button
                          onClick={() => {
                            const isMulti = !currentQ.multipleCorrect;
                            updateQuestion(currentQ.id, {
                              multipleCorrect: isMulti,
                              options: currentQ.options.map((o) => ({ ...o, isCorrect: false })),
                            });
                          }}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-all"
                          style={{
                            background: currentQ.multipleCorrect ? `${theme.accent2}20` : theme.surface2,
                            color: currentQ.multipleCorrect ? theme.accent2 : theme.text3,
                            border: `1px solid ${currentQ.multipleCorrect ? theme.accent2 + '40' : 'transparent'}`,
                          }}>
                          <Layers size={11} />Multi
                        </button>
                        {questions.length > 1 && (
                          <button onClick={() => removeQuestion(activeQ)}
                            className="p-1 rounded-lg transition-all hover:opacity-80"
                            style={{ color: theme.danger }}>
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                    <textarea placeholder="Scrie întrebarea ta..." value={currentQ.text}
                      onChange={(e) => updateQuestion(currentQ.id, { text: e.target.value })} rows={3}
                      className="w-full bg-transparent resize-none font-medium"
                      style={{ color: theme.text, outline: 'none', border: 'none' }} />

                    {/* Image */}
                    {currentQ.imageUrl ? (
                      <div className="relative mt-3 rounded-xl overflow-hidden"
                        style={{ border: `1px solid ${theme.border}` }}>
                        <img src={currentQ.imageUrl} alt="Question"
                          className="w-full max-h-48 object-cover" />
                        <button
                          onClick={() => updateQuestion(currentQ.id, { imageUrl: undefined })}
                          className="absolute top-2 right-2 p-1.5 rounded-lg"
                          style={{ background: 'rgba(0,0,0,0.55)', color: '#fff' }}>
                          <X size={13} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleImageUpload(currentQ.id)}
                        className="mt-3 flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-all hover:opacity-80"
                        style={{ background: theme.surface2, color: theme.text3, border: `1px dashed ${theme.border2}` }}>
                        <ImagePlus size={14} />
                        Adaugă imagine (opțional)
                      </button>
                    )}

                    {/* Difficulty */}
                    <div className="flex gap-2 mt-3 pt-3" style={{ borderTop: `1px solid ${theme.border}` }}>
                      {DIFFICULTIES.map((d) => (
                        <button key={d.id} onClick={() => updateQuestion(currentQ.id, { difficulty: d.id })}
                          className="flex-1 py-1 rounded-lg text-xs font-medium transition-all"
                          style={{
                            background: currentQ.difficulty === d.id ? `${d.color}20` : theme.surface2,
                            color: currentQ.difficulty === d.id ? d.color : theme.text3,
                            border: `1px solid ${currentQ.difficulty === d.id ? d.color + '40' : 'transparent'}`,
                          }}>{d.label}</button>
                      ))}
                    </div>
                  </Panel>

                  {/* Options */}
                  <div className="space-y-2">
                    <p className="text-xs px-1" style={{ color: theme.text3 }}>
                      <Sparkles size={11} className="inline mr-1" />
                      {currentQ.multipleCorrect
                        ? 'Apasă pe cerc pentru a marca răspunsurile corecte (multiple)'
                        : 'Apasă pe cerc pentru a marca răspunsul corect'}
                    </p>
                    {currentQ.options.map((opt, oi) => (
                      <motion.div key={opt.id}
                        initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: oi * 0.05 }}
                        className="flex items-center gap-3 p-4 rounded-2xl transition-all group"
                        style={{
                          background: opt.isCorrect ? `${theme.success}10` : theme.surface,
                          border: `1px solid ${opt.isCorrect ? theme.success + '30' : theme.border}`,
                        }}>
                        <button onClick={() => toggleCorrect(currentQ.id, opt.id)}
                          className="flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all"
                          style={{
                            borderColor: opt.isCorrect ? theme.success : theme.border2,
                            background: opt.isCorrect ? theme.success : 'transparent',
                          }}>
                          {opt.isCorrect && <Check size={12} className="text-white" />}
                        </button>
                        <span className="text-xs font-bold" style={{ color: theme.text3, minWidth: 16 }}>
                          {opt.id.toUpperCase()}
                        </span>
                        <input type="text" placeholder={`Opțiunea ${opt.id.toUpperCase()}...`}
                          value={opt.text}
                          onChange={(e) => updateOption(currentQ.id, opt.id, { text: e.target.value })}
                          className="flex-1 bg-transparent text-sm"
                          style={{ color: theme.text, outline: 'none', border: 'none' }} />
                        {currentQ.options.length > 2 && (
                          <button
                            onClick={() => setQuestions((qs) => qs.map((q) => q.id !== currentQ.id ? q : {
                              ...q, options: q.options.filter((o) => o.id !== opt.id),
                            }))}
                            className="opacity-0 group-hover:opacity-100 p-1 rounded-lg transition-all"
                            style={{ color: theme.danger }}>
                            <X size={13} />
                          </button>
                        )}
                      </motion.div>
                    ))}
                    {currentQ.options.length < OPTION_IDS.length && (
                      <button
                        onClick={() => {
                          const nextId = OPTION_IDS[currentQ.options.length];
                          setQuestions((qs) => qs.map((q) => q.id !== currentQ.id ? q : {
                            ...q, options: [...q.options, { id: nextId, text: '', isCorrect: false }],
                          }));
                        }}
                        className="w-full py-2.5 rounded-2xl text-sm transition-all hover:opacity-80 flex items-center justify-center gap-1.5"
                        style={{ background: theme.surface2, border: `1px dashed ${theme.border2}`, color: theme.text3 }}>
                        <Plus size={13} />Adaugă opțiune
                      </button>
                    )}
                  </div>

                  {/* Explanation */}
                  <Panel theme={theme}>
                    <Label theme={theme}>Explicație (opțional)</Label>
                    <input type="text" placeholder="Explică de ce răspunsul este corect..."
                      value={currentQ.explanation || ''}
                      onChange={(e) => updateQuestion(currentQ.id, { explanation: e.target.value })}
                      className="w-full bg-transparent text-sm mt-1"
                      style={{ color: theme.text, outline: 'none', border: 'none' }} />
                  </Panel>
                </motion.div>
              </AnimatePresence>

              <div className="mt-5 flex gap-3">
                <button onClick={addQuestion}
                  className="flex-1 py-3.5 rounded-2xl font-medium text-sm transition-all hover:opacity-80"
                  style={{ background: theme.surface, border: `1px solid ${theme.border}`, color: theme.text2 }}>
                  <Plus size={15} className="inline mr-1" />Întrebare nouă
                </button>
                <button onClick={handleSave} disabled={!canSave}
                  className="flex-1 py-3.5 rounded-2xl font-semibold text-white transition-all hover:opacity-90 disabled:opacity-30 flex items-center justify-center gap-1.5"
                  style={{ background: `linear-gradient(135deg, ${theme.success} 0%, #34C759 100%)` }}>
                  {editId ? <><Pencil size={15} />Salvează modificările</> : <><Check size={15} />Salvează grila</>}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Question Preview Modal */}
      <AnimatePresence>
        {previewQ && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setPreviewQ(null)}
              className="fixed inset-0 z-50"
              style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }} />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: -20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed top-[10%] left-1/2 z-50 w-full max-w-lg -translate-x-1/2 px-4">
              <div className="rounded-3xl p-6 shadow-2xl"
                style={{ background: theme.isDark ? 'rgba(22,22,26,0.98)' : 'rgba(255,255,255,0.98)', border: `1px solid ${theme.border}` }}>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: theme.accent }}>Previzualizare</span>
                  <button onClick={() => setPreviewQ(null)} style={{ color: theme.text3 }}><X size={16} /></button>
                </div>
                <p className="text-lg font-semibold mb-4" style={{ color: theme.text }}>{previewQ.text || '(fără text)'}</p>
                <div className="space-y-2">
                  {previewQ.options.map((opt, i) => (
                    <div key={opt.id} className="flex items-center gap-3 p-3 rounded-xl"
                      style={{
                        background: opt.isCorrect ? `${theme.success}14` : theme.surface2,
                        border: `1px solid ${opt.isCorrect ? theme.success + '40' : theme.border}`,
                      }}>
                      <span className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                        style={{ background: opt.isCorrect ? `${theme.success}20` : theme.surface, color: opt.isCorrect ? theme.success : theme.text3 }}>
                        {String.fromCharCode(65 + i)}
                      </span>
                      <span className="text-sm" style={{ color: opt.isCorrect ? theme.success : theme.text2 }}>
                        {opt.text || '(fără text)'}
                      </span>
                      {opt.isCorrect && <Check size={14} className="ml-auto flex-shrink-0" style={{ color: theme.success }} />}
                    </div>
                  ))}
                </div>
                {previewQ.explanation && (
                  <div className="mt-4 p-3 rounded-xl" style={{ background: `${theme.accent}0C`, border: `1px solid ${theme.accent}20` }}>
                    <p className="text-xs" style={{ color: theme.text2 }}>
                      <span className="font-semibold" style={{ color: theme.accent }}>💡 Explicație: </span>
                      {previewQ.explanation}
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function Panel({ children, theme, style }: { children: React.ReactNode; theme: Theme; style?: React.CSSProperties }) {
  return (
    <div className="rounded-2xl p-5 transition-all input-focus-draw" style={{ background: theme.surface, border: `1px solid ${theme.border}`, ...style }}>
      {children}
    </div>
  );
}

function Label({ children, theme }: { children: React.ReactNode; theme: Theme }) {
  return <label className="text-sm font-medium" style={{ color: theme.text2 }}>{children}</label>;
}
