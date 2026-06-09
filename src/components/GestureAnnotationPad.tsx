import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import type { CourtPlayer } from '../lib/americanoSchedule'
import {
  analyzeGesture,
  detectGestureShape,
  gestureLiveShotLabel,
  gestureShotLabel,
  shapeLabel,
} from '../lib/gestureAnalysis'
import {
  appendGestureDebugEntry,
  readGestureDebugLog,
  type GestureDebugEntry,
} from '../lib/gestureDebugLog'
import {
  captureGesture,
  clientToPadNormalized,
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
  pointExchangeHighlightClass,
  quadrantHighlightClass,
  serveFeedbackQuadrantClass,
} from '../lib/gestureFeedback'
import { CourtPositionSetup } from './CourtPositionSetup'
import { CourtServeSetup } from './CourtServeSetup'
import { GesturePadScoreboard } from './GesturePadScoreboard'
import { GesturePadMatchComplete } from './GesturePadMatchComplete'
import { PlayerGameStatsModal } from './PlayerGameStatsModal'
import { buildMatchPlayerStats, type PlayerGameStats } from '../lib/playerGameStats'
import {
  type PendingPointExchange,
  type PointExchangePhase,
  type PointExchangeState,
  tryBeginFoulPoint,
  tryBeginPointExchange,
  tryCompleteLoserTag,
} from '../lib/pointExchange'
import {
  serveGestureLabel,
  tryBeginAceServe,
} from '../lib/serveGesture'
import {
  attachLoserGestureToPoint,
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
  serveReceiveQuadrant,
  serverChipPlacement,
} from '../lib/serveRotation'
import type { CourtScoreSubmit } from '../lib/competitionScoreInput'
import type { MatchTeam } from '../lib/types'
import {
  COURT_QUADRANTS,
  dropHalfFromClient,
  isCompleteAssignment,
  loadCourtSetup,
  quadrantsForTeamPlacement,
  quadrantHalf,
  rosterFromQuadrants,
  saveCourtSetup,
  teamForQuadrant,
  teamsFromQuadrants,
  type CourtHalf,
  type CourtTeam,
  type SetupPhase,
} from '../lib/courtPositionSetup'
import { firstDisplayName } from '../lib/leaderboardEntries'
import { useGesturePadChrome } from '../lib/gesturePadChrome'
import type { QuadrantPlayers } from '../lib/gesturePadPlayers'
import {
  PADEL_CENTRAL_LINE_TOP_END_Y,
  PADEL_CENTRAL_SEGMENT_HEIGHT_BOTTOM,
  PADEL_CENTRAL_SEGMENT_HEIGHT_TOP,
  PADEL_HALF_INNER_END_BOTTOM_Y,
  PADEL_HALF_INNER_START_TOP_Y,
  PADEL_NET_Y,
  PADEL_SERVICE_LINE_BOTTOM_Y,
  PADEL_SERVICE_LINE_TOP_Y,
  pct,
} from '../lib/padelCourtLayout'

