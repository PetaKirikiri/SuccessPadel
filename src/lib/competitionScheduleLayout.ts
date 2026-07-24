import type { GameSession } from './types'

/**
 * Competition timing contract.
 *
 * Defaults are creation values only. Persisted game_sessions schedule columns are
 * the sole authority consumed by setup, SQL rounds, Game Card, and camera.
 */
export const COMPETITION_SCHEDULE = {
  games: 6,
  gameMinutes: 15,
  breakMinutes: 4,
  leadInMinutes: 0,
} as const

export const COMPETITION_SCHEDULE_LIMITS = {
  minGames: 1,
  maxGames: 20,
  minGameMinutes: 5,
  maxGameMinutes: 60,
  minBreakMinutes: 0,
  maxBreakMinutes: 30,
} as const

export type CompetitionScheduleValues = {
  games: number
  gameMinutes: number
  breakMinutes: number
}

function validInteger(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max
}

export function totalScheduleMinutes(
  games: number,
  gameMinutes: number,
  breakMinutes: number,
): number {
  if (games <= 0 || gameMinutes <= 0) return 0
  return games * gameMinutes + Math.max(0, games - 1) * breakMinutes
}

export function competitionPlayBlockMinutes(): number {
  const { games, gameMinutes, breakMinutes } = COMPETITION_SCHEDULE
  return totalScheduleMinutes(games, gameMinutes, breakMinutes)
}

export function competitionCanonicalEventMinutes(): number {
  return COMPETITION_SCHEDULE.leadInMinutes + competitionPlayBlockMinutes()
}

type CompetitionScheduleFields = Pick<
  GameSession,
  'schedule_game_count' | 'schedule_game_minutes' | 'schedule_break_minutes'
>

export function sessionHasExplicitCompetitionSchedule(
  session: Partial<CompetitionScheduleFields> | null | undefined,
): boolean {
  if (!session) return false
  const limits = COMPETITION_SCHEDULE_LIMITS
  return (
    validInteger(session.schedule_game_count, limits.minGames, limits.maxGames) &&
    validInteger(session.schedule_game_minutes, limits.minGameMinutes, limits.maxGameMinutes) &&
    validInteger(session.schedule_break_minutes, limits.minBreakMinutes, limits.maxBreakMinutes)
  )
}

/** Resolve persisted session fields. Defaults only support unsaved form previews. */
export function competitionScheduleFromSession(
  session: Partial<CompetitionScheduleFields> | null | undefined,
): CompetitionScheduleValues {
  const limits = COMPETITION_SCHEDULE_LIMITS
  return {
    games: validInteger(session?.schedule_game_count, limits.minGames, limits.maxGames)
      ? session.schedule_game_count
      : COMPETITION_SCHEDULE.games,
    gameMinutes: validInteger(
      session?.schedule_game_minutes,
      limits.minGameMinutes,
      limits.maxGameMinutes,
    )
      ? session.schedule_game_minutes
      : COMPETITION_SCHEDULE.gameMinutes,
    breakMinutes: validInteger(
      session?.schedule_break_minutes,
      limits.minBreakMinutes,
      limits.maxBreakMinutes,
    )
      ? session.schedule_break_minutes
      : COMPETITION_SCHEDULE.breakMinutes,
  }
}

export function competitionScheduleFields(
  schedule: CompetitionScheduleValues = COMPETITION_SCHEDULE,
) {
  return {
    schedule_game_count: schedule.games,
    schedule_game_minutes: schedule.gameMinutes,
    schedule_break_minutes: schedule.breakMinutes,
  }
}
