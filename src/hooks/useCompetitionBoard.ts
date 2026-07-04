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
  competitionPlayStartIso,
  courtNamesForPlay,
  courtsNeeded,
  gameSlotOptsFromSchedule,
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
  courtPlayerFromRoster,
} from '../lib/rankedSchedule'
import { buildDuoStoredSchedule } from '../lib/duoRoundRobinSchedule'
import { DUO_GAME_COUNT } from '../lib/competitionFormatPresets'
import { courtPlayerFromProfile } from '../lib/courtPlayerFromProfile'
import type { CourtPlayer, GameRound } from '../lib/americanoSchedule'
import type { PlaySide } from '../lib/types'
import { pivotScheduleByCourt, sortGameRoundsByCourt, sortLiveCourtsByClubOrder, type CourtColumn } from '../lib/competitionCourtBoard'
import type { CompetitionPlayer, CompetitionSessionPair } from './useCompetitions'
import { buildRosterNameById, rosterDisplayName } from './useCompetitions'
import { parsePlayerGender } from '../lib/profileFields'
import type { LeaderboardEntry } from '../lib/leaderboardTypes'
import {
  matchWinnerTeam,
  roundPlayerName,
  type ClubCourt,
  type CompetitionRound,
  type CourtMatch,
  type RoundPlayer,
} from './useCompetitionRun'
import type { GameSession, MatchTeam } from '../lib/types'
import { debugSessionLog } from '../lib/debug/devDebug'
type LiveCourt = {
  courtId: string
  courtName: string
  teamA: string[]
  teamB: string[]
  playerIds: string[]
  teamAPlayers: CourtPlayer[]
  teamBPlayers: CourtPlayer[]
}

