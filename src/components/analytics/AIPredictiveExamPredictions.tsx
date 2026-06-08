import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Target, AlertTriangle, CheckCircle, Clock, Eye } from 'lucide-react';

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
  const [expandedPrediction, setExpandedPrediction] = useState<string | null>(null);

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600 bg-green-50';
    if (score >= 80) return 'text-blue-600 bg-blue-50';
    if (score >= 70) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return 'text-green-600';
    if (confidence >= 75) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800 border-red-300';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'low': return 'bg-green-100 text-green-800 border-green-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'bg-green-100 text-green-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'hard': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {examPredictions.map((prediction, index) => (
          <motion.div
            key={prediction.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.1 }}
            whileHover={{ 
              scale: 1.02, 
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
            }}
            onClick={() => setSelectedPrediction(prediction)}
            className={`bg-white dark:bg-gray-800 rounded-xl p-6 border cursor-pointer ${
              selectedPrediction?.id === prediction.id
                ? 'border-purple-400 dark:border-purple-500 ring-2 ring-purple-200/70 dark:ring-purple-500/30'
                : 'border-gray-200 dark:border-gray-700'
            }`}
          >
            {/* Prediction Header */}
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {prediction.examName}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {prediction.subject}
                </p>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Scor prezis:
                  </span>
                </div>
                <div className={`text-2xl font-bold px-3 py-1 rounded-lg ${getScoreColor(prediction.predictedScore)}`}>
                  {prediction.predictedScore}%
                </div>
              </div>
            </div>

            {/* Exam Info */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <Clock className="w-4 h-4" />
                <span>{prediction.examDate.toLocaleDateString('ro-RO')}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <Target className="w-4 h-4" />
                <span>{prediction.recommendedStudyTime} ore studiu</span>
              </div>
            </div>

            {/* Confidence Level */}
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Nivel încredere:
              </span>
              <div className="flex items-center gap-2">
                <div className="w-24 bg-gray-200 rounded-full h-2">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${prediction.confidenceLevel}%` }}
                    transition={{ duration: 1, delay: index * 0.1 }}
                    className="bg-gradient-to-r from-purple-400 to-purple-600 h-2 rounded-full"
                  />
                </div>
                <span className={`text-sm font-medium ${getConfidenceColor(prediction.confidenceLevel)}`}>
                  {prediction.confidenceLevel}%
                </span>
              </div>
            </div>

            {/* Areas */}
            <div className="space-y-3 mb-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-orange-500" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Zone slabe:
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {prediction.weakAreas.map((area, idx) => (
                    <span key={idx} className="text-xs px-2 py-1 bg-orange-100 text-orange-800 rounded-full">
                      {area}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Zone tari:
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {prediction.strongAreas.map((area, idx) => (
                    <span key={idx} className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded-full">
                      {area}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={(e) => {
                  e.stopPropagation();
                  setExpandedPrediction(expandedPrediction === prediction.id ? null : prediction.id);
                }}
                className="flex-1 px-4 py-2 bg-purple-100 text-purple-700 rounded-lg font-medium hover:bg-purple-200 transition-colors duration-200"
              >
                <Eye className="w-4 h-4 mr-2" />
                Plan studiu
              </motion.button>
              
              {prediction.aiGenerated && (
                <span className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded-full font-medium self-center">
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
                  className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700"
                >
                  <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">
                    Plan de studiu AI optimizat
                  </h4>
                  <div className="space-y-2">
                    {prediction.studyPlan.map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${item.priority === 'high' ? 'bg-red-500' : item.priority === 'medium' ? 'bg-yellow-500' : 'bg-green-500'}`} />
                          <div>
                            <p className="font-medium text-gray-900 dark:text-gray-100">
                              {item.topic}
                            </p>
                            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                              <span className={`px-2 py-1 rounded text-xs ${getPriorityColor(item.priority)}`}>
                                {item.priority}
                              </span>
                              <span className={`px-2 py-1 rounded text-xs ${getDifficultyColor(item.difficulty)}`}>
                                {item.difficulty}
                              </span>
                              <span>{item.estimatedTime} ore</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {item.aiRecommended && (
                            <span className="text-xs text-purple-600">✨ AI</span>
                          )}
                          {item.completed && (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>
    </>
  );
}
