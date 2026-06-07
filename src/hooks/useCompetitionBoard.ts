import { useCallback, useMemo } from 'react'
import {
  americanoScoringUnit,
  americanoTargetPoints,
  usesAmericanoScoring,
} from '../lib/competitionPresets'
import {
  americanoScheduleFromSession,
  courtsNeeded,
  isValidCourtLayout,
  RANKED_GAME_MINUTES,
} from '../lib/competitionLayout'
import {
  gamesFromStoredSchedule,
  planRankedSchedule,
  scheduleSeedFromSession,
  sortRosterByRank,
  storedScheduleFromConfig,
} from '../lib/rankedSchedule'
import type { GameRound } from '../lib/americanoSchedule'
import { pivotScheduleByCourt, type CourtColumn } from '../lib/competitionCourtBoard'
import type { CompetitionPlayer } from './useCompetitions'
import {
  matchWinnerTeam,
  roundPlayerName,
  type ClubCourt,
  type CompetitionRound,
  type CourtMatch,
  type RoundPlayer,
} from './useCompetitionRun'
import type { GameSession, MatchTeam } from '../lib/types'

type LiveCourt = {
  courtId: string
  courtName: string
  teamA: string[]
  teamB: string[]
  playerIds: string[]
  teamAIds: (string | null)[]
  teamBIds: (string | null)[]
  teamAAvatars: (string | null)[]
  teamBAvatars: (string | null)[]
}

function groupLiveCourts(players: RoundPlayer[]): LiveCourt[] {
  const map = new Map<string, LiveCourt>()
  for (const p of players) {
    const row =
      map.get(p.court_id) ??
      ({
        courtId: p.court_id,
        courtName: p.courts?.name ?? 'Court',
        teamA: [],
        teamB: [],
        playerIds: [],
        teamAIds: [],
        teamBIds: [],
        teamAAvatars: [],
        teamBAvatars: [],
      } satisfies LiveCourt)
    const label = roundPlayerName(p)
    const pid = p.profile_id ?? p.session_players?.profile_id
    const avatarUrl = p.session_players?.profiles?.avatar_url ?? null
    if (p.team === 'a') {
      row.teamA.push(label)
      row.teamAIds.push(pid ?? null)
      row.teamAAvatars.push(avatarUrl)
    } else {
      row.teamB.push(label)
      row.teamBIds.push(pid ?? null)
      row.teamBAvatars.push(avatarUrl)
    }
    if (pid) row.playerIds.push(pid)
    map.set(p.court_id, row)
  }
  return [...map.values()]
}

export function gamesFromDbRounds(rounds: CompetitionRound[], clubCourts: ClubCourt[]): GameRound[] {
  const courtOrder = new Map(clubCourts.map((c) => [c.id, c.sort_order]))
  return [...rounds]
    .sort((a, b) => a.round_number - b.round_number)
    .map((round) => {
      const courts = groupLiveCourts(round.competition_round_players ?? [])
      courts.sort(
        (a, b) => (courtOrder.get(a.courtId) ?? 99) - (courtOrder.get(b.courtId) ?? 99),
      )
      return {
        gameNumber: round.round_number,
        matches: courts.map((c) => ({
          courtLabel: c.courtName,
          teamA: [c.teamA[0] ?? '', c.teamA[1] ?? ''] as [string, string],
          teamB: [c.teamB[0] ?? '', c.teamB[1] ?? ''] as [string, string],
        })),
      }
    })
}

