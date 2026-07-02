import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useLocation, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useCompetitionBoard } from '../../hooks/useCompetitionBoard'
import { useCourtLive } from '../../hooks/useCourtLive'
import { useFriendlyGame } from '../../hooks/useFriendlyGame'
import { usePublicCompetition } from '../../hooks/usePublicCompetition'
import { useSetupCourts } from '../../hooks/useSetupCourts'
import { pivotScheduleByCourt, pivotScheduleByGame } from '../../lib/competitionCourtBoard'
import { americanoScoringUnit, americanoTargetPoints } from '../../lib/competitionPresets'
import {
  GestureCameraEngine,
  gestureScoreBeep,
  type FingerAction,
  type HoldUi,
} from '../../lib/gestureFingerDetect'
import { supportsGestureScoreCamera } from '../../lib/gestureScoreCamera'
import {
  competitionCourtSetupKey,
  ensureGestureCameraSession,
  friendlyGestureCourtSetupKey,
  loadGestureCameraLog,
  ourTeamFromCourtPlayers,
  gestureCameraPlayEnded,
  planGestureCameraPoint,
  planGestureCameraUndo,
  planGestureCameraGamesOverride,
  rosterFromCourt,
  scoreFromLog,
  syncGestureCameraPointForTeam,
  syncGestureCameraGamesOverride,
  undoGestureCameraPoint,
  type GestureCameraContext,
} from '../../lib/gestureCameraScore'
import type { MatchGestureLog } from '../../lib/matchLogServer'
import type { MatchTeam } from '../../lib/types'
import type { GameLogPoint } from '../../lib/gameLogSerialize'
import {
  DEFAULT_FRIENDLY_ORGANIZED_CONFIG,
  friendlyOrganizedSession,
  friendlyPreviewGames,
  friendlyStartsAtIso,
} from '../../lib/friendlyGames'
import { CameraScoreTrackerShell } from './'
import { CameraScoreTracker, type CameraScoreTrackerHandle } from './'
import { breakMinutesFromConfig } from '../../lib/competitionLayout'
import { formatDateInput } from '../../lib/courtSchedule'
import {
  newerGestureCameraLog,
  readLocalGestureCameraLog,
  writeLocalGestureCameraLog,
} from '../../lib/gestureCameraLocalCache'

const EMPTY_HOLD_UI: HoldUi = {
  activeHold: null,
  holdProgress: 0,
  gestureCooldown: false,
}

type Status = 'idle' | 'loading' | 'running' | 'unsupported' | 'error'

