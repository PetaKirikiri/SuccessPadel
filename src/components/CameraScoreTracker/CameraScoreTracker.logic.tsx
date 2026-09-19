import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useCompetitionBoard } from '../../hooks/useCompetitionBoard'
import { useCourtLive } from '../../hooks/useCourtLive'
import { useFriendlyGame } from '../../hooks/useFriendlyGame'
import { useGestureScorerPresence } from '../../hooks/useGestureScorerPresence'
import { usePublicCompetition } from '../../hooks/usePublicCompetition'
import { useSetupCourts } from '../../hooks/useSetupCourts'
import { pivotScheduleByCourt, pivotScheduleByGame } from '../../lib/competitionCourtBoard'
import { americanoScoringUnit, americanoTargetPoints } from '../../lib/competitionPresets'
import {
  GestureCameraEngine,
  gestureScoreBeep,
  type FingerAction,
} from '../../lib/gestureFingerDetect'
import {
  competitionCourtSetupKey,
  ensureGestureCameraSession,
  friendlyGestureCourtSetupKey,
  loadGestureCameraLog,
  ourTeamFromCourtPlayers,
  gestureCameraPlayEnded,
  planGestureCameraPoint,
  planGestureCameraUndo,
  persistPlannedGestureCameraLog,
  rosterFromCourt,
  scoreFromLog,
  type GestureCameraContext,
} from '../../lib/gestureCameraScore'
import type { MatchGestureLog } from '../../lib/matchLogServer'
import type { GameLogPoint } from '../../lib/gameLogSerialize'
import {
  DEFAULT_FRIENDLY_ORGANIZED_CONFIG,
  friendlyGameSlotMillis,
  friendlyOrganizedSession,
  friendlyPreviewGames,
  friendlyStartsAtIso,
} from '../../lib/friendlyGames'
import { ThumbScorePadView } from './ThumbScorePadView'
import { useGestureRecognitionZoom } from '../../hooks/useGestureRecognitionZoom'
import { useGesturePadChrome } from '../../lib/gesturePadChrome'
import {
  competitionRoundTimesByGame,
  isGameSlotInBreakAfter,
} from '../../lib/competitionLayout'
import { ensureCompetitionRoundId } from '../../lib/competitionRoundResolve'
import { formatDateInput } from '../../lib/courtSchedule'
import {
  newerGestureCameraLog,
  readLocalGestureCameraLog,
  shouldPreferLocalGestureLog,
  writeLocalGestureCameraLog,
} from '../../lib/gestureCameraLocalCache'
import { useTennisBallDebugOverlay } from '../../lib/gestureTennisBallDebug'