export function useCompetitionBoard(
  session: GameSession | null,
  rounds: CompetitionRound[],
  roster: CompetitionPlayer[],
  clubCourts: ClubCourt[],
  courtMatches: CourtMatch[],
) {
  const isAmericano = session ? usesAmericanoScoring(session) : false
  const layoutValid = isValidCourtLayout(roster.length)
  const neededCourts = courtsNeeded(roster.length)
  const scheduleSeed = scheduleSeedFromSession(session?.scoring_config)
  const { totalGames, gameMinutes: scheduledGameMinutes } = americanoScheduleFromSession(session)
  const gameMinutes = isAmericano ? scheduledGameMinutes : 0

  const courtNames = useMemo(() => {
    const fromClub = clubCourts.slice(0, neededCourts).map((c) => c.name)
    return Array.from(
      { length: neededCourts },
      (_, i) => fromClub[i] ?? `Court ${i + 1}`,
    )
  }, [clubCourts, neededCourts])

  const rankedRoster = useMemo(() => sortRosterByRank(roster), [roster])

  const hasLiveRounds = rounds.some((r) => (r.competition_round_players ?? []).length > 0)
  const storedSchedule = useMemo(
    () => storedScheduleFromConfig(session?.scoring_config),
    [session?.scoring_config],
  )

  const americanoGames = useMemo(() => {
    if (!isAmericano || !layoutValid) return []
    if (hasLiveRounds) return gamesFromDbRounds(rounds, clubCourts)
    if (storedSchedule.length > 0) {
      return gamesFromStoredSchedule(rankedRoster, storedSchedule, courtNames)
    }
    return planRankedSchedule(rankedRoster, courtNames, totalGames, scheduleSeed)
  }, [
    isAmericano,
    hasLiveRounds,
    rounds,
    clubCourts,
    layoutValid,
    rankedRoster,
    courtNames,
    scheduleSeed,
    totalGames,
    storedSchedule,
  ])

  const columns: CourtColumn[] = useMemo(() => {
    if (!isAmericano || americanoGames.length === 0) return []
    return pivotScheduleByCourt(
      americanoGames,
      session?.starts_at ?? undefined,
      gameMinutes || RANKED_GAME_MINUTES,
    )
  }, [americanoGames, gameMinutes, isAmericano, session?.starts_at])

  const liveCourtsByGame = useMemo(() => {
    const map = new Map<number, LiveCourt[]>()
    for (const round of rounds) {
      const groups = groupLiveCourts(round.competition_round_players ?? [])
      if (groups.length === 0) continue
      map.set(round.round_number, groups)
    }
    return map
  }, [rounds])

  const roundIdForGame = useCallback(
    (gameNumber: number) => rounds.find((r) => r.round_number === gameNumber)?.id,
    [rounds],
  )

  const scoreUnit = isAmericano && session ? americanoScoringUnit(session) : 'points'
  const playTo =
    isAmericano && session && scoreUnit !== 'open' ? americanoTargetPoints(session) : undefined

  const courtIdByLabel = useMemo(() => {
    const map = new Map<string, string>()
    for (const court of clubCourts) map.set(court.name, court.id)
    return map
  }, [clubCourts])

  const matchForCourt = useCallback(
    (
      roundId: string,
      courtId: string,
    ):
      | {
          score_summary?: string
          teamAPoints?: number
          teamBPoints?: number
          winner?: MatchTeam
          playedAt?: string
        }
      | undefined => {
      const saved = courtMatches.find(
        (m) => m.competition_round_id === roundId && m.court_id === courtId,
      )
      if (!saved) return undefined
      const parts = saved.score_summary?.split('-').map((n) => Number(n.trim()))
      return {
        score_summary: saved.score_summary,
        teamAPoints: parts && parts.length > 0 && Number.isFinite(parts[0]) ? parts[0] : undefined,
        teamBPoints: parts && parts.length > 1 && Number.isFinite(parts[1]) ? parts[1] : undefined,
        winner: matchWinnerTeam(saved),
        playedAt: saved.played_at,
      }
    },
    [courtMatches],
  )

  return {
    isAmericano,
    layoutValid,
    columns,
    liveCourtsByGame,
    roundIdForGame,
    courtIdByLabel,
    scoreUnit,
    playTo,
    matchForCourt,
  }
}
