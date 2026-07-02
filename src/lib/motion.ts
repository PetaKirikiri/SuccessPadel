/** Shared motion tokens — carousel scroll + framer-motion overlays. */

export const MOTION_DURATION = {
  fast: 0.15,
  panel: 0.28,
  modal: 0.32,
} as const

export const MOTION_EASE = {
  enter: [0, 0, 0.2, 1] as const,
  exit: [0.4, 0, 1, 1] as const,
}

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function panelScrollBehavior(smooth: boolean): ScrollBehavior {
  return smooth && !prefersReducedMotion() ? 'smooth' : 'auto'
}
