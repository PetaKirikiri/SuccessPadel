import { useCallback, useEffect, useMemo, useState } from 'react'
import { GameBoard } from '../../components/GameCard/GameBoard'
import type { LiveCourt } from '../../components/GameCard/gameBoardTypes'
import { Leaderboard } from '../../components/leaderboard'
import { useGameCardSize } from '../../hooks/useGameCardSize'
import { useTranslation } from '../../hooks/useTranslation'
import type { CourtScoreSubmit } from '../../lib/competitionScoreInput'
import { pivotScheduleByCourt } from '../../lib/competitionCourtBoard'
import { buildDuoStoredSchedule } from '../../lib/duoRoundRobinSchedule'
import { gamesFromStoredSchedule, type StoredScheduleRound } from '../../lib/rankedSchedule'
import type { CompetitionPlayer } from '../../hooks/useCompetitions'
import type { LeaderboardEntry } from '../../lib/leaderboardTypes'
import { PlayTvView } from '../../foundation/play/PlayTvView'
import { liveCourtScoreKey, type LiveCourtGamesScore } from '../../lib/liveCourtScore'
import type { CourtPlayer } from '../../lib/americanoSchedule'
import { TEAM_SPIRIT_ANIMAL_ASSETS } from '../../lib/spiritAnimals'

const TEAMS = [
  ['Stephen', 'Lauren'],
  ['David', 'Arzina'],
  ["P’nee", 'Paipai'],
  ['Dave', 'Mike'],
  ['Peter P', 'Fabrice'],
  ['Phil', 'Jacky'],
  ['Rutger', 'Marilyn'],
  ['Fed G', 'Tak'],
] as const
const NAMES = TEAMS.flat()
const TEAM_ANIMAL_ASSETS = TEAM_SPIRIT_ANIMAL_ASSETS

type OfflinePlayerAccount = {
  displayName: string
  padelPlayerId: string
  profileId: string
  avatarUrl: string
}

const PLAYER_ACCOUNTS: Partial<Record<string, OfflinePlayerAccount>> = {
  "P’nee": {
    displayName: 'Nee',
    padelPlayerId: 'ad8da675-eb9b-4d7f-9109-567d4d543dbc',
    profileId: '65db0df6-7bf6-440f-a75a-038f47de10cc',
    avatarUrl: '/offline-player-avatars/nee.jpg',
  },
  Dave: {
    displayName: 'Dave',
    padelPlayerId: 'e438ee2b-d4fa-47c4-9d12-2784e3501b3c',
    profileId: 'e3437d4a-47c1-4787-b7a1-ab67840d0685',
    avatarUrl: '/offline-player-avatars/dave.jpg',
  },
  Mike: {
    displayName: 'Mike',
    padelPlayerId: 'b6a75df2-a0e9-4627-8843-8f8326a747a1',
    profileId: '2692177e-2478-4e45-8b44-cdc47e270d9d',
    avatarUrl: '/offline-player-avatars/mike.jpg',
  },
  'Peter P': {
    displayName: 'Peter P',
    padelPlayerId: '5a0f951b-cd62-4100-9778-9a86b0d57901',
    profileId: 'f1410e7c-30c2-4f95-ac84-36737c587134',
    avatarUrl: '/offline-player-avatars/peter-p.jpg',
  },
  Tak: {
    displayName: 'Tak Kanyanee',
    padelPlayerId: '1f73c068-a3f8-4098-8f31-853e7cdfb846',
    profileId: 'cd1967a7-3da0-499b-8907-a1300fa9a022',
    avatarUrl: '/offline-player-avatars/tak-kanyanee.jpg',
  },
}

function accountDisplayName(localName: string): string {
  return PLAYER_ACCOUNTS[localName]?.displayName ?? localName
}

const STARTS_AT = '2026-08-21T18:05:00+07:00'
const ENDS_AT = '2026-08-21T20:00:00+07:00'
const GAME_MINUTES = 13
const BREAK_MINUTES = 4
const GAME_COUNT = 7
const STORAGE_KEY = 'success-padel:offline-tonight:2026-08-21:fixed-duos-v1'
const ARRIVALS_STORAGE_KEY = `${STORAGE_KEY}:arrivals`

