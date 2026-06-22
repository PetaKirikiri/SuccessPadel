import type { CourtPlayer, GameRound } from './americanoSchedule'
import {
  type AmericanoScoringChoice,
  buildAmericanoScoringConfig,
  buildRulesText,
  type PartnerStyle,
  type RuleFormat,
  rulesToPartnershipMode,
} from './competitionPresets'
import {
  americanoRoundsForFullRotation,
  courtsNeeded,
  isValidCourtLayout,
  totalScheduleMinutes,
} from './competitionLayout'
import { pivotScheduleByCourt } from './competitionCourtBoard'
import type { QuadrantPlayers } from './gesturePadPlayers'
import { quadrantPlayersForCourt } from './gesturePadPlayers'
import { clubDisplayName, BIA_PROFILE_ID } from './clubMemberDisplay'
import { UI_PROFILE_ID } from './friendlyMatch'
import {
  clubHourToDate,
  clubTimePartsFromDate,
  toIsoTimestamp,
} from './courtSchedule'
import { rosterFromSlots } from './rosterPreview'
import { planRankedSchedule } from './rankedSchedule'
import type { GameSession } from './types'
import type { Gender, SkillLevel } from './competitionPresets'
import { SINGLES_COMPETITION } from './competitionFormatPresets'

/** Legacy key — published games live in Supabase only; cleared on friendly home load. */
const STORAGE_KEY = 'sp-friendly-games'

export const FRIENDLY_MIN_PLAYERS = 4
export const FRIENDLY_MAX_PLAYERS = 16

export type FriendlyPlayMode = 'free' | 'organized'
export type FriendlyVisibility = 'public' | 'private'

export type FriendlyOrganizedConfig = {
  day: string
  startHour: number
  /** Minutes past the hour — delayed start (e.g. 18:30). */
  startMinute?: number
  /** Spare minutes after the last game ends. */
  endBufferMinutes?: number
  /** Fixed court-hire end (Bangkok local). Games must finish by this time. */
  sessionEndHour?: number
  sessionEndMinute?: number
  ruleFormat: RuleFormat
  partnerStyle: PartnerStyle
  americanoScoring: AmericanoScoringChoice
  gameCount: number
  gameMinutes: number
  breakMinutes: number
  previewSeed: number
  /** Dev/test pad: no match end; keep scoring for gesture log tests. */
  endless?: boolean
  /** Bump to clear on-device pad state for this friendly session. */
  padResetAt?: string
  skillLevel?: SkillLevel
  gender?: Gender
}

export function lockedFriendlyOrganizedRules(): Pick<
  FriendlyOrganizedConfig,
  'ruleFormat' | 'partnerStyle' | 'americanoScoring' | 'gameCount' | 'gameMinutes' | 'breakMinutes'
> {
  return {
    ruleFormat: 'americano',
    partnerStyle: 'swapped',
    americanoScoring: SINGLES_COMPETITION.americanoTarget,
    gameCount: SINGLES_COMPETITION.gameCount,
    gameMinutes: SINGLES_COMPETITION.gameMinutes,
    breakMinutes: SINGLES_COMPETITION.breakMinutes,
  }
}

export function friendlyPlayMinutes(config: FriendlyOrganizedConfig): number {
  return (
    config.gameCount * config.gameMinutes +
    Math.max(0, config.gameCount - 1) * config.breakMinutes
  )
}

const FRIENDLY_MIN_GAMES = 5
const FRIENDLY_MAX_GAMES = 11
const FRIENDLY_MIN_GAME_MINUTES = 8
const FRIENDLY_MAX_GAME_MINUTES = 30

export function friendlySessionEndAt(config: FriendlyOrganizedConfig): Date | null {
  if (!config.day) return null
  if (typeof config.sessionEndHour === 'number') {
    return clubHourToDate(config.day, config.sessionEndHour, config.sessionEndMinute ?? 0)
  }
  const warmupMinutes = config.startMinute ?? 0
  const endBufferMinutes = config.endBufferMinutes ?? 0
  const gameStart = clubHourToDate(config.day, config.startHour, warmupMinutes)
  const gameEnd = new Date(gameStart.getTime() + friendlyPlayMinutes(config) * 60_000)
  return new Date(gameEnd.getTime() + endBufferMinutes * 60_000)
}

