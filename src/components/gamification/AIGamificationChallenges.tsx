import { motion } from 'framer-motion';
import { Target, Clock, Rocket } from 'lucide-react';

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
  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'bg-green-100 text-green-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'hard': return 'bg-orange-100 text-orange-800';
      case 'expert': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
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
      {challenges.map((challenge, index) => (
        <motion.div
          key={challenge.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
          whileHover={{ scale: 1.02 }}
          className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 hover:shadow-lg transition-all duration-200"
        >
          <div className="flex items-start justify-between mb-4">
            <div className="p-2 bg-gradient-to-br from-orange-100 to-red-100 rounded-lg">
              <Target className="w-5 h-5 text-orange-600" />
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded-full font-medium">
                {challenge.type === 'daily' ? 'Zilnic' :
                 challenge.type === 'weekly' ? 'Săptămânal' : 'Adaptiv'}
              </span>
              {challenge.aiGenerated && (
                <span className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded-full font-medium">
                  ✨ AI Generated
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">{getDifficultyIcon(challenge.difficulty)}</span>
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${getDifficultyColor(challenge.difficulty)}`}>
              {challenge.difficulty.toUpperCase()}
            </span>
          </div>

          <h3 className="font-bold text-lg mb-2 text-gray-900 dark:text-gray-100">
            {challenge.title}
          </h3>
          
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            {challenge.description}
          </p>

          <div className="space-y-3 mb-4">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Clock className="w-4 h-4" />
              <span>{challenge.timeLimit} minute{challenge.timeLimit !== 1 ? 'e' : ''}</span>
            </div>
            
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Target className="w-4 h-4" />
              <span>{challenge.points} puncte</span>
            </div>

            {challenge.requirements && challenge.requirements.length > 0 && (
              <div className="text-sm text-gray-500">
                <span className="font-medium">Cerințe:</span>
                <ul className="mt-1 space-y-1">
                  {challenge.requirements.map((req, idx) => (
                    <li key={idx} className="flex items-center gap-1">
                      <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
                      <span>{req.value} {req.type.replace('_', ' ')}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${challenge.progress}%` }}
              transition={{ duration: 1, delay: index * 0.1 }}
              className="bg-gradient-to-r from-blue-400 to-blue-600 h-2 rounded-full"
            />
          </div>

          <div className="flex justify-between items-center mb-4">
            <span className="text-xs text-gray-500">Progres</span>
            <span className="text-xs font-medium text-gray-700">{challenge.progress}%</span>
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg font-medium hover:from-orange-600 hover:to-red-600 transition-all duration-200"
          >
            <Rocket className="w-4 h-4 mr-2" />
            Începe Provocarea
          </motion.button>
        </motion.div>
      ))}
    </div>
  );
}
