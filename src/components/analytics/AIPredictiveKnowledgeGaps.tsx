import { motion } from 'framer-motion';
import { AlertTriangle, Lightbulb, Activity, Zap } from 'lucide-react';
import { useTheme } from '../../theme/ThemeContext';

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
  const theme = useTheme();

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return theme.danger;
      case 'medium': return theme.warning;
      case 'low': return theme.success;
      default: return theme.text3;
    }
  };

  const getMasteryColor = (mastery: number) => {
    if (mastery >= 80) return theme.success;
    if (mastery >= 60) return theme.warning;
    if (mastery >= 40) return '#FF9F0A';
    return theme.danger;
  };

  const getTrendIcon = (improving: boolean) => (improving ? '📈' : '📉');
  const getTrendColor = (improving: boolean) => (improving ? theme.success : theme.danger);

  return (
    <div className="space-y-6">
      {knowledgeGaps.map((gap, index) => {
        const priorityColor = getPriorityColor(gap.priority);
        const currentColor = getMasteryColor(gap.currentMastery);
        const targetColor = getMasteryColor(gap.targetMastery);
        const trendColor = getTrendColor(gap.trends.improving);
        return (
        <motion.div
          key={gap.id}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.1 }}
          className="glass-panel rounded-[24px] p-6"
        >
          {/* Gap Header */}
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold mb-1" style={{ color: theme.text }}>
                {gap.topic}
              </h3>
              <p className="text-sm" style={{ color: theme.text3 }}>
                {gap.subject}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ background: `${priorityColor}18`, color: priorityColor }}>
                {gap.priority.toUpperCase()}
              </span>
              {gap.aiGenerated && (
                <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ background: `${theme.accent}18`, color: theme.accent }}>
                  ✨ AI
                </span>
              )}
            </div>
          </div>

          {/* Mastery Progress */}
          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium" style={{ color: theme.text2 }}>
                Nivel de stăpânire
              </span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium" style={{ color: currentColor }}>
                  {gap.currentMastery}%
                </span>
                <span style={{ color: theme.text3 }}>→</span>
                <span className="text-sm font-medium" style={{ color: targetColor }}>
                  {gap.targetMastery}%
                </span>
              </div>
            </div>

            <div className="w-full rounded-full h-3 mb-2" style={{ background: theme.surface2 }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${gap.currentMastery}%` }}
                transition={{ duration: 1, delay: index * 0.1 }}
                className="h-3 rounded-full"
                style={{ background: currentColor }}
              />
            </div>

            <div className="w-full rounded-full h-2" style={{ background: theme.surface2 }}>
              <div
                className="h-2 rounded-full"
                style={{ width: `${gap.targetMastery}%`, background: theme.accent, opacity: 0.5 }}
              />
            </div>
          </div>

          {/* Gap Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" style={{ color: theme.warning }} />
              <div>
                <p className="text-xs" style={{ color: theme.text3 }}>Gol de cunoștințe</p>
                <p className="text-sm font-medium" style={{ color: theme.text }}>
                  {gap.gap}% puncte
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4" style={{ color: theme.accent2 }} />
              <div>
                <p className="text-xs" style={{ color: theme.text3 }}>Timp estimat</p>
                <p className="text-sm font-medium" style={{ color: theme.text }}>
                  {gap.estimatedTimeToClose} ore
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4" style={{ color: theme.accent }} />
              <div>
                <p className="text-xs" style={{ color: theme.text3 }}>Trend</p>
                <div className="flex items-center gap-1">
                  <span style={{ color: trendColor }}>
                    {getTrendIcon(gap.trends.improving)}
                  </span>
                  <span className="text-sm font-medium" style={{ color: trendColor }}>
                    {Math.abs(gap.trends.rate)}/săptămână
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Recommended Resources */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Lightbulb className="w-4 h-4" style={{ color: theme.warning }} />
              <span className="text-sm font-medium" style={{ color: theme.text2 }}>
                Resurse recomandate:
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {gap.recommendedResources.map((resource, idx) => (
                <span key={idx} className="text-xs px-3 py-1 rounded-full" style={{ background: theme.surface2, color: theme.text2 }}>
                  {resource}
                </span>
              ))}
            </div>
          </div>
        </motion.div>
        );
      })}
    </div>
  );
}
