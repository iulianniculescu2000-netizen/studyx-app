import { useState, type MouseEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ZoomIn, X, ImageOff } from 'lucide-react';
import { useTheme } from '../theme/ThemeContext';
import Portal from './Portal';

interface QuizImageProps {
  src: string;
  alt?: string;
  /** Max height in px of the inline image. Default: 240 */
  maxHeight?: number;
  /** Disable the click-to-zoom lightbox. Default: false */
  noLightbox?: boolean;
  variant?: 'default' | 'flashcard' | 'compact';
  className?: string;
}

function normalizeImageSrc(src: string) {
  return src.trim();
}

function ImageSkeleton({ maxHeight }: { maxHeight: number }) {
  const theme = useTheme();
  return (
    <motion.div
      animate={{ opacity: [0.4, 0.7, 0.4] }}
      transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
      style={{
        width: '100%',
        height: Math.max(96, maxHeight * 0.6),
        background: theme.surface2,
        borderRadius: 18,
      }}
    />
  );
}

function Lightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  const [zoom, setZoom] = useState(false);
  const [pos, setPosition] = useState({ x: 50, y: 50 });

  const handleMouseMove = (event: MouseEvent<HTMLImageElement>) => {
    if (!zoom) return;
    const { left, top, width, height } = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - left) / width) * 100;
    const y = ((event.clientY - top) / height) * 100;
    setPosition({ x, y });
  };

  return (
    <motion.div
      key="lightbox-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-[19999] flex cursor-zoom-out items-center justify-center bg-black/90 p-6 backdrop-blur-xl"
    >
      <motion.button
        whileHover={{ scale: 1.1, rotate: 90 }}
        whileTap={{ scale: 0.9 }}
        onClick={onClose}
        className="absolute right-6 top-6 z-[20000] flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white backdrop-blur-md"
      >
        <X size={24} />
      </motion.button>

      <div className="relative max-h-[90vh] max-w-[95vw] overflow-hidden rounded-2xl shadow-2xl">
        <motion.img
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          src={normalizeImageSrc(src)}
          alt={alt}
          onMouseMove={handleMouseMove}
          onClick={(event) => {
            event.stopPropagation();
            setZoom((current) => !current);
          }}
          className={`transition-all duration-300 ${zoom ? 'scale-[2.5] cursor-zoom-out' : 'cursor-zoom-in'}`}
          style={{
            maxHeight: '85vh',
            maxWidth: '92vw',
            width: 'auto',
            height: 'auto',
            objectFit: 'contain',
            transformOrigin: `${pos.x}% ${pos.y}%`,
          }}
          decoding="async"
        />
        {!zoom && (
          <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-white backdrop-blur-md">
            Click pentru lupa medicala
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default function QuizImage({
  src,
  alt = 'Imagine intrebare',
  maxHeight = 240,
  noLightbox = false,
  variant = 'default',
  className = '',
}: QuizImageProps) {
  const theme = useTheme();
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [lightbox, setLightbox] = useState(false);

  const openLightbox = (event: MouseEvent<HTMLDivElement>) => {
    if (!noLightbox && loaded && !error) {
      event.stopPropagation();
      setLightbox(true);
    }
  };

  const frameRadius = variant === 'flashcard' ? 22 : variant === 'compact' ? 12 : 16;
  const imageRadius = variant === 'flashcard' ? 18 : variant === 'compact' ? 10 : 12;
  const framePadding = variant === 'flashcard' ? 10 : variant === 'compact' ? 6 : 8;
  const shadow = variant === 'flashcard'
    ? 'inset 0 1px 0 rgba(255,255,255,0.10), 0 22px 44px rgba(0,0,0,0.18)'
    : 'inset 0 1px 0 rgba(255,255,255,0.08), 0 10px 24px rgba(0,0,0,0.10)';

  return (
    <>
      <div
        className={className}
        style={{
          position: 'relative',
          display: 'grid',
          placeItems: 'center',
          width: '100%',
          maxHeight: maxHeight + framePadding * 2,
          padding: loaded && !error ? framePadding : 0,
          borderRadius: frameRadius,
          overflow: 'hidden',
          border: `1px solid ${theme.border}`,
          background: theme.isDark
            ? 'linear-gradient(180deg, rgba(255,255,255,0.07), rgba(0,0,0,0.22))'
            : 'linear-gradient(180deg, rgba(255,255,255,0.94), rgba(247,248,252,0.82))',
          boxShadow: shadow,
          cursor: !noLightbox && loaded && !error ? 'zoom-in' : 'default',
        }}
        onClick={openLightbox}
      >
        {!loaded && !error && (
          <div style={{ width: '100%', padding: '12px' }}>
            <ImageSkeleton maxHeight={maxHeight} />
          </div>
        )}

        {!error && (
          <img
            src={normalizeImageSrc(src)}
            alt={alt}
            style={{
              display: 'block',
              opacity: loaded ? 1 : 0,
              position: loaded ? 'static' : 'absolute',
              width: 'auto',
              height: 'auto',
              maxWidth: '100%',
              maxHeight,
              objectFit: 'contain',
              borderRadius: imageRadius,
            }}
            onLoad={() => setLoaded(true)}
            onError={() => {
              setError(true);
              setLoaded(true);
            }}
            loading="eager"
            decoding="async"
          />
        )}

        {error && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '24px 16px',
              color: theme.text3,
            }}
          >
            <ImageOff size={22} />
            <span style={{ fontSize: 12 }}>Imaginea nu s-a putut incarca</span>
          </div>
        )}

        {!noLightbox && loaded && !error && (
          <div
            style={{
              position: 'absolute',
              right: 10,
              bottom: 10,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 8px',
              borderRadius: 999,
              background: 'rgba(0,0,0,0.48)',
              color: '#fff',
              fontSize: 11,
              backdropFilter: 'blur(6px)',
              pointerEvents: 'none',
            }}
          >
            <ZoomIn size={11} />
            <span>Zoom</span>
          </div>
        )}
      </div>

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
