import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, RefreshCw, Sparkles, Zap } from 'lucide-react';
import { useTheme } from '../../theme/ThemeContext';
import { useAIStore } from '../../store/aiStore';
import { useQuizStore } from '../../store/quizStore';
import { useStatsStore } from '../../store/statsStore';
import { buildPerformanceSummary, buildUserContextString } from '../../lib/aiContext';
import { buildStudyCoachPlan } from '../../lib/studyCoach';
import { digestRecommendation } from '../../lib/recommendationDigest';
import { findDueExamSession, localDateStr } from '../../lib/studyPlan';
import { useAdaptiveMotion } from '../../hooks/useAdaptiveMotion';
import { cancelIdleTask, scheduleIdleTask } from '../../lib/idleTaskScheduler';
import { createLatestOnlyRunner } from '../../lib/asyncGuard';
import { logDiagnosticEvent } from '../../store/diagnosticsStore';
import GlassCard from '../ui/GlassCard';
import AIRichText from '../ai-chat/AIRichText';

const AI_REC_KEY = 'studyx-ai-recommendation';
const EXPANDED_KEY = 'studyx-coach-expanded';

function readExpanded(): boolean {
  try {
    return localStorage.getItem(EXPANDED_KEY) === '1';
  } catch {
    return false;
  }
}