function groupLiveCourts(
  players: RoundPlayer[],
  rosterById: Map<string, CompetitionPlayer>,
  rosterNameById: Map<string, string>,
): LiveCourt[] {
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
    const rosterEntry = rosterById.get(p.roster_entry_id)
    const label =
      rosterNameById.get(p.roster_entry_id) ??
      (rosterEntry ? rosterDisplayName(rosterEntry) : roundPlayerName(p))
    // #region agent log
    if (import.meta.env.DEV && label === 'Player') {
      debugSessionLog(
        'useCompetitionBoard.ts:groupLiveCourts',
        'generic player label resolved',
        {
          rosterEntryId: p.roster_entry_id,
          hasRosterEntry: Boolean(rosterEntry),
          rosterName: rosterEntry ? rosterDisplayName(rosterEntry) : null,
          roundPlayerName: roundPlayerName(p),
          profileId: p.profile_id,
          sessionProfileName: p.session_players?.profiles?.display_name ?? null,
          guestName: p.session_players?.guest_name ?? null,
        },
        'H-A',
        '5d6061',
      )
    }
    // #endregion
    const profile = rosterEntry?.profiles ?? p.session_players?.profiles
    const pid =
      rosterEntry?.profile_id ??
      rosterEntry?.profiles?.id ??
      p.profile_id ??
      p.session_players?.profile_id ??
      null
    const padelPlayerId =
      rosterEntry?.padel_player_id ?? p.padel_player_id ?? p.session_players?.padel_player_id ?? null
    const rawSide = profile && 'preferred_side' in profile ? profile.preferred_side : null
    const preferredSide: PlaySide | null =
      rawSide === 'left' || rawSide === 'right' || rawSide === 'both' ? rawSide : null
    const player = rosterEntry
      ? { ...courtPlayerFromRoster(rosterEntry), name: label, rosterId: p.roster_entry_id }
      : courtPlayerFromProfile({
          profileId: pid ?? null,
          rosterId: p.roster_entry_id ?? null,
          padelPlayerId,
          name: label,
          profile:
            pid && profile
              ? {
                  avatar_url: profile.avatar_url ?? null,
                  pixel_avatar: profile.pixel_avatar ?? null,
                }
              : null,
          preferredSide,
          gender: parsePlayerGender(
            profile && 'gender' in profile ? (profile.gender as string | null | undefined) : null,
          ),
        })
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

export function gamesFromDbRounds(
  rounds: CompetitionRound[],
  clubCourts: ClubCourt[],
  rosterById: Map<string, CompetitionPlayer>,
  rosterNameById: Map<string, string>,
): GameRound[] {
  const courtOrder = new Map(clubCourts.map((c) => [c.id, c.sort_order]))
  return [...rounds]
    .sort((a, b) => a.round_number - b.round_number)
    .map((round) => {
      const courts = groupLiveCourts(
        round.competition_round_players ?? [],
        rosterById,
        rosterNameById,
      )
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

function mergeLiveGamesIntoPlannedGames(plannedGames: GameRound[], liveGames: GameRound[]): GameRound[] {
  if (liveGames.length === 0) return plannedGames
  const liveByGame = new Map(liveGames.map((game) => [game.gameNumber, game]))
  const merged = plannedGames.map((game) => {
    const live = liveByGame.get(game.gameNumber)
    if (!live || live.matches.length === 0) return game
    return live
  })
  const plannedNumbers = new Set(plannedGames.map((game) => game.gameNumber))
  for (const live of liveGames) {
    if (!plannedNumbers.has(live.gameNumber)) merged.push(live)
  }
  return sortGameRoundsByCourt(merged).sort((a, b) => a.gameNumber - b.gameNumber)
}

export function useCompetitionBoard(
  session: GameSession | null,
  rounds: CompetitionRound[],
  roster: CompetitionPlayer[],
  clubCourts: ClubCourt[],
  courtMatches: CourtMatch[],
  sessionPairs: CompetitionSessionPair[] = [],
  leaderboard: LeaderboardEntry[] = [],
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
  const { totalGames, gameMinutes: scheduledGameMinutes, breakMinutes: scheduledBreakMinutes, eventMinutes } =
    americanoScheduleFromSession(session)
  const gameMinutes = isAmericano ? scheduledGameMinutes : 0

  const courtNames = useMemo(
    () => courtNamesForPlay(clubCourts, neededCourts, session?.scoring_config),
    [clubCourts, neededCourts, session?.scoring_config],
  )

  const rankedRoster = useMemo(() => sortRosterByRank(roster), [roster])
  const paddedRoster = useMemo(
    () => (layoutValid ? padRosterToTarget(rankedRoster, slotCount) : rankedRoster),
    [layoutValid, rankedRoster, slotCount],
  )
  const rosterById = useMemo(
    () => new Map(paddedRoster.map((player) => [player.id, player])),
    [paddedRoster],
  )
  const rosterNameById = useMemo(
    () => buildRosterNameById(roster, leaderboard),
    [roster, leaderboard],
  )

  const hasLiveRounds = rounds.some((r) => (r.competition_round_players ?? []).length > 0)
  const storedSchedule = useMemo(
    () => storedScheduleFromConfig(session?.scoring_config),
    [session?.scoring_config],
  )

  const americanoGames = useMemo(() => {
    if (!isAmericano || !layoutValid) return []
    let plannedGames: GameRound[]
    if (isDuo && teams.length >= 2) {
      const duoSchedule = buildDuoStoredSchedule(
        teams.map((t) => ({ label: t.label, rosterIds: t.roster_ids })),
        totalGames || DUO_GAME_COUNT,
        scheduleSeed,
      )
      plannedGames = gamesFromStoredSchedule(paddedRoster, duoSchedule, courtNames, rosterNameById, roster)
    } else {
      // Same technique as invite / friendly preview: build from current roster indices + rosterDisplayName.
      plannedGames = planRankedSchedule(
        rankedRoster,
        courtNames,
        totalGames,
        scheduleSeed,
        slotCount,
        rosterNameById,
      )
    }
    const liveGames = hasLiveRounds
      ? gamesFromDbRounds(rounds, clubCourts, rosterById, rosterNameById)
      : []
    const games = mergeLiveGamesIntoPlannedGames(plannedGames, liveGames)
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
    rosterById,
    rosterNameById,
    roster,
  ])

  const columns: CourtColumn[] = useMemo(() => {
    if (!isAmericano || americanoGames.length === 0) return []
    return pivotScheduleByCourt(
      americanoGames,
      competitionPlayStartIso(session),
      gameMinutes || RANKED_GAME_MINUTES,
      scheduledBreakMinutes,
      session?.ends_at ?? undefined,
      gameSlotOptsFromSchedule({ eventMinutes, totalGames }),
    )
  }, [americanoGames, eventMinutes, gameMinutes, isAmericano, scheduledBreakMinutes, session?.ends_at, session?.starts_at, totalGames])

  const liveCourtsByGame = useMemo(() => {
    const sortOrderByCourtId = new Map(clubCourts.map((c) => [c.id, c.sort_order]))
    const map = new Map<number, LiveCourt[]>()
    for (const round of rounds) {
      const groups = sortLiveCourtsByClubOrder(
        groupLiveCourts(round.competition_round_players ?? [], rosterById, rosterNameById),
        sortOrderByCourtId,
      )
      if (groups.length === 0) continue
      map.set(round.round_number, groups)
    }
    return map
  }, [rounds, clubCourts, rosterById, rosterNameById])

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
