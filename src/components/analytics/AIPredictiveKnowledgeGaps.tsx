import { motion } from 'framer-motion';
import { AlertTriangle, Lightbulb, Activity, Zap } from 'lucide-react';

interface KnowledgeGap {
  id: string;
  topic: string;
  subject: string;
  currentMastery: number; // 0-100
  targetMastery: number; // 0-100
  gap: number; // target - current
  priority: 'high' | 'medium' | 'low';
  estimatedTimeToClose: number; // hours
  recommendedResources: string[];
  aiGenerated: boolean;
  trends: {
    improving: boolean;
    rate: number; // mastery change per week
  };
}

interface AIPredictiveKnowledgeGapsProps {
  knowledgeGaps: KnowledgeGap[];
}

export default function AIPredictiveKnowledgeGaps({ knowledgeGaps }: AIPredictiveKnowledgeGapsProps) {
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800 border-red-300';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'low': return 'bg-green-100 text-green-800 border-green-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getMasteryColor = (mastery: number) => {
    if (mastery >= 80) return 'text-green-600 bg-green-50';
    if (mastery >= 60) return 'text-yellow-600 bg-yellow-50';
    if (mastery >= 40) return 'text-orange-600 bg-orange-50';
    return 'text-red-600 bg-red-50';
  };

  const getTrendIcon = (improving: boolean) => {
    return improving ? '📈' : '📉';
  };

  const getTrendColor = (improving: boolean) => {
    return improving ? 'text-green-600' : 'text-red-600';
  };

  return (
    <div className="space-y-6">
      {knowledgeGaps.map((gap, index) => (
        <motion.div
          key={gap.id}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.1 }}
          className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700"
        >
          {/* Gap Header */}
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
                {gap.topic}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {gap.subject}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${getPriorityColor(gap.priority)}`}>
                {gap.priority.toUpperCase()}
              </span>
              {gap.aiGenerated && (
                <span className="text-xs px-2 py-1 bg-purple-100 text-purple-800 rounded-full font-medium">
                  ✨ AI
                </span>
              )}
            </div>
          </div>

          {/* Mastery Progress */}
          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Nivel de stăpânire
              </span>
              <div className="flex items-center gap-2">
                <span className={`text-sm font-medium ${getMasteryColor(gap.currentMastery)}`}>
                  {gap.currentMastery}%
                </span>
                <span className="text-gray-400">→</span>
                <span className={`text-sm font-medium ${getMasteryColor(gap.targetMastery)}`}>
                  {gap.targetMastery}%
                </span>
              </div>
            </div>
            
            <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${gap.currentMastery}%` }}
                transition={{ duration: 1, delay: index * 0.1 }}
                className={`h-3 rounded-full ${getMasteryColor(gap.currentMastery)}`}
              />
            </div>
            
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="h-2 rounded-full bg-gradient-to-r from-blue-400 to-purple-400 border-2 border-white"
                style={{ width: `${gap.targetMastery}%` }}
              />
            </div>
          </div>

          {/* Gap Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-500" />
              <div>
                <p className="text-xs text-gray-500">Gol de cunoștințe</p>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {gap.gap}% puncte
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-blue-500" />
              <div>
                <p className="text-xs text-gray-500">Timp estimat</p>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {gap.estimatedTimeToClose} ore
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-purple-500" />
              <div>
                <p className="text-xs text-gray-500">Trend</p>
                <div className="flex items-center gap-1">
                  <span className={getTrendColor(gap.trends.improving)}>
                    {getTrendIcon(gap.trends.improving)}
                  </span>
                  <span className={`text-sm font-medium ${getTrendColor(gap.trends.improving)}`}>
                    {Math.abs(gap.trends.rate)}/săptămână
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Recommended Resources */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Lightbulb className="w-4 h-4 text-yellow-500" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Resurse recomandate:
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {gap.recommendedResources.map((resource, idx) => (
                <span key={idx} className="text-xs px-3 py-1 bg-blue-100 text-blue-800 rounded-full">
                  {resource}
                </span>
              ))}
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
