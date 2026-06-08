import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { RefreshCw, Sparkles, X } from 'lucide-react';
import { useTheme } from '../../theme/ThemeContext';
import { useAIStore } from '../../store/aiStore';
import { useQuizStore } from '../../store/quizStore';
import { useStatsStore } from '../../store/statsStore';
import { buildPerformanceSummary, buildUserContextString } from '../../lib/aiContext';
import { buildStudyCoachPlan } from '../../lib/studyCoach';
import { useAdaptiveMotion } from '../../hooks/useAdaptiveMotion';
import { cancelIdleTask, scheduleIdleTask } from '../../lib/idleTaskScheduler';
import { createLatestOnlyRunner } from '../../lib/asyncGuard';
import { logDiagnosticEvent } from '../../store/diagnosticsStore';

const AI_REC_KEY = 'studyx-ai-recommendation';

let dashboardAIRecommendationPromise: Promise<typeof import('../../lib/groq')> | null = null;

function loadDashboardAIRecommendation() {
  if (!dashboardAIRecommendationPromise) {
    dashboardAIRecommendationPromise = import('../../lib/groq');
  }
  return dashboardAIRecommendationPromise;
}

export default function DashboardAIStudyBuddy() {
  const theme = useTheme();
  const { quizzes } = useQuizStore();
  const { questionStats, streak, getDueQuestions, getAccuracy, getStatsByTag } = useStatsStore();
  const { hasKey, knowledgeSources } = useAIStore();
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const { calmMotion } = useAdaptiveMotion();
  const today = new Date().toISOString().split('T')[0];
  const latestRecommendationRunner = useMemo(() => createLatestOnlyRunner(), []);

  const summary = useMemo(
    () => buildPerformanceSummary(questionStats, streak, getDueQuestions, getAccuracy, getStatsByTag, quizzes),
    [getAccuracy, getDueQuestions, getStatsByTag, questionStats, quizzes, streak],
  );
  const coachPlan = useMemo(() => buildStudyCoachPlan(summary, knowledgeSources), [knowledgeSources, summary]);
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

  if (dismissed) return null;
  if (!hasKey && summary.totalAnswered === 0) return null;

  const displayText = text ?? (
    !hasKey
      ? (summary.dueCount > 0
          ? `Ai ${summary.dueCount} întrebări de recapitulat azi. Menține ritmul activ.`
          : 'Configurează AI în Setări pentru recomandări personalizate.')
      : null
  );

  if (!displayText && !loading) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="editorial-hero luxe-card relative mb-8 overflow-hidden rounded-[34px] p-6 sm:p-7"
      style={{
        background: theme.isDark
          ? 'linear-gradient(135deg, rgba(86,102,255,0.12), rgba(255,255,255,0.03))'
          : 'linear-gradient(135deg, rgba(255,255,255,0.90), rgba(245,249,253,0.82))',
        border: `1px solid ${theme.border}`,
      }}
    >
      <motion.div
        animate={calmMotion ? undefined : { opacity: [0.1, 0.2, 0.1], scale: [1, 1.1, 1] }}
        transition={calmMotion ? undefined : { duration: 8, repeat: Infinity }}
        className="pointer-events-none absolute inset-0"
        style={{ background: `radial-gradient(circle at 80% 20%, ${theme.accent2}30, transparent 60%)` }}
      />

      <div className="relative z-10 flex flex-col gap-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-4">
            <div
              className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-[22px] shadow-lg"
              style={{ background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})`, boxShadow: `0 14px 30px ${theme.accent}38` }}
            >
              <Sparkles size={24} className="text-white" />
            </div>
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-3">
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
              <h2 className="max-w-2xl text-[1.9rem] font-black tracking-[-0.05em] sm:text-[2.35rem]" style={{ color: theme.text }}>
                {coachPlan.headline}
              </h2>
              <p className="mt-3 max-w-2xl text-sm font-medium leading-relaxed opacity-80 sm:text-[15px]" style={{ color: theme.text }}>
                {coachPlan.summary}
              </p>
              <div className="mt-4 flex flex-wrap gap-2.5">
                <span
                  className="rounded-full px-3.5 py-1.5 text-[11px] font-bold"
                  style={{ background: theme.surface2, border: `1px solid ${theme.border}`, color: theme.text3 }}
                >
                  Focus: {coachPlan.focusTopic}
                </span>
                {summary.dueCount > 0 && (
                  <span
                    className="rounded-full px-3.5 py-1.5 text-[11px] font-bold"
                    style={{ background: theme.surface2, border: `1px solid ${theme.border}`, color: theme.text3 }}
                  >
                    {summary.dueCount} itemi cer atenție
                  </span>
                )}
                <span
                  className="rounded-full px-3.5 py-1.5 text-[11px] font-bold"
                  style={{ background: theme.surface2, border: `1px solid ${theme.border}`, color: theme.text3 }}
                >
                  {knowledgeSources.length} surse AI
                </span>
              </div>
            </div>
          </div>
          <button onClick={() => setDismissed(true)} className="rounded-2xl p-2.5 transition-colors hover:bg-white/5" style={{ color: theme.text3 }}>
            <X size={16} />
          </button>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.9fr)]">
          <div
            className="rounded-[28px] px-5 py-5 sm:px-6"
            style={{ background: theme.surface2, border: `1px solid ${theme.border}` }}
          >
            <div className="mb-2 text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: theme.text3 }}>
              Recomandare AI contextuala
            </div>
            {loading && !displayText ? (
              <div className="mt-4 space-y-3">
                <div className="skeleton-block h-3 w-3/4 rounded-full" />
                <div className="skeleton-block h-3 w-5/6 rounded-full" />
                <div className="skeleton-block h-3 w-1/2 rounded-full" />
              </div>
            ) : (
              <p className="text-[15px] font-medium leading-[1.72]" style={{ color: theme.text }}>
                {displayText}
              </p>
            )}
            {!loading && text && (
              <motion.button
                whileHover={calmMotion ? undefined : { x: 4 }}
                onClick={() => void generate()}
                className="mt-5 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.16em] opacity-70 transition-opacity hover:opacity-100"
                style={{ color: theme.accent2 }}
              >
                Regenereaza recomandarea <RefreshCw size={12} />
              </motion.button>
            )}
          </div>

          <div className="grid gap-3">
            {coachPlan.actions.map((action) => {
              const toneColor = action.tone === 'warning'
                ? theme.warning
                : action.tone === 'success'
                  ? theme.success
                  : theme.accent;
              const cardContent = (
                <>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <span
                      className="rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em]"
                      style={{ background: `${toneColor}16`, color: toneColor }}
                    >
                      {action.tone === 'warning' ? 'Recovery' : action.tone === 'success' ? 'Library' : 'Focus'}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: theme.text3 }}>
                      {action.route ? 'Deschide' : 'Info'}
                    </span>
                  </div>
                  <h3 className="text-base font-black tracking-tight" style={{ color: theme.text }}>
                    {action.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed" style={{ color: theme.text3 }}>
                    {action.detail}
                  </p>
                </>
              );

              return action.route ? (
                <Link
                  key={action.title}
                  to={action.route}
                  className="premium-card-hover rounded-[26px] px-5 py-4 no-underline"
                  style={{ background: theme.surface2, border: `1px solid ${theme.border}` }}
                >
                  {cardContent}
                </Link>
              ) : (
                <div
                  key={action.title}
                  className="premium-card-hover rounded-[26px] px-5 py-4"
                  style={{ background: theme.surface2, border: `1px solid ${theme.border}` }}
                >
                  {cardContent}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
