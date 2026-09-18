import type { ViewportBucket } from './viewBreakpoints'

/** Keep the completed game visible through the break, then follow the next start. */
export function scheduledTvGame(
  viewport: ViewportBucket,
  now: number,
  gameNumbers: readonly number[],
  times?: ReadonlyMap<number, { startsAt: number; endsAt: number }>,
): number | undefined {
  if (viewport !== 'tv' || !times) return undefined
  let selected: number | undefined
  let latestStart = -Infinity
  for (const game of gameNumbers) {
    const start = times.get(game)?.startsAt
    if (start != null && Number.isFinite(start) && start <= now && start > latestStart) {
      selected = game
      latestStart = start
    }
  }
  return selected
}
