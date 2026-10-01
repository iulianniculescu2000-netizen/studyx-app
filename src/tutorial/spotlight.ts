import { useEffect, useState } from 'react';

// Spotlight measurement and tooltip placement shared by every tour. Moved here unchanged from the
// original tutorial; the geometry (narrow windows, off-screen targets, anti-jitter) is already solved.

export interface SpotlightRect {
  top: number; left: number; width: number; height: number;
}

export function useSpotlight(selector: string | undefined, padding = 8) {
  const [rect, setRect] = useState<SpotlightRect | null>(null);

  useEffect(() => {
    let current: HTMLElement | null = null;
    let ro: ResizeObserver | null = null;
    let mo: MutationObserver | null = null;

    // Center steps (no selector) never read `rect` — the hook's return coerces it to null —
    // so there's nothing to reset here.
    if (!selector) return;

    const detach = () => {
      current = null;
      ro?.disconnect();
      ro = null;
      mo?.disconnect();
      mo = null;
    };

    // Remember the last committed rect so snap() only calls setRect when the geometry actually
    // moved. Without this guard, every re-measure pushed a new object and re-rendered.
    // `undefined` = nothing committed yet, so the first "no target" still clears the previous step's ring.
    let lastRect: SpotlightRect | null | undefined;
    const nearlyEqual = (a: SpotlightRect | null, b: SpotlightRect | null) => {
      if (a === b) return true;
      if (!a || !b) return false;
      return (
        Math.abs(a.top - b.top) < 0.5 &&
        Math.abs(a.left - b.left) < 0.5 &&
        Math.abs(a.width - b.width) < 0.5 &&
        Math.abs(a.height - b.height) < 0.5
      );
    };

    const commit = (next: SpotlightRect | null) => {
      if (lastRect !== undefined && nearlyEqual(next, lastRect)) return;
      lastRect = next;
      setRect(next);
    };

    const snap = () => {
      if (!current) return;
      const r = current.getBoundingClientRect();
      // A found-but-scrolled-off-screen target (e.g. a button below the fold) would put the
      // spotlight and tooltip outside the viewport, leaving only the dark overlay visible.
      // Treat that as "no anchor" so the tooltip falls back to a centered, always-visible card.
      const fullyOffscreen =
        r.bottom <= 0 || r.top >= window.innerHeight || r.right <= 0 || r.left >= window.innerWidth;
      if (fullyOffscreen || (r.width === 0 && r.height === 0)) {
        commit(null);
        return;
      }
      commit({
        top: r.top - padding,
        left: r.left - padding,
        width: r.width + padding * 2,
        height: r.height + padding * 2,
      });
    };

    const attach = (el: HTMLElement) => {
      detach();
      current = el;
      // The SVG mask already cuts a fully-undimmed hole around the target, and the
      // pulsing ring border (rendered separately) signals focus — an extra CSS
      // brightness/saturate boost on top of that was pushing already-colorful
      // elements (gradient nav pills) into a garish, oversaturated look.
      ro = new ResizeObserver(snap);
      ro.observe(el);
      // Only scroll if the target isn't already comfortably in view — and do it instantly, so
      // the spotlight doesn't have to chase a smooth-scrolling target (that chase was the jitter).
      const r = el.getBoundingClientRect();
      const partlyOffscreen = r.top < 0 || r.bottom > window.innerHeight;
      if (partlyOffscreen) {
        try {
          el.scrollIntoView({ block: 'center', inline: 'nearest' });
        } catch {
          /* scrollIntoView options unsupported — ignore */
        }
      }
      snap();
    };

    const resolveTarget = () => {
      const found = document.querySelector(selector) as HTMLElement | null;
      if (found && found !== current) {
        attach(found);
      } else if (!found) {
        detach();
        commit(null);
      } else {
        snap();
      }
    };

    resolveTarget();
    const frame = requestAnimationFrame(resolveTarget);
    const settle = setTimeout(resolveTarget, 180);
    // Watch only for elements being added/removed (so a target appears after navigation).
    // NOT attributes: framer-motion mutates inline styles every animation frame, which turned
    // this observer into a per-frame re-render loop — the "trembling" the user saw.
    mo = new MutationObserver(resolveTarget);
    mo.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', snap);
    window.addEventListener('scroll', snap, true);

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(settle);
      detach();
      window.removeEventListener('resize', snap);
      window.removeEventListener('scroll', snap, true);
    };
  }, [selector, padding]);

  return selector ? rect : null;
}

/**
 * `forceCenter` is set on narrow/short viewports: side-anchored placement assumes
 * desktop layout (room beside a target), which phones/small windows don't have —
 * so we always fall back to a single robust bottom-sheet-style placement there.
 */