export function GestureScoreCourtPage() {
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const detectPreview =
    searchParams.get('gestureDetect') === '1' || searchParams.get('detect') === '1'
  const friendlyRoute = location.pathname.includes('/friendly/')
  const { id, gameNumber, courtId, courtSlug } = useParams()
  const { user, session: authSession, loading: authLoading, restoreSession } = useAuth()
  const needsAuth = false
  const gameNum = Number(gameNumber)
  const courtLabel = courtSlug ? decodeURIComponent(courtSlug) : ''
  const competitionCourtId = courtId ?? ''

  const { game: friendlyGame, loading: friendlyLoading } = useFriendlyGame(friendlyRoute ? id : undefined)
  const { session, rounds, roster, clubCourts, courtMatches } = usePublicCompetition(
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

  const courtSetupKey = useMemo(() => {
    if (!id || !Number.isFinite(gameNum)) return undefined
    if (friendlyRoute && courtLabel) return friendlyGestureCourtSetupKey(id, gameNum, courtLabel)
    if (!friendlyRoute && competitionCourtId) {
      return competitionCourtSetupKey(id, gameNum, competitionCourtId)
    }
    return undefined
  }, [competitionCourtId, courtLabel, friendlyRoute, gameNum, id])

  const competitionGames = useMemo(() => pivotScheduleByGame(columns), [columns])
  const competitionRoundId = useMemo(
    () => rounds.find((round) => round.round_number === gameNum)?.id,
    [gameNum, rounds],
  )

  const friendlyCourtMatch = useMemo(() => {
    if (!friendlyRoute || !friendlyGame || !courtLabel || !Number.isFinite(gameNum)) return null
    const config = friendlyGame.organizedConfig ?? DEFAULT_FRIENDLY_ORGANIZED_CONFIG
    const organizedConfig = {
      ...DEFAULT_FRIENDLY_ORGANIZED_CONFIG,
      ...config,
      day: config.day || formatDateInput(new Date()),
    }
    const previewGames = friendlyPreviewGames(friendlyGame, courtNames, friendlyGame.profileAvatars)
    const sessionConfig = friendlyOrganizedSession(organizedConfig)
    const startsAtIso = friendlyStartsAtIso(organizedConfig)
    const breakMinutes = breakMinutesFromConfig(sessionConfig.scoring_config)
    const cols = pivotScheduleByCourt(
      previewGames,
      startsAtIso,
      organizedConfig.gameMinutes,
      breakMinutes,
    )
    const games = pivotScheduleByGame(cols)
    const scheduleGame = games.find((game) => game.gameNumber === gameNum)
    return scheduleGame?.courts.find((court) => court.courtLabel === courtLabel) ?? null
  }, [courtLabel, courtNames, friendlyGame, friendlyRoute, gameNum])

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

  const ourTeam = useMemo(
    () =>
      ourTeamFromCourtPlayers(
        authSession?.user?.id ?? user?.id,
        courtMatch?.teamAPlayers,
        courtMatch?.teamBPlayers,
      ),
    [authSession?.user?.id, courtMatch, user?.id],
  )

  const scorerUserId = needsAuth ? (authSession?.user?.id ?? user?.id ?? null) : null

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

  const videoRef = useRef<HTMLVideoElement>(null)
  const engineRef = useRef<GestureCameraEngine | null>(null)
  const trackerRef = useRef<CameraScoreTrackerHandle>(null)
  const busyRef = useRef(false)
  const undoSeqRef = useRef(0)
  const matchEndedRef = useRef(false)
  const applyFingerActionRef = useRef<(action: FingerAction) => void>(() => {})
  const localLogRef = useRef<MatchGestureLog | null>(null)
  const detectPreviewRef = useRef(detectPreview)
  detectPreviewRef.current = detectPreview

  const [status, setStatus] = useState<Status>('idle')
  const [cameraError, setCameraError] = useState<string | null>(null)
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

  const teamAPlayers = useMemo(
    () => courtMatch?.teamAPlayers ?? [],
    [courtMatch?.teamAPlayers],
  )
  const teamBPlayers = useMemo(
    () => courtMatch?.teamBPlayers ?? [],
    [courtMatch?.teamBPlayers],
  )
  const applyScoreFromLog = useCallback(
    (log: MatchGestureLog | null) => {
      if (courtSetupKey && log) writeLocalGestureCameraLog(courtSetupKey, log)
      localLogRef.current = log
      const score = scoreFromLog(log)
      setPointsA(score.pointsA)
      setPointsB(score.pointsB)
      setGamesA(score.gamesA)
      setGamesB(score.gamesB)
      setPointHistory(log?.pointEvents ?? [])
      setMatchEnded(gestureCameraPlayEnded(log, playTo))
    },
    [courtSetupKey, playTo],
  )

  const refreshLogFromServer = useCallback(async () => {
    if (!courtSetupKey) return
    const server = await loadGestureCameraLog(courtSetupKey)
    const merged = newerGestureCameraLog(localLogRef.current, server)
    if (merged !== localLogRef.current) applyScoreFromLog(merged)
  }, [applyScoreFromLog, courtSetupKey])

  const { sendEphemeral } = useCourtLive(courtSetupKey, {
    enabled: Boolean(courtSetupKey),
    onCommitted: () => void refreshLogFromServer(),
  })

  const publishLocalScore = useCallback(
    (log: MatchGestureLog | null) => {
      if (!log) return
      sendEphemeral({ scoreAfter: scoreFromLog(log) })
    },
    [sendEphemeral],
  )

  useEffect(() => {
    if (!cameraCtx || !courtSetupKey) return
    const cached = readLocalGestureCameraLog(courtSetupKey)
    if (cached) applyScoreFromLog(cached)

    void (async () => {
      const { log } = await ensureGestureCameraSession(cameraCtx)
      const remote = log ?? (await loadGestureCameraLog(cameraCtx.courtSetupKey))
      const merged = newerGestureCameraLog(localLogRef.current, remote)
      if (merged) applyScoreFromLog(merged)
    })()
  }, [applyScoreFromLog, cameraCtx, courtSetupKey])

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
      if (writable) void refreshLogFromServer()
    }

    void syncSession()

    const onVisible = () => {
      if (document.visibilityState === 'visible') void syncSession()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      active = false
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [authLoading, needsAuth, refreshLogFromServer, restoreSession])

  const applyFingerAction = useCallback(
    async (action: FingerAction) => {
      const engine = engineRef.current
      if (!cameraCtx || busyRef.current) {
        return
      }
      if (matchEndedRef.current && action !== 'undo') {
        engine?.markScoreBlocked(performance.now())
        return
      }
      engine?.resetHoldTracking()
      trackerRef.current?.setHold(EMPTY_HOLD_UI)
      busyRef.current = true

      try {
        const prior = localLogRef.current
        let planned: MatchGestureLog | null = null
        let ended = false

        if (action === 'undo') {
          planned = planGestureCameraUndo(cameraCtx, prior)
          if (!planned || planned === prior) {
            engine?.markScoreBlocked(performance.now())
            return
          }
          undoSeqRef.current += 1
        } else {
          const team = action === 'team1' ? 'a' : 'b'
          const result = planGestureCameraPoint(cameraCtx, prior, team)
          planned = result.log
          ended = result.matchEnded
        }

        applyScoreFromLog(planned)
        publishLocalScore(planned)
        engine?.markScoreCommitted(performance.now())
        gestureScoreBeep()
        if (ended) setMatchEnded(true)
        else if (action === 'undo') setMatchEnded(false)

        engine?.resumeVideo()

        void (async () => {
          if (needsAuth) {
            const liveSession = await restoreSession()
            if (!liveSession?.access_token) {
              canSaveRef.current = false
              return
            }
            canSaveRef.current = true
          }

          if (action === 'undo') {
            const undoSeq = undoSeqRef.current
            const { error, log } = await undoGestureCameraPoint(cameraCtx, prior)
            if (undoSeq !== undoSeqRef.current) return
            if (error) return
            if (log) applyScoreFromLog(log)
            return
          }

          const team = action === 'team1' ? 'a' : 'b'
          const { error, log, matchEnded: syncedEnded } = await syncGestureCameraPointForTeam(
            cameraCtx,
            team,
            prior,
          )
          if (error) {
            if (error === 'Not authenticated') canSaveRef.current = false
            return
          }
          if (log) {
            const merged = newerGestureCameraLog(localLogRef.current, log)
            if (merged) applyScoreFromLog(merged)
          }
          if (syncedEnded) setMatchEnded(true)
        })()
      } finally {
        busyRef.current = false
      }
    },
    [applyScoreFromLog, cameraCtx, needsAuth, publishLocalScore, restoreSession],
  )

  applyFingerActionRef.current = (action) => {
    void applyFingerAction(action)
  }

  const applyGamesEdit = useCallback(
    async (team: MatchTeam, games: number) => {
      if (!cameraCtx || busyRef.current) return

      const prior = localLogRef.current
      const current = scoreFromLog(prior)
      const gamesA = team === 'a' ? games : current.gamesA
      const gamesB = team === 'b' ? games : current.gamesB
      const planned = planGestureCameraGamesOverride(cameraCtx, prior, gamesA, gamesB)
      if (!planned) return

      busyRef.current = true
      try {
        const { log, matchEnded } = planned
        applyScoreFromLog(log)
        publishLocalScore(log)
        gestureScoreBeep()
        setMatchEnded(matchEnded)
        engineRef.current?.resetHoldTracking()
        trackerRef.current?.setHold(EMPTY_HOLD_UI)

        void (async () => {
          if (needsAuth) {
            const liveSession = await restoreSession()
            if (!liveSession?.access_token) {
              canSaveRef.current = false
              return
            }
            canSaveRef.current = true
          }

          const { error, log: synced, matchEnded: syncedEnded } = await syncGestureCameraGamesOverride(
            cameraCtx,
            gamesA,
            gamesB,
            prior,
          )
          if (error) {
            if (error === 'Not authenticated') canSaveRef.current = false
            return
          }
          if (synced) {
            const merged = newerGestureCameraLog(localLogRef.current, synced)
            if (merged) applyScoreFromLog(merged)
          }
          if (syncedEnded) setMatchEnded(true)
        })()
      } finally {
        busyRef.current = false
      }
    },
    [applyScoreFromLog, cameraCtx, needsAuth, publishLocalScore, restoreSession],
  )

  useEffect(() => {
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
  }, [])

  const resumeCameraVideo = useCallback(() => {
    engineRef.current?.resumeVideo()
  }, [])

  const startCamera = useCallback(() => {
    setCameraError(null)
    void engineRef.current?.restart()
  }, [])

  const showStartCamera =
    status === 'idle' || status === 'loading' || status === 'error' || status === 'unsupported'

  const pageLoading =
    (needsAuth && (authLoading || sessionSyncing)) || friendlyLoading || waitingForFriendlySchedule
  const scorerReady = Boolean(courtSetupKey && canOpenGestureScore && cameraCtx)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const engine = new GestureCameraEngine({
      video,
      preview: detectPreviewRef.current,
      onFire: (action) => {
        if (action === 'reset') return
        applyFingerActionRef.current(action)
      },
      onHoldUi: (ui) => trackerRef.current?.setHold(ui),
      onStatus: setCameraStatus,
      onError: (message) => {
        setCameraError(message)
      },
    })
    engineRef.current = engine
    if (supportsGestureScoreCamera()) {
      void engine.start()
    }

    return () => {
      engine.stop()
      engineRef.current = null
      trackerRef.current?.setHold(EMPTY_HOLD_UI)
    }
  }, [pageLoading, scorerReady, setCameraStatus])

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

  const goldenPoint = pointsA >= 3 && pointsB >= 3

  return (
    <CameraScoreTrackerShell onSurfacePointerDown={resumeCameraVideo}>
      {pageLoading ? null : scorerReady ? (
        <CameraScoreTracker
          ref={trackerRef}
          preview={detectPreview}
          showStartCamera={showStartCamera}
          cameraStarting={status === 'loading'}
          cameraError={cameraError}
          cameraStatus={status}
          onStartCamera={startCamera}
          cameraPreview={
            <video
              ref={videoRef}
              muted
              playsInline
              className={`gesture-score-court__camera-preview${
                status === 'running' || status === 'loading'
                  ? ''
                  : ' gesture-score-court__camera-preview--hidden'
              }`}
              aria-label="Camera preview"
            />
          }
          pointLeft={pointsA}
          pointRight={pointsB}
          gamesLeft={gamesA}
          gamesRight={gamesB}
          golden={goldenPoint}
          isFinal={matchEnded}
          team1Players={teamAPlayers}
          team2Players={teamBPlayers}
          pointHistory={pointHistory}
          scoreDisabled={matchEnded}
          onGamesLeftChange={(games) => void applyGamesEdit('a', games)}
          onGamesRightChange={(games) => void applyGamesEdit('b', games)}
          onTeam1={() => void applyFingerAction('team1')}
          onTeam2={() => void applyFingerAction('team2')}
          onUndo={() => void applyFingerAction('undo')}
        />
      ) : null}
    </CameraScoreTrackerShell>
  )
}
