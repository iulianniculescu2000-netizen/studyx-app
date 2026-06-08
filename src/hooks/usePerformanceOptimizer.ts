import { useEffect, useRef, useCallback } from 'react';

/**
 * Hook pentru optimizarea performanței animațiilor și interacțiunii vizuale
 */
export function usePerformanceOptimizer() {
  const rafRef = useRef<number | null>(null);
  const throttledCallbacks = useRef<Map<Function, number>>(new Map());

  // Throttle funcții pentru a preveni over-rendering
  const throttle = useCallback((callback: Function, delay: number) => {
    const key = callback;
    const now = Date.now();
    const lastCall = throttledCallbacks.current.get(key) || 0;
    
    if (now - lastCall >= delay) {
      throttledCallbacks.current.set(key, now);
      return callback();
    }
    return null;
  }, []);

  // Debounce funcții pentru input și scroll
  const debounce = useCallback((callback: Function, delay: number) => {
    const key = callback;
    if (throttledCallbacks.current.has(key)) {
      clearTimeout(throttledCallbacks.current.get(key)!);
    }
    
    const timeoutId = setTimeout(() => {
      callback();
      throttledCallbacks.current.delete(key);
    }, delay);
    
    throttledCallbacks.current.set(key, timeoutId);
  }, []);

  // RAF optimizat cu cleanup
  const requestAnimationFrame = useCallback((callback: FrameRequestCallback) => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
    }
    
    rafRef.current = window.requestAnimationFrame(callback);
    return rafRef.current;
  }, []);

  // Cleanup pentru toate resursele
  const cleanup = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    
    // Cleanup toate timeout-urile
    throttledCallbacks.current.forEach(timeoutId => {
      clearTimeout(timeoutId);
    });
    throttledCallbacks.current.clear();
  }, []);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return {
    throttle,
    debounce,
    requestAnimationFrame,
    cleanup
  };
}

/**
 * Hook pentru optimizarea scroll-ului smooth
 */
export function useOptimizedScroll() {
  const { throttle } = usePerformanceOptimizer();
  const scrollContainerRef = useRef<HTMLElement>(null);

  const smoothScrollTo = useCallback((element: HTMLElement, options: ScrollToOptions) => {
    const scroll = () => {
      element.scrollTo({
        ...options,
        behavior: 'smooth'
      });
    };

    // Throttle scroll calls pentru a preveni jitter
    return throttle(scroll, 16); // ~60fps
  }, [throttle]);

  const scrollToTop = useCallback(() => {
    if (scrollContainerRef.current) {
      smoothScrollTo(scrollContainerRef.current, { top: 0, left: 0 });
    }
  }, [smoothScrollTo]);

  const scrollToBottom = useCallback(() => {
    if (scrollContainerRef.current) {
      smoothScrollTo(scrollContainerRef.current, { 
        top: scrollContainerRef.current.scrollHeight, 
        left: 0 
      });
    }
  }, [smoothScrollTo]);

  return {
    scrollContainerRef,
    smoothScrollTo,
    scrollToTop,
    scrollToBottom
  };
}

/**
 * Hook pentru optimizarea animațiilor CSS
 */
export function useOptimizedAnimation() {
  const { requestAnimationFrame, cleanup } = usePerformanceOptimizer();
  const animationRef = useRef<{
    element: HTMLElement;
    startTime: number;
    duration: number;
    onUpdate: (progress: number) => void;
    onComplete?: () => void;
  } | null>(null);

  const animate = useCallback((
    element: HTMLElement,
    duration: number,
    onUpdate: (progress: number) => void,
    onComplete?: () => void
  ) => {
    const startTime = performance.now();
    
    const frame = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      onUpdate(progress);
      
      if (progress < 1) {
        requestAnimationFrame(frame);
      } else if (onComplete) {
        onComplete();
      }
    };
    
    animationRef.current = { element, startTime, duration, onUpdate, onComplete };
    requestAnimationFrame(frame);
  }, [requestAnimationFrame]);

  const stopAnimation = useCallback(() => {
    if (animationRef.current?.onComplete) {
      animationRef.current.onComplete();
    }
    animationRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      stopAnimation();
      cleanup();
    };
  }, [stopAnimation, cleanup]);

  return { animate, stopAnimation };
}
