import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { RefreshCw, Sparkles, Zap } from 'lucide-react';
import { useTheme } from '../../theme/ThemeContext';
import { useAIStore } from '../../store/aiStore';
import { useQuizStore } from '../../store/quizStore';
import { useStatsStore } from '../../store/statsStore';
import { buildPerformanceSummary, buildUserContextString } from '../../lib/aiContext';
import { buildStudyCoachPlan } from '../../lib/studyCoach';
import { findDueExamSession, localDateStr } from '../../lib/studyPlan';
import { useAdaptiveMotion } from '../../hooks/useAdaptiveMotion';
import { cancelIdleTask, scheduleIdleTask } from '../../lib/idleTaskScheduler';
import { createLatestOnlyRunner } from '../../lib/asyncGuard';
import { logDiagnosticEvent } from '../../store/diagnosticsStore';
import GlassCard from '../ui/GlassCard';
import AIRichText from '../ai-chat/AIRichText';

const AI_REC_KEY = 'studyx-ai-recommendation';

let dashboardAIRecommendationPromise: Promise<typeof import('../../lib/groq')> | null = null;

function loadDashboardAIRecommendation() {
  if (!dashboardAIRecommendationPromise) {
    dashboardAIRecommendationPromise = import('../../lib/groq');
  }
  return dashboardAIRecommendationPromise;
}

/**
 * The single most-important thing on the dashboard: the AI recommendation,
 * fused with "today's session" progress into one hero (UI 2.0 — one hero,
 * not a hero plus a separate progress card plus a stat grid competing for
 * attention). Logic is unchanged from DashboardAIStudyBuddy/TodayProgressCard,
 * only the layout is merged.
 */
export default function DashboardHeroCard() {
  const theme = useTheme();
  const { quizzes } = useQuizStore();
  const { questionStats, streak, getDueQuestions, getAccuracy, getStatsByTag } = useStatsStore();
  const { hasKey, knowledgeSources, libraryFolders } = useAIStore();
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { calmMotion, performanceLite } = useAdaptiveMotion();
  const today = new Date().toISOString().split('T')[0];
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

  return (
    <GlassCard variant="hero" animate padding="0" radius="34px" className="relative mb-8 overflow-hidden">
      <motion.div
        animate={calmMotion ? undefined : { opacity: [0.1, 0.2, 0.1], scale: [1, 1.1, 1] }}
        transition={calmMotion ? undefined : { duration: 8, repeat: Infinity }}
        className="pointer-events-none absolute inset-0"
        style={{ background: `radial-gradient(circle at 80% 20%, ${theme.accent2}30, transparent 60%)` }}
      />

      <div className="relative z-10 grid gap-6 p-6 sm:p-7 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-3">
            <span
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-2xl shadow-lg"
              style={{ background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})`, boxShadow: `0 10px 24px ${theme.accent}38` }}
            >
              <Sparkles size={17} className="text-white" />
            </span>
            <span className="secondary-label font-black tracking-[0.22em]" style={{ color: theme.accent2 }}>
              AI STUDY COACH
            </span>
            <span
              className="rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em]"
              style={{ background: theme.surface2, border: `1px solid ${theme.border}`, color: theme.text3 }}
            >
              {coachPlan.sourceQualityLabel}
            </span>
            {loading && (
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    animate={calmMotion ? undefined : { scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
                    transition={calmMotion ? undefined : { duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: theme.accent2 }}
                  />
                ))}
              </div>
            )}
          </div>

          <h2 className="max-w-2xl text-[1.7rem] font-black tracking-[-0.05em] sm:text-[2.1rem]" style={{ color: theme.text }}>
            {coachPlan.headline}
          </h2>

          {showAiColumn ? (
            loading && !displayText ? (
              <div className="mt-4 space-y-3 max-w-xl">
                <div className="skeleton-block h-3 w-3/4 rounded-full" />
                <div className="skeleton-block h-3 w-5/6 rounded-full" />
                <div className="skeleton-block h-3 w-1/2 rounded-full" />
              </div>
            ) : (
              <div className="mt-3 max-w-2xl text-sm font-medium leading-[1.7] opacity-85 sm:text-[15px]" style={{ color: theme.text }}>
                <AIRichText text={displayText} />
              </div>
            )
          ) : (
            <p className="mt-3 max-w-2xl text-sm font-medium leading-relaxed opacity-80 sm:text-[15px]" style={{ color: theme.text }}>
              {coachPlan.summary}
            </p>
          )}

          {!loading && text && (
            <motion.button
              whileHover={calmMotion ? undefined : { x: 4 }}
              onClick={() => void generate()}
              className="mt-4 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.16em] opacity-70 transition-opacity hover:opacity-100"
              style={{ color: theme.accent2 }}
            >
              Regenerează recomandarea <RefreshCw size={12} />
            </motion.button>
          )}

          <div className="mt-5 flex flex-wrap gap-2">
            {coachPlan.actions.slice(0, 2).map((action) => {
              const toneColor = action.tone === 'warning' ? theme.warning : action.tone === 'success' ? theme.success : theme.accent;
              const chip = (
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[11px] font-bold"
                  style={{ background: `${toneColor}14`, border: `1px solid ${toneColor}30`, color: theme.text }}
                >
                  {action.title}
                </span>
              );
              return action.route ? (
                <Link key={action.title} to={action.route} className="press-feedback no-underline">
                  {chip}
                </Link>
              ) : (
                <div key={action.title}>{chip}</div>
              );
            })}
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[11px] font-bold"
              style={{ background: theme.surface2, border: `1px solid ${theme.border}`, color: theme.text3 }}
            >
              {knowledgeSources.length} surse AI
            </span>
          </div>
        </div>

        <div className="flex flex-shrink-0 flex-col items-center justify-center gap-3 lg:items-start lg:justify-between lg:border-l lg:pl-7" style={{ borderColor: theme.border }}>
          <div className="flex flex-col items-center gap-3 lg:items-start">
            <div className="relative h-24 w-24">
              <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r={radius} fill="none" stroke={theme.surface2} strokeWidth="8" />
                <motion.circle
                  cx="50"
                  cy="50"
                  r={radius}
                  fill="none"
                  stroke={theme.accent}
                  strokeWidth="8"
                  strokeDasharray={circumference}
                  initial={{ strokeDashoffset: circumference }}
                  animate={{ strokeDashoffset: offset }}
                  transition={calmMotion ? { duration: 0 } : { duration: 1.5, ease: 'easeOut' }}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-lg font-black" style={{ color: theme.text }}>{progressPercent}%</span>
              </div>
            </div>
            <div className="text-center lg:text-left">
              <div className="text-[11px] font-bold" style={{ color: theme.text3 }}>
                {dueCount > 0 ? `${dueCount} de recapitulat` : 'Recapitulări la zi'}
              </div>
            </div>
          </div>
          <Link
            to="/daily-review"
            className="press-feedback inline-flex items-center gap-2 rounded-2xl px-5 py-2.5 text-[11px] font-black uppercase tracking-widest text-white shadow-lg transition-transform"
            style={{ background: theme.accent, boxShadow: `0 8px 20px ${theme.accent}40` }}
          >
            Începe sesiunea <Zap size={13} fill="white" />
          </Link>
        </div>
      </div>

      <div
        className="pointer-events-none absolute -bottom-8 -right-8 h-40 w-40 opacity-10"
        style={{ background: `radial-gradient(circle, ${theme.accent}, transparent 70%)`, filter: performanceLite ? 'blur(24px)' : 'blur(40px)' }}
      />
    </GlassCard>
  );
}
