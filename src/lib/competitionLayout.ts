import type { CompetitionPlayer } from '../hooks/useCompetitions'
import { rosterDisplayName } from '../hooks/useCompetitions'
import {
  formatHourLabel,
  LAST_SLOT_START_HOUR,
  OPEN_HOUR,
  toIsoTimestamp,
} from './courtSchedule'
import type { GameSession, ScoringConfig } from './types'

export const PLAYERS_PER_COURT = 4
export const TEAMS_PER_COURT = 2
export const COURT_COUNT_OPTIONS = [1, 2, 3, 4] as const
export type CourtCount = (typeof COURT_COUNT_OPTIONS)[number]

export function playersFromCourtCount(courts: number): number {
  return Math.max(1, Math.min(4, courts)) * PLAYERS_PER_COURT
}

export function teamsFromCourtCount(courts: number): number {
  return Math.max(1, Math.min(4, courts)) * TEAMS_PER_COURT
}

/** Full round-robin: each team plays every other team once. */
export function duoGameCountFromTeamCount(teamCount: number): number {
  return Math.max(1, teamCount - 1)
}

export function duoGameCountFromCourtCount(courts: number): number {
  return duoGameCountFromTeamCount(teamsFromCourtCount(courts))
}

export function courtCountFromPlayers(players: number): CourtCount {
  const courts = Math.floor(players / PLAYERS_PER_COURT)
  if (courts <= 1) return 1
  if (courts >= 4) return 4
  return courts as CourtCount
}

export const DEFAULT_SINGLES_COURT_COUNT: CourtCount = 4
export const DEFAULT_DUO_COURT_COUNT: CourtCount = 3
export const DEFAULT_AMERICANO_GAMES = 7
export const AMERICANO_GAME_COUNTS = [5, 6, 7, 8, 9, 10, 11] as const
export const BREAK_MINUTE_OPTIONS = [2, 3, 4, 5] as const
export const DEFAULT_BREAK_MINUTES = 3
export const DEFAULT_GAME_MINUTES = 14
/** Minutes before game 1; play starts at :04 / :34 past the hour. */
export const AMERICANO_SCHEDULE_LEAD_IN_MINUTES = 4
export const COMPETITION_BREAK_MINUTES = DEFAULT_BREAK_MINUTES

export type CompetitionPlayStartMinute = 4 | 34

export type CompetitionStartSlot = {
  hour: number
  minute: CompetitionPlayStartMinute
  label: string
}

/** Start times shown in the form — always :04 or :34 (4 min past the hour or half-hour). */
export function scheduleCompetitionStartSlots(): CompetitionStartSlot[] {
  const slots: CompetitionStartSlot[] = []
  for (let h = OPEN_HOUR; h <= LAST_SLOT_START_HOUR; h += 1) {
    slots.push({ hour: h, minute: 4, label: formatHourLabel(h, 4) })
    if (h < LAST_SLOT_START_HOUR) {
      slots.push({ hour: h, minute: 34, label: formatHourLabel(h, 34) })
    }
  }
  return slots
}

export function snapToCompetitionPlayStart(
  hour: number,
  minute: number,
): { hour: number; minute: CompetitionPlayStartMinute } {
  if (minute < 15) return { hour, minute: 4 }
  if (minute < 45) return { hour, minute: 34 }
  return { hour: hour + 1, minute: 4 }
}

export function parseCompetitionStartSlotValue(value: string): {
  hour: number
  minute: CompetitionPlayStartMinute
} {
  const [hRaw, mRaw] = value.split(':')
  const hour = Number(hRaw)
  const minute = Number(mRaw)
  if (!Number.isFinite(hour)) return { hour: 18, minute: 4 }
  if (minute === 34) return { hour, minute: 34 }
  return { hour, minute: 4 }
}

export function competitionAnchorMinute(playMinute: CompetitionPlayStartMinute): number {
  return playMinute - AMERICANO_SCHEDULE_LEAD_IN_MINUTES
}

export function competitionStartsAtAnchorIso(
  day: string,
  hour: number,
  playMinute: CompetitionPlayStartMinute,
): string {
  return toIsoTimestamp(day, hour, competitionAnchorMinute(playMinute))
}

export function competitionPlayStartFromAnchorIso(iso: string): Date {
  return new Date(
    new Date(iso).getTime() + AMERICANO_SCHEDULE_LEAD_IN_MINUTES * 60_000,
  )
}

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

export function americanoScheduleUsedMinutes(
  totalGames: number,
  gameMinutes: number,
  breakMinutes: number,
): number {
  return AMERICANO_SCHEDULE_LEAD_IN_MINUTES + totalScheduleMinutes(totalGames, gameMinutes, breakMinutes)
}

export function planAmericanoSchedule(
  eventStartsAt: string,
  totalGames: number,
  gameMinutes: number,
  breakMinutes: number,
  eventMinutes: number,
): SchedulePlan {
  const usedMinutes = americanoScheduleUsedMinutes(totalGames, gameMinutes, breakMinutes)
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

/** floor((eventMinutes − lead-in) / totalGames − breakMinutes) */
export function gameDurationForEvent(
  eventMinutes: number,
  totalGames: number,
  breakMinutes = COMPETITION_BREAK_MINUTES,
): number {
  if (totalGames <= 0 || eventMinutes <= 0) return 0
  const playMinutes = Math.max(0, eventMinutes - AMERICANO_SCHEDULE_LEAD_IN_MINUTES)
  return Math.max(1, Math.floor(playMinutes / totalGames - breakMinutes))
}

export function gameSlotTimes(
  eventStartsAt: string,
  gameNumber: number,
  gameMinutes: number,
  breakMinutes = COMPETITION_BREAK_MINUTES,
): { startsAt: Date; endsAt: Date } {
  const offsetMin =
    AMERICANO_SCHEDULE_LEAD_IN_MINUTES + (gameNumber - 1) * (gameMinutes + breakMinutes)
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
