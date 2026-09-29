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

/**
 * Standard hover/tap feedback for glass buttons and clickable cards. The tap
 * scales down further than a subtle "01/97" nudge — the press should read as
 * a real squish — and Framer's own spring back to rest (not a CSS transition)
 * gives the release a small natural overshoot/bounce for free, matching the
 * "back"-eased release on the CSS `.press-feedback` class.
 */
export const pressFeedback = {
  whileHover: { scale: 1.01, y: -1 },
  whileTap: { scale: 0.97, y: 0 },
  // A spring (not a long ease) so the press lands instantly and the release settles with a
  // hint of overshoot. Values mirror --hover-lift/--hover-scale/--press-scale in index.css.
  transition: { type: "spring", stiffness: 460, damping: 26, mass: 0.7 } as Transition,
};

/* ── POLISH v2.2 — Serotonin UI Presets ───────────────────────────────────── */

/**
 * Serotonin Ease — tranziție foarte lungă, fluidă, cu decelerare lentă.
 * Oferă senzația de obiect "greu" și luxos, fără niciun recul (no bounce).
 */
export const serotoninEase: Transition = { duration: 0.5, ease: [0.16, 1, 0.3, 1] };

/** Hover card lift — expansiune lentă, blândă */
export const cardHover = {
  whileHover: { y: -2, scale: 1.012, transition: serotoninEase },
  whileTap:   { y: -0.5, scale: 0.995, transition: { duration: 0.2 } },
};

/** Icon pop — respiră ușor la hover, fără să se rotească haotic */
export const iconPop = {
  whileHover: { scale: 1.08, transition: serotoninEase },
  whileTap:   { scale: 0.96, transition: { duration: 0.15 } },
};

/** Badge entrance — apare fluid */
export const badgeIn: Variants = {
  hidden:  { opacity: 0, scale: 0.85 },
  visible: { opacity: 1, scale: 1, transition: serotoninEase },
};

/** Container stagger — listă de carduri / elemente */
export const staggerContainer: Variants = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
};

/** Item individual din stagger — fade in organic */
export const staggerItem: Variants = {
  hidden:  { opacity: 0, y: 16, scale: 0.98 },
  visible: { opacity: 1, y: 0,  scale: 1, transition: serotoninEase },
};

/** Intrare pagină — lungă și catifelată */
export const pageEnter: Variants = {
  hidden:  { opacity: 0, y: 12, scale: 0.99 },
  visible: { opacity: 1, y: 0,  scale: 1, transition: { duration: 0.65, ease: [0.16, 1, 0.3, 1] } },
  exit:    { opacity: 0, y: -4, scale: 0.995, transition: { duration: 0.25 } },
};


