import { useCallback, useMemo } from 'react'
import {
  americanoScoringUnit,
  americanoTargetPoints,
} from '../lib/competitionPresets'
import {
  duoTeamsForPlay,
  isDuoCompetition,
  usesCompetitionGameScoring,
} from '../lib/competitionFormatPresets'
import {
  americanoScheduleFromSession,
  courtsNeeded,
} from '../lib/competitionLayout'
import {
  gamesFromStoredSchedule,
  planRankedSchedule,
  RANKED_GAME_MINUTES,
  scheduleSeedFromSession,
  sortRosterByRank,
  storedScheduleFromConfig,
  padRosterToTarget,
  targetPlayerCount,
} from '../lib/rankedSchedule'
import { buildDuoStoredSchedule } from '../lib/duoRoundRobinSchedule'
import { DUO_GAME_COUNT } from '../lib/competitionFormatPresets'
import type { CourtPlayer, GameRound } from '../lib/americanoSchedule'
import type { PlaySide } from '../lib/types'
import { pivotScheduleByCourt, sortGameRoundsByCourt, sortLiveCourtsByClubOrder, type CourtColumn } from '../lib/competitionCourtBoard'
import type { CompetitionPlayer, CompetitionSessionPair } from './useCompetitions'
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
  teamAPlayers: CourtPlayer[]
  teamBPlayers: CourtPlayer[]
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
        teamAPlayers: [],
        teamBPlayers: [],
      } satisfies LiveCourt)
    const label = roundPlayerName(p)
    const pid = p.profile_id ?? p.session_players?.profile_id
    const padelPlayerId = p.padel_player_id ?? p.session_players?.padel_player_id ?? null
    const avatarUrl = p.session_players?.profiles?.avatar_url ?? null
    const rawSide = p.session_players?.profiles?.preferred_side
    const preferredSide: PlaySide | null =
      rawSide === 'left' || rawSide === 'right' || rawSide === 'both' ? rawSide : null
    const player = {
      id: pid ?? null,
      rosterId: p.roster_entry_id ?? null,
      padelPlayerId,
      name: label,
      avatarUrl,
      preferredSide,
    } satisfies CourtPlayer
    if (p.team === 'a') {
      row.teamA.push(label)
      row.teamAPlayers.push(player)
    } else {
      row.teamB.push(label)
      row.teamBPlayers.push(player)
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
          teamAPlayers: [
            c.teamAPlayers[0] ?? { id: null, name: c.teamA[0] ?? '', avatarUrl: null },
            c.teamAPlayers[1] ?? { id: null, name: c.teamA[1] ?? '', avatarUrl: null },
          ] as [CourtPlayer, CourtPlayer],
          teamBPlayers: [
            c.teamBPlayers[0] ?? { id: null, name: c.teamB[0] ?? '', avatarUrl: null },
            c.teamBPlayers[1] ?? { id: null, name: c.teamB[1] ?? '', avatarUrl: null },
          ] as [CourtPlayer, CourtPlayer],
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
  sessionPairs: CompetitionSessionPair[] = [],
) {
  const isDuo = isDuoCompetition(session)
  const slotCount = targetPlayerCount(session, roster.length, isDuo)
  const teams = useMemo(
    () => duoTeamsForPlay(roster, session?.scoring_config, slotCount, sessionPairs),
    [roster, session?.scoring_config, slotCount, sessionPairs],
  )
  const isAmericano = session ? usesCompetitionGameScoring(session) : false
  const layoutValid = slotCount >= 4 && slotCount % 4 === 0
  const neededCourts = courtsNeeded(slotCount)
  const scheduleSeed = scheduleSeedFromSession(session?.scoring_config)
  const { totalGames, gameMinutes: scheduledGameMinutes, breakMinutes: scheduledBreakMinutes } =
    americanoScheduleFromSession(session)
  const gameMinutes = isAmericano ? scheduledGameMinutes : 0

  const courtNames = useMemo(() => {
    const fromClub = clubCourts.slice(0, neededCourts).map((c) => c.name)
    return Array.from(
      { length: neededCourts },
      (_, i) => fromClub[i] ?? `Court ${i + 1}`,
    )
  }, [clubCourts, neededCourts])

  const rankedRoster = useMemo(() => sortRosterByRank(roster), [roster])
  const paddedRoster = useMemo(
    () => (layoutValid ? padRosterToTarget(rankedRoster, slotCount) : rankedRoster),
    [layoutValid, rankedRoster, slotCount],
  )

  const hasLiveRounds = rounds.some((r) => (r.competition_round_players ?? []).length > 0)
  const storedSchedule = useMemo(
    () => storedScheduleFromConfig(session?.scoring_config),
    [session?.scoring_config],
  )

  const americanoGames = useMemo(() => {
    if (!isAmericano || !layoutValid) return []
    let games: GameRound[]
    if (hasLiveRounds) games = gamesFromDbRounds(rounds, clubCourts)
    else if (isDuo && teams.length >= 2) {
      const duoSchedule =
        storedSchedule.length > 0
          ? storedSchedule
          : buildDuoStoredSchedule(
              teams.map((t) => ({ label: t.label, rosterIds: t.roster_ids })),
              totalGames || DUO_GAME_COUNT,
              scheduleSeed,
            )
      games = gamesFromStoredSchedule(paddedRoster, duoSchedule, courtNames)
    } else if (storedSchedule.length > 0) {
      games = gamesFromStoredSchedule(paddedRoster, storedSchedule, courtNames)
    } else {
      games = planRankedSchedule(rankedRoster, courtNames, totalGames, scheduleSeed, slotCount)
    }
    return sortGameRoundsByCourt(games)
  }, [
    isAmericano,
    layoutValid,
    hasLiveRounds,
    rounds,
    clubCourts,
    paddedRoster,
    rankedRoster,
    courtNames,
    scheduleSeed,
    totalGames,
    storedSchedule,
    isDuo,
    teams,
    slotCount,
  ])

  const columns: CourtColumn[] = useMemo(() => {
    if (!isAmericano || americanoGames.length === 0) return []
    return pivotScheduleByCourt(
      americanoGames,
      session?.starts_at ?? undefined,
      gameMinutes || RANKED_GAME_MINUTES,
      scheduledBreakMinutes,
      session?.ends_at ?? undefined,
    )
  }, [americanoGames, gameMinutes, isAmericano, scheduledBreakMinutes, session?.ends_at, session?.starts_at])

  const liveCourtsByGame = useMemo(() => {
    const sortOrderByCourtId = new Map(clubCourts.map((c) => [c.id, c.sort_order]))
    const map = new Map<number, LiveCourt[]>()
    for (const round of rounds) {
      const groups = sortLiveCourtsByClubOrder(
        groupLiveCourts(round.competition_round_players ?? []),
        sortOrderByCourtId,
      )
      if (groups.length === 0) continue
      map.set(round.round_number, groups)
    }
    return map
  }, [rounds, clubCourts])

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
    isDuo,
    teams,
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
