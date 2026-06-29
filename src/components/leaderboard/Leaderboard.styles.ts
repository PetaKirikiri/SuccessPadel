/**
 * Leaderboard style hooks.
 *
 * Responsive rules live in the locked layout CSS (`src/layouts/leaderboard.layout.css`),
 * scoped per screen via `html[data-viewport='mobile' | 'tablet' | 'web' | 'tv']`.
 * On large screen / TV the Leaderboard renders inside GameCard's right-hand slot.
 */
export const leaderboardEmbeddedPadClass = 'min-h-full bg-brand-surface px-3 py-3'

export const leaderboardViewportHooks = {
  mobile: 'leaderboard',
  tablet: 'leaderboard',
  web: 'leaderboard',
  tv: 'leaderboard',
} as const