/** Persist a fixed end time derived from the current schedule (first publish / legacy rows). */
export function friendlyConfigWithSessionEnd(
  config: FriendlyOrganizedConfig,
): FriendlyOrganizedConfig {
  if (typeof config.sessionEndHour === 'number') return config
  const endAt = friendlySessionEndAt(config)
  if (!endAt) return config
  const { hour, minute } = clubTimePartsFromDate(endAt)
  return { ...config, sessionEndHour: hour, sessionEndMinute: minute }
}

/** Save organized settings — keep fixed court end + timing extras from a prior publish. */
export function mergeFriendlyOrganizedConfig(
  prev: FriendlyOrganizedConfig | undefined,
  next: FriendlyOrganizedConfig,
): FriendlyOrganizedConfig {
  const withEnd = friendlyConfigWithSessionEnd(next)
  if (!prev) return withEnd

  const scheduleChanged =
    prev.gameCount !== next.gameCount ||
    prev.gameMinutes !== next.gameMinutes ||
    prev.breakMinutes !== next.breakMinutes ||
    prev.startHour !== next.startHour ||
    (prev.startMinute ?? 0) !== (next.startMinute ?? 0) ||
    prev.day !== next.day

  return {
    ...withEnd,
    endBufferMinutes: prev.endBufferMinutes ?? withEnd.endBufferMinutes,
    sessionEndHour: scheduleChanged
      ? withEnd.sessionEndHour
      : (prev.sessionEndHour ?? withEnd.sessionEndHour),
    sessionEndMinute: scheduleChanged
      ? withEnd.sessionEndMinute
      : (prev.sessionEndMinute ?? withEnd.sessionEndMinute),
    padResetAt: prev.padResetAt,
    endless: prev.endless ?? withEnd.endless,
  }
}

export function friendlyPlayMinutesUntilSessionEnd(
  config: FriendlyOrganizedConfig,
  gameStart: Date,
): number | null {
  const sessionEnd = friendlySessionEndAt(config)
  if (!sessionEnd) return null
  const endBufferMs = (config.endBufferMinutes ?? 0) * 60_000
  const gameEndDeadline = sessionEnd.getTime() - endBufferMs
  return Math.max(0, Math.floor((gameEndDeadline - gameStart.getTime()) / 60_000))
}

/** Fit game count + length into remaining play time (rest minutes between games). */
export function fitFriendlyScheduleToRemaining(
  playMinutes: number,
  breakMinutes: number,
  maxGameCount = FRIENDLY_MAX_GAMES,
): {
  gameCount: number
  gameMinutes: number
  usedMinutes: number
  fits: boolean
} {
  const cappedMax = Math.max(
    FRIENDLY_MIN_GAMES,
    Math.min(FRIENDLY_MAX_GAMES, maxGameCount),
  )

  for (let n = cappedMax; n >= FRIENDLY_MIN_GAMES; n -= 1) {
    const breakTotal = Math.max(0, n - 1) * breakMinutes
    const perGame = Math.floor((playMinutes - breakTotal) / n)
    if (perGame < FRIENDLY_MIN_GAME_MINUTES) continue
    const gameMinutes = Math.min(FRIENDLY_MAX_GAME_MINUTES, perGame)
    const usedMinutes = totalScheduleMinutes(n, gameMinutes, breakMinutes)
    if (usedMinutes <= playMinutes) {
      return { gameCount: n, gameMinutes, usedMinutes, fits: true }
    }
  }

  const n = FRIENDLY_MIN_GAMES
  const breakTotal = Math.max(0, n - 1) * breakMinutes
  const gameMinutes = Math.min(
    FRIENDLY_MAX_GAME_MINUTES,
    Math.max(
      FRIENDLY_MIN_GAME_MINUTES,
      Math.floor((playMinutes - breakTotal) / n),
    ),
  )
  const usedMinutes = totalScheduleMinutes(n, gameMinutes, breakMinutes)
  return {
    gameCount: n,
    gameMinutes,
    usedMinutes,
    fits: usedMinutes <= playMinutes && playMinutes > 0,
  }
}

export function friendlyMaxGameCountForPlayers(playerCount: number): number {
  const rotation = americanoRoundsForFullRotation(playerCount)
  if (rotation > 0) return Math.min(FRIENDLY_MAX_GAMES, rotation)
  return FRIENDLY_MAX_GAMES
}

export type FriendlySessionTiming = {
  sessionStart: Date
  gameStart: Date
  gameEnd: Date
  sessionEnd: Date
  warmupMinutes: number
  endBufferMinutes: number
  playMinutes: number
}

