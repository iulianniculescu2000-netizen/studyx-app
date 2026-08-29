import { motion } from 'framer-motion';
import { Target, Clock, Rocket } from 'lucide-react';
import { useTheme } from '../../theme/ThemeContext';

interface Challenge {
  id: string;
  title: string;
  description: string;
  type: 'daily' | 'weekly' | 'adaptive';
  difficulty: 'easy' | 'medium' | 'hard' | 'expert';
  points: number;
  timeLimit: number; // minutes
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

interface AIGamificationChallengesProps {
  challenges: Challenge[];
}

export default function AIGamificationChallenges({ challenges }: AIGamificationChallengesProps) {
  const theme = useTheme();

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return theme.success;
      case 'medium': return theme.warning;
      case 'hard': return '#FF9F0A';
      case 'expert': return theme.danger;
      default: return theme.text3;
    }
  };

  const getDifficultyIcon = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return '🟢';
      case 'medium': return '🟡';
      case 'hard': return '🟠';
      case 'expert': return '🔴';
      default: return '⚪';
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {challenges.map((challenge, index) => {
        const difficultyColor = getDifficultyColor(challenge.difficulty);
        return (
        <motion.div
          key={challenge.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
          whileHover={{ scale: 1.02 }}
          className="glass-panel rounded-xl p-6 transition-all duration-200"
        >
          <div className="flex items-start justify-between mb-4">
            <div className="p-2 rounded-lg" style={{ background: `${theme.accent2}18` }}>
              <Target className="w-5 h-5" style={{ color: theme.accent2 }} />
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ background: `${theme.accent}18`, color: theme.accent }}>
                {challenge.type === 'daily' ? 'Zilnic' :
                 challenge.type === 'weekly' ? 'Săptămânal' : 'Adaptiv'}
              </span>
              {challenge.aiGenerated && (
                <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ background: `${theme.success}18`, color: theme.success }}>
                  ✨ AI Generated
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">{getDifficultyIcon(challenge.difficulty)}</span>
            <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ background: `${difficultyColor}18`, color: difficultyColor }}>
              {challenge.difficulty.toUpperCase()}
            </span>
          </div>

          <h3 className="font-bold text-lg mb-2" style={{ color: theme.text }}>
            {challenge.title}
          </h3>

          <p className="text-sm mb-4" style={{ color: theme.text3 }}>
            {challenge.description}
          </p>

          <div className="space-y-3 mb-4">
            <div className="flex items-center gap-2 text-sm" style={{ color: theme.text3 }}>
              <Clock className="w-4 h-4" />
              <span>{challenge.timeLimit} minute{challenge.timeLimit !== 1 ? 'e' : ''}</span>
            </div>

            <div className="flex items-center gap-2 text-sm" style={{ color: theme.text3 }}>
              <Target className="w-4 h-4" />
              <span>{challenge.points} puncte</span>
            </div>

            {challenge.requirements && challenge.requirements.length > 0 && (
              <div className="text-sm" style={{ color: theme.text3 }}>
                <span className="font-medium">Cerințe:</span>
                <ul className="mt-1 space-y-1">
                  {challenge.requirements.map((req, idx) => (
                    <li key={idx} className="flex items-center gap-1">
                      <span className="w-1 h-1 rounded-full" style={{ background: theme.text3 }}></span>
                      <span>{req.value} {req.type.replace('_', ' ')}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="w-full rounded-full h-2 mb-3" style={{ background: theme.surface2 }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${challenge.progress}%` }}
              transition={{ duration: 1, delay: index * 0.1 }}
              className="h-2 rounded-full"
              style={{ background: theme.accent }}
            />
          </div>

          <div className="flex justify-between items-center mb-4">
            <span className="text-xs" style={{ color: theme.text3 }}>Progres</span>
            <span className="text-xs font-medium" style={{ color: theme.text2 }}>{challenge.progress}%</span>
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full py-3 rounded-lg font-medium transition-all duration-200"
            style={{ background: theme.accent2, color: '#fff' }}
          >
            <Rocket className="w-4 h-4 mr-2" />
            Începe Provocarea
          </motion.button>
        </motion.div>
        );
      })}
    </div>
  );
}
