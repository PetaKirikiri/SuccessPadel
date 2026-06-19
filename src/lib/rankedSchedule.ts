import type { CompetitionPlayer } from '../hooks/useCompetitions'
import { rosterDisplayName } from '../hooks/useCompetitions'
import { clubDisplayName } from './clubMemberDisplay'
import type { CourtPlayer, GameRound } from './americanoSchedule'
import { solveBalancedSchedule, type RoundAssignment } from './balancedSchedule'
import { courtsNeeded } from './competitionLayout'
import { DUO_PLAYER_COUNT, SINGLES_COMPETITION } from './competitionFormatPresets'
import { RANKED_AMERICANO_GAMES } from './competitionScheduleConstants'
import type { GameSession } from './types'

export const OPEN_SLOT_NAME = 'Open'

export function isOpenSlotId(id: string): boolean {
  return id.startsWith('00000000-0000-4000-8000-')
}

export function openSlotId(rank: number): string {
  return `00000000-0000-4000-8000-${String(rank).padStart(12, '0')}`
}

/** Pad roster to target size with open slots at missing rank positions. */
export function padRosterToTarget(
  roster: CompetitionPlayer[],
  target: number,
): CompetitionPlayer[] {
  const sorted = sortRosterByRank(roster)
  const byRank = new Map<number, CompetitionPlayer>()
  for (const player of sorted) {
    const rank = player.rank_order ?? 0
    if (!byRank.has(rank)) byRank.set(rank, player)
  }
  return Array.from({ length: target }, (_, rank) => {
    const existing = byRank.get(rank)
    if (existing) return existing
    return {
      id: openSlotId(rank),
      profile_id: null,
      padel_player_id: null,
      guest_name: null,
      guest_email: null,
      rank_order: rank,
      profiles: null,
    }
  })
}

export function targetPlayerCount(
  session: Pick<GameSession, 'target_players' | 'max_players'> | null | undefined,
  rosterLength: number,
  isDuo: boolean,
): number {
  const cap = session?.target_players ?? session?.max_players
  if (isDuo) {
    if (typeof cap === 'number' && cap >= 4) return cap
    return DUO_PLAYER_COUNT
  }

  // e.g. 11 signed up, max 16 → 12 slots (3 courts), rank 12 is Open
  if (rosterLength >= 4) {
    const slotsForRoster = Math.ceil(rosterLength / 4) * 4
    if (typeof cap === 'number' && cap >= 4) return Math.min(cap, slotsForRoster)
    return slotsForRoster
  }

  if (typeof cap === 'number' && cap >= 4) return cap
  return SINGLES_COMPETITION.targetPlayers
}

/** Bump when schedule logic changes — logged for debug. */
export const RANKED_SCHEDULE_VERSION = 10

export { RANKED_AMERICANO_GAMES, RANKED_GAME_MINUTES } from './competitionScheduleConstants'

export type StoredScheduleMatch = {
  court: number
  team_a: [string, string]
  team_b: [string, string]
}

export type StoredScheduleRound = {
  round: number
  matches: StoredScheduleMatch[]
}

export function scheduleSeedFromSession(
  scoringConfig: Record<string, unknown> | null | undefined,
): number {
  const raw = scoringConfig?.schedule_seed
  if (typeof raw === 'number' && Number.isFinite(raw)) return Math.max(0, Math.floor(raw))
  return 0
}

export function nextScheduleSeed(current: number, playerCount: number): number {
  const span = Math.max(1, playerCount - 1)
  return (current + 1) % span
}

export function courtPlayerFromRoster(sp: CompetitionPlayer): CourtPlayer {
  if (isOpenSlotId(sp.id)) {
    return { id: null, name: OPEN_SLOT_NAME, avatarUrl: null }
  }
  const profileId = sp.profile_id ?? sp.profiles?.id ?? null
  const name = clubDisplayName(profileId, rosterDisplayName(sp))
  const avatarUrl = profileId ? (sp.profiles?.avatar_url ?? null) : null
  return { id: profileId, name, avatarUrl }
}

export function sortRosterByRank(roster: CompetitionPlayer[]): CompetitionPlayer[] {
  return [...roster].sort((a, b) => {
    const ar = a.rank_order ?? 0
    const br = b.rank_order ?? 0
    if (ar !== br) return ar - br
    return a.id.localeCompare(b.id)
  })
}

