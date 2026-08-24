import type { Transition, Variants } from 'framer-motion';

/**
 * Central motion presets. Before this file, every component hand-wrote its own
 * `transition={{ type: 'spring', stiffness: 400, damping: 17 }}` — the same few
 * values kept getting re-typed (and re-tuned inconsistently) in Sidebar, chat
 * drawer, modals. New UI should import from here instead of inventing another
 * one-off spring.
 */

/** Nav/selection indicators — the feel Sidebar's active-link pill already has. */
export const springNav: Transition = { type: 'spring', stiffness: 400, damping: 17 };

/** Larger surfaces (drawers, panels, the hero card) entering/settling. */
export const springPanel: Transition = { type: 'spring', stiffness: 300, damping: 30 };

/** Standard modal/overlay entrance easing already used ad-hoc across the app. */
export const easeIn: Transition = { duration: 0.24, ease: [0.16, 1, 0.3, 1] };

/** Matches the theme crossfade easing in index.css — for anything that should feel like "part of" a theme switch. */
export const easeThemeCrossfade: Transition = { duration: 0.3, ease: [0.22, 1, 0.36, 1] };

export const modalIn: Variants = {
  hidden: { opacity: 0, y: 12, scale: 0.98 },
  visible: { opacity: 1, y: 0, scale: 1, transition: easeIn },
  exit: { opacity: 0, y: 8, scale: 0.98, transition: { duration: 0.16 } },
};

/** Hero/large-card entrance — a bit more vertical travel than a modal, no scale (cards don't "pop"). */
export const heroIn: Variants = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
};

/** Standard hover/tap feedback for glass buttons and clickable cards. */
export const pressFeedback = {
  whileHover: { scale: 1.01 },
  whileTap: { scale: 0.97 },
};
