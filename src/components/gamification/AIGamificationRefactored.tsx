import { useMemo, useState, type ReactNode } from 'react';
import AIGamificationAchievements from './AIGamificationAchievements';
import AIGamificationChallenges from './AIGamificationChallenges';
import AIGamificationHeader from './AIGamificationHeader';
import AIGamificationLeaderboard from './AIGamificationLeaderboard';
import AIGamificationStats from './AIGamificationStats';
import AIGamificationTabs from './AIGamificationTabs';
import { useQuizStore } from '../../store/quizStore';
import { useStatsStore } from '../../store/statsStore';

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

interface LeaderboardEntry {
  id: string;
  userId: string;
  username: string;
  avatar?: string;
  points: number;
  rank: number;
  level: number;
  achievements: number;
  studyStreak: number;
  aiScore: number;
  weeklyChange: number;
  badges: string[];
}

interface UserStats {
  points: number;
  level: number;
  studyStreak: number;
  achievements: number;
  aiScore: number;
  weeklyRank: number;
}

interface AIGamificationProps {
  userId: string;
  username: string;
}

export default function AIGamificationRefactored({ userId, username }: AIGamificationProps) {
  const [activeTab, setActiveTab] = useState<'achievements' | 'challenges' | 'leaderboard'>('achievements');
  const [selectedAchievement, setSelectedAchievement] = useState<Achievement | null>(null);
  const quizzes = useQuizStore((state) => state.quizzes);
  const sessions = useQuizStore((state) => state.sessions);
  const streak = useStatsStore((state) => state.streak);
  const totalStudyTime = useStatsStore((state) => state.totalStudyTime);
  const getAccuracy = useStatsStore((state) => state.getAccuracy);
  const accuracy = getAccuracy();
  const perfectSessions = sessions.filter((session) => session.total > 0 && session.score === session.total).length;
  const completedQuestions = sessions.reduce((sum, session) => sum + session.total, 0);

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
      weeklyRank: Math.max(1, 12 - Math.min(10, streak.currentStreak + sessions.length)),
    }),
    [accuracy, perfectSessions, quizzes.length, sessions.length, streak.currentStreak, streak.longestStreak, totalStudyTime],
  );

  const achievements = useMemo<Achievement[]>(
    () => [
      {
        id: '1',
        title: 'Maestru Anatomiei',
        description: 'Completeaza 100 de quiz-uri de anatomie cu 90% acuratete.',
        icon: <span className="text-2xl">{'🏆'}</span>,
        points: 500,
        category: 'study',
        rarity: 'legendary',
        progress: Math.min(100, completedQuestions),
        maxProgress: 100,
        aiGenerated: true,
        prerequisites: ['anatomy_basic', 'quiz_master'],
        rewards: [
          { type: 'badge', value: '🏆 Maestru Anatomiei' },
          { type: 'title', value: 'Expert Anatomie' },
          { type: 'points', value: 500 },
        ],
      },
      {
        id: '2',
        title: 'Colaborator Perfect',
        description: 'Ajuta 10 colegi sa obtina note de trecere prin review AI.',
        icon: <span className="text-2xl">{'🤝'}</span>,
        points: 300,
        category: 'collaboration',
        rarity: 'epic',
        progress: Math.min(10, quizzes.length),
        maxProgress: 10,
        aiGenerated: true,
        rewards: [
          { type: 'badge', value: '🤝 Colaborator Perfect' },
          { type: 'feature', value: 'AI Review Pro' },
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
        progress: Math.min(7, streak.currentStreak),
        maxProgress: 7,
        aiGenerated: false,
        unlockedAt: new Date('2026-04-19T00:00:00.000Z'),
        rewards: [
          { type: 'badge', value: '🔥 Saptamana de Studiu' },
          { type: 'points', value: 200 },
        ],
      },
      {
        id: '4',
        title: 'Geniu AI',
        description: 'Obtine 95% scor AI in 50 de sesiuni consecutive.',
        icon: <span className="text-2xl">{'🤖'}</span>,
        points: 750,
        category: 'performance',
        rarity: 'legendary',
        progress: Math.min(50, perfectSessions),
        maxProgress: 50,
        aiGenerated: true,
        rewards: [
          { type: 'badge', value: '🤖 Geniu AI' },
          { type: 'title', value: 'AI Master' },
          { type: 'feature', value: 'AI Insights Pro' },
        ],
      },
    ],
    [completedQuestions, perfectSessions, quizzes.length, streak.currentStreak],
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
        title: 'Review AI Rapid',
        description: 'Evalueaza 5 quiz-uri create de colegi in 15 minute.',
        type: 'weekly',
        difficulty: 'hard',
        points: 300,
        timeLimit: 15,
        aiGenerated: true,
        requirements: [{ type: 'collaboration_points', value: 50 }],
        progress: Math.min(5, Math.floor(totalStudyTime / 900)),
        rewards: {
          points: 300,
          badge: '⚡ Review Expert',
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

  const leaderboard = useMemo<LeaderboardEntry[]>(
    () => [
      {
        id: '1',
        userId: 'user1',
        username: 'Alexandru P.',
        points: 5420,
        rank: 1,
        level: 23,
        achievements: 45,
        studyStreak: 28,
        aiScore: 94,
        weeklyChange: 3,
        badges: ['🏆', '🥇', '🔥', '🤖', '⚡'],
      },
      {
        id: '2',
        userId: 'user2',
        username: 'Maria I.',
        points: 4890,
        rank: 2,
        level: 21,
        achievements: 38,
        studyStreak: 15,
        aiScore: 91,
        weeklyChange: -1,
        badges: ['🥈', '🏆', '🤖', '⭐'],
      },
      {
        id: '3',
        userId,
        username,
        points: userStats.points,
        rank: userStats.weeklyRank,
        level: userStats.level,
        achievements: userStats.achievements,
        studyStreak: userStats.studyStreak,
        aiScore: userStats.aiScore,
        weeklyChange: 2,
        badges: ['🥉', '🔥', '🤖'],
      },
      {
        id: '4',
        userId: 'user4',
        username: 'Radu S.',
        points: 2150,
        rank: 4,
        level: 12,
        achievements: 18,
        studyStreak: 8,
        aiScore: 85,
        weeklyChange: 0,
        badges: ['⭐', '🎯'],
      },
      {
        id: '5',
        userId: 'user5',
        username: 'Elena D.',
        points: 1890,
        rank: 5,
        level: 11,
        achievements: 15,
        studyStreak: 6,
        aiScore: 82,
        weeklyChange: -2,
        badges: ['🎯', '💡'],
      },
    ],
    [userId, username, userStats],
  );

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
        <AIGamificationLeaderboard leaderboard={leaderboard} currentUserId={userId} />
      )}
    </div>
  );
}
