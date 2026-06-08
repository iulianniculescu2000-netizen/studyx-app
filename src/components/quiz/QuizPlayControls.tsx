import { motion } from 'framer-motion';
import { ChevronRight, Zap, GraduationCap, StickyNote, MessageSquare } from 'lucide-react';

interface QuizPlayControlsProps {
  revealed: boolean;
  isMultiple: boolean;
  isLast: boolean;
  selectedNow: string[];
  examMode: boolean;
  calmMotion: boolean;
  theme: any;
  onNext: () => void;
  onConfirmMultiple: () => void;
  onGetHint: () => void;
  onToggleNote: () => void;
  onOpenStudyChat: () => void;
  hasKey: boolean;
  currentNote: string;
}

export function QuizPlayControls({
  revealed,
  isMultiple,
  isLast,
  selectedNow,
  examMode,
  calmMotion,
  theme,
  onNext,
  onConfirmMultiple,
  onGetHint,
  onToggleNote,
  onOpenStudyChat,
  hasKey,
  currentNote
}: QuizPlayControlsProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: calmMotion ? 0.3 : 0.5, delay: 0.2 }}
      className="flex flex-col gap-3 max-w-2xl mx-auto w-full"
    >
      {/* Action buttons */}
      <div className="flex items-center gap-3">
        {isMultiple && !revealed && (
          <button
            onClick={onConfirmMultiple}
            disabled={selectedNow.length === 0}
            className="flex-1 py-3 px-6 rounded-2xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: selectedNow.length > 0 ? theme.accent : theme.border,
              color: selectedNow.length > 0 ? 'white' : theme.text3
            }}
          >
            Confirm\u0103 ({selectedNow.length} selectate)
          </button>
        )}

        {revealed && !isLast && (
          <button
            onClick={onNext}
            className="flex-1 py-3 px-6 rounded-2xl font-semibold transition-all flex items-center justify-center gap-2"
            style={{ background: theme.accent, color: 'white' }}
          >
            Urm\u0103toarea
            <ChevronRight size={18} />
          </button>
        )}

        {revealed && isLast && (
          <button
            onClick={onNext}
            className="flex-1 py-3 px-6 rounded-2xl font-semibold transition-all"
            style={{ background: theme.success, color: 'white' }}
          >
            Finalizeaz\u0103 Quiz
          </button>
        )}
      </div>

      {/* Helper buttons */}
      <div className="flex items-center gap-2 justify-center">
        {!examMode && (
          <>
            <button
              onClick={onGetHint}
              disabled={!hasKey}
              className="p-2.5 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm"
              style={{
                background: theme.surface,
                border: `1px solid ${theme.border}`,
                color: hasKey ? theme.accent : theme.text3
              }}
              title="Solicit\u0103 indiciu AI"
            >
              <Zap size={16} />
              Indiciu
            </button>

            <button
              onClick={onToggleNote}
              className="p-2.5 rounded-xl transition-all flex items-center gap-2 text-sm relative"
              style={{
                background: currentNote ? theme.accent2 + '20' : theme.surface,
                border: `1px solid ${currentNote ? theme.accent2 : theme.border}`,
                color: currentNote ? theme.accent2 : theme.text3
              }}
              title="Note personale"
            >
              <StickyNote size={16} />
              Note
              {currentNote && (
                <div className="absolute -top-1 -right-1 w-2 h-2 rounded-full" style={{ background: theme.accent2 }} />
              )}
            </button>

            <button
              onClick={onOpenStudyChat}
              className="p-2.5 rounded-xl transition-all flex items-center gap-2 text-sm"
              style={{
                background: theme.surface,
                border: `1px solid ${theme.border}`,
                color: theme.text3
              }}
              title="Discut\u0103 cu AI"
            >
              <MessageSquare size={16} />
              AI Chat
            </button>
          </>
        )}
      </div>
    </motion.div>
  );
}
