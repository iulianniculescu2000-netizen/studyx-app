import { motion } from 'framer-motion';
import { useTheme } from '../../theme/ThemeContext';

interface ProgressIndicatorProps {
  value: number;
  max?: number;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'linear' | 'circular';
  showLabel?: boolean;
  label?: string;
  color?: string;
  className?: string;
}

export function ProgressIndicator({
  value,
  max = 100,
  size = 'md',
  variant = 'linear',
  showLabel = false,
  label,
  color,
  className = ''
}: ProgressIndicatorProps) {
  const theme = useTheme();
  const progressColor = color || theme.accent;
  const percentage = Math.min((value / max) * 100, 100);

  const sizes = {
    sm: { height: 4, fontSize: '0.75rem' },
    md: { height: 6, fontSize: '0.875rem' },
    lg: { height: 8, fontSize: '1rem' }
  };

  const currentSize = sizes[size];

  if (variant === 'circular') {
    const radius = size === 'sm' ? 16 : size === 'lg' ? 24 : 20;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className="relative" style={{ width: radius * 2, height: radius * 2 }}>
          <svg
            className="transform -rotate-90"
            width={radius * 2}
            height={radius * 2}
          >
            <circle
              cx={radius}
              cy={radius}
              r={radius}
              stroke={theme.border}
              strokeWidth="4"
              fill="none"
            />
            <motion.circle
              cx={radius}
              cy={radius}
              r={radius}
              stroke={progressColor}
              strokeWidth="4"
              fill="none"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span 
              className="font-semibold" 
              style={{ fontSize: currentSize.fontSize, color: theme.text }}
            >
              {Math.round(percentage)}%
            </span>
          </div>
        </div>
        {(label || showLabel) && (
          <span className="text-sm font-medium" style={{ color: theme.text3 }}>
            {label || `${value}/${max}`}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {(label || showLabel) && (
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium" style={{ color: theme.text }}>
            {label || 'Progress'}
          </span>
          <span className="text-sm" style={{ color: theme.text3 }}>
            {value} / {max}
          </span>
        </div>
      )}
      <div className="relative">
        <div
          className="rounded-full overflow-hidden"
          style={{
            height: currentSize.height,
            background: theme.border
          }}
        >
          <motion.div
            className="h-full rounded-full"
            style={{
              background: progressColor,
              width: `${percentage}%`
            }}
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>
        {size === 'lg' && (
          <div 
            className="absolute inset-0 flex items-center justify-center"
            style={{ fontSize: currentSize.fontSize }}
          >
            <span className="font-semibold" style={{ color: 'white', textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
              {Math.round(percentage)}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// Step indicator for multi-step processes
interface StepIndicatorProps {
  steps: Array<{ label: string; completed?: boolean; active?: boolean }>;
  currentStep: number;
  className?: string;
}

export function StepIndicator({ steps, currentStep, className = '' }: StepIndicatorProps) {
  const theme = useTheme();

  return (
    <div className={`flex items-center justify-between ${className}`}>
      {steps.map((step, index) => (
        <div key={index} className="flex items-center flex-1">
          <div className="flex items-center">
            <motion.div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                index < currentStep 
                  ? 'bg-green-500 text-white' 
                  : index === currentStep 
                    ? 'ring-2 ring-blue-500 text-blue-500' 
                    : 'bg-gray-200 text-gray-500'
              }`}
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
            >
              {index < currentStep ? 'â' : index + 1}
            </motion.div>
            <span 
              className="ml-2 text-sm font-medium"
              style={{ 
                color: index <= currentStep ? theme.text : theme.text3 
              }}
            >
              {step.label}
            </span>
          </div>
          {index < steps.length - 1 && (
            <div 
              className={`flex-1 h-0.5 mx-4 ${
                index < currentStep ? 'bg-green-500' : 'bg-gray-200'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// File upload progress
export function FileUploadProgress({ 
  fileName, 
  progress, 
  status = 'uploading' 
}: { 
  fileName: string; 
  progress: number; 
  status?: 'uploading' | 'processing' | 'completed' | 'error'; 
}) {
  const theme = useTheme();

  const statusColors = {
    uploading: theme.accent,
    processing: theme.warning,
    completed: theme.success,
    error: theme.danger
  };

  const statusText = {
    uploading: 'Se încarc\u0103...',
    processing: 'Se proceseaz\u0103...',
    completed: 'Complet',
    error: 'Eroare'
  };

  return (
    <div className="p-3 rounded-lg border" style={{ borderColor: theme.border, background: theme.surface }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium truncate" style={{ color: theme.text }}>
          {fileName}
        </span>
        <span className="text-xs" style={{ color: theme.text3 }}>
          {statusText[status]}
        </span>
      </div>
      <ProgressIndicator value={progress} color={statusColors[status]} size="sm" />
    </div>
  );
}