type SavedScore = { teamAPoints: number; teamBPoints: number; score_summary: string }

function persistScores(scores: Record<string, SavedScore>): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(scores))
}

function permutations(values: number[]): number[][] {
  if (values.length <= 1) return [values]
  return values.flatMap((value, index) =>
    permutations(values.filter((_, candidateIndex) => candidateIndex !== index))
      .map((rest) => [value, ...rest]),
  )
}

function spreadDuoRoundsAcrossCourts(rounds: StoredScheduleRound[]): StoredScheduleRound[] {
  const courtUses = Array.from({ length: TEAMS.length }, () => Array(4).fill(0) as number[])
  const teamIndexForRosterId = (rosterId: string) => {
    const playerNumber = Number(rosterId.slice('offline-player-'.length))
    return Math.floor((playerNumber - 1) / 2)
  }

  return rounds.map((round) => {
    const choices = permutations(round.matches.map((_, index) => index))
    const cost = (order: number[]) => order.reduce((sum, matchIndex, courtIndex) => {
      const match = round.matches[matchIndex]!
      const teamA = teamIndexForRosterId(match.team_a[0])
      const teamB = teamIndexForRosterId(match.team_b[0])
      const nextA = courtUses[teamA]![courtIndex]! + 1
      const nextB = courtUses[teamB]![courtIndex]! + 1
      return sum + nextA * nextA + nextB * nextB
    }, 0)
    choices.sort((a, b) => cost(a) - cost(b) || a.join('').localeCompare(b.join('')))

    const matches = choices[0]!.map((matchIndex, courtIndex) => {
      const match = round.matches[matchIndex]!
      const teamA = teamIndexForRosterId(match.team_a[0])
      const teamB = teamIndexForRosterId(match.team_b[0])
      courtUses[teamA]![courtIndex]! += 1
      courtUses[teamB]![courtIndex]! += 1
      return { ...match, court: courtIndex + 1 }
    })
    return { ...round, matches }
  })
}

