import type { CompetitionPlayer } from '../hooks/useCompetitions'
import { rosterDisplayName } from '../hooks/useCompetitions'
import {
  formatHourLabel,
  LAST_SLOT_START_HOUR,
  OPEN_HOUR,
  toIsoTimestamp,
} from './courtSchedule'
import type { GameSession, ScoringConfig } from './types'
import {
  COMPETITION_SCHEDULE,
  competitionCanonicalEventMinutes,
} from './competitionScheduleLayout'

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

export function competitionPlayStartFromAnchorIso(
  iso: string,
  leadInMinutes = AMERICANO_SCHEDULE_LEAD_IN_MINUTES,
): Date {
  return new Date(new Date(iso).getTime() + leadInMinutes * 60_000)
}

export function competitionPlayStartFromSession(
  session: Pick<
    GameSession,
    'starts_at' | 'ends_at' | 'scoring_config' | 'target_players' | 'max_players'
  >,
): Date {
  const playStartsAt = resolveCompetitionSchedule(session).playStartsAt
  return playStartsAt ?? new Date()
}

export type ResolvedCompetitionSchedule = {
  totalGames: number
  breakMinutes: number
  gameMinutes: number
  eventMinutes: number
  leadInMinutes: number
  playBlockMinutes: number
  usedMinutes: number
  fits: boolean
  anchorStartsAt: Date | null
  playStartsAt: Date | null
  eventEndsAt: Date | null
}

export function eventMinutesForSession(
  session: Pick<GameSession, 'starts_at' | 'ends_at'> | null,
): number {
  if (!session?.starts_at) return 0
  if (session.ends_at) return eventDurationMinutes(session.starts_at, session.ends_at)
  return competitionCanonicalEventMinutes()
}

/** Single source of truth — invite badges, play times, and boards all use this. */
export function resolveCompetitionSchedule(
  session: Pick<
    GameSession,
    'starts_at' | 'ends_at' | 'scoring_config' | 'target_players' | 'max_players'
  > | null,
): ResolvedCompetitionSchedule {
  const eventMinutes =
    eventMinutesForSession(session) || competitionCanonicalEventMinutes()
  const totalGames = americanoGamesFromConfig(session?.scoring_config)
  const breakMinutes = breakMinutesFromConfig(session?.scoring_config)
  const gameMinutes = gameMinutesFromConfig(session?.scoring_config, 0, totalGames, breakMinutes)

  const anchorStartsAt = session?.starts_at ? new Date(session.starts_at) : null

  const playBlockMinutes = totalScheduleMinutes(totalGames, gameMinutes, breakMinutes)
  const leadInMinutes =
    eventMinutes > 0
      ? scheduleLeadInMinutes(eventMinutes, totalGames, gameMinutes, breakMinutes)
      : COMPETITION_SCHEDULE.leadInMinutes
  const usedMinutes = leadInMinutes + playBlockMinutes
  const fits = eventMinutes <= 0 || playBlockMinutes <= eventMinutes

  const playStartsAt =
    anchorStartsAt != null
      ? new Date(anchorStartsAt.getTime() + leadInMinutes * 60_000)
      : null

  const configEventMinutes = leadInMinutes + playBlockMinutes
  const eventEndsAt =
    playStartsAt != null && playBlockMinutes > 0
      ? new Date(playStartsAt.getTime() + playBlockMinutes * 60_000)
      : session?.ends_at != null
        ? new Date(session.ends_at)
        : anchorStartsAt != null && configEventMinutes > 0
          ? new Date(anchorStartsAt.getTime() + configEventMinutes * 60_000)
          : null

  const resolvedEventMinutes =
    playBlockMinutes > 0 && eventMinutes > configEventMinutes + 1
      ? configEventMinutes
      : eventMinutes || configEventMinutes

  return {
    totalGames,
    breakMinutes,
    gameMinutes,
    eventMinutes: resolvedEventMinutes,
    leadInMinutes,
    playBlockMinutes,
    usedMinutes,
    fits,
    anchorStartsAt,
    playStartsAt,
    eventEndsAt,
  }
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
  return COMPETITION_SCHEDULE.games
}

export function breakMinutesFromConfig(config: ScoringConfig | null | undefined): number {
  const n = config?.break_minutes
  if (typeof n === 'number' && n >= 0 && n <= 15) return Math.floor(n)
  return COMPETITION_SCHEDULE.breakMinutes
}

