import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CourtPlayer } from '../lib/americanoSchedule'
import {
  analyzeGesture,
  detectGestureShape,
  detectSmashVerdict,
  detectVolleyVerdict,
  gestureShotLabel,
} from '../lib/gestureAnalysis'
import {
  appendGestureDebugEntry,
  readGestureDebugLog,
  type GestureDebugEntry,
} from '../lib/gestureDebugLog'
import {
  captureGesture,
  clientToNormalized,
  drawGestureMarkers,
  drawGestureStroke,
  quadrantFromPoint,
  type CapturedGesture,
  type NormalizedPoint,
  type Quadrant,
} from '../lib/gestureCapture'
import {
  gestureHapticAnchor,
  gestureHapticComplete,
  gestureHapticQuadrantChange,
  gestureHapticStart,
  quadrantHighlightClass,
  serveFeedbackQuadrantClass,
} from '../lib/gestureFeedback'
import { CourtPositionSetup } from './CourtPositionSetup'
import { CourtServeSetup } from './CourtServeSetup'
import { GesturePadScoreboard } from './GesturePadScoreboard'
import { GesturePadMatchComplete } from './GesturePadMatchComplete'
import { PlayerGameStatsModal } from './PlayerGameStatsModal'
import { pointWinnerFromGesture } from '../lib/gestureScoring'
import { buildMatchPlayerStats, type PlayerGameStats } from '../lib/playerGameStats'
import {
  finalizeMatchSession,
  gesturesForSession,
  MATCH_PERSIST_TO_SERVER,
  recordMatchGesture,
  recordMatchPoint,
  ensureMatchSession,
} from '../lib/matchSessionLog'
import { saveFriendlyMatchLog } from '../lib/friendlyMatchServer'
import { isMatchComplete, matchWinner } from '../lib/matchFormat'
import { isFriendlySession, resetFriendlyMatchState } from '../lib/friendlyMatch'
import { applyTennisPoint, INITIAL_TENNIS_SCORE, type TennisScore } from '../lib/tennisScore'
import {
  currentServeSideQuadrant,
  currentServeQuadrant as resolveServeQuadrant,
  receiveBoxCenter,
  serveReceiveQuadrant,
  serverChipCoords,
  serverChipPlacement,
} from '../lib/serveRotation'
import type { CourtScoreSubmit } from '../lib/competitionScoreInput'
import {
  clearCourtPositions,
  COURT_QUADRANTS,
  isCompleteAssignment,
  loadCourtSetup,
  quadrantsForTeamPlacement,
  rosterFromQuadrants,
  saveCourtSetup,
  teamsFromQuadrants,
  type CourtHalf,
  type CourtTeam,
  type SetupPhase,
} from '../lib/courtPositionSetup'
import { firstDisplayName } from '../lib/leaderboardEntries'
import type { QuadrantPlayers } from '../lib/gesturePadPlayers'
import {
  PADEL_CENTRAL_LINE_TOP_END_Y,
  PADEL_CENTRAL_SEGMENT_HEIGHT_BOTTOM,
  PADEL_CENTRAL_SEGMENT_HEIGHT_TOP,
  PADEL_NET_Y,
  PADEL_SERVICE_LINE_BOTTOM_Y,
  PADEL_SERVICE_LINE_TOP_Y,
  courtShotZoneFromPoint,
  pct,
} from '../lib/padelCourtLayout'

const COURT_INSET = 'inset-3 sm:inset-4'

