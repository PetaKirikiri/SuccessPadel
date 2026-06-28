import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { type LiveCourtGamesScore, type LiveCourtPointFeed } from '../lib/liveCourtScore'
import { useTranslation } from '../hooks/useTranslation'
import type { TranslateFn } from '../i18n'
import type { AmericanoScoringUnit } from '../lib/competitionPresets'
import { formatGameTimeLabel, pivotScheduleByGame, type CourtColumn } from '../lib/competitionCourtBoard'
import { isScoringTimeUnlocked } from '../lib/competitionScoringUnlock'
import { playTwoMinuteAlarm, TWO_MINUTES_MS } from '../lib/gameCountdownAlarm'
import { RANKED_GAME_MINUTES } from '../lib/rankedSchedule'
import {
  competitionFocusGameNumber,
  isGameSlotInBreakAfter,
  isGameSlotLive,
} from '../lib/competitionLayout'
import type { CourtScoreSubmit } from '../lib/competitionScoreInput'
import { courtGameScoreMax } from '../lib/competitionScoreInput'
import type { FriendlyCourtScoreSubmit } from '../lib/friendlyManualScore'
import type { MatchTeam } from '../lib/types'
import { TvGameCarousel, type TvGameNav } from './play/TvGameCarousel'
import type { LiveCourt } from './gameCard/gameBoardTypes'
import type { CourtPlayer } from '../lib/americanoSchedule'
import { GameCard, courtIdForLabel, type GameCardPanel, type GameCardSession, type ScoringGame } from './gameCard'

export type { FriendlyCourtScoreSubmit }

type Props = {
  competitionId?: string
  friendlySessionId?: string
  friendly?: boolean
  columns: CourtColumn[]
  mode: 'preview' | 'scoring'
  activeGameNumber?: number
  scoreUnit?: AmericanoScoringUnit
  playTo?: number
  roundId?: string
  liveCourtsByGame?: Map<number, LiveCourt[]>
  canLog?: boolean
  roundIdForGame?: (gameNumber: number) => string | undefined
  courtIdByLabel?: Map<string, string>
  matchForCourt?: (
    roundId: string,
    courtId: string,
  ) => {
    score_summary?: string
    teamAPoints?: number
    teamBPoints?: number
    winner?: MatchTeam
    playedAt?: string
  } | undefined
  onSubmitScores?: (entries: CourtScoreSubmit[]) => Promise<void>
  onSubmitFriendlyScores?: (entries: FriendlyCourtScoreSubmit[]) => Promise<void>
  onSaved?: () => void | Promise<void>
  now?: number
  gameMinutes?: number
  roundTimesByGame?: Map<number, { startsAt: number; endsAt: number }>
  roundStatusByGame?: Map<number, 'pending' | 'active' | 'complete'>
  currentUserId?: string | null
  currentUserDisplayName?: string | null
  currentUserAvatarUrl?: string | null
  isAdmin?: boolean
  liveCourtScores?: Map<string, LiveCourtGamesScore>
  liveCourtFeeds?: Map<string, LiveCourtPointFeed>
  duoTeamLabels?: (
    teamA: [string, string],
    teamB: [string, string],
    teamAPlayers?: CourtPlayer[],
    teamBPlayers?: CourtPlayer[],
  ) => { teamALabel?: string; teamBLabel?: string }
  tvCarousel?: boolean
  viewAlongUrl?: string | null
  scoreSubmitEnabled?: boolean
  onTvGameChange?: (gameNumber: number) => void
  onTvBack?: () => void
  leaderboardBody?: ReactNode
  activePanel?: GameCardPanel
  onActivePanel?: (panel: GameCardPanel) => void
}

type RoundStatus = 'pending' | 'active' | 'complete'
type CountdownState = 'starts' | 'playing' | 'break' | 'finished' | 'scheduled'

function isGameTimeUp(
  gameNumber: number,
  clock: number,
  roundTimesByGame?: Map<number, { startsAt: number; endsAt: number }>,
  roundStatusByGame?: Map<number, RoundStatus>,
): boolean {
  if (roundStatusByGame?.get(gameNumber) === 'complete') return true
  const times = roundTimesByGame?.get(gameNumber)
  return Boolean(times && clock >= times.endsAt)
}

