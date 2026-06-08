import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import {
  Bot,
  Check,
  ChevronDown,
  Eye,
  FileText,
  ImagePlus,
  Layers,
  Loader2,
  Plus,
  Scale,
  Sparkles,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import type { Folder, Question, QuizColor } from '../../types';
import type { Theme } from '../../theme/themes';
import { CATEGORIES, COLORS, DIFFICULTIES, EMOJIS, OPTION_IDS } from './helpers';
import { Label, Panel, Toggle } from './ui';

function FolderTargetPicker({
  folders,
  value,
  theme,
  onChange,
}: {
  folders: Folder[];
  value: string;
  theme: Theme;
  onChange: (folderId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const folderPath = (folder: Folder) => {
    const byId = new Map(folders.map((item) => [item.id, item]));
    const names = [folder.name];
    let parent = folder.parentId ? byId.get(folder.parentId) : undefined;
    const guard = new Set([folder.id]);
    while (parent && !guard.has(parent.id)) {
      guard.add(parent.id);
      names.unshift(parent.name);
      parent = parent.parentId ? byId.get(parent.parentId) : undefined;
    }
    return names.join(' / ');
  };
  const selectedFolder = folders.find((folder) => folder.id === value);
  const selectedLabel = selectedFolder ? `${selectedFolder.emoji} ${folderPath(selectedFolder)}` : 'Neclasificate';
  const options = [
    { id: '__uncategorized__', label: 'Neclasificate', helper: 'Setul ramane in lista principala' },
    ...folders.map((folder) => ({
      id: folder.id,
      label: `${folder.emoji} ${folderPath(folder)}`,
      helper: 'Salveaza direct in folder',
    })),
  ];

  useEffect(() => {
    if (!open) return undefined;
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div ref={rootRef} className="relative mt-2">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all"
        style={{
          background: theme.surface2,
          borderColor: open ? `${theme.accent}55` : theme.border,
          color: theme.text,
          boxShadow: open ? `0 0 0 1px ${theme.accent}18` : 'none',
        }}
      >
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{selectedLabel}</div>
          <div className="mt-0.5 text-[11px]" style={{ color: theme.text3 }}>
            Unde se salveaza grila dupa creare
          </div>
        </div>
        <motion.div animate={{ rotate: open ? 180 : 0 }} style={{ color: theme.text3 }}>
          <ChevronDown size={15} />
        </motion.div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.16 }}
            className="absolute left-0 right-0 top-[calc(100%+0.45rem)] z-40 rounded-2xl border p-1.5 shadow-2xl"
            style={{
              background: theme.isDark ? 'rgba(20,24,30,0.98)' : 'rgba(255,255,255,0.98)',
              borderColor: theme.border,
              backdropFilter: 'blur(18px) saturate(160%)',
            }}
          >
            {options.map((option) => {
              const active = option.id === value;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    onChange(option.id);
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all"
                  style={{
                    background: active ? `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})` : 'transparent',
                    color: active ? '#fff' : theme.text,
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{option.label}</div>
                    <div className="mt-0.5 truncate text-[11px]" style={{ color: active ? 'rgba(255,255,255,0.72)' : theme.text3 }}>
                      {option.helper}
                    </div>
                  </div>
                  {active && <Check size={14} />}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface QuizInfoStepProps {
  canProceed: boolean;
  category: string;
  color: QuizColor;
  description: string;
  emoji: string;
  folders: Folder[];
  penaltyMode: boolean;
  selectedFolderId: string;
  shakeFields: string[];
  shuffleAnswers: boolean;
  shuffleQuestions: boolean;
  tagInput: string;
  tags: string[];
  theme: Theme;
  title: string;
  onAddTag: () => void;
  onCategoryChange: (category: string) => void;
  onColorChange: (color: QuizColor) => void;
  onContinue: () => void;
  onDescriptionChange: (value: string) => void;
  onEmojiChange: (emoji: string) => void;
  onFolderChange: (folderId: string) => void;
  onPenaltyModeToggle: () => void;
  onRemoveTag: (tag: string) => void;
  onShuffleAnswersToggle: () => void;
  onShuffleQuestionsToggle: () => void;
  onTagInputChange: (value: string) => void;
  onTitleChange: (value: string) => void;
}

export function QuizInfoStep({
  canProceed,
  category,
  color,
  description,
  emoji,
  folders,
  penaltyMode,
  selectedFolderId,
  shakeFields,
  shuffleAnswers,
  shuffleQuestions,
  tagInput,
  tags,
  theme,
  title,
  onAddTag,
  onCategoryChange,
  onColorChange,
  onContinue,
  onDescriptionChange,
  onEmojiChange,
  onFolderChange,
  onPenaltyModeToggle,
  onRemoveTag,
  onShuffleAnswersToggle,
  onShuffleQuestionsToggle,
  onTagInputChange,
  onTitleChange,
}: QuizInfoStepProps) {
  return (
    <motion.div
      key="info"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.3 }}
      className="space-y-4"
    >
      <Panel theme={theme}>
        <Label theme={theme}>Emoji</Label>
        <div className="flex flex-wrap gap-2 mt-2">
          {EMOJIS.map((item) => (
            <button
              key={item}
              onClick={() => onEmojiChange(item)}
              className="w-10 h-10 rounded-xl text-xl flex items-center justify-center transition-all"
              style={{
                background: emoji === item ? `${theme.accent}20` : theme.surface2,
                border: `1px solid ${emoji === item ? `${theme.accent}40` : 'transparent'}`,
              }}
            >
              {item}
            </button>
          ))}
        </div>
      </Panel>

      <Panel theme={theme}>
        <Label theme={theme}>Culoare temă</Label>
        <div className="flex gap-2 mt-2">
          {COLORS.map((item) => (
            <button
              key={item.id}
              onClick={() => onColorChange(item.id)}
              className="w-10 h-10 rounded-xl transition-all hover:scale-110 flex items-center justify-center"
              style={{
                background: item.bg,
                outline: color === item.id ? `2px solid ${theme.text}` : 'none',
                outlineOffset: '2px',
              }}
            >
              {color === item.id && <Check size={14} className="text-white" />}
            </button>
          ))}
        </div>
      </Panel>

      <motion.div
        animate={shakeFields.includes('title') ? { x: [0, -10, 10, -8, 8, -4, 0] } : { x: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Panel theme={theme} style={{ border: shakeFields.includes('title') ? `1px solid ${theme.danger}` : undefined }}>
          <Label theme={theme}>Titlu *</Label>
          <input
            type="text"
            placeholder="ex: Capitalele Europei"
            value={title}
            onChange={(event) => onTitleChange(event.target.value)}
            className="w-full bg-transparent text-lg font-medium mt-1"
            style={{ color: theme.text, outline: 'none', border: 'none' }}
          />
        </Panel>
      </motion.div>

      <motion.div
        animate={shakeFields.includes('desc') ? { x: [0, -10, 10, -8, 8, -4, 0] } : { x: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Panel theme={theme} style={{ border: shakeFields.includes('desc') ? `1px solid ${theme.danger}` : undefined }}>
          <Label theme={theme}>Descriere *</Label>
          <textarea
            placeholder="Descrie pe scurt conținutul grilei..."
            value={description}
            onChange={(event) => onDescriptionChange(event.target.value)}
            rows={3}
            className="w-full bg-transparent resize-none text-sm mt-1"
            style={{ color: theme.text, outline: 'none', border: 'none' }}
          />
        </Panel>
      </motion.div>

      <Panel theme={theme}>
        <Label theme={theme}>Categorie</Label>
        <div className="flex flex-wrap gap-2 mt-2">
          {CATEGORIES.map((item) => (
            <button
              key={item}
              onClick={() => onCategoryChange(item)}
              className="px-3 py-1.5 rounded-full text-sm transition-all"
              style={{
                background: category === item ? `${theme.accent}20` : theme.surface2,
                border: `1px solid ${category === item ? `${theme.accent}40` : theme.border}`,
                color: category === item ? theme.accent : theme.text2,
              }}
            >
              {item}
            </button>
          ))}
        </div>
      </Panel>

      <Panel theme={theme}>
        <Label theme={theme}>Folder tinta</Label>
        <FolderTargetPicker
          folders={folders}
          value={selectedFolderId}
          theme={theme}
          onChange={onFolderChange}
        />
      </Panel>

      <Panel theme={theme}>
        <Label theme={theme}>Etichete opționale</Label>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium"
              style={{ background: `${theme.accent}18`, color: theme.accent, border: `1px solid ${theme.accent}30` }}
            >
              {tag}
              <button onClick={() => onRemoveTag(tag)}>
                <X size={10} />
              </button>
            </span>
          ))}
          <div
            className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs"
            style={{ background: theme.surface2, border: `1px solid ${theme.border}` }}
          >
            <Tag size={10} style={{ color: theme.text3 }} />
            <input
              type="text"
              placeholder="Adaugă etichetă..."
              value={tagInput}
              onChange={(event) => onTagInputChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ',') {
                  event.preventDefault();
                  onAddTag();
                }
              }}
              className="bg-transparent outline-none w-28"
              style={{ color: theme.text, border: 'none' }}
            />
          </div>
        </div>
      </Panel>

      <Panel theme={theme}>
        <Label theme={theme}>Opțiuni grilă</Label>
        <div className="flex gap-2 mt-2 flex-wrap">
          <Toggle
            value={shuffleQuestions}
            onChange={onShuffleQuestionsToggle}
            theme={theme}
            label="Amestecă întrebările"
          />
          <Toggle
            value={shuffleAnswers}
            onChange={onShuffleAnswersToggle}
            theme={theme}
            label="Amestecă răspunsurile"
          />
        </div>
        <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${theme.border}` }}>
          <div className="text-xs mb-2" style={{ color: theme.text3 }}>Notare medicală</div>
          <button
            onClick={onPenaltyModeToggle}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm transition-all"
            style={{
              background: penaltyMode ? 'rgba(239,68,68,0.12)' : theme.surface2,
              border: `1px solid ${penaltyMode ? 'rgba(239,68,68,0.4)' : theme.border}`,
              color: penaltyMode ? '#ef4444' : theme.text3,
            }}
          >
            <Scale size={13} />
            Mod Rezidențiat
            {penaltyMode && (
              <span
                className="text-xs px-1.5 py-0.5 rounded-full font-bold"
                style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}
              >
                -0.25/greșit
              </span>
            )}
          </button>
          {penaltyMode && (
            <p className="text-xs mt-1.5" style={{ color: theme.text3 }}>
              Răspuns corect: +1 punct. Opțiune greșită selectată: -0.25 puncte. Scorul net nu poate coborî sub 0.
            </p>
          )}
        </div>
      </Panel>

      <motion.button
        onClick={onContinue}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.98 }}
        className="w-full py-3.5 rounded-2xl font-semibold text-white"
        style={{
          background: `linear-gradient(135deg, ${theme.accent} 0%, ${theme.accent2} 100%)`,
          opacity: canProceed ? 1 : 0.6,
        }}
      >
        Continuă și adaugă întrebări
      </motion.button>
    </motion.div>
  );
}

interface QuizAIGenerationPanelProps {
  aiCount: number;
  aiDifficulty: number;
  aiError: string;
  aiLoading: boolean;
  aiMode: 'standard' | 'clinical';
  aiProgress: { generated: number; total: number } | null;
  aiText: string;
  hasKey: boolean;
  theme: Theme;
  visible: boolean;
  onCountChange: (count: number) => void;
  onDifficultyChange: (d: number) => void;
  onGenerate: () => void;
  onImportPdf: () => void;
  onModeChange: (mode: 'standard' | 'clinical') => void;
  onTextChange: (value: string) => void;
}

export function QuizAIGenerationPanel({
  aiCount,
  aiDifficulty,
  aiError,
  aiLoading,
  aiMode,
  aiProgress,
  aiText,
  hasKey,
  theme,
  visible,
  onCountChange,
  onDifficultyChange,
  onGenerate,
  onImportPdf,
  onModeChange,
  onTextChange,
}: QuizAIGenerationPanelProps) {
  return (
    <AnimatePresence mode="wait">
      {visible && (
        <motion.div
          key="ai-panel"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="mb-4 rounded-2xl p-5 space-y-4"
          style={{ background: theme.surface, border: `1px solid ${theme.border}` }}
        >
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})` }}
            >
              <Bot size={15} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: theme.text }}>Generator AI de grile</p>
              <p className="text-xs" style={{ color: theme.text3 }}>
                Lipește text medical, iar AI-ul generează întrebări structurate.
              </p>
            </div>
          </div>

          {!hasKey && (
            <div
              className="flex items-center gap-2 p-3 rounded-xl text-sm"
              style={{ background: `${theme.warning}12`, border: `1px solid ${theme.warning}30`, color: theme.warning }}
            >
              Configurează cheia Groq API din Sidebar, apoi deschide setările AI.
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium" style={{ color: theme.text2 }}>
                Text sursă
              </label>
              {window.electronAPI?.openPdfFile && (
                <button
                  onClick={onImportPdf}
                  className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg"
                  style={{ background: theme.surface2, color: theme.accent, border: `1px solid ${theme.accent}30` }}
                >
                  <FileText size={11} />
                  Import PDF
                </button>
              )}
            </div>
            <textarea
              value={aiText}
              onChange={(event) => onTextChange(event.target.value)}
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

          {/* Mode: Grile standard / Cazuri clinice */}
          <div>
            <label className="text-xs font-medium mb-2 block" style={{ color: theme.text2 }}>
              Tip întrebări
            </label>
            <div className="flex gap-2">
              {([
                { id: 'standard', label: 'Grile standard', icon: '📋' },
                { id: 'clinical', label: 'Cazuri clinice', icon: '🩺' },
              ] as const).map((m) => (
                <button
                  key={m.id}
                  onClick={() => onModeChange(m.id)}
                  className="flex-1 py-2 px-3 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-1.5"
                  style={{
                    background: aiMode === m.id ? `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})` : theme.surface2,
                    color: aiMode === m.id ? '#fff' : theme.text3,
                    border: `1px solid ${aiMode === m.id ? `${theme.accent}50` : 'transparent'}`,
                  }}
                >
                  <span>{m.icon}</span>{m.label}
                </button>
              ))}
            </div>
            {aiMode === 'clinical' && (
              <p className="text-xs mt-1.5 px-1" style={{ color: theme.text3 }}>
                Cazurile clinice includ istoricul pacientului + întrebarea diagnostică.
              </p>
            )}
          </div>

          {/* Difficulty */}
          {aiMode === 'standard' && (
            <div>
              <label className="text-xs font-medium mb-2 block" style={{ color: theme.text2 }}>
                Dificultate
              </label>
              <div className="flex gap-2">
                {([
                  { level: 1, label: 'Ușor' },
                  { level: 2, label: 'Mediu' },
                  { level: 3, label: 'Dificil' },
                  { level: 4, label: 'Expert' },
                ]).map((d) => (
                  <button
                    key={d.level}
                    onClick={() => onDifficultyChange(d.level)}
                    className="flex-1 py-2 rounded-xl text-xs font-semibold transition-all"
                    style={{
                      background: aiDifficulty === d.level ? `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})` : theme.surface2,
                      color: aiDifficulty === d.level ? '#fff' : theme.text3,
                      border: `1px solid ${aiDifficulty === d.level ? `${theme.accent}50` : 'transparent'}`,
                    }}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-medium mb-2 block" style={{ color: theme.text2 }}>
              Număr de {aiMode === 'clinical' ? 'cazuri' : 'întrebări'}
            </label>
            <div className="flex gap-2">
              {(aiMode === 'clinical' ? [3, 5, 10, 15] : [10, 25, 50, 100]).map((count) => (
                <button
                  key={count}
                  onClick={() => onCountChange(count)}
                  className="flex-1 py-2 rounded-xl text-sm font-semibold transition-all"
                  style={{
                    background: aiCount === count ? `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})` : theme.surface2,
                    color: aiCount === count ? '#fff' : theme.text3,
                    border: `1px solid ${aiCount === count ? `${theme.accent}50` : 'transparent'}`,
                  }}
                >
                  {count}
                </button>
              ))}
            </div>
          </div>

          {/* Progress bar */}
          {aiLoading && aiProgress && aiProgress.total > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium" style={{ color: theme.text3 }}>
                  Generez...
                </span>
                <span className="text-xs font-semibold tabular-nums" style={{ color: theme.accent }}>
                  {aiProgress.generated}/{aiProgress.total}
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: theme.surface2 }}>
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: `linear-gradient(90deg, ${theme.accent}, ${theme.accent2})` }}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.round((aiProgress.generated / aiProgress.total) * 100)}%` }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                />
              </div>
            </div>
          )}

          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={onGenerate}
            disabled={aiLoading || !hasKey || !aiText.trim()}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold"
            style={{
              background: aiLoading || !hasKey || !aiText.trim()
                ? theme.surface2
                : `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})`,
              color: aiLoading || !hasKey || !aiText.trim() ? theme.text3 : 'white',
            }}
          >
            {aiLoading ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Generez...
              </>
            ) : (
              <>
                <Sparkles size={14} />
                Generează {aiCount} {aiMode === 'clinical' ? 'cazuri clinice' : 'grile'}
              </>
            )}
          </motion.button>

          {aiError && (
            <div
              className="p-3 rounded-xl text-sm"
              style={{ background: `${theme.danger}12`, border: `1px solid ${theme.danger}30`, color: theme.danger }}
            >
              {aiError}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface QuizQuestionEditorProps {
  activeQ: number;
  canRemoveQuestion: boolean;
  currentQ: Question;
  theme: Theme;
  onAddOption: () => void;
  onImageUpload: () => void;
  onOptionRemove: (optionId: string) => void;
  onOptionTextChange: (optionId: string, value: string) => void;
  onPreview: () => void;
  onQuestionRemove: () => void;
  onQuestionTextChange: (value: string) => void;
  onRemoveImage: () => void;
  onSetDifficulty: (difficulty: Question['difficulty']) => void;
  onToggleCorrect: (optionId: string) => void;
  onToggleMultiple: () => void;
  onExplanationChange: (value: string) => void;
}

export function QuizQuestionEditor({
  activeQ,
  canRemoveQuestion,
  currentQ,
  theme,
  onAddOption,
  onExplanationChange,
  onImageUpload,
  onOptionRemove,
  onOptionTextChange,
  onPreview,
  onQuestionRemove,
  onQuestionTextChange,
  onRemoveImage,
  onSetDifficulty,
  onToggleCorrect,
  onToggleMultiple,
}: QuizQuestionEditorProps) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={currentQ.id}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.2 }}
        className="space-y-4 pb-2"
      >
        <Panel theme={theme}>
          <div className="flex items-center justify-between mb-2">
            <Label theme={theme}>Întrebarea {activeQ + 1}</Label>
            <div className="flex items-center gap-2">
              <button
                onClick={onPreview}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-all hover:opacity-80"
                style={{ background: theme.surface2, color: theme.text3 }}
              >
                <Eye size={11} />
                Previzualizare
              </button>
              <button
                onClick={onToggleMultiple}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-all"
                style={{
                  background: currentQ.multipleCorrect ? `${theme.accent2}20` : theme.surface2,
                  color: currentQ.multipleCorrect ? theme.accent2 : theme.text3,
                  border: `1px solid ${currentQ.multipleCorrect ? `${theme.accent2}40` : 'transparent'}`,
                }}
              >
                <Layers size={11} />
                Multi
              </button>
              {canRemoveQuestion && (
                <button
                  onClick={onQuestionRemove}
                  className="p-1 rounded-lg transition-all hover:opacity-80"
                  style={{ color: theme.danger }}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>
          <textarea
            placeholder="Scrie întrebarea ta..."
            value={currentQ.text}
            onChange={(event) => onQuestionTextChange(event.target.value)}
            rows={3}
            className="w-full bg-transparent resize-none font-medium"
            style={{ color: theme.text, outline: 'none', border: 'none' }}
          />

          {currentQ.imageUrl ? (
            <div className="relative mt-3 rounded-xl overflow-hidden" style={{ border: `1px solid ${theme.border}` }}>
              <img
                src={currentQ.imageUrl}
                alt="Question"
                className="block w-full max-h-72 object-contain"
                style={{ background: theme.isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.035)' }}
              />
              <button
                onClick={onRemoveImage}
                className="absolute top-2 right-2 p-1.5 rounded-lg"
                style={{ background: 'rgba(0,0,0,0.55)', color: '#fff' }}
              >
                <X size={13} />
              </button>
            </div>
          ) : (
            <button
              onClick={onImageUpload}
              className="mt-3 flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-all hover:opacity-80"
              style={{ background: theme.surface2, color: theme.text3, border: `1px dashed ${theme.border2}` }}
            >
              <ImagePlus size={14} />
              Adaugă imagine opțională
            </button>
          )}

          <div className="flex gap-2 mt-3 pt-3" style={{ borderTop: `1px solid ${theme.border}` }}>
            {DIFFICULTIES.map((difficulty) => (
              <button
                key={difficulty.id}
                onClick={() => onSetDifficulty(difficulty.id)}
                className="flex-1 py-1 rounded-lg text-xs font-medium transition-all"
                style={{
                  background: currentQ.difficulty === difficulty.id ? `${difficulty.color}20` : theme.surface2,
                  color: currentQ.difficulty === difficulty.id ? difficulty.color : theme.text3,
                  border: `1px solid ${currentQ.difficulty === difficulty.id ? `${difficulty.color}40` : 'transparent'}`,
                }}
              >
                {difficulty.label}
              </button>
            ))}
          </div>
        </Panel>

        <div className="space-y-2">
          <p className="text-xs px-1" style={{ color: theme.text3 }}>
            <Sparkles size={11} className="inline mr-1" />
            {currentQ.multipleCorrect
              ? 'Apasă pe cerc pentru a marca toate răspunsurile corecte.'
              : 'Apasă pe cerc pentru a marca răspunsul corect.'}
          </p>
          {currentQ.options.map((option, index) => (
            <motion.div
              key={option.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="flex items-center gap-3 p-4 rounded-2xl transition-all group"
              style={{
                background: option.isCorrect ? `${theme.success}10` : theme.surface,
                border: `1px solid ${option.isCorrect ? `${theme.success}30` : theme.border}`,
              }}
            >
              <button
                onClick={() => onToggleCorrect(option.id)}
                className="flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all"
                style={{
                  borderColor: option.isCorrect ? theme.success : theme.border2,
                  background: option.isCorrect ? theme.success : 'transparent',
                }}
              >
                {option.isCorrect && <Check size={12} className="text-white" />}
              </button>
              <span className="text-xs font-bold" style={{ color: theme.text3, minWidth: 16 }}>
                {option.id.toUpperCase()}
              </span>
              <input
                type="text"
                placeholder={`Opțiunea ${option.id.toUpperCase()}...`}
                value={option.text}
                onChange={(event) => onOptionTextChange(option.id, event.target.value)}
                className="flex-1 bg-transparent text-sm"
                style={{ color: theme.text, outline: 'none', border: 'none' }}
              />
              {currentQ.options.length > 2 && (
                <button
                  onClick={() => onOptionRemove(option.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded-lg transition-all"
                  style={{ color: theme.danger }}
                >
                  <X size={13} />
                </button>
              )}
            </motion.div>
          ))}

          {currentQ.options.length < OPTION_IDS.length && (
            <button
              onClick={onAddOption}
              className="w-full py-2.5 rounded-2xl text-sm transition-all hover:opacity-80 flex items-center justify-center gap-1.5"
              style={{ background: theme.surface2, border: `1px dashed ${theme.border2}`, color: theme.text3 }}
            >
              <Plus size={13} />
              Adaugă opțiune
            </button>
          )}
        </div>

        <Panel theme={theme}>
          <Label theme={theme}>Explicație opțională</Label>
          <input
            type="text"
            placeholder="Explică de ce răspunsul este corect..."
            value={currentQ.explanation || ''}
            onChange={(event) => onExplanationChange(event.target.value)}
            className="w-full bg-transparent text-sm mt-1"
            style={{ color: theme.text, outline: 'none', border: 'none' }}
          />
        </Panel>
      </motion.div>
    </AnimatePresence>
  );
}

interface QuestionPreviewModalProps {
  previewQ: Question | null;
  theme: Theme;
  onClose: () => void;
}

export function QuestionPreviewModal({ previewQ, theme, onClose }: QuestionPreviewModalProps) {
  return (
    <AnimatePresence>
      {previewQ && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50"
            style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed top-[8%] left-1/2 z-50 w-full max-w-xl -translate-x-1/2 px-4"
          >
            <div
              className="rounded-3xl p-6 shadow-2xl"
              style={{
                background: theme.isDark ? 'rgba(22,22,26,0.98)' : 'rgba(255,255,255,0.98)',
                border: `1px solid ${theme.border}`,
              }}
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: theme.accent }}>
                  Previzualizare
                </span>
                <button onClick={onClose} style={{ color: theme.text3 }}>
                  <X size={16} />
                </button>
              </div>
              <p className="text-lg font-semibold mb-4 leading-relaxed" style={{ color: theme.text }}>
                {previewQ.text || '(fără text)'}
              </p>
              {previewQ.imageUrl && (
                <div className="mb-4 overflow-hidden rounded-2xl" style={{ border: `1px solid ${theme.border}`, background: theme.surface2 }}>
                  <img
                    src={previewQ.imageUrl}
                    alt=""
                    className="block w-full max-h-[360px] object-contain"
                  />
                </div>
              )}
              <div className="space-y-2">
                {previewQ.options.map((option, index) => (
                  <div
                    key={option.id}
                    className="flex items-center gap-3 p-3 rounded-xl"
                    style={{
                      background: option.isCorrect ? `${theme.success}14` : theme.surface2,
                      border: `1px solid ${option.isCorrect ? `${theme.success}40` : theme.border}`,
                    }}
                  >
                    <span
                      className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                      style={{
                        background: option.isCorrect ? `${theme.success}20` : theme.surface,
                        color: option.isCorrect ? theme.success : theme.text3,
                      }}
                    >
                      {String.fromCharCode(65 + index)}
                    </span>
                    <span className="text-sm" style={{ color: option.isCorrect ? theme.success : theme.text2 }}>
                      {option.text || '(fără text)'}
                    </span>
                    {option.isCorrect && <Check size={14} className="ml-auto flex-shrink-0" style={{ color: theme.success }} />}
                  </div>
                ))}
              </div>
              {previewQ.explanation && (
                <div className="mt-4 p-3 rounded-xl" style={{ background: `${theme.accent}0C`, border: `1px solid ${theme.accent}20` }}>
                  <p className="text-xs" style={{ color: theme.text2 }}>
                    <span className="font-semibold" style={{ color: theme.accent }}>Explicație: </span>
                    {previewQ.explanation}
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
