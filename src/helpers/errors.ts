/**
 * Error Helper - Error handling \u0219i logging centralizat pentru StudyX
 * Error tracking, reporting, \u0219i debugging utilities
 */

// Error types
export const ErrorType = {
  VALIDATION: 'validation',
  NETWORK: 'network',
  STORAGE: 'storage',
  PERMISSION: 'permission',
  RUNTIME: 'runtime',
  COMPILATION: 'compilation',
  USER_INPUT: 'user_input',
  AI_SERVICE: 'ai_service',
  FILE_IMPORT: 'file_import',
  UNKNOWN: 'unknown'
} as const;

export type ErrorType = typeof ErrorType[keyof typeof ErrorType];

// Error severity
export const ErrorSeverity = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
} as const;

export type ErrorSeverity = typeof ErrorSeverity[keyof typeof ErrorSeverity];

// Error interface
export interface AppError {
  id: string;
  type: ErrorType;
  severity: ErrorSeverity;
  message: string;
  code?: string;
  stack?: string;
  context?: Record<string, unknown>;
  timestamp: number;
  userId?: string;
  component?: string;
  action?: string;
  resolved: boolean;
  count: number;
}

// Error log interface
export interface ErrorLog {
  errors: AppError[];
  summary: {
    total: number;
    byType: Record<ErrorType, number>;
    bySeverity: Record<ErrorSeverity, number>;
    recent: AppError[];
    critical: AppError[];
  };
}

// Error state
let errorLog: ErrorLog = {
  errors: [],
  summary: {
    total: 0,
    byType: {} as Record<ErrorType, number>,
    bySeverity: {} as Record<ErrorSeverity, number>,
    recent: [],
    critical: []
  }
};

/**
 * Creeaz\u0103 un AppError
 */
export function createError(
  message: string,
  type: ErrorType = ErrorType.UNKNOWN,
  severity: ErrorSeverity = ErrorSeverity.MEDIUM,
  context?: Record<string, unknown>,
  code?: string
): AppError {
  const error: AppError = {
    id: generateErrorId(),
    type,
    severity,
    message,
    code,
    context,
    timestamp: Date.now(),
    resolved: false,
    count: 1
  };

  // Adaug\u0103 stack trace dac\u0103 e disponibil
  if (typeof Error !== 'undefined') {
    const err = new Error(message);
    error.stack = err.stack;
  }

  return error;
}

/**
 * Genereaz\u0103 ID unic pentru eroare
 */
