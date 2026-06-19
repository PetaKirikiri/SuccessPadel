import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { liveCourtScoreKey, type LiveCourtGamesScore } from '../lib/liveCourtScore'
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
import { CompetitionTvGameCarousel, type TvGameNav } from './competitionPlay/CompetitionTvGameCarousel'
import { CourtCard, CourtMatchCell, courtLiveHref } from './cards/CourtCard'
import type { LiveCourt } from './cards/gameBoardTypes'
import type { CourtPlayer } from '../lib/americanoSchedule'
import {
  FriendlyManualGameCard,
  GameCardHeader,
  GameCardShell,
  ScoringGameCard,
  courtsGridProps,
  tvCourtsBodyClass,
  courtIdForLabel,
  type ScoringGame,
} from './cards/GameCard'

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
  currentUserAvatarUrl?: string | null
  isAdmin?: boolean
  liveCourtScores?: Map<string, LiveCourtGamesScore>
  duoTeamLabels?: (
    teamA: [string, string],
    teamB: [string, string],
    teamAPlayers?: CourtPlayer[],
    teamBPlayers?: CourtPlayer[],
  ) => { teamALabel?: string; teamBLabel?: string }
  tvCarousel?: boolean
  viewAlongUrl?: string | null
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
  finished: boolean,
  gameNumber: number,
  timesByGame?: Map<number, { startsAt: number; endsAt: number }>,
): CountdownState {
  if (finished) return 'finished'
  if (!times) return 'scheduled'
  if (now < times.startsAt) return 'starts'
  if (now < times.endsAt) return 'playing'
  if (timesByGame && isGameSlotInBreakAfter(now, gameNumber, timesByGame)) return 'break'
  return 'finished'
}

