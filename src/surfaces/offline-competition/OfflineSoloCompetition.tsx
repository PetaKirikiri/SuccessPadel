import { useCallback, useEffect, useMemo, useState } from 'react'
import { GameBoard } from '../../components/GameCard/GameBoard'
import type { LiveCourt } from '../../components/GameCard/gameBoardTypes'
import { Leaderboard } from '../../components/leaderboard'
import { useGameCardSize } from '../../hooks/useGameCardSize'
import { useTranslation } from '../../hooks/useTranslation'
import type { CourtScoreSubmit } from '../../lib/competitionScoreInput'
import { pivotScheduleByCourt } from '../../lib/competitionCourtBoard'
import type { GameRound } from '../../lib/americanoSchedule'
import { duoRoundRobinRounds } from '../../lib/duoRoundRobinSchedule'
import type { CompetitionPlayer } from '../../hooks/useCompetitions'
import type { LeaderboardEntry } from '../../lib/leaderboardTypes'
import { PlayTvView } from '../../foundation/play/PlayTvView'
import { liveCourtScoreKey, type LiveCourtGamesScore } from '../../lib/liveCourtScore'

const TEAMS = [
  ['Poom 👑', 'Aew 👑'],
  ['Stephen', 'Lauren'],
  ['Dave', 'Josh'],
  ['Tak', 'Andi'],
  ['Peter P', 'Delpino'],
  ['Will', 'Curtis'],
  ['Matt', 'Vinny'],
  ['David', 'Arzina'],
] as const
const NAMES = TEAMS.flat()

const STARTS_AT = '2026-08-14T18:05:00+07:00'
const ENDS_AT = '2026-08-14T20:00:00+07:00'
const GAME_MINUTES = 13
const BREAK_MINUTES = 4
const GAME_COUNT = 7
const STORAGE_KEY = 'success-padel:offline-tonight:2026-08-14:duos-v1'
const COURT_MATCH_ORDER = [
  [0, 1, 2, 3],
  [2, 3, 0, 1],
  [1, 0, 2, 3],
  [1, 3, 0, 2],
  [2, 1, 3, 0],
  [0, 2, 1, 3],
  [1, 2, 3, 0],
] as const

type SavedScore = { teamAPoints: number; teamBPoints: number; score_summary: string }

function persistScores(scores: Record<string, SavedScore>): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(scores))
}

