import { useReducedMotion } from 'framer-motion';
import { useRuntimeStore } from '../store/runtimeStore';

export function useAdaptiveMotion() {
  const reducedMotion = useReducedMotion();
  const lowPowerMode = useRuntimeStore((state) => state.lowPowerMode);
  const performanceLite = (
    typeof document !== 'undefined'
    && document.documentElement.getAttribute('data-performance') === 'lite'
  ) || lowPowerMode;

  return {
    reducedMotion,
    performanceLite,
    calmMotion: reducedMotion || performanceLite,
  };
}
