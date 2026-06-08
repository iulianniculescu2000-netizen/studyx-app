import { lazy, Suspense, type ComponentType, type ReactNode } from 'react';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';

interface LazyLoadOptions {
  fallback?: ReactNode;
  preload?: boolean;
}

export function createLazyComponent<T extends ComponentType<object>>(
  importFunc: () => Promise<{ default: T }>,
  options: LazyLoadOptions = {},
) {
  const LazyComponent = lazy(importFunc) as unknown as ComponentType<Record<string, unknown>>;

  if (options.preload) {
    void importFunc();
  }

  return function LazyWrapper(props: object) {
    return (
      <Suspense fallback={options.fallback ?? <DefaultLoadingFallback />}>
        <LazyComponent {...(props as Record<string, unknown>)} />
      </Suspense>
    );
  };
}

function DefaultLoadingFallback() {
  return (
    <div className="flex items-center justify-center p-8">
      <LoadingSpinner size="lg" variant="dots" />
    </div>
  );
}

export const LazyPages = {
  QuizPlay: createLazyComponent(() => import('../pages/QuizPlay')),
  QuizList: createLazyComponent(() => import('../pages/QuizList')),
  QuizCreate: createLazyComponent(() => import('../pages/QuizCreate')),
  ReviewMode: createLazyComponent(() => import('../pages/ReviewMode')),
  Stats: createLazyComponent(() => import('../pages/Stats')),
  KnowledgeVault: createLazyComponent(() => import('../pages/KnowledgeVault')),
  FlashcardSession: createLazyComponent(() => import('../pages/FlashcardSession')),
  Settings: createLazyComponent(() => import('../pages/Settings')),
  UpdateModal: createLazyComponent(() => import('../components/UpdateModal'), { fallback: null }),
  AIChatDrawer: createLazyComponent(() => import('../components/AIChatDrawer'), { fallback: null }),
  Sidebar: createLazyComponent(() => import('../components/Sidebar')),
};

interface LazyLoadWrapperProps {
  component: keyof typeof LazyPages;
}

export function LazyLoadWrapper({ component }: LazyLoadWrapperProps) {
  const LazyComponent = LazyPages[component];
  return <LazyComponent />;
}
