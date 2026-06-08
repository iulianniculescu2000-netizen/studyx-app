import { useEffect, useRef, useState } from 'react';
import { useAdaptiveMotion } from './useAdaptiveMotion';

export function useCountUp(target: number, duration = 600) {
  const [value, setValue] = useState(target);
  const previousTargetRef = useRef(target);
  const { calmMotion } = useAdaptiveMotion();

  useEffect(() => {
    const startValue = previousTargetRef.current;
    previousTargetRef.current = target;

    if (calmMotion) return;
    if (startValue === target) return;

    const startTime = Date.now();

    const tick = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(startValue + eased * (target - startValue)));
      if (progress < 1) requestAnimationFrame(tick);
    };

    const raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [calmMotion, duration, target]);

  return calmMotion ? target : value;
}
