import { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, X, Check, AlertCircle, Loader2 } from 'lucide-react';
import { useTheme } from '../theme/ThemeContext';
import { useQuizStore } from '../store/quizStore';
import type { QuizImportData, Quiz, Question, Option } from '../types';


function generateId() { return crypto.randomUUID().replace(/-/g, '').slice(0, 12); }

// ── Strict schema validation ──────────────────────────────────────────────────
function validateQuizSchema(data: unknown): data is QuizImportData {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  if (typeof d.title !== 'string' || !d.title.trim()) return false;
  if (!Array.isArray(d.questions) || d.questions.length === 0) return false;
  for (const q of d.questions as unknown[]) {
    if (!q || typeof q !== 'object') return false;
    const qo = q as Record<string, unknown>;
    if (typeof qo.text !== 'string' || !qo.text.trim()) return false;
    if (!Array.isArray(qo.options) || qo.options.length < 2) return false;
    const hasCorrect = (qo.options as unknown[]).some(
      (o) => o && typeof o === 'object' && (o as Record<string, unknown>).isCorrect === true
    );
    if (!hasCorrect) return false;
  }
  return true;
}

function parseImport(data: QuizImportData, folderId?: string | null): Quiz {
  const questions: Question[] = data.questions.map((q) => ({
    id: generateId(),
    text: q.text,
    multipleCorrect: q.multipleCorrect ?? false,
    explanation: q.explanation,
    difficulty: q.difficulty,
    tags: q.tags,
    options: q.options.map((o, i) => ({
      id: String.fromCharCode(97 + i),
      text: o.text,
      isCorrect: o.isCorrect,
    } as Option)),
  }));

  return {
    id: generateId(),
    title: data.title,
    description: data.description ?? '',
    emoji: data.emoji ?? '📋',
    category: data.category ?? 'Altele',
    color: data.color ?? 'blue',
    folderId: folderId !== undefined ? folderId : null,
    shuffleQuestions: data.shuffleQuestions ?? false,
    shuffleAnswers: data.shuffleAnswers ?? false,
    questions,
    createdAt: Date.now(),
  };
}

interface Props {
  targetFolderId?: string | null;
}

export default function ImportQuizButton({ targetFolderId }: Props) {
  const theme = useTheme();
  const { addQuiz } = useQuizStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const processContent = (content: string) => {
    let raw: unknown;
    try { raw = JSON.parse(content); } catch { throw new Error('Fișier JSON corupt sau invalid.'); }
    const items: unknown[] = Array.isArray(raw) ? raw : [raw];
    const valid = items.filter(validateQuizSchema);
    if (valid.length === 0) throw new Error('Schema invalidă: lipsesc câmpuri obligatorii (title, questions, options, isCorrect).');
    valid.forEach((item) => addQuiz(parseImport(item, targetFolderId)));
    return valid.length;
  };

  const showSuccess = (count: number) => {
    setStatus('success');
    setMessage(`${count} gril${count === 1 ? 'ă importată' : 'e importate'}!`);
    setTimeout(() => setStatus('idle'), 3000);
  };

  const showError = (msg: string) => {
    setStatus('error');
    setMessage(msg);
    setTimeout(() => setStatus('idle'), 3000);
  };

  const handleClick = async () => {
    if (status === 'loading') return;
    // Use Electron native dialog if available
    if (window.electronAPI?.isElectron) {
      setStatus('loading');
      const files = await (window.electronAPI as any).openJsonFiles();
      if (!files) { setStatus('idle'); return; }
      try {
        let total = 0;
        (files as { name: string; content: string }[]).forEach(f => { total += processContent(f.content); });
        showSuccess(total);
      } catch { showError('JSON invalid sau format necunoscut.'); }
    } else {
      inputRef.current?.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const count = processContent(ev.target?.result as string);
        showSuccess(count);
      } catch { showError('JSON invalid sau format necunoscut.'); }
    };
    reader.onerror = () => showError('Nu s-a putut citi fișierul. Încearcă din nou.');
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div>
      <input ref={inputRef} type="file" accept=".json" className="hidden" onChange={handleFileChange} />
      <motion.button onClick={handleClick}
        whileHover={{ scale: status === 'loading' ? 1 : 1.02 }}
        whileTap={{ scale: status === 'loading' ? 1 : 0.97 }}
        className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-medium transition-all"
        style={{ background: theme.surface2, border: `1px solid ${theme.border2}`, color: theme.text2, opacity: status === 'loading' ? 0.75 : 1 }}>
        <AnimatePresence mode="wait" initial={false}>
          {status === 'loading' ? (
            <motion.span key="spin" initial={{ opacity: 0, rotate: -90 }} animate={{ opacity: 1, rotate: 0 }} exit={{ opacity: 0 }} style={{ display: 'flex' }}>
              <motion.span animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }} style={{ display: 'flex' }}>
                <Loader2 size={15} />
              </motion.span>
            </motion.span>
          ) : (
            <motion.span key="up" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ display: 'flex' }}>
              <Upload size={15} />
            </motion.span>
          )}
        </AnimatePresence>
        {status === 'loading' ? 'Se importă...' : 'Import JSON'}
      </motion.button>

      <AnimatePresence>
        {status !== 'idle' && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-2xl text-sm font-medium shadow-xl"
            style={{
              background: status === 'success' ? `${theme.success}20` : `${theme.danger}20`,
              border: `1px solid ${status === 'success' ? theme.success : theme.danger}40`,
              color: status === 'success' ? theme.success : theme.danger,
            }}>
            {status === 'success' ? <Check size={15} /> : <AlertCircle size={15} />}
            {message}
            <button onClick={() => setStatus('idle')}><X size={13} /></button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
