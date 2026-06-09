import type { CourtPlayer, GameRound } from './americanoSchedule'
import {
  type AmericanoScoringChoice,
  buildAmericanoScoringConfig,
  buildRulesText,
  type PartnerStyle,
  type RuleFormat,
  rulesToPartnershipMode,
} from './competitionPresets'
import { courtsNeeded, isValidCourtLayout } from './competitionLayout'
import { pivotScheduleByCourt } from './competitionCourtBoard'
import type { QuadrantPlayers } from './gesturePadPlayers'
import { quadrantPlayersForCourt } from './gesturePadPlayers'
import { BIA_PROFILE_ID, UI_PROFILE_ID } from './friendlyMatch'
import { toIsoTimestamp } from './courtSchedule'
import { rosterFromSlots } from './rosterPreview'
import { planRankedSchedule } from './rankedSchedule'
import type { GameSession } from './types'

/** Legacy key — published games live in Supabase only; cleared on friendly home load. */
const STORAGE_KEY = 'sp-friendly-games'

export const FRIENDLY_MIN_PLAYERS = 4
export const FRIENDLY_MAX_PLAYERS = 16

export type FriendlyPlayMode = 'free' | 'organized'
export type FriendlyVisibility = 'public' | 'private'

export type FriendlyOrganizedConfig = {
  day: string
  startHour: number
  ruleFormat: RuleFormat
  partnerStyle: PartnerStyle
  americanoScoring: AmericanoScoringChoice
  gameCount: number
  gameMinutes: number
  breakMinutes: number
  previewSeed: number
}

export function friendlyStartsAtIso(config: FriendlyOrganizedConfig): string | undefined {
  if (!config.day) return undefined
  return toIsoTimestamp(config.day, config.startHour)
}

export const DEFAULT_FRIENDLY_ORGANIZED_CONFIG: FriendlyOrganizedConfig = {
  day: '',
  startHour: 18,
  ruleFormat: 'king_of_court',
  partnerStyle: 'swapped',
  americanoScoring: 'open',
  gameCount: 7,
  gameMinutes: 14,
  breakMinutes: 3,
  previewSeed: 0,
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

export function isOrganizedFriendly(game: FriendlyGameRecord): boolean {
  return game.playMode !== 'free'
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

export function canJoinFriendlyGame(
  game: FriendlyGameRecord,
  userId: string | null | undefined,
): boolean {
  return (
    isPublicFriendly(game) &&
    game.status === 'ready' &&
    friendlyVacantSlots(game) > 0 &&
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
  if (profileId) return { id: profileId, name: trimmed, avatarUrl }
  const upper = trimmed.toUpperCase()
  if (upper === 'UI') return { id: UI_PROFILE_ID, name: 'UI', avatarUrl }
  if (upper === 'BIA') return { id: BIA_PROFILE_ID, name: 'BIA', avatarUrl }
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
): GameRound[] | null {
  if (config.ruleFormat !== 'americano') return null
  const count = players.length
  if (!isValidCourtLayout(count) || courtNames.length === 0) return null
  return planRankedSchedule(
    rosterFromSlots(players, count),
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
  const scheduled = friendlyOrganizedGames(game.players, config, courtNames)
  if (scheduled?.length) return scheduled
  return [friendlyGameRound(game.players, game.profileIds, profileAvatars)]
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

