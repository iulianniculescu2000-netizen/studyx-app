import { AnimatePresence, motion } from 'framer-motion';
import { useState, useRef, useMemo, useDeferredValue } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Check, ChevronLeft, Pencil, Plus, Bot } from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { useQuizStore } from '../store/quizStore';
import { useFolderStore } from '../store/folderStore';
import { useTheme } from '../theme/ThemeContext';
import { useAIStore } from '../store/aiStore';
import type { Question, Option, Difficulty, QuizColor } from '../types';
import { OPTION_IDS, compressImage, generateId, newQuestion } from './quiz-create/helpers';
import {
  QuestionPreviewModal,
  QuizAIGenerationPanel,
  QuizInfoStep,
  QuizQuestionEditor,
} from './quiz-create/sections';
import { SortableQuestionTab } from './quiz-create/ui';

let quizCreateAIPromise: Promise<typeof import('../lib/groq')> | null = null;

function loadQuizCreateAI() {
  if (!quizCreateAIPromise) {
    quizCreateAIPromise = import('../lib/groq');
  }
  return quizCreateAIPromise;
}

export default function QuizCreate() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const targetFolderId = searchParams.get('folder');
  const editId = searchParams.get('edit');
  const { addQuiz, updateQuiz, quizzes } = useQuizStore();
  const folders = useFolderStore((state) => state.folders);
  const theme = useTheme();
  const compact = typeof window !== 'undefined' && (window.innerHeight < 860 || window.innerWidth < 1280);

  // Pre-load existing quiz for edit mode
  const existingQuiz = editId ? quizzes.find((q) => q.id === editId) : null;

  const [step, setStep] = useState<'info' | 'questions'>('info');
  const [title, setTitle] = useState(existingQuiz?.title ?? '');
  const [description, setDescription] = useState(existingQuiz?.description ?? '');
  const [emoji, setEmoji] = useState(existingQuiz?.emoji ?? '📝');
  const [color, setColor] = useState<QuizColor>(existingQuiz?.color ?? 'blue');
  const [category, setCategory] = useState(existingQuiz?.category ?? 'Altele');
  const [selectedFolderId, setSelectedFolderId] = useState(
    existingQuiz?.folderId ?? (targetFolderId && targetFolderId !== 'null' ? targetFolderId : '__uncategorized__'),
  );
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
    useSensor(PointerSensor, {
      // Drag pornește doar după ce mouseul s-a mișcat ≥5px.
      // Fără asta, click-urile pe butoane din interior sunt interceptate de DnD.
      activationConstraint: { distance: 5 },
    }),
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
  const [aiCount, setAiCount] = useState(10);
  const [aiDifficulty, setAiDifficulty] = useState(3);
  const [aiMode, setAiMode] = useState<'standard' | 'clinical'>('standard');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiProgress, setAiProgress] = useState<{ generated: number; total: number } | null>(null);
  const [questionsTab, setQuestionsTab] = useState<'manual' | 'ai'>('manual');

  const handleAIGenerate = async () => {
    if (!aiText.trim()) return;
    setAiLoading(true);
    setAiError('');
    setAiProgress({ generated: 0, total: aiCount });
    try {
      const { generateQuestionsFromText, generateClinicalCase } = await loadQuizCreateAI();
      const existingTexts = quizzes.flatMap((quiz) => quiz.questions.map((question) => question.text));
      const generated = aiMode === 'clinical'
        ? await generateClinicalCase(aiText, aiCount)
        : await generateQuestionsFromText(aiText, aiCount, aiDifficulty, existingTexts, (g, t) => setAiProgress({ generated: g, total: t }));
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
      setAiProgress(null);
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
    // Dacă există text nefinalizat în tagInput, îl adăugăm automat la salvare
    const pendingTag = tagInput.trim().toLowerCase();
    const finalTags = pendingTag && !tags.includes(pendingTag)
      ? [...tags, pendingTag]
      : tags;
    if (editId && existingQuiz) {
      updateQuiz(editId, {
        title: title.trim(),
        description: description.trim(),
        emoji, color, category,
        folderId: selectedFolderId === '__uncategorized__' ? null : selectedFolderId,
        shuffleQuestions, shuffleAnswers, penaltyMode,
        tags: finalTags,
        questions,
      });
      navigate(`/quiz/${editId}`);
    } else {
      addQuiz({
        id: generateId(),
        title: title.trim(),
        description: description.trim(),
        emoji, color, category,
        folderId: selectedFolderId === '__uncategorized__' ? null : selectedFolderId,
        shuffleQuestions, shuffleAnswers, penaltyMode,
        tags: finalTags,
        questions,
        createdAt: Date.now(),
      });
      navigate(selectedFolderId !== '__uncategorized__' ? `/folder/${selectedFolderId}` : '/quizzes');
    }
  };

  return (
    <div className={`h-full overflow-y-auto ${compact ? 'px-4 sm:px-6 py-5 sm:py-6' : 'px-8 py-8'}`}>
      {/* Hidden file input for browser fallback */}
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
      <div className={`${compact ? 'max-w-[980px]' : 'max-w-[1080px]'} mx-auto`}>

        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className={`flex items-center gap-3 ${compact ? 'mb-6' : 'mb-8'} rounded-[28px] px-1`}>
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
            <QuizInfoStep
              canProceed={!!canProceed}
              category={category}
              color={color}
              description={description}
              emoji={emoji}
              folders={folders}
              penaltyMode={penaltyMode}
              selectedFolderId={selectedFolderId}
              shakeFields={shakeFields}
              shuffleAnswers={shuffleAnswers}
              shuffleQuestions={shuffleQuestions}
              tagInput={tagInput}
              tags={tags}
              theme={theme}
              title={title}
              onAddTag={() => {
                const nextTag = tagInput.trim().toLowerCase();
                if (!nextTag || tags.includes(nextTag)) return;
                setTags((current) => [...current, nextTag]);
                setTagInput('');
              }}
              onCategoryChange={setCategory}
              onColorChange={setColor}
              onContinue={() => {
                if (!canProceed) {
                  const empty = [];
                  if (!title.trim()) empty.push('title');
                  if (!description.trim()) empty.push('desc');
                  triggerShake(empty);
                  return;
                }
                setStep('questions');
              }}
              onDescriptionChange={setDescription}
              onEmojiChange={setEmoji}
              onFolderChange={setSelectedFolderId}
              onPenaltyModeToggle={() => setPenaltyMode((current) => !current)}
              onRemoveTag={(tag) => setTags((current) => current.filter((item) => item !== tag))}
              onShuffleAnswersToggle={() => setShuffleAnswers((current) => !current)}
              onShuffleQuestionsToggle={() => setShuffleQuestions((current) => !current)}
              onTagInputChange={setTagInput}
              onTitleChange={setTitle}
            />
          ) : (
            <motion.div key="questions"
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}>

              {/* Tab switcher: Manual / AI */}
              <div className="flex gap-1 mb-5 p-1.5 rounded-2xl glass-panel" style={{ background: theme.surface }}>
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

              <QuizAIGenerationPanel
                aiCount={aiCount}
                aiDifficulty={aiDifficulty}
                aiError={aiError}
                aiLoading={aiLoading}
                aiMode={aiMode}
                aiProgress={aiProgress}
                aiText={aiText}
                hasKey={hasKey}
                theme={theme}
                visible={questionsTab === 'ai'}
                onCountChange={setAiCount}
                onDifficultyChange={setAiDifficulty}
                onGenerate={handleAIGenerate}
                onImportPdf={async () => {
                  const text = await window.electronAPI?.openPdfFile?.();
                  if (text) {
                    setAiText(text);
                    return;
                  }
                  setAiError('Nu s-a putut extrage textul din PDF. Încearcă să îl lipești manual.');
                }}
                onModeChange={(mode) => {
                  setAiMode(mode);
                  // Cazurile clinice funcționează mai bine cu numere mai mici
                  if (mode === 'clinical' && aiCount > 15) setAiCount(5);
                  if (mode === 'standard' && aiCount < 10) setAiCount(10);
                }}
                onTextChange={setAiText}
              />

              {/* Question tabs - drag to reorder */}
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={questions.map(q => q.id)} strategy={horizontalListSortingStrategy}>
                  <div className="flex gap-2 mb-5 overflow-x-auto pb-2 pr-1">
                    {questions.map((q, i) => (
                      <SortableQuestionTab key={q.id} id={q.id} index={i}
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

              <QuizQuestionEditor
                activeQ={activeQ}
                canRemoveQuestion={questions.length > 1}
                currentQ={currentQ}
                theme={theme}
                onAddOption={() => {
                  const nextId = OPTION_IDS[currentQ.options.length];
                  setQuestions((current) => current.map((question) => (
                    question.id !== currentQ.id
                      ? question
                      : { ...question, options: [...question.options, { id: nextId, text: '', isCorrect: false }] }
                  )));
                }}
                onExplanationChange={(value) => updateQuestion(currentQ.id, { explanation: value })}
                onImageUpload={() => handleImageUpload(currentQ.id)}
                onOptionRemove={(optionId) => {
                  setQuestions((current) => current.map((question) => (
                    question.id !== currentQ.id
                      ? question
                      : { ...question, options: question.options.filter((option) => option.id !== optionId) }
                  )));
                }}
                onOptionTextChange={(optionId, value) => updateOption(currentQ.id, optionId, { text: value })}
                onPreview={() => setPreviewQ(currentQ)}
                onQuestionRemove={() => removeQuestion(activeQ)}
                onQuestionTextChange={(value) => updateQuestion(currentQ.id, { text: value })}
                onRemoveImage={() => updateQuestion(currentQ.id, { imageUrl: undefined })}
                onSetDifficulty={(difficulty) => updateQuestion(currentQ.id, { difficulty })}
                onToggleCorrect={(optionId) => toggleCorrect(currentQ.id, optionId)}
                onToggleMultiple={() => {
                  const isMulti = !currentQ.multipleCorrect;
                  updateQuestion(currentQ.id, {
                    multipleCorrect: isMulti,
                    options: currentQ.options.map((option) => ({ ...option, isCorrect: false })),
                  });
                }}
              />

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

      <QuestionPreviewModal previewQ={previewQ} theme={theme} onClose={() => setPreviewQ(null)} />
    </div>
  );
}
