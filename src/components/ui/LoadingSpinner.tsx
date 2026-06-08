import { motion } from 'framer-motion';
import { Loader2, Brain, Sparkles } from 'lucide-react';
import { useTheme } from '../../theme/ThemeContext';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'dots' | 'pulse' | 'ai';
  className?: string;
  text?: string;
}

export function LoadingSpinner({ 
  size = 'md', 
  variant = 'default', 
  className = '',
  text
}: LoadingSpinnerProps) {
  const theme = useTheme();

  const sizes = {
    sm: { width: 16, height: 16 },
    md: { width: 24, height: 24 },
    lg: { width: 32, height: 32 }
  };

  const currentSize = sizes[size];

  if (variant === 'dots') {
    return (
      <div className={`flex items-center gap-1 ${className}`}>
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="rounded-full"
            style={{
              width: size === 'sm' ? 6 : size === 'lg' ? 10 : 8,
              height: size === 'sm' ? 6 : size === 'lg' ? 10 : 8,
              background: theme.accent
            }}
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.5, 1, 0.5]
            }}
            transition={{
              duration: 1.2,
              repeat: Infinity,
              delay: i * 0.2,
              ease: 'easeInOut'
            }}
          />
        ))}
        {text && <span className="ml-2 text-sm" style={{ color: theme.text3 }}>{text}</span>}
      </div>
    );
  }

  if (variant === 'pulse') {
    return (
      <div className={`flex items-center ${className}`}>
        <motion.div
          className="rounded-full"
          style={{
            width: currentSize.width,
            height: currentSize.height,
            background: theme.accent
          }}
          animate={{
            scale: [1, 1.1, 1],
            opacity: [0.7, 1, 0.7]
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: 'easeInOut'
          }}
        />
        {text && <span className="ml-2 text-sm" style={{ color: theme.text3 }}>{text}</span>}
      </div>
    );
  }

  if (variant === 'ai') {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
        >
          <Brain size={currentSize.width} style={{ color: theme.accent }} />
        </motion.div>
        <motion.div
          animate={{ rotate: -360 }}
          transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
        >
          <Sparkles size={currentSize.width * 0.7} style={{ color: theme.warning }} />
        </motion.div>
        {text && <span className="text-sm" style={{ color: theme.text3 }}>{text}</span>}
      </div>
    );
  }

  return (
    <div className={`flex items-center ${className}`}>
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
      >
        <Loader2 size={currentSize.width} style={{ color: theme.accent }} />
      </motion.div>
      {text && <span className="ml-2 text-sm" style={{ color: theme.text3 }}>{text}</span>}
    </div>
  );
}

// Loading states for specific contexts
export function QuizLoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 space-y-4">
      <LoadingSpinner size="lg" variant="ai" text="Se încarc\u0103 quiz-ul..." />
    </div>
  );
}

export function AIProcessingState() {
  return (
    <div className="flex flex-col items-center justify-center py-8 space-y-3">
      <LoadingSpinner size="md" variant="ai" text="AI proceseaz\u0103..." />
    </div>
  );
}

export function DataLoadingState({ message = "Se încarc\u0103 datele..." }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 space-y-4">
      <LoadingSpinner size="lg" text={message} />
    </div>
  );
}

export function ButtonLoadingState({ text = "Se proceseaz\u0103..." }: { text?: string }) {
  return (
    <div className="flex items-center gap-2">
      <LoadingSpinner size="sm" />
      <span>{text}</span>
    </div>
  );
}