export function friendlySessionTiming(
  config: FriendlyOrganizedConfig,
): FriendlySessionTiming | null {
  if (!config.day) return null
  const delayMin = config.startMinute ?? 0
  const endBufferMinutes = config.endBufferMinutes ?? 0
  const sessionStart = clubHourToDate(config.day, config.startHour, delayMin)
  const gameStart = sessionStart
  const playMinutes = friendlyPlayMinutes(config)
  const gameEnd = new Date(gameStart.getTime() + playMinutes * 60_000)
  const sessionEnd =
    typeof config.sessionEndHour === 'number'
      ? clubHourToDate(config.day, config.sessionEndHour, config.sessionEndMinute ?? 0)
      : new Date(gameEnd.getTime() + endBufferMinutes * 60_000)
  return {
    sessionStart,
    gameStart,
    gameEnd,
    sessionEnd,
    warmupMinutes: delayMin,
    endBufferMinutes,
    playMinutes,
  }
}

export function friendlyStartsAtIso(config: FriendlyOrganizedConfig): string | undefined {
  if (!config.day) return undefined
  return toIsoTimestamp(config.day, config.startHour, config.startMinute ?? 0)
}

export function friendlyEndsAtIso(config: FriendlyOrganizedConfig): string | undefined {
  if (!config.day) return undefined
  if (typeof config.sessionEndHour === 'number') {
    return toIsoTimestamp(
      config.day,
      config.sessionEndHour,
      config.sessionEndMinute ?? 0,
    )
  }
  const offsetMin =
    (config.startMinute ?? 0) +
    friendlyPlayMinutes(config) +
    (config.endBufferMinutes ?? 0)
  return toIsoTimestamp(
    config.day,
    config.startHour + Math.floor(offsetMin / 60),
    offsetMin % 60,
  )
}

export const DEFAULT_FRIENDLY_ORGANIZED_CONFIG: FriendlyOrganizedConfig = {
  day: '',
  startHour: 18,
  ...lockedFriendlyOrganizedRules(),
  previewSeed: 0,
  skillLevel: 'Low Inter',
  gender: 'Mixed',
}

export type FriendlyGameRecord = {
  id: string
  title: string
  createdAt: string
  players: string[]
  profileIds?: (string | null)[]
  profileAvatars?: (string | null)[]
  playMode?: FriendlyPlayMode
  visibility?: FriendlyVisibility
  organizedConfig?: FriendlyOrganizedConfig
  createdBy?: string
  status: 'ready' | 'complete'
}

/** Listed under Past when complete or the scheduled window has ended. */
export function friendlyIsPast(game: FriendlyGameRecord, now = Date.now()): boolean {
  if (game.status === 'complete') return true
  if (!isOrganizedFriendly(game) || !game.organizedConfig?.day) return false
  const endsAt = friendlyEndsAtIso(game.organizedConfig)
  if (!endsAt) return false
  const endMs = Date.parse(endsAt)
  return Number.isFinite(endMs) && now >= endMs
}

export function splitFriendlyGames(games: FriendlyGameRecord[], now = Date.now()) {
  const currentGames: FriendlyGameRecord[] = []
  const pastGames: FriendlyGameRecord[] = []
  for (const game of games) {
    if (friendlyIsPast(game, now)) pastGames.push(game)
    else currentGames.push(game)
  }
  pastGames.sort((a, b) => {
    const configA = a.organizedConfig ?? DEFAULT_FRIENDLY_ORGANIZED_CONFIG
    const configB = b.organizedConfig ?? DEFAULT_FRIENDLY_ORGANIZED_CONFIG
    const ta = Date.parse(friendlyEndsAtIso(configA) ?? a.createdAt)
    const tb = Date.parse(friendlyEndsAtIso(configB) ?? b.createdAt)
    return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0)
  })
  return { currentGames, pastGames }
}

export function isOrganizedFriendly(game: FriendlyGameRecord): boolean {
  return game.playMode === 'organized'
}

export function isFreeFriendly(game: FriendlyGameRecord | null | undefined): boolean {
  if (!game) return false
  return !isOrganizedFriendly(game)
}

export function friendlyScheduleLive(
  config: FriendlyOrganizedConfig,
  nowMs = Date.now(),
): boolean {
  const startsAt = friendlyStartsAtIso(config)
  if (!startsAt) return false
  const startsAtMs = Date.parse(startsAt)
  return Number.isFinite(startsAtMs) && nowMs >= startsAtMs
}