function countdownLabel(state: CountdownState, t: TranslateFn): string {
  if (state === 'starts') return t('competition.startsIn')
  if (state === 'playing') return t('competition.timeLeft')
  if (state === 'break') return t('competition.break')
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
  currentUserAvatarUrl,
  isAdmin = false,
  liveCourtScores,
  duoTeamLabels,
  tvCarousel = false,
  viewAlongUrl = null,
}: Props) {
  const { t } = useTranslation()
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
  const friendlyManualScoring = Boolean(friendly && onSubmitFriendlyScores)
  const scoringTimeUnlocked = isScoringTimeUnlocked()
  const courtScoreMax = courtGameScoreMax(scoreUnit === 'games' ? playTo : undefined)
  const courtPlayTo = scoreUnit === 'games' ? playTo : undefined

  const previewTimed = mode === 'preview' && Boolean(roundTimesByGame?.size)

  useEffect(() => {
    if (mode !== 'scoring' && !previewTimed) return
    const t = setInterval(() => setTick(Date.now()), 1000)
    return () => clearInterval(t)
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
    () =>
      roundTimesByGame?.size
        ? competitionFocusGameNumber(clock, roundTimesByGame, gameNumbers, activeGameNumber)
        : activeGameNumber,
    [activeGameNumber, clock, gameNumbers, roundTimesByGame],
  )

  const toggleCollapsed = (gameNumber: number) => {
    setCollapsedGames((prev) => ({
      ...prev,
      [gameNumber]: !(prev[gameNumber] ?? false),
    }))
  }

  const tvCompact = tvCarousel

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
    const countdown =
      timedMode && !submitted && times
        ? gameCountdown(clock, times, gameMinutes, game.gameNumber, roundTimesByGame)
        : null
    const state = countdownState(clock, times, timeUp, game.gameNumber, roundTimesByGame)
    const collapsed = tvCarousel ? false : (collapsedGames[game.gameNumber] ?? false)
    const inBreakAfter = Boolean(
      times && roundTimesByGame && isGameSlotInBreakAfter(clock, game.gameNumber, roundTimesByGame),
    )
    const isCurrentGame = !submitted && (isLiveNow || inBreakAfter)
    const canEditGame =
      Boolean(canLog) &&
      (scoringTimeUnlocked ||
        submitted ||
        roundStatus === 'complete' ||
        isLiveNow ||
        timeUp)
    const displayTimeLabel =
      times != null ? formatGameTimeLabel(times.startsAt, times.endsAt) : game.timeLabel

    if (mode === 'scoring' && matchForCourt) {
      return (
        <ScoringGameCard
          key={game.gameNumber}
          game={game}
          displayTimeLabel={displayTimeLabel}
          liveCourtEnabled={liveCourtEnabled}
          friendly={friendly}
          sessionId={sessionId}
          competitionId={competitionId}
          gameRoundId={gameRoundId}
          courtsForGame={courtsForGame}
          courtIdByLabel={courtIdByLabel}
          matchForCourt={matchForCourt}
          scoreUnit={scoreUnit}
          canEdit={canEditGame}
          onSubmitScores={onSubmitScores}
          onSaved={onSaved}
          playTo={courtPlayTo}
          courtScoreMax={courtScoreMax}
          isLiveNow={isLiveNow}
          isCurrentGame={isCurrentGame}
          countdown={countdown}
          countdownLabelText={countdownLabel(state, t)}
          finished={finished}
          collapsed={collapsed}
          onToggleCollapsed={() => toggleCollapsed(game.gameNumber)}
          currentUserId={currentUserId}
          currentUserAvatarUrl={currentUserAvatarUrl}
          duoTeamLabels={duoTeamLabels}
          tvCompact={tvCompact}
          tvNav={tvNav}
          viewAlongUrl={viewAlongUrl}
          t={t}
        />
      )
    }

    if (mode === 'preview' && friendlyManualScoring) {
      return (
        <FriendlyManualGameCard
          key={game.gameNumber}
          game={game}
          scoreUnit={scoreUnit}
          liveCourtScores={liveCourtScores}
          onSubmitFriendlyScores={onSubmitFriendlyScores}
          onSaved={onSaved}
          courtScoreMax={courtScoreMax}
          courtPlayTo={courtPlayTo}
          isLiveNow={isLiveNow}
          isCurrentGame={isCurrentGame}
          countdown={countdown}
          countdownLabelText={countdownLabel(state, t)}
          finished={finished}
          collapsed={collapsed}
          onToggleCollapsed={() => toggleCollapsed(game.gameNumber)}
          currentUserId={currentUserId}
          currentUserAvatarUrl={currentUserAvatarUrl}
          t={t}
        />
      )
    }

    return (
      <GameCardShell
        key={game.gameNumber}
        gameNumber={game.gameNumber}
        finished={finished}
        isCurrentGame={isCurrentGame}
        tvCompact={tvCompact}
      >
        <GameCardHeader
          gameNumber={game.gameNumber}
          isLiveNow={isLiveNow}
          isCurrentGame={isCurrentGame}
          timeLabel={displayTimeLabel}
          countdown={countdown}
          countdownLabelText={countdownLabel(state, t)}
          finished={finished}
          collapsed={collapsed}
          onToggleCollapsed={() => toggleCollapsed(game.gameNumber)}
          hideCollapse={tvCompact}
          tvCompact={tvCompact}
          tvNav={tvNav}
          viewAlongUrl={viewAlongUrl}
          t={t}
        />
        {!collapsed && (
          <div className={tvCourtsBodyClass(tvCompact, finished)}>
            <div {...courtsGridProps(tvCompact, game.courts.length)}>
              {game.courts.map((court, courtIndex) => {
                const liveCourt = courtsForGame.find((c) => c.courtName === court.courtLabel)
                const courtId = courtIdForLabel(
                  court.courtLabel,
                  courtIndex,
                  courtsForGame,
                  courtIdByLabel,
                )
                const saved =
                  gameRoundId && courtId && matchForCourt
                    ? matchForCourt(gameRoundId, courtId)
                    : undefined
                const liveScore = liveCourtScores?.get(
                  liveCourtScoreKey(game.gameNumber, court.courtLabel),
                )
                const teamA = liveCourt?.teamA ?? court.teamA
                const teamB = liveCourt?.teamB ?? court.teamB
                const teamAPlayers = liveCourt?.teamAPlayers ?? court.teamAPlayers
                const teamBPlayers = liveCourt?.teamBPlayers ?? court.teamBPlayers
                const sideLabels = duoTeamLabels?.(
                  [teamA[0] ?? '', teamA[1] ?? ''],
                  [teamB[0] ?? '', teamB[1] ?? ''],
                  teamAPlayers,
                  teamBPlayers,
                )
                const href = courtLiveHref({
                  liveCourtEnabled,
                  friendly,
                  sessionId,
                  competitionId,
                  gameNumber: game.gameNumber,
                  courtLabel: court.courtLabel,
                  courtId,
                  canEditScores: false,
                })

                return (
                  <CourtCard
                    key={court.courtLabel}
                    courtLabel={court.courtLabel}
                    currentUserId={currentUserId}
                    court={liveCourt ?? court}
                    finished={finished}
                    href={href}
                    tvCompact={tvCompact}
                    t={t}
                  >
                    <CourtMatchCell
                      teamA={teamA}
                      teamB={teamB}
                      teamAPlayers={teamAPlayers}
                      teamBPlayers={teamBPlayers}
                      teamALabel={sideLabels?.teamALabel}
                      teamBLabel={sideLabels?.teamBLabel}
                      scoreUnit={scoreUnit}
                      scoreA={
                        liveScore?.scoreA ??
                        (saved?.teamAPoints != null ? String(saved.teamAPoints) : undefined)
                      }
                      scoreB={
                        liveScore?.scoreB ??
                        (saved?.teamBPoints != null ? String(saved.teamBPoints) : undefined)
                      }
                      scoreMax={courtScoreMax}
                      disabled
                      finished={finished}
                      currentUserId={currentUserId}
                      currentUserAvatarUrl={currentUserAvatarUrl}
                      embedded
                      compact={tvCompact}
                      t={t}
                    />
                  </CourtCard>
                )
              })}
            </div>
          </div>
        )}
      </GameCardShell>
    )
  }

  if (tvCarousel) {
    const gameByNumber = new Map(orderedGames.map((game) => [game.gameNumber, game]))
    return (
      <CompetitionTvGameCarousel
        gameNumbers={gameNumbers}
        activeGameNumber={focusGameNumber}
        renderGame={(gameNumber, nav) => {
          const game = gameByNumber.get(gameNumber)
          return game ? renderGameCard(game, nav) : null
        }}
        t={t}
      />
    )
  }

  return <div className="space-y-6">{orderedGames.map((game) => renderGameCard(game))}</div>
}
