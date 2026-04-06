import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, Sparkles, Zap } from 'lucide-react';
import type { AIAnalysisResult, HintResult } from '../../ai/types';
import type { Theme } from '../../theme/themes';

interface HintPanelProps {
  calmMotion: boolean;
  examMode: boolean;
  hasAI: boolean;
  hintLevel: number;
  hintData: HintResult | null;
  hintLoading: boolean;
  revealed: boolean;
  showSmartNudge: boolean;
  onGetHint: () => void;
  theme: Theme;
}

export function HintPanel({
  calmMotion,
  examMode,
  hasAI,
  hintLevel,
  hintData,
  hintLoading,
  revealed,
  showSmartNudge,
  onGetHint,
  theme,
}: HintPanelProps) {
  if (revealed || examMode || !hasAI) return null;

  return (
    <div className="mb-5">
      <AnimatePresence mode="wait">
        {hintLevel === 0 ? (
          <motion.button
            initial={{ opacity: 0, y: 5 }}
            animate={{
              opacity: 1,
              y: 0,
              scale: showSmartNudge && !calmMotion ? [1, 1.05, 1] : 1,
            }}
            transition={showSmartNudge && !calmMotion
              ? { scale: { repeat: Infinity, duration: 2, ease: 'easeInOut' } }
              : { duration: 0.18 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onClick={onGetHint}
            disabled={hintLoading}
            className="group relative flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all overflow-hidden"
            style={{
              background: theme.surface,
              border: `1px solid ${showSmartNudge ? theme.accent : theme.border}`,
              color: theme.accent,
              boxShadow: showSmartNudge ? `0 0 20px ${theme.accent}30` : `0 4px 12px ${theme.accent}10`,
            }}
            whileHover={calmMotion ? undefined : { scale: 1.02, boxShadow: `0 6px 20px ${theme.accent}30` }}
            whileTap={calmMotion ? undefined : { scale: 0.98 }}
          >
            {!calmMotion && (
              <motion.div
                className="absolute inset-0 z-0"
                animate={{ x: ['-100%', '200%'] }}
                transition={{ repeat: Infinity, duration: 3, ease: 'linear' }}
                style={{
                  background: `linear-gradient(90deg, transparent, ${theme.accent}15, transparent)`,
                  width: '50%',
                }}
              />
            )}

            <div className="relative z-10 flex items-center gap-2">
              {hintLoading ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Sparkles size={13} className={showSmartNudge ? 'animate-pulse' : ''} />
              )}
              <span>{hintLoading ? 'Analizez...' : 'Indiciu AI'}</span>
              <span className="ml-1 font-mono text-[9px] border border-current px-1 rounded" style={{ color: theme.text3 }}>H</span>
            </div>
          </motion.button>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="p-4 rounded-[24px] relative overflow-hidden glass-panel"
            style={{
              background: `${theme.accent}08`,
              border: `1px solid ${theme.accent}25`,
              boxShadow: `0 8px 32px ${theme.accent}10`,
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sparkles size={14} style={{ color: theme.accent }} />
                <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: theme.accent }}>
                  Indiciu AI • Nivel {hintLevel}/3
                </span>
              </div>
              {hintLevel < 3 && (
                <button
                  onClick={onGetHint}
                  className="text-[10px] font-bold px-2 py-1 rounded-lg transition-all hover:opacity-80"
                  style={{ background: `${theme.accent}15`, color: theme.accent }}
                >
                  + Mai mult
                </button>
              )}
            </div>
            <p className="text-sm font-medium leading-relaxed italic" style={{ color: theme.text }}>
              "{hintLevel === 1 ? hintData?.light : hintLevel === 2 ? hintData?.medium : hintData?.full}"
            </p>

            <div className="absolute -right-10 -top-10 w-32 h-32 rounded-full blur-[60px] opacity-20" style={{ background: theme.accent }} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface AIExplanationPanelProps {
  aiLoading: boolean;
  aiText: string | null;
  analysisResult: AIAnalysisResult | null;
  examMode: boolean;
  hasAI: boolean;
  nextTopicHint: string | null;
  revealed: boolean;
  onExplain: () => void;
  theme: Theme;
}

export function AIExplanationPanel({
  aiLoading,
  aiText,
  analysisResult,
  examMode,
  hasAI,
  nextTopicHint,
  revealed,
  onExplain,
  theme,
}: AIExplanationPanelProps) {
  if (!revealed || examMode || !hasAI) return null;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        initial={{ opacity: 0, y: 15, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
        className="mb-4"
      >
        {aiText === null ? (
          <button
            onClick={onExplain}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all hover:opacity-80"
            style={{
              background: `${theme.accent2}15`,
              border: `1px solid ${theme.accent2}30`,
              color: theme.accent2,
            }}
          >
            <Sparkles size={12} />
            Explică AI
          </button>
        ) : (
          <motion.div
            layout
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="p-5 rounded-3xl"
            style={{ background: `${theme.accent2}0C`, border: `1.5px solid ${theme.accent2}25` }}
          >
            <div className="flex items-center gap-2 mb-3">
              <Sparkles size={14} style={{ color: theme.accent2 }} />
              <span className="text-xs font-black uppercase tracking-widest" style={{ color: theme.accent2 }}>
                Explicație AI
              </span>
              {aiLoading && (
                <motion.div
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                  className="w-1.5 h-1.5 rounded-full ml-1"
                  style={{ background: theme.accent2 }}
                />
              )}
            </div>
            <p className="text-sm leading-generous whitespace-pre-wrap" style={{ color: theme.text2, lineHeight: '1.7', fontSize: '15px' }}>
              {aiText}
              {aiLoading && <span className="animate-pulse">▊</span>}
            </p>
            {analysisResult?.mistakeType && (
              <div className="mt-4 pt-4 border-t border-dashed opacity-60" style={{ borderColor: `${theme.accent2}30` }}>
                <div className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: theme.accent2 }}>Analiză eroare</div>
                <div className="text-xs" style={{ color: theme.text3 }}>{analysisResult.mistakeType}</div>
              </div>
            )}
            {analysisResult?.rule && (
              <div className="mt-2 text-xs italic" style={{ color: theme.text3 }}>
                Regulă: {analysisResult.rule}
              </div>
            )}
            {nextTopicHint && (
              <div className="mt-2 text-xs font-bold" style={{ color: theme.accent }}>
                Focus AI recomandat: {nextTopicHint}
              </div>
            )}
          </motion.div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

interface MnemonicPanelProps {
  examMode: boolean;
  hasAI: boolean;
  mnemonicLoading: boolean;
  mnemonicText: string | null;
  revealed: boolean;
  wasWrong: boolean;
  onGenerate: () => void;
  theme: Theme;
}

export function MnemonicPanel({
  examMode,
  hasAI,
  mnemonicLoading,
  mnemonicText,
  revealed,
  wasWrong,
  onGenerate,
  theme,
}: MnemonicPanelProps) {
  if (!revealed || examMode || !hasAI || !wasWrong) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-4"
      >
        {mnemonicText === null ? (
          <button
            disabled={mnemonicLoading}
            onClick={onGenerate}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all hover:opacity-80"
            style={{ background: `${theme.warning}15`, border: `1px solid ${theme.warning}30`, color: theme.warning }}
          >
            {mnemonicLoading
              ? <><Loader2 size={12} className="animate-spin" />Generez mnemonic...</>
              : <><Zap size={12} />Mnemonic AI</>}
          </button>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-4 rounded-2xl"
            style={{ background: `${theme.warning}0C`, border: `1px solid ${theme.warning}25` }}
          >
            <div className="flex items-center gap-2 mb-2">
              <Zap size={12} style={{ color: theme.warning }} />
              <span className="text-xs font-semibold" style={{ color: theme.warning }}>Mnemonic</span>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: theme.text2 }}>{mnemonicText}</p>
          </motion.div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
