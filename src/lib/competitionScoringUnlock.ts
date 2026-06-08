/** Score entry is not gated by per-game clock (for testing and flexible entry). */
export function isScoringTimeUnlocked(): boolean {
  return import.meta.env.VITE_LOCK_SCORING_TIME !== 'true'
}