function generateErrorId(): string {
  return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Logheaz\u0103 o eroare
 */
export function logError(error: AppError | Error | string, context?: Record<string, unknown>): string {
  let appError: AppError;

  if (typeof error === 'string') {
    appError = createError(error, ErrorType.UNKNOWN, ErrorSeverity.MEDIUM, context);
  } else if (error instanceof Error) {
    appError = createError(
      error.message,
      ErrorType.RUNTIME,
      ErrorSeverity.MEDIUM,
      context,
      error.name
    );
    appError.stack = error.stack;
  } else {
    appError = error;
  }

  // Verific\u0103 dac\u0103 exist\u0103 deja o eroare similar\u0103
  const existingError = findSimilarError(appError);
  if (existingError) {
    existingError.count++;
    existingError.timestamp = Date.now();
    return existingError.id;
  }

  // Adaug\u0103 eroarea la log
  errorLog.errors.push(appError);
  updateErrorSummary();

  // P\u0103streaz\u0103 doar ultimele 1000 erori
  if (errorLog.errors.length > 1000) {
    errorLog.errors = errorLog.errors.slice(-1000);
  }

  // Console logging pentru debugging
  console.error(`[${appError.severity.toUpperCase()}] ${appError.type}: ${appError.message}`, appError);

  // Trimite la serviciul de raportare (dac\u0103 e disponibil)
  if (appError.severity === ErrorSeverity.CRITICAL) {
    reportCriticalError(appError);
  }

  return appError.id;
}

/**
 * G\u0103seste eroare similar\u0103
 */
function findSimilarError(error: AppError): AppError | null {
  const messageKey = error.message.toLowerCase().replace(/\s+/g, ' ').trim();
  
  return errorLog.errors.find(existing => 
    existing.type === error.type &&
    existing.message.toLowerCase().replace(/\s+/g, ' ').trim() === messageKey &&
    !existing.resolved
  ) || null;
}

/**
 * Actualizeaz\u0103 sumarul erorilor
 */
function updateErrorSummary(): void {
  const summary = errorLog.summary;
  
  // Reset
  summary.total = errorLog.errors.length;
  summary.byType = {} as Record<ErrorType, number>;
  summary.bySeverity = {} as Record<ErrorSeverity, number>;
  summary.recent = [];
  summary.critical = [];

  // Calculeaz\u0103 statistici
  errorLog.errors.forEach(error => {
    // Count by type
    summary.byType[error.type] = (summary.byType[error.type] || 0) + 1;
    
    // Count by severity
    summary.bySeverity[error.severity] = (summary.bySeverity[error.severity] || 0) + 1;
    
    // Recent errors (last 24 hours)
    if (Date.now() - error.timestamp < 24 * 60 * 60 * 1000) {
      summary.recent.push(error);
    }
    
    // Critical errors
    if (error.severity === ErrorSeverity.CRITICAL) {
      summary.critical.push(error);
    }
  });

  // Sortare recent errors
  summary.recent.sort((a, b) => b.timestamp - a.timestamp);
  summary.recent = summary.recent.slice(0, 10);

  // Sortare critical errors
  summary.critical.sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * Ob\u021bine logul de erori
 */
export function getErrorLog(): ErrorLog {
  return { ...errorLog };
}

/**
 * Ob\u021bine erorile recente
 */
export function getRecentErrors(limit = 10): AppError[] {
  return errorLog.errors
    .filter(error => !error.resolved)
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit);
}

/**
 * Ob\u021bine erorile critice
 */
export function getCriticalErrors(): AppError[] {
  return errorLog.errors
    .filter(error => error.severity === ErrorSeverity.CRITICAL && !error.resolved)
    .sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * Marcheaz\u0103 o eroare ca rezolvat\u0103
 */
export function resolveError(errorId: string): boolean {
  const error = errorLog.errors.find(e => e.id === errorId);
  if (error) {
    error.resolved = true;
    updateErrorSummary();
    return true;
  }
  return false;
}

/**
 * Marcheaz\u0103 toate erorile ca rezolvate
 */
export function resolveAllErrors(): number {
  const unresolvedCount = errorLog.errors.filter(e => !e.resolved).length;
  errorLog.errors.forEach(error => {
    error.resolved = true;
  });
  updateErrorSummary();
  return unresolvedCount;
}

/**
 * \u0218terge erorile vechi
 */
export function cleanupErrors(olderThanDays = 30): number {
  const cutoffTime = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
  const initialCount = errorLog.errors.length;
  
  errorLog.errors = errorLog.errors.filter(error => 
    error.timestamp > cutoffTime || !error.resolved
  );
  
  updateErrorSummary();
  return initialCount - errorLog.errors.length;
}

/**
 * Raporteaz\u0103 eroare critic\u0103
 */
async function reportCriticalError(error: AppError): Promise<void> {
  try {
    // Aici am putea trimite la un serviciu de monitoring
    // Pentru moment, doar log la console
    console.warn('Critical error detected:', error);
    
    // Trimite la analytics (dac\u0103 e disponibil)
    if (typeof window !== 'undefined' && 'gtag' in window) {
      (window as any).gtag('event', 'critical_error', {
        error_type: error.type,
        error_message: error.message,
        error_code: error.code
      });
    }
  } catch (reportingError) {
    console.error('Failed to report critical error:', reportingError);
  }
}

/**
 * Wrap pentru func\u021bii cu error handling
 */
export function withErrorHandling<T extends (...args: any[]) => any>(
  fn: T,
  context?: Record<string, unknown>
): (...args: Parameters<T>) => ReturnType<T> {
  return (...args: Parameters<T>) => {
    try {
      return fn(...args);
    } catch (error) {
      logError(error instanceof Error ? error : new Error(String(error)), {
        function: fn.name,
        arguments: args,
        ...context
      });
      throw error;
    }
  };
}

/**
 * Wrap pentru async func\u021bii cu error handling
 */
export function withAsyncErrorHandling<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  context?: Record<string, unknown>
): (...args: Parameters<T>) => Promise<ReturnType<T>> {
  return async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (error) {
      logError(error instanceof Error ? error : new Error(String(error)), {
        function: fn.name,
        arguments: args,
        async: true,
        ...context
      });
      throw error;
    }
  };
}

