import { forwardRef } from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { useTheme } from '../../theme/ThemeContext';

interface AccessibleButtonProps {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
  className?: string;
  children: React.ReactNode;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  type?: 'button' | 'submit' | 'reset';
  'aria-label'?: string;
  'aria-describedby'?: string;
}

const AccessibleButton = forwardRef<HTMLButtonElement, AccessibleButtonProps>(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      loading = false,
      disabled = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      className = '',
      onClick,
      type = 'button',
      'aria-label': ariaLabel,
      'aria-describedby': ariaDescribedBy
    },
    ref
  ) => {
    const theme = useTheme();

    const getVariantStyles = () => {
      switch (variant) {
        case 'primary':
          return {
            background: theme.accent,
            color: 'white',
            borderColor: theme.accent
          };
        case 'secondary':
          return {
            background: theme.surface2,
            color: theme.text,
            borderColor: theme.border
          };
        case 'outline':
          return {
            background: 'transparent',
            color: theme.accent,
            borderColor: theme.accent
          };
        case 'ghost':
          return {
            background: 'transparent',
            color: theme.text3,
            borderColor: 'transparent'
          };
        case 'danger':
          return {
            background: theme.danger,
            color: 'white',
            borderColor: theme.danger
          };
        default:
          return {
            background: theme.accent,
            color: 'white',
            borderColor: theme.accent
          };
      }
    };

    const getSizeStyles = () => {
      switch (size) {
        case 'sm':
          return {
            padding: '0.5rem 1rem',
            fontSize: '0.875rem',
            minHeight: '2rem'
          };
        case 'md':
          return {
            padding: '0.75rem 1.5rem',
            fontSize: '1rem',
            minHeight: '2.5rem'
          };
        case 'lg':
          return {
            padding: '1rem 2rem',
            fontSize: '1.125rem',
            minHeight: '3rem'
          };
        default:
          return {
            padding: '0.75rem 1.5rem',
            fontSize: '1rem',
            minHeight: '2.5rem'
          };
      }
    };

    const variantStyles = getVariantStyles();
    const sizeStyles = getSizeStyles();
    const isDisabled = disabled || loading;

    return (
      <motion.button
        ref={ref}
        className={`inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 ${fullWidth ? 'w-full' : ''} ${className}`}
        style={{
          ...variantStyles,
          ...sizeStyles,
          opacity: isDisabled ? 0.5 : 1,
          cursor: isDisabled ? 'not-allowed' : 'pointer',
          border: `1px solid ${variantStyles.borderColor}`,
          '--tw-ring-offset-color': theme.surface
        } as React.CSSProperties}
        whileHover={!isDisabled ? { scale: 1.02 } : {}}
        whileTap={!isDisabled ? { scale: 0.98 } : {}}
        disabled={isDisabled}
        onClick={isDisabled ? undefined : onClick}
        aria-disabled={isDisabled}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy || (loading ? 'loading-indicator' : undefined)}
        type={type}
      >
        {loading && (
          <span id="loading-indicator" className="sr-only">
            Loading, please wait
          </span>
        )}
        
        {loading && (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            aria-hidden="true"
          >
            <Loader2 size={size === 'sm' ? 16 : size === 'lg' ? 24 : 20} />
          </motion.div>
        )}
        
        {!loading && leftIcon && (
          <span aria-hidden="true">{leftIcon}</span>
        )}
        
        <span className="truncate">{children}</span>
        
        {!loading && rightIcon && (
          <span aria-hidden="true">{rightIcon}</span>
        )}
      </motion.button>
    );
  }
);

AccessibleButton.displayName = 'AccessibleButton';

export default AccessibleButton;