export function gameMinutesFromConfig(
  config: ScoringConfig | null | undefined,
  eventMinutes = 0,
  totalGames: number = COMPETITION_SCHEDULE.games,
  breakMinutes: number = COMPETITION_SCHEDULE.breakMinutes,
): number {
  const stored = config?.game_minutes
  if (typeof stored === 'number' && stored >= 1 && stored <= 60) return Math.floor(stored)
  if (eventMinutes > 0 && totalGames > 0) {
    return gameDurationForEvent(eventMinutes, totalGames, breakMinutes)
  }
  return COMPETITION_SCHEDULE.gameMinutes
}

export { mergeScheduleIntoScoringConfig, scoringConfigHasCanonicalSchedule } from './competitionScheduleLayout'

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
  eventMinutes?: number,
): number {
  const playBlock = totalScheduleMinutes(totalGames, gameMinutes, breakMinutes)
  const leadIn =
    eventMinutes != null && eventMinutes > 0
      ? scheduleLeadInMinutes(eventMinutes, totalGames, gameMinutes, breakMinutes)
      : COMPETITION_SCHEDULE.leadInMinutes
  return leadIn + playBlock
}

export function planAmericanoSchedule(
  eventStartsAt: string,
  totalGames: number,
  gameMinutes: number,
  breakMinutes: number,
  eventMinutes: number,
): SchedulePlan {
  const leadInMinutes = scheduleLeadInMinutes(eventMinutes, totalGames, gameMinutes, breakMinutes)
  const playBlock = totalScheduleMinutes(totalGames, gameMinutes, breakMinutes)
  const usedMinutes = leadInMinutes + playBlock
  const fits = usedMinutes <= eventMinutes
  const slots: ScheduleSlot[] = []
  const eventStart = new Date(eventStartsAt)
  const slotOpts = { eventMinutes, totalGames }

  for (let g = 1; g <= totalGames; g++) {
    const { startsAt, endsAt } = gameSlotTimes(
      eventStartsAt,
      g,
      gameMinutes,
      breakMinutes,
      slotOpts,
    )
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
  session: Pick<
    GameSession,
    'starts_at' | 'ends_at' | 'scoring_config' | 'target_players' | 'max_players'
  > | null,
): {
  totalGames: number
  breakMinutes: number
  gameMinutes: number
  eventMinutes: number
  leadInMinutes: number
  fits: boolean
} {
  const resolved = resolveCompetitionSchedule(session)
  return {
    totalGames: resolved.totalGames,
    breakMinutes: resolved.breakMinutes,
    gameMinutes: resolved.gameMinutes,
    eventMinutes: resolved.eventMinutes,
    leadInMinutes: resolved.leadInMinutes,
    fits: resolved.fits,
  }
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

export function gameDurationForEvent(
  eventMinutes: number,
  totalGames: number,
  breakMinutes = COMPETITION_BREAK_MINUTES,
): number {
  if (totalGames <= 0 || eventMinutes <= 0) return 0
  const playMinutes = Math.max(0, eventMinutes - AMERICANO_SCHEDULE_LEAD_IN_MINUTES)
  const breakTotal = Math.max(0, totalGames - 1) * breakMinutes
  return Math.max(1, Math.floor((playMinutes - breakTotal) / totalGames))
}

export function scheduleLeadInMinutes(
  eventMinutes: number,
  totalGames: number,
  gameMinutes: number,
  breakMinutes: number,
): number {
  const playBlock = totalScheduleMinutes(totalGames, gameMinutes, breakMinutes)
  if (eventMinutes <= 0) return COMPETITION_SCHEDULE.leadInMinutes
  const canonical =
    totalGames === COMPETITION_SCHEDULE.games &&
    gameMinutes === COMPETITION_SCHEDULE.gameMinutes &&
    breakMinutes === COMPETITION_SCHEDULE.breakMinutes
  if (canonical && eventMinutes >= playBlock + COMPETITION_SCHEDULE.leadInMinutes) {
    return COMPETITION_SCHEDULE.leadInMinutes
  }
  return Math.max(0, eventMinutes - playBlock)
}

export function resolvedGameMinutes(
  config: ScoringConfig | null | undefined,
  eventMinutes: number,
  totalGames: number,
  breakMinutes: number,
): number {
  return gameMinutesFromConfig(config, eventMinutes, totalGames, breakMinutes)
}

export type GameSlotOpts = {
  eventMinutes?: number
  totalGames?: number
}

export function gameSlotOptsFromSchedule(
  schedule: Pick<{ eventMinutes: number; totalGames: number }, 'eventMinutes' | 'totalGames'>,
): GameSlotOpts | undefined {
  if (schedule.eventMinutes <= 0) return undefined
  return { eventMinutes: schedule.eventMinutes, totalGames: schedule.totalGames }
}

export function gameSlotTimes(
  eventStartsAt: string,
  gameNumber: number,
  gameMinutes: number,
  breakMinutes = COMPETITION_BREAK_MINUTES,
  opts?: GameSlotOpts,
): { startsAt: Date; endsAt: Date } {
  const leadIn =
    opts?.eventMinutes != null &&
    opts.eventMinutes > 0 &&
    opts.totalGames != null &&
    opts.totalGames > 0
      ? scheduleLeadInMinutes(opts.eventMinutes, opts.totalGames, gameMinutes, breakMinutes)
      : COMPETITION_SCHEDULE.leadInMinutes
  const offsetMin = leadIn + (gameNumber - 1) * (gameMinutes + breakMinutes)
  const startsAt = new Date(new Date(eventStartsAt).getTime() + offsetMin * 60000)
  const endsAt = new Date(startsAt.getTime() + gameMinutes * 60000)
  return { startsAt, endsAt }
}

/** Display + countdown times — always from canonical schedule, not DB round rows. */
export function competitionRoundTimesByGame(
  session: Pick<
    GameSession,
    'starts_at' | 'ends_at' | 'scoring_config' | 'target_players' | 'max_players'
  > | null,
  gameCount?: number,
): Map<number, { startsAt: number; endsAt: number }> {
  const map = new Map<number, { startsAt: number; endsAt: number }>()
  if (!session?.starts_at) return map
  const schedule = resolveCompetitionSchedule(session)
  const count = gameCount ?? schedule.totalGames
  const slotOpts = gameSlotOptsFromSchedule(schedule)
  for (let g = 1; g <= count; g++) {
    const slot = gameSlotTimes(
      session.starts_at,
      g,
      schedule.gameMinutes,
      schedule.breakMinutes,
      slotOpts,
    )
    map.set(g, { startsAt: slot.startsAt.getTime(), endsAt: slot.endsAt.getTime() })
  }
  return map
}

export type GameSlotTimes = { startsAt: number; endsAt: number }

export function isGameSlotLive(now: number, times: GameSlotTimes | undefined): boolean {
  return Boolean(times && now >= times.startsAt && now < times.endsAt)
}

/** True during the rest window after this game ends and before the next game starts. */
export function isGameSlotInBreakAfter(
  now: number,
  gameNumber: number,
  timesByGame: Map<number, GameSlotTimes>,
): boolean {
  const times = timesByGame.get(gameNumber)
  if (!times || now < times.endsAt) return false
  const next = timesByGame.get(gameNumber + 1)
  if (!next) return now >= times.endsAt
  return now < next.startsAt
}

/** True during the break before this game starts (after the previous game ended). */
export function isGameSlotInBreakBefore(
  now: number,
  gameNumber: number,
  timesByGame: Map<number, GameSlotTimes>,
): boolean {
  if (gameNumber <= 1) return false
  return isGameSlotInBreakAfter(now, gameNumber - 1, timesByGame)
}

/** TV carousel + scroll focus: live game, else next game during break, else upcoming. */
export function competitionFocusGameNumber(
  now: number,
  timesByGame: Map<number, GameSlotTimes>,
  gameNumbers: number[],
  dbActive?: number,
): number | undefined {
  const sorted = [...gameNumbers].sort((a, b) => a - b)
  if (sorted.length === 0) return dbActive

  for (const g of sorted) {
    if (isGameSlotLive(now, timesByGame.get(g))) return g
  }

  for (let i = 0; i < sorted.length; i += 1) {
    const g = sorted[i]!
    if (isGameSlotInBreakAfter(now, g, timesByGame)) {
      return sorted[i + 1] ?? g
    }
  }

  for (const g of sorted) {
    const times = timesByGame.get(g)
    if (times && now < times.startsAt) return g
  }

  return dbActive ?? sorted[sorted.length - 1]
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
