import { storedScheduleFromConfig } from './rankedSchedule'
import type { GameSession } from './types'

type CompetitionLike = Pick<
  GameSession,
  'status' | 'competition_started_at' | 'target_players' | 'max_players' | 'scoring_config'
> & {
  session_players?: { id: string }[]
}

/** Game is in: live, locked, or accepted (full roster + saved schedule). */
export function competitionIsIn(row: CompetitionLike): boolean {
  if (row.status === 'complete') return false
  if (row.competition_started_at || row.status === 'locked') return true

  const target = row.target_players ?? row.max_players ?? 0
  const roster = row.session_players ?? []
  const schedule = storedScheduleFromConfig(
    row.scoring_config as Record<string, unknown> | null | undefined,
  )

  return roster.length >= target && target >= 4 && schedule.length > 0
}
