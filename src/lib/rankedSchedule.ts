import type { CompetitionPlayer } from '../hooks/useCompetitions'
import { rosterDisplayName } from '../hooks/useCompetitions'
import type { GameRound } from './americanoSchedule'
import { solveBalancedSchedule, type RoundAssignment } from './balancedSchedule'
import { courtsNeeded } from './competitionLayout'

export const RANKED_AMERICANO_GAMES = 7
export const RANKED_GAME_MINUTES = 14
/** Bump when schedule logic changes — logged for debug. */
export const RANKED_SCHEDULE_VERSION = 9

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
    })),
  }))
}

export function planRankedSchedule(
  roster: CompetitionPlayer[],
  courtNames: string[],
  totalGames = RANKED_AMERICANO_GAMES,
  scheduleSeed = 0,
): GameRound[] {
  const ranked = sortRosterByRank(roster)
  const n = ranked.length
  if (n < 4 || n % 4 !== 0) return []

  const seed = Math.max(0, Math.floor(scheduleSeed))
  const rounds = solveBalancedSchedule(n, totalGames, seed)
  return roundsToGames(ranked, rounds, courtNames)
}
