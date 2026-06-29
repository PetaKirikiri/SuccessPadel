/**
 * CameraScoreTracker style hooks.
 *
 * Responsive rules live in the locked layout CSS (`src/layouts/gesture-score.layout.css`),
 * scoped per screen via `html[data-viewport='mobile' | 'tablet' | 'web' | 'tv']`.
 * This file names the class hooks the finger-camera score tracker uses across the
 * four screen contexts (mobile, tablet, web, large screen / TV).
 */
export const cameraScoreTrackerRootClass = 'gesture-score-court__main'

export const cameraScoreTrackerViewportHooks = {
  mobile: 'gesture-score-court__main',
  tablet: 'gesture-score-court__main',
  web: 'gesture-score-court__main',
  tv: 'gesture-score-court__main',
} as const
