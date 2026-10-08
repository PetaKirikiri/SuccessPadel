/** Follow the schedule on every screen, showing the next game during its break. */
export function scheduledTvGame(
  now: number,
  gameNumbers: readonly number[],
  times?: ReadonlyMap<number, { startsAt: number; endsAt: number }>,
): number | undefined {
  if (!times || !Number.isFinite(now)) return undefined
  const scheduled = gameNumbers.flatMap((game) => {
    const slot = times.get(game)
    return slot && Number.isFinite(slot.startsAt) && Number.isFinite(slot.endsAt)
      && slot.endsAt > slot.startsAt ? [{ game, ...slot }] : []
  }).sort((a, b) => a.startsAt - b.startsAt)
  const first = scheduled[0]
  // Before play starts, leave the viewer's saved selection alone.
  if (!first || now < first.startsAt) return undefined
  return (scheduled.find((slot) => now < slot.endsAt) ?? scheduled[scheduled.length - 1])?.game
}
