import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FilesetResolver, GestureRecognizer } from '@mediapipe/tasks-vision'
import { ArrowLeft } from 'lucide-react'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useCompetitionBoard } from '../hooks/useCompetitionBoard'
import { useCourtLive } from '../hooks/useCourtLive'
import { useFriendlyGame } from '../hooks/useFriendlyGame'
import { usePublicCompetition } from '../hooks/usePublicCompetition'
import { useSetupCourts } from '../hooks/useSetupCourts'
import { pivotScheduleByCourt, pivotScheduleByGame } from '../lib/competitionCourtBoard'
import { americanoScoringUnit } from '../lib/competitionPresets'
import {
  fingerActionFromLandmarks,
  gestureCameraBeep,
  GESTURE_CAMERA_COOLDOWN_MS,
  GESTURE_CAMERA_HOLD_MS,
  GESTURE_CAMERA_MODEL_URL,
  GESTURE_CAMERA_WASM_BASE,
  type FingerAction,
} from '../lib/gestureCameraDetect'
import {
  competitionCourtSetupKey,
  friendlyGestureCourtSetupKey,
  loadGestureCameraLog,
  ourTeamFromCourtPlayers,
  ourThemFromScore,
  resetGestureCameraLog,
  rosterFromCourt,
  scoreFromLog,
  syncGestureCameraPoint,
  undoGestureCameraPoint,
  type GestureCameraContext,
} from '../lib/gestureCameraScore'
import {
  requestGestureScoreCamera,
  supportsGestureScoreCamera,
  takeGestureScoreCameraRequest,
} from '../lib/gestureScoreCamera'
import {
  DEFAULT_FRIENDLY_ORGANIZED_CONFIG,
  friendlyOrganizedSession,
  friendlyPreviewGames,
  friendlyStartsAtIso,
} from '../lib/friendlyGames'
import { useGesturePadChrome } from '../lib/gesturePadChrome'
import { courtHasCurrentUser } from '../components/cards/CourtCard'
import { breakMinutesFromConfig } from '../lib/competitionLayout'
import { formatDateInput } from '../lib/courtSchedule'

type Status = 'idle' | 'loading' | 'running' | 'unsupported' | 'error'

const scoreNumberStyle = {
  fontSize: 'clamp(4.75rem, min(25vw, 30vh), 16rem)',
} satisfies CSSProperties

function pointDisplay(points: number): string {
  return ['0', '15', '30', '40'][Math.min(points, 3)] ?? '40'
}

