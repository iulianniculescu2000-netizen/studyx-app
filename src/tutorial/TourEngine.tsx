import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTheme } from '../theme/ThemeContext';
import { useTutorialStore } from '../store/tutorialStore';
import { useViewportProfile } from '../hooks/useViewportProfile';
import { useOverlayFlag } from '../hooks/useOverlayFlag';
import { TOURS, isSpotlightTour, type SpotlightTourId } from './registry';
import { useTourAutostart } from './useTourAutostart';
import { readTourContext, useTourContext } from './useTourContext';
import { getTooltipStyle, useSpotlight } from './spotlight';
import TooltipArrow from './TooltipArrow';
import type { TourContext, TourStep } from './types';

const resolveBody = (step: TourStep, ctx: TourContext) => (typeof step.body === 'function' ? step.body(ctx) : step.body);

/** How long a finished "do it yourself" step stays on screen before the tour moves on. */
const ACTION_DONE_DELAY_MS = 900;

/**
 * Runs whichever tour the store says is active. The tours themselves are data (see `registry.ts`);
 * this is the one place that lights up elements, places the card, handles the keyboard and moves on.
 */
export default function TourEngine({ profileId }: { profileId: string }) {
  const activeTour = useTutorialStore((state) => state.activeTour);
  useTourAutostart(profileId);
  if (!activeTour || !isSpotlightTour(activeTour)) return null;
  // Keyed by tour so a different tour starts with fresh internal state.
  return <ActiveTour key={activeTour} tourId={activeTour} profileId={profileId} />;
}

