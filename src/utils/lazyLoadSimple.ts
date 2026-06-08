import { lazy, type ComponentType } from 'react';

export function createLazyComponent<T extends ComponentType<object>>(
  importFunc: () => Promise<{ default: T }>,
) {
  return lazy(importFunc);
}

export function preloadComponent<T extends ComponentType<object>>(
  importFunc: () => Promise<{ default: T }>,
) {
  return importFunc();
}

export const LazyPages = {
  QuizPlay: lazy(() => import('../pages/QuizPlay')),
  QuizList: lazy(() => import('../pages/QuizList')),
  Stats: lazy(() => import('../pages/Stats')),
  ReviewMode: lazy(() => import('../pages/ReviewMode')),
  KnowledgeVault: lazy(() => import('../pages/KnowledgeVault')),
  FlashcardSession: lazy(() => import('../pages/FlashcardSession')),
  Settings: lazy(() => import('../pages/Settings')),
  AISettings: lazy(() => import('../components/AISettings')),
};
