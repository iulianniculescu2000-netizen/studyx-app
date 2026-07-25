import { useMemo, useState, type ReactNode } from 'react';
import AIGamificationAchievements from './AIGamificationAchievements';
import AIGamificationChallenges from './AIGamificationChallenges';
import AIGamificationHeader from './AIGamificationHeader';
import AIGamificationSelfComparison, { type SelfComparisonEntry } from './AIGamificationSelfComparison';
import AIGamificationStats from './AIGamificationStats';
import AIGamificationTabs from './AIGamificationTabs';
import { useQuizStore } from '../../store/quizStore';
import { useStatsStore } from '../../store/statsStore';
import { computeCategoryMastery, masteryProgress, questionsAnsweredThisWeek } from '../../lib/gamificationProgress';

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: ReactNode;
  points: number;
  category: 'study' | 'collaboration' | 'performance' | 'milestone';
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  unlockedAt?: Date;
  progress: number;
  maxProgress: number;
  aiGenerated: boolean;
  prerequisites?: string[];
  rewards?: {
    type: 'badge' | 'title' | 'points' | 'feature';
    value: string | number;
  }[];
}

interface Challenge {
  id: string;
  title: string;
  description: string;
  type: 'daily' | 'weekly' | 'adaptive';
  difficulty: 'easy' | 'medium' | 'hard' | 'expert';
  points: number;
  timeLimit: number;
  aiGenerated: boolean;
  requirements?: {
    type: 'quiz_score' | 'study_time' | 'streak_days' | 'collaboration_points';
    value: number;
  }[];
  progress: number;
  completedAt?: Date;
  rewards?: {
    points: number;
    badge?: string;
    feature?: string;
  };
}

interface UserStats {
  points: number;
  level: number;
  studyStreak: number;
  achievements: number;
  aiScore: number;
  weeklyQuestions: number;
}

interface AIGamificationProps {
  userId: string;
  username: string;
}

