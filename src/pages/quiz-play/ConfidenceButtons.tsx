import { motion } from 'framer-motion';
import { HelpCircle, Dices, CheckCircle2 } from 'lucide-react';
import type { Confidence } from '../../types';
import type { Theme } from '../../theme/themes';

interface ConfidenceButtonsProps {
  onRate: (level: Confidence) => void;
  theme: Theme;
  calmMotion: boolean;
  /** Label changes on the last question so the user knows rating ends the session. */
  isLast: boolean;
  denseLayout?: boolean;
}

const OPTIONS: Array<{
  level: Confidence;
  label: string;
  shortcut: string;
  icon: typeof HelpCircle;
  tone: (theme: Theme) => string;
}> = [
  { level: 'blackout', label: 'Nu știam', shortcut: '1', icon: HelpCircle, tone: (t) => t.danger },
  { level: 'guess', label: 'Ghiceam', shortcut: '2', icon: Dices, tone: (t) => t.warning },
  { level: 'confident', label: 'Știam sigur', shortcut: '3', icon: CheckCircle2, tone: (t) => t.success },
];

/**
 * Self-assessment row shown after the answer is revealed. Replaces the plain
 * "Next" button: picking a rating both stores the confidence and advances.
 */
export default function ConfidenceButtons({ onRate, theme, calmMotion, isLast, denseLayout }: ConfidenceButtonsProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: calmMotion ? 0.18 : 0.32, ease: [0.16, 1, 0.3, 1] }}
      className="w-full"
    >
      <p className="mb-2 text-center text-[11px] font-black uppercase tracking-[0.18em]" style={{ color: theme.text3 }}>
        Cât de sigur ai fost? {isLast ? '· finalizează sesiunea' : ''}
      </p>
      <div className={`grid grid-cols-3 ${denseLayout ? 'gap-2' : 'gap-2.5'}`}>
        {OPTIONS.map((opt) => {
          const tone = opt.tone(theme);
          const Icon = opt.icon;
          return (
            <motion.button
              key={opt.level}
              onClick={() => onRate(opt.level)}
              className={`press-feedback flex flex-col items-center justify-center gap-1.5 rounded-[20px] border-2 font-black ${denseLayout ? 'px-2 py-3' : 'px-3 py-4'}`}
              style={{ background: `${tone}12`, borderColor: `${tone}55`, color: tone }}
              whileHover={calmMotion ? undefined : { scale: 1.02, background: `${tone}1f` }}
              whileTap={calmMotion ? undefined : { scale: 0.97 }}
            >
              <Icon size={denseLayout ? 16 : 18} />
              <span className={denseLayout ? 'text-[12px]' : 'text-sm'}>{opt.label}</span>
              <span className="text-[9px] font-mono opacity-60">tasta {opt.shortcut}</span>
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}