/**
 * Verific\u0103 s\u0103n\u0103tatea sistemului de erori
 */
export function checkErrorHealth(): {
  isHealthy: boolean;
  issues: string[];
  recommendations: string[];
  stats: ErrorLog['summary'];
} {
  const issues: string[] = [];
  const recommendations: string[] = [];
  const stats = errorLog.summary;

  // Verific\u0103 erori critice
  if (stats.critical.length > 0) {
    issues.push(`${stats.critical.length} erori critice nerezolvate`);
    recommendations.push('Rezolv\u0103 erorile critice imediat');
  }

  // Verific\u0103 erori recente
  if (stats.recent.length > 20) {
    issues.push(`${stats.recent.length} erori \u00een ultimele 24h`);
    recommendations.push('Investigheaz\u0103 cauzele frecven\u021bei mari de erori');
  }

  // Verific\u0103 tipuri de erori problematice
  if (stats.byType[ErrorType.NETWORK] > 10) {
    issues.push(`${stats.byType[ErrorType.NETWORK]} erori de re\u021bea`);
    recommendations.push('Verific\u0103 conexiunea la internet \u0219i API endpoints');
  }

  if (stats.byType[ErrorType.STORAGE] > 5) {
    issues.push(`${stats.byType[ErrorType.STORAGE]} erori de storage`);
    recommendations.push('Verific\u0103 spa\u021biul disponibil \u0219i permisiunile');
  }

  const isHealthy = issues.length === 0 && stats.critical.length === 0;

  return {
    isHealthy,
    issues,
    recommendations,
    stats
  };
}

/**
 * Export date erori pentru debugging
 */
export function exportErrorData(): string {
  return JSON.stringify({
    timestamp: Date.now(),
    userAgent: navigator.userAgent,
    errorLog: errorLog,
    health: checkErrorHealth()
  }, null, 2);
}

/**
 * Import date erori (pentru debugging)
 */
export function importErrorData(jsonData: string): {
  success: boolean;
  imported?: number;
  error?: string;
} {
  try {
    const data = JSON.parse(jsonData);
    
    if (data.errorLog && Array.isArray(data.errorLog.errors)) {
      errorLog = data.errorLog;
      updateErrorSummary();
      return { success: true, imported: data.errorLog.errors.length };
    }
    
    return { success: false, error: 'Format invalid' };
  } catch (error) {
    return {
      success: false,
      error: `Eroare import: ${error instanceof Error ? error.message : 'Eroare necunoscut\u0103'}`
    };
  }
}

/**
 * Reset complet error log
 */
export function resetErrorLog(): void {
  errorLog = {
    errors: [],
    summary: {
      total: 0,
      byType: {} as Record<ErrorType, number>,
      bySeverity: {} as Record<ErrorSeverity, number>,
      recent: [],
      critical: []
    }
  };
}

// Error boundary helper
export class ErrorBoundaryHelper {
  static handleError(error: Error, errorInfo: any, component: string): string {
    const errorId = logError(error, {
      component,
      errorInfo,
      stack: error.stack
    });

    return errorId;
  }

  static createFallbackMessage(errorId: string): string {
    return `A ap\u0103rut o eroare. ID: ${errorId}`;
  }
}

// Export pentru utilizare u\u0219oar\u0103
export const ErrorHelper = {
  ErrorType,
  ErrorSeverity,
  createError,
  logError,
  getErrorLog,
  getRecentErrors,
  getCriticalErrors,
  resolveError,
  resolveAllErrors,
  cleanupErrors,
  withErrorHandling,
  withAsyncErrorHandling,
  checkErrorHealth,
  exportErrorData,
  importErrorData,
  resetErrorLog,
  ErrorBoundaryHelper
};

export default ErrorHelper;