function ServeDirectionGuide({
  server,
  receive,
}: {
  server: Quadrant
  receive: Quadrant
}) {
  const from = serverChipCoords(server)
  const to = receiveBoxCenter(receive)
  const angleDeg = (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI

  return (
    <div
      className="pointer-events-none absolute z-[2]"
      style={{
        left: '50%',
        top: pct(PADEL_NET_Y),
        transform: `translate(-50%, -50%) rotate(${angleDeg}deg)`,
      }}
      aria-hidden
    >
      <svg width="46" height="26" viewBox="0 0 46 26" className="drop-shadow-sm">
        <path
          d="M5 13 H38 M30 5 L38 13 L30 21"
          fill="none"
          stroke="rgba(252,211,77,0.95)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  )
}

function PadelCourtMarkings() {
  return (
    <div className={`pointer-events-none absolute ${COURT_INSET}`} aria-hidden>
      <div className="absolute inset-0 rounded-sm border-[3px] border-white shadow-[inset_0_0_24px_rgba(0,0,0,0.12)]" />
      <div
        className="absolute inset-x-0 h-1.5 -translate-y-1/2 bg-white shadow-[0_0_0_1px_rgba(255,255,255,0.35)]"
        style={{ top: pct(PADEL_NET_Y) }}
      />
      <div
        className="absolute inset-x-0 h-px bg-white/75"
        style={{ top: pct(PADEL_SERVICE_LINE_TOP_Y) }}
      />
      <div
        className="absolute inset-x-0 h-px bg-white/75"
        style={{ top: pct(PADEL_SERVICE_LINE_BOTTOM_Y) }}
      />
      <div
        className="absolute w-0.5 -translate-x-1/2 bg-white/85"
        style={{
          left: '50%',
          top: pct(PADEL_CENTRAL_LINE_TOP_END_Y),
          height: pct(PADEL_CENTRAL_SEGMENT_HEIGHT_TOP),
        }}
      />
      <div
        className="absolute w-0.5 -translate-x-1/2 bg-white/85"
        style={{
          left: '50%',
          top: pct(PADEL_NET_Y),
          height: pct(PADEL_CENTRAL_SEGMENT_HEIGHT_BOTTOM),
        }}
      />
    </div>
  )
}

type Props = {
  competitionId?: string
  gameNumber?: string
  courtSetupKey?: string
  courtId?: string
  roundId?: string
  onGesture?: (gesture: CapturedGesture) => void
  onSubmitMatch?: (entry: CourtScoreSubmit) => Promise<void>
  onMatchClosed?: () => void
  quadrantPlayers?: QuadrantPlayers
  currentUserId?: string | null
  currentUserAvatarUrl?: string | null
  friendly?: boolean
}

const QUADRANT_LABELS: Quadrant[] = ['TL', 'TR', 'BL', 'BR']

const PAUSE_ANCHOR_MS = 25
/** Min screen distance between anchor dots (px). */
const ANCHOR_MIN_PX = 32

function pointDistPx(
  a: NormalizedPoint,
  b: NormalizedPoint,
  width: number,
  height: number,
): number {
  return Math.hypot((a.x - b.x) * width, (a.y - b.y) * height)
}

function anchorGapOk(
  from: NormalizedPoint,
  to: NormalizedPoint,
  width: number,
  height: number,
): boolean {
  return pointDistPx(from, to, width, height) >= ANCHOR_MIN_PX
}

const QUADRANT_CHIP_POS: Record<Quadrant, string> = {
  TL: 'top-3 left-3 items-start text-left sm:top-4 sm:left-4',
  TR: 'top-3 right-3 items-end text-right sm:top-4 sm:right-4',
  BL: 'bottom-3 left-3 items-start text-left sm:bottom-4 sm:left-4',
  BR: 'bottom-3 right-3 items-end text-right sm:bottom-4 sm:right-4',
}

const QUADRANT_CHIP_CORNER: Record<Quadrant, string> = {
  TL: 'left-0 top-0 items-start text-left',
  TR: 'right-0 top-0 items-end text-right',
  BL: 'left-0 bottom-0 items-start text-left',
  BR: 'right-0 bottom-0 items-end text-right',
}

function GesturePadPlayerChip({
  player,
  isCurrent,
  currentUserAvatarUrl,
  active,
  serving = false,
  align,
}: {
  player: CourtPlayer
  isCurrent: boolean
  currentUserAvatarUrl?: string | null
  active: boolean
  serving?: boolean
  align: 'left' | 'right'
}) {
  const displayName = firstDisplayName(player.name.trim() || 'Player')
  const avatarUrl = player.avatarUrl ?? (isCurrent ? currentUserAvatarUrl : null)

  return (
    <div
      className={`flex h-10 max-w-[min(56vw,16rem)] items-center gap-2 truncate rounded-full border border-white/35 bg-black/35 py-0.5 pl-0.5 pr-3 text-white shadow-sm backdrop-blur-sm sm:h-11 sm:max-w-[16rem] sm:gap-2.5 sm:pr-3.5 ${
        align === 'right' ? 'flex-row-reverse' : ''
      } ${serving ? 'ring-2 ring-amber-300 shadow-[0_0_14px_rgba(252,211,77,0.55)]' : active ? 'ring-2 ring-white/90' : 'ring-1 ring-white/25'}`}
      aria-label={displayName}
    >
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt=""
          className="h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-white/50 sm:h-9 sm:w-9"
        />
      ) : (
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/20 text-xs font-semibold text-white sm:h-9 sm:w-9 sm:text-sm">
          {displayName[0]?.toUpperCase() ?? '?'}
        </span>
      )}
      <span className="truncate text-xs font-semibold sm:text-sm">{displayName}</span>
    </div>
  )
}

