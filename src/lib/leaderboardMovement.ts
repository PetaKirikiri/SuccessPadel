import type { LeaderboardEntry } from './leaderboardTypes'
import { standingsDisplayRank } from './competitionAchievements'

export type MovementSnapshot = {
  version: 1
  scores: string
  ranks: Record<string, number>
  movement: Record<string, number>
}

export function movementEntryId(entry: LeaderboardEntry): string {
  return entry.roster_entry_id || entry.padel_player_id || entry.profile_id
}

export function readMovementSnapshot(value: string | null): MovementSnapshot | null {
  try {
    const s = JSON.parse(value ?? 'null')
    const numbers = (v: unknown) => v !== null && typeof v === 'object' && !Array.isArray(v)
      && Object.values(v).every(n => typeof n === 'number' && Number.isSafeInteger(n))
    return s?.version === 1 && typeof s.scores === 'string' && numbers(s.ranks) && numbers(s.movement)
      ? s : null
  } catch { return null }
}

/** Read-only presentation state; never changes scores or sorts the source rows. */
export function updateMovement(
  previous: MovementSnapshot | null,
  entries: LeaderboardEntry[],
): MovementSnapshot | null {
  if (!entries.length) return previous
  const ranks = Object.fromEntries(entries.map((e, i) => [movementEntryId(e), standingsDisplayRank(entries, i)]))
  const scores = JSON.stringify(entries.map(e => [
    movementEntryId(e), e.total_points, e.games, e.wins ?? 0, e.losses ?? 0, e.draws ?? 0,
  ]).sort((a, b) => String(a[0]).localeCompare(String(b[0]))))
  const sameRoster = previous && JSON.stringify(Object.keys(previous.ranks).sort()) === JSON.stringify(Object.keys(ranks).sort())
  if (sameRoster && previous.scores === scores) {
    // Names, avatars, attendance and harmless tie ordering are not score changes.
    return previous
  }
  const movement = Object.fromEntries(Object.entries(ranks).map(([id, rank]) => [
    id, sameRoster ? previous.ranks[id]! - rank : 0,
  ]))
  return { version: 1, scores, ranks, movement }
}
