/**
 * GameCard style hooks.
 *
 * The per-screen sizing logic lives in `gameCardSizes.ts` and the TV rules in the
 * locked `gameCard.tv.css` + `src/layouts/game-card.layout.css`, scoped via
 * `html[data-viewport='mobile' | 'tablet' | 'web' | 'tv']`. This file is the single
 * style entry point for GameCard, re-exporting the size hooks used across the four
 * screen contexts. On large screen / TV, GameCard is dominant with the Leaderboard
 * shown in its right-hand slot.
 */
export {
  isTvSize,
  cardFillsViewport,
  courtsBodyClass,
  courtCompactForSize,
  courtsGridProps,
  headerLogoClassForSize,
} from './gameCardSizes'
