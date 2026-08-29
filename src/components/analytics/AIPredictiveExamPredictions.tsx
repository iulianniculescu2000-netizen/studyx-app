import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Target, AlertTriangle, CheckCircle, Clock, Eye } from 'lucide-react';
import { useTheme } from '../../theme/ThemeContext';

interface StudyPlanItem {
  id: string;
  topic: string;
  priority: 'high' | 'medium' | 'low';
  estimatedTime: number; // hours
  resources: string[];
  difficulty: 'easy' | 'medium' | 'hard';
  completed: boolean;
  aiRecommended: boolean;
}

interface ExamPrediction {
  id: string;
  examName: string;
  subject: string;
  examDate: Date;
  predictedScore: number;
  confidenceLevel: number;
  recommendedStudyTime: number; // hours
  weakAreas: string[];
  strongAreas: string[];
  studyPlan: StudyPlanItem[];
  aiGenerated: boolean;
}

interface AIPredictiveExamPredictionsProps {
  examPredictions: ExamPrediction[];
  selectedPrediction: ExamPrediction | null;
  setSelectedPrediction: (prediction: ExamPrediction | null) => void;
}

export default function AIPredictiveExamPredictions({
  examPredictions,
  selectedPrediction,
  setSelectedPrediction
}: AIPredictiveExamPredictionsProps) {
  const theme = useTheme();
  const [expandedPrediction, setExpandedPrediction] = useState<string | null>(null);

  const getScoreColor = (score: number) => {
    if (score >= 90) return theme.success;
    if (score >= 80) return theme.accent2;
    if (score >= 70) return theme.warning;
    return theme.danger;
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return theme.success;
    if (confidence >= 75) return theme.warning;
    return theme.danger;
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return theme.danger;
      case 'medium': return theme.warning;
      case 'low': return theme.success;
      default: return theme.text3;
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return theme.success;
      case 'medium': return theme.warning;
      case 'hard': return theme.danger;
      default: return theme.text3;
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {examPredictions.map((prediction, index) => {
          const selected = selectedPrediction?.id === prediction.id;
          const scoreColor = getScoreColor(prediction.predictedScore);
          return (
          <motion.div
            key={prediction.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.1 }}
            whileHover={{ scale: 1.015 }}
            onClick={() => setSelectedPrediction(prediction)}
            className="glass-panel rounded-[24px] p-6 cursor-pointer"
            style={{ borderColor: selected ? `${theme.accent}60` : undefined, boxShadow: selected ? `0 0 0 2px ${theme.accent}30` : undefined }}
          >
            {/* Prediction Header */}
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold" style={{ color: theme.text }}>
                  {prediction.examName}
                </h3>
                <p className="text-sm" style={{ color: theme.text3 }}>
                  {prediction.subject}
                </p>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-medium" style={{ color: theme.text2 }}>
                    Scor prezis:
                  </span>
                </div>
                <div className="text-2xl font-bold px-3 py-1 rounded-lg" style={{ color: scoreColor, background: `${scoreColor}18` }}>
                  {prediction.predictedScore}%
                </div>
              </div>
            </div>

            {/* Exam Info */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="flex items-center gap-2 text-sm" style={{ color: theme.text3 }}>
                <Clock className="w-4 h-4" />
                <span>{prediction.examDate.toLocaleDateString('ro-RO')}</span>
              </div>
              <div className="flex items-center gap-2 text-sm" style={{ color: theme.text3 }}>
                <Target className="w-4 h-4" />
                <span>{prediction.recommendedStudyTime} ore studiu</span>
              </div>
            </div>

            {/* Confidence Level */}
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium" style={{ color: theme.text2 }}>
                Nivel încredere:
              </span>
              <div className="flex items-center gap-2">
                <div className="w-24 rounded-full h-2" style={{ background: theme.surface2 }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${prediction.confidenceLevel}%` }}
                    transition={{ duration: 1, delay: index * 0.1 }}
                    className="h-2 rounded-full"
                    style={{ background: theme.accent }}
                  />
                </div>
                <span className="text-sm font-medium" style={{ color: getConfidenceColor(prediction.confidenceLevel) }}>
                  {prediction.confidenceLevel}%
                </span>
              </div>
            </div>

            {/* Areas */}
            <div className="space-y-3 mb-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4" style={{ color: theme.warning }} />
                  <span className="text-sm font-medium" style={{ color: theme.text2 }}>
                    Zone slabe:
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {prediction.weakAreas.map((area, idx) => (
                    <span key={idx} className="text-xs px-2 py-1 rounded-full" style={{ background: `${theme.warning}18`, color: theme.warning }}>
                      {area}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-4 h-4" style={{ color: theme.success }} />
                  <span className="text-sm font-medium" style={{ color: theme.text2 }}>
                    Zone tari:
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {prediction.strongAreas.map((area, idx) => (
                    <span key={idx} className="text-xs px-2 py-1 rounded-full" style={{ background: `${theme.success}18`, color: theme.success }}>
                      {area}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <motion.button
                whileHover={{ scale: 1.015 }}
                whileTap={{ scale: 0.93, transition: { type: 'spring', stiffness: 500, damping: 15 } }}
                onClick={(e) => {
                  e.stopPropagation();
                  setExpandedPrediction(expandedPrediction === prediction.id ? null : prediction.id);
                }}
                className="press-feedback flex-1 px-4 py-2 rounded-lg font-medium transition-colors duration-200 flex items-center justify-center"
                style={{ background: `${theme.accent}18`, color: theme.accent }}
              >
                <Eye className="w-4 h-4 mr-2" />
                Plan studiu
              </motion.button>

              {prediction.aiGenerated && (
                <span className="text-xs px-2 py-1 rounded-full font-medium self-center" style={{ background: `${theme.success}18`, color: theme.success }}>
                  ✨ AI
                </span>
              )}
            </div>

            {/* Expanded Study Plan */}
            <AnimatePresence>
              {expandedPrediction === prediction.id && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                  className="mt-4 pt-4 border-t"
                  style={{ borderColor: theme.border }}
                >
                  <h4 className="font-semibold mb-3" style={{ color: theme.text }}>
                    Plan de studiu AI optimizat
                  </h4>
                  <div className="space-y-2">
                    {prediction.studyPlan.map((item) => {
                      const dotColor = item.priority === 'high' ? theme.danger : item.priority === 'medium' ? theme.warning : theme.success;
                      const priorityColor = getPriorityColor(item.priority);
                      const difficultyColor = getDifficultyColor(item.difficulty);
                      return (
                      <div key={item.id} className="flex items-center justify-between p-3 rounded-lg" style={{ background: theme.surface2 }}>
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full" style={{ background: dotColor }} />
                          <div>
                            <p className="font-medium" style={{ color: theme.text }}>
                              {item.topic}
                            </p>
                            <div className="flex items-center gap-2 text-sm" style={{ color: theme.text3 }}>
                              <span className="px-2 py-1 rounded text-xs" style={{ background: `${priorityColor}18`, color: priorityColor }}>
                                {item.priority}
                              </span>
                              <span className="px-2 py-1 rounded text-xs" style={{ background: `${difficultyColor}18`, color: difficultyColor }}>
                                {item.difficulty}
                              </span>
                              <span>{item.estimatedTime} ore</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {item.aiRecommended && (
                            <span className="text-xs" style={{ color: theme.accent }}>✨ AI</span>
                          )}
                          {item.completed && (
                            <CheckCircle className="w-4 h-4" style={{ color: theme.success }} />
                          )}
                        </div>
                      </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
          );
        })}
      </div>
    </>
  );
}