/** One-line teaser of a (possibly markdown) recommendation: no headings, bullets, emphasis or line breaks. */
function plainPreview(value: string): string {
  return value
    .replace(/[#*_`>]+/g, '')
    .replace(/^\s*[-•]\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

let dashboardAIRecommendationPromise: Promise<typeof import('../../lib/groq')> | null = null;

function loadDashboardAIRecommendation() {
  if (!dashboardAIRecommendationPromise) {
    dashboardAIRecommendationPromise = import('../../lib/groq');
  }
  return dashboardAIRecommendationPromise;
}

/**
 * The AI Study Coach as one slim row: headline, a one-line teaser of today's
 * recommendation, a small progress ring and the "start session" button. The full
 * recommendation, the suggested actions and "regenerate" live behind the chevron
 * (remembered across visits), so the coach no longer pushes the stats and the
 * recent decks off the first screen.
 */
export default function DashboardHeroCard() {
  const theme = useTheme();
  const { quizzes } = useQuizStore();
  const { questionStats, streak, getDueQuestions, getAccuracy, getStatsByTag } = useStatsStore();
  const { hasKey, knowledgeSources, libraryFolders } = useAIStore();
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { calmMotion } = useAdaptiveMotion();
  const today = localDateStr();
  const latestRecommendationRunner = useMemo(() => createLatestOnlyRunner(), []);

  const dueCount = getDueQuestions().length;
  const totalDueToday = Math.max(dueCount, 10);
  const completedToday = Math.max(0, totalDueToday - dueCount);
  const progressPercent = Math.round((completedToday / totalDueToday) * 100);
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - progressPercent / 100);

  const summary = useMemo(
    () => buildPerformanceSummary(questionStats, streak, getDueQuestions, getAccuracy, getStatsByTag, quizzes),
    [getAccuracy, getDueQuestions, getStatsByTag, questionStats, quizzes, streak],
  );
  const dueExamSession = useMemo(
    () => findDueExamSession(libraryFolders, localDateStr()),
    [libraryFolders],
  );
  const coachPlan = useMemo(
    () => buildStudyCoachPlan(summary, knowledgeSources, dueExamSession),
    [dueExamSession, knowledgeSources, summary],
  );
  const userContext = buildUserContextString(summary);

  const generate = useCallback(async () => {
    if (!hasKey) return;
    setLoading(true);
    try {
      const recommendation = await latestRecommendationRunner(async () => {
        const { generateStudyRecommendation } = await loadDashboardAIRecommendation();
        return generateStudyRecommendation(
          userContext,
          summary.dueCount,
          summary.weakTopics.map((topic: { tag: string }) => topic.tag),
        );
      });
      if (!recommendation) return;
      localStorage.setItem(AI_REC_KEY, JSON.stringify({ date: today, text: recommendation }));
      setText(recommendation);
    } catch (err) {
      console.error('[Dashboard] AI recommendation error:', err);
      logDiagnosticEvent({
        area: 'ai',
        level: 'warning',
        title: 'Recomandarea AI nu a putut fi generată',
        detail: err instanceof Error ? err.message : 'Study Coach nu a răspuns.',
      });
      setText(null);
    } finally {
      setLoading(false);
    }
  }, [hasKey, latestRecommendationRunner, summary.dueCount, summary.weakTopics, today, userContext]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(AI_REC_KEY);
      if (raw) {
        const entry = JSON.parse(raw);
        if (entry.date === today && entry.text) {
          setText(entry.text);
          return;
        }
      }
    } catch (err) {
      console.error('[Dashboard] Error reading recommendation cache:', err);
    }

    if (!hasKey) return;

    const id = scheduleIdleTask(() => {
      void generate();
    }, { timeoutMs: 1500, dedupeKey: 'dashboard-ai-recommendation' });

    return () => cancelIdleTask(id);
  }, [generate, hasKey, today]);

  const displayText = text ?? (
    !hasKey
      ? (summary.dueCount > 0
          ? `Ai ${summary.dueCount} întrebări de recapitulat azi. Menține ritmul activ.`
          : 'Configurează AI în Setări pentru recomandări personalizate.')
      : null
  );

  const showAiColumn = hasKey || summary.totalAnswered > 0;
  const detailText = text ?? (showAiColumn ? displayText : coachPlan.summary);
  const digest = useMemo(() => digestRecommendation(detailText ?? coachPlan.summary), [detailText, coachPlan.summary]);
  const preview = digest[0]?.line ?? plainPreview(detailText ?? coachPlan.summary);
  // Offer the full text only when the digest actually dropped something (a plan table, extra sections…).
  const hasFullPlan = Boolean(detailText) && (detailText ?? '').length > digest.reduce((total, item) => total + item.line.length, 0) * 1.6;
  const [showFull, setShowFull] = useState(false);

  const [expanded, setExpanded] = useState(readExpanded);
  const toggleExpanded = () => {
    setExpanded((value) => {
      const next = !value;
      try {
        localStorage.setItem(EXPANDED_KEY, next ? '1' : '0');
      } catch {
        // storage blocked — the choice just lasts for this visit
      }
      return next;
    });
  };

  return (
    <GlassCard animate padding="0" radius="22px" className="relative mb-5 overflow-hidden">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3.5 sm:px-5">
        <span
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl"
          style={{ background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})` }}
        >
          <Sparkles size={16} className="text-white" />
        </span>

        <button
          type="button"
          onClick={toggleExpanded}
          aria-expanded={expanded}
          aria-label={expanded ? 'Restrânge Study Coach' : 'Extinde Study Coach'}
          className="min-w-0 flex-1 basis-[220px] rounded-xl text-left outline-none focus-visible:shadow-[0_0_0_2px_var(--bg),0_0_0_4px_var(--focus-ring)]"
        >
          <span className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: theme.accent2 }}>
              Study Coach
            </span>
            {loading && (
              <span className="flex gap-1" aria-hidden>
                {[0, 1, 2].map((i) => (
                  <motion.span
                    key={i}
                    animate={calmMotion ? undefined : { opacity: [0.35, 1, 0.35] }}
                    transition={calmMotion ? undefined : { duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
                    className="h-1 w-1 rounded-full"
                    style={{ background: theme.accent2 }}
                  />
                ))}
              </span>
            )}
          </span>
          <span className="block truncate text-[15px] font-bold leading-snug sm:text-base" style={{ color: theme.text }}>
            {coachPlan.headline}
          </span>
          {!expanded && (
            <span className="block truncate text-[12.5px] leading-snug" style={{ color: theme.text3 }}>
              {loading && !detailText ? 'Pregătesc recomandarea de azi…' : preview}
            </span>
          )}
        </button>

        <div className="flex flex-shrink-0 items-center gap-3">
          <div className="relative h-11 w-11" title={dueCount > 0 ? `${dueCount} de recapitulat` : 'Recapitulări la zi'}>
            <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100" aria-hidden>
              <circle cx="50" cy="50" r={radius} fill="none" stroke={theme.surface2} strokeWidth="10" />
              <motion.circle
                cx="50"
                cy="50"
                r={radius}
                fill="none"
                stroke={theme.accent}
                strokeWidth="10"
                strokeDasharray={circumference}
                initial={{ strokeDashoffset: circumference }}
                animate={{ strokeDashoffset: offset }}
                transition={calmMotion ? { duration: 0 } : { duration: 1, ease: 'easeOut' }}
                strokeLinecap="round"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black" style={{ color: theme.text }}>
              {progressPercent}%
            </span>
          </div>
          <Link
            to="/daily-review"
            className="press-feedback inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-[11px] font-black uppercase tracking-wider text-white transition-[filter,box-shadow] duration-300 hover:brightness-110 outline-none focus-visible:shadow-[0_0_0_2px_var(--bg),0_0_0_4px_var(--focus-ring)]"
            style={{ background: theme.accent, boxShadow: `0 6px 16px ${theme.accent}33` }}
          >
            Începe <Zap size={12} fill="white" />
          </Link>
          <button
            type="button"
            onClick={toggleExpanded}
            aria-label={expanded ? 'Restrânge' : 'Extinde'}
            aria-expanded={expanded}
            className="fine-row press-feedback flex h-8 w-8 items-center justify-center hover:!text-[var(--text)]"
            style={{ color: theme.text3 }}
          >
            <ChevronDown size={16} style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.25s var(--ease-out-soft)' }} />
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="coach-detail"
            initial={calmMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={calmMotion ? undefined : { height: 0, opacity: 0 }}
            transition={calmMotion ? { duration: 0 } : { duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="border-t px-4 pb-4 pt-4 sm:px-5" style={{ borderColor: theme.border }}>
              {loading && !detailText ? (
                <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
                  {[0, 1, 2].map((i) => <div key={i} className="skeleton-block h-[74px] rounded-2xl" />)}
                </div>
              ) : (
                <>
                  <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
                    {digest.map((item, index) => {
                      const tone = [theme.accent, theme.accent2, theme.warning][index % 3];
                      return (
                        <motion.div
                          key={`${item.title}-${index}`}
                          initial={calmMotion ? false : { opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={calmMotion ? { duration: 0 } : { delay: 0.06 * index, duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
                          className="rounded-2xl p-3"
                          style={{ background: `${tone}0f`, border: `1px solid ${tone}26` }}
                        >
                          <div className="mb-1.5 flex items-center gap-2">
                            <span className="flex h-6 w-6 items-center justify-center rounded-lg text-[13px]" style={{ background: `${tone}22` }} aria-hidden>
                              {item.icon}
                            </span>
                            <span className="truncate text-[10px] font-black uppercase tracking-[0.14em]" style={{ color: tone }}>
                              {item.title}
                            </span>
                          </div>
                          <p className="text-[12.5px] font-medium leading-snug" style={{ color: theme.text }}>{item.line}</p>
                        </motion.div>
                      );
                    })}
                  </div>

                  {hasFullPlan && (
                    <button
                      type="button"
                      onClick={() => setShowFull((value) => !value)}
                      aria-expanded={showFull}
                      className="fine-row press-feedback -ml-2 mt-3 inline-flex items-center gap-1.5 px-2 py-1 text-[11px] font-black uppercase tracking-[0.14em] hover:!text-[var(--text)]"
                      style={{ color: theme.text3 }}
                    >
                      {showFull ? 'Ascunde planul' : 'Planul complet'}
                      <ChevronDown size={12} style={{ transform: showFull ? 'rotate(180deg)' : 'none', transition: 'transform 0.25s var(--ease-out-soft)' }} />
                    </button>
                  )}
                  {showFull && detailText && (
                    <div
                      className="custom-scrollbar mt-2 max-h-64 max-w-2xl overflow-y-auto rounded-2xl p-3.5 text-[13px] leading-[1.65]"
                      style={{ background: theme.surface, border: `1px solid ${theme.border}`, color: theme.text }}
                    >
                      <AIRichText text={detailText} />
                    </div>
                  )}
                </>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-2">
                {coachPlan.actions.slice(0, 2).map((action) => {
                  const toneColor = action.tone === 'warning' ? theme.warning : action.tone === 'success' ? theme.success : theme.accent;
                  const chip = (
                    <span
                      className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-bold transition-[filter,box-shadow] duration-300 group-hover:brightness-110 group-hover:shadow-[0_2px_10px_var(--shadow-color-soft)]"
                      style={{ background: `${toneColor}14`, border: `1px solid ${toneColor}30`, color: theme.text }}
                    >
                      {action.title}
                    </span>
                  );
                  return action.route ? (
                    <Link key={action.title} to={action.route} className="group press-feedback rounded-full no-underline outline-none focus-visible:shadow-[0_0_0_2px_var(--bg),0_0_0_4px_var(--focus-ring)]">{chip}</Link>
                  ) : (
                    <div key={action.title}>{chip}</div>
                  );
                })}
                <span className="ml-auto flex items-center gap-2 text-[11px] font-semibold" style={{ color: theme.text3 }} title={coachPlan.sourceQualityLabel}>
                  {knowledgeSources.length} surse AI
                  {!loading && text && (
                    <button
                      type="button"
                      onClick={() => void generate()}
                      aria-label="Regenerează recomandarea"
                      title="Regenerează recomandarea"
                      className="fine-row press-feedback flex h-7 w-7 items-center justify-center opacity-70 hover:opacity-100"
                      style={{ color: theme.accent2 }}
                    >
                      <RefreshCw size={13} />
                    </button>
                  )}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </GlassCard>
  );
}