export function OfflineSoloCompetition() {
  const size = useGameCardSize()
  const { t } = useTranslation()
  const roster = useMemo<CompetitionPlayer[]>(
    () => NAMES.map((name, index) => ({
      id: `offline-player-${String(index + 1).padStart(2, '0')}`,
      profile_id: null,
      padel_player_id: null,
      guest_name: name,
      guest_email: null,
      rank_order: index,
      profiles: null,
    })),
    [],
  )
  const courts = useMemo(() => ['Court 1', 'Court 2', 'Court 3', 'Court 4'], [])
  const games = useMemo<GameRound[]>(() =>
    duoRoundRobinRounds(TEAMS.length).slice(0, GAME_COUNT).map((round, roundIndex) => ({
      gameNumber: roundIndex + 1,
      matches: COURT_MATCH_ORDER[roundIndex].map((matchIndex, courtIndex) => {
        const [teamA, teamB] = round[matchIndex]
        return {
        courtLabel: courts[courtIndex] ?? `Court ${courtIndex + 1}`,
        teamA: [TEAMS[teamA]![0], TEAMS[teamA]![1]],
        teamB: [TEAMS[teamB]![0], TEAMS[teamB]![1]],
        }
      }),
    })), [courts])
  const columns = useMemo(
    () => pivotScheduleByCourt(games, STARTS_AT, GAME_MINUTES, BREAK_MINUTES, ENDS_AT),
    [games],
  )
  const roundTimesByGame = useMemo(() => {
    const start = new Date(STARTS_AT).getTime()
    return new Map(Array.from({ length: GAME_COUNT }, (_, index) => {
      const startsAt = start + index * (GAME_MINUTES + BREAK_MINUTES) * 60_000
      return [index + 1, { startsAt, endsAt: startsAt + GAME_MINUTES * 60_000 }] as const
    }))
  }, [])
  const liveCourtsByGame = useMemo(() => new Map(
    games.map((game) => [game.gameNumber, game.matches.map((match, index): LiveCourt => ({
      courtId: `court-${index + 1}`,
      courtName: match.courtLabel,
      teamA: match.teamA,
      teamB: match.teamB,
      playerIds: [],
    }))]),
  ), [games])
  const courtIdByLabel = useMemo(() => new Map(courts.map((name, index) => [name, `court-${index + 1}`])), [courts])
  const [savedScores, setSavedScores] = useState<Record<string, SavedScore>>(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      return raw ? JSON.parse(raw) as Record<string, SavedScore> : {}
    } catch {
      return {}
    }
  })
  const [refreshKey, setRefreshKey] = useState(0)
  const [activePanel, setActivePanel] = useState<'game' | 'leaderboard'>('game')

  useEffect(() => {
    persistScores(savedScores)
  }, [savedScores])

  const standings = useMemo<LeaderboardEntry[]>(() => {
    const rows = TEAMS.map((team, index) => ({
      profile_id: `duo:offline-team-${index + 1}`,
      player_a_name: team[0],
      player_b_name: team[1],
      display_name: `${team[0]} / ${team[1]}`,
      avatar_url: null,
      total_points: 0,
      games: 0,
      wins: 0,
      losses: 0,
      draws: 0,
    }))
    games.forEach((game) => game.matches.forEach((match, courtIndex) => {
      const score = savedScores[`round-${game.gameNumber}:court-${courtIndex + 1}`]
      if (!score) return
      const namesA = new Set(match.teamA)
      const namesB = new Set(match.teamB)
      for (const row of rows) {
        const onA = namesA.has(row.player_a_name) && namesA.has(row.player_b_name)
        const onB = namesB.has(row.player_a_name) && namesB.has(row.player_b_name)
        if (!onA && !onB) continue
        const own = onA ? score.teamAPoints : score.teamBPoints
        const other = onA ? score.teamBPoints : score.teamAPoints
        row.total_points += own
        row.games += 1
        row.wins += own > other ? 1 : 0
        row.losses += own < other ? 1 : 0
        row.draws += own === other ? 1 : 0
      }
    }))
    return rows.sort(
      (a, b) =>
        b.total_points - a.total_points ||
        TEAMS.findIndex((team) => team[0] === a.player_a_name) -
          TEAMS.findIndex((team) => team[0] === b.player_a_name),
    )
  }, [games, savedScores])
  const liveCourtScores = useMemo(() => {
    const map = new Map<string, LiveCourtGamesScore>()
    games.forEach((game) => game.matches.forEach((match, courtIndex) => {
      const saved = savedScores[`round-${game.gameNumber}:court-${courtIndex + 1}`]
      map.set(liveCourtScoreKey(game.gameNumber, match.courtLabel), {
        scoreA: String(saved?.teamAPoints ?? 0),
        scoreB: String(saved?.teamBPoints ?? 0),
      })
    }))
    return map
  }, [games, savedScores])

  const roundIdForGame = useCallback((gameNumber: number) => `round-${gameNumber}`, [])
  const matchForCourt = useCallback((roundId: string, courtId: string) => {
    void refreshKey
    return savedScores[`${roundId}:${courtId}`]
  }, [refreshKey, savedScores])
  const saveScores = useCallback(async (entries: CourtScoreSubmit[]) => {
    setSavedScores((current) => {
      const next = { ...current }
      for (const entry of entries) {
        next[`${entry.roundId}:${entry.courtId}`] = {
          teamAPoints: entry.teamA,
          teamBPoints: entry.teamB,
          score_summary: `${entry.teamA}-${entry.teamB}`,
        }
      }
      persistScores(next)
      return next
    })
    setRefreshKey((value) => value + 1)
  }, [])
  const saveCourtImmediately = useCallback(async (
    gameNumber: number,
    courtId: string,
    teamA: number,
    teamB: number,
  ) => {
    const key = `round-${gameNumber}:${courtId}`
    const nextScore = { teamAPoints: teamA, teamBPoints: teamB, score_summary: `${teamA}-${teamB}` }
    setSavedScores((current) => {
      const next = { ...current, [key]: nextScore }
      persistScores(next)
      return next
    })
    setRefreshKey((value) => value + 1)
  }, [])

  const leaderboard = (
    <Leaderboard
      entries={standings}
      scoreUnit="games"
      embedded
      compact={size === 'tv'}
      simpleTeamRows
    />
  )

  const board = (
      <GameBoard
        key={refreshKey}
        columns={columns}
        mode="scoring"
        scoreUnit="games"
        playTo={6}
        liveCourtsByGame={liveCourtsByGame}
        roundIdForGame={roundIdForGame}
        courtIdByLabel={courtIdByLabel}
        matchForCourt={matchForCourt}
        onSubmitScores={saveScores}
        canLog
        gameMinutes={GAME_MINUTES}
        roundTimesByGame={roundTimesByGame}
        roster={roster}
        duoTeamLabels={(teamA, teamB) => ({ teamALabel: teamA.join(' / '), teamBLabel: teamB.join(' / ') })}
        liveCourtScores={liveCourtScores}
        onCompetitionCourtGamesSaved={saveCourtImmediately}
        tvCarousel
        autoFollowActiveGame
        onTvBack={() => { window.location.href = '/friendly' }}
        leaderboardBody={size === 'tv' ? undefined : leaderboard}
        activePanel={activePanel}
        onActivePanel={setActivePanel}
      />
  )

  return (
    <div className="play-session-root game-bg flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      {size === 'tv' ? (
        <PlayTvView
          t={t}
          loadOrError={null}
          session={{ offline: true }}
          gamesBody={board}
          leaderboardBody={leaderboard}
          leaderboardLabel={t('leaderboard.standings')}
        />
      ) : board}
    </div>
  )
}
