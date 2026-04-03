import type { Question, QuestionStat } from '../types';
import type {
  AIAnalysisResult,
  MistakeBankEntry,
  TopicStatsMap,
  UserProfileData,
  WeakTopic,
  WeakTopicInput,
} from './types';

const PROFILE_KEY_PREFIX = 'studyx-ai-profile';

function getProfileKey(profileId: string) {
  return `${PROFILE_KEY_PREFIX}:${profileId}`;
}

function emptyProfile(profileId: string): UserProfileData {
  return {
    profileId,
    globalAccuracy: 0,
    topicAccuracy: {},
    recentMistakes: [],
    mistakeBank: [],
    currentDifficulty: 'medium',
    streak: 0,
    recentQuestions: [],
    updatedAt: Date.now(),
  };
}

export function loadUserProfile(profileId: string): UserProfileData {
  try {
    const raw = localStorage.getItem(getProfileKey(profileId));
    if (!raw) return emptyProfile(profileId);
    const parsed = JSON.parse(raw) as UserProfileData;
    return { ...emptyProfile(profileId), ...parsed, profileId };
  } catch {
    return emptyProfile(profileId);
  }
}

export function saveUserProfile(profile: UserProfileData) {
  try {
    localStorage.setItem(getProfileKey(profile.profileId), JSON.stringify({ ...profile, updatedAt: Date.now() }));
  } catch {}
}

function difficultyFromAccuracy(accuracy: number): 'easy' | 'medium' | 'hard' {
  if (accuracy >= 80) return 'hard';
  if (accuracy < 50) return 'easy';
  return 'medium';
}

export function extractWeakTopics({ stats, questions }: WeakTopicInput): WeakTopic[] {
  const byId = new Map(questions.map((question) => [question.id, question]));
  const topicStats: TopicStatsMap = {};

  for (const stat of Object.values(stats)) {
    const question = byId.get(stat.questionId);
    const tags = question?.tags?.length ? question.tags : [question?.text?.split(' ').slice(0, 3).join(' ') || 'General'];
    for (const tag of tags) {
      if (!topicStats[tag]) {
        topicStats[tag] = { correct: 0, total: 0, wrong: 0, lastWrongAt: 0 };
      }
      topicStats[tag].correct += stat.timesCorrect;
      topicStats[tag].wrong += stat.timesWrong;
      topicStats[tag].total += stat.timesCorrect + stat.timesWrong;
      if (stat.timesWrong > 0) {
        topicStats[tag].lastWrongAt = Math.max(topicStats[tag].lastWrongAt, stat.lastSeen || 0);
      }
    }
  }

  return Object.entries(topicStats)
    .map(([topic, current]) => ({
      topic,
      accuracy: current.total > 0 ? Math.round((current.correct / current.total) * 100) : 0,
      wrongCount: current.wrong,
      total: current.total,
      recencyScore: current.lastWrongAt,
    }))
    .filter((topic) => topic.total > 0)
    .sort((a, b) => {
      if (a.accuracy !== b.accuracy) return a.accuracy - b.accuracy;
      if (a.wrongCount !== b.wrongCount) return b.wrongCount - a.wrongCount;
      return b.recencyScore - a.recencyScore;
    })
    .slice(0, 5);
}

export function syncProfileFromStats(
  profileId: string,
  stats: Record<string, QuestionStat>,
  questions: Question[],
  streak: number
) {
  const profile = loadUserProfile(profileId);
  const weakTopics = extractWeakTopics({ stats, questions });
  const topicAccuracy = Object.fromEntries(
    weakTopics.map((topic) => [
      topic.topic,
      {
        correct: topic.total - topic.wrongCount,
        total: topic.total,
        accuracy: topic.accuracy,
      },
    ])
  );

  const allStats = Object.values(stats);
  const totalAnswers = allStats.reduce((sum, stat) => sum + stat.timesCorrect + stat.timesWrong, 0);
  const totalCorrect = allStats.reduce((sum, stat) => sum + stat.timesCorrect, 0);
  const globalAccuracy = totalAnswers > 0 ? Math.round((totalCorrect / totalAnswers) * 100) : 0;

  const nextProfile: UserProfileData = {
    ...profile,
    globalAccuracy,
    topicAccuracy: { ...profile.topicAccuracy, ...topicAccuracy },
    currentDifficulty: difficultyFromAccuracy(globalAccuracy),
    streak,
    updatedAt: Date.now(),
  };
  saveUserProfile(nextProfile);
  return nextProfile;
}

