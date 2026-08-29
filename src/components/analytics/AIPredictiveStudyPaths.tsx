import { motion } from 'framer-motion';
import { BookOpen, CheckCircle, Users, Target } from 'lucide-react';
import { useTheme } from '../../theme/ThemeContext';

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
  const theme = useTheme();

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return theme.success;
      case 'intermediate': return theme.warning;
      case 'advanced': return theme.danger;
      default: return theme.text3;
    }
  };

  const getSuccessRateColor = (rate: number) => {
    if (rate >= 90) return theme.success;
    if (rate >= 75) return theme.warning;
    return theme.danger;
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
      {studyPaths.map((path, index) => {
        const difficultyColor = getDifficultyColor(path.difficulty);
        return (
        <motion.div
          key={path.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
          whileHover={{ scale: 1.015 }}
          className="glass-panel rounded-[24px] p-6"
        >
          {/* Path Header */}
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold mb-2" style={{ color: theme.text }}>
                {path.title}
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-lg">{getDifficultyIcon(path.difficulty)}</span>
                <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ background: `${difficultyColor}18`, color: difficultyColor }}>
                  {path.difficulty.toUpperCase()}
                </span>
                {path.aiOptimized && (
                  <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ background: `${theme.accent}18`, color: theme.accent }}>
                    ✨ AI Optimizat
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Path Description */}
          <p className="text-sm mb-4" style={{ color: theme.text3 }}>
            {path.description}
          </p>

          {/* Path Stats */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4" style={{ color: theme.accent2 }} />
              <div>
                <p className="text-xs" style={{ color: theme.text3 }}>Durată</p>
                <p className="text-sm font-medium" style={{ color: theme.text }}>
                  {path.duration} săptămâni
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Target className="w-4 h-4" style={{ color: theme.success }} />
              <div>
                <p className="text-xs" style={{ color: theme.text3 }}>Relevanță pentru tine</p>
                <p className="text-sm font-medium" style={{ color: getSuccessRateColor(path.successRate) }}>
                  {path.successRate}%
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Users className="w-4 h-4" style={{ color: theme.accent }} />
              <div>
                <p className="text-xs" style={{ color: theme.text3 }}>Timp/săptămână</p>
                <p className="text-sm font-medium" style={{ color: theme.text }}>
                  {path.timeCommitment} ore
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" style={{ color: theme.warning }} />
              <div>
                <p className="text-xs" style={{ color: theme.text3 }}>Rezultate</p>
                <p className="text-sm font-medium" style={{ color: theme.text }}>
                  {path.outcomes.length} obiective
                </p>
              </div>
            </div>
          </div>

          {/* Topics */}
          <div className="mb-4">
            <h4 className="text-sm font-medium mb-2" style={{ color: theme.text2 }}>
              Subiecte acoperite:
            </h4>
            <div className="flex flex-wrap gap-2">
              {path.topics.map((topic, idx) => (
                <span key={idx} className="text-xs px-2 py-1 rounded-full" style={{ background: theme.surface2, color: theme.text2 }}>
                  {topic}
                </span>
              ))}
            </div>
          </div>

          {/* Prerequisites */}
          {path.prerequisites.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-medium mb-2" style={{ color: theme.text2 }}>
                Cerințe preliminare:
              </h4>
              <div className="flex flex-wrap gap-2">
                {path.prerequisites.map((prereq, idx) => (
                  <span key={idx} className="text-xs px-2 py-1 rounded-full" style={{ background: theme.surface2, color: theme.text3 }}>
                    {prereq}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Outcomes */}
          <div className="mb-4">
            <h4 className="text-sm font-medium mb-2" style={{ color: theme.text2 }}>
              Rezultate așteptate:
            </h4>
            <ul className="space-y-1">
              {path.outcomes.map((outcome, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm" style={{ color: theme.text3 }}>
                  <CheckCircle className="w-3 h-3 mt-0.5 flex-shrink-0" style={{ color: theme.success }} />
                  <span>{outcome}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Action Button */}
          <motion.button
            whileHover={{ scale: 1.015 }}
            whileTap={{ scale: 0.93, transition: { type: 'spring', stiffness: 500, damping: 15 } }}
            className="press-feedback w-full py-3 rounded-lg font-medium transition-colors duration-200"
            style={{ background: theme.accent, color: '#fff' }}
          >
            Începe Calea de Studiu
          </motion.button>
        </motion.div>
        );
      })}
    </div>
  );
}
