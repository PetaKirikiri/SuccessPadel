import type { CompetitionPlayer } from '../hooks/useCompetitions'
import { rosterDisplayName } from '../hooks/useCompetitions'
import type { GameSession, ScoringConfig } from './types'

export const PLAYERS_PER_COURT = 4
export const DEFAULT_AMERICANO_GAMES = 7
export const AMERICANO_GAME_COUNTS = [5, 6, 7, 8, 9, 10, 11] as const
export const BREAK_MINUTE_OPTIONS = [2, 3, 4, 5] as const
export const DEFAULT_BREAK_MINUTES = 3
export const DEFAULT_GAME_MINUTES = 14
export const COMPETITION_BREAK_MINUTES = DEFAULT_BREAK_MINUTES
export { RANKED_AMERICANO_GAMES, RANKED_GAME_MINUTES } from './rankedSchedule'

export type ScheduleSlot = {
  gameNumber: number
  startsAt: Date
  endsAt: Date
  breakMinutesAfter: number
}

export type SchedulePlan = {
  slots: ScheduleSlot[]
  usedMinutes: number
  bufferMinutes: number
  fits: boolean
  finishAt: Date | null
}

export function americanoGamesFromConfig(config: ScoringConfig | null | undefined): number {
  const n = config?.americano_games
  if (typeof n === 'number' && n >= 4 && n <= 16) return Math.floor(n)
  return DEFAULT_AMERICANO_GAMES
}

export function breakMinutesFromConfig(config: ScoringConfig | null | undefined): number {
  const n = config?.break_minutes
  if (typeof n === 'number' && n >= 0 && n <= 15) return Math.floor(n)
  return DEFAULT_BREAK_MINUTES
}

export function gameMinutesFromConfig(
  config: ScoringConfig | null | undefined,
  eventMinutes = 0,
  totalGames = DEFAULT_AMERICANO_GAMES,
  breakMinutes = DEFAULT_BREAK_MINUTES,
): number {
  const n = config?.game_minutes
  if (typeof n === 'number' && n >= 1 && n <= 60) return Math.floor(n)
  if (eventMinutes > 0 && totalGames > 0) {
    return gameDurationForEvent(eventMinutes, totalGames, breakMinutes)
  }
  return DEFAULT_GAME_MINUTES
}

export function totalScheduleMinutes(
  totalGames: number,
  gameMinutes: number,
  breakMinutes: number,
): number {
  if (totalGames <= 0 || gameMinutes <= 0) return 0
  return totalGames * gameMinutes + Math.max(0, totalGames - 1) * breakMinutes
}

export function planAmericanoSchedule(
  eventStartsAt: string,
  totalGames: number,
  gameMinutes: number,
  breakMinutes: number,
  eventMinutes: number,
): SchedulePlan {
  const usedMinutes = totalScheduleMinutes(totalGames, gameMinutes, breakMinutes)
  const fits = usedMinutes <= eventMinutes
  const slots: ScheduleSlot[] = []
  const eventStart = new Date(eventStartsAt)

  for (let g = 1; g <= totalGames; g++) {
    const { startsAt, endsAt } = gameSlotTimes(eventStartsAt, g, gameMinutes, breakMinutes)
    slots.push({
      gameNumber: g,
      startsAt,
      endsAt,
      breakMinutesAfter: g < totalGames ? breakMinutes : 0,
    })
  }

  const last = slots[slots.length - 1]
  return {
    slots,
    usedMinutes,
    bufferMinutes: Math.max(0, eventMinutes - usedMinutes),
    fits,
    finishAt: last?.endsAt ?? eventStart,
  }
}

export function americanoScheduleFromSession(
  session: Pick<GameSession, 'starts_at' | 'ends_at' | 'scoring_config'> | null,
): {
  totalGames: number
  breakMinutes: number
  gameMinutes: number
  eventMinutes: number
} {
  const totalGames = americanoGamesFromConfig(session?.scoring_config)
  const breakMinutes = breakMinutesFromConfig(session?.scoring_config)
  const eventMinutes =
    session?.starts_at && session?.ends_at
      ? eventDurationMinutes(session.starts_at, session.ends_at)
      : 0
  const gameMinutes = gameMinutesFromConfig(
    session?.scoring_config,
    eventMinutes,
    totalGames,
    breakMinutes,
  )
  return { totalGames, breakMinutes, gameMinutes, eventMinutes }
}

export function courtsNeeded(playerCount: number): number {
  return Math.floor(playerCount / PLAYERS_PER_COURT)
}

export function isValidCourtLayout(playerCount: number): boolean {
  return playerCount >= PLAYERS_PER_COURT && playerCount % PLAYERS_PER_COURT === 0
}

/** Americano: each player partners with every other player once → n − 1 games. */
export function americanoRoundsForFullRotation(playerCount: number): number {
  if (playerCount < PLAYERS_PER_COURT) return 0
  return playerCount - 1
}

export function eventDurationMinutes(startsAt: string, endsAt: string): number {
  return Math.max(0, (new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 60000)
}

/** floor(eventMinutes / totalGames − breakMinutes) — e.g. 120 min ÷ 11 games − 1 = 9 min play. */
export function gameDurationForEvent(
  eventMinutes: number,
  totalGames: number,
  breakMinutes = COMPETITION_BREAK_MINUTES,
): number {
  if (totalGames <= 0 || eventMinutes <= 0) return 0
  return Math.max(1, Math.floor(eventMinutes / totalGames - breakMinutes))
}

export function gameSlotTimes(
  eventStartsAt: string,
  gameNumber: number,
  gameMinutes: number,
  breakMinutes = COMPETITION_BREAK_MINUTES,
): { startsAt: Date; endsAt: Date } {
  const offsetMin = (gameNumber - 1) * (gameMinutes + breakMinutes)
  const startsAt = new Date(new Date(eventStartsAt).getTime() + offsetMin * 60000)
  const endsAt = new Date(startsAt.getTime() + gameMinutes * 60000)
  return { startsAt, endsAt }
}

export function eventScheduleSummary(
  startsAt: string,
  endsAt: string,
  totalGames: number,
  breakMinutes = COMPETITION_BREAK_MINUTES,
): string {
  const eventMinutes = Math.round(eventDurationMinutes(startsAt, endsAt))
  const gameMinutes = gameDurationForEvent(eventMinutes, totalGames, breakMinutes)
  return `${totalGames} games · ${gameMinutes} min each + ${breakMinutes} min break (${eventMinutes} min event)`
}

export type CourtLayoutSlot = {
  courtIndex: number
  courtLabel: string
  players: string[]
}

export function buildCourtLayout(
  roster: CompetitionPlayer[],
  courtNames: string[],
): CourtLayoutSlot[] {
  const needed = courtsNeeded(roster.length)
  const names = roster.map(rosterDisplayName)
  const slots: CourtLayoutSlot[] = []

  for (let i = 0; i < needed; i += 1) {
    const start = i * PLAYERS_PER_COURT
    slots.push({
      courtIndex: i + 1,
      courtLabel: courtNames[i] ?? `Court ${i + 1}`,
      players: names.slice(start, start + PLAYERS_PER_COURT),
    })
  }

  return slots
}
