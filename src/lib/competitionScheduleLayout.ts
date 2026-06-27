import type { ScoringConfig } from './types'

/** One schedule layout for every competition — duos, singles, all divisions. */
export const COMPETITION_SCHEDULE = {
  games: 6,
  gameMinutes: 15,
  breakMinutes: 4,
  leadInMinutes: 0,
} as const

export type CompetitionScheduleValues = {
  games: number
  gameMinutes: number
  breakMinutes: number
}

export function competitionPlayBlockMinutes(): number {
  const { games, gameMinutes, breakMinutes } = COMPETITION_SCHEDULE
  return games * gameMinutes + Math.max(0, games - 1) * breakMinutes
}

export function competitionCanonicalEventMinutes(): number {
  return COMPETITION_SCHEDULE.leadInMinutes + competitionPlayBlockMinutes()
}

export function scoringConfigHasCanonicalSchedule(
  config: ScoringConfig | null | undefined,
): boolean {
  if (!config) return false
  return (
    config.americano_games === COMPETITION_SCHEDULE.games &&
    config.break_minutes === COMPETITION_SCHEDULE.breakMinutes &&
    config.game_minutes === COMPETITION_SCHEDULE.gameMinutes
  )
}

/** Keep scoring_config in sync with the canonical layout (DB source for play SQL). */
export function mergeScheduleIntoScoringConfig(
  config: ScoringConfig | null | undefined,
  schedule?: CompetitionScheduleValues,
): ScoringConfig {
  const source = config ?? {}
  return {
    ...source,
    americano_games:
      schedule?.games ??
      (typeof source.americano_games === 'number' ? source.americano_games : COMPETITION_SCHEDULE.games),
    break_minutes:
      schedule?.breakMinutes ??
      (typeof source.break_minutes === 'number' ? source.break_minutes : COMPETITION_SCHEDULE.breakMinutes),
    game_minutes:
      schedule?.gameMinutes ??
      (typeof source.game_minutes === 'number' ? source.game_minutes : COMPETITION_SCHEDULE.gameMinutes),
  }
}
