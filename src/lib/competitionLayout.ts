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
  competitionScheduleFromSession,
  competitionCanonicalEventMinutes,
  totalScheduleMinutes,
} from './competitionScheduleLayout'

export const PLAYERS_PER_COURT = 4
export const TEAMS_PER_COURT = 2
export const COURT_COUNT_OPTIONS = [1, 2, 3, 4] as const
export type CourtCount = (typeof COURT_COUNT_OPTIONS)[number]
type CompetitionScheduleSession = Pick<
  GameSession,
  'starts_at' | 'ends_at' | 'scoring_config' | 'target_players' | 'max_players'
> &
  Partial<
    Pick<
      GameSession,
      'schedule_game_count' | 'schedule_game_minutes' | 'schedule_break_minutes'
    >
  >

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
export type CompetitionPlayStartMinute = number

export type CompetitionStartSlot = {
  hour: number
  minute: CompetitionPlayStartMinute
  label: string
}

/** Start times shown in the form — always :10 or :40 (10 min past the hour or half-hour). */
export function scheduleCompetitionStartSlots(): CompetitionStartSlot[] {
  const slots: CompetitionStartSlot[] = []
  for (let h = OPEN_HOUR; h <= LAST_SLOT_START_HOUR; h += 1) {
    slots.push({ hour: h, minute: 10, label: formatHourLabel(h, 10) })
    if (h < LAST_SLOT_START_HOUR) {
      slots.push({ hour: h, minute: 40, label: formatHourLabel(h, 40) })
    }
  }
  return slots
}

export function snapToCompetitionPlayStart(
  hour: number,
  minute: number,
): { hour: number; minute: CompetitionPlayStartMinute } {
  if (minute < 25) return { hour, minute: 10 }
  if (minute < 55) return { hour, minute: 40 }
  return { hour: hour + 1, minute: 10 }
}

export function parseCompetitionStartSlotValue(value: string): {
  hour: number
  minute: CompetitionPlayStartMinute
} {
  const [hRaw, mRaw] = value.split(':')
  const hour = Number(hRaw)
  const minute = Number(mRaw)
  if (!Number.isFinite(hour)) return { hour: 18, minute: 10 }
  if (minute === 40) return { hour, minute: 40 }
  return { hour, minute: 10 }
}

export function competitionAnchorMinute(playMinute: CompetitionPlayStartMinute): number {
  return playMinute
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
): Date {
  return new Date(iso)
}

export function competitionPlayStartFromSession(
  session: CompetitionScheduleSession,
): Date {
  const playStartsAt = resolveCompetitionSchedule(session).playStartsAt
  return playStartsAt ?? new Date()
}

/** ISO timestamp for first game slot — matches invite card playStartsAt, not raw anchor. */
export function competitionPlayStartIso(
  session: CompetitionScheduleSession | null,
): string | undefined {
  if (!session?.starts_at) return undefined
  const { playStartsAt } = resolveCompetitionSchedule(session)
  return playStartsAt?.toISOString() ?? session.starts_at
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
  session: CompetitionScheduleSession | null,
): ResolvedCompetitionSchedule {
  const eventMinutes =
    eventMinutesForSession(session) || competitionCanonicalEventMinutes()
  const persisted = competitionScheduleFromSession(session)
  const totalGames = persisted.games
  const breakMinutes = persisted.breakMinutes
  const gameMinutes = persisted.gameMinutes

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

export function americanoScheduleFromSession(
  session: CompetitionScheduleSession | null,
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

export function scheduleLeadInMinutes(
  _eventMinutes: number,
  _totalGames: number,
  _gameMinutes: number,
  _breakMinutes: number,
): number {
  return 0
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

export function formatGameCountdown(remainingMs: number): string {
  if (remainingMs <= 0) return '0:00'
  const m = Math.floor(remainingMs / 60000)
  const s = Math.floor((remainingMs % 60000) / 1000)
  return `${m}:${String(s).padStart(2, '0')}`
}

export function gameSlotTimes(
  eventStartsAt: string,
  gameNumber: number,
  gameMinutes: number,
  breakMinutes: number = COMPETITION_SCHEDULE.breakMinutes,
  _opts?: GameSlotOpts,
): { startsAt: Date; endsAt: Date } {
  const offsetMin = (gameNumber - 1) * (gameMinutes + breakMinutes)
  const startsAt = new Date(new Date(eventStartsAt).getTime() + offsetMin * 60000)
  const endsAt = new Date(startsAt.getTime() + gameMinutes * 60000)
  return { startsAt, endsAt }
}

/** Display + countdown times — always from canonical schedule, not DB round rows. */
export function competitionRoundTimesByGame(
  session: CompetitionScheduleSession | null,
  gameCount?: number,
  savedRounds: readonly {
    round_number: number
    starts_at: string
    ends_at: string
  }[] = [],
): Map<number, { startsAt: number; endsAt: number }> {
  const map = new Map<number, { startsAt: number; endsAt: number }>()
  for (const round of savedRounds) {
    const startsAt = new Date(round.starts_at).getTime()
    const endsAt = new Date(round.ends_at).getTime()
    if (Number.isFinite(startsAt) && Number.isFinite(endsAt) && endsAt > startsAt) {
      map.set(round.round_number, { startsAt, endsAt })
    }
  }
  const playStartIso = competitionPlayStartIso(session)
  if (!playStartIso) return map
  const schedule = resolveCompetitionSchedule(session)
  const count = gameCount ?? schedule.totalGames
  const slotOpts = gameSlotOptsFromSchedule(schedule)
  for (let g = 1; g <= count; g++) {
    if (map.has(g)) continue
    const slot = gameSlotTimes(
      playStartIso,
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

export function courtSortStartFromConfig(config: ScoringConfig | null | undefined): number {
  const n = config?.court_sort_start
  if (typeof n === 'number' && Number.isFinite(n) && n >= 1) return Math.floor(n)
  return 1
}

/** Map logical court slots to physical club courts (e.g. start at Court 2). */
export function courtNamesForPlay(
  clubCourts: { name: string; sort_order: number }[],
  neededCourts: number,
  scoringConfig?: ScoringConfig | null,
): string[] {
  const sorted = [...clubCourts].sort((a, b) => a.sort_order - b.sort_order)
  const start = courtSortStartFromConfig(scoringConfig)
  const fromStart = sorted.filter((court) => court.sort_order >= start)
  const pool = fromStart.length >= neededCourts ? fromStart : sorted
  return Array.from({ length: neededCourts }, (_, i) => pool[i]?.name ?? `Court ${start + i}`)
}