/** Awards after scheduled start (organized) or once a court has been scored (free). */
export function isFriendlySessionStarted(
  game: FriendlyGameRecord,
  scoredCourts = 0,
  nowMs = Date.now(),
): boolean {
  if (isFreeFriendly(game)) return scoredCourts > 0
  return friendlyScheduleLive(game.organizedConfig ?? DEFAULT_FRIENDLY_ORGANIZED_CONFIG, nowMs)
}

export function isEndlessFriendly(game: Pick<FriendlyGameRecord, 'organizedConfig'>): boolean {
  return Boolean(game.organizedConfig?.endless)
}

export function friendlyPadResetAt(
  game: Pick<FriendlyGameRecord, 'organizedConfig'>,
): string | null {
  return game.organizedConfig?.padResetAt ?? null
}

export function isPublicFriendly(game: FriendlyGameRecord): boolean {
  return game.visibility === 'public'
}

export function friendlyVacantSlots(game: FriendlyGameRecord): number {
  const ids = game.profileIds ?? []
  return game.players.filter((name, i) => !name.trim() && !ids[i]).length
}

export function friendlyFilledSlots(game: FriendlyGameRecord): number {
  const ids = game.profileIds ?? []
  return game.players.filter((name, i) => Boolean(name.trim()) || Boolean(ids[i])).length
}

export function isOnFriendlyRoster(game: FriendlyGameRecord, userId: string | null | undefined): boolean {
  if (!userId) return false
  return (game.profileIds ?? []).some((id) => id === userId)
}

/** Guest slot name matches a LINE profile (e.g. admin typed Aew, player is Ae). */
export function friendlyGuestSlotMatchesProfile(guestName: string, profileName: string): boolean {
  const guest = guestName.trim().toLowerCase()
  const profile = profileName.trim().toLowerCase()
  if (!guest || !profile) return false
  if (guest === profile) return true
  if (profile.length >= 2 && guest.startsWith(profile) && guest.length - profile.length <= 2) return true
  if (guest.length >= 2 && profile.startsWith(guest) && profile.length - guest.length <= 2) return true
  return false
}

export function friendlyClaimableGuestSlotIndex(
  game: FriendlyGameRecord,
  profileName: string,
): number {
  const ids = game.profileIds ?? []
  return game.players.findIndex(
    (name, i) => Boolean(name.trim()) && !ids[i] && friendlyGuestSlotMatchesProfile(name, profileName),
  )
}

export function canEditFriendlySession(
  game: Pick<FriendlyGameRecord, 'createdBy'>,
  userId: string | null | undefined,
  isAdmin: boolean,
): boolean {
  return Boolean(isAdmin || (userId && game.createdBy === userId))
}

export function canJoinFriendlyGame(
  game: FriendlyGameRecord,
  userId: string | null | undefined,
  profileName?: string | null,
): boolean {
  const canClaimGuest =
    Boolean(profileName?.trim()) && friendlyClaimableGuestSlotIndex(game, profileName!) >= 0
  return (
    isPublicFriendly(game) &&
    game.status === 'ready' &&
    (friendlyVacantSlots(game) > 0 || canClaimGuest) &&
    Boolean(userId) &&
    !isOnFriendlyRoster(game, userId)
  )
}

export function isLocalFriendlyId(id: string): boolean {
  return id.startsWith('friendly-')
}

