import { Component, Suspense, type ErrorInfo, type ReactNode } from 'react';
import { motion } from 'framer-motion';

export class AppErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, color: 'white', background: '#800', position: 'fixed', inset: 0, zIndex: 9999, overflow: 'auto' }}>
          <h1>Ceva nu a mers bine.</h1>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{this.state.error?.stack || this.state.error?.message}</pre>
          <button onClick={() => window.location.reload()} style={{ padding: '10px 20px', marginTop: 20 }}>
            Reîncarcă aplicația
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

function PageWrapper({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      style={{ height: '100%', width: '100%', overflow: 'auto' }}
      className="custom-scrollbar route-scroll-host"
    >
      {children}
    </motion.div>
  );
}

function RouteFallback() {
  return (
    <div className="flex h-full w-full items-center justify-center px-6">
      <div
        className="glass-panel premium-shadow max-w-sm rounded-[28px] px-6 py-5 text-center"
        style={{ color: 'var(--text-secondary)' }}
      >
        <div
          className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-white/12 border-t-[var(--accent)]"
          aria-hidden="true"
        />
        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          Pregatim ecranul...
        </p>
      </div>
    </div>
  );
}

export function RouteView({ children }: { children: ReactNode }) {
  return (
    <PageWrapper>
      <Suspense fallback={<RouteFallback />}>{children}</Suspense>
    </PageWrapper>
  );
}
