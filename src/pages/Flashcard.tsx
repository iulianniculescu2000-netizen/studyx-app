import { motion, AnimatePresence } from 'framer-motion';
import { useState, useMemo, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, RotateCcw, Shuffle, Check, X, Plus, Image as ImageIcon } from 'lucide-react';
import { useQuizStore } from '../store/quizStore';
import { useTheme } from '../theme/ThemeContext';
import { HERO_COLOR_MAP } from '../theme/colorMaps';
import type { Question } from '../types';

function generateId() { return crypto.randomUUID().replace(/-/g, '').slice(0, 12); }

function shuffleArr<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Create Flashcard Modal ─────────────────────────────────────────────────────
function CreateCardModal({ onClose, onAdd }: { onClose: () => void; onAdd: (q: Question) => void }) {
  const theme = useTheme();
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [imageUrl, setImageUrl] = useState<string | undefined>();
  const fileRef = useRef<HTMLInputElement>(null);

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxW = 900;
        const scale = img.width > maxW ? maxW / img.width : 1;
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
        setImageUrl(canvas.toDataURL('image/jpeg', 0.78));
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleAdd = () => {
    if (!front.trim() || !back.trim()) return;
    const q: Question = {
      id: generateId(),
      text: front.trim(),
      imageUrl: imageUrl,
      options: [{ id: generateId(), text: back.trim(), isCorrect: true }],
      explanation: '',
      multipleCorrect: false,
      difficulty: 'medium',
      tags: [],
    };
    onAdd(q);
    onClose();
  };

  const canAdd = front.trim().length > 0 && back.trim().length > 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.58)', backdropFilter: 'blur(8px)',
      }}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: theme.modalBg,
          borderRadius: 24,
          padding: '28px 28px 24px',
          maxWidth: 460,
          width: '92%',
          border: `1px solid ${theme.border}`,
          boxShadow: '0 36px 100px rgba(0,0,0,0.45)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: theme.text }}>Flashcard nou</h3>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: theme.text3 }}>Adaugă un card personalizat în deck</p>
          </div>
          <button
            onClick={onClose}
            style={{ color: theme.text3, background: theme.surface2, border: 'none', cursor: 'pointer', padding: 8, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={16} />
          </button>
        </div>

        {/* Front (Question) */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: theme.text3, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 7 }}>
            Față · Întrebare
          </label>
          <textarea
            autoFocus
            rows={3}
            value={front}
            onChange={(e) => setFront(e.target.value)}
            placeholder="Scrie întrebarea sau termenul..."
            style={{
              width: '100%', background: theme.inputBg,
              border: `1.5px solid ${front.length > 0 ? theme.accent + '60' : theme.border}`,
              borderRadius: 14, padding: '12px 14px', color: theme.text,
              fontSize: 14, outline: 'none', resize: 'vertical',
              fontFamily: 'inherit', boxSizing: 'border-box',
              transition: 'border-color 0.2s',
            }}
          />
        </div>

        {/* Image upload */}
        <div style={{ marginBottom: 14 }}>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImage} />
          {imageUrl ? (
            <div style={{ position: 'relative', borderRadius: 14, overflow: 'hidden', border: `1px solid ${theme.border}` }}>
              <img src={imageUrl} alt="" style={{ width: '100%', maxHeight: 180, objectFit: 'contain', display: 'block', background: theme.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' }} />
              <button
                onClick={() => setImageUrl(undefined)}
                style={{ position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: '50%', background: 'rgba(0,0,0,0.65)', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={13} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                padding: '11px 14px', borderRadius: 14,
                border: `1.5px dashed ${theme.border2}`, background: 'transparent',
                color: theme.text3, fontSize: 13, cursor: 'pointer',
                justifyContent: 'center', transition: 'border-color 0.2s, color 0.2s',
                fontFamily: 'inherit',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = theme.accent + '70'; (e.currentTarget as HTMLElement).style.color = theme.accent; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = theme.border2; (e.currentTarget as HTMLElement).style.color = theme.text3; }}>
              <ImageIcon size={15} />Adaugă imagine (opțional)
            </button>
          )}
        </div>

        {/* Back (Answer) */}
        <div style={{ marginBottom: 22 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: theme.text3, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 7 }}>
            Spate · Răspuns
          </label>
          <textarea
            rows={3}
            value={back}
            onChange={(e) => setBack(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && e.ctrlKey) handleAdd(); }}
            placeholder="Scrie răspunsul sau definiția..."
            style={{
              width: '100%', background: theme.inputBg,
              border: `1.5px solid ${back.length > 0 ? theme.success + '60' : theme.border}`,
              borderRadius: 14, padding: '12px 14px', color: theme.text,
              fontSize: 14, outline: 'none', resize: 'vertical',
              fontFamily: 'inherit', boxSizing: 'border-box',
              transition: 'border-color 0.2s',
            }}
          />
          <p style={{ fontSize: 11, color: theme.text3, marginTop: 5 }}>Ctrl+Enter pentru a salva rapid</p>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={onClose}
            style={{ flex: 1, padding: '13px', borderRadius: 14, border: `1px solid ${theme.border}`, background: 'transparent', color: theme.text2, cursor: 'pointer', fontSize: 14, fontWeight: 600, fontFamily: 'inherit' }}>
            Anulează
          </button>
          <motion.button
            onClick={handleAdd}
            disabled={!canAdd}
            whileHover={canAdd ? { scale: 1.02 } : {}}
            whileTap={canAdd ? { scale: 0.97 } : {}}
            style={{
              flex: 2, padding: '13px', borderRadius: 14,
              background: canAdd ? `linear-gradient(135deg, ${theme.accent} 0%, ${theme.accent2} 100%)` : theme.surface2,
              color: canAdd ? '#fff' : theme.text3,
              border: 'none', cursor: canAdd ? 'pointer' : 'not-allowed',
              fontSize: 14, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              fontFamily: 'inherit',
              boxShadow: canAdd ? `0 8px 24px ${theme.accent}35` : 'none',
            }}>
            <Plus size={16} />Adaugă flashcard
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Main Flashcard Component ───────────────────────────────────────────────────
export default function Flashcard() {
  const { id } = useParams<{ id: string }>();
  const { quizzes, updateQuiz } = useQuizStore();
  const theme = useTheme();
  const quiz = quizzes.find(q => q.id === id);

  const [isShuffled, setIsShuffled] = useState(false);
  const [seed, setSeed] = useState(0);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const cards = useMemo(() => {
    const qs = quiz?.questions ?? [];
    return isShuffled ? shuffleArr(qs) : qs;
  }, [quiz, isShuffled, seed]);

  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState<Set<string>>(new Set());
  const [unknown, setUnknown] = useState<Set<string>>(new Set());

  const card = cards[idx];
  const colors = HERO_COLOR_MAP[quiz?.color ?? 'blue'] ?? HERO_COLOR_MAP.blue;
  const correctAnswers = card?.options.filter(o => o.isCorrect).map(o => o.text) ?? [];

  const goNext = useCallback(() => {
    setFlipped(false);
    setIdx(i => Math.min(i + 1, cards.length - 1));
  }, [cards.length]);

  const goPrev = useCallback(() => {
    setFlipped(false);
    setIdx(i => Math.max(i - 1, 0));
  }, []);

  const markKnown = () => {
    setKnown(s => new Set([...s, card.id]));
    setUnknown(s => { const n = new Set(s); n.delete(card.id); return n; });
    goNext();
  };

  const markUnknown = () => {
    setUnknown(s => new Set([...s, card.id]));
    setKnown(s => { const n = new Set(s); n.delete(card.id); return n; });
    goNext();
  };

  const reset = () => {
    setIdx(0);
    setFlipped(false);
    setKnown(new Set());
    setUnknown(new Set());
    if (isShuffled) setSeed(s => s + 1);
  };

  const handleAddCard = (q: Question) => {
    if (!quiz) return;
    updateQuiz(quiz.id, { questions: [...quiz.questions, q] });
  };

  if (!quiz || !card) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p style={{ color: theme.text2 }}>Grila nu a fost găsită.</p>
      </div>
    );
  }

  const progress = ((idx + 1) / cards.length) * 100;
  const isLast = idx === cards.length - 1;

  return (
    <div className="h-full overflow-y-auto px-6 py-8">
      <div className="max-w-xl mx-auto">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <Link to={`/quiz/${quiz.id}`}
            className="flex items-center gap-1.5 text-sm hover:opacity-80 transition-all mb-3"
            style={{ color: theme.text3 }}>
            <ChevronLeft size={15} />{quiz.title}
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold" style={{ color: theme.text }}>Flashcarduri</h1>
              <p className="text-sm" style={{ color: theme.text3 }}>
                {idx + 1} / {cards.length} · {known.size} știute · {unknown.size} de revăzut
              </p>
            </div>
            <div className="flex items-center gap-2">
              {/* Add custom card button */}
              <button
                onClick={() => setShowCreateModal(true)}
                className="p-2 rounded-xl transition-all hover:opacity-80"
                title="Adaugă flashcard personalizat"
                style={{ background: `${theme.accent}18`, color: theme.accent, border: `1px solid ${theme.accent}30` }}>
                <Plus size={15} />
              </button>
              <button
                onClick={() => { setIsShuffled(!isShuffled); setSeed(s => s + 1); setIdx(0); setFlipped(false); }}
                className="p-2 rounded-xl transition-all hover:opacity-80"
                style={{ background: isShuffled ? `${theme.accent}20` : theme.surface, color: isShuffled ? theme.accent : theme.text3, border: `1px solid ${theme.border}` }}>
                <Shuffle size={15} />
              </button>
              <button onClick={reset}
                className="p-2 rounded-xl transition-all hover:opacity-80"
                style={{ background: theme.surface, color: theme.text3, border: `1px solid ${theme.border}` }}>
                <RotateCcw size={15} />
              </button>
            </div>
          </div>
        </motion.div>

        {/* Progress bar */}
        <div className="h-1.5 rounded-full mb-6 overflow-hidden" style={{ background: theme.surface2 }}>
          <motion.div className="h-full rounded-full" animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }} style={{ background: colors.gradient }} />
        </div>

        {/* Known / Unknown indicators */}
        <div className="flex gap-3 mb-4">
          <div className="flex items-center gap-1 text-xs" style={{ color: theme.success }}>
            <Check size={12} />{known.size} știute
          </div>
          <div className="flex items-center gap-1 text-xs" style={{ color: theme.danger }}>
            <X size={12} />{unknown.size} de revăzut
          </div>
          {card && known.has(card.id) && (
            <span className="text-xs px-2 py-0.5 rounded-full ml-auto"
              style={{ background: `${theme.success}18`, color: theme.success }}>✓ Știută</span>
          )}
          {card && unknown.has(card.id) && (
            <span className="text-xs px-2 py-0.5 rounded-full ml-auto"
              style={{ background: `${theme.danger}18`, color: theme.danger }}>✗ De revăzut</span>
          )}
        </div>

        {/* ── Card with proper 3D CSS flip ── */}
        <AnimatePresence mode="wait">
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -18 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="mb-6 select-none"
            style={{ perspective: '1400px', minHeight: 280 }}
          >
            <motion.div
              animate={{ rotateY: flipped ? 180 : 0 }}
              transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
              onClick={() => setFlipped(f => !f)}
              className="cursor-pointer relative rounded-3xl"
              style={{ transformStyle: 'preserve-3d', minHeight: 280 }}
            >
              {/* ── FRONT — Question ── */}
              <div
                className="absolute inset-0 rounded-3xl p-8 flex flex-col items-center justify-center text-center"
                style={{
                  backfaceVisibility: 'hidden',
                  WebkitBackfaceVisibility: 'hidden',
                  background: colors.gradient,
                  boxShadow: `0 20px 60px ${colors.glow}`,
                }}
              >
                <div className="text-xs font-semibold uppercase tracking-widest mb-4"
                  style={{ color: 'rgba(255,255,255,0.6)' }}>
                  Întrebare · apasă pentru a întoarce
                </div>
                {card.imageUrl && (
                  <img
                    src={card.imageUrl}
                    alt=""
                    className="object-contain rounded-xl mb-4"
                    style={{ maxHeight: 130, maxWidth: '100%' }}
                  />
                )}
                <p className="text-lg font-semibold text-white leading-relaxed">{card.text}</p>
                {card.difficulty && (
                  <span className="mt-4 text-xs px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(255,255,255,0.22)', color: 'white' }}>
                    {card.difficulty === 'easy' ? 'Ușor' : card.difficulty === 'medium' ? 'Mediu' : 'Dificil'}
                  </span>
                )}
              </div>

              {/* ── BACK — Answer ── */}
              <div
                className="absolute inset-0 rounded-3xl p-8 flex flex-col items-center justify-center text-center overflow-y-auto"
                style={{
                  backfaceVisibility: 'hidden',
                  WebkitBackfaceVisibility: 'hidden',
                  transform: 'rotateY(180deg) translateZ(1px)',
                  background: `linear-gradient(135deg, ${theme.surface} 0%, ${theme.surface2} 100%)`,
                  border: `1px solid ${theme.border}`,
                  boxShadow: `0 12px 40px rgba(0,0,0,0.12)`,
                }}
              >
                <div style={{ width: '100%', transform: 'translateZ(0)' }}>
                  <div className="text-xs font-semibold uppercase tracking-widest mb-5"
                    style={{ color: theme.text3 }}>
                    Răspuns · apasă pentru a întoarce
                  </div>
                  <div className="space-y-2.5 w-full">
                    {correctAnswers.map((ans, i) => (
                      <div key={i} className="flex items-center gap-2.5 px-4 py-3 rounded-xl"
                        style={{ background: `${theme.success}14`, border: `1px solid ${theme.success}30` }}>
                        <Check size={15} style={{ color: theme.success, flexShrink: 0 }} />
                        <p className="text-sm font-semibold text-left" style={{ color: theme.text }}>{ans}</p>
                      </div>
                    ))}
                  </div>
                  {card.explanation && (
                    <p className="text-xs mt-5 leading-relaxed px-2" style={{ color: theme.text3 }}>{card.explanation}</p>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex items-center gap-3">
          <button onClick={goPrev} disabled={idx === 0}
            className="p-3 rounded-2xl transition-all hover:opacity-80 disabled:opacity-30"
            style={{ background: theme.surface, border: `1px solid ${theme.border}`, color: theme.text2 }}>
            <ChevronLeft size={18} />
          </button>

          {flipped && (
            <>
              <button onClick={markUnknown}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-medium text-sm transition-all hover:opacity-80"
                style={{ background: `${theme.danger}15`, border: `1px solid ${theme.danger}30`, color: theme.danger }}>
                <X size={15} />Nu știu
              </button>
              <button onClick={markKnown}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-medium text-sm transition-all hover:opacity-80"
                style={{ background: `${theme.success}15`, border: `1px solid ${theme.success}30`, color: theme.success }}>
                <Check size={15} />Știu!
              </button>
            </>
          )}

          {!flipped && (
            <button onClick={() => setFlipped(true)}
              className="flex-1 py-3 rounded-2xl font-medium text-sm text-white transition-all hover:opacity-90"
              style={{ background: colors.gradient, boxShadow: `0 8px 24px ${colors.glow}` }}>
              Întoarce cardul
            </button>
          )}

          <button onClick={isLast ? reset : goNext} disabled={!flipped && !isLast}
            className="p-3 rounded-2xl transition-all hover:opacity-80 disabled:opacity-30"
            style={{ background: theme.surface, border: `1px solid ${theme.border}`, color: theme.text2 }}>
            {isLast ? <RotateCcw size={18} /> : <ChevronRight size={18} />}
          </button>
        </div>

        {/* Summary after last card */}
        {isLast && flipped && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="mt-6 rounded-2xl p-5 text-center"
            style={{ background: theme.surface, border: `1px solid ${theme.border}` }}>
            <p className="text-2xl mb-2">🎉</p>
            <p className="font-semibold mb-1" style={{ color: theme.text }}>Ai terminat setul!</p>
            <p className="text-sm" style={{ color: theme.text3 }}>
              {known.size} știute · {unknown.size} de revăzut · {cards.length - known.size - unknown.size} nemarcate
            </p>
            <button onClick={reset} className="mt-4 px-4 py-2 rounded-xl text-sm font-medium text-white transition-all hover:opacity-90"
              style={{ background: colors.gradient }}>
              Reia
            </button>
          </motion.div>
        )}
      </div>

      {/* Create card modal */}
      <AnimatePresence>
        {showCreateModal && (
          <CreateCardModal
            onClose={() => setShowCreateModal(false)}
            onAdd={handleAddCard}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
