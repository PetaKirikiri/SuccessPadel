/**
 * SetupCard style hooks.
 *
 * Responsive rules live in the locked layout CSS (`src/layouts/settings.layout.css`),
 * scoped per screen via `html[data-viewport='mobile' | 'tablet' | 'web' | 'tv']`.
 * This file names the class hooks the SetupCard layout uses across the four
 * screen contexts (mobile, tablet, web, large screen / TV).
 */
export const setupCardRootClass = 'settings-card game-card space-y-3'

export const setupCardViewportHooks = {
  mobile: 'settings-card',
  tablet: 'settings-card',
  web: 'settings-card',
  tv: 'settings-card',
} as const