const COURT_INSET = 'inset-3 sm:inset-4'

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
        className="absolute inset-x-0 border-t border-dashed border-white/25"
        style={{ top: pct(PADEL_HALF_INNER_START_TOP_Y) }}
      />
      <div
        className="absolute inset-x-0 border-t border-dashed border-white/25"
        style={{ top: pct(PADEL_HALF_INNER_END_BOTTOM_Y) }}
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
  draggable = false,
}: {
  player: CourtPlayer
  isCurrent: boolean
  currentUserAvatarUrl?: string | null
  active: boolean
  serving?: boolean
  align: 'left' | 'right'
  draggable?: boolean
}) {
  const displayName = firstDisplayName(player.name.trim() || 'Player')
  const avatarUrl = player.avatarUrl ?? (isCurrent ? currentUserAvatarUrl : null)

  return (
    <div
      className={`flex h-10 max-w-[min(56vw,16rem)] items-center gap-2 truncate rounded-full border border-white/35 bg-black/35 py-0.5 pl-0.5 pr-3 text-white shadow-sm backdrop-blur-sm sm:h-11 sm:max-w-[16rem] sm:gap-2.5 sm:pr-3.5 ${
        align === 'right' ? 'flex-row-reverse' : ''
      } ${draggable ? 'cursor-grab ring-2 ring-white/50 active:cursor-grabbing' : ''} ${
        serving ? 'ring-2 ring-amber-300 shadow-[0_0_14px_rgba(252,211,77,0.55)]' : active ? 'ring-2 ring-white/90' : 'ring-1 ring-white/25'
      }`}
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

function DraggableGesturePadPlayerChip({
  player,
  quadrant,
  padRef,
  onSwapSide,
  isCurrent,
  currentUserAvatarUrl,
  active,
  serving = false,
  align,
}: {
  player: CourtPlayer
  quadrant: Quadrant
  padRef: RefObject<HTMLDivElement | null>
  onSwapSide: (quadrant: Quadrant, player: CourtPlayer, half: CourtHalf) => void
  isCurrent: boolean
  currentUserAvatarUrl?: string | null
  active: boolean
  serving?: boolean
  align: 'left' | 'right'
}) {
  const [dragging, setDragging] = useState(false)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const originRef = useRef<{ x: number; y: number } | null>(null)

  const finishDrag = (e: React.PointerEvent) => {
    if (!dragging) return
    e.stopPropagation()
    setDragging(false)
    setOffset({ x: 0, y: 0 })
    originRef.current = null

    const pad = padRef.current
    if (!pad) return
    onSwapSide(quadrant, player, dropHalfFromClient(e.clientX, e.clientY, pad))
  }

  return (
    <div
      className={`pointer-events-auto touch-none ${dragging ? 'z-30' : ''}`}
      style={dragging ? { transform: `translate(${offset.x}px, ${offset.y}px)` } : undefined}
      onPointerDown={(e) => {
        e.stopPropagation()
        e.currentTarget.setPointerCapture(e.pointerId)
        originRef.current = { x: e.clientX, y: e.clientY }
        setDragging(true)
      }}
      onPointerMove={(e) => {
        if (!dragging || !originRef.current) return
        e.stopPropagation()
        setOffset({
          x: e.clientX - originRef.current.x,
          y: e.clientY - originRef.current.y,
        })
      }}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
    >
      <GesturePadPlayerChip
        player={player}
        isCurrent={isCurrent}
        currentUserAvatarUrl={currentUserAvatarUrl}
        active={active}
        serving={serving}
        align={align}
        draggable={dragging}
      />
    </div>
  )
}

function liveReportLabel(
  path: NormalizedPoint[],
  activeQuadrant: Quadrant | null,
  serverQuadrant: Quadrant | null,
  exchangePhase: PointExchangePhase,
) {
  if (path.length < 2) return null
  const start = path[0]!
  const startQuadrant = activeQuadrant ?? quadrantFromPoint(start)
  const shape = detectGestureShape(path, startQuadrant)

  if (exchangePhase === 'await_loser') {
    if (path.length >= 2 && shape !== 'TAP') {
      const label = shapeLabel(shape)
      if (label !== 'Curve' && label !== 'Tap') return `${label}…`
      return 'Shot…'
    }
    return null
  }

  if (exchangePhase === 'idle' && serverQuadrant) {
    const serveLabel = serveGestureLabel(path, serverQuadrant)
    if (serveLabel) return `${serveLabel}…`
  }

  const label = gestureLiveShotLabel(path, startQuadrant)
  return label ? `${label}…` : null
}

function reportTone(report: string | null | undefined): string {
  if (!report) return 'text-white'
  if (report.includes('Foul')) return 'text-red-200'
  if (
    report.includes('Win') ||
    report.includes('Score') ||
    report.includes('Serve') ||
    report.includes('Smash') ||
    report.includes('Backhand') ||
    report.includes('Forehand') ||
    report.includes('Volley') ||
    report.includes('Lob')
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
  useGesturePadChrome()
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
  const [pointExchangePhase, setPointExchangePhase] = useState<PointExchangePhase>('idle')
  const [pendingPoint, setPendingPoint] = useState<PendingPointExchange | null>(null)
  const exchangeRef = useRef<PointExchangeState>({ phase: 'idle' })
  const [exchangeHint, setExchangeHint] = useState<string | null>(null)
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

  const applyScoredPoint = useCallback(
    (point: {
      winnerGestureId: string
      winnerQuadrant: Quadrant | ''
      loserQuadrant: Quadrant | ''
      winnerTeam: MatchTeam
      loserGestureId?: string
      isServe?: boolean
    }) => {
      setTennisScore((prev) => {
        const next = applyTennisPoint(prev, point.winnerTeam)
        if (courtSetupKey) {
          recordMatchPoint(courtSetupKey, {
            winnerGestureId: point.winnerGestureId,
            loserGestureId: point.loserGestureId ?? '',
            winnerQuadrant: point.winnerQuadrant,
            loserQuadrant: point.loserQuadrant,
            winner: point.winnerTeam,
            scoreAfter: next,
            isServe: point.isServe ?? false,
          })
        }
        persistSetup(next)
        return next
      })
    },
    [courtSetupKey, persistSetup],
  )

  const finishLoserTag = useCallback(
    (pending: PendingPointExchange, loserQuadrant: Quadrant, loserGestureId: string) => {
      if (courtSetupKey) {
        attachLoserGestureToPoint(
          courtSetupKey,
          pending.winnerGestureId,
          loserGestureId,
          loserQuadrant,
        )
      }
      exchangeRef.current = { phase: 'idle' }
      setPendingPoint(null)
      setPointExchangePhase('idle')
      setExchangeHint(null)
    },
    [courtSetupKey],
  )

  const beginAwaitLoser = useCallback((pending: PendingPointExchange) => {
    exchangeRef.current = { phase: 'await_loser', pending }
    setPendingPoint(pending)
    setPointExchangePhase('await_loser')
    setExchangeHint(null)
  }, [])

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

  const receiveQuadrant = useMemo(
    () => (activeServeQuadrant ? serveReceiveQuadrant(activeServeQuadrant) : null),
    [activeServeQuadrant],
  )

  const showMatchReady =
    (setupPhase === 'ready' || !needsSetup) && !matchComplete && Boolean(servingPlayerQuadrant)

  const showServeIndicators =
    showMatchReady &&
    pointExchangePhase === 'idle' &&
    activeServeQuadrant != null &&
    receiveQuadrant != null

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
    setExchangeHint(null)

    const point = clientToPadNormalized(clientX, clientY, pad)
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

    const point = clientToPadNormalized(clientX, clientY, pad)
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
      if (!matchComplete) {
        const exchange = exchangeRef.current

        if (exchange.phase === 'await_loser') {
          const done = tryCompleteLoserTag(
            analysis,
            entry,
            exchange.pending,
            captured.pathPoints,
          )
          if (!done.ok) {
            setExchangeHint(done.reason)
          } else {
            finishLoserTag(exchange.pending, done.loserQuadrant, done.loserGestureId)
          }
        } else {
          const ace =
            activeServeQuadrant != null
              ? tryBeginAceServe(captured.pathPoints, entry, activeServeQuadrant)
              : null
          if (ace?.ok) {
            applyScoredPoint({ ...ace.point, isServe: true })
            beginAwaitLoser(ace.pending)
          } else {
            const foul = tryBeginFoulPoint(analysis)
            if (foul.ok) {
              applyScoredPoint({
                winnerGestureId: entry.id,
                winnerQuadrant: '',
                loserQuadrant: foul.foulerQuadrant,
                loserGestureId: entry.id,
                winnerTeam: foul.winnerTeam,
              })
              setExchangeHint(null)
            } else {
              const began = tryBeginPointExchange(analysis, entry)
              if (!began.ok) {
                setExchangeHint(began.reason)
              } else {
                applyScoredPoint({
                  winnerGestureId: entry.id,
                  winnerQuadrant: began.pending.winnerQuadrant,
                  loserQuadrant: '',
                  winnerTeam: began.pending.winnerTeam,
                })
                beginAwaitLoser(began.pending)
              }
            }
          }
        }
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

  const handleSwapPlayerSide = useCallback(
    (fromQuadrant: Quadrant, player: CourtPlayer, half: CourtHalf) => {
      if (quadrantHalf(fromQuadrant) === half) return
      if (!isCompleteAssignment(roster, assignments)) return

      const complete = COURT_QUADRANTS.reduce(
        (acc, q) => {
          acc[q] = assignments[q]!
          return acc
        },
        {} as QuadrantPlayers,
      )
      const team = teamForQuadrant(fromQuadrant)
      const { teamA, teamB } = teamsFromQuadrants(complete)
      const pair = team === 'a' ? teamA : teamB
      const next = { ...complete, ...quadrantsForTeamPlacement(team, half, player, pair) }
      setAssignments(next)
      if (courtSetupKey && initialServeQuadrant) {
        saveCourtSetup(
          courtSetupKey,
          next,
          initialServeQuadrant,
          tennisScore,
          matchSubmitted,
          matchStartedAt ?? undefined,
        )
      }
    },
    [
      assignments,
      courtSetupKey,
      initialServeQuadrant,
      matchStartedAt,
      matchSubmitted,
      roster,
      tennisScore,
    ],
  )

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

  const liveLabel = isDrawing
    ? liveReportLabel(livePath, startQuadrant, activeServeQuadrant, pointExchangePhase)
    : null
  const resultLabel = lastAnalysis
    ? gestureShotLabel(lastAnalysis.shape, {
        smashVerdict: lastAnalysis.smashVerdict,
        lobVerdict: lastAnalysis.lobVerdict,
        volleyVerdict: lastAnalysis.volleyVerdict,
        startQuadrant: lastAnalysis.startQuadrant,
        start: lastAnalysis.start,
        end: lastAnalysis.end,
      })
    : null
  const awaitLoserCaption =
    pointExchangePhase === 'await_loser' && !isDrawing && !exchangeHint
      ? 'Tag the losing shot on the red side'
      : null
  const floatingLabel = liveLabel ?? resultLabel
  const floatingTone = reportTone(floatingLabel)
  const padCaption = exchangeHint ?? awaitLoserCaption ?? floatingLabel
  const padCaptionTone = exchangeHint ? 'text-red-200' : floatingTone

  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col">
      {(setupPhase === 'serve' || setupPhase === 'ready' || !needsSetup) ? (
        <div className="gesture-pad-header shrink-0 flex flex-col items-center gap-1 px-3 pb-2">
          <GesturePadScoreboard score={tennisScore} />
          {padCaption ? (
            <p
              className={`max-w-[92vw] truncate text-center text-xs font-semibold ${padCaptionTone} ${
                pulse ? 'scale-105' : ''
              } transition-transform`}
            >
              {padCaption}
            </p>
          ) : null}
        </div>
      ) : null}
      <div className="gesture-court-frame relative flex min-h-0 flex-1 flex-col">
      <div
        ref={padRef}
        className="gesture-court-pad relative touch-none select-none overflow-hidden bg-[#1a5fa8]"
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
                pointExchangePhase === 'await_loser' && pendingPoint
                  ? pointExchangeHighlightClass(
                      label,
                      pendingPoint.winnerTeam,
                      pendingPoint.loserTeam,
                      isDrawing,
                      startQuadrant,
                      activeQuadrant,
                    )
                  : showServeIndicators
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
        {showMatchReady ? (
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
                  <DraggableGesturePadPlayerChip
                    player={player}
                    quadrant={label}
                    padRef={padRef}
                    onSwapSide={handleSwapPlayerSide}
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
      </div>
      </div>
    </div>
  )
}
