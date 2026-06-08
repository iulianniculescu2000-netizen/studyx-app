import { motion } from 'framer-motion';
import { type ReactNode } from 'react';

export interface AICardProps {
  children: ReactNode;
  className?: string;
  variant?: 'default' | 'glass' | 'elevated' | 'bordered';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  animated?: boolean;
  hover?: boolean;
  loading?: boolean;
  onClick?: () => void;
}

export function AICard({
  children,
  className,
  variant = 'default',
  size = 'md',
  animated = true,
  hover = true,
  loading = false,
  onClick
}: AICardProps) {
  const baseClasses = 'rounded-xl transition-all duration-300';
  
  const variantClasses = {
    default: 'bg-white dark:bg-gray-800 shadow-lg',
    glass: 'bg-white/10 dark:bg-gray-800/10 backdrop-blur-md border border-white/20 dark:border-gray-700/20',
    elevated: 'bg-white dark:bg-gray-800 shadow-2xl hover:shadow-3xl',
    bordered: 'bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700'
  };
  
  const sizeClasses = {
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
    xl: 'p-8'
  };
  
  const hoverClasses = hover ? 'hover:scale-[1.02] cursor-pointer' : '';
  const loadingClasses = loading ? 'opacity-60 pointer-events-none' : '';
  
  const classes = [
    baseClasses,
    variantClasses[variant],
    sizeClasses[size],
    hoverClasses,
    loadingClasses,
    className
  ].filter(Boolean).join(' ');

  const MotionComponent = animated ? motion.div : 'div';
  const motionProps = animated ? {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.3 }
  } : {};

  return (
    <MotionComponent
      className={classes}
      onClick={onClick}
      {...motionProps}
    >
      {children}
    </MotionComponent>
  );
}

export default AICard;
