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

/** Full-screen lightbox with Smart Magnifier */
function Lightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  const [zoom, setZoom] = useState(false);
  const [pos, setPosition] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLImageElement>) => {
    if (!zoom) return;
    const { left, top, width, height } = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - left) / width) * 100;
    const y = ((e.clientY - top) / height) * 100;
    setPosition({ x, y });
  };

  return (
    <motion.div
      key="lightbox-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-[19999] flex items-center justify-center bg-black/90 backdrop-blur-xl p-6 cursor-zoom-out"
    >
      <motion.button
        whileHover={{ scale: 1.1, rotate: 90 }}
        whileTap={{ scale: 0.9 }}
        onClick={onClose}
        className="absolute top-6 right-6 w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-white backdrop-blur-md border border-white/10 z-[20000]"
      >
        <X size={24} />
      </motion.button>

      <div className="relative max-w-[95vw] max-h-[90vh] overflow-hidden rounded-2xl shadow-2xl">
        <motion.img
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          src={src?.trim().replace(/\s/g, '')}
          alt={alt}
          onMouseMove={handleMouseMove}
          onClick={(e) => { e.stopPropagation(); setZoom(!zoom); }}
          className={`transition-all duration-300 ${zoom ? 'scale-[2.5] cursor-zoom-out' : 'cursor-zoom-in'}`}
          style={{
            maxHeight: '85vh',
            objectFit: 'contain',
            transformOrigin: `${pos.x}% ${pos.y}%`,
          }}
        />
        {!zoom && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-black/50 text-white text-[10px] font-black uppercase tracking-[0.2em] backdrop-blur-md pointer-events-none">
            Click pentru Lupa Medicală
          </div>
        )}
      </div>
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
            src={src?.trim().replace(/\s/g, '')}
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