export function OfflineSoloCompetition() {
  const size = useGameCardSize()
  const isTvLayout = size === 'tv'
  const { t } = useTranslation()
  const roster = useMemo<CompetitionPlayer[]>(
    () => NAMES.map((name, index) => {
      const account = PLAYER_ACCOUNTS[name]
      const profile = account
        ? {
            id: account.profileId,
            display_name: account.displayName,
            avatar_url: account.avatarUrl,
          }
        : null
      return {
        id: `offline-player-${String(index + 1).padStart(2, '0')}`,
        profile_id: account?.profileId ?? null,
        padel_player_id: account?.padelPlayerId ?? null,
        guest_name: name,
        guest_email: null,
        rank_order: index,
        profiles: profile,
        padel_players: account
          ? {
              id: account.padelPlayerId,
              display_name: account.displayName,
              profile_id: account.profileId,
              line_picture_url: account.avatarUrl,
              profiles: profile,
            }
          : null,
      }
    }),
    [],
  )
  const courts = useMemo(() => ['Court 1', 'Court 2', 'Court 3', 'Court 4'], [])
  const games = useMemo(
    () => {
      const teams = TEAMS.map((players, teamIndex) => ({
        label: players.join(' / '),
        rosterIds: [
          `offline-player-${String(teamIndex * 2 + 1).padStart(2, '0')}`,
          `offline-player-${String(teamIndex * 2 + 2).padStart(2, '0')}`,
        ] as [string, string],
      }))
      const schedule = spreadDuoRoundsAcrossCourts(buildDuoStoredSchedule(teams, GAME_COUNT, 0))
      const scheduledGames = gamesFromStoredSchedule(
        roster,
        schedule,
        courts,
      )
      const withTeamAnimal = (player: NonNullable<(typeof scheduledGames)[number]['matches'][number]['teamAPlayers']>[number]) => {
        const playerNumber = Number(player.rosterId?.slice('offline-player-'.length))
        const teamIndex = Math.floor((playerNumber - 1) / 2)
        return { ...player, teamEmblemUrl: TEAM_ANIMAL_ASSETS[teamIndex] ?? null }
      }
      const withTeamAnimals = (players: [CourtPlayer, CourtPlayer] | undefined) =>
        players
          ? [withTeamAnimal(players[0]), withTeamAnimal(players[1])] as [CourtPlayer, CourtPlayer]
          : undefined
      return scheduledGames.map((game) => ({
        ...game,
        matches: game.matches.map((match) => ({
          ...match,
          teamAPlayers: withTeamAnimals(match.teamAPlayers),
          teamBPlayers: withTeamAnimals(match.teamBPlayers),
        })),
      }))
    },
    [courts, roster],
  )
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
  const [activePanel, setActivePanel] = useState<'game' | 'leaderboard'>('game')
  const [arrivedPlayerIds, setArrivedPlayerIds] = useState<Set<string>>(() => {
    try {
      const raw = window.localStorage.getItem(ARRIVALS_STORAGE_KEY)
      return new Set(raw ? JSON.parse(raw) as string[] : [])
    } catch {
      return new Set()
    }
  })

  useEffect(() => {
    persistScores(savedScores)
  }, [savedScores])

  useEffect(() => {
    window.localStorage.setItem(ARRIVALS_STORAGE_KEY, JSON.stringify([...arrivedPlayerIds]))
  }, [arrivedPlayerIds])

  const togglePlayerArrival = useCallback((playerId: string) => {
    setArrivedPlayerIds((current) => {
      const next = new Set(current)
      if (next.has(playerId)) next.delete(playerId)
      else next.add(playerId)
      return next
    })
  }, [])

  const standings = useMemo<LeaderboardEntry[]>(() => {
    const rows = TEAMS.map(([localPlayerA, localPlayerB], index) => {
      const playerA = accountDisplayName(localPlayerA)
      const playerB = accountDisplayName(localPlayerB)
      return {
      profile_id: `duo:offline-team-${String(index + 1).padStart(2, '0')}`,
      player_a_id: `offline-player-${String(index * 2 + 1).padStart(2, '0')}`,
      player_b_id: `offline-player-${String(index * 2 + 2).padStart(2, '0')}`,
      player_a_name: playerA,
      player_b_name: playerB,
      player_a_avatar_url: PLAYER_ACCOUNTS[localPlayerA]?.avatarUrl ?? null,
      player_b_avatar_url: PLAYER_ACCOUNTS[localPlayerB]?.avatarUrl ?? null,
      display_name: `${playerA} / ${playerB}`,
      avatar_url: null,
      total_points: 0,
      games: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      team_index: index,
      }
    })
    games.forEach((game) => game.matches.forEach((match, courtIndex) => {
      const score = savedScores[`round-${game.gameNumber}:court-${courtIndex + 1}`]
      if (!score) return
      for (const row of rows) {
        const onA = match.teamA[0] === row.player_a_name && match.teamA[1] === row.player_b_name
        const onB = match.teamB[0] === row.player_a_name && match.teamB[1] === row.player_b_name
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
        b.wins - a.wins ||
        a.losses - b.losses ||
        a.team_index - b.team_index,
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
    return savedScores[`${roundId}:${courtId}`]
  }, [savedScores])
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
  }, [])

  const leaderboard = (
    <Leaderboard
      entries={standings}
      scoreUnit="games"
      embedded
      compact={isTvLayout}
      highlightedEntryIds={arrivedPlayerIds}
      onToggleEntryHighlight={togglePlayerArrival}
      simpleTeamRows
    />
  )

  const board = (
      <GameBoard
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
        liveCourtScores={liveCourtScores}
        onCompetitionCourtGamesSaved={saveCourtImmediately}
        tvCarousel
        onTvBack={() => { window.location.href = '/friendly' }}
        leaderboardBody={size === 'tv' ? undefined : leaderboard}
        activePanel={activePanel}
        onActivePanel={setActivePanel}
      />
  )

  return (
    <div className="offline-spirit-animal-mode play-session-root game-bg flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      {isTvLayout ? (
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