function liveReportLabel(path: NormalizedPoint[], activeQuadrant: Quadrant | null) {
  if (path.length < 2) return null
  const start = path[0]!
  const end = path[path.length - 1]!
  const startQuadrant = activeQuadrant ?? quadrantFromPoint(start)
  const shape = detectGestureShape(path, startQuadrant)
  const label = gestureShotLabel(shape, {
    smashVerdict: shape === 'SMASH' ? detectSmashVerdict(start, end) : null,
    volleyVerdict: shape === 'VOLLEY' ? detectVolleyVerdict(path, end) : null,
    shotZone: courtShotZoneFromPoint(start, startQuadrant),
    start,
    end,
  })
  return label ? `${label}…` : null
}

function reportTone(report: string | null | undefined): string {
  if (!report) return 'text-white'
  if (report.includes('Foul')) return 'text-red-200'
  if (
    report.includes('Win') ||
    report.includes('Score') ||
    report.includes('Smash') ||
    report.includes('Backhand') ||
    report.includes('Forehand') ||
    report.includes('Volley')
  ) {
    return 'text-amber-100'
  }
  return 'text-white'
}

export function GestureAnnotationPad({
  competitionId,
  gameNumber,
  courtSetupKey,
  courtId,
  roundId,
  onGesture,
  onSubmitMatch,
  onMatchClosed,
  quadrantPlayers,
  currentUserId,
  currentUserAvatarUrl,
  friendly = false,
}: Props) {
  const isFriendly = friendly || isFriendlySession(courtSetupKey)
  const padRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sizeRef = useRef({ width: 0, height: 0 })
  const anchorsRef = useRef<NormalizedPoint[]>([])
  const liveTipRef = useRef<NormalizedPoint | null>(null)
  const pauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const drawingRef = useRef(false)
  const activeQuadrantRef = useRef<Quadrant | null>(null)
  const startedAtRef = useRef(0)

  const [lastAnalysis, setLastAnalysis] = useState<ReturnType<typeof analyzeGesture> | null>(null)
  const [, setDebugLog] = useState<GestureDebugEntry[]>(() => readGestureDebugLog())
  const [pulse, setPulse] = useState(false)
  const [isDrawing, setIsDrawing] = useState(false)
  const [startQuadrant, setStartQuadrant] = useState<Quadrant | null>(null)
  const [activeQuadrant, setActiveQuadrant] = useState<Quadrant | null>(null)
  const [livePath, setLivePath] = useState<NormalizedPoint[]>([])
  const [assignments, setAssignments] = useState<Partial<QuadrantPlayers>>({})
  const [setupPhase, setSetupPhase] = useState<SetupPhase>('ready')
  const [initialServeQuadrant, setInitialServeQuadrant] = useState<Quadrant | null>(null)
  const [tennisScore, setTennisScore] = useState<TennisScore>(INITIAL_TENNIS_SCORE)
  const [matchSubmitted, setMatchSubmitted] = useState(false)
  const [friendlyServerSaved, setFriendlyServerSaved] = useState(false)
  const [matchStartedAt, setMatchStartedAt] = useState<string | null>(null)
  const [submittingMatch, setSubmittingMatch] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [statsPlayer, setStatsPlayer] = useState<PlayerGameStats | null>(null)

  const padPlayers = useMemo(() => quadrantPlayers ?? {}, [quadrantPlayers])

  useEffect(() => {
    if (!isFriendly) return
    resetFriendlyMatchState(courtSetupKey)
  }, [isFriendly, courtSetupKey])

  const servingPlayerQuadrant = useMemo(() => {
    if (!initialServeQuadrant) return null
    return resolveServeQuadrant(tennisScore, initialServeQuadrant)
  }, [initialServeQuadrant, tennisScore])

  const activeServeQuadrant = useMemo(() => {
    if (!servingPlayerQuadrant) return null
    return currentServeSideQuadrant(tennisScore, servingPlayerQuadrant)
  }, [servingPlayerQuadrant, tennisScore])

  const roster = useMemo(() => rosterFromQuadrants(padPlayers), [padPlayers])

  const needsSetup = roster.length >= 4
  const matchComplete = isMatchComplete(tennisScore)
  const matchWinnerTeam = matchWinner(tennisScore)

  useEffect(() => {
    if (!needsSetup || !courtSetupKey) {
      setSetupPhase('ready')
      setInitialServeQuadrant(null)
      setTennisScore(INITIAL_TENNIS_SCORE)
      setMatchSubmitted(false)
      setMatchStartedAt(null)
      setSubmitError(null)
      setStatsPlayer(null)
      return
    }
    const saved = loadCourtSetup(courtSetupKey, roster)
    if (saved?.serveQuadrant) {
      setAssignments(saved.assignments)
      setInitialServeQuadrant(saved.serveQuadrant)
      setTennisScore(saved.score ?? INITIAL_TENNIS_SCORE)
      setMatchSubmitted(saved.matchSubmitted)
      setMatchStartedAt(saved.matchStartedAt)
      if (courtSetupKey && saved.matchStartedAt) {
        ensureMatchSession({
          id: courtSetupKey,
          competitionId,
          gameNumber,
          courtId,
          matchStartedAt: saved.matchStartedAt,
          isFriendly,
        })
      }
      setSetupPhase('ready')
    } else if (saved?.assignments) {
      setAssignments(saved.assignments)
      setInitialServeQuadrant(null)
      setTennisScore(INITIAL_TENNIS_SCORE)
      setSetupPhase('serve')
    } else {
      setAssignments({})
      setInitialServeQuadrant(null)
      setTennisScore(INITIAL_TENNIS_SCORE)
      setSetupPhase('positions')
    }
  }, [courtSetupKey, needsSetup, roster])

  const persistSetup = useCallback(
    (nextScore: TennisScore, submitted = matchSubmitted, startedAt = matchStartedAt) => {
      if (!courtSetupKey || !initialServeQuadrant || !isCompleteAssignment(roster, assignments)) return
      const complete = COURT_QUADRANTS.reduce(
        (acc, q) => {
          acc[q] = assignments[q]!
          return acc
        },
        {} as QuadrantPlayers,
      )
      saveCourtSetup(
        courtSetupKey,
        complete,
        initialServeQuadrant,
        nextScore,
        submitted,
        startedAt ?? undefined,
      )
    },
    [assignments, courtSetupKey, initialServeQuadrant, matchStartedAt, matchSubmitted, roster],
  )

  const matchPlayerStats = useMemo(() => {
    if (!matchComplete || !isCompleteAssignment(roster, assignments)) return []
    return buildMatchPlayerStats(
      readGestureDebugLog(),
      {
        competitionId,
        gameNumber,
        courtId,
        matchStartedAt: matchStartedAt ?? undefined,
        matchSessionId: courtSetupKey,
      },
      assignments as QuadrantPlayers,
    )
  }, [
    assignments,
    competitionId,
    courtId,
    gameNumber,
    matchComplete,
    matchStartedAt,
    roster,
  ])

  const submitMatchResult = useCallback(
    async (finalScore: TennisScore) => {
      if (matchSubmitted || !matchWinnerTeam) return
      setSubmittingMatch(true)
      setSubmitError(null)
      try {
        if (!isFriendly && MATCH_PERSIST_TO_SERVER && roundId && courtId && onSubmitMatch) {
          await onSubmitMatch({
            roundId,
            courtId,
            teamA: finalScore.gamesA,
            teamB: finalScore.gamesB,
          })
        }

        if (courtSetupKey) {
          const finalized = finalizeMatchSession({
            sessionId: courtSetupKey,
            finalScore,
            winner: matchWinnerTeam,
            isFriendly,
            playerStats: buildMatchPlayerStats(
              readGestureDebugLog(),
              {
                competitionId,
                gameNumber,
                courtId,
                matchStartedAt: matchStartedAt ?? undefined,
                matchSessionId: courtSetupKey,
              },
              assignments as QuadrantPlayers,
            ),
          })

          if (isFriendly && finalized) {
            const gestures = gesturesForSession(finalized, readGestureDebugLog())
            const { error: saveErr } = await saveFriendlyMatchLog(
              courtSetupKey,
              finalized,
              gestures,
            )
            if (saveErr) throw new Error(saveErr)
            setFriendlyServerSaved(true)
          }
        }

        setMatchSubmitted(true)
        persistSetup(finalScore, true)
      } catch (e) {
        setSubmitError(e instanceof Error ? e.message : 'Could not save score')
      } finally {
        setSubmittingMatch(false)
      }
    },
    [
      assignments,
      competitionId,
      courtId,
      courtSetupKey,
      gameNumber,
      isFriendly,
      matchStartedAt,
      matchSubmitted,
      matchWinnerTeam,
      onSubmitMatch,
      persistSetup,
      roundId,
      roster,
    ],
  )

  useEffect(() => {
    if (!matchComplete || matchSubmitted || submittingMatch || !matchWinnerTeam) return
    void submitMatchResult(tennisScore)
  }, [matchComplete, matchSubmitted, matchWinnerTeam, submittingMatch, submitMatchResult, tennisScore])

  const activePlayers = useMemo(() => {
    if (!needsSetup || setupPhase !== 'positions') {
      return isCompleteAssignment(roster, assignments)
        ? (assignments as QuadrantPlayers)
        : padPlayers
    }
    return padPlayers
  }, [assignments, needsSetup, padPlayers, roster, setupPhase])

  const showServeVisual =
    needsSetup &&
    setupPhase === 'ready' &&
    servingPlayerQuadrant != null &&
    activeServeQuadrant != null &&
    !matchComplete

  const receiveQuadrant = useMemo(
    () => (activeServeQuadrant ? serveReceiveQuadrant(activeServeQuadrant) : null),
    [activeServeQuadrant],
  )

  const playerNames = useMemo(() => {
    const names: Partial<Record<Quadrant, string>> = {}
    for (const quadrant of QUADRANT_LABELS) {
      const player = activePlayers?.[quadrant]
      if (player?.name) {
        names[quadrant] = player.name.trim()
      }
    }
    return names
  }, [activePlayers])

  const syncCanvasSize = useCallback(() => {
    const pad = padRef.current
    const canvas = canvasRef.current
    if (!pad || !canvas) return

    const rect = pad.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.floor(rect.width * dpr)
    canvas.height = Math.floor(rect.height * dpr)
    canvas.style.width = `${rect.width}px`
    canvas.style.height = `${rect.height}px`

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = 5
    ctx.strokeStyle = '#ffffff'

    sizeRef.current = { width: rect.width, height: rect.height }
  }, [])

  const displayPath = useCallback((): NormalizedPoint[] => {
    const anchors = anchorsRef.current
    const tip = liveTipRef.current
    if (!tip) return anchors
    const last = anchors[anchors.length - 1]
    if (last && last.x === tip.x && last.y === tip.y) return anchors
    return [...anchors, tip]
  }, [])

  const syncLivePath = useCallback(() => {
    setLivePath(displayPath())
  }, [displayPath])

  const redraw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const path = displayPath()
    const { width, height } = sizeRef.current
    ctx.clearRect(0, 0, width, height)
    drawGestureStroke(ctx, path, width, height)
    drawGestureMarkers(ctx, path, width, height)
  }, [displayPath])

  const clearPauseTimer = useCallback(() => {
    if (pauseTimerRef.current !== null) {
      clearTimeout(pauseTimerRef.current)
      pauseTimerRef.current = null
    }
  }, [])

  const commitAnchor = useCallback(() => {
    const tip = liveTipRef.current
    if (!tip || !drawingRef.current) return

    const { width, height } = sizeRef.current
    const anchors = anchorsRef.current
    const last = anchors[anchors.length - 1]
    if (last && !anchorGapOk(last, tip, width, height)) return

    anchorsRef.current = [...anchors, tip]
    gestureHapticAnchor()
    redraw()
    syncLivePath()
  }, [redraw, syncLivePath])

  const schedulePauseAnchor = useCallback(
    (tip: NormalizedPoint) => {
      const { width, height } = sizeRef.current
      const last = anchorsRef.current[anchorsRef.current.length - 1]
      if (last && !anchorGapOk(last, tip, width, height)) {
        clearPauseTimer()
        return
      }

      clearPauseTimer()
      pauseTimerRef.current = setTimeout(() => {
        pauseTimerRef.current = null
        commitAnchor()
      }, PAUSE_ANCHOR_MS)
    },
    [clearPauseTimer, commitAnchor],
  )

  const clearCanvas = useCallback(() => {
    anchorsRef.current = []
    liveTipRef.current = null
    clearPauseTimer()
    redraw()
  }, [clearPauseTimer, redraw])

  const resetLiveState = () => {
    setIsDrawing(false)
    setStartQuadrant(null)
    setActiveQuadrant(null)
    setLivePath([])
    activeQuadrantRef.current = null
  }

  const updateLiveQuadrants = (point: NormalizedPoint, isStart: boolean) => {
    const quadrant = quadrantFromPoint(point)
    if (isStart) {
      setStartQuadrant(quadrant)
      setActiveQuadrant(quadrant)
      activeQuadrantRef.current = quadrant
      return
    }

    setActiveQuadrant(quadrant)

    if (activeQuadrantRef.current && activeQuadrantRef.current !== quadrant) {
      gestureHapticQuadrantChange()
    }
    activeQuadrantRef.current = quadrant
  }

  useEffect(() => {
    syncCanvasSize()
    const pad = padRef.current
    if (!pad) return

    const observer = new ResizeObserver(() => syncCanvasSize())
    observer.observe(pad)
    return () => {
      observer.disconnect()
      clearPauseTimer()
    }
  }, [syncCanvasSize, clearPauseTimer])

  const pointerDown = (clientX: number, clientY: number) => {
    if (matchComplete) return
    if (needsSetup && setupPhase !== 'ready') return
    const pad = padRef.current
    if (!pad) return

    clearPauseTimer()
    drawingRef.current = true
    startedAtRef.current = performance.now()
    setIsDrawing(true)
    gestureHapticStart()

    const point = clientToNormalized(clientX, clientY, pad.getBoundingClientRect())
    anchorsRef.current = [point]
    liveTipRef.current = point
    setLivePath([point])
    updateLiveQuadrants(point, true)
    redraw()
  }

  const pointerMove = (clientX: number, clientY: number) => {
    if (!drawingRef.current) return
    const pad = padRef.current
    if (!pad) return

    const point = clientToNormalized(clientX, clientY, pad.getBoundingClientRect())
    const tip = liveTipRef.current
    if (tip && tip.x === point.x && tip.y === point.y) return

    liveTipRef.current = point
    updateLiveQuadrants(point, false)
    redraw()
    syncLivePath()
    schedulePauseAnchor(point)
  }

  const pointerUp = () => {
    if (!drawingRef.current) return
    drawingRef.current = false
    clearPauseTimer()

    const finalPath = displayPath()
    const captured = captureGesture(finalPath)
    clearCanvas()
    resetLiveState()

    if (!captured) return

    const durationMs = performance.now() - startedAtRef.current
    const analysis = analyzeGesture(captured, durationMs, { playerNames })
    const entry = appendGestureDebugEntry(analysis, {
      competitionId,
      gameNumber,
      courtId,
      matchSessionId: courtSetupKey,
    })
    if (courtSetupKey) recordMatchGesture(courtSetupKey, entry.id)

    if (setupPhase === 'ready' || !needsSetup) {
      const winner = pointWinnerFromGesture(analysis)
      if (winner && !matchComplete) {
        setTennisScore((prev) => {
          const next = applyTennisPoint(prev, winner)
          if (courtSetupKey) {
            recordMatchPoint(courtSetupKey, {
              gestureId: entry.id,
              winner,
              scoreAfter: next,
            })
          }
          persistSetup(next)
          return next
        })
      }
    }

    gestureHapticComplete()
    setLastAnalysis(analysis)
    setDebugLog((prev) => [entry, ...prev.filter((e) => e.id !== entry.id)].slice(0, 120))
    setPulse(true)
    window.setTimeout(() => setPulse(false), 450)
    onGesture?.(captured)
  }

  const handleAssignTeam = (team: CourtTeam, draggedPlayer: CourtPlayer, half: CourtHalf) => {
    const { teamA, teamB } = teamsFromQuadrants(padPlayers)
    const pair = team === 'a' ? teamA : teamB
    const placement = quadrantsForTeamPlacement(team, half, draggedPlayer, pair)
    setAssignments((prev) => ({ ...prev, ...placement }))
  }

  const handleConfirmPositions = () => {
    if (!isCompleteAssignment(roster, assignments)) return
    setSetupPhase('serve')
  }

  const handlePickServe = (quadrant: Quadrant) => {
    if (!isCompleteAssignment(roster, assignments)) return
    const complete = COURT_QUADRANTS.reduce(
      (acc, q) => {
        acc[q] = assignments[q]!
        return acc
      },
      {} as QuadrantPlayers,
    )
    const startedAt = new Date().toISOString()
    if (courtSetupKey) {
      saveCourtSetup(courtSetupKey, complete, quadrant, INITIAL_TENNIS_SCORE, false, startedAt)
      ensureMatchSession({
        id: courtSetupKey,
        competitionId,
        gameNumber,
        courtId,
        matchStartedAt: startedAt,
        isFriendly,
      })
    }
    setInitialServeQuadrant(quadrant)
    setMatchStartedAt(startedAt)
    setTennisScore(INITIAL_TENNIS_SCORE)
    setSetupPhase('ready')
  }

  const handleEditPositions = () => {
    if (courtSetupKey) clearCourtPositions(courtSetupKey)
    setAssignments({})
    setInitialServeQuadrant(null)
    setTennisScore(INITIAL_TENNIS_SCORE)
    setMatchSubmitted(false)
    setMatchStartedAt(null)
    setSubmitError(null)
    setStatsPlayer(null)
    setSetupPhase('positions')
    setLastAnalysis(null)
    clearCanvas()
    resetLiveState()
  }

  const liveLabel = isDrawing ? liveReportLabel(livePath, startQuadrant) : null
  const resultLabel = lastAnalysis
    ? gestureShotLabel(lastAnalysis.shape, {
        smashVerdict: lastAnalysis.smashVerdict,
        volleyVerdict: lastAnalysis.volleyVerdict,
        shotZone: lastAnalysis.shotZone,
        start: lastAnalysis.start,
        end: lastAnalysis.end,
      })
    : null
  const floatingLabel = liveLabel ?? resultLabel
  const floatingTone = reportTone(floatingLabel)

  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col">
      <div
        ref={padRef}
        className="relative h-full min-h-0 flex-1 touch-none select-none overflow-hidden bg-[#1a5fa8]"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          pointerDown(e.clientX, e.clientY)
        }}
        onPointerMove={(e) => pointerMove(e.clientX, e.clientY)}
        onPointerUp={(e) => {
          e.currentTarget.releasePointerCapture(e.pointerId)
          pointerUp()
        }}
        onPointerCancel={() => pointerUp()}
      >
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#1e6bb5] via-[#1a5fa8] to-[#165a9c]"
          aria-hidden
        />
        <PadelCourtMarkings />
        <div className="pointer-events-none absolute inset-0 z-[1] grid grid-cols-2 grid-rows-2">
          {QUADRANT_LABELS.map((label) => (
            <div
              key={label}
              className={
                showServeVisual && activeServeQuadrant && receiveQuadrant
                  ? serveFeedbackQuadrantClass(
                      label,
                      activeServeQuadrant,
                      receiveQuadrant,
                      isDrawing,
                      startQuadrant,
                      activeQuadrant,
                    )
                  : quadrantHighlightClass(label, startQuadrant, activeQuadrant, isDrawing)
              }
            />
          ))}
        </div>
        {needsSetup && setupPhase === 'positions' ? (
          <CourtPositionSetup
            quadrantPlayers={padPlayers}
            roster={roster}
            assignments={assignments}
            padRef={padRef}
            onAssignTeam={handleAssignTeam}
            onConfirmPositions={handleConfirmPositions}
          />
        ) : null}
        {needsSetup && setupPhase === 'serve' ? (
          <CourtServeSetup padRef={padRef} onPickServe={handlePickServe} />
        ) : null}
        {showServeVisual && activeServeQuadrant && receiveQuadrant ? (
          <div className={`pointer-events-none absolute ${COURT_INSET} z-[2]`}>
            <ServeDirectionGuide server={activeServeQuadrant} receive={receiveQuadrant} />
          </div>
        ) : null}
        {showServeVisual ? (
          <div className={`pointer-events-none absolute ${COURT_INSET} z-[3]`}>
            {QUADRANT_LABELS.map((label) => {
              const player = activePlayers?.[label]
              if (!player || !activeServeQuadrant || !servingPlayerQuadrant) return null
              const isServer = label === servingPlayerQuadrant
              const isActive = isDrawing && (label === startQuadrant || label === activeQuadrant)
              const serverPos = isServer ? serverChipPlacement(activeServeQuadrant) : null
              const chipAlign =
                isServer
                  ? activeServeQuadrant === 'TR' || activeServeQuadrant === 'BR'
                    ? 'right'
                    : 'left'
                  : label === 'TR' || label === 'BR'
                    ? 'right'
                    : 'left'
              return (
                <div
                  key={`chip-${label}`}
                  className={`absolute flex flex-col ${
                    isServer ? 'items-center' : QUADRANT_CHIP_CORNER[label]
                  }`}
                  style={
                    isServer && serverPos
                      ? {
                          top: serverPos.top,
                          left: serverPos.left,
                          transform: serverPos.transform,
                        }
                      : undefined
                  }
                >
                  <GesturePadPlayerChip
                    player={player}
                    isCurrent={Boolean(currentUserId && player.id === currentUserId)}
                    currentUserAvatarUrl={currentUserAvatarUrl}
                    active={isActive}
                    serving={isServer}
                    align={chipAlign}
                  />
                </div>
              )
            })}
          </div>
        ) : (
          QUADRANT_LABELS.map((label) => {
            if (needsSetup && setupPhase === 'positions') return null
            const player = activePlayers?.[label]
            if (!player) return null
            const isActive = isDrawing && (label === startQuadrant || label === activeQuadrant)
            return (
              <div
                key={`chip-${label}`}
                className={`pointer-events-none absolute z-[3] flex flex-col ${QUADRANT_CHIP_POS[label]}`}
              >
                <GesturePadPlayerChip
                  player={player}
                  isCurrent={Boolean(currentUserId && player.id === currentUserId)}
                  currentUserAvatarUrl={currentUserAvatarUrl}
                  active={isActive}
                  align={label === 'TR' || label === 'BR' ? 'right' : 'left'}
                />
              </div>
            )
          })
        )}
        <canvas ref={canvasRef} className="absolute inset-0 z-[2]" />

        <div className="pointer-events-none absolute inset-x-0 top-[max(0.5rem,env(safe-area-inset-top))] z-20 flex flex-col items-center px-3">
          {(setupPhase === 'serve' || setupPhase === 'ready' || !needsSetup) ? (
            <GesturePadScoreboard score={tennisScore} />
          ) : null}
        </div>

        {needsSetup && setupPhase === 'ready' ? (
          <button
            type="button"
            onClick={handleEditPositions}
            className="pointer-events-auto absolute right-3 top-[max(3.5rem,env(safe-area-inset-top))] z-20 rounded-full border border-white/35 bg-black/40 px-3 py-1 text-xs font-semibold text-white/90 backdrop-blur-sm sm:right-4"
          >
            Change
          </button>
        ) : null}

        {matchComplete && matchWinnerTeam ? (
          <GesturePadMatchComplete
            score={tennisScore}
            winner={matchWinnerTeam}
            submitting={submittingMatch}
            submitted={matchSubmitted}
            error={submitError}
            savedLocally={isFriendly ? !friendlyServerSaved : !MATCH_PERSIST_TO_SERVER}
            playerStats={matchPlayerStats}
            onSelectPlayer={setStatsPlayer}
            onClose={onMatchClosed}
          />
        ) : null}

        {statsPlayer ? (
          <PlayerGameStatsModal stats={statsPlayer} onClose={() => setStatsPlayer(null)} />
        ) : null}

        {floatingLabel ? (
          <div
            className={`pointer-events-none absolute left-1/2 z-[3] max-w-[92%] -translate-x-1/2 rounded-full bg-black/45 px-4 py-2 text-center font-display text-lg font-bold backdrop-blur-sm transition-transform ${
              needsSetup && setupPhase === 'ready'
                ? 'bottom-[max(3.25rem,env(safe-area-inset-bottom))]'
                : 'bottom-[max(1rem,env(safe-area-inset-bottom))]'
            } ${pulse ? 'scale-105' : ''} ${floatingTone}`}
          >
            {floatingLabel}
          </div>
        ) : null}
      </div>
    </div>
  )
}
