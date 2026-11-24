import type { Transition, Variants } from 'framer-motion';

/** Transiciones cortas (150–400 ms). Framer Motion respeta prefers-reduced-motion vía MotionConfig reducedMotion="user". */
export const ease: Transition = { duration: 0.25, ease: [0.22, 1, 0.36, 1] };
export const quick: Transition = { duration: 0.16, ease: 'easeOut' };
export const spring: Transition = { type: 'spring', stiffness: 420, damping: 32, mass: 0.8 };

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: ease },
  exit: { opacity: 0, y: -6, transition: quick },
};
export const fade: Variants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: ease }, exit: { opacity: 0, transition: quick } };
export const stagger = (delay = 0.04): Variants => ({ hidden: {}, show: { transition: { staggerChildren: delay, delayChildren: 0.05 } } });
export const pop: Variants = { hidden: { opacity: 0, scale: 0.96 }, show: { opacity: 1, scale: 1, transition: spring }, exit: { opacity: 0, scale: 0.98, transition: quick } };
