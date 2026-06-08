import { useEffect, useRef, useCallback } from 'react';
import { logDiagnosticEvent } from '../store/diagnosticsStore';

/**
 * Hook pentru monitorizarea stabilității și detectarea problemelor de performanță
 */
export function useStabilityMonitor(componentName: string) {
  const renderCount = useRef(0);
  const lastRenderTime = useRef(Date.now());
  const slowRenderThreshold = 16; // 60fps = 16.67ms per frame
  const memoryLeakThreshold = 50; // Alert after 50 renders

  useEffect(() => {
    renderCount.current += 1;
    const now = Date.now();
    const renderTime = now - lastRenderTime.current;
    lastRenderTime.current = now;

    // Detect renders lente
    if (renderTime > slowRenderThreshold * 2) {
      logDiagnosticEvent({
        area: 'runtime',
        level: 'warning',
        title: `Render lent detectat în ${componentName}`,
        detail: `Render time: ${renderTime}ms (threshold: ${slowRenderThreshold * 2}ms)`,
      });
    }

    // Detect potential memory leaks (prea multe renders)
    if (renderCount.current % memoryLeakThreshold === 0) {
      logDiagnosticEvent({
        area: 'runtime',
        level: 'info',
        title: `Monitorizare renders în ${componentName}`,
        detail: `Total renders: ${renderCount.current}`,
      });
    }
  });

  // Monitorizare memory usage (dacă e disponibil)
  const checkMemoryUsage = useCallback(() => {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      const usedMB = Math.round(memory.usedJSHeapSize / 1024 / 1024);
      const totalMB = Math.round(memory.totalJSHeapSize / 1024 / 1024);
      
      if (usedMB > 100) { // Alertă la peste 100MB
        logDiagnosticEvent({
          area: 'runtime',
          level: 'warning',
          title: `Memory usage ridicat în ${componentName}`,
          detail: `Used: ${usedMB}MB / Total: ${totalMB}MB`,
        });
      }
    }
  }, [componentName]);

  // Verificare memory usage periodic
  useEffect(() => {
    const interval = setInterval(checkMemoryUsage, 30000); // La 30 secunde
    return () => clearInterval(interval);
  }, [checkMemoryUsage]);

  return {
    renderCount: renderCount.current,
    checkMemoryUsage
  };
}

/**
 * Hook pentru detectarea memory leaks din event listeners
 */
export function useEventListenerCleanup() {
  const listenersRef = useRef<Map<string, EventListener>>(new Map());

  const addTrackedListener = useCallback((
    element: EventTarget,
    event: string,
    listener: EventListener,
    options?: AddEventListenerOptions
  ) => {
    const key = `${element.constructor.name}-${event}`;
    listenersRef.current.set(key, listener);
    element.addEventListener(event, listener, options);
  }, []);

  const removeTrackedListener = useCallback((
    element: EventTarget,
    event: string,
    listener: EventListener
  ) => {
    const key = `${element.constructor.name}-${event}`;
    listenersRef.current.delete(key);
    element.removeEventListener(event, listener);
  }, []);

  const cleanupAllListeners = useCallback(() => {
    listenersRef.current.clear();
    logDiagnosticEvent({
      area: 'runtime',
      level: 'info',
      title: 'Event listeners cleanup',
      detail: 'Toți listenerii au fost curațați',
    });
  }, []);

  useEffect(() => {
    return cleanupAllListeners;
  }, [cleanupAllListeners]);

  return {
    addTrackedListener,
    removeTrackedListener,
    cleanupAllListeners
  };
}

/**
 * Hook pentru optimizarea re-renders inutile
 */
export function useRenderOptimization<T>(value: T, equalityFn?: (a: T, b: T) => boolean) {
  const prevValueRef = useRef<T>(value);
  
  const hasChanged = equalityFn 
    ? !equalityFn(value, prevValueRef.current)
    : value !== prevValueRef.current;
    
  if (hasChanged) {
    prevValueRef.current = value;
  }
  
  return hasChanged ? value : prevValueRef.current;
}
