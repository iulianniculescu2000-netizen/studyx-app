import { motion } from 'framer-motion';
import { useTheme } from '../../theme/ThemeContext';

interface SkeletonLoaderProps {
  width?: string | number;
  height?: string | number;
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
  animation?: 'pulse' | 'wave' | 'none';
}

export function SkeletonLoader({
  width = '100%',
  height = '1rem',
  className = '',
  variant = 'text',
  animation = 'pulse'
}: SkeletonLoaderProps) {
  const theme = useTheme();

  const baseClasses = 'inline-block';
  const variantClasses = {
    text: 'rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-md'
  };

  const animationVariants = {
    pulse: {
      initial: { opacity: 1 },
      animate: { opacity: [0.4, 1, 0.4] },
      transition: { duration: 1.5, repeat: Infinity, ease: 'easeInOut' as const }
    },
    wave: {
      initial: { x: -100 },
      animate: { x: 100 },
      transition: { duration: 1, repeat: Infinity, ease: 'linear' as const }
    },
    none: {}
  };

  const skeletonStyle = {
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
    background: `linear-gradient(90deg, ${theme.border2} 0%, ${theme.border} 50%, ${theme.border2} 100%)`,
    backgroundSize: animation === 'wave' ? '200% 100%' : '100% 100%'
  };

  if (animation === 'wave') {
    return (
      <div
        className={`${baseClasses} ${variantClasses[variant]} ${className}`}
        style={skeletonStyle}
      >
        <motion.div
          variants={animationVariants.wave}
          initial="initial"
          animate="animate"
          transition={animationVariants.wave.transition}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: `linear-gradient(90deg, transparent, ${theme.surface}, transparent)`,
            borderRadius: variant === 'circular' ? '50%' : variant === 'text' ? '0.25rem' : '0.375rem'
          }}
        />
      </div>
    );
  }

  return (
    <motion.div
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      style={skeletonStyle}
      variants={animationVariants.pulse}
      initial="initial"
      animate="animate"
      transition={animationVariants.pulse.transition}
    />
  );
}

// Predefined skeleton components
export function TextSkeleton({ lines = 3, className = '' }: { lines?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonLoader
          key={i}
          height="1rem"
          width={i === lines - 1 ? '60%' : '100%'}
          className="inline-block"
        />
      ))}
    </div>
  );
}

export function CardSkeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`p-4 rounded-xl border ${className}`}>
      <div className="space-y-3">
        <SkeletonLoader width="40px" height="40px" variant="circular" />
        <SkeletonLoader height="1.5rem" width="70%" />
        <TextSkeleton lines={2} />
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="space-y-2">
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
        {Array.from({ length: columns }).map((_, i) => (
          <SkeletonLoader key={`header-${i}`} height="2rem" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={`row-${rowIndex}`} className="grid gap-2" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
          {Array.from({ length: columns }).map((_, colIndex) => (
            <SkeletonLoader key={`cell-${rowIndex}-${colIndex}`} height="2.5rem" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function QuizCardSkeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`p-4 rounded-xl border ${className}`}>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <SkeletonLoader width="60px" height="24px" />
          <SkeletonLoader width="80px" height="24px" />
        </div>
        <SkeletonLoader height="1.5rem" />
        <TextSkeleton lines={2} />
        <div className="flex items-center justify-between">
          <SkeletonLoader width="100px" height="32px" />
          <SkeletonLoader width="120px" height="32px" />
        </div>
      </div>
    </div>
  );
}
