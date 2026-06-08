import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowUp } from 'lucide-react';

export default function ScrollToTopButton() {
  const [visible, setVisible] = useState(false);
  const visibleRef = useRef(false);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const getScrollHost = () => document.querySelector('.route-scroll-host') as HTMLElement | null;
    const host = getScrollHost();

    const updateVisibility = () => {
      const nextVisible = (host?.scrollTop ?? 0) > 400;
      if (visibleRef.current !== nextVisible) {
        visibleRef.current = nextVisible;
        setVisible(nextVisible);
      }
      frameRef.current = null;
    };

    const handler = () => {
      if (frameRef.current !== null) return;
      frameRef.current = window.requestAnimationFrame(updateVisibility);
    };

    host?.addEventListener('scroll', handler, { passive: true });
    updateVisibility();
    return () => {
      host?.removeEventListener('scroll', handler);
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);

  if (!visible) return null;

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.5, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.5, y: 20 }}
      onClick={() => {
        const host = document.querySelector('.route-scroll-host') as HTMLElement | null;
        host?.scrollTo({ top: 0, behavior: 'smooth' });
      }}
      aria-label="Revino sus"
      className="fixed bottom-8 right-8 z-[100] flex h-12 w-12 items-center justify-center rounded-full text-white shadow-2xl transition-transform hover:scale-110 active:scale-95"
      style={{ background: 'var(--accent)', boxShadow: '0 8px 32px var(--accent-glow)' }}
    >
      <ArrowUp size={20} strokeWidth={3} />
    </motion.button>
  );
}
