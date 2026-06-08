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

export default function AIPredictiveAnalyticsRefactored({
  userId,
  currentLevel,
  subjects,
}: AIPredictiveAnalyticsProps) {
  void userId;
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

  const examPredictions = useMemo<ExamPrediction[]>(
    () => [
      {
        id: '1',
        examName: `${activeSubjects[0] ?? 'Medicina'} - predictie examen`,
        subject: activeSubjects[0] ?? 'Medicina',
        examDate: new Date(PREDICTION_BASE_TIME + 21 * 24 * 60 * 60 * 1000),
        predictedScore: Math.max(45, accuracy || 72),
        confidenceLevel: Math.min(94, 55 + sessions.length * 6 + quizzes.length * 2),
        recommendedStudyTime: Math.max(45, dueCount * 6 + studyHours * 4),
        weakAreas: trackedTopics.slice(0, 3).map((entry) => entry.topic),
        strongAreas: trackedTopics.filter((entry) => entry.accuracy >= 80).slice(0, 3).map((entry) => entry.topic),
        studyPlan: [
          {
            id: 'sp1',
            topic: 'Sistemul nervos central',
            priority: 'high',
            estimatedTime: 25,
            resources: ['Atlas de anatomie', 'Video-uri explicative'],
            difficulty: 'hard',
            completed: false,
            aiRecommended: true,
          },
          {
            id: 'sp2',
            topic: 'Vascularizatia cerebrala',
            priority: 'high',
            estimatedTime: 20,
            resources: ['Diagrame vasculare', 'Modele 3D'],
            difficulty: 'medium',
            completed: false,
            aiRecommended: true,
          },
        ],
        aiGenerated: true,
      },
      {
        id: '2',
        examName: `${activeSubjects[1] ?? activeSubjects[0] ?? 'Recapitulare'} - test partial`,
        subject: activeSubjects[1] ?? activeSubjects[0] ?? 'Recapitulare',
        examDate: new Date(PREDICTION_BASE_TIME + 10 * 24 * 60 * 60 * 1000),
        predictedScore: Math.max(40, Math.min(96, (accuracy || 68) - 6)),
        confidenceLevel: Math.min(88, 50 + sessions.length * 5 + quizzes.length),
        recommendedStudyTime: Math.max(30, dueCount * 4 + 30),
        weakAreas: trackedTopics.slice(1, 3).map((entry) => entry.topic),
        strongAreas: trackedTopics.filter((entry) => entry.accuracy >= 75).slice(0, 2).map((entry) => entry.topic),
        studyPlan: [
          {
            id: 'sp3',
            topic: 'Sistemul endocrin',
            priority: 'medium',
            estimatedTime: 15,
            resources: ['Textbook fiziologie', 'Lectii video'],
            difficulty: 'medium',
            completed: false,
            aiRecommended: true,
          },
        ],
        aiGenerated: true,
      },
    ],
    [accuracy, activeSubjects, dueCount, quizzes.length, sessions.length, studyHours, trackedTopics],
  );

  const knowledgeGaps = useMemo<KnowledgeGap[]>(
    () => [
      {
        id: '1',
        topic: 'Sistemul nervos central',
        subject: 'Anatomie',
        currentMastery: 45,
        targetMastery: 85,
        gap: 40,
        priority: 'high',
        estimatedTimeToClose: 25,
        recommendedResources: ['Atlas de anatomie', 'Video-uri explicative', 'Modele 3D'],
        aiGenerated: true,
        trends: { improving: true, rate: 2.5 },
      },
      {
        id: '2',
        topic: 'Vascularizatia cerebrala',
        subject: 'Anatomie',
        currentMastery: 60,
        targetMastery: 80,
        gap: 20,
        priority: 'medium',
        estimatedTimeToClose: 15,
        recommendedResources: ['Diagrame vasculare', 'Anatomie clinica'],
        aiGenerated: true,
        trends: { improving: false, rate: -0.5 },
      },
      {
        id: '3',
        topic: 'Sistemul endocrin',
        subject: 'Fiziologie',
        currentMastery: 70,
        targetMastery: 90,
        gap: 20,
        priority: 'low',
        estimatedTimeToClose: 10,
        recommendedResources: ['Textbook fiziologie', 'Articole stiintifice'],
        aiGenerated: false,
        trends: { improving: true, rate: 1.2 },
      },
    ],
    [],
  );

  const studyPaths = useMemo<StudyPathRecommendation[]>(
    () => [
      {
        id: '1',
        title: 'Calea Expert in Anatomie',
        description: 'Program intensiv pentru stapanirea completa a anatomiei umane cu focus pe aplicatii clinice.',
        duration: 12,
        difficulty: 'advanced',
        topics: ['Anatomie sistemica', 'Anatomie topografica', 'Anatomie clinica', 'Neuroanatomie'],
        prerequisites: ['Biologie fundamentala', 'Chimie organica'],
        outcomes: ['Certificare anatomie avansata', 'Pregatire pentru rezidentiat', 'Portofoliu clinic'],
        aiOptimized: true,
        successRate: 94,
        timeCommitment: 20,
      },
      {
        id: '2',
        title: 'Calea Intermediara Fiziologie',
        description: 'Program echilibrat pentru intelegerea profunda a proceselor fiziologice umane.',
        duration: 8,
        difficulty: 'intermediate',
        topics: ['Fiziologie celulara', 'Sistemul nervos', 'Sistemul cardiovascular', 'Homeostazie'],
        prerequisites: ['Biologie fundamentala'],
        outcomes: ['Certificare fiziologie', 'Baze pentru medicina', 'Laborator practic'],
        aiOptimized: true,
        successRate: 87,
        timeCommitment: 15,
      },
      {
        id: '3',
        title: 'Calea Incepator Biochimie',
        description: 'Introducere completa in biochimie cu aplicatii practice in laborator.',
        duration: 6,
        difficulty: 'beginner',
        topics: ['Structura moleculara', 'Enzime', 'Metabolism', 'Biochimie clinica'],
        prerequisites: ['Chimie generala'],
        outcomes: ['Certificare biochimie', 'Competente de laborator', 'Baze pentru cercetare'],
        aiOptimized: false,
        successRate: 82,
        timeCommitment: 10,
      },
    ],
    [],
  );

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
