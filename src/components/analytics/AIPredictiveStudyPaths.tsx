import { motion } from 'framer-motion';
import { BookOpen, CheckCircle, Users, Target } from 'lucide-react';

interface StudyPathRecommendation {
  id: string;
  title: string;
  description: string;
  duration: number; // weeks
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  topics: string[];
  prerequisites: string[];
  outcomes: string[];
  aiOptimized: boolean;
  successRate: number;
  timeCommitment: number; // hours per week
}

interface AIPredictiveStudyPathsProps {
  studyPaths: StudyPathRecommendation[];
}

export default function AIPredictiveStudyPaths({ studyPaths }: AIPredictiveStudyPathsProps) {
  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'bg-green-100 text-green-800';
      case 'intermediate': return 'bg-yellow-100 text-yellow-800';
      case 'advanced': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getSuccessRateColor = (rate: number) => {
    if (rate >= 90) return 'text-green-600';
    if (rate >= 75) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getDifficultyIcon = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return '🟢';
      case 'intermediate': return '🟡';
      case 'advanced': return '🔴';
      default: return '⚪';
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {studyPaths.map((path, index) => (
        <motion.div
          key={path.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
          whileHover={{ 
            scale: 1.02, 
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
          }}
          className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700"
        >
          {/* Path Header */}
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                {path.title}
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-lg">{getDifficultyIcon(path.difficulty)}</span>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${getDifficultyColor(path.difficulty)}`}>
                  {path.difficulty.toUpperCase()}
                </span>
                {path.aiOptimized && (
                  <span className="text-xs px-2 py-1 bg-purple-100 text-purple-800 rounded-full font-medium">
                    ✨ AI Optimizat
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Path Description */}
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            {path.description}
          </p>

          {/* Path Stats */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-blue-500" />
              <div>
                <p className="text-xs text-gray-500">Durată</p>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {path.duration} săptămâni
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-green-500" />
              <div>
                <p className="text-xs text-gray-500">Rată succes</p>
                <p className={`text-sm font-medium ${getSuccessRateColor(path.successRate)}`}>
                  {path.successRate}%
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-purple-500" />
              <div>
                <p className="text-xs text-gray-500">Timp/săptămână</p>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {path.timeCommitment} ore
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-orange-500" />
              <div>
                <p className="text-xs text-gray-500">Rezultate</p>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {path.outcomes.length} obiective
                </p>
              </div>
            </div>
          </div>

          {/* Topics */}
          <div className="mb-4">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Subiecte acoperite:
            </h4>
            <div className="flex flex-wrap gap-2">
              {path.topics.map((topic, idx) => (
                <span key={idx} className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded-full">
                  {topic}
                </span>
              ))}
            </div>
          </div>

          {/* Prerequisites */}
          {path.prerequisites.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Cerințe preliminare:
              </h4>
              <div className="flex flex-wrap gap-2">
                {path.prerequisites.map((prereq, idx) => (
                  <span key={idx} className="text-xs px-2 py-1 bg-gray-100 text-gray-800 rounded-full">
                    {prereq}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Outcomes */}
          <div className="mb-4">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Rezultate așteptate:
            </h4>
            <ul className="space-y-1">
              {path.outcomes.map((outcome, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <CheckCircle className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>{outcome}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Action Button */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full py-3 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-lg font-medium hover:from-purple-600 hover:to-blue-600 transition-all duration-200"
          >
            Începe Calea de Studiu
          </motion.button>
        </motion.div>
      ))}
    </div>
  );
}