function formatTimer(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

function FingerCountIcon({ count }: { count: 1 | 2 | 3 | 4 }) {
  return (
    <img
      src={`/gesture-score/${count === 1 ? 'one-finger' : count === 2 ? 'two-fingers' : count === 3 ? 'three-fingers' : 'four-fingers'}.png`}
      alt=""
      className="h-10 w-10 shrink-0 object-contain sm:h-12 sm:w-12 md:h-20 md:w-20"
      aria-hidden="true"
      draggable={false}
    />
  )
}

export function GestureScoreCourtPage() {
  useGesturePadChrome()
  const navigate = useNavigate()
  const location = useLocation()
  const friendlyRoute = location.pathname.includes('/friendly/')
  const { id, gameNumber, courtId, courtSlug } = useParams()
  const { user, profile, loading: authLoading } = useAuth()
  const gameNum = Number(gameNumber)
  const courtLabel = courtSlug ? decodeURIComponent(courtSlug) : ''
  const competitionCourtId = courtId ?? ''

  const { game: friendlyGame, loading: friendlyLoading } = useFriendlyGame(friendlyRoute ? id : undefined)
  const { session, rounds, roster, clubCourts, courtMatches } = usePublicCompetition(
    friendlyRoute ? undefined : id,
  )
  const { columns, liveCourtsByGame } = useCompetitionBoard(
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

  const competitionCourtMatch = useMemo(() => {
    if (friendlyRoute || !competitionCourtId) return null
    const live = (liveCourtsByGame.get(gameNum) ?? []).find((court) => court.courtId === competitionCourtId)
    if (live) return live
    const game = competitionGames.find((row) => row.gameNumber === gameNum)
    return game?.courts.find((court) => court.courtLabel === competitionCourtId) ?? null
  }, [competitionCourtId, competitionGames, friendlyRoute, gameNum, liveCourtsByGame])

  const courtMatch = friendlyRoute ? friendlyCourtMatch : competitionCourtMatch
  const resolvedCourtLabel = friendlyRoute
    ? courtLabel
    : (liveCourtsByGame.get(gameNum) ?? []).find((court) => court.courtId === competitionCourtId)
        ?.courtName ??
      (courtMatch && 'courtLabel' in courtMatch ? courtMatch.courtLabel : competitionCourtId)

  const ourTeam = useMemo(
    () =>
      ourTeamFromCourtPlayers(
        user?.id,
        courtMatch?.teamAPlayers,
        courtMatch?.teamBPlayers,
      ),
    [courtMatch, user?.id],
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
    if (friendlyRoute) return undefined
    const cfg = session?.scoring_config as { play_to?: number } | undefined
    return cfg?.play_to
  }, [friendlyRoute, session?.scoring_config])

  const cameraCtx = useMemo((): GestureCameraContext | null => {
    if (!courtSetupKey || !user?.id || !ourTeam || !id || !Number.isFinite(gameNum)) return null
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
      ourTeam,
      scorerProfileId: user.id,
    }
  }, [
    competitionCourtId,
    competitionRoundId,
    courtMatch,
    courtSetupKey,
    friendlyRoute,
    gameNum,
    id,
    ourTeam,
    playTo,
    resolvedCourtLabel,
    scoreUnit,
    user?.id,
  ])

  const onCourt = courtMatch
    ? courtHasCurrentUser(user?.id, {
        teamAPlayers: courtMatch.teamAPlayers,
        teamBPlayers: courtMatch.teamBPlayers,
        playerIds: 'playerIds' in courtMatch ? courtMatch.playerIds : undefined,
      })
    : false

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recognizerRef = useRef<GestureRecognizer | null>(null)
  const frameRef = useRef<number | null>(null)
  const heldGestureRef = useRef<FingerAction | null>(null)
  const heldSinceRef = useRef<number | null>(null)
  const cooldownUntilRef = useRef(0)
  const cameraRunRef = useRef(0)
  const busyRef = useRef(false)

  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [ourPoints, setOurPoints] = useState(0)
  const [theirPoints, setTheirPoints] = useState(0)
  const [ourGames, setOurGames] = useState(0)
  const [theirGames, setTheirGames] = useState(0)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [matchEnded, setMatchEnded] = useState(false)

  const applyScoreFromLog = useCallback(
    (log: Awaited<ReturnType<typeof loadGestureCameraLog>>) => {
      const score = scoreFromLog(log)
      const mapped = ourTeam ? ourThemFromScore(score, ourTeam) : null
      if (!mapped) return
      setOurPoints(mapped.ourPoints)
      setTheirPoints(mapped.theirPoints)
      setOurGames(mapped.ourGames)
      setTheirGames(mapped.theirGames)
      setMatchEnded(Boolean(log?.matchEndedAt))
    },
    [ourTeam],
  )

  const refreshLog = useCallback(async () => {
    if (!courtSetupKey) return
    const log = await loadGestureCameraLog(courtSetupKey)
    applyScoreFromLog(log)
  }, [applyScoreFromLog, courtSetupKey])

  useCourtLive(courtSetupKey, {
    enabled: Boolean(courtSetupKey && user),
    onCommitted: () => void refreshLog(),
  })

  useEffect(() => {
    void refreshLog()
  }, [refreshLog])

  useEffect(() => {
    const startedAt = Date.now()
    const tick = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000))
    }, 1000)
    return () => window.clearInterval(tick)
  }, [])

  const stopCamera = () => {
    cameraRunRef.current += 1
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current)
      frameRef.current = null
    }
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    recognizerRef.current?.close()
    recognizerRef.current = null
    heldGestureRef.current = null
    heldSinceRef.current = null
    setStatus('idle')
  }

  const applyFingerAction = useCallback(
    async (action: FingerAction) => {
      if (!cameraCtx || busyRef.current || matchEnded) return
      heldGestureRef.current = null
      heldSinceRef.current = null
      cooldownUntilRef.current = performance.now() + GESTURE_CAMERA_COOLDOWN_MS
      gestureCameraBeep()
      busyRef.current = true
      setSyncError(null)
      try {
        if (action === 'reset') {
          const { error: resetErr } = await resetGestureCameraLog(cameraCtx)
          if (resetErr) setSyncError(resetErr)
          else await refreshLog()
          return
        }
        if (action === 'undo') {
          const { error: undoErr } = await undoGestureCameraPoint(cameraCtx)
          if (undoErr) setSyncError(undoErr)
          else await refreshLog()
          return
        }
        const { error: syncErr, matchEnded: ended } = await syncGestureCameraPoint(
          cameraCtx,
          action === 'win' ? 'us' : 'them',
        )
        if (syncErr) setSyncError(syncErr)
        else {
          await refreshLog()
          if (ended) setMatchEnded(true)
        }
      } finally {
        busyRef.current = false
      }
    },
    [cameraCtx, matchEnded, refreshLog],
  )

  const detectFrame = useCallback(() => {
    const recognizer = recognizerRef.current
    const video = videoRef.current
    if (!recognizer || !video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      frameRef.current = requestAnimationFrame(detectFrame)
      return
    }

    const now = performance.now()
    const result = recognizer.recognizeForVideo(video, now)
    const action = fingerActionFromLandmarks(result.landmarks[0])

    if (!action) {
      heldGestureRef.current = null
      heldSinceRef.current = null
      frameRef.current = requestAnimationFrame(detectFrame)
      return
    }

    if (now < cooldownUntilRef.current) {
      frameRef.current = requestAnimationFrame(detectFrame)
      return
    }

    if (heldGestureRef.current !== action) {
      heldGestureRef.current = action
      heldSinceRef.current = now
    } else {
      const heldFor = now - (heldSinceRef.current ?? now)
      if (heldFor >= GESTURE_CAMERA_HOLD_MS) void applyFingerAction(action)
    }

    frameRef.current = requestAnimationFrame(detectFrame)
  }, [applyFingerAction])

  const startCamera = async () => {
    const runId = cameraRunRef.current + 1
    cameraRunRef.current = runId
    setError(null)
    if (!supportsGestureScoreCamera()) {
      setStatus('unsupported')
      return
    }

    try {
      setStatus('loading')
      const vision = await FilesetResolver.forVisionTasks(GESTURE_CAMERA_WASM_BASE)
      const recognizer = await GestureRecognizer.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: GESTURE_CAMERA_MODEL_URL,
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numHands: 1,
      })
      if (cameraRunRef.current !== runId) {
        recognizer.close()
        return
      }
      recognizerRef.current = recognizer

      const stream = await (takeGestureScoreCameraRequest() ?? requestGestureScoreCamera())
      if (cameraRunRef.current !== runId) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      streamRef.current = stream
      if (!videoRef.current) throw new Error('Camera preview is not ready')
      videoRef.current.srcObject = stream
      await videoRef.current.play()
      if (cameraRunRef.current !== runId) return
      setStatus('running')
      frameRef.current = requestAnimationFrame(detectFrame)
    } catch (e) {
      if (cameraRunRef.current !== runId) return
      stopCamera()
      setStatus('error')
      setError(e instanceof Error ? e.message : 'Camera permission or gesture setup failed')
    }
  }

  useEffect(() => {
    void startCamera()
    return stopCamera
  }, [])

  const goBack = () => {
    stopCamera()
    if (friendlyRoute && id) navigate(`/friendly/${id}`)
    else if (id) navigate(`/competitions/${id}`)
    else navigate(-1)
  }

  if (authLoading || friendlyLoading) {
    return <p className="p-4 text-center text-sm text-white/70">Loading…</p>
  }
  if (!user || !profile || !courtSetupKey || !courtMatch || !onCourt || !ourTeam || !cameraCtx) {
    return <Navigate to={friendlyRoute && id ? `/friendly/${id}` : id ? `/competitions/${id}` : '/friendly'} replace />
  }

  const goldenPoint = ourPoints >= 3 && theirPoints >= 3
  const showStartCameraButton = status === 'error' || status === 'unsupported'

  return (
    <main className="fixed inset-y-0 left-0 right-0 z-[420] flex min-h-0 w-screen max-w-none flex-col overflow-hidden bg-[#0b2a4a] text-white [width:100dvw]">
      <video
        ref={videoRef}
        muted
        playsInline
        className={`pointer-events-none fixed right-2 top-[max(0.5rem,env(safe-area-inset-top))] z-[430] h-14 w-20 scale-x-[-1] rounded-lg border border-white/20 bg-[#06192d] object-cover shadow-2xl shadow-black/35 transition-opacity sm:right-3 sm:h-16 sm:w-24 md:right-6 md:h-36 md:w-48 ${
          status === 'running' || status === 'loading' ? 'opacity-100' : 'opacity-0'
        }`}
      />
      {showStartCameraButton ? (
        <button
          type="button"
          onClick={() => void startCamera()}
          className="fixed right-3 top-[max(0.75rem,env(safe-area-inset-top))] z-[440] rounded-full border border-[#34d399]/45 bg-[#34d399]/15 px-4 py-2 text-sm font-black uppercase tracking-wide text-[#34d399] shadow-lg shadow-black/25 active:scale-[0.98]"
        >
          Start Camera
        </button>
      ) : null}

      <section className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_auto] gap-2 px-2 pt-[max(0.5rem,env(safe-area-inset-top))] pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:px-3 md:gap-6 md:px-8">
        <div className="relative mx-auto grid h-full min-h-0 w-full max-w-7xl grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-stretch gap-1 overflow-hidden rounded-xl border border-white/15 bg-[#11355c] px-3 py-2 md:gap-3 md:rounded-2xl md:px-8 md:pb-6 md:pt-16">
          <button
            type="button"
            onClick={goBack}
            className="absolute left-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-[#0b2a4a]/70 text-[#f8fafc] active:scale-[0.98] md:left-4 md:top-4 md:h-10 md:w-10"
            aria-label="Back"
          >
            <ArrowLeft className="h-[1.125rem] w-[1.125rem] stroke-[3] md:h-5 md:w-5" aria-hidden />
          </button>
          <div className="absolute left-1/2 top-1.5 z-10 -translate-x-1/2 rounded-full border border-white/15 bg-[#0b2a4a]/60 px-3 py-0.5 text-center shadow-lg shadow-black/20 md:top-4 md:px-6 md:py-1.5">
            <p className="font-display text-xl font-black leading-none text-[#f8fafc] md:text-5xl">
              {formatTimer(elapsedSeconds)}
            </p>
            <p className="text-[10px] font-bold uppercase tracking-wide text-white/50 md:text-xs">
              {resolvedCourtLabel}
            </p>
          </div>
          <div className="flex min-h-0 min-w-0 flex-col justify-center text-left">
            <p className="hidden truncate text-[11px] font-black uppercase tracking-wide text-white/55 sm:text-xs md:block md:text-lg">
              Our Team
            </p>
            <p className="text-xs font-bold text-[#7dd3fc] md:mt-1 md:text-base">Games {ourGames}</p>
            <p className="font-display font-black leading-[0.86] text-[#f8fafc] md:mt-4 md:leading-[0.9]" style={scoreNumberStyle}>
              {pointDisplay(ourPoints)}
            </p>
          </div>
          <div className="flex min-h-0 min-w-[2.5rem] flex-col items-center justify-center gap-1 md:min-w-[8rem] md:gap-2">
            {goldenPoint ? (
              <p className="rounded-full border border-white/15 bg-[#34d399]/15 px-3 py-1 text-center text-[10px] font-black uppercase tracking-wide text-[#34d399] md:text-xs">
                Golden point
              </p>
            ) : null}
            {matchEnded ? (
              <p className="rounded-full border border-white/15 bg-[#fbbf24]/15 px-3 py-1 text-center text-[10px] font-black uppercase tracking-wide text-[#fde68a] md:text-xs">
                Final
              </p>
            ) : null}
            <p className="font-display text-4xl font-black text-[#7dd3fc] md:text-8xl">:</p>
          </div>
          <div className="flex min-h-0 min-w-0 flex-col justify-center text-right">
            <p className="hidden truncate text-[11px] font-black uppercase tracking-wide text-white/55 sm:text-xs md:block md:text-lg">
              Other Team
            </p>
            <p className="text-xs font-bold text-[#7dd3fc] md:mt-1 md:text-base">Games {theirGames}</p>
            <p className="font-display font-black leading-[0.86] text-[#f8fafc] md:mt-4 md:leading-[0.9]" style={scoreNumberStyle}>
              {pointDisplay(theirPoints)}
            </p>
          </div>
        </div>

        <div className="mx-auto grid w-full max-w-7xl grid-cols-4 gap-1 py-0 md:gap-4 md:py-5">
          {(['win', 'lose', 'undo', 'reset'] as const).map((action, index) => (
            <button
              key={action}
              type="button"
              disabled={matchEnded && action !== 'undo'}
              onClick={() => void applyFingerAction(action)}
              className={`flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-2xl border px-1 py-3 shadow-xl shadow-black/25 active:scale-[0.96] sm:gap-1 sm:py-3.5 md:flex-row md:gap-5 md:rounded-full md:px-7 md:py-7 ${
                action === 'win'
                  ? 'border-[#34d399]/45 bg-[#34d399]/15 text-[#34d399]'
                  : action === 'lose'
                    ? 'border-[#60a5fa]/45 bg-[#60a5fa]/15 text-[#60a5fa]'
                    : 'border-white/15 bg-[#11355c] text-[#7dd3fc]'
              }`}
            >
              <FingerCountIcon count={(index + 1) as 1 | 2 | 3 | 4} />
              <span className="text-[10px] font-black uppercase tracking-wide md:text-4xl">
                {action === 'win' ? 'Win' : action === 'lose' ? 'Lose' : action === 'undo' ? 'Undo' : 'Reset'}
              </span>
            </button>
          ))}
        </div>

        {error || syncError ? (
          <p className="mx-auto max-w-xl rounded-lg border border-[#60a5fa]/45 bg-[#60a5fa]/15 px-3 py-2 text-center text-sm font-bold text-[#60a5fa]">
            {syncError ?? error}
          </p>
        ) : null}
        {status === 'unsupported' ? (
          <p className="mx-auto max-w-xl rounded-lg border border-[#fbbf24]/45 bg-[#fbbf24]/15 px-3 py-2 text-center text-sm font-bold text-[#fde68a]">
            This browser does not support camera access.
          </p>
        ) : null}
      </section>
    </main>
  )
}