/** Drop legacy device-only game list; setup drafts use friendlyFormDraft. */
export function clearFriendlyGamesCache(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

function resolvePlayer(
  name: string,
  profileId: string | null,
  avatarUrl: string | null,
): CourtPlayer {
  const trimmed = name.trim() || 'Player'
  if (profileId) {
    return { id: profileId, name: clubDisplayName(profileId, trimmed), avatarUrl }
  }
  const upper = trimmed.toUpperCase()
  if (upper === 'UI') return { id: UI_PROFILE_ID, name: 'UI', avatarUrl }
  if (upper === 'BIA') return { id: BIA_PROFILE_ID, name: 'Bia', avatarUrl }
  return { id: null, name: trimmed, avatarUrl: null }
}

function courtPlayerNames(players: string[]): [string, string, string, string] {
  const padded = [...players]
  while (padded.length < FRIENDLY_MIN_PLAYERS) padded.push('')
  return padded.slice(0, FRIENDLY_MIN_PLAYERS).map((p, i) => p.trim() || `Player ${i + 1}`) as [
    string,
    string,
    string,
    string,
  ]
}

export function friendlyGameRound(
  players: string[],
  profileIds?: (string | null)[],
  profileAvatars?: (string | null)[],
): GameRound {
  const names = courtPlayerNames(players)
  const ids = profileIds ?? []
  const avatars = profileAvatars ?? []
  return {
    gameNumber: 1,
    matches: [
      {
        courtLabel: 'Court 1',
        teamA: [names[0], names[1]],
        teamB: [names[2], names[3]],
        teamAPlayers: [
          resolvePlayer(names[0], ids[0] ?? null, avatars[0] ?? null),
          resolvePlayer(names[1], ids[1] ?? null, avatars[1] ?? null),
        ],
        teamBPlayers: [
          resolvePlayer(names[2], ids[2] ?? null, avatars[2] ?? null),
          resolvePlayer(names[3], ids[3] ?? null, avatars[3] ?? null),
        ],
      },
    ],
  }
}

export function friendlyCourtColumns(game: FriendlyGameRecord) {
  return pivotScheduleByCourt(
    [friendlyGameRound(game.players, game.profileIds, game.profileAvatars)],
    undefined,
    0,
  )
}

export function friendlyOrganizedSession(
  config: FriendlyOrganizedConfig,
): Pick<GameSession, 'partnership_mode' | 'rules' | 'scoring_config'> {
  if (config.ruleFormat === 'americano') {
    return {
      partnership_mode: 'americano',
      rules: buildRulesText('americano', null, {
        target: config.americanoScoring === 'open' ? undefined : config.americanoScoring,
        unit: config.americanoScoring === 'open' ? 'open' : 'games',
      }),
      scoring_config: buildAmericanoScoringConfig(config.americanoScoring, {
        games: config.gameCount,
        breakMinutes: config.breakMinutes,
        gameMinutes: config.gameMinutes,
      }),
    }
  }
  return {
    partnership_mode: rulesToPartnershipMode(config.ruleFormat, config.partnerStyle),
    rules: buildRulesText(config.ruleFormat, config.partnerStyle),
    scoring_config: {},
  }
}

export function friendlyOrganizedGames(
  players: string[],
  config: FriendlyOrganizedConfig,
  courtNames: string[],
  profileIds?: (string | null)[],
  profileAvatars?: (string | null)[],
): GameRound[] | null {
  if (config.ruleFormat !== 'americano') return null
  const count = players.length
  if (!isValidCourtLayout(count) || courtNames.length === 0) return null
  return planRankedSchedule(
    rosterFromSlots(players, count, profileIds, profileAvatars),
    courtNames.slice(0, courtsNeeded(count)),
    config.gameCount,
    config.previewSeed,
  )
}

export function friendlyPreviewGames(
  game: FriendlyGameRecord,
  courtNames: string[],
  profileAvatars?: (string | null)[],
): GameRound[] {
  const config = game.organizedConfig ?? DEFAULT_FRIENDLY_ORGANIZED_CONFIG
  const scheduled = friendlyOrganizedGames(
    game.players,
    config,
    courtNames,
    game.profileIds,
    profileAvatars ?? game.profileAvatars,
  )
  if (scheduled?.length) return scheduled
  return [friendlyGameRound(game.players, game.profileIds, profileAvatars)]
}

/** Session roster — who is playing, with no court quadrant assignment. */
export function friendlySessionRoster(game: FriendlyGameRecord): CourtPlayer[] {
  const ids = game.profileIds ?? []
  const avatars = game.profileAvatars ?? []
  const len = Math.max(game.players.length, ids.length, avatars.length)
  const roster: CourtPlayer[] = []
  for (let i = 0; i < len; i++) {
    const raw = game.players[i]?.trim() ?? ''
    const profileId = ids[i] ?? null
    if (!raw && !profileId) continue
    roster.push(resolvePlayer(raw || `Player ${i + 1}`, profileId, avatars[i] ?? null))
  }
  return roster
}

export function friendlyQuadrantPlayers(game: FriendlyGameRecord): QuadrantPlayers {
  const round = friendlyGameRound(game.players, game.profileIds, game.profileAvatars)
  const match = round.matches[0]!
  return quadrantPlayersForCourt(
    [...match.teamA],
    [...match.teamB],
    match.teamAPlayers,
    match.teamBPlayers,
  )
}
