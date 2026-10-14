/** Display-only urgency, from 0 (full time) to 20 (time up). */
export function gameCountdownUrgency(now: number, startsAt: number, endsAt: number): number {
  if (![now, startsAt, endsAt].every(Number.isFinite) || endsAt <= startsAt) return 0
  const elapsed = Math.max(0, Math.min(1, (now - startsAt) / (endsAt - startsAt)))
  return Math.round(elapsed * 20)
}
