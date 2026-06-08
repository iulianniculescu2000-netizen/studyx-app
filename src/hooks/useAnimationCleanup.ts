import { useEffect, useRef, useState } from 'react';

/**
 * Hook pentru cleanup automat al animațiilor și timeout-urilor
 * Previne memory leaks din animații neterminate
 */
export function useAnimationCleanup() {
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const intervalsRef = useRef<ReturnType<typeof setInterval>[]>([]);

  const addTimeout = (callback: () => void, delay: number) => {
    const timeout = setTimeout(() => {
      callback();
      timeoutsRef.current = timeoutsRef.current.filter(t => t !== timeout);
    }, delay);
    timeoutsRef.current.push(timeout);
    return timeout;
  };

  const addInterval = (callback: () => void, delay: number) => {
    const interval = setInterval(callback, delay);
    intervalsRef.current.push(interval);
    return interval;
  };

  const clearAll = () => {
    timeoutsRef.current.forEach(timeout => clearTimeout(timeout));
    intervalsRef.current.forEach(interval => clearInterval(interval));
    timeoutsRef.current = [];
    intervalsRef.current = [];
  };

  useEffect(() => {
    return clearAll;
  }, []);

  return { addTimeout, addInterval, clearAll };
}

/**
 * Hook pentru animații CSS cu cleanup automat
 */
export function useCSSAnimation(duration: number) {
  const [isAnimating, setIsAnimating] = useState(false);
  const { addTimeout } = useAnimationCleanup();

  const startAnimation = () => {
    setIsAnimating(true);
    addTimeout(() => setIsAnimating(false), duration);
  };

  return { isAnimating, startAnimation };
}
