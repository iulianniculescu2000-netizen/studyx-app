import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react';
import { useTheme } from '../../theme/ThemeContext';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  retryCount: number;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  maxRetries?: number;
  showErrorDetails?: boolean;
  component?: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private retryTimeouts: number[] = [];

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo
    });

    // Log error to console
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    // Call custom error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Log to diagnostics store if available
    try {
      import('../../store/diagnosticsStore').then(({ logDiagnosticEvent }) => {
        logDiagnosticEvent({
          area: 'ui',
          level: 'error',
          title: `Error boundary: ${this.props.component || 'Unknown'}`,
          detail: [
            error.message,
            errorInfo.componentStack?.trim(),
            error.stack?.trim(),
            `Retries: ${this.state.retryCount}`,
          ].filter(Boolean).join('\n'),
        });
      }).catch(() => {
        console.warn('Could not import diagnostics store');
      });
    } catch (e) {
      // Fallback if diagnostics store is not available
      console.warn('Could not log to diagnostics store:', e);
    }
  }

  componentWillUnmount() {
    // Clear any pending retry timeouts
    this.retryTimeouts.forEach(timeout => clearTimeout(timeout));
    this.retryTimeouts = [];
  }

  handleRetry = () => {
    const maxRetries = this.props.maxRetries || 3;
    
    if (this.state.retryCount < maxRetries) {
      this.setState(prevState => ({
        hasError: false,
        error: null,
        errorInfo: null,
        retryCount: prevState.retryCount + 1
      }));
    }
  };

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0
    });
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback component
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return <ErrorBoundaryUI 
        error={this.state.error}
        errorInfo={this.state.errorInfo}
        onRetry={this.handleRetry}
        onReset={this.handleReset}
        onGoHome={this.handleGoHome}
        retryCount={this.state.retryCount}
        maxRetries={this.props.maxRetries || 3}
        showErrorDetails={this.props.showErrorDetails}
        component={this.props.component}
      />;
    }

    return this.props.children;
  }
}

// Error Boundary UI Component
interface ErrorBoundaryUIProps {
  error: Error | null;
  errorInfo: ErrorInfo | null;
  onRetry: () => void;
  onReset: () => void;
  onGoHome: () => void;
  retryCount: number;
  maxRetries: number;
  showErrorDetails?: boolean;
  component?: string;
}

function ErrorBoundaryUI({
  error,
  errorInfo,
  onRetry,
  onReset,
  onGoHome,
  retryCount,
  maxRetries,
  showErrorDetails = false,
  component
}: ErrorBoundaryUIProps) {
  const theme = useTheme();
  const [showDetails, setShowDetails] = React.useState(false);

  const canRetry = retryCount < maxRetries;
  const isLastRetry = retryCount === maxRetries - 1;

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: theme.surface }}
    >
      <div 
        className="max-w-md w-full rounded-2xl border shadow-xl p-6"
        style={{ 
          borderColor: theme.border,
          background: theme.surface
        }}
      >
        {/* Error Icon */}
        <div className="flex justify-center mb-4">
          <div 
            className="p-3 rounded-full"
            style={{ background: `${theme.danger}15` }}
          >
            <AlertTriangle size={32} style={{ color: theme.danger }} />
          </div>
        </div>

        {/* Error Title */}
        <div className="text-center mb-4">
          <h1 
            className="text-xl font-bold mb-2"
            style={{ color: theme.text }}
          >
            Something went wrong
          </h1>
          <p 
            className="text-sm"
            style={{ color: theme.text3 }}
          >
            {component ? `Error in ${component}` : 'An unexpected error occurred'}
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div 
            className="p-3 rounded-lg mb-4 text-sm"
            style={{ 
              background: `${theme.danger}10`,
              border: `1px solid ${theme.danger}30`,
              color: theme.danger
            }}
          >
            {error.message}
          </div>
        )}

        {/* Retry Status */}
        {retryCount > 0 && (
          <div 
            className="text-center mb-4 text-sm"
            style={{ color: theme.text3 }}
          >
            Retry attempt {retryCount} of {maxRetries}
            {!canRetry && ' - Maximum retries reached'}
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-2">
          {canRetry && (
            <button
              onClick={onRetry}
              className="w-full flex items-center justify-center gap-2 p-3 rounded-lg font-medium transition-all hover:opacity-80"
              style={{ 
                background: theme.accent,
                color: 'white'
              }}
            >
              <RefreshCw size={16} />
              {isLastRetry ? 'Try One More Time' : 'Retry'}
            </button>
          )}

          <button
            onClick={onReset}
            className="w-full flex items-center justify-center gap-2 p-3 rounded-lg font-medium transition-all"
            style={{ 
              background: theme.surface2,
              color: theme.text,
              border: `1px solid ${theme.border}`
            }}
          >
            <RefreshCw size={16} />
            Reset Component
          </button>

          <button
            onClick={onGoHome}
            className="w-full flex items-center justify-center gap-2 p-3 rounded-lg font-medium transition-all"
            style={{ 
              background: 'transparent',
              color: theme.text3,
              border: `1px solid ${theme.border}`
            }}
          >
            <Home size={16} />
            Go to Dashboard
          </button>
        </div>

        {/* Error Details Toggle */}
        {(showErrorDetails || import.meta.env.DEV) && (
          <div className="mt-4">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="flex items-center gap-2 text-sm"
              style={{ color: theme.text3 }}
            >
              <Bug size={14} />
              {showDetails ? 'Hide' : 'Show'} Error Details
            </button>

            {showDetails && (
              <div className="mt-2 space-y-2">
                {error && (
                  <div>
                    <h4 className="text-xs font-semibold mb-1" style={{ color: theme.text3 }}>
                      Error:
                    </h4>
                    <pre 
                      className="text-xs p-2 rounded overflow-auto max-h-32"
                      style={{ 
                        background: theme.surface,
                        color: theme.text2,
                        border: `1px solid ${theme.border}`
                      }}
                    >
                      {error.stack || error.message}
                    </pre>
                  </div>
                )}

                {errorInfo && (
                  <div>
                    <h4 className="text-xs font-semibold mb-1" style={{ color: theme.text3 }}>
                      Component Stack:
                    </h4>
                    <pre 
                      className="text-xs p-2 rounded overflow-auto max-h-32"
                      style={{ 
                        background: theme.surface,
                        color: theme.text2,
                        border: `1px solid ${theme.border}`
                      }}
                    >
                      {errorInfo.componentStack}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Help Text */}
        <div 
          className="mt-4 text-center text-xs"
          style={{ color: theme.text3 }}
        >
          If this problem persists, please contact support or check the console for more details.
        </div>
      </div>
    </div>
  );
}

// Hook for functional components
export function useErrorBoundary() {
  const [error, setError] = React.useState<Error | null>(null);

  const resetError = React.useCallback(() => {
    setError(null);
  }, []);

  const captureError = React.useCallback((error: Error) => {
    setError(error);
    console.error('Error captured by useErrorBoundary:', error);
  }, []);

  return {
    error,
    hasError: !!error,
    captureError,
    resetError
  };
}

// Higher-order component for error boundaries
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Partial<ErrorBoundaryProps>
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;

  return WrappedComponent;
}