export function buildStoredSchedule(
  ranked: CompetitionPlayer[],
  rounds: RoundAssignment[],
): StoredScheduleRound[] {
  return rounds.map((round) => ({
    round: round.round,
    matches: round.courts.map((court, courtIndex) => ({
      court: courtIndex + 1,
      team_a: [ranked[court.teamA[0]].id, ranked[court.teamA[1]].id],
      team_b: [ranked[court.teamB[0]].id, ranked[court.teamB[1]].id],
    })),
  }))
}

export function roundsToGames(
  ranked: CompetitionPlayer[],
  rounds: RoundAssignment[],
  courtNames: string[],
): GameRound[] {
  const courts = courtsNeeded(ranked.length)
  const courtsInUse = courtNames.slice(0, courts)

  return rounds.map((round) => ({
    gameNumber: round.round,
    matches: round.courts.map((court, courtIndex) => ({
      courtLabel: courtsInUse[courtIndex] ?? `Court ${courtIndex + 1}`,
      teamA: [
        rosterDisplayName(ranked[court.teamA[0]]),
        rosterDisplayName(ranked[court.teamA[1]]),
      ],
      teamB: [
        rosterDisplayName(ranked[court.teamB[0]]),
        rosterDisplayName(ranked[court.teamB[1]]),
      ],
      teamAPlayers: [
        courtPlayerFromRoster(ranked[court.teamA[0]]),
        courtPlayerFromRoster(ranked[court.teamA[1]]),
      ],
      teamBPlayers: [
        courtPlayerFromRoster(ranked[court.teamB[0]]),
        courtPlayerFromRoster(ranked[court.teamB[1]]),
      ],
    })),
  }))
}

export function storedScheduleFromConfig(
  scoringConfig: Record<string, unknown> | null | undefined,
): StoredScheduleRound[] {
  const raw = scoringConfig?.schedule
  if (!Array.isArray(raw)) return []
  const out: StoredScheduleRound[] = []
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue
    const round = (row as StoredScheduleRound).round
    const matches = (row as StoredScheduleRound).matches
    if (typeof round !== 'number' || !Array.isArray(matches)) continue
    out.push({ round, matches })
  }
  return out.sort((a, b) => a.round - b.round)
}

function nameForRosterId(ranked: CompetitionPlayer[], id: string): string {
  if (isOpenSlotId(id)) return OPEN_SLOT_NAME
  const player = ranked.find((p) => p.id === id)
  return player ? rosterDisplayName(player) : 'Player'
}

function courtPlayerForRosterId(ranked: CompetitionPlayer[], id: string): CourtPlayer {
  if (isOpenSlotId(id)) return { id: null, name: OPEN_SLOT_NAME, avatarUrl: null }
  const player = ranked.find((p) => p.id === id)
  return player ? courtPlayerFromRoster(player) : { id: null, name: 'Player', avatarUrl: null }
}

export function gamesFromStoredSchedule(
  ranked: CompetitionPlayer[],
  stored: StoredScheduleRound[],
  courtNames: string[],
): GameRound[] {
  const courts = courtsNeeded(ranked.length)
  const courtsInUse = courtNames.slice(0, courts)
  return stored.map((round) => ({
    gameNumber: round.round,
    matches: [...round.matches]
      .sort((a, b) => a.court - b.court)
      .filter((match) => match.court <= courts)
      .slice(0, courts)
      .map((match, courtIndex) => ({
        courtLabel: courtsInUse[match.court - 1] ?? courtsInUse[courtIndex] ?? `Court ${match.court}`,
        teamA: [
          nameForRosterId(ranked, match.team_a[0]),
          nameForRosterId(ranked, match.team_a[1]),
        ],
        teamB: [
          nameForRosterId(ranked, match.team_b[0]),
          nameForRosterId(ranked, match.team_b[1]),
        ],
        teamAPlayers: [
          courtPlayerForRosterId(ranked, match.team_a[0]),
          courtPlayerForRosterId(ranked, match.team_a[1]),
        ],
        teamBPlayers: [
          courtPlayerForRosterId(ranked, match.team_b[0]),
          courtPlayerForRosterId(ranked, match.team_b[1]),
        ],
      })),
  }))
}

export function planRankedSchedule(
  roster: CompetitionPlayer[],
  courtNames: string[],
  totalGames = RANKED_AMERICANO_GAMES,
  scheduleSeed = 0,
  slotCount?: number,
): GameRound[] {
  const n = slotCount ?? sortRosterByRank(roster).length
  if (n < 4 || n % 4 !== 0) return []

  const padded = padRosterToTarget(roster, n)
  const seed = Math.max(0, Math.floor(scheduleSeed))
  const rounds = solveBalancedSchedule(n, totalGames, seed)
  return roundsToGames(padded, rounds, courtNames)
}