function ActiveTour({ tourId, profileId }: { tourId: SpotlightTourId; profileId: string }) {
  const theme = useTheme();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const currentStep = useTutorialStore((state) => state.currentStep);
  const { nextStep, prevStep, finishTour } = useTutorialStore.getState();
  useOverlayFlag(true);

  const tour = TOURS[tourId];
  // Which steps apply is decided once, when the tour opens: a step that depended on "no key yet"
  // must not vanish from under the user the moment they save one.
  const [steps] = useState(() => {
    const initial = readTourContext(pathname);
    return tour.steps.filter((entry) => !entry.when || entry.when(initial));
  });
  const total = steps.length;
  const index = Math.min(currentStep, total - 1);
  const step = steps[index];
  const isLast = index === total - 1;
  const isFirst = index === 0;

  const ctx = useTourContext();
  const rect = useSpotlight(step?.target, step?.targetPadding ?? 8);
  const accent = step?.accent ?? theme.accent;
  const { mobile, crampedHeight } = useViewportProfile();
  const compact = mobile || crampedHeight;

  // The context as the current step was shown, so a "do it yourself" step can tell what changed since.
  const [atEntry, setAtEntry] = useState<TourContext>(ctx);
  const close = useCallback(() => finishTour(profileId), [finishTour, profileId]);
  const advance = useCallback(() => {
    setAtEntry(ctx);
    if (index >= total - 1) close();
    else nextStep(total);
  }, [close, ctx, index, nextStep, total]);
  const back = useCallback(() => {
    setAtEntry(ctx);
    prevStep();
  }, [ctx, prevStep]);

  // Open the page a step belongs to.
  useEffect(() => {
    if (step?.route && pathname !== step.route) navigate(step.route);
    // Only when the step changes: a later manual navigation must not be undone.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate, step?.id, step?.route]);

  // "Do it yourself" steps move on a moment after the thing is done, so the check mark is seen.
  const isDone = !!step?.completeWhen && step.completeWhen(ctx, atEntry);
  useEffect(() => {
    if (!isDone) return undefined;
    const timer = window.setTimeout(advance, ACTION_DONE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [advance, isDone]);

  // ← / → move through the tour, Esc closes it. Not while typing in a field.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (event.key === 'Escape') { event.preventDefault(); close(); }
      else if (event.key === 'ArrowRight') { event.preventDefault(); advance(); }
      else if (event.key === 'ArrowLeft') { event.preventDefault(); back(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [advance, back, close]);

  // Focus moves into the card so the keyboard and screen readers follow the tour, and goes back afterwards.
  const cardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    return () => { if (previous && document.contains(previous)) previous.focus?.(); };
  }, []);
  useEffect(() => {
    cardRef.current?.focus({ preventScroll: true });
  }, [step?.id]);

  if (!step) return null;
  const body = resolveBody(step, ctx);

  const placement = step.placement ?? 'right';
  // Side-anchored placement assumes a desktop layout with room beside the target; on phones and small
  // windows there usually isn't any, so those always get the centered card.
  // On a small window a centered card would sit on top of the very thing the user has to press, so a
  // "do it yourself" step docks to the bottom edge instead.
  const tooltipStyle: React.CSSProperties = compact && step.completeWhen
    ? { position: 'fixed', left: 12, right: 12, bottom: 12, maxHeight: '46vh', overflowY: 'auto' }
    : getTooltipStyle(placement, rect, compact);
  const actionStepDone = isDone;
  const Extra = step.Extra;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[10008] pointer-events-none">
        {/* Swallows clicks on the dark area; only the buttons and keys move the tour, so a stray click cannot end it. */}
        {/* A "do it yourself" step lets clicks through: the user has to press the very thing it points at. */}
        {!step.completeWhen && <div className="absolute inset-0 pointer-events-auto" style={{ cursor: 'default' }} />}

        <motion.svg
          key="overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 pointer-events-none"
          style={{ width: '100%', height: '100%' }}
        >
          {rect ? (
            <>
              <defs>
                <mask id="tour-spotlight-mask">
                  <rect x="0" y="0" width="100%" height="100%" fill="white" />
                  <rect x={rect.left} y={rect.top} width={rect.width} height={rect.height} rx="14" ry="14" fill="black" />
                </mask>
              </defs>
              <rect x="0" y="0" width="100%" height="100%" fill="rgba(0,0,0,0.62)" mask="url(#tour-spotlight-mask)" />
            </>
          ) : (
            <rect x="0" y="0" width="100%" height="100%" fill="rgba(0,0,0,0.62)" />
          )}
        </motion.svg>

        {rect && (
          <motion.div
            key={`spot-${step.id}`}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="absolute pointer-events-none"
            style={{
              top: rect.top,
              left: rect.left,
              width: rect.width,
              height: rect.height,
              borderRadius: 14,
              zIndex: 2,
              border: `2px solid ${accent}90`,
              boxShadow: `0 0 0 1px ${accent}40, 0 0 24px ${accent}50`,
            }}
          />
        )}

        {/* Positioning lives on this plain div and the enter/exit animation on the one inside it:
            Framer Motion owns `transform` on animated elements and would overwrite the centering. */}
        <div
          ref={cardRef}
          key={`tooltip-pos-${step.id}`}
          role="dialog"
          aria-modal="true"
          aria-label={step.title}
          tabIndex={-1}
          style={{
            ...tooltipStyle,
            background: 'var(--glass-panel-strong)',
            backdropFilter: 'blur(24px) saturate(150%)',
            WebkitBackdropFilter: 'blur(24px) saturate(150%)',
            border: `1px solid ${accent}35`,
            borderRadius: compact ? 22 : 28,
            boxShadow: `0 32px 80px rgba(0,0,0,0.4), 0 0 0 1px ${accent}15`,
            zIndex: 10009,
            pointerEvents: 'auto',
            display: 'flex',
            flexDirection: 'column',
            outline: 'none',
          }}
          className="overflow-hidden"
        >
          <motion.div
            key={`tooltip-${step.id}`}
            initial={{ opacity: 0, scale: 0.94, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94 }}
            transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
            style={{ display: 'flex', flexDirection: 'column', width: '100%', minHeight: 0 }}
          >
            <TooltipArrow position={placement} />

            <div className={`${compact ? 'p-5' : 'p-6'} overflow-y-auto`}>
              <div className={`flex items-center justify-between ${compact ? 'mb-3' : 'mb-4'}`}>
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className={`${compact ? 'h-8 w-8' : 'h-10 w-10'} flex flex-shrink-0 items-center justify-center rounded-2xl`}
                    style={{ background: `${accent}1c`, color: accent }}
                  >
                    {step.icon}
                  </div>
                  <span className="truncate text-[11px] font-semibold tracking-wide" style={{ color: theme.text3 }}>
                    {tour.title} · {index + 1} din {total}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={close}
                  aria-label="Închide turul"
                  className="flex-shrink-0 rounded-full p-2 transition-colors hover:bg-[var(--hover-fill)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
                  style={{ color: theme.text3 }}
                >
                  <X size={14} />
                </button>
              </div>

              <div className="mb-4 h-1 w-full overflow-hidden rounded-full" style={{ background: 'var(--fill-subtle)' }}>
                <motion.div
                  className="h-full rounded-full"
                  animate={{ width: `${((index + 1) / total) * 100}%` }}
                  transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
                  style={{ background: accent }}
                />
              </div>

              <h3 className={`${compact ? 'text-base' : 'text-[19px]'} mb-2 font-semibold leading-tight tracking-tight`} style={{ color: theme.text }}>
                {step.title}
              </h3>
              <p className={`${compact ? 'text-[12.5px]' : 'text-[13.5px]'} whitespace-pre-line leading-relaxed ${Extra || step.actionHint ? 'mb-3' : compact ? 'mb-4' : 'mb-5'}`} style={{ color: theme.text2 }}>
                {body}
              </p>

              {Extra && <div className="mb-4"><Extra ctx={ctx} advance={advance} /></div>}

              {step.completeWhen && (
                <p
                  role="status"
                  className="mb-4 flex items-center gap-1.5 text-[12.5px] font-semibold"
                  style={{ color: actionStepDone ? theme.success : theme.text3 }}
                >
                  {actionStepDone ? <><Check size={14} /> Gata, merg mai departe</> : step.actionHint}
                </p>
              )}

              <div className="flex items-center gap-2">
                {!isFirst && (
                  <button
                    type="button"
                    onClick={back}
                    className="flex items-center gap-1 rounded-xl px-3 py-2 text-[13px] font-medium"
                    style={{ background: 'var(--fill-subtle)', color: theme.text2 }}
                  >
                    <ChevronLeft size={14} /> Înapoi
                  </button>
                )}
                <button
                  type="button"
                  onClick={advance}
                  className="press-feedback flex flex-1 items-center justify-center gap-1.5 rounded-2xl py-2.5 text-[13.5px] font-semibold text-white"
                  style={{ background: accent }}
                >
                  {isLast
                    ? <><Check size={15} /> Gata</>
                    : step.completeWhen
                      ? 'Sari peste'
                      : <>{isFirst ? 'Hai să începem' : 'Continuă'} <ChevronRight size={15} /></>}
                </button>
              </div>

              {!isLast && (
                <button
                  type="button"
                  onClick={close}
                  className="mt-3 w-full text-center text-[12px] font-medium transition-opacity hover:opacity-80"
                  style={{ color: theme.text3 }}
                >
                  Închide turul
                </button>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </AnimatePresence>
  );
}