function isGameSubmitted(
  game: ScoringGame,
  gameRoundId: string | undefined,
  courtsForGame: LiveCourt[],
  courtIdByLabel: Map<string, string> | undefined,
  matchForCourt: NonNullable<Props['matchForCourt']>,
): boolean {
  if (!gameRoundId) return false
  const courtIds: string[] = []
  if (courtsForGame.length > 0) {
    courtIds.push(...courtsForGame.map((c) => c.courtId))
  } else {
    game.courts.forEach((court, courtIndex) => {
      const id = courtIdForLabel(court.courtLabel, courtIndex, courtsForGame, courtIdByLabel)
      if (id) courtIds.push(id)
    })
  }
  if (courtIds.length === 0) return false
  return courtIds.every((courtId) => {
    const saved = matchForCourt(gameRoundId, courtId)
    return saved?.teamAPoints != null && saved?.teamBPoints != null
  })
}

function gameIsFinished(
  game: ScoringGame,
  {
    previewTimed,
    activeGameNumber,
    roundId,
    roundIdForGame,
    liveCourtsByGame,
    courtIdByLabel,
    matchForCourt,
    clock,
    roundTimesByGame,
    roundStatusByGame,
  }: {
    mode: Props['mode']
    previewTimed: boolean
    activeGameNumber?: number
    roundId?: string
    roundIdForGame?: Props['roundIdForGame']
    liveCourtsByGame?: Map<number, LiveCourt[]>
    courtIdByLabel?: Map<string, string>
    matchForCourt?: Props['matchForCourt']
    clock: number
    roundTimesByGame?: Map<number, { startsAt: number; endsAt: number }>
    roundStatusByGame?: Map<number, RoundStatus>
  },
): boolean {
  const isActive = activeGameNumber === game.gameNumber
  const roundStatus = roundStatusByGame?.get(game.gameNumber)
  const courtsForGame = liveCourtsByGame?.get(game.gameNumber) ?? []
  const gameRoundId =
    roundIdForGame?.(game.gameNumber) ?? (isActive ? roundId : undefined)
  const timeUp = isGameTimeUp(
    game.gameNumber,
    clock,
    roundTimesByGame,
    roundStatusByGame,
  )
  if (matchForCourt != null) {
    return isGameSubmitted(game, gameRoundId, courtsForGame, courtIdByLabel, matchForCourt)
  }
  if (previewTimed) return timeUp
  return timeUp && roundStatus === 'complete'
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return '0:00'
  const m = Math.floor(ms / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  return `${m}:${String(s).padStart(2, '0')}`
}

function isGameLive(
  now: number,
  times: { startsAt: number; endsAt: number } | undefined,
): boolean {
  return isGameSlotLive(now, times)
}

function gameCountdown(
  now: number,
  times: { startsAt: number; endsAt: number } | undefined,
  gameMinutes: number,
  gameNumber: number,
  timesByGame?: Map<number, { startsAt: number; endsAt: number }>,
): string {
  const fullMs = gameMinutes * 60000
  if (!times) return formatCountdown(fullMs)
  if (now >= times.endsAt) {
    if (timesByGame && isGameSlotInBreakAfter(now, gameNumber, timesByGame)) {
      const next = timesByGame.get(gameNumber + 1)
      if (next) return formatCountdown(next.startsAt - now)
    }
    return '0:00'
  }
  if (now < times.startsAt) return formatCountdown(times.startsAt - now)
  return formatCountdown(times.endsAt - now)
}

function countdownState(
  now: number,
  times: { startsAt: number; endsAt: number } | undefined,
  submitted: boolean,
  gameNumber: number,
  timesByGame?: Map<number, { startsAt: number; endsAt: number }>,
): CountdownState {
  if (!times) return 'scheduled'
  if (isGameSlotLive(now, times)) return 'playing'
  if (now < times.startsAt) return 'starts'
  if (timesByGame && isGameSlotInBreakAfter(now, gameNumber, timesByGame)) return 'break'
  if (submitted || now >= times.endsAt) return 'finished'
  return 'scheduled'
}

function countdownLabel(state: CountdownState, t: TranslateFn): string {
  if (state === 'starts') return 'Game starts in'
  if (state === 'playing') return 'Game finishes in'
  if (state === 'break') return 'Break time'
  if (state === 'finished') return t('competition.finished')
  return t('competition.gameTime')
}

export function GameBoard({
  competitionId,
  friendlySessionId,
  friendly = false,
  columns,
  mode,
  activeGameNumber,
  scoreUnit = 'sets',
  playTo,
  roundId,
  liveCourtsByGame,
  canLog,
  roundIdForGame,
  courtIdByLabel,
  matchForCourt,
  onSubmitScores,
  onSubmitFriendlyScores,
  onSaved,
  now,
  gameMinutes = RANKED_GAME_MINUTES,
  roundTimesByGame,
  roundStatusByGame,
  currentUserId,
  currentUserDisplayName,
  currentUserAvatarUrl,
  isAdmin = false,
  liveCourtScores,
  liveCourtFeeds,
  duoTeamLabels,
  tvCarousel = false,
  viewAlongUrl = null,
  scoreSubmitEnabled = true,
  onTvGameChange,
  onTvBack,
  leaderboardBody,
  activePanel = 'game',
  onActivePanel,
}: Props) {
  const { t } = useTranslation()
  const useCarousel = tvCarousel
  const games = useMemo(() => {
    const rows = pivotScheduleByGame(columns)
    if (!roundTimesByGame?.size) return rows
    return rows.map((game) => {
      const times = roundTimesByGame.get(game.gameNumber)
      if (!times) return game
      const timeLabel = formatGameTimeLabel(times.startsAt, times.endsAt)
      return {
        ...game,
        timeLabel,
        courts: game.courts.map((court) => ({ ...court, timeLabel })),
      }
    })
  }, [columns, roundTimesByGame])
  const [tick, setTick] = useState(() => Date.now())
  const [collapsedGames, setCollapsedGames] = useState<Record<number, boolean>>({})
  const collapseSeedKeyRef = useRef<string | null>(null)
  const sessionId = friendlySessionId ?? competitionId
  const liveCourtEnabled = Boolean(
    sessionId && isAdmin && currentUserId && !(friendly && onSubmitFriendlyScores),
  )
  const gestureScoreEnabled = Boolean(sessionId && currentUserId && (friendly || mode === 'scoring'))
  const manualScoreEnabled = Boolean(friendly && onSubmitFriendlyScores && sessionId && currentUserId)
  const friendlyManualScoring = Boolean(friendly && sessionId && mode === 'preview')
  const scoringTimeUnlocked = isScoringTimeUnlocked()
  const courtScoreMax = courtGameScoreMax(scoreUnit === 'games' ? playTo : undefined)
  const courtPlayTo = scoreUnit === 'games' ? playTo : undefined

  const previewTimed = mode === 'preview' && Boolean(roundTimesByGame?.size)

  useEffect(() => {
    if (mode !== 'scoring' && !previewTimed) return
    const timer = setInterval(() => setTick(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [mode, previewTimed])

  const clock = mode === 'scoring' || previewTimed ? tick : (now ?? tick)
  const prevRemainingMsRef = useRef(new Map<number, number>())
  const alarmedGamesRef = useRef(new Set<number>())

  useEffect(() => {
    if (mode !== 'scoring' || !roundTimesByGame) return
    for (const game of games) {
      const times = roundTimesByGame.get(game.gameNumber)
      if (!times || !isGameLive(clock, times)) continue
      if (isGameTimeUp(game.gameNumber, clock, roundTimesByGame, roundStatusByGame)) continue

      const remaining = times.endsAt - clock
      const prev = prevRemainingMsRef.current.get(game.gameNumber)
      prevRemainingMsRef.current.set(game.gameNumber, remaining)

      const crossedTwoMin =
        prev !== undefined && prev > TWO_MINUTES_MS && remaining <= TWO_MINUTES_MS
      if (!crossedTwoMin || alarmedGamesRef.current.has(game.gameNumber)) continue

      alarmedGamesRef.current.add(game.gameNumber)
      playTwoMinuteAlarm()
    }
  }, [clock, games, mode, roundStatusByGame, roundTimesByGame])

  const orderedGames = useMemo(() => {
    if (!roundTimesByGame?.size) return games
    return [...games].sort((a, b) => {
      const aStart = roundTimesByGame.get(a.gameNumber)?.startsAt ?? a.gameNumber
      const bStart = roundTimesByGame.get(b.gameNumber)?.startsAt ?? b.gameNumber
      return aStart - bStart
    })
  }, [games, roundTimesByGame])

  const finishedByGame = useMemo(() => {
    const finishOpts = {
      mode,
      previewTimed,
      activeGameNumber,
      roundId,
      roundIdForGame,
      liveCourtsByGame,
      courtIdByLabel,
      matchForCourt,
      clock,
      roundTimesByGame,
      roundStatusByGame,
    }
    const map = new Map<number, boolean>()
    for (const game of orderedGames) {
      map.set(game.gameNumber, gameIsFinished(game, finishOpts))
    }
    return map
  }, [
    orderedGames,
    mode,
    previewTimed,
    activeGameNumber,
    roundId,
    roundIdForGame,
    liveCourtsByGame,
    courtIdByLabel,
    matchForCourt,
    clock,
    roundTimesByGame,
    roundStatusByGame,
  ])

  useLayoutEffect(() => {
    if (scoringTimeUnlocked || !sessionId || orderedGames.length === 0) return
    if (collapseSeedKeyRef.current === sessionId) return
    collapseSeedKeyRef.current = sessionId

    setCollapsedGames((prev) => {
      const next: Record<number, boolean> = { ...prev }
      for (const game of orderedGames) {
        if (finishedByGame.get(game.gameNumber)) next[game.gameNumber] = true
      }
      return next
    })
  }, [sessionId, orderedGames, finishedByGame, scoringTimeUnlocked])

  const gameNumbers = useMemo(
    () => orderedGames.map((game) => game.gameNumber),
    [orderedGames],
  )

  const focusGameNumber = useMemo(
    () => {
      if (useCarousel && matchForCourt) {
        return gameNumbers.find((gameNumber) => !finishedByGame.get(gameNumber)) ?? gameNumbers[gameNumbers.length - 1]
      }
      const focused = roundTimesByGame?.size
        ? competitionFocusGameNumber(clock, roundTimesByGame, gameNumbers, activeGameNumber)
        : activeGameNumber
      return focused
    },
    [activeGameNumber, clock, finishedByGame, gameNumbers, matchForCourt, roundTimesByGame, useCarousel],
  )

  const toggleCollapsed = (gameNumber: number) => {
    setCollapsedGames((prev) => ({
      ...prev,
      [gameNumber]: !(prev[gameNumber] ?? false),
    }))
  }

  const renderGameCard = (game: ScoringGame, tvNav?: TvGameNav) => {
    const isActive = activeGameNumber === game.gameNumber
    const times = roundTimesByGame?.get(game.gameNumber)
    const roundStatus = roundStatusByGame?.get(game.gameNumber)
    const courtsForGame = liveCourtsByGame?.get(game.gameNumber) ?? []
    const gameRoundId = roundIdForGame?.(game.gameNumber) ?? (isActive ? roundId : undefined)
    const timedMode = mode === 'scoring' || previewTimed
    const isLiveNow = timedMode && isGameLive(clock, times)
    const timeUp = isGameTimeUp(game.gameNumber, clock, roundTimesByGame, roundStatusByGame)
    const submitted = finishedByGame.get(game.gameNumber) ?? false
    const finished = submitted
    const inBreakAfter = Boolean(
      times && roundTimesByGame && isGameSlotInBreakAfter(clock, game.gameNumber, roundTimesByGame),
    )
    const awaitingStart = Boolean(times && clock < times.startsAt)
    const showTimer =
      timedMode && times && (!submitted || isLiveNow || inBreakAfter || awaitingStart)
    const countdown = showTimer
      ? gameCountdown(clock, times, gameMinutes, game.gameNumber, roundTimesByGame)
      : null
    const state = countdownState(clock, times, submitted, game.gameNumber, roundTimesByGame)
    const collapsed = useCarousel ? false : (collapsedGames[game.gameNumber] ?? false)
    const isCurrentGame =
      isLiveNow ||
      inBreakAfter ||
      (awaitingStart && focusGameNumber === game.gameNumber)
    const canEditGame =
      Boolean(canLog) &&
      (scoringTimeUnlocked ||
        useCarousel ||
        submitted ||
        roundStatus === 'complete' ||
        isLiveNow ||
        timeUp)
    const canEditCourtCardScores = useCarousel ? Boolean(canLog && gameRoundId) : canEditGame
    const displayTimeLabel =
      times != null ? formatGameTimeLabel(times.startsAt, times.endsAt) : game.timeLabel

    let session: GameCardSession
    if (friendlyManualScoring && sessionId) {
      session = {
        kind: 'friendly',
        sessionId,
        onSubmitScores: onSubmitFriendlyScores,
        scoreSubmitEnabled,
        scoringEnabled: true,
      }
    } else if ((mode === 'scoring' || useCarousel) && matchForCourt && onSubmitScores) {
      session = {
        kind: 'competition',
        competitionId,
        sessionId,
        gameRoundId,
        courtsForGame,
        courtIdByLabel,
        matchForCourt,
        onSubmitScores,
        scoringEnabled: true,
      }
    } else {
      session = {
        kind: 'preview',
        sessionId,
        competitionId,
        gameRoundId,
        courtsForGame,
        courtIdByLabel,
        matchForCourt,
        scoringEnabled: false,
      }
    }

    return (
      <GameCard
        key={game.gameNumber}
        game={game}
        session={session}
        displayTimeLabel={displayTimeLabel}
        scoreUnit={scoreUnit}
        finished={finished}
        isLiveNow={isLiveNow}
        isCurrentGame={isCurrentGame}
        countdown={countdown}
        countdownLabelText={countdownLabel(state, t)}
        collapsed={collapsed}
        onToggleCollapsed={() => toggleCollapsed(game.gameNumber)}
        currentUserId={currentUserId}
        currentUserDisplayName={currentUserDisplayName}
        currentUserAvatarUrl={currentUserAvatarUrl}
        liveCourtEnabled={liveCourtEnabled}
        gestureScoreEnabled={gestureScoreEnabled}
        manualScoreEnabled={manualScoreEnabled}
        friendly={friendly}
        duoTeamLabels={duoTeamLabels}
        courtScoreMax={courtScoreMax}
        courtPlayTo={courtPlayTo}
        liveCourtScores={liveCourtScores}
        liveCourtFeeds={liveCourtFeeds}
        onSaved={onSaved}
        canEdit={canEditCourtCardScores}
        tvNav={tvNav}
        onBack={onTvBack}
        viewAlongUrl={viewAlongUrl}
        leaderboardBody={
          leaderboardBody && (focusGameNumber ?? gameNumbers[0]) === game.gameNumber
            ? leaderboardBody
            : undefined
        }
        activePanel={activePanel}
        onActivePanel={onActivePanel}
        t={t}
      />
    )
  }

  if (useCarousel) {
    const gameByNumber = new Map(orderedGames.map((game) => [game.gameNumber, game]))
    return (
      <TvGameCarousel
        gameNumbers={gameNumbers}
        activeGameNumber={focusGameNumber}
        renderGame={(gameNumber, nav) => {
          const game = gameByNumber.get(gameNumber)
          return game ? renderGameCard(game, nav) : null
        }}
        onGameChange={onTvGameChange}
        t={t}
      />
    )
  }

  return <div className="space-y-6">{orderedGames.map((game) => renderGameCard(game))}</div>
}