export default function AIGamificationRefactored({ username }: AIGamificationProps) {
  const [activeTab, setActiveTab] = useState<'achievements' | 'challenges' | 'leaderboard'>('achievements');
  const [selectedAchievement, setSelectedAchievement] = useState<Achievement | null>(null);
  // Captured once so the day-bucketed self-comparison stays pure across renders.
  const [nowTs] = useState(() => Date.now());
  const quizzes = useQuizStore((state) => state.quizzes);
  const sessions = useQuizStore((state) => state.sessions);
  const streak = useStatsStore((state) => state.streak);
  const totalStudyTime = useStatsStore((state) => state.totalStudyTime);
  const getAccuracy = useStatsStore((state) => state.getAccuracy);
  const accuracy = getAccuracy();
  const perfectSessions = sessions.filter((session) => session.total > 0 && session.score === session.total).length;
  const questionStats = useStatsStore((state) => state.questionStats);

  // Real per-subject progress, so a subject badge counts that subject's questions.
  const masteredSubject = useMemo(
    () => masteryProgress(computeCategoryMastery(quizzes, questionStats)),
    [quizzes, questionStats],
  );
  const longestRun = Math.max(streak.currentStreak, streak.longestStreak);
  const weeklyQuestions = useMemo(
    () => questionsAnsweredThisWeek(sessions, nowTs),
    [sessions, nowTs],
  );

  const userStats = useMemo<UserStats>(
    () => ({
      points: quizzes.length * 20 + sessions.length * 35 + perfectSessions * 80 + streak.currentStreak * 25,
      level: Math.max(1, Math.floor((quizzes.length + sessions.length + streak.longestStreak) / 4) + 1),
      studyStreak: streak.currentStreak,
      achievements: [
        quizzes.length > 0,
        sessions.length > 0,
        perfectSessions > 0,
        streak.currentStreak >= 7,
        totalStudyTime >= 10 * 3600,
        accuracy >= 80,
      ].filter(Boolean).length,
      aiScore: Math.max(0, Math.min(100, accuracy || Math.min(95, 45 + sessions.length * 4 + streak.currentStreak * 3))),
      // Replaces a fabricated "#rank" that implied competing against other
      // users — StudyX is single-user, so there was never a leaderboard.
      weeklyQuestions,
    }),
    [accuracy, perfectSessions, quizzes.length, sessions.length, streak.currentStreak, streak.longestStreak, totalStudyTime, weeklyQuestions],
  );

  const achievements = useMemo<Achievement[]>(
    () => [
      {
        id: '1',
        title: masteredSubject.category ? `Maestru — ${masteredSubject.category}` : 'Maestru pe o materie',
        description: 'Răspunde la 100 de întrebări dintr-o singură materie, păstrând cel puțin 90% acuratețe.',
        icon: <span className="text-2xl">{'🏆'}</span>,
        points: 500,
        category: 'study',
        rarity: 'legendary',
        // Counts only questions from the subject the user is actually holding at
        // 90%. It used to count every answered question of any subject.
        progress: Math.min(100, masteredSubject.answeredQuestions),
        maxProgress: 100,
        aiGenerated: false,
        rewards: [
          { type: 'badge', value: '🏆 Maestru pe materie' },
          { type: 'points', value: 500 },
        ],
      },
      {
        id: '2',
        // Was "Ajută 10 colegi prin review AI" — StudyX has no peer review, so
        // that badge could never be earned by doing what it described. Restated
        // to the thing its number was already measuring.
        title: 'Constructor de bancă',
        description: 'Creează sau importă 10 seturi de grile.',
        icon: <span className="text-2xl">{'🧱'}</span>,
        points: 300,
        category: 'milestone',
        rarity: 'epic',
        progress: Math.min(10, quizzes.length),
        maxProgress: 10,
        aiGenerated: false,
        rewards: [
          { type: 'badge', value: '🧱 Constructor de bancă' },
          { type: 'points', value: 300 },
        ],
      },
      {
        id: '3',
        title: 'Saptamana de Studiu',
        description: 'Mentine o saptamana completa de studiu, 7 zile consecutive.',
        icon: <span className="text-2xl">{'🔥'}</span>,
        points: 200,
        category: 'milestone',
        rarity: 'rare',
        progress: Math.min(7, longestRun),
        maxProgress: 7,
        aiGenerated: false,
        // Unlocked from the real streak — this used to carry a hard-coded date,
        // so the badge claimed to have been earned whether it had been or not.
        ...(longestRun >= 7 ? { unlockedAt: new Date(streak.lastStudyDate || Date.now()) } : {}),
        rewards: [
          { type: 'badge', value: '🔥 Saptamana de Studiu' },
          { type: 'points', value: 200 },
        ],
      },
      {
        id: '4',
        // Was "95% scor AI în 50 de sesiuni consecutive" while counting perfect
        // sessions — neither consecutive nor an AI score. Now it says what it counts.
        title: 'Sesiuni impecabile',
        description: 'Termină 50 de sesiuni cu toate răspunsurile corecte.',
        icon: <span className="text-2xl">{'🤖'}</span>,
        points: 750,
        category: 'performance',
        rarity: 'legendary',
        progress: Math.min(50, perfectSessions),
        maxProgress: 50,
        aiGenerated: false,
        rewards: [
          { type: 'badge', value: '🤖 Sesiuni impecabile' },
          { type: 'points', value: 750 },
        ],
      },
    ],
    [masteredSubject, perfectSessions, quizzes.length, longestRun, streak.lastStudyDate],
  );

  const challenges = useMemo<Challenge[]>(
    () => [
      {
        id: '1',
        title: 'Quiz Challenge Adaptiv',
        description: 'Completeaza 10 quiz-uri generate de AI pe baza nivelului tau actual.',
        type: 'adaptive',
        difficulty: 'medium',
        points: 150,
        timeLimit: 30,
        aiGenerated: true,
        requirements: [{ type: 'study_time', value: 120 }],
        progress: Math.min(10, sessions.length),
        rewards: {
          points: 150,
          badge: '🎯 Challenge Master',
        },
      },
      {
        id: '2',
        // Was "Evaluează 5 quiz-uri create de colegi" — there are no colleagues
        // and no review feature; the bar was really counting study time.
        title: 'Maraton de studiu',
        description: 'Adună 75 de minute de studiu în această săptămână.',
        type: 'weekly',
        difficulty: 'hard',
        points: 300,
        timeLimit: 15,
        aiGenerated: false,
        requirements: [{ type: 'study_time', value: 75 }],
        progress: Math.min(5, Math.floor(totalStudyTime / 900)),
        rewards: {
          points: 300,
          badge: '⚡ Maraton de studiu',
        },
      },
      {
        id: '3',
        title: 'Streak Zilnic',
        description: 'Studiaza consecvent 5 zile la rand.',
        type: 'daily',
        difficulty: 'easy',
        points: 50,
        timeLimit: 60,
        aiGenerated: false,
        requirements: [{ type: 'streak_days', value: 5 }],
        progress: Math.min(5, streak.currentStreak),
        rewards: {
          points: 50,
          feature: 'Streak Bonus',
        },
      },
    ],
    [sessions.length, streak.currentStreak, totalStudyTime],
  );

  // Single-user app → there are no real competitors. Compare the user against
  // their own past performance instead of fabricated rivals. Accuracy is
  // aggregated per calendar day from real sessions.
  const { selfComparison, todayVsYesterday } = useMemo(() => {
    const dayKey = (ts: number) => new Date(ts).toISOString().split('T')[0];
    const byDay = new Map<string, { correct: number; total: number }>();
    for (const session of sessions) {
      const ts = session.finishedAt ?? session.startedAt;
      if (!ts || session.total <= 0) continue;
      const key = dayKey(ts);
      const agg = byDay.get(key) ?? { correct: 0, total: 0 };
      agg.correct += session.score;
      agg.total += session.total;
      byDay.set(key, agg);
    }

    const pct = (d?: { correct: number; total: number }) =>
      d && d.total > 0 ? Math.round((d.correct / d.total) * 100) : 0;
    const questions = (d?: { correct: number; total: number }) => d?.total ?? 0;

    const now = nowTs;
    const todayData = byDay.get(dayKey(now));
    const yesterdayData = byDay.get(dayKey(now - 86400000));

    let weekSum = 0;
    let weekCount = 0;
    let weekQuestions = 0;
    for (let i = 0; i < 7; i++) {
      const data = byDay.get(dayKey(now - i * 86400000));
      if (data && data.total > 0) {
        weekSum += pct(data);
        weekQuestions += data.total;
        weekCount++;
      }
    }
    const weekAvg = weekCount > 0 ? Math.round(weekSum / weekCount) : 0;

    let bestValue = 0;
    let bestQuestions = 0;
    for (const data of byDay.values()) {
      const value = pct(data);
      if (value > bestValue) {
        bestValue = value;
        bestQuestions = data.total;
      }
    }

    const entries: SelfComparisonEntry[] = [
      { label: 'Tu azi', value: pct(todayData), questions: questions(todayData), highlight: true },
      { label: 'Tu ieri', value: pct(yesterdayData), questions: questions(yesterdayData) },
      { label: 'Media săptămânii', value: weekAvg, questions: weekQuestions },
      { label: 'Cel mai bun', value: bestValue, questions: bestQuestions, isBest: true },
    ];

    return { selfComparison: entries, todayVsYesterday: pct(todayData) - pct(yesterdayData) };
  }, [sessions, nowTs]);

  return (
    <div className="max-w-7xl mx-auto p-6">
      <AIGamificationHeader username={username} />
      <AIGamificationStats userStats={userStats} />
      <AIGamificationTabs activeTab={activeTab} setActiveTab={setActiveTab} />

      {activeTab === 'achievements' && (
        <AIGamificationAchievements
          achievements={achievements}
          selectedAchievement={selectedAchievement}
          setSelectedAchievement={setSelectedAchievement}
        />
      )}

      {activeTab === 'challenges' && <AIGamificationChallenges challenges={challenges} />}

      {activeTab === 'leaderboard' && (
        <AIGamificationSelfComparison entries={selfComparison} todayVsYesterday={todayVsYesterday} />
      )}
    </div>
  );
}
