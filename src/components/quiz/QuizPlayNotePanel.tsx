import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import { StickyNote, X } from 'lucide-react';

interface QuizPlayNotePanelProps {
  question: any;
  currentNote: string;
  isOpen: boolean;
  theme: any;
  calmMotion: boolean;
  onClose: () => void;
  onSave: (note: string) => void;
}

export function QuizPlayNotePanel({
  question,
  currentNote,
  isOpen,
  theme,
  calmMotion,
  onClose,
  onSave
}: QuizPlayNotePanelProps) {
  const [noteText, setNoteText] = useState(currentNote);

  useEffect(() => {
    setNoteText(currentNote);
  }, [currentNote]);

  const handleSave = () => {
    onSave(noteText);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ duration: calmMotion ? 0.2 : 0.3 }}
        className="max-w-2xl mx-auto w-full"
      >
        <div className="rounded-2xl p-4 border"
          style={{ background: theme.surface, borderColor: theme.border }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2" style={{ color: theme.accent2 }}>
              <StickyNote size={16} />
              <span className="font-medium text-sm">Note pentru întrebare</span>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg transition-all hover:bg-gray-100 dark:hover:bg-gray-800"
              style={{ color: theme.text3 }}
            >
              <X size={16} />
            </button>
          </div>
          
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            onBlur={handleSave}
            placeholder="Adaug\u0103 note personale despre aceast\u0103 întrebare..."
            className="w-full p-3 rounded-lg resize-none text-sm"
            style={{
              background: theme.background,
              border: `1px solid ${theme.border}`,
              color: theme.text,
              minHeight: '80px'
            }}
            rows={4}
          />
          
          <div className="flex justify-end mt-2">
            <button
              onClick={handleSave}
              className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
              style={{ background: theme.accent2, color: 'white' }}
            >
              Salvat automat
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