type Status = 'idle' | 'loading' | 'running' | 'unsupported' | 'error'
type CourtOption = {
  value: string
  label: string
  courtSetupKey?: string
  status?: 'available' | 'occupied' | 'mine'
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return '0:00'
  const m = Math.floor(ms / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  return `${m}:${String(s).padStart(2, '0')}`
}

function timerValue(
  now: number,
  gameNumber: number,
  times: { startsAt: number; endsAt: number } | undefined,
  timesByGame?: Map<number, { startsAt: number; endsAt: number }>,
): string | null {
  if (!times) return null
  if (now < times.startsAt) return formatCountdown(times.startsAt - now)
  if (now < times.endsAt) return formatCountdown(times.endsAt - now)
  if (timesByGame && isGameSlotInBreakAfter(now, gameNumber, timesByGame)) {
    const next = timesByGame.get(gameNumber + 1)
    return next ? formatCountdown(next.startsAt - now) : '0:00'
  }
  return '0:00'
}

export function GestureScoreCourtPage() {
  useGesturePadChrome()
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const detectPreview =
    searchParams.get('gestureDetect') === '1' || searchParams.get('detect') === '1'
  const ballDebug =
    searchParams.get('ballDebug') === '1' || searchParams.get('tennisBallDebug') === '1'
  const friendlyRoute = location.pathname.includes('/friendly/')
  const { id, gameNumber, courtId, courtSlug } = useParams()
  const { user, session: authSession, loading: authLoading, restoreSession } = useAuth()
  const needsAuth = false
  const routeGameNum = Number(gameNumber)
  const routeCourtValue = courtSlug ? decodeURIComponent(courtSlug) : (courtId ?? '')
  const [activeGameNum, setActiveGameNum] = useState(() =>
    Number.isFinite(routeGameNum) ? routeGameNum : 1,
  )
  const [activeCourtValue, setActiveCourtValue] = useState(routeCourtValue)
  const gameNum = activeGameNum
  const courtLabel = friendlyRoute ? activeCourtValue : ''
  const competitionCourtId = friendlyRoute ? '' : activeCourtValue

  const { game: friendlyGame, loading: friendlyLoading } = useFriendlyGame(friendlyRoute ? id : undefined)
  const {
    session,
    rounds,
    roster,
    sessionPairs,
    clubCourts,
    courtMatches,
    loading: competitionLoading,
  } = usePublicCompetition(
    friendlyRoute ? undefined : id,
  )
  const { columns, liveCourtsByGame, courtIdByLabel } = useCompetitionBoard(
    session,
    rounds,
    roster,
    clubCourts,
    courtMatches,
  )
  const { courtNames } = useSetupCourts()
  const [tick, setTick] = useState(() => Date.now())

  const courtSetupKey = useMemo(() => {
    if (!id || !Number.isFinite(gameNum)) return undefined
    if (friendlyRoute && courtLabel) return friendlyGestureCourtSetupKey(id, gameNum, courtLabel)
    if (!friendlyRoute && competitionCourtId) {
      return competitionCourtSetupKey(id, gameNum, competitionCourtId)
    }
    return undefined
  }, [competitionCourtId, courtLabel, friendlyRoute, gameNum, id])
  const scorerUserId = needsAuth ? (authSession?.user?.id ?? user?.id ?? null) : null
  const presenceScopeKey = id ? `${friendlyRoute ? 'friendly' : 'competition'}:${id}` : undefined
  useGestureScorerPresence(presenceScopeKey, courtSetupKey, scorerUserId)

  const competitionGames = useMemo(() => pivotScheduleByGame(columns), [columns])
  const competitionRoundTimesByGameMap = useMemo(
    () =>
      friendlyRoute
        ? new Map<number, { startsAt: number; endsAt: number }>()
        : competitionRoundTimesByGame(
            session,
            Math.max(rounds.length, competitionGames.length),
            rounds,
          ),
    [competitionGames.length, friendlyRoute, rounds, session],
  )

  const friendlySchedule = useMemo(() => {
    if (!friendlyRoute || !friendlyGame) {
      return {
        games: [],
        roundTimesByGame: new Map<number, { startsAt: number; endsAt: number }>(),
      }
    }
    const config = friendlyGame.organizedConfig ?? DEFAULT_FRIENDLY_ORGANIZED_CONFIG
    const organizedConfig = {
      ...DEFAULT_FRIENDLY_ORGANIZED_CONFIG,
      ...config,
      day: config.day || formatDateInput(new Date()),
    }
    const previewGames = friendlyPreviewGames(friendlyGame, courtNames, friendlyGame.profileAvatars)
    const startsAtIso = friendlyStartsAtIso(organizedConfig)
    const breakMinutes = organizedConfig.breakMinutes
    const cols = pivotScheduleByCourt(
      previewGames,
      startsAtIso,
      organizedConfig.gameMinutes,
      breakMinutes,
    )
    const games = pivotScheduleByGame(cols)
    const roundTimesByGame = new Map<number, { startsAt: number; endsAt: number }>()
    for (const game of games) {
      const slot = friendlyGameSlotMillis(organizedConfig, game.gameNumber, games.length)
      if (slot) roundTimesByGame.set(game.gameNumber, slot)
    }
    return { games, roundTimesByGame }
  }, [courtNames, friendlyGame, friendlyRoute])

  const scheduleGames = friendlyRoute ? friendlySchedule.games : competitionGames
  const roundTimesByGame = friendlyRoute
    ? friendlySchedule.roundTimesByGame
    : competitionRoundTimesByGameMap

  useEffect(() => {
    const timer = window.setInterval(() => setTick(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])
  const competitionRoundId = useMemo(
    () => rounds.find((round) => round.round_number === gameNum)?.id,
    [gameNum, rounds],
  )

  const friendlyCourtMatch = useMemo(() => {
    if (!friendlyRoute || !friendlyGame || !courtLabel || !Number.isFinite(gameNum)) return null
    const scheduleGame = friendlySchedule.games.find((game) => game.gameNumber === gameNum)
    return scheduleGame?.courts.find((court) => court.courtLabel === courtLabel) ?? null
  }, [courtLabel, friendlyGame, friendlyRoute, friendlySchedule.games, gameNum])

  const competitionCourtLabel = useMemo(() => {
    if (friendlyRoute || !competitionCourtId) return ''
    const live = (liveCourtsByGame.get(gameNum) ?? []).find(
      (court) => court.courtId === competitionCourtId,
    )
    if (live?.courtName) return live.courtName
    for (const [label, courtId] of courtIdByLabel) {
      if (courtId === competitionCourtId) return label
    }
    return competitionCourtId
  }, [competitionCourtId, courtIdByLabel, friendlyRoute, gameNum, liveCourtsByGame])

  const competitionCourtMatch = useMemo(() => {
    if (friendlyRoute || !competitionCourtId) return null
    const live = (liveCourtsByGame.get(gameNum) ?? []).find((court) => court.courtId === competitionCourtId)
    if (live) return live
    const game = competitionGames.find((row) => row.gameNumber === gameNum)
    if (!game) return null
    return (
      game.courts.find((court) => courtIdByLabel.get(court.courtLabel) === competitionCourtId) ??
      game.courts.find((court) => court.courtLabel === competitionCourtLabel) ??
      null
    )
  }, [
    competitionCourtId,
    competitionCourtLabel,
    competitionGames,
    courtIdByLabel,
    friendlyRoute,
    gameNum,
    liveCourtsByGame,
  ])

  const courtMatch = friendlyRoute ? friendlyCourtMatch : competitionCourtMatch
  const resolvedCourtLabel = friendlyRoute ? courtLabel : competitionCourtLabel
  const selectedCourtValue = friendlyRoute ? courtLabel : competitionCourtId
  const currentTimes = roundTimesByGame.get(gameNum)
  const currentTimerValue = timerValue(tick, gameNum, currentTimes, roundTimesByGame)

  const courtOptionsForGame = useCallback(
    (nextGameNumber: number): CourtOption[] => {
      const nextGame = scheduleGames.find((game) => game.gameNumber === nextGameNumber)
      if (!nextGame) return []
      if (friendlyRoute) {
        return nextGame.courts.map((court) => ({ value: court.courtLabel, label: court.courtLabel }))
      }
      const liveCourts = liveCourtsByGame.get(nextGameNumber) ?? []
      return nextGame.courts
        .map((court) => {
          const live = liveCourts.find((row) => row.courtName === court.courtLabel)
          const value = live?.courtId ?? courtIdByLabel.get(court.courtLabel)
          if (!value) return null
          return { value, label: court.courtLabel }
        })
        .filter((option): option is CourtOption => option != null)
    },
    [courtIdByLabel, friendlyRoute, liveCourtsByGame, scheduleGames],
  )

  useEffect(() => {
    if (scheduleGames.length === 0) return
    if (!scheduleGames.some((game) => game.gameNumber === activeGameNum)) {
      setActiveGameNum(scheduleGames[0].gameNumber)
      return
    }
    const optionsForActiveGame = courtOptionsForGame(activeGameNum)
    if (!activeCourtValue && optionsForActiveGame[0]) {
      setActiveCourtValue(optionsForActiveGame[0].value)
      return
    }
    if (activeCourtValue && optionsForActiveGame.length > 0) {
      const currentOption = optionsForActiveGame.find((option) => option.value === activeCourtValue)
      if (currentOption) return
      const currentCourtLabel = resolvedCourtLabel || activeCourtValue
      const matchingCourt = optionsForActiveGame.find(
        (option) => option.label === currentCourtLabel || option.label === activeCourtValue,
      )
      if (matchingCourt) setActiveCourtValue(matchingCourt.value)
    }
  }, [activeCourtValue, activeGameNum, courtOptionsForGame, resolvedCourtLabel, scheduleGames])

  useEffect(() => {
    if (!id || !Number.isFinite(gameNum) || !selectedCourtValue) return
    const courtSegment = encodeURIComponent(selectedCourtValue)
    const nextPath = friendlyRoute
      ? `/friendly/${id}/games/${gameNum}/courts/${courtSegment}/gesture-score`
      : `/competitions/${id}/games/${gameNum}/courts/${courtSegment}/gesture-score`
    const nextUrl = `${nextPath}${location.search}`
    if (`${location.pathname}${location.search}` !== nextUrl) {
      navigate(nextUrl, { replace: true })
    }
  }, [
    friendlyRoute,
    gameNum,
    id,
    location.pathname,
    location.search,
    navigate,
    selectedCourtValue,
  ])

  const ourTeam = useMemo(
    () =>
      ourTeamFromCourtPlayers(
        authSession?.user?.id ?? user?.id,
        courtMatch?.teamAPlayers,
        courtMatch?.teamBPlayers,
      ),
    [authSession?.user?.id, courtMatch, user?.id],
  )

  const scoreUnit = useMemo(() => {
    if (friendlyRoute && friendlyGame) {
      const config = friendlyGame.organizedConfig ?? DEFAULT_FRIENDLY_ORGANIZED_CONFIG
      return americanoScoringUnit(friendlyOrganizedSession(config))
    }
    if (session) return americanoScoringUnit(session)
    return 'games' as const
  }, [friendlyGame, friendlyRoute, session])

  const playTo = useMemo(() => {
    if (friendlyRoute && friendlyGame) {
      const config = friendlyGame.organizedConfig ?? DEFAULT_FRIENDLY_ORGANIZED_CONFIG
      const organized = friendlyOrganizedSession(config)
      if (americanoScoringUnit(organized) === 'open') return undefined
      return americanoTargetPoints(organized)
    }
    if (session) {
      if (americanoScoringUnit(session) === 'open') return undefined
      return americanoTargetPoints(session)
    }
    return undefined
  }, [friendlyGame, friendlyRoute, session])

  const cameraCtx = useMemo((): GestureCameraContext | null => {
    if (!courtSetupKey || !id || !Number.isFinite(gameNum)) return null
    if (needsAuth && !scorerUserId) return null
    return {
      courtSetupKey,
      friendly: friendlyRoute,
      friendlySessionId: friendlyRoute ? id : undefined,
      competitionId: friendlyRoute ? undefined : id,
      gameNumber: gameNum,
      courtId: friendlyRoute ? resolvedCourtLabel : competitionCourtId,
      courtLabel: resolvedCourtLabel,
      roundId: competitionRoundId,
      playTo,
      scoreUnit,
      roster: rosterFromCourt(courtMatch?.teamAPlayers, courtMatch?.teamBPlayers),
      ourTeam: ourTeam ?? 'a',
      scorerProfileId: scorerUserId ?? undefined,
    }
  }, [
    competitionCourtId,
    competitionRoundId,
    courtMatch,
    courtSetupKey,
    friendlyRoute,
    gameNum,
    id,
    needsAuth,
    ourTeam,
    playTo,
    resolvedCourtLabel,
    scoreUnit,
    scorerUserId,
  ])

  const canOpenGestureScore = friendlyRoute
    ? Boolean(courtSetupKey && courtLabel && friendlyGame)
    : Boolean(courtSetupKey && competitionCourtId)

  const waitingForFriendlySchedule =
    friendlyRoute && Boolean(friendlyGame && courtLabel && courtNames.length === 0 && !courtMatch)
  const waitingForNavigatorSelection =
    !activeCourtValue && (friendlyLoading || (!friendlyRoute && competitionLoading) || scheduleGames.length > 0)

  const videoRef = useRef<HTMLVideoElement>(null)
  const ballOverlayRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<GestureCameraEngine | null>(null)
  const { zoom, setZoom, zoomCanvasRef, prepareThumbFrame } = useGestureRecognitionZoom()
  const saveChainRef = useRef<Promise<void>>(Promise.resolve())
  const pendingSavesRef = useRef(0)
  const sessionInitKeyRef = useRef<string | null>(null)
  const undoSeqRef = useRef(0)
  const matchEndedRef = useRef(false)
  const applyFingerActionRef = useRef<(action: FingerAction) => void>(() => {})
  const localLogRef = useRef<MatchGestureLog | null>(null)
  const detectPreviewRef = useRef(detectPreview)
  detectPreviewRef.current = detectPreview

  const [status, setStatus] = useState<Status>('idle')
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [scoreSaveError, setScoreSaveError] = useState<string | null>(null)
  const setCameraStatus = useCallback((next: Status) => {
    setStatus(next)
  }, [])
  const [sessionSyncing, setSessionSyncing] = useState(() => needsAuth)
  const canSaveRef = useRef(!needsAuth)
  const [pointsA, setPointsA] = useState(0)
  const [pointsB, setPointsB] = useState(0)
  const [gamesA, setGamesA] = useState(0)
  const [gamesB, setGamesB] = useState(0)
  const [matchEnded, setMatchEnded] = useState(false)
  const [pointHistory, setPointHistory] = useState<GameLogPoint[]>([])
  matchEndedRef.current = matchEnded

  const applyScoreLocal = useCallback(
    (log: MatchGestureLog | null, ended: boolean, immediate = false) => {
      localLogRef.current = log
      matchEndedRef.current = ended
      const score = scoreFromLog(log)
      const apply = () => {
        setPointsA(score.pointsA)
        setPointsB(score.pointsB)
        setGamesA(score.gamesA)
        setGamesB(score.gamesB)
        setPointHistory(log?.pointEvents ?? [])
        setMatchEnded(ended)
      }
      if (immediate) flushSync(apply)
      else apply()
    },
    [],
  )

  const applyScoreFromLog = useCallback(
    (log: MatchGestureLog | null) => {
      applyScoreLocal(log, gestureCameraPlayEnded(log, playTo))
      if (courtSetupKey && log) writeLocalGestureCameraLog(courtSetupKey, log)
    },
    [applyScoreLocal, courtSetupKey, playTo],
  )

  const { sendEphemeral } = useCourtLive(courtSetupKey, {
    enabled: Boolean(courtSetupKey),
  })

  const publishLocalScore = useCallback(
    (log: MatchGestureLog | null) => {
      if (!log) return
      sendEphemeral({
        scoreAfter: scoreFromLog(log),
        gameNumber: cameraCtx?.gameNumber,
        courtId: cameraCtx?.courtId ?? null,
        courtLabel: cameraCtx?.courtLabel ?? null,
      })
    },
    [cameraCtx, sendEphemeral],
  )

  useEffect(() => {
    if (!cameraCtx || !courtSetupKey) return

    const switchingCourt = sessionInitKeyRef.current !== courtSetupKey
    if (switchingCourt) {
      setScoreSaveError(null)
      applyScoreLocal(null, false)
      localLogRef.current = null
    }
    const cached = readLocalGestureCameraLog(courtSetupKey)
    if (cached) applyScoreFromLog(cached)

    if (!switchingCourt) return
    sessionInitKeyRef.current = courtSetupKey

    void (async () => {
      if (pendingSavesRef.current > 0) return
      const { log, error } = await ensureGestureCameraSession(cameraCtx)
      if (error) setScoreSaveError(`Score not saved to the website: ${error}`)
      if (pendingSavesRef.current > 0) return
      const remote = log ?? (await loadGestureCameraLog(cameraCtx.courtSetupKey))
      if (shouldPreferLocalGestureLog(localLogRef.current, remote)) return
      const merged = newerGestureCameraLog(localLogRef.current, remote)
      if (merged && merged !== localLogRef.current) applyScoreFromLog(merged)
    })()
  }, [applyScoreFromLog, applyScoreLocal, cameraCtx, courtSetupKey])

  useEffect(() => {
    if (!needsAuth) return
    let active = true

    const syncSession = async () => {
      if (authLoading) return
      setSessionSyncing(true)
      const live = await restoreSession()
      if (!active) return
      const writable = Boolean(live?.access_token)
      canSaveRef.current = writable
      setSessionSyncing(false)
    }

    void syncSession()

    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      void (async () => {
        if (authLoading) return
        const live = await restoreSession()
        if (!active) return
        canSaveRef.current = Boolean(live?.access_token)
      })()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      active = false
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [authLoading, needsAuth, restoreSession])

  const enqueuePersist = useCallback(
    (
      planned: MatchGestureLog,
      priorForSave: MatchGestureLog | null,
      matchEnded: boolean,
      undoSeq = 0,
    ) => {
      if (!cameraCtx) return
      pendingSavesRef.current += 1
      saveChainRef.current = saveChainRef.current
        .then(async () => {
          if (needsAuth && !canSaveRef.current) {
            const liveSession = await restoreSession()
            if (!liveSession?.access_token) {
              canSaveRef.current = false
              setScoreSaveError('Score not saved to the website. Please sign in and retry.')
              return
            }
            canSaveRef.current = true
          }

          let ctxForSave = cameraCtx
          if (!cameraCtx.friendly && !cameraCtx.roundId && session) {
            const result = await ensureCompetitionRoundId(cameraCtx.competitionId!, cameraCtx.gameNumber, {
              session,
              roster,
              sessionPairs,
            })
            if (result.roundId) {
              ctxForSave = { ...cameraCtx, roundId: result.roundId }
            }
          }

          const { error } = await persistPlannedGestureCameraLog(
            ctxForSave,
            priorForSave,
            planned,
            matchEnded,
          )
          if (error) {
            if (error === 'Not authenticated') canSaveRef.current = false
            setScoreSaveError(`Score not saved to the website: ${error}`)
            return
          }
          setScoreSaveError(null)
          if (undoSeq > 0 && undoSeq !== undoSeqRef.current) return
          publishLocalScore(planned)
        })
        .catch(() => setScoreSaveError('Score not saved to the website. Check your connection and retry.'))
        .finally(() => {
          pendingSavesRef.current = Math.max(0, pendingSavesRef.current - 1)
        })
    },
    [cameraCtx, needsAuth, publishLocalScore, restoreSession, roster, session, sessionPairs],
  )

  const applyFingerAction = useCallback(
    (action: FingerAction) => {
      const engine = engineRef.current
      if (!cameraCtx) return
      const prior = localLogRef.current
      let planned: MatchGestureLog
      let ended = false

      if (action === 'undo') {
        const undone = planGestureCameraUndo(cameraCtx, prior)
        if (!undone || undone === prior) {
          engine?.markScoreBlocked(performance.now())
          return
        }
        planned = undone
        undoSeqRef.current += 1
        ended = gestureCameraPlayEnded(planned, playTo)
      } else {
        const team = action === 'team1' ? 'a' : 'b'
        const result = planGestureCameraPoint(cameraCtx, prior, team)
        planned = result.log
        ended = result.matchEnded
      }

      applyScoreLocal(planned, ended, true)

      queueMicrotask(() => {
        if (courtSetupKey) writeLocalGestureCameraLog(courtSetupKey, planned)
        engine?.markScoreCommitted(performance.now(), action)
        gestureScoreBeep()
        engine?.resumeVideo()
        const undoSeq = action === 'undo' ? undoSeqRef.current : 0
        enqueuePersist(planned, prior, ended, undoSeq)
      })
    },
    [applyScoreLocal, cameraCtx, courtSetupKey, enqueuePersist, playTo],
  )

  applyFingerActionRef.current = (action) => {
    applyFingerAction(action)
  }

  useEffect(() => {
    if (status !== 'running' && status !== 'loading') return
    const video = videoRef.current
    if (!video) return
    const replay = () => {
      if (video.srcObject && video.paused) void video.play().catch(() => {})
    }
    video.addEventListener('pause', replay)
    const watchdog = window.setInterval(replay, 1500)
    return () => {
      video.removeEventListener('pause', replay)
      window.clearInterval(watchdog)
    }
  }, [status])

  const startCamera = useCallback(() => {
    setCameraError(null)
    void engineRef.current?.restart()
  }, [])

  const stopCamera = useCallback(() => {
    engineRef.current?.stop()
    setCameraError(null)
  }, [])

  useTennisBallDebugOverlay(
    videoRef,
    ballOverlayRef,
    ballDebug && (status === 'running' || status === 'loading'),
  )

  const pageLoading =
    (needsAuth && (authLoading || sessionSyncing)) ||
    friendlyLoading ||
    (!friendlyRoute && competitionLoading) ||
    waitingForFriendlySchedule ||
    waitingForNavigatorSelection
  const scorerReady = Boolean(courtSetupKey && canOpenGestureScore && cameraCtx)

  useEffect(() => {
    if (!scorerReady) return

    let cancelled = false
    let engine: GestureCameraEngine | null = null

    const mountEngine = () => {
      if (cancelled) return
      const video = videoRef.current
      if (!video) {
        requestAnimationFrame(mountEngine)
        return
      }

      engine = new GestureCameraEngine({
        video,
        gestureMode: 'thumbs',
        prepareThumbFrame,
        preview: detectPreviewRef.current,
        onFire: (action) => {
          if (action === 'reset') return
          applyFingerActionRef.current(action)
        },
        onStatus: setCameraStatus,
        onError: (message) => {
          setCameraError(message)
        },
      })
      engineRef.current = engine
      // Also resume after a development hot refresh; permission failures retain manual retry.
      void engine.start()
    }

    mountEngine()

    return () => {
      cancelled = true
      engine?.stop()
      engineRef.current = null
    }
  }, [scorerReady, setCameraStatus, prepareThumbFrame])

  useEffect(() => {
    if (detectPreview) document.documentElement.dataset.gestureDetectPreview = 'true'
    else delete document.documentElement.dataset.gestureDetectPreview
    engineRef.current?.updateConfig({ preview: detectPreview })
    return () => {
      delete document.documentElement.dataset.gestureDetectPreview
    }
  }, [detectPreview])

  if (!scorerReady && !pageLoading) {
    return <Navigate to={friendlyRoute && id ? `/friendly/${id}` : id ? `/competitions/${id}` : '/friendly'} replace />
  }

  return scorerReady ? (
    <ThumbScorePadView
      zoom={zoom} onZoomChange={setZoom} zoomCanvasRef={zoomCanvasRef}
      videoRef={videoRef} status={status} error={scoreSaveError ?? cameraError}
      ourPoints={pointsA} theirPoints={pointsB} ourGames={gamesA} theirGames={gamesB}
      timerValue={currentTimerValue ?? '0:00'} restartCamera={startCamera}
      goBack={() => { stopCamera(); navigate(friendlyRoute ? `/friendly/${id}` : `/competitions/${id}`) }}
      onWin={() => applyFingerAction('team1')}
      onLose={() => applyFingerAction('team2')}
      onUndo={() => applyFingerAction('undo')}
      undoDisabled={pointHistory.length === 0}
    />
  ) : <p role="status">Loading court…</p>
}
