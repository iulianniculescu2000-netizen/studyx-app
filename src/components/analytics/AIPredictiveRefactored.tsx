import { useMemo, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import AIPredictiveExamPredictions from './AIPredictiveExamPredictions';
import AIPredictiveHeader from './AIPredictiveHeader';
import AIPredictiveKnowledgeGaps from './AIPredictiveKnowledgeGaps';
import AIPredictiveStudyPaths from './AIPredictiveStudyPaths';
import AIPredictiveTabs from './AIPredictiveTabs';
import AIPredictiveTimeframe from './AIPredictiveTimeframe';
import { useQuizStore } from '../../store/quizStore';
import { useStatsStore } from '../../store/statsStore';
import { loadUserProfile } from '../../ai/UserProfile';

interface ExamPrediction {
  id: string;
  examName: string;
  subject: string;
  examDate: Date;
  predictedScore: number;
  confidenceLevel: number;
  recommendedStudyTime: number;
  weakAreas: string[];
  strongAreas: string[];
  studyPlan: StudyPlanItem[];
  aiGenerated: boolean;
}

interface StudyPlanItem {
  id: string;
  topic: string;
  priority: 'high' | 'medium' | 'low';
  estimatedTime: number;
  resources: string[];
  difficulty: 'easy' | 'medium' | 'hard';
  completed: boolean;
  aiRecommended: boolean;
}

interface KnowledgeGap {
  id: string;
  topic: string;
  subject: string;
  currentMastery: number;
  targetMastery: number;
  gap: number;
  priority: 'high' | 'medium' | 'low';
  estimatedTimeToClose: number;
  recommendedResources: string[];
  aiGenerated: boolean;
  trends: {
    improving: boolean;
    rate: number;
  };
}

interface StudyPathRecommendation {
  id: string;
  title: string;
  description: string;
  duration: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  topics: string[];
  prerequisites: string[];
  outcomes: string[];
  aiOptimized: boolean;
  successRate: number;
  timeCommitment: number;
}

interface AIPredictiveAnalyticsProps {
  userId: string;
  currentLevel: number;
  subjects: string[];
}

const PREDICTION_BASE_TIME = Date.now();

interface TrackedTopic {
  topic: string;
  accuracy: number;
  total: number;
}

// Turns a slice of real weak-topic stats into concrete study-plan items instead of the
// fixed "Sistemul nervos central" placeholders that used to show up regardless of subject.
function buildStudyPlan(topics: TrackedTopic[]): StudyPlanItem[] {
  if (topics.length === 0) {
    return [{
      id: 'sp-onboarding',
      topic: 'Fă câteva grile ca să primești un plan personalizat',
      priority: 'medium',
      estimatedTime: 10,
      resources: ['Creează sau importă o grilă și răspunde câteva runde'],
      difficulty: 'easy',
      completed: false,
      aiRecommended: false,
    }];
  }
  return topics.map((entry, index) => ({
    id: `sp-${entry.topic}-${index}`,
    topic: entry.topic,
    priority: entry.accuracy < 50 ? 'high' : entry.accuracy < 75 ? 'medium' : 'low',
    estimatedTime: Math.max(10, Math.round((85 - entry.accuracy) / 3)),
    resources: ['Sesiune de recuperare focusată', 'Întreabă AI-ul din Biblioteca AI despre acest topic'],
    difficulty: entry.accuracy < 50 ? 'hard' : entry.accuracy < 75 ? 'medium' : 'easy',
    completed: false,
    aiRecommended: true,
  }));
}

export default function AIPredictiveAnalyticsRefactored({
  userId,
  currentLevel,
  subjects,
}: AIPredictiveAnalyticsProps) {
  const [activeTab, setActiveTab] = useState<'predictions' | 'gaps' | 'paths'>('predictions');
  const [selectedPrediction, setSelectedPrediction] = useState<ExamPrediction | null>(null);
  const [timeframe, setTimeframe] = useState<'week' | 'month' | 'semester'>('semester');
  const quizzes = useQuizStore((state) => state.quizzes);
  const sessions = useQuizStore((state) => state.sessions);
  const getAccuracy = useStatsStore((state) => state.getAccuracy);
  const getDueQuestions = useStatsStore((state) => state.getDueQuestions);
  const getStatsByTag = useStatsStore((state) => state.getStatsByTag);
  const totalStudyTime = useStatsStore((state) => state.totalStudyTime);
  const accuracy = getAccuracy();
  const dueCount = getDueQuestions().length;
  const tagStats = useMemo(() => getStatsByTag(quizzes), [getStatsByTag, quizzes]);
  const trackedTopics = useMemo(
    () => Object.entries(tagStats)
      .map(([topic, stat]) => ({
        topic,
        accuracy: stat.total > 0 ? Math.round((stat.correct / stat.total) * 100) : 0,
        total: stat.total,
      }))
      .sort((a, b) => a.accuracy - b.accuracy || b.total - a.total),
    [tagStats],
  );
  const activeSubjects = useMemo(
    () => (trackedTopics.length > 0
      ? trackedTopics.slice(0, 3).map((entry) => entry.topic)
      : (subjects.length > 0 ? subjects : ['Medicina'])),
    [subjects, trackedTopics],
  );
  const studyHours = Math.max(1, Math.round(totalStudyTime / 3600));

  // accuracy is 0 both when the student has answered nothing yet AND when they
  // are genuinely getting everything wrong — `accuracy || 72` treated both the
  // same way, silently swapping a real 0% for a fabricated "72% predicted
  // score". trackedTopics (real answered questions) is the only reliable
  // "do we actually have data" signal; absent that, fall back to the same
  // neutral 50 baseline already used below for study-path relevance.
  const hasRealData = trackedTopics.length > 0;

  const examPredictions = useMemo<ExamPrediction[]>(
    () => [
      {
        id: '1',
        examName: `${activeSubjects[0] ?? 'Medicina'} - predictie examen`,
        subject: activeSubjects[0] ?? 'Medicina',
        examDate: new Date(PREDICTION_BASE_TIME + 21 * 24 * 60 * 60 * 1000),
        predictedScore: hasRealData ? Math.max(45, accuracy) : 50,
        confidenceLevel: Math.min(94, 55 + sessions.length * 6 + quizzes.length * 2),
        recommendedStudyTime: Math.max(45, dueCount * 6 + studyHours * 4),
        weakAreas: trackedTopics.slice(0, 3).map((entry) => entry.topic),
        strongAreas: trackedTopics.filter((entry) => entry.accuracy >= 80).slice(0, 3).map((entry) => entry.topic),
        studyPlan: buildStudyPlan(trackedTopics.slice(0, 2)),
        aiGenerated: true,
      },
      {
        id: '2',
        examName: `${activeSubjects[1] ?? activeSubjects[0] ?? 'Recapitulare'} - test partial`,
        subject: activeSubjects[1] ?? activeSubjects[0] ?? 'Recapitulare',
        examDate: new Date(PREDICTION_BASE_TIME + 10 * 24 * 60 * 60 * 1000),
        predictedScore: hasRealData ? Math.max(40, Math.min(96, accuracy - 6)) : 50,
        confidenceLevel: Math.min(88, 50 + sessions.length * 5 + quizzes.length),
        recommendedStudyTime: Math.max(30, dueCount * 4 + 30),
        weakAreas: trackedTopics.slice(1, 3).map((entry) => entry.topic),
        strongAreas: trackedTopics.filter((entry) => entry.accuracy >= 75).slice(0, 2).map((entry) => entry.topic),
        studyPlan: buildStudyPlan(trackedTopics.slice(2, 3)),
        aiGenerated: true,
      },
    ],
    [accuracy, activeSubjects, dueCount, hasRealData, quizzes.length, sessions.length, studyHours, trackedTopics],
  );

  const knowledgeGaps = useMemo<KnowledgeGap[]>(() => {
    const TARGET_MASTERY = 85;
    const profile = loadUserProfile(userId);
    const recentTopicMisses = new Map<string, number>();
    for (const mistake of profile.recentMistakes) {
      recentTopicMisses.set(mistake.topic, (recentTopicMisses.get(mistake.topic) ?? 0) + 1);
    }

    return trackedTopics
      .filter((entry) => entry.total >= 2 && entry.accuracy < TARGET_MASTERY)
      .slice(0, 5)
      .map((entry, index) => {
        const gap = TARGET_MASTERY - entry.accuracy;
        const recentMisses = recentTopicMisses.get(entry.topic) ?? 0;
        // No per-topic time series is stored, so a real weekly rate can't be measured —
        // this treats "no recent mistakes despite a real history of attempts" as the
        // closest honest proxy for "improving" instead of a fabricated percentage.
        const improving = recentMisses === 0 && entry.total > 2;
        return {
          id: `gap-${entry.topic}-${index}`,
          topic: entry.topic,
          subject: activeSubjects[Math.min(index, activeSubjects.length - 1)] ?? 'Recapitulare',
          currentMastery: entry.accuracy,
          targetMastery: TARGET_MASTERY,
          gap,
          priority: gap >= 35 ? 'high' : gap >= 15 ? 'medium' : 'low',
          estimatedTimeToClose: Math.max(2, Math.round(gap / 4)),
          recommendedResources: ['Sesiune de recuperare focusată', 'Întreabă AI-ul din Biblioteca AI despre acest topic'],
          aiGenerated: true,
          trends: {
            improving,
            rate: improving ? Math.min(3, 1 + entry.total * 0.1) : -Math.min(3, 1 + recentMisses * 0.5),
          },
        };
      });
  }, [trackedTopics, activeSubjects, userId]);

  // Static curriculum catalog (duration/topics/prerequisites are real course structure, not
  // per-user analytics). Only `successRate` used to be fabricated per-path (94/87/82% —
  // impossible to know honestly in a single-user app with no cohort to measure against), so
  // it's replaced with a relevance score: how much this path overlaps the student's own real
  // weak topics, which is something we can actually compute.
  const rawStudyPaths = useMemo(
    () => [
      {
        id: '1',
        title: 'Calea Expert in Anatomie',
        description: 'Program intensiv pentru stapanirea completa a anatomiei umane cu focus pe aplicatii clinice.',
        duration: 12,
        difficulty: 'advanced' as const,
        topics: ['Anatomie sistemica', 'Anatomie topografica', 'Anatomie clinica', 'Neuroanatomie'],
        prerequisites: ['Biologie fundamentala', 'Chimie organica'],
        outcomes: ['Certificare anatomie avansata', 'Pregatire pentru rezidentiat', 'Portofoliu clinic'],
        timeCommitment: 20,
      },
      {
        id: '2',
        title: 'Calea Intermediara Fiziologie',
        description: 'Program echilibrat pentru intelegerea profunda a proceselor fiziologice umane.',
        duration: 8,
        difficulty: 'intermediate' as const,
        topics: ['Fiziologie celulara', 'Sistemul nervos', 'Sistemul cardiovascular', 'Homeostazie'],
        prerequisites: ['Biologie fundamentala'],
        outcomes: ['Certificare fiziologie', 'Baze pentru medicina', 'Laborator practic'],
        timeCommitment: 15,
      },
      {
        id: '3',
        title: 'Calea Incepator Biochimie',
        description: 'Introducere completa in biochimie cu aplicatii practice in laborator.',
        duration: 6,
        difficulty: 'beginner' as const,
        topics: ['Structura moleculara', 'Enzime', 'Metabolism', 'Biochimie clinica'],
        prerequisites: ['Chimie generala'],
        outcomes: ['Certificare biochimie', 'Competente de laborator', 'Baze pentru cercetare'],
        timeCommitment: 10,
      },
    ],
    [],
  );

  const studyPaths = useMemo<StudyPathRecommendation[]>(() => {
    const normalize = (value: string) => value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const relevanceFor = (pathTopics: string[]) => {
      if (trackedTopics.length === 0) return 50; // no data yet — neutral baseline
      const normalizedPathTopics = pathTopics.map(normalize);
      const matches = trackedTopics.filter((entry) => {
        const topic = normalize(entry.topic);
        return normalizedPathTopics.some((pt) => pt.includes(topic) || topic.includes(pt));
      });
      if (matches.length === 0) return 50;
      const avgGap = matches.reduce((sum, m) => sum + Math.max(0, 85 - m.accuracy), 0) / matches.length;
      return Math.round(Math.min(97, 55 + avgGap * 0.5));
    };

    return rawStudyPaths.map((path) => {
      const successRate = relevanceFor(path.topics);
      return { ...path, successRate, aiOptimized: successRate >= 65 };
    });
  }, [rawStudyPaths, trackedTopics]);

  return (
    <div className="max-w-7xl mx-auto p-6">
      <AIPredictiveHeader currentLevel={currentLevel} subjects={activeSubjects} />
      <AIPredictiveTimeframe timeframe={timeframe} setTimeframe={setTimeframe} />
      <AIPredictiveTabs activeTab={activeTab} setActiveTab={setActiveTab} />

      <AnimatePresence mode="wait">
        {activeTab === 'predictions' && (
          <AIPredictiveExamPredictions
            key="predictions"
            examPredictions={examPredictions}
            selectedPrediction={selectedPrediction}
            setSelectedPrediction={setSelectedPrediction}
          />
        )}

        {activeTab === 'gaps' && (
          <AIPredictiveKnowledgeGaps key="gaps" knowledgeGaps={knowledgeGaps} />
        )}

        {activeTab === 'paths' && (
          <AIPredictiveStudyPaths key="paths" studyPaths={studyPaths} />
        )}
      </AnimatePresence>
    </div>
  );
}
