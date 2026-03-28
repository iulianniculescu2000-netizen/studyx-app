/**
 * QuizImage.tsx
 *
 * Premium image component for quiz questions.
 * Features:
 *  - Animated skeleton while loading
 *  - object-contain rendering at consistent max-height
 *  - Click-to-zoom lightbox (Portal-based, escapes stacking contexts)
 *  - Graceful error state
 *  - Optional: disable lightbox for contexts where click has other meaning
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ZoomIn, X, ImageOff } from 'lucide-react';
import { useTheme } from '../theme/ThemeContext';
import Portal from './Portal';

interface QuizImageProps {
  src: string;
  alt?: string;
  /** Max height in px of the inline thumbnail. Default: 240 */
  maxHeight?: number;
  /** Disable the click-to-zoom lightbox. Default: false */
  noLightbox?: boolean;
}

/** Pulsing skeleton shown while image loads */
function ImageSkeleton({ maxHeight }: { maxHeight: number }) {
  const theme = useTheme();
  return (
    <motion.div
      animate={{ opacity: [0.4, 0.7, 0.4] }}
      transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
      style={{
        width: '100%',
        height: maxHeight * 0.6,
        background: theme.surface2,
        borderRadius: 12,
      }}
    />
  );
}

/** Full-screen lightbox */
function Lightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  // Close on Escape
  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  };

  return (
    <motion.div
      key="lightbox-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={onClose}
      onKeyDown={handleKey}
      tabIndex={-1}
      style={{
        position: 'fixed', inset: 0, zIndex: 19999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(12px)',
        padding: 24, cursor: 'zoom-out',
      }}
    >
      {/* Close button */}
      <motion.button
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={onClose}
        style={{
          position: 'absolute', top: 20, right: 20,
          width: 40, height: 40, borderRadius: '50%',
          background: 'rgba(255,255,255,0.12)', border: 'none',
          color: '#fff', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(4px)',
        }}
      >
        <X size={18} />
      </motion.button>

      {/* Image */}
      <motion.img
        key="lightbox-img"
        initial={{ scale: 0.88, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.88, opacity: 0 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        src={src}
        alt={alt}
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '90vw',
          maxHeight: '85vh',
          objectFit: 'contain',
          borderRadius: 16,
          boxShadow: '0 40px 120px rgba(0,0,0,0.7)',
          cursor: 'default',
        }}
      />
    </motion.div>
  );
}

export default function QuizImage({
  src,
  alt = 'Imagine întrebare',
  maxHeight = 240,
  noLightbox = false,
}: QuizImageProps) {
  const theme = useTheme();
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [lightbox, setLightbox] = useState(false);

  const openLightbox = () => {
    if (!noLightbox && loaded && !error) setLightbox(true);
  };

  return (
    <>
      <div
        style={{
          position: 'relative',
          borderRadius: 14,
          overflow: 'hidden',
          border: `1px solid ${theme.border}`,
          background: theme.isDark ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.04)',
          cursor: !noLightbox && loaded && !error ? 'zoom-in' : 'default',
        }}
        onClick={openLightbox}
      >
        {/* Skeleton */}
        {!loaded && !error && (
          <div style={{ padding: '12px 12px 8px' }}>
            <ImageSkeleton maxHeight={maxHeight} />
          </div>
        )}

        {/* Image */}
        {!error && (
          <img
            src={src}
            alt={alt}
            style={{
              display: loaded ? 'block' : 'none',
              width: '100%',
              maxHeight,
              objectFit: 'contain',
            }}
            onLoad={() => setLoaded(true)}
            onError={() => { setError(true); setLoaded(true); }}
          />
        )}

        {/* Error state */}
        {error && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', gap: 8, padding: '24px 16px',
            color: theme.text3,
          }}>
            <ImageOff size={22} />
            <span style={{ fontSize: 12 }}>Imaginea nu s-a putut încărca</span>
          </div>
        )}

        {/* Zoom hint overlay */}
        {!noLightbox && loaded && !error && (
          <div
            style={{
              position: 'absolute', bottom: 8, right: 8,
              background: 'rgba(0,0,0,0.45)', borderRadius: 8,
              padding: '3px 8px', display: 'flex', alignItems: 'center', gap: 4,
              color: '#fff', fontSize: 11, backdropFilter: 'blur(4px)',
              pointerEvents: 'none',
            }}
          >
            <ZoomIn size={11} />
            <span>Zoom</span>
          </div>
        )}
      </div>

      {/* Lightbox portal */}
      {!noLightbox && (
        <Portal>
          <AnimatePresence>
            {lightbox && (
              <Lightbox src={src} alt={alt} onClose={() => setLightbox(false)} />
            )}
          </AnimatePresence>
        </Portal>
      )}
    </>
  );
}