export function updateUserProfileAfterAnswer(
  profileId: string,
  payload: {
    question: Question;
    isCorrect: boolean;
    userAnswer: string;
    correctAnswer: string;
    analysis?: AIAnalysisResult;
  }
) {
  const profile = loadUserProfile(profileId);
  const topics = payload.question.tags?.length ? payload.question.tags : ['General'];
  const topicAccuracy = { ...profile.topicAccuracy };

  for (const topic of topics) {
    const current = topicAccuracy[topic] ?? { correct: 0, total: 0, accuracy: 0 };
    const correct = current.correct + (payload.isCorrect ? 1 : 0);
    const total = current.total + 1;
    topicAccuracy[topic] = {
      correct,
      total,
      accuracy: Math.round((correct / total) * 100),
    };
  }

  const nextMistakes = payload.isCorrect
    ? profile.recentMistakes
    : [
        {
          questionId: payload.question.id,
          topic: topics[0],
          answer: payload.userAnswer,
          correctAnswer: payload.correctAnswer,
          mistakeType: payload.analysis?.mistakeType,
          timestamp: Date.now(),
        },
        ...profile.recentMistakes,
      ].slice(0, 12);

  const bank = [...profile.mistakeBank];
  if (!payload.isCorrect) {
    const existing = bank.find((entry) => entry.questionId === payload.question.id);
    if (existing) {
      existing.wrongCount += 1;
      existing.explanation = payload.analysis?.explanation ?? existing.explanation;
      existing.mistakeType = payload.analysis?.mistakeType ?? existing.mistakeType;
      existing.recommendedTopic = payload.analysis?.recommendedTopic ?? existing.recommendedTopic;
      existing.missingConcept = payload.analysis?.missingConcept ?? existing.missingConcept;
      existing.sourceRefs = payload.analysis?.sources ?? existing.sourceRefs;
    } else {
      const entry: MistakeBankEntry = {
        id: crypto.randomUUID().replace(/-/g, '').slice(0, 12),
        questionId: payload.question.id,
        questionText: payload.question.text,
        topic: topics[0],
        userAnswer: payload.userAnswer,
        correctAnswer: payload.correctAnswer,
        explanation: payload.analysis?.explanation,
        mistakeType: payload.analysis?.mistakeType,
        missingConcept: payload.analysis?.missingConcept,
        recommendedTopic: payload.analysis?.recommendedTopic,
        sourceRefs: payload.analysis?.sources,
        createdAt: Date.now(),
        wrongCount: 1,
      };
      bank.unshift(entry);
    }
  }

  const totalAnswered = Object.values(topicAccuracy).reduce((sum, item) => sum + item.total, 0);
  const totalCorrect = Object.values(topicAccuracy).reduce((sum, item) => sum + item.correct, 0);
  const globalAccuracy = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;

  const nextProfile: UserProfileData = {
    ...profile,
    globalAccuracy,
    topicAccuracy,
    currentDifficulty: difficultyFromAccuracy(globalAccuracy),
    recentMistakes: nextMistakes,
    mistakeBank: bank.slice(0, 50),
    recentQuestions: [payload.question.id, ...profile.recentQuestions.filter((id) => id !== payload.question.id)].slice(0, 20),
    updatedAt: Date.now(),
  };
  saveUserProfile(nextProfile);
  return nextProfile;
}

export function getWeakTopicsForProfile(profileId: string): WeakTopic[] {
  const profile = loadUserProfile(profileId);
  return Object.entries(profile.topicAccuracy)
    .map(([topic, stats]) => ({
      topic,
      accuracy: stats.accuracy,
      wrongCount: stats.total - stats.correct,
      total: stats.total,
      recencyScore: profile.recentMistakes.find((mistake) => mistake.topic === topic)?.timestamp ?? 0,
    }))
    .sort((a, b) => a.accuracy - b.accuracy || b.wrongCount - a.wrongCount)
    .slice(0, 5);
}

export function generateFromMistakes(profileId: string) {
  const profile = loadUserProfile(profileId);
  return profile.mistakeBank
    .sort((a, b) => b.wrongCount - a.wrongCount || b.createdAt - a.createdAt)
    .slice(0, 10);
}