export function getTooltipStyle(position: string, rect: SpotlightRect | null, forceCenter: boolean): React.CSSProperties {
  const GAP = 16;
  const PAD = 12; // min distance from viewport edges
  const VW = window.innerWidth;
  const VH = window.innerHeight;
  // Fixed 340/380px widths overflowed narrow windows (the tooltip got clipped off-screen
  // instead of shrinking). Cap both to whatever actually fits the current viewport.
  const TW = Math.max(240, Math.min(340, VW - PAD * 2));
  const CENTER_W = Math.max(240, Math.min(380, VW - PAD * 2));
  // Every branch below clamps to this — a card taller than its slot scrolls
  // internally instead of running off the edge of the screen.
  const TH = Math.min(460, VH - PAD * 2);

  if (!rect || position === 'center' || forceCenter) {
    return { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: CENTER_W, maxHeight: VH - PAD * 2, overflowY: 'auto' };
  }

  // Clamp horizontal center position
  const clampLeft = (rawLeft: number) =>
    Math.max(PAD, Math.min(rawLeft, VW - TW - PAD));

  // Side placements (left/right of target) need enough leftover width for the tooltip itself;
  // below a certain window width there just isn't room beside the target, so fall back to
  // stacking it under/over the target instead of letting it overflow the viewport edge.
  const sideRoomAvailable = VW - rect.width - GAP * 2 - PAD * 2 >= TW;

  switch (position) {
    case 'right': {
      if (!sideRoomAvailable) {
        const rawTop = rect.top + rect.height + GAP;
        const rawLeft = clampLeft(rect.left + rect.width / 2 - TW / 2);
        const top = rawTop + TH > VH - PAD ? Math.max(PAD, rect.top - GAP - TH) : rawTop;
        return { position: 'fixed', top, left: rawLeft, width: TW, maxHeight: TH, overflowY: 'auto' };
      }
      const left = rect.left + rect.width + GAP;
      const top = Math.max(PAD, Math.min(rect.top + rect.height / 2, VH - TH - PAD));
      // Flip to left if not enough room on right
      if (left + TW > VW - PAD) {
        return { position: 'fixed', right: VW - (rect.left - GAP), top, transform: 'translateY(-50%)', width: TW, maxHeight: TH, overflowY: 'auto' };
      }
      return { position: 'fixed', left, top, transform: 'translateY(-50%)', width: TW, maxHeight: TH, overflowY: 'auto' };
    }
    case 'left': {
      if (!sideRoomAvailable) {
        const rawTop = rect.top + rect.height + GAP;
        const rawLeft = clampLeft(rect.left + rect.width / 2 - TW / 2);
        const top = rawTop + TH > VH - PAD ? Math.max(PAD, rect.top - GAP - TH) : rawTop;
        return { position: 'fixed', top, left: rawLeft, width: TW, maxHeight: TH, overflowY: 'auto' };
      }
      const right = VW - (rect.left - GAP);
      const top = Math.max(PAD, Math.min(rect.top + rect.height / 2, VH - TH - PAD));
      return { position: 'fixed', right, top, transform: 'translateY(-50%)', width: TW, maxHeight: TH, overflowY: 'auto' };
    }
    case 'bottom': {
      const rawTop = rect.top + rect.height + GAP;
      const rawLeft = clampLeft(rect.left + rect.width / 2 - TW / 2);
      // Flip to top if tooltip would go off the bottom
      if (rawTop + TH > VH - PAD) {
        const topPos = Math.max(PAD, rect.top - GAP - TH);
        return { position: 'fixed', top: topPos, left: rawLeft, width: TW, maxHeight: TH, overflowY: 'auto' };
      }
      return { position: 'fixed', top: rawTop, left: rawLeft, width: TW, maxHeight: TH, overflowY: 'auto' };
    }
    case 'top': {
      const rawBottom = VH - (rect.top - GAP);
      const rawLeft = clampLeft(rect.left + rect.width / 2 - TW / 2);
      // Flip to bottom if tooltip would go off the top
      if (rect.top - GAP - TH < PAD) {
        return { position: 'fixed', top: rect.top + rect.height + GAP, left: rawLeft, width: TW, maxHeight: TH, overflowY: 'auto' };
      }
      return { position: 'fixed', bottom: rawBottom, left: rawLeft, width: TW, maxHeight: TH, overflowY: 'auto' };
    }
    default:
      return { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: CENTER_W, maxHeight: VH - PAD * 2, overflowY: 'auto' };
  }
}
