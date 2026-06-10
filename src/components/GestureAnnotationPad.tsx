import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import {
  analyzeGesture,
  idealizeGesturePath,
  lerpGesturePaths,
} from '../lib/gestureAnalysis'
import {
  appendGestureDebugEntry,
  readGestureDebugLog,
  type GestureDebugEntry,
} from '../lib/gestureDebugLog'
import {
  captureGesture,
  clientToPadNormalized,
  drawDimmedGesturePath,
  drawFreehandStroke,
  drawGestureMarkers,
  drawGestureShotLabel,
  drawGestureStroke,
  quadrantFromPoint,
  straightLinePath,
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
} from '../lib/gestureFeedback'
import { CourtPositionSetup } from './CourtPositionSetup'
import { CourtServeSetup } from './CourtServeSetup'
import { GesturePadGameLog } from './GesturePadGameLog'
import { GesturePadScoreboard } from './GesturePadScoreboard'
import { PadelCourtEnclosure } from './PadelCourtEnclosure'
import { GesturePadMatchComplete } from './GesturePadMatchComplete'
import { PlayerGameStatsModal } from './PlayerGameStatsModal'
import { PlayerShotOriginDrag, useCourtInset, type ShotOriginLock } from './PlayerShotOriginDrag'
import { HorizVerdictPrompt } from './HorizVerdictPrompt'
import { buildMatchPlayerStats, type PlayerGameStats } from '../lib/playerGameStats'
import {
  type PendingPointExchange,
  type PointExchangePhase,
  type PointExchangeState,
  tryBeginPointExchange,
  tryCompleteLoserTag,
} from '../lib/pointExchange'
import {
  buildServePath,
  classifyServeLandingInServePhase,
  isServeCrossCourtStroke,
  serveLandingPadPoint,
} from '../lib/serveGesture'
import {
  attachLoserGestureToPoint,
  chronologicalPointEvents,
  chronologicalSessionGestures,
  finalizeMatchSession,
  gesturesSinceLastPoint,
  loadMatchSession,
  deleteMatchSession,
  matchStatGestures,
  MATCH_PERSIST_TO_SERVER,
  recordMatchGesture,
  recordMatchPoint,
  ensureMatchSession,
  scoreBeforeChronologicalPoint,
  sessionGestureEntries,
  snapshotFromPlayerStats,
  startMatchSession,
  truncatePointEventsFrom,
} from '../lib/matchSessionLog'
import { buildGameLogPayload, fetchMatchGestureLog, upsertMatchGestureLog } from '../lib/matchLogServer'
import {
  applyRemoteLogToSession,
  buildSetupStateForSync,
  mergeServerLogIntoLocalCourt,
  restoreLiveMatchFromLocalStorage,
} from '../lib/matchReviewHydrate'
import { agentDebugIngest } from '../lib/debug/devDebug'
import { logPadUiSnapshot, logSetupStateWrite, logStateIngest } from '../lib/matchCourtStateDebug'
import { persistLocalSetupLog, type SetupLogStage } from '../lib/gameLogSetupState'
import { useCourtLive, type CourtLiveEphemeral } from '../hooks/useCourtLive'
import {
  applyLiveUndo,
  planLiveUndo,
  serveAttemptFromSession,
  truncateSessionGesturesFromPoint,
} from '../lib/matchScorerUndo'
import { resolveScoringIntent, type ScoringIntent } from '../lib/shotConfirm'
import {
  buildDraftFromHoriz,
  createHorizStrokeDraft,
  detectVerticalVerdictStroke,
  isIncompleteHorizontalStroke,
  type HorizStrokeDraft,
} from '../lib/multiStrokeShot'
import {
  captureGestureForActor,
  shotDrawMetaFromOrigin,
} from '../lib/courtHalfCapture'
import {
  enclosureZoneAtPad,
  enclosureZoneAtPadNorm,
  enclosureZoneAtCourtNorm,
  enclosureZoneKind,
  isGlassEnclosureZone,
  isVolleyZoneStart,
  measureCourtInset,
  padNormToCourtNorm,
  PADEL_NET_Y,
  PADEL_SERVICE_LINE_TOP_Y,
  PADEL_SERVICE_LINE_BOTTOM_Y,
  PADEL_ENCLOSURE_FULL_DEPTH_ALONG_LENGTH_FR,
  PADEL_ENCLOSURE_FULL_DEPTH_ALONG_WIDTH_FR,
  PADEL_ENCLOSURE_GLASS_DEPTH_ALONG_WIDTH_FR,
  type CourtInsetBounds,
  type CourtShotZone,
  type EnclosureZoneId,
  pct,
} from '../lib/padelCourtLayout'
import { isMatchComplete, matchWinner } from '../lib/matchFormat'
import { debugSessionLog, devDebugLog } from '../lib/debug/devDebug'
import { quadrantTeam } from '../lib/gestureScoring'
import { isFriendlySession, applyFriendlyPadReset } from '../lib/friendlyMatch'
import { applyTennisPoint, INITIAL_TENNIS_SCORE, type TennisScore } from '../lib/tennisScore'
import {
  currentServeSideQuadrant,
  currentServeQuadrant as resolveServeQuadrant,
  serveReceiveQuadrant,
  serviceBoxBounds,
  serveStartBoxBounds,
  partnerQuadrant,
} from '../lib/serveRotation'
import type { CourtScoreSubmit } from '../lib/competitionScoreInput'
import type { MatchTeam } from '../lib/types'
import {
  COURT_QUADRANTS,
  isCompleteAssignment,
  loadCourtSetup,
  clearCourtPositions,
  rosterFromQuadrants,
  saveCourtSetup,
  saveCourtSetupDraft,
  currentTeamToAssign,
  normalizeLoadedCourtSetup,
  teamsFromSessionRoster,
  playerKey,
  teamForQuadrant,
  teamIsPlaced,
  teamPlacementFromQuadrant,
  swapTeamPlacementSides,
  type CourtTeam,
  type LoadedCourtSetup,
  type SetupPhase,
} from '../lib/courtPositionSetup'
import {
  resolveBallPath,
  resolveGlassReboundPath,
  NET_HOVER_HOLD_MS,
  NET_SHORT_APPROACH_COURT,
  courtNormDistanceToNet,
  GLASS_FINISH_START_PAD_TOL,
} from '../lib/ballPathScoring'
import {
  defenderQuadrantForPath,
  wheelAnchor,
  type PendingBallPathExchange,
} from '../lib/ballPathExchange'
import { detectConfirmSwipe } from '../lib/shotConfirm'
import {
  rallyShotReport,
  type ShotWaveOption,
  type RallyShotPick,
} from '../lib/rallyShotWheel'
import { BallPathConfirmBar } from './BallPathConfirmBar'
import { GlassAnchorDrag } from './GlassAnchorDrag'
import { PadelCourtMarkings } from './PadelCourtMarkings'
import { RallyShotWheel } from './RallyShotWheel'
import { ShotDrawKey } from './ShotDrawKey'
import { useGesturePadChrome } from '../lib/gesturePadChrome'
import { useDeviceClass, useIsLandscape } from '../hooks/useDeviceClass'
import { useTranslation } from '../hooks/useTranslation'
import type { QuadrantPlayers } from '../lib/gesturePadPlayers'

function advanceBallPathPick(
  prev: PendingBallPathExchange,
  patch: Partial<PendingBallPathExchange>,
): PendingBallPathExchange {
  const next = { ...prev, ...patch }
  const bothReady =
    next.attackerShot != null &&
    next.attackerShotAngleDeg != null &&
    next.defenderShot != null &&
    next.defenderShotAngleDeg != null
  if (bothReady) {
    next.phase = 'confirm'
  }
  return next
}

// Court is height-led, so inset-y drives its actual size. Larger vertical inset
// shrinks the whole court, leaving margin above/below the baselines to draw
// "out" shots. Horizontal inset is symmetric so the court stays centered.
const COURT_INSET = 'inset-y-[13%] inset-x-[8%] sm:inset-y-[12%] sm:inset-x-[9%]'
/** FIP 10 m × 20 m interior — height-led aspect box inside the margin. */
const COURT_ASPECT_BOX = 'relative h-full max-w-full aspect-[10/20]'

type ShotRecord = {
  entryId: string
  analysis: ReturnType<typeof analyzeGesture>
  captured: CapturedGesture
  intent: ScoringIntent | null
  awaitLoser: boolean
  actorQuadrant?: Quadrant
  heatMapPoint?: GestureDebugEntry['heatMapPoint']
  heatMapStart?: GestureDebugEntry['heatMapStart']
  heatMapEnd?: GestureDebugEntry['heatMapEnd']
  heatMapPath?: GestureDebugEntry['heatMapPath']
  drawPath?: GestureDebugEntry['drawPath']
  shotOrigin?: GestureDebugEntry['shotOrigin']
  attackerShot?: GestureDebugEntry['attackerShot']
  defenderShot?: GestureDebugEntry['defenderShot']
  attackerWave?: GestureDebugEntry['attackerWave']
  defenderWave?: GestureDebugEntry['defenderWave']
  attackerPower?: GestureDebugEntry['attackerPower']
  defenderPower?: GestureDebugEntry['defenderPower']
}

function newGestureEntryId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
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
  /** Who is playing (no quadrant assignment). Overrides rosterFromQuadrants(padPlayers). */
  sessionRoster?: import('../lib/americanoSchedule').CourtPlayer[]
  currentUserId?: string | null
  currentUserAvatarUrl?: string | null
  friendly?: boolean
  endlessMatch?: boolean
  padResetAt?: string | null
  /** Open a concluded match read-only: side log on, no winner overlay, no input. */
  reviewMode?: boolean
  /** Bumped by the dashboard undo button to undo the last action. */
  undoSignal?: number
}

const QUADRANT_LABELS: Quadrant[] = ['TL', 'TR', 'BL', 'BR']

const PAUSE_ANCHOR_MS = 25
/** Min screen distance between anchor dots (px). */
const ANCHOR_MIN_PX = 32
/** Min screen distance between freehand samples (px). */
const FREEHAND_MIN_PX = 3
const FREEHAND_MAX_SAMPLES = 320
const CLEANUP_SNAP_MS = 380
const CLEANUP_HOLD_MS = 650
/** Min pad-space gap between consecutive wall-depth samples (ignore jitter). */
const GLASS_MIN_VERTEX_GAP = 0.012
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
  sessionRoster,
  currentUserId,
  currentUserAvatarUrl,
  friendly = false,
  endlessMatch = false,
  padResetAt = null,
  reviewMode = false,
  undoSignal = 0,
}: Props) {
  useGesturePadChrome()
  const { t } = useTranslation()
  const deviceClass = useDeviceClass()
  const isLandscape = useIsLandscape()
  const rotatePad = deviceClass === 'tablet' && isLandscape
  const isFriendly = friendly || isFriendlySession(courtSetupKey)
  const padRef = useRef<HTMLDivElement>(null)
  const courtInset = useCourtInset(padRef)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sizeRef = useRef({ width: 0, height: 0 })
  const anchorsRef = useRef<NormalizedPoint[]>([])
  const freehandRef = useRef<NormalizedPoint[]>([])
  const netHoverSinceRef = useRef<number | null>(null)
  const cleanupAnimRef = useRef<number | null>(null)
  const cleanupStateRef = useRef<{
    raw: NormalizedPoint[]
    ideal: NormalizedPoint[]
    label: string | null
    phase: 'snap' | 'hold'
    startedAt: number
  } | null>(null)
  const liveTipRef = useRef<NormalizedPoint | null>(null)
  const pauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const drawingRef = useRef(false)
  const activeQuadrantRef = useRef<Quadrant | null>(null)
  const startedAtRef = useRef(0)
  const pendingServeCanvasWipeRef = useRef(false)
  const suppressCanvasDrawRef = useRef(false)
  const redrawRef = useRef<() => void>(() => {})
  const [serveCanvasRev, setServeCanvasRev] = useState(0)

  const [, setDebugLog] = useState<GestureDebugEntry[]>(() => readGestureDebugLog())
  const [matchElapsed, setMatchElapsed] = useState('0:00')
  const [isDrawing, setIsDrawing] = useState(false)
  const [startQuadrant, setStartQuadrant] = useState<Quadrant | null>(null)
  const [activeQuadrant, setActiveQuadrant] = useState<Quadrant | null>(null)
  const [assignments, setAssignments] = useState<Partial<QuadrantPlayers>>({})
  const [pendingTeamPlacement, setPendingTeamPlacement] = useState<{
    team: CourtTeam
    placement: Partial<QuadrantPlayers>
  } | null>(null)
  const [setupPhase, setSetupPhase] = useState<SetupPhase>('positions')
  const [setupHydrated, setSetupHydrated] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  // Manual serve toggle — the user marks a stroke as a serve so it gets the
  // serve target/foul zones; otherwise the stroke is treated as a rally shot.
  const [serveMode, setServeMode] = useState(false)
  const serveModeRef = useRef(false)
  serveModeRef.current = serveMode
  const [pendingServeQuadrant, setPendingServeQuadrant] = useState<Quadrant | null>(null)
  const [initialServeQuadrant, setInitialServeQuadrant] = useState<Quadrant | null>(null)
  const [tennisScore, setTennisScore] = useState<TennisScore>(INITIAL_TENNIS_SCORE)
  const [matchSubmitted, setMatchSubmitted] = useState(false)
  const [pointExchangePhase, setPointExchangePhase] = useState<PointExchangePhase>('idle')
  const [pendingPoint, setPendingPoint] = useState<PendingPointExchange | null>(null)
  const exchangeRef = useRef<PointExchangeState>({ phase: 'idle' })
  const [matchLogSaved, setMatchLogSaved] = useState(false)
  const [matchStartedAt, setMatchStartedAt] = useState<string | null>(null)
  const [submittingMatch, setSubmittingMatch] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [statsPlayer, setStatsPlayer] = useState<PlayerGameStats | null>(null)
  const [reviewPointIndex, setReviewPointIndex] = useState<number | 'live'>('live')
  const [pointEventsVersion, setPointEventsVersion] = useState(0)
  const [pastServeThisPoint, setPastServeThisPoint] = useState(false)
  /** Live in/out feedback for the serve target while drawing (green = in). */
  const [, setServeLiveLanding] = useState<'in' | 'net' | 'out' | null>(null)
  // Attacker's half while a rally shot is actively being drawn (null = not drawing).
  // Drives the in/out + net guide zones, which only appear during the draw.
  const [rallyDrawHalf, setRallyDrawHalf] = useState<'top' | 'bottom' | null>(null)
  const [serveAttempt, setServeAttempt] = useState<1 | 2>(1)
  const serveAttemptRef = useRef<1 | 2>(1)
  const resetServeAttempt = useCallback(() => {
    serveAttemptRef.current = 1
    setServeAttempt(1)
  }, [])
  const advanceToSecondServe = useCallback(() => {
    serveAttemptRef.current = 2
    setServeAttempt(2)
  }, [])
  const [horizDraft, setHorizDraft] = useState<HorizStrokeDraft | null>(null)
  const horizDraftRef = useRef<HorizStrokeDraft | null>(null)
  horizDraftRef.current = horizDraft
  const [shotOriginLock, setShotOriginLock] = useState<ShotOriginLock | null>(null)
  const shotOriginLockRef = useRef<ShotOriginLock | null>(null)
  shotOriginLockRef.current = shotOriginLock
  const [coinPlacements, setCoinPlacements] = useState<Partial<Record<Quadrant, NormalizedPoint>>>({})
  const coinPlacementsRef = useRef(coinPlacements)
  coinPlacementsRef.current = coinPlacements
  const playerDragRef = useRef(false)
  const confirmStrokeRef = useRef(false)
  const confirmPointsRef = useRef<NormalizedPoint[]>([])
  const confirmStartedAtRef = useRef(0)
  const shotPickTapRef = useRef(0)
  const [pendingBallPath, setPendingBallPath] = useState<PendingBallPathExchange | null>(null)
  const [glassBandFeedback, setGlassBandFeedback] = useState<{
    start: EnclosureZoneId | null
    active: EnclosureZoneId | null
  }>({ start: null, active: null })
  const activeGlassBandRef = useRef<EnclosureZoneId | null>(null)
  const glassProbeSigRef = useRef<string>('')
  /** Committed rebound polyline vertices: [start, glassBounce1, …]. */
  const ballPathVerticesRef = useRef<NormalizedPoint[]>([])
  /** Glass band currently being tracked for a pending bounce. */
  const glassBandTrackRef = useRef<EnclosureZoneId | null>(null)
  /** Deepest (turn-around) glass contact in the tracked band so far. */
  const glassApexRef = useRef<NormalizedPoint | null>(null)
  /** Max wall-normal penetration depth (court units) of the current apex. */
  const glassApexDepthRef = useRef<number>(0)
  const pendingBallPathRef = useRef<PendingBallPathExchange | null>(null)
  pendingBallPathRef.current = pendingBallPath

  const resetCoinPlacements = useCallback(() => {
    setCoinPlacements({})
    coinPlacementsRef.current = {}
  }, [])

  const padPlayers = useMemo(() => quadrantPlayers ?? {}, [quadrantPlayers])

  const refreshPointEvents = useCallback(() => {
    setPointEventsVersion((v) => v + 1)
  }, [])

  const pointEventsChrono = useMemo(() => {
    if (!courtSetupKey) return []
    return chronologicalPointEvents(loadMatchSession(courtSetupKey))
  }, [courtSetupKey, pointEventsVersion, tennisScore])

  const sessionGestures = useMemo(() => {
    if (!courtSetupKey) return readGestureDebugLog()
    const session = loadMatchSession(courtSetupKey)
    if (!session) return []
    return sessionGestureEntries(session, readGestureDebugLog())
  }, [courtSetupKey, pointEventsVersion])

  // Live multi-device sync ("shared doc"): mirror committed points + broadcast
  // in-progress coin/exchange state. liveSuppress stops applied-remote echoes.
  const liveSuppressRef = useRef(false)

  const applyRemoteEphemeral = useCallback((payload: CourtLiveEphemeral) => {
    liveSuppressRef.current = true
    if (payload.coins) {
      setCoinPlacements((prev) => {
        const merged = { ...prev, ...payload.coins }
        coinPlacementsRef.current = merged
        return merged
      })
    }
    if (payload.pending !== undefined) {
      pendingBallPathRef.current = payload.pending
      setPendingBallPath(payload.pending)
    }
  }, [])

  const refreshFromServer = useCallback(async () => {
    if (!courtSetupKey) return
    const log = await fetchMatchGestureLog(courtSetupKey)
    if (!log) return
    const result = applyRemoteLogToSession(
      courtSetupKey,
      log,
      padPlayers as QuadrantPlayers,
    )
    if (!result.applied) return
    liveSuppressRef.current = true
    pendingBallPathRef.current = null
    setPendingBallPath(null)
    resetCoinPlacements()
    setTennisScore(result.score)
    serveAttemptRef.current = result.serveAttempt
    setServeAttempt(result.serveAttempt)
    setReviewPointIndex('live')
    refreshPointEvents()
  }, [courtSetupKey, refreshPointEvents, resetCoinPlacements])

  const { sendEphemeral } = useCourtLive(courtSetupKey, {
    enabled: Boolean(courtSetupKey) && !reviewMode,
    onEphemeral: applyRemoteEphemeral,
    onCommitted: () => void refreshFromServer(),
  })

  useEffect(() => {
    if (!courtSetupKey || reviewMode) return
    if (liveSuppressRef.current) {
      liveSuppressRef.current = false
      return
    }
    const hasCoins = Object.keys(coinPlacements).length > 0
    if (!hasCoins && !pendingBallPath) return
    sendEphemeral({
      ...(hasCoins ? { coins: coinPlacements } : {}),
      ...(pendingBallPath ? { pending: pendingBallPath } : {}),
    })
  }, [coinPlacements, pendingBallPath, courtSetupKey, reviewMode, sendEphemeral])

  const reviewingPoint = reviewPointIndex !== 'live'
  const reviewedEvent =
    typeof reviewPointIndex === 'number' ? (pointEventsChrono[reviewPointIndex] ?? null) : null
  const displayScore =
    reviewedEvent?.scoreAfter ??
    (typeof reviewPointIndex === 'number'
      ? scoreBeforeChronologicalPoint(pointEventsChrono, reviewPointIndex)
      : tennisScore)

  useEffect(() => {
    if (!matchStartedAt) {
      setMatchElapsed('0:00')
      return
    }
    const start = new Date(matchStartedAt).getTime()
    const tick = () => {
      const secs = Math.max(0, Math.floor((Date.now() - start) / 1000))
      const m = Math.floor(secs / 60)
      const s = secs % 60
      setMatchElapsed(`${m}:${s.toString().padStart(2, '0')}`)
    }
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [matchStartedAt])

  const servingPlayerQuadrant = useMemo(() => {
    if (!initialServeQuadrant) return null
    const score = reviewingPoint ? displayScore : tennisScore
    return resolveServeQuadrant(score, initialServeQuadrant)
  }, [initialServeQuadrant, tennisScore, displayScore, reviewingPoint])

  const activeServeQuadrant = useMemo(() => {
    if (!servingPlayerQuadrant) return null
    const score = reviewingPoint ? displayScore : tennisScore
    return currentServeSideQuadrant(score, servingPlayerQuadrant)
  }, [servingPlayerQuadrant, tennisScore, displayScore, reviewingPoint])

  const effectiveServeSideQuadrant = activeServeQuadrant

  const roster = useMemo(
    () =>
      sessionRoster && sessionRoster.length >= 4
        ? sessionRoster
        : rosterFromQuadrants(padPlayers),
    [padPlayers, sessionRoster],
  )

  const sessionTeams = useMemo(() => teamsFromSessionRoster(roster), [roster])

  const needsSetup = roster.length >= 4
  const matchComplete = isMatchComplete(tennisScore, { endless: endlessMatch })
  const matchWinnerTeam = matchWinner(tennisScore, { endless: endlessMatch })

  const applyLoadedSetup = useCallback(
    (saved: LoadedCourtSetup) => {
      const normalized =
        roster.length >= 4 ? normalizeLoadedCourtSetup(saved, roster) : saved
      const assignmentNames = Object.fromEntries(
        COURT_QUADRANTS.filter((q) => normalized.assignments[q]?.name?.trim()).map((q) => [
          q,
          normalized.assignments[q]!.name,
        ]),
      )
      logStateIngest('apply-loaded-setup', {
        setupPhase: normalized.setupPhase,
        assignments: assignmentNames,
        pendingTeam: Boolean(normalized.pendingTeamPlacement),
        matchStarted: Boolean(normalized.matchStartedAt),
      }, courtSetupKey)
      // #region agent log
      agentDebugIngest(
        'GestureAnnotationPad.tsx:applyLoadedSetup',
        'hydrate assignments into react state',
        {
          runId: 'post-fix',
          setupPhase: normalized.setupPhase,
          savedPhase: saved.setupPhase,
          assignmentCount: Object.keys(assignmentNames).length,
          assignments: assignmentNames,
          strippedFromSaved: Object.keys(
            Object.fromEntries(
              COURT_QUADRANTS.filter((q) => saved.assignments[q]?.name?.trim()).map((q) => [
                q,
                saved.assignments[q]!.name,
              ]),
            ),
          ).length - Object.keys(assignmentNames).length,
          pendingTeam: Boolean(normalized.pendingTeamPlacement),
          padPlayerSlots: Object.fromEntries(
            COURT_QUADRANTS.filter((q) => padPlayers[q]?.name?.trim()).map((q) => [q, padPlayers[q]!.name]),
          ),
        },
        normalized.setupPhase === 'positions' && Object.keys(assignmentNames).length > 0 ? 'A' : 'D',
      )
      // #endregion
      setAssignments(normalized.assignments)
      setPendingTeamPlacement(normalized.pendingTeamPlacement)
      setPendingServeQuadrant(normalized.pendingServeQuadrant)
      setSetupPhase(normalized.setupPhase)
      setInitialServeQuadrant(normalized.initialServeQuadrant)
      resetCoinPlacements()
      if (normalized.setupPhase === 'ready') {
        setTennisScore(normalized.score ?? INITIAL_TENNIS_SCORE)
        setMatchSubmitted(normalized.matchSubmitted)
        setMatchStartedAt(normalized.matchStartedAt)
        if (normalized.matchStartedAt && courtSetupKey) {
          ensureMatchSession({
            id: courtSetupKey,
            competitionId,
            gameNumber,
            courtId,
            matchStartedAt: normalized.matchStartedAt,
            isFriendly,
          })
        }
      } else {
        setTennisScore(INITIAL_TENNIS_SCORE)
        setMatchSubmitted(false)
        setMatchStartedAt(null)
      }
    },
    [competitionId, courtId, courtSetupKey, gameNumber, isFriendly, resetCoinPlacements, roster],
  )

  const rosterKey = roster.length >= 4 ? roster.map(playerKey).join('|') : ''

  useEffect(() => {
    if (!needsSetup || !courtSetupKey) {
      setSetupPhase('ready')
      setInitialServeQuadrant(null)
      setTennisScore(INITIAL_TENNIS_SCORE)
      setMatchSubmitted(false)
      setMatchStartedAt(null)
      setSubmitError(null)
      setStatsPlayer(null)
      setSetupHydrated(true)
      return
    }
    if (roster.length < 4) return

    let cancelled = false
    setSetupHydrated(false)

    void (async () => {
      if (padResetAt) {
        applyFriendlyPadReset(courtSetupKey, padResetAt)
      }

      let remoteSetupState = null
      if (!reviewMode) {
        const remoteLog = await fetchMatchGestureLog(courtSetupKey)
        if (cancelled) return
        // #region agent log
        agentDebugIngest(
          'GestureAnnotationPad.tsx:entryFetch',
          'remote log fetched on entry',
          {
            runId: 'persist-debug',
            hasRemoteLog: Boolean(remoteLog),
            remoteSetupPhase: remoteLog?.setupState?.setupPhase ?? null,
            remoteAssignmentKeys: remoteLog?.setupState
              ? Object.keys(remoteLog.setupState.assignments).filter(
                  (q) => remoteLog.setupState!.assignments[q as Quadrant]?.name?.trim(),
                )
              : [],
            remotePendingServe: remoteLog?.setupState?.pendingServeQuadrant ?? null,
            remoteUpdatedAt: remoteLog?.setupState?.updatedAt ?? remoteLog?.updatedAt ?? null,
            remoteSetupLogLen: remoteLog?.setupState?.setupLog?.length ?? 0,
            rosterLen: roster.length,
            rosterKeys: roster.map((p) => p.name?.trim()).filter(Boolean),
          },
          'C',
        )
        // #endregion
        // #region agent log
        const preMergeSession = loadMatchSession(courtSetupKey)
        agentDebugIngest(
          'GestureAnnotationPad.tsx:timelinePreMerge',
          'local timeline before merge',
          {
            runId: 'persist-debug',
            localPointEvents: preMergeSession?.pointEvents.length ?? 0,
            localGestureIds: preMergeSession?.gestureIds.length ?? 0,
            remotePointEvents: remoteLog?.pointEvents.length ?? 0,
            remoteGestures: remoteLog?.gestures.length ?? 0,
          },
          'F',
        )
        // #endregion
        if (remoteLog && roster.length >= 4) {
          mergeServerLogIntoLocalCourt(
            courtSetupKey,
            remoteLog,
            padPlayers as QuadrantPlayers,
          )
          remoteSetupState = remoteLog.setupState
        }
      }

      const saved = loadCourtSetup(courtSetupKey, roster)
      if (cancelled) return
      // #region agent log
      const postMergeSession = loadMatchSession(courtSetupKey)
      agentDebugIngest(
        'GestureAnnotationPad.tsx:timelinePostMerge',
        'local timeline after merge (feeds left log)',
        {
          runId: 'persist-debug',
          pointEvents: postMergeSession?.pointEvents.length ?? 0,
          gestureIds: postMergeSession?.gestureIds.length ?? 0,
          gestureEntries: postMergeSession?.gestureEntries?.length ?? 0,
          savedPhase: saved?.setupPhase ?? null,
        },
        'F',
      )
      // #endregion

      logStateIngest('hydrate-local-after-merge', {
        hasLocal: Boolean(saved),
        setupPhase: saved?.setupPhase,
      }, courtSetupKey)

      if (saved) {
        applyLoadedSetup(saved)
        const session = loadMatchSession(courtSetupKey)
        if (session?.pointEvents.length) {
          const live = restoreLiveMatchFromLocalStorage(courtSetupKey, remoteSetupState)
          setTennisScore(live.score)
          serveAttemptRef.current = live.serveAttempt
          setServeAttempt(live.serveAttempt)
        }
        setReviewPointIndex('live')
        refreshPointEvents()
      } else {
        setAssignments({})
        setPendingTeamPlacement(null)
        setInitialServeQuadrant(null)
        setPendingServeQuadrant(null)
        setTennisScore(INITIAL_TENNIS_SCORE)
        setMatchSubmitted(false)
        setMatchStartedAt(null)
        setSetupPhase('positions')
      }
      setSubmitError(null)
      setStatsPlayer(null)
      setSetupHydrated(true)
    })()

    return () => {
      cancelled = true
    }
  }, [
    applyLoadedSetup,
    courtSetupKey,
    gameNumber,
    courtId,
    competitionId,
    isFriendly,
    needsSetup,
    padResetAt,
    padPlayers,
    reviewMode,
    roster,
    rosterKey,
    refreshPointEvents,
  ])

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
      setReviewPointIndex('live')
      refreshPointEvents()
    },
    [courtSetupKey, persistSetup, refreshPointEvents],
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
      setPastServeThisPoint(false)
      resetServeAttempt()
      resetCoinPlacements()
      refreshPointEvents()
    },
    [courtSetupKey, refreshPointEvents, resetCoinPlacements, resetServeAttempt],
  )

  const beginAwaitLoser = useCallback((pending: PendingPointExchange) => {
    exchangeRef.current = { phase: 'await_loser', pending }
    setPendingPoint(pending)
    setPointExchangePhase('await_loser')
    setPastServeThisPoint(true)
  }, [])

  const statsAssignments = useMemo((): QuadrantPlayers | null => {
    if (!isCompleteAssignment(roster, assignments)) return null
    return assignments as QuadrantPlayers
  }, [assignments, roster])

  const buildCurrentMatchStats = useCallback(() => {
    if (!statsAssignments) return []
    const all = readGestureDebugLog()
    const filter = {
      competitionId,
      gameNumber,
      courtId,
      matchStartedAt: matchStartedAt ?? undefined,
      matchSessionId: courtSetupKey,
    }
    return buildMatchPlayerStats(
      all,
      filter,
      statsAssignments,
      matchStatGestures(courtSetupKey, all),
    )
  }, [
    competitionId,
    courtId,
    courtSetupKey,
    gameNumber,
    matchStartedAt,
    statsAssignments,
  ])

  const matchPlayerStats = useMemo(() => {
    if (!matchComplete || !statsAssignments) return []
    return buildCurrentMatchStats()
  }, [buildCurrentMatchStats, matchComplete, pointEventsVersion, statsAssignments, tennisScore])

  const syncMatchLogToServer = useCallback(async (opts?: {
    logStage?: SetupLogStage
    setup?: Parameters<typeof buildSetupStateForSync>[2]
  }) => {
    if (!courtSetupKey || roster.length < 4) return { error: 'No session' as const }
    const rosterForLog = statsAssignments
    const session = loadMatchSession(courtSetupKey) ?? {
      id: courtSetupKey,
      competitionId,
      gameNumber,
      courtId,
      matchStartedAt: matchStartedAt ?? new Date().toISOString(),
      gestureIds: [],
      pointEvents: [],
      savedLocally: false,
      isFriendly,
    }
    const gestures = session.gestureIds.length
      ? sessionGestureEntries(session, readGestureDebugLog())
      : []
    const playerStats = buildCurrentMatchStats().map(snapshotFromPlayerStats)
    const setupState =
      buildSetupStateForSync(courtSetupKey, roster, {
        assignments,
        setupPhase,
        pendingTeamPlacement,
        pendingServeQuadrant,
        initialServeQuadrant,
        score: tennisScore,
        matchSubmitted,
        matchStartedAt,
        serveAttempt: serveAttemptRef.current,
        ...opts?.setup,
        logStage: opts?.logStage,
      }) ?? undefined
    if (setupState?.setupLog?.length) {
      persistLocalSetupLog(courtSetupKey, setupState.setupLog)
    }
    logSetupStateWrite(courtSetupKey, setupState, 'syncMatchLogToServer')
    const payload = buildGameLogPayload(
      courtSetupKey,
      { ...session, playerStats },
      gestures,
      rosterForLog,
      { isFriendly, competitionId, gameNumber, courtId, setupState },
    )
    const upsertResult = await upsertMatchGestureLog(payload)
    // #region agent log
    agentDebugIngest(
      'GestureAnnotationPad.tsx:syncMatchLogToServer',
      'setup_state written to DB',
      {
        runId: 'persist-debug',
        requestedLogStage: opts?.logStage ?? null,
        inputPhase: setupPhase,
        inputAssignmentCount: COURT_QUADRANTS.filter((q) => assignments[q]?.name?.trim()).length,
        builtSetupPhase: setupState?.setupPhase ?? null,
        builtAssignmentKeys: setupState
          ? Object.keys(setupState.assignments).filter((q) => setupState.assignments[q as Quadrant]?.name?.trim())
          : [],
        builtPendingServe: setupState?.pendingServeQuadrant ?? null,
        builtServeQuadrant: setupState?.serveQuadrant ?? null,
        setupLogLen: setupState?.setupLog?.length ?? 0,
        rosterForLogLen: rosterForLog ? Object.keys(rosterForLog).length : 0,
        upsertError: upsertResult.error,
      },
      upsertResult.error ? 'E' : 'A',
    )
    // #endregion
    return upsertResult
  }, [
    assignments,
    buildCurrentMatchStats,
    competitionId,
    courtId,
    courtSetupKey,
    gameNumber,
    initialServeQuadrant,
    isFriendly,
    matchStartedAt,
    matchSubmitted,
    pendingServeQuadrant,
    pendingTeamPlacement,
    roster,
    setupPhase,
    statsAssignments,
    tennisScore,
  ])

  const handleResetCourt = useCallback(async () => {
    if (!courtSetupKey) return
    // Reset the shared server log back to an empty positions setup so the reload
    // (and any other device on this court) starts fresh from player setup.
    try {
      await upsertMatchGestureLog(
        buildGameLogPayload(
          courtSetupKey,
          {
            id: courtSetupKey,
            competitionId,
            gameNumber,
            courtId,
            matchStartedAt: new Date().toISOString(),
            gestureIds: [],
            pointEvents: [],
            savedLocally: false,
            isFriendly,
          },
          [],
          null,
          { isFriendly, competitionId, gameNumber, courtId },
        ),
      )
    } catch {
      /* ignore — still clear locally */
    }
    clearCourtPositions(courtSetupKey)
    deleteMatchSession(courtSetupKey)
    window.location.reload()
  }, [courtSetupKey, competitionId, gameNumber, courtId, isFriendly])

  useEffect(() => {
    if (!setupHydrated || !courtSetupKey || !needsSetup || setupPhase === 'ready') return
    saveCourtSetupDraft(
      courtSetupKey,
      {
        assignments,
        setupPhase,
        pendingTeamPlacement,
        pendingServeQuadrant,
      },
      roster,
    )
    void syncMatchLogToServer({ logStage: 'player_positions' })
  }, [
    assignments,
    courtSetupKey,
    needsSetup,
    pendingServeQuadrant,
    pendingTeamPlacement,
    setupHydrated,
    setupPhase,
    syncMatchLogToServer,
  ])

  const commitGestureRecording = useCallback(
    (pending: ShotRecord) => {
      const omitPath =
        pending.intent?.kind === 'serve_in' ||
        pending.intent?.kind === 'second_serve' ||
        pending.analysis.shapeLabel === 'Serve'
      const entry = appendGestureDebugEntry(
        {
          ...pending.analysis,
          ...(pending.actorQuadrant ? { actorQuadrant: pending.actorQuadrant } : {}),
          ...(pending.heatMapPoint ? { heatMapPoint: pending.heatMapPoint } : {}),
          ...(pending.heatMapStart ? { heatMapStart: pending.heatMapStart } : {}),
          ...(pending.heatMapEnd ? { heatMapEnd: pending.heatMapEnd } : {}),
          ...(!omitPath && pending.heatMapPath?.length
            ? { heatMapPath: pending.heatMapPath }
            : {}),
          ...(!omitPath && pending.drawPath?.length ? { drawPath: pending.drawPath } : {}),
          ...(pending.shotOrigin ? { shotOrigin: pending.shotOrigin } : {}),
          ...(pending.attackerShot ? { attackerShot: pending.attackerShot } : {}),
          ...(pending.defenderShot ? { defenderShot: pending.defenderShot } : {}),
          ...(pending.attackerWave ? { attackerWave: pending.attackerWave } : {}),
          ...(pending.defenderWave ? { defenderWave: pending.defenderWave } : {}),
          ...(pending.attackerPower != null ? { attackerPower: pending.attackerPower } : {}),
          ...(pending.defenderPower != null ? { defenderPower: pending.defenderPower } : {}),
          ...(pending.intent?.kind === 'second_serve' ||
          pending.intent?.kind === 'serve_in' ||
          pending.intent?.kind === 'foul'
            ? { scoringIntent: pending.intent.kind }
            : {}),
        },
        {
          competitionId,
          gameNumber,
          courtId,
          matchSessionId: courtSetupKey,
        },
        pending.entryId,
      )
      if (courtSetupKey) {
        if (!loadMatchSession(courtSetupKey)) {
          const startedAt = matchStartedAt ?? new Date().toISOString()
          ensureMatchSession({
            id: courtSetupKey,
            competitionId,
            gameNumber,
            courtId,
            matchStartedAt: startedAt,
            isFriendly,
          })
          if (!matchStartedAt) setMatchStartedAt(startedAt)
        }
        recordMatchGesture(courtSetupKey, entry.id, entry)
      }
      gestureHapticComplete()
      setDebugLog((prev) => [entry, ...prev.filter((e) => e.id !== entry.id)].slice(0, 120))
      onGesture?.(pending.captured)
      return entry
    },
    [
      competitionId,
      courtId,
      courtSetupKey,
      gameNumber,
      isFriendly,
      matchStartedAt,
      onGesture,
    ],
  )

  const applyScoringIntent = useCallback(
    (intent: ScoringIntent, entryId: string) => {
      if (intent.kind === 'serve_in') {
        // Ace: a serve landing in the box scores immediately for the serving team.
        const serverTeam = servingPlayerQuadrant
          ? quadrantTeam(servingPlayerQuadrant)
          : 'a'
        applyScoredPoint({
          winnerGestureId: entryId,
          winnerQuadrant: servingPlayerQuadrant ?? '',
          loserQuadrant: '',
          winnerTeam: serverTeam,
          isServe: true,
        })
        setPastServeThisPoint(false)
        resetServeAttempt()
        resetCoinPlacements()
        setShotOriginLock(null)
        shotOriginLockRef.current = null
        void syncMatchLogToServer()
        return
      }
      if (intent.kind === 'second_serve') {
        advanceToSecondServe()
        setShotOriginLock(null)
        shotOriginLockRef.current = null
        return
      }
      if (intent.kind === 'ball_path_score') {
        applyScoredPoint({
          winnerGestureId: entryId,
          winnerQuadrant: intent.winnerQuadrant,
          loserQuadrant: intent.loserQuadrant,
          winnerTeam: intent.winnerTeam,
        })
        setPastServeThisPoint(false)
        resetServeAttempt()
        resetCoinPlacements()
        void syncMatchLogToServer()
        return
      }
      if (intent.kind === 'foul') {
        applyScoredPoint({
          winnerGestureId: entryId,
          winnerQuadrant: '',
          loserQuadrant: intent.foulerQuadrant,
          loserGestureId: entryId,
          winnerTeam: intent.winnerTeam,
          isServe: intent.isServe ?? false,
        })
        setPastServeThisPoint(false)
        resetServeAttempt()
        resetCoinPlacements()
        void syncMatchLogToServer()
        return
      }
      applyScoredPoint({
        winnerGestureId: entryId,
        winnerQuadrant: intent.pending.winnerQuadrant,
        loserQuadrant: '',
        winnerTeam: intent.pending.winnerTeam,
      })
      beginAwaitLoser(intent.pending)
    },
    [activeServeQuadrant, applyScoredPoint, advanceToSecondServe, beginAwaitLoser, resetCoinPlacements, resetServeAttempt, servingPlayerQuadrant, syncMatchLogToServer, tennisScore],
  )

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
          finalizeMatchSession({
            sessionId: courtSetupKey,
            finalScore,
            winner: matchWinnerTeam,
            isFriendly,
            playerStats: buildCurrentMatchStats(),
          })

          const { error: saveErr } = await syncMatchLogToServer()
          if (saveErr) {
            console.warn('syncMatchLogToServer', saveErr)
            setMatchLogSaved(false)
          } else {
            setMatchLogSaved(true)
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
      buildCurrentMatchStats,
      courtSetupKey,
      courtId,
      isFriendly,
      matchSubmitted,
      matchWinnerTeam,
      onSubmitMatch,
      persistSetup,
      roundId,
      syncMatchLogToServer,
    ],
  )

  useEffect(() => {
    if (reviewMode || !matchComplete || matchSubmitted || submittingMatch || !matchWinnerTeam) return
    void submitMatchResult(tennisScore)
  }, [reviewMode, matchComplete, matchSubmitted, matchWinnerTeam, submittingMatch, submitMatchResult, tennisScore])

  const activePlayers = useMemo(() => {
    if (needsSetup && setupPhase === 'positions') {
      return null
    }
    if (isCompleteAssignment(roster, assignments)) {
      return assignments as QuadrantPlayers
    }
    return needsSetup ? null : padPlayers
  }, [assignments, needsSetup, padPlayers, roster, setupPhase])

  const watermarkPlayers = useMemo((): QuadrantPlayers | null => {
    if (isCompleteAssignment(roster, assignments)) {
      return assignments as QuadrantPlayers
    }
    if (!needsSetup) {
      const players = padPlayers as QuadrantPlayers
      if (COURT_QUADRANTS.every((q) => players[q]?.name)) return players
    }
    return null
  }, [assignments, needsSetup, padPlayers, roster])

  const showQuadrantWatermarks = setupPhase !== 'positions' && watermarkPlayers !== null

  const showPlayerActorPick =
    showQuadrantWatermarks &&
    (setupPhase === 'ready' || !needsSetup) &&
    !matchComplete &&
    reviewPointIndex === 'live'

  const horizVerdictLabel = horizDraft
    ? t('pad.horiz.directionSet', {
        stroke:
          horizDraft.shape === 'BACKHAND'
            ? t('pad.horiz.backhand')
            : t('pad.horiz.forehand'),
        volley: horizDraft.innerZone ? t('pad.horiz.volley') : '',
      })
    : null

  const receiveQuadrant = useMemo(
    () =>
      effectiveServeSideQuadrant ? serveReceiveQuadrant(effectiveServeSideQuadrant) : null,
    [effectiveServeSideQuadrant],
  )

  const showMatchReady =
    (setupPhase === 'ready' || !needsSetup) &&
    !matchComplete &&
    !reviewMode &&
    Boolean(servingPlayerQuadrant)

  const showServeIndicators =
    showMatchReady &&
    pointExchangePhase === 'idle' &&
    activeServeQuadrant != null &&
    receiveQuadrant != null

  const servePending = showServeIndicators && !reviewingPoint && !pastServeThisPoint
  const servePendingRef = useRef(false)
  servePendingRef.current = servePending

  const inBallPathExchange = pendingBallPath != null
  const serveUiActive = servePending && !inBallPathExchange

  // #region agent log
  useEffect(() => {
    if (!courtSetupKey || !setupHydrated) return
    const session = loadMatchSession(courtSetupKey)
    const allGestures = readGestureDebugLog()
    const derived = serveAttemptFromSession(session, allGestures)
    const pending = gesturesSinceLastPoint(
      chronologicalSessionGestures(session, allGestures),
      chronologicalPointEvents(session),
    )
    agentDebugIngest(
      'GestureAnnotationPad.tsx:serveAttemptConflict',
      'coin serveAttempt vs session-derived',
      {
        runId: 'serve-debug',
        coinServeAttempt: serveAttempt,
        refServeAttempt: serveAttemptRef.current,
        sessionDerivedAttempt: derived,
        serveUiActive,
        pastServeThisPoint,
        conflict: serveUiActive && serveAttempt !== derived,
        pendingIntents: pending.map((g) => g.scoringIntent ?? g.report ?? g.shapeLabel ?? '?'),
        pendingCount: pending.length,
      },
      serveUiActive && serveAttempt !== derived ? 'SERVE-CONFLICT' : 'SERVE-OK',
    )
  }, [serveAttempt, serveUiActive, pastServeThisPoint, pointEventsVersion, courtSetupKey, setupHydrated])
  // #endregion

  const ballPathGlassFinish = pendingBallPath?.phase === 'glass_finish'
  const ballPathRally =
    !reviewingPoint &&
    !matchComplete &&
    (setupPhase === 'ready' || !needsSetup) &&
    pointExchangePhase === 'idle' &&
    (!pendingBallPath || ballPathGlassFinish)
  const lockedGlassZone = useMemo(() => {
    if (!ballPathGlassFinish || !courtInset || !pendingBallPath) return null
    const anchor =
      pendingBallPath.glassAnchorPad ??
      pendingBallPath.line[pendingBallPath.line.length - 1]
    if (!anchor) return null
    return enclosureZoneAtPad(anchor, courtInset)
  }, [ballPathGlassFinish, courtInset, pendingBallPath])
  const enclosureHighlightOn =
    (isDrawing && (ballPathRally || ballPathGlassFinish)) || ballPathGlassFinish
  const enclosureStartBand = glassBandFeedback.start ?? lockedGlassZone
  const enclosureActiveBand =
    isDrawing && glassBandFeedback.active != null
      ? glassBandFeedback.active
      : (lockedGlassZone ?? glassBandFeedback.active)
  const courtActiveQuadrant =
    isDrawing &&
    (ballPathRally || ballPathGlassFinish) &&
    enclosureActiveBand != null
      ? null
      : activeQuadrant
  const ballPathRallyRef = useRef(false)
  ballPathRallyRef.current = ballPathRally

  // #region agent log
  useEffect(() => {
    if (!enclosureHighlightOn || !enclosureActiveBand) return
    const pad = padRef.current
    if (!pad) return
    const id = requestAnimationFrame(() => {
      const el = pad.querySelector(
        `[data-glass-band="${enclosureActiveBand}"]`,
      ) as HTMLElement | null
      if (!el) {
        debugSessionLog(
          'GestureAnnotationPad.tsx:glassRenderProbe',
          'glass band element NOT FOUND',
          { hypothesisId: 'G2-render', zone: enclosureActiveBand },
          'GLASS-RENDER',
        )
        return
      }
      const cs = getComputedStyle(el)
      const rect = el.getBoundingClientRect()
      debugSessionLog(
        'GestureAnnotationPad.tsx:glassRenderProbe',
        'glass band render probe',
        {
          hypothesisId: 'G2-render',
          zone: enclosureActiveBand,
          kind: enclosureZoneKind(enclosureActiveBand),
          className: el.className,
          backgroundColor: cs.backgroundColor,
          backgroundImage: cs.backgroundImage.slice(0, 48),
          boxShadow: cs.boxShadow.slice(0, 90),
          opacity: cs.opacity,
          zIndex: cs.zIndex,
          rect: {
            w: Math.round(rect.width),
            h: Math.round(rect.height),
            x: Math.round(rect.x),
            y: Math.round(rect.y),
          },
        },
        'GLASS-RENDER',
      )
    })
    return () => cancelAnimationFrame(id)
  }, [enclosureActiveBand, enclosureHighlightOn])
  // #endregion

  const useStraightBallPath = servePending || ballPathRally
  const useStraightBallPathRef = useRef(false)
  useStraightBallPathRef.current = useStraightBallPath

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

  const positionVisibleAssignments = useMemo(() => {
    if (!pendingTeamPlacement) return assignments
    return { ...assignments, ...pendingTeamPlacement.placement }
  }, [assignments, pendingTeamPlacement])

  const scoreboardAssignments = useMemo((): QuadrantPlayers | null => {
    if (setupPhase === 'ready' && isCompleteAssignment(roster, assignments)) {
      return assignments as QuadrantPlayers
    }
    if (needsSetup && setupPhase !== 'ready' && sessionTeams) {
      return {
        TL: sessionTeams.teamA[0],
        TR: sessionTeams.teamA[1],
        BL: sessionTeams.teamB[0],
        BR: sessionTeams.teamB[1],
      }
    }
    return null
  }, [assignments, needsSetup, roster, sessionTeams, setupPhase])

  const showTeamRails = !matchComplete && Boolean(scoreboardAssignments)

  const positionWizardPlayer = useMemo(() => {
    if (setupPhase !== 'positions' || !sessionTeams) return null
    if (pendingTeamPlacement) {
      return sessionTeams[pendingTeamPlacement.team === 'a' ? 'teamA' : 'teamB'][0] ?? null
    }
    const team = currentTeamToAssign(assignments)
    if (!team) return null
    return sessionTeams[team === 'a' ? 'teamA' : 'teamB'][0] ?? null
  }, [assignments, pendingTeamPlacement, sessionTeams, setupPhase])

  const positionHighlightKey = useMemo(
    () =>
      positionWizardPlayer?.name?.trim()
        ? playerKey(positionWizardPlayer)
        : null,
    [positionWizardPlayer],
  )

  const gameLabel = gameNumber ? `Game ${gameNumber}` : undefined

  const syncCanvasSize = useCallback(() => {
    const pad = padRef.current
    const canvas = canvasRef.current
    if (!pad || !canvas) return

    const rect = pad.getBoundingClientRect()
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const w = pad.offsetWidth || rect.width
    const h = pad.offsetHeight || rect.height
    canvas.width = Math.floor(w * dpr)
    canvas.height = Math.floor(h * dpr)
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = 5
    ctx.strokeStyle = '#ffffff'

    sizeRef.current = { width: w, height: h }
    const pendingLine = pendingBallPathRef.current?.line
    if (pendingLine && pendingLine.length >= 2) {
      requestAnimationFrame(() => redrawRef.current())
    }
  }, [])

  const displayPath = useCallback((): NormalizedPoint[] => {
    const anchors = anchorsRef.current
    const tip = liveTipRef.current
    if (!tip) return anchors
    const last = anchors[anchors.length - 1]
    if (last && last.x === tip.x && last.y === tip.y) return anchors
    return [...anchors, tip]
  }, [])

  const drawHorizDraftUnderlay = useCallback(
    (ctx: CanvasRenderingContext2D, width: number, height: number) => {
      const draft = horizDraftRef.current
      if (!draft) return
      ctx.save()
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.lineWidth = 5
      ctx.strokeStyle = 'rgba(255,255,255,0.92)'
      drawGestureStroke(ctx, draft.captured.pathPoints, width, height)
      drawGestureMarkers(ctx, draft.captured.pathPoints, width, height)
      ctx.restore()
    },
    [],
  )

  const applyHorizDraft = useCallback((draft: HorizStrokeDraft | null) => {
    horizDraftRef.current = draft
    setHorizDraft(draft)
  }, [])

  const clearCanvasBitmap = useCallback((ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.restore()
  }, [])

  const persistHorizDraftOnCanvas = useCallback(() => {
    if (suppressCanvasDrawRef.current) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const { width, height } = sizeRef.current
    clearCanvasBitmap(ctx, canvas)
    drawHorizDraftUnderlay(ctx, width, height)
  }, [clearCanvasBitmap, drawHorizDraftUnderlay])

  const redraw = useCallback(() => {
    if (cleanupStateRef.current) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    if (suppressCanvasDrawRef.current) {
      clearCanvasBitmap(ctx, canvas)
      return
    }

    const pendingPath = pendingBallPathRef.current?.line
    const anchorPath = displayPath()
    const freehand = freehandRef.current
    const { width, height } = sizeRef.current
    clearCanvasBitmap(ctx, canvas)
    drawHorizDraftUnderlay(ctx, width, height)
    const glassFinishPending = pendingBallPathRef.current?.phase === 'glass_finish'
    if (pendingPath && pendingPath.length >= 2) {
      drawDimmedGesturePath(ctx, pendingPath, width, height)
    }
    if (glassFinishPending && freehand.length >= 2) {
      drawGestureStroke(ctx, freehand, width, height)
      drawGestureMarkers(ctx, freehand, width, height)
    } else if (!pendingPath && useStraightBallPathRef.current && anchorPath.length >= 2) {
      const verts = ballPathVerticesRef.current
      if (ballPathRallyRef.current && verts.length >= 1 && liveTipRef.current) {
        const poly = [...verts, liveTipRef.current]
        drawGestureStroke(ctx, poly, width, height)
        drawGestureMarkers(ctx, poly, width, height)
      } else {
        const line = straightLinePath(anchorPath[0]!, anchorPath[anchorPath.length - 1]!)
        drawGestureStroke(ctx, line, width, height)
        drawGestureMarkers(ctx, line, width, height)
      }
    } else if (freehand.length >= 2) {
      drawFreehandStroke(ctx, freehand, width, height)
      drawGestureMarkers(ctx, anchorPath, width, height)
    } else {
      drawGestureStroke(ctx, anchorPath, width, height)
      drawGestureMarkers(ctx, anchorPath, width, height)
    }
  }, [clearCanvasBitmap, displayPath, drawHorizDraftUnderlay, horizDraft])
  redrawRef.current = redraw

  const cancelCleanupAnimation = useCallback(() => {
    if (cleanupAnimRef.current != null) {
      cancelAnimationFrame(cleanupAnimRef.current)
      cleanupAnimRef.current = null
    }
    cleanupStateRef.current = null
  }, [])

  const clearPauseTimer = useCallback(() => {
    if (pauseTimerRef.current !== null) {
      clearTimeout(pauseTimerRef.current)
      pauseTimerRef.current = null
    }
  }, [])

  const drawCleanupFrame = useCallback(
    (path: NormalizedPoint[], label: string | null, labelAlpha: number) => {
      if (suppressCanvasDrawRef.current) return
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      const { width, height } = sizeRef.current
      clearCanvasBitmap(ctx, canvas)
      drawHorizDraftUnderlay(ctx, width, height)
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.lineWidth = 5
      ctx.strokeStyle = '#ffffff'
      drawGestureStroke(ctx, path, width, height)
      drawGestureMarkers(ctx, path, width, height)
      const end = path[path.length - 1]
      if (label && end) drawGestureShotLabel(ctx, label, end, width, height, labelAlpha)
    },
    [clearCanvasBitmap, drawHorizDraftUnderlay],
  )

  const wipeCanvas = useCallback(() => {
    cancelCleanupAnimation()
    anchorsRef.current = []
    freehandRef.current = []
    liveTipRef.current = null
    clearPauseTimer()
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    clearCanvasBitmap(ctx, canvas)
  }, [cancelCleanupAnimation, clearCanvasBitmap, clearPauseTimer])

  const clearCanvas = wipeCanvas

  const recordShot = useCallback(
    (shot: ShotRecord) => {
      const isServeShot =
        shot.intent?.kind === 'serve_in' ||
        shot.intent?.kind === 'second_serve' ||
        shot.analysis.shapeLabel === 'Serve'

      if (isServeShot) {
        applyHorizDraft(null)
      }

      const entry = commitGestureRecording(shot)

      if (shot.awaitLoser) {
        const exchange = exchangeRef.current
        if (exchange.phase === 'await_loser') {
          const done = tryCompleteLoserTag(
            shot.analysis,
            entry,
            exchange.pending,
            shot.captured.pathPoints,
          )
          if (done.ok) {
            finishLoserTag(exchange.pending, done.loserQuadrant, done.loserGestureId)
            void syncMatchLogToServer()
          }
        }
      } else {
        if (shot.intent) {
          applyScoringIntent(shot.intent, shot.entryId)
        }

        if (shot.intent?.kind === 'serve_in') {
          suppressCanvasDrawRef.current = true
          pendingServeCanvasWipeRef.current = true
          wipeCanvas()
          setServeCanvasRev((rev) => rev + 1)
          applyHorizDraft(null)
          void syncMatchLogToServer()
          return
        }
      }

      applyHorizDraft(null)
      if (shot.intent?.kind === 'second_serve') {
        suppressCanvasDrawRef.current = true
        pendingServeCanvasWipeRef.current = true
        wipeCanvas()
        setServeCanvasRev((rev) => rev + 1)
        refreshPointEvents()
        void syncMatchLogToServer()
        return
      }

      if (isServeShot) {
        suppressCanvasDrawRef.current = true
        pendingServeCanvasWipeRef.current = true
        wipeCanvas()
        setServeCanvasRev((rev) => rev + 1)
      }

      const lock = shotOriginLockRef.current
      if (lock) {
        setCoinPlacements((prev) => {
          const next = { ...prev, [lock.actorQuadrant]: lock.origin }
          coinPlacementsRef.current = next
          return next
        })
      }
      setShotOriginLock(null)
      shotOriginLockRef.current = null
      void syncMatchLogToServer()
    },
    [
      applyHorizDraft,
      applyScoringIntent,
      commitGestureRecording,
      finishLoserTag,
      refreshPointEvents,
      syncMatchLogToServer,
      wipeCanvas,
    ],
  )

  const startCleanupAnimation = useCallback(
    (raw: NormalizedPoint[], ideal: NormalizedPoint[], label: string | null) => {
      if (suppressCanvasDrawRef.current) return
      cancelCleanupAnimation()
      cleanupStateRef.current = {
        raw,
        ideal,
        label,
        phase: 'snap',
        startedAt: performance.now(),
      }

      const tick = () => {
        const state = cleanupStateRef.current
        if (!state) return
        const elapsed = performance.now() - state.startedAt

        if (state.phase === 'snap') {
          const t = Math.min(1, elapsed / CLEANUP_SNAP_MS)
          const eased = 1 - (1 - t) ** 3
          const path = lerpGesturePaths(state.raw, state.ideal, eased)
          const labelAlpha = t > 0.72 ? (t - 0.72) / 0.28 : 0
          drawCleanupFrame(path, state.label, labelAlpha)
          if (t >= 1) {
            state.phase = 'hold'
            state.startedAt = performance.now()
          }
          cleanupAnimRef.current = requestAnimationFrame(tick)
          return
        }

        drawCleanupFrame(state.ideal, state.label, 1)
        if (elapsed >= CLEANUP_HOLD_MS) {
          cancelCleanupAnimation()
          const canvas = canvasRef.current
          if (canvas) {
            const ctx = canvas.getContext('2d')
            if (ctx) clearCanvasBitmap(ctx, canvas)
          }
          return
        }
        cleanupAnimRef.current = requestAnimationFrame(tick)
      }

      cleanupAnimRef.current = requestAnimationFrame(tick)
    },
    [cancelCleanupAnimation, clearCanvasBitmap, drawCleanupFrame],
  )

  const appendFreehandSample = useCallback((point: NormalizedPoint) => {
    const { width, height } = sizeRef.current
    const samples = freehandRef.current
    const last = samples[samples.length - 1]
    if (last && pointDistPx(last, point, width, height) < FREEHAND_MIN_PX) return
    if (samples.length >= FREEHAND_MAX_SAMPLES) {
      samples.splice(0, samples.length - FREEHAND_MAX_SAMPLES + 1)
    }
    samples.push(point)
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
  }, [redraw])

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

  const resetLiveState = () => {
    setIsDrawing(false)
    setStartQuadrant(null)
    setActiveQuadrant(null)
    activeQuadrantRef.current = null
    setRallyDrawHalf(null)
  }


  const updateGlassBandFeedback = useCallback((tipPad: NormalizedPoint, isStart: boolean) => {
    const pad = padRef.current
    if (!pad) return
    const inset = measureCourtInset(pad)
    if (!inset) return
    const court = padNormToCourtNorm(tipPad, inset)
    const padZone = enclosureZoneAtPadNorm(tipPad, inset)
    const courtZone = enclosureZoneAtCourtNorm(court)
    const zone = enclosureZoneAtPad(tipPad, inset)
    // #region agent log
    const inMargin =
      court.x < 0 || court.x > 1 || court.y < 0 || court.y > 1
    const sig = `${padZone ?? '∅'}|${courtZone ?? '∅'}|${inMargin ? 'M' : 'C'}`
    if (sig !== glassProbeSigRef.current && (inMargin || zone)) {
      glassProbeSigRef.current = sig
      debugSessionLog(
        'GestureAnnotationPad.tsx:updateGlassBandFeedback',
        'glass feedback probe',
        {
          hypothesisId: 'G1-detect',
          padZone,
          padZoneKind: enclosureZoneKind(padZone),
          courtZone,
          courtZoneKind: enclosureZoneKind(courtZone),
          finalZone: zone,
          finalZoneKind: enclosureZoneKind(zone),
          inMargin,
          court,
          tipPad,
          bounds: {
            L: inset.left,
            T: inset.top,
            R: inset.left + inset.width,
            B: inset.top + inset.height,
          },
          isStart,
        },
        'GLASS-FB',
      )
    }
    // #endregion
    if (isStart) {
      activeGlassBandRef.current = zone
      setGlassBandFeedback({ start: zone, active: zone })
      return
    }
    if (activeGlassBandRef.current === zone) return
    if (zone) gestureHapticQuadrantChange()
    activeGlassBandRef.current = zone
    setGlassBandFeedback((prev) => ({ start: prev.start, active: zone }))
  }, [])

  const clearGlassBandFeedback = useCallback(() => {
    activeGlassBandRef.current = null
    setGlassBandFeedback({ start: null, active: null })
  }, [])

  const updateLiveQuadrants = (
    point: NormalizedPoint,
    isStart: boolean,
    inset?: CourtInsetBounds | null,
  ) => {
    const enclosureZone = inset ? enclosureZoneAtPad(point, inset) : null
    if (enclosureZone != null) {
      if (!isStart && activeQuadrantRef.current != null) {
        setActiveQuadrant(null)
        activeQuadrantRef.current = null
      }
      return
    }

    const courtPoint = inset ? padNormToCourtNorm(point, inset) : point
    const inPlayableCourt =
      courtPoint.x >= 0 &&
      courtPoint.x <= 1 &&
      courtPoint.y >= 0 &&
      courtPoint.y <= 1
    if (!inPlayableCourt) {
      if (!isStart && activeQuadrantRef.current != null) {
        setActiveQuadrant(null)
        activeQuadrantRef.current = null
      }
      return
    }

    const quadrant = quadrantFromPoint(courtPoint)
    if (isStart) {
      setStartQuadrant(quadrant)
      setActiveQuadrant(quadrant)
      activeQuadrantRef.current = quadrant
      return
    }

    if (activeQuadrantRef.current === quadrant) return

    setActiveQuadrant(quadrant)
    if (activeQuadrantRef.current) {
      gestureHapticQuadrantChange()
    }
    activeQuadrantRef.current = quadrant
  }

  useLayoutEffect(() => {
    if (serveCanvasRev === 0) return
    devDebugLog('gesture-pad', 'serve canvas wipe layout', { rev: serveCanvasRev })
    pendingServeCanvasWipeRef.current = false
    wipeCanvas()
    const id = requestAnimationFrame(() => {
      wipeCanvas()
      requestAnimationFrame(wipeCanvas)
    })
    return () => cancelAnimationFrame(id)
  }, [serveCanvasRev, wipeCanvas])

  useEffect(() => {
    if (pendingBallPath) redraw()
  }, [pendingBallPath, redraw])

  useEffect(() => {
    syncCanvasSize()
    const pad = padRef.current
    if (!pad) return

    const observer = new ResizeObserver(() => syncCanvasSize())
    observer.observe(pad)
    const onOrientation = () => {
      window.setTimeout(syncCanvasSize, 150)
    }
    window.addEventListener('orientationchange', onOrientation)
    return () => {
      observer.disconnect()
      clearPauseTimer()
      cancelCleanupAnimation()
      window.removeEventListener('orientationchange', onOrientation)
    }
  }, [syncCanvasSize, clearPauseTimer, cancelCleanupAnimation])

  useEffect(() => {
    const id = window.setTimeout(syncCanvasSize, 60)
    return () => window.clearTimeout(id)
  }, [rotatePad, syncCanvasSize])

  const syncServeStateFromSession = useCallback(() => {
    if (!courtSetupKey) return
    const session = loadMatchSession(courtSetupKey)
    const allGestures = readGestureDebugLog()
    const attempt = serveAttemptFromSession(session, allGestures)
    serveAttemptRef.current = attempt
    setServeAttempt(attempt)
    setPastServeThisPoint(false)
    setShotOriginLock(null)
    shotOriginLockRef.current = null
    applyHorizDraft(null)
    exchangeRef.current = { phase: 'idle' }
    setPendingPoint(null)
    setPointExchangePhase('idle')
  }, [applyHorizDraft, courtSetupKey])

  const handleSelectLogPoint = useCallback(
    (index: number | 'live') => {
      if (index === 'live') {
        syncServeStateFromSession()
        setReviewPointIndex('live')
      } else {
        setReviewPointIndex(index)
      }
      exchangeRef.current = { phase: 'idle' }
      setPendingPoint(null)
      setPointExchangePhase('idle')
    },
    [syncServeStateFromSession],
  )

  /** Hold a log entry to reset the match back to that point's state. */
  const handleResetToPoint = useCallback(
    (index: number) => {
      if (!courtSetupKey) return
      const target = pointEventsChrono[index]
      if (!target) return
      // Keep points 0..index, drop everything (points + gestures) after it.
      truncatePointEventsFrom(courtSetupKey, index + 1)
      truncateSessionGesturesFromPoint(courtSetupKey, index + 1, readGestureDebugLog())
      setTennisScore(target.scoreAfter)
      persistSetup(target.scoreAfter)
      setShotOriginLock(null)
      shotOriginLockRef.current = null
      applyHorizDraft(null)
      clearCanvas()
      setPendingBallPath(null)
      exchangeRef.current = { phase: 'idle' }
      setPendingPoint(null)
      setPointExchangePhase('idle')
      setReviewPointIndex('live')
      syncServeStateFromSession()
      refreshPointEvents()
      void syncMatchLogToServer()
      gestureHapticComplete()
    },
    [
      applyHorizDraft,
      clearCanvas,
      courtSetupKey,
      persistSetup,
      pointEventsChrono,
      refreshPointEvents,
      syncMatchLogToServer,
      syncServeStateFromSession,
    ],
  )

  /** Undo the last action: cancel an in-progress shot, else step back one point/serve, else one setup step. */
  const handleLiveUndo = useCallback(() => {
    if (!courtSetupKey || reviewMode) return

    // 1. Cancel any in-progress, uncommitted action (ball path / exchange / horizontal draft).
    if (
      pendingBallPath ||
      pendingPoint ||
      pointExchangePhase !== 'idle' ||
      horizDraftRef.current
    ) {
      setPendingBallPath(null)
      pendingBallPathRef.current = null
      setPendingPoint(null)
      exchangeRef.current = { phase: 'idle' }
      setPointExchangePhase('idle')
      applyHorizDraft(null)
      setShotOriginLock(null)
      shotOriginLockRef.current = null
      clearCanvas()
      gestureHapticComplete()
      return
    }

    // 2. Live play — undo the last committed point / serve fault / gesture.
    if (setupPhase === 'ready') {
      const plan = planLiveUndo(loadMatchSession(courtSetupKey), readGestureDebugLog())
      if (!plan) return
      applyLiveUndo(courtSetupKey, plan)
      if (plan.kind !== 'first_serve_fault') {
        setTennisScore(plan.scoreAfterUndo)
        persistSetup(plan.scoreAfterUndo)
      }
      setReviewPointIndex('live')
      clearCanvas()
      syncServeStateFromSession()
      refreshPointEvents()
      void syncMatchLogToServer()
      gestureHapticComplete()
      return
    }

    // 3. Setup — step back from serve confirmation to server pick.
    if (setupPhase === 'confirm_serve') {
      setPendingServeQuadrant(null)
      setSetupPhase('serve')
      void syncMatchLogToServer({
        logStage: 'serve_pick',
        setup: { setupPhase: 'serve', pendingServeQuadrant: null },
      })
      gestureHapticComplete()
    }
  }, [
    applyHorizDraft,
    clearCanvas,
    courtSetupKey,
    pendingBallPath,
    pendingPoint,
    persistSetup,
    pointExchangePhase,
    refreshPointEvents,
    reviewMode,
    setupPhase,
    syncMatchLogToServer,
    syncServeStateFromSession,
  ])

  const lastUndoSignalRef = useRef(undoSignal)
  useEffect(() => {
    if (undoSignal === lastUndoSignalRef.current) return
    lastUndoSignalRef.current = undoSignal
    handleLiveUndo()
  }, [undoSignal, handleLiveUndo])

  const handleLockOrigin = useCallback(
    (quadrant: Quadrant, origin: NormalizedPoint) => {
      applyHorizDraft(null)
      cancelCleanupAnimation()
      clearCanvas()
      const lock = { actorQuadrant: quadrant, origin }
      shotOriginLockRef.current = lock
      setShotOriginLock(lock)
      setCoinPlacements((prev) => {
        const next = { ...prev, [quadrant]: origin }
        coinPlacementsRef.current = next
        return next
      })
      gestureHapticAnchor()
    },
    [applyHorizDraft, cancelCleanupAnimation, clearCanvas],
  )

  const finalizePendingBallPath = useCallback(() => {
      const pending = pendingBallPathRef.current
      if (pending?.phase !== 'confirm') return
      if (!pending?.attackerShot || !pending?.defenderShot) return

      const {
        ballResult,
        line,
        entryId,
        durationMs,
        attackerShot,
        attackerShotAngleDeg,
        defenderShot,
        defenderShotAngleDeg,
        attackerWave,
        defenderWave,
        attackerPower,
        defenderPower,
      } = pending
      if (attackerShotAngleDeg == null || defenderShotAngleDeg == null) return
      const pathCaptured =
        captureGestureForActor(line, ballResult.hitterQuadrant) ?? captureGesture(line)
      if (!pathCaptured) {
        setPendingBallPath(null)
        wipeCanvas()
        return
      }
      const pathMeta = shotDrawMetaFromOrigin(line, ballResult.hitterQuadrant, line[0]!)
      const dropPad = line[line.length - 1]!
      const reachPad = pending.defenderReachPad ?? dropPad
      const reachDist = Math.hypot(reachPad.x - dropPad.x, reachPad.y - dropPad.y)
      const report = `${rallyShotReport(
        attackerShot,
        attackerShotAngleDeg,
        defenderShot,
        defenderShotAngleDeg,
        ballResult.report,
      )} · reach ${Math.round(reachDist * 100)}%`
      const pathAnalysis: ReturnType<typeof analyzeGesture> = {
        ...analyzeGesture(pathCaptured, durationMs, { playerNames }),
        report,
        shape: 'LINE_V',
        shapeLabel: 'Ball path',
        startQuadrant: ballResult.hitterQuadrant,
        endQuadrant: ballResult.endQuadrant,
      }
      let intent: ScoringIntent | null = null
      if (ballResult.outcome === 'score') {
        intent = {
          kind: 'ball_path_score',
          winnerQuadrant: ballResult.hitterQuadrant,
          loserQuadrant: defenderQuadrantForPath(ballResult),
          winnerTeam: ballResult.winnerTeam,
        }
      } else {
        intent = {
          kind: 'foul',
          winnerTeam: ballResult.winnerTeam,
          foulerQuadrant: ballResult.foulerQuadrant,
        }
      }
      recordShot({
        entryId,
        analysis: pathAnalysis,
        captured: pathCaptured,
        intent,
        awaitLoser: false,
        attackerShot,
        defenderShot,
        ...(attackerWave ? { attackerWave } : {}),
        ...(defenderWave ? { defenderWave } : {}),
        ...(attackerPower != null ? { attackerPower } : {}),
        ...(defenderPower != null ? { defenderPower } : {}),
        ...pathMeta,
      })
      setPendingBallPath(null)
      suppressCanvasDrawRef.current = true
      wipeCanvas()
      gestureHapticComplete()
    },
    [playerNames, recordShot, wipeCanvas],
  )

  const handleBallPathCancel = useCallback(() => {
    setPendingBallPath(null)
    pendingBallPathRef.current = null
    suppressCanvasDrawRef.current = false
    clearCanvas()
  }, [clearCanvas])

  const handleBallPathAccept = useCallback(() => {
    finalizePendingBallPath()
  }, [finalizePendingBallPath])

  const handleDefenderReachMove = useCallback((quadrant: Quadrant, origin: NormalizedPoint) => {
    const pending = pendingBallPathRef.current
    if (!pending || quadrant !== pending.defenderQuadrant) return
    setPendingBallPath((prev) => {
      if (!prev) return prev
      const next = { ...prev, defenderReachPad: origin }
      pendingBallPathRef.current = next
      return next
    })
  }, [])

  const handleDefenderReachLock = useCallback((quadrant: Quadrant, origin: NormalizedPoint) => {
    const pending = pendingBallPathRef.current
    if (!pending || quadrant !== pending.defenderQuadrant) return
    setCoinPlacements((prev) => {
      const next = { ...prev, [quadrant]: origin }
      coinPlacementsRef.current = next
      return next
    })
    setPendingBallPath((prev) => {
      if (!prev) return prev
      const next = { ...prev, defenderReachPad: origin }
      pendingBallPathRef.current = next
      return next
    })
    gestureHapticAnchor()
  }, [])

  const patchGlassAnchor = useCallback((pad: NormalizedPoint) => {
    setPendingBallPath((prev) => {
      if (!prev || prev.phase !== 'glass_finish' || !prev.line[0]) return prev
      const next = { ...prev, glassAnchorPad: pad, line: [prev.line[0], pad] }
      pendingBallPathRef.current = next
      return next
    })
    redrawRef.current()
  }, [])

  const handleGlassAnchorMove = useCallback(
    (pad: NormalizedPoint) => {
      patchGlassAnchor(pad)
    },
    [patchGlassAnchor],
  )

  const handleGlassAnchorLock = useCallback(
    (pad: NormalizedPoint) => {
      patchGlassAnchor(pad)
      gestureHapticAnchor()
    },
    [patchGlassAnchor],
  )

  const handleAttackerShotPick = useCallback((pick: RallyShotPick) => {
    setPendingBallPath((prev) => {
      if (
        !prev ||
        prev.attackerShot ||
        prev.phase === 'confirm' ||
        prev.phase === 'glass_finish'
      ) {
        return prev
      }
      const next = advanceBallPathPick(prev, {
        attackerShot: pick.shot,
        attackerShotAngleDeg: pick.angleDeg,
      })
      pendingBallPathRef.current = next
      return next
    })
    gestureHapticAnchor()
  }, [])

  const handleAttackerShotAngle = useCallback((angleDeg: number) => {
    setPendingBallPath((prev) => {
      if (!prev?.attackerShot || prev.phase === 'glass_finish') return prev
      const next = advanceBallPathPick(prev, { attackerShotAngleDeg: angleDeg })
      pendingBallPathRef.current = next
      return next
    })
  }, [])

  const handleAttackerShotDeselect = useCallback(() => {
    setPendingBallPath((prev) => {
      if (!prev || prev.phase === 'glass_finish') return prev
      const next: PendingBallPathExchange = {
        ...prev,
        phase: 'shot_pick',
        attackerShot: undefined,
        attackerShotAngleDeg: undefined,
        attackerWave: undefined,
        attackerPower: undefined,
      }
      pendingBallPathRef.current = next
      return next
    })
    gestureHapticAnchor()
  }, [])

  const handleAttackerWave = useCallback((value: ShotWaveOption) => {
    setPendingBallPath((prev) => {
      if (!prev || !prev.attackerShot) return prev
      const next = { ...prev, attackerWave: value }
      pendingBallPathRef.current = next
      return next
    })
    gestureHapticAnchor()
  }, [])

  const handleAttackerPower = useCallback((power: number) => {
    setPendingBallPath((prev) => {
      if (!prev || !prev.attackerShot) return prev
      const next = { ...prev, attackerPower: power }
      pendingBallPathRef.current = next
      return next
    })
  }, [])

  const handleDefenderShotPick = useCallback((pick: RallyShotPick) => {
    setPendingBallPath((prev) => {
      if (
        !prev ||
        prev.defenderShot ||
        prev.phase === 'confirm' ||
        prev.phase === 'glass_finish'
      ) {
        return prev
      }
      const next = advanceBallPathPick(prev, {
        defenderShot: pick.shot,
        defenderShotAngleDeg: pick.angleDeg,
      })
      pendingBallPathRef.current = next
      return next
    })
    gestureHapticAnchor()
  }, [])

  const handleDefenderWave = useCallback((value: ShotWaveOption) => {
    setPendingBallPath((prev) => {
      if (!prev || !prev.defenderShot) return prev
      const next = { ...prev, defenderWave: value }
      pendingBallPathRef.current = next
      return next
    })
    gestureHapticAnchor()
  }, [])

  const handleDefenderPower = useCallback((power: number) => {
    setPendingBallPath((prev) => {
      if (!prev || !prev.defenderShot) return prev
      const next = { ...prev, defenderPower: power }
      pendingBallPathRef.current = next
      return next
    })
  }, [])

  const handleDefenderShotAngle = useCallback((angleDeg: number) => {
    setPendingBallPath((prev) => {
      if (!prev?.defenderShot || prev.phase === 'glass_finish') return prev
      const next = advanceBallPathPick(prev, { defenderShotAngleDeg: angleDeg })
      pendingBallPathRef.current = next
      return next
    })
  }, [])

  const handleDefenderShotDeselect = useCallback(() => {
    setPendingBallPath((prev) => {
      if (!prev || prev.phase === 'glass_finish') return prev
      const next: PendingBallPathExchange = {
        ...prev,
        phase: 'shot_pick',
        defenderShot: undefined,
        defenderShotAngleDeg: undefined,
        defenderWave: undefined,
        defenderPower: undefined,
      }
      pendingBallPathRef.current = next
      return next
    })
    gestureHapticAnchor()
  }, [])

  const buildActorMeta = useCallback((drawPath: NormalizedPoint[], actorQuadrant: Quadrant) => {
    const origin =
      shotOriginLockRef.current?.actorQuadrant === actorQuadrant
        ? shotOriginLockRef.current.origin
        : coinPlacementsRef.current[actorQuadrant]
    if (!origin) return {}
    return shotDrawMetaFromOrigin(drawPath, actorQuadrant, origin)
  }, [])

  const patchAnalysisForOrigin = useCallback(
    (analysis: ReturnType<typeof analyzeGesture>, actorQuadrant: Quadrant) => {
      const origin =
        shotOriginLockRef.current?.actorQuadrant === actorQuadrant
          ? shotOriginLockRef.current.origin
          : coinPlacementsRef.current[actorQuadrant]
      if (!origin) return analysis
      const shotZone: CourtShotZone = isVolleyZoneStart(origin, actorQuadrant) ? 'inner' : 'back'
      return { ...analysis, shotZone, start: origin }
    },
    [],
  )

  const pointerDown = (clientX: number, clientY: number) => {
    if (matchComplete || reviewMode) return
    if (reviewingPoint) return
    const pendingPath = pendingBallPathRef.current
    if (pendingPath?.phase === 'confirm' && !playerDragRef.current) {
      const pad = padRef.current
      if (!pad) return
      const point = clientToPadNormalized(clientX, clientY, pad, rotatePad)
      confirmStrokeRef.current = true
      confirmPointsRef.current = [point]
      confirmStartedAtRef.current = performance.now()
      return
    }
    if (pendingPath && pendingPath.phase !== 'glass_finish') {
      // While the shot wheels are up, a double-tap on the court (off the wheels)
      // cancels the shot and resets it to before the draw.
      const now = performance.now()
      if (now - shotPickTapRef.current < 300) {
        shotPickTapRef.current = 0
        handleBallPathCancel()
      } else {
        shotPickTapRef.current = now
      }
      return
    }
    if (needsSetup && setupPhase !== 'ready') return
    if (playerDragRef.current) return
    const pad = padRef.current
    if (!pad) return

    if (showPlayerActorPick && !useStraightBallPath && !shotOriginLockRef.current && !horizDraft) return

    // You can't strike a ball from behind the walls. Reject only draws that
    // START off-court (the dead margin beyond the enclosure). On-court shots and
    // behind-the-baseline serves are allowed, so play can progress past the serve.
    {
      const startInset = measureCourtInset(pad)
      const startPad = clientToPadNormalized(clientX, clientY, pad, rotatePad)
      if (startInset) {
        const c = padNormToCourtNorm(startPad, startInset)
        const onCourt = c.x >= 0 && c.x <= 1 && c.y >= 0 && c.y <= 1
        const inEnclosure = enclosureZoneAtPad(startPad, startInset) != null
        if (!onCourt && !inEnclosure) return
      }
    }

    suppressCanvasDrawRef.current = false
    clearPauseTimer()
    cancelCleanupAnimation()
    drawingRef.current = true
    startedAtRef.current = performance.now()
    setIsDrawing(true)
    gestureHapticStart()

    const point = clientToPadNormalized(clientX, clientY, pad, rotatePad)
    const glassPending = pendingPath?.phase === 'glass_finish'
    const glassStart =
      glassPending && pendingPath
        ? (pendingPath.glassAnchorPad ?? pendingPath.line[pendingPath.line.length - 1]!)
        : null
    const startPoint = glassStart ?? point
    netHoverSinceRef.current = null
    setServeLiveLanding(null)
    if (ballPathRallyRef.current || glassPending) {
      updateGlassBandFeedback(startPoint, true)
    } else {
      clearGlassBandFeedback()
    }
    anchorsRef.current = [startPoint]
    freehandRef.current = [startPoint]
    liveTipRef.current = startPoint
    ballPathVerticesRef.current = [startPoint]
    glassBandTrackRef.current = null
    glassApexRef.current = null
    glassApexDepthRef.current = 0
    updateLiveQuadrants(point, true, courtInset)
    // Turn on the in/out + net guide zones only once a valid rally draw begins,
    // anchored to the attacker's half (the side the stroke starts on).
    if (ballPathRallyRef.current) {
      const inset = measureCourtInset(pad) ?? courtInset
      const nextHalf = inset
        ? padNormToCourtNorm(startPoint, inset).y < PADEL_NET_Y
          ? 'top'
          : 'bottom'
        : null
      if (inset) setRallyDrawHalf(nextHalf)
    } else {
      setRallyDrawHalf(null)
    }
    redraw()
  }

  const pointerMove = (clientX: number, clientY: number) => {
    if (confirmStrokeRef.current) {
      const pad = padRef.current
      if (!pad) return
      const point = clientToPadNormalized(clientX, clientY, pad, rotatePad)
      const pts = confirmPointsRef.current
      const last = pts[pts.length - 1]
      if (!last || last.x !== point.x || last.y !== point.y) {
        confirmPointsRef.current = [...pts, point]
      }
      return
    }
    if (!drawingRef.current) return
    const pad = padRef.current
    if (!pad) return

    const point = clientToPadNormalized(clientX, clientY, pad, rotatePad)
    const tip = liveTipRef.current
    if (tip && tip.x === point.x && tip.y === point.y) return

    if (useStraightBallPath) {
      const start = anchorsRef.current[0] ?? freehandRef.current[0]
      const inset = measureCourtInset(pad)
      const glassPending = pendingBallPathRef.current?.phase === 'glass_finish'
      if (start && inset) {
        let tip = point
        if (glassPending) {
          const glass =
            pendingBallPathRef.current!.glassAnchorPad ??
            pendingBallPathRef.current!.line[1]!
          freehandRef.current = straightLinePath(glass, tip)
          liveTipRef.current = tip
          updateGlassBandFeedback(tip, false)
        } else if (serveModeRef.current) {
          // Serve mode: straight line + live diagonal-box landing feedback.
          freehandRef.current = straightLinePath(start, tip)
          liveTipRef.current = tip
          if (servingPlayerQuadrant && effectiveServeSideQuadrant) {
            setServeLiveLanding(
              classifyServeLandingInServePhase(
                [start, tip],
                start,
                effectiveServeSideQuadrant,
                servingPlayerQuadrant,
                inset,
              ),
            )
          }
        } else if (ballPathRallyRef.current) {
          updateGlassBandFeedback(point, false)
          // Pad-normal hit test matches the rendered glass band — finger depth
          // into the margin is preserved as wall height (never clamped/snapped).
          const zone = enclosureZoneAtPadNorm(point, inset)
          tip = point
          if (zone && isGlassEnclosureZone(zone)) {
            const verts = ballPathVerticesRef.current
            const lastV = verts[verts.length - 1]!
            if (Math.hypot(point.x - lastV.x, point.y - lastV.y) >= GLASS_MIN_VERTEX_GAP) {
              ballPathVerticesRef.current = [...verts, point]
            }
          }
          liveTipRef.current = tip
          freehandRef.current = [...ballPathVerticesRef.current, tip]
          const endCourt = padNormToCourtNorm(tip, inset)
          if (courtNormDistanceToNet(endCourt) <= NET_SHORT_APPROACH_COURT) {
            if (netHoverSinceRef.current == null) {
              netHoverSinceRef.current = performance.now()
            }
          } else {
            netHoverSinceRef.current = null
          }
        } else {
          freehandRef.current = straightLinePath(start, tip)
          liveTipRef.current = tip
        }
      } else if (start) {
        freehandRef.current = straightLinePath(start, point)
        liveTipRef.current = point
      } else {
        liveTipRef.current = point
      }
      updateLiveQuadrants(liveTipRef.current ?? point, false, inset ?? courtInset)
      redraw()
      return
    }

    liveTipRef.current = point

    appendFreehandSample(point)
    updateLiveQuadrants(point, false, courtInset)
    redraw()
    schedulePauseAnchor(point)
  }

  const pointerUp = () => {
    if (confirmStrokeRef.current) {
      confirmStrokeRef.current = false
      const pts = confirmPointsRef.current
      confirmPointsRef.current = []
      const durationMs = performance.now() - confirmStartedAtRef.current
      const verdict = detectConfirmSwipe(pts, durationMs)
      if (verdict === 'yes') handleBallPathAccept()
      else if (verdict === 'no') handleBallPathCancel()
      return
    }
    if (!drawingRef.current) return
    drawingRef.current = false
    clearPauseTimer()

    if (servePending) {
      applyHorizDraft(null)
    }

    const finalPath = displayPath()
    let rawPath =
      freehandRef.current.length >= 2
        ? [...freehandRef.current]
        : finalPath.length >= 2
          ? [...finalPath]
          : []
    if (useStraightBallPath && rawPath.length >= 2 && !ballPathRallyRef.current) {
      rawPath = straightLinePath(rawPath[0]!, rawPath[rawPath.length - 1]!)
    }
    const pathForCapture = rawPath.length >= 2 ? rawPath : finalPath
    anchorsRef.current = []
    freehandRef.current = []
    liveTipRef.current = null
    clearGlassBandFeedback()
    setServeLiveLanding(null)
    resetLiveState()

    const captured = captureGesture(pathForCapture)
    if (!captured) {
      clearCanvas()
      return
    }

    const durationMs = performance.now() - startedAtRef.current

    const horizActor = horizDraft?.captured.startQuadrant
    const actor = horizActor ?? shotOriginLockRef.current?.actorQuadrant ?? null
    const gestureCaptured = actor
      ? captureGestureForActor(pathForCapture, actor) ?? captured
      : captured
    const actorMeta = actor ? buildActorMeta(gestureCaptured.pathPoints, actor) : {}

    let analysis = analyzeGesture(gestureCaptured, durationMs, { playerNames })
    if (actor) {
      analysis = patchAnalysisForOrigin(analysis, actor)
    }
    const idealPath = idealizeGesturePath(analysis, finalPath)

    if (setupPhase === 'ready' || !needsSetup) {
      if (!matchComplete) {
        const entryId = horizDraft?.entryId ?? newGestureEntryId()
        const exchange = exchangeRef.current
        const awaitLoser = exchange.phase === 'await_loser'
        let intent: ScoringIntent | null = null

        if (
          !awaitLoser &&
          serveMode &&
          servingPlayerQuadrant &&
          effectiveServeSideQuadrant
        ) {
          const pad = padRef.current
          const drawPath = rawPath.length >= 2 ? rawPath : finalPath
          if (drawPath.length < 2 || !pad) {
            setServeMode(false)
            wipeCanvas()
            return
          }
          const origin = drawPath[0]!
          const strokePath = drawPath
          const courtInset = measureCourtInset(pad)
          if (!courtInset) {
            setServeMode(false)
            wipeCanvas()
            return
          }
          // Serve mode is explicit — the stroke IS a serve; classify by landing.
          const serveCaptured =
            captureGestureForActor(strokePath, servingPlayerQuadrant) ??
            captureGesture(strokePath)
          if (!serveCaptured) {
            wipeCanvas()
            return
          }
          const landing = classifyServeLandingInServePhase(
            strokePath,
            origin,
            effectiveServeSideQuadrant,
            servingPlayerQuadrant,
            courtInset,
          )
          const attempt = serveAttemptRef.current
          const serveMeta = shotDrawMetaFromOrigin(strokePath, servingPlayerQuadrant, origin)
          let serveAnalysis = analyzeGesture(serveCaptured, durationMs, { playerNames })
          const shotZone: CourtShotZone = isVolleyZoneStart(origin, servingPlayerQuadrant)
            ? 'inner'
            : 'back'
          serveAnalysis = { ...serveAnalysis, shotZone, start: origin }
          serveAnalysis = {
            ...serveAnalysis,
            report:
              landing === 'in'
                ? 'Serve in'
                : attempt === 1
                  ? landing === 'net'
                    ? 'Net — second serve'
                    : 'Out — second serve'
                  : landing === 'net'
                    ? 'Net — foul'
                    : 'Serve out — foul',
            shape: 'LINE_V',
            shapeLabel: 'Serve',
          }
          const serveEntryId = newGestureEntryId()
          const receiveQuadrant = serveReceiveQuadrant(effectiveServeSideQuadrant)
          const serverTeam = quadrantTeam(servingPlayerQuadrant)
          if (landing === 'in') {
            intent = {
              kind: 'serve_in',
              receiveQuadrant,
              landing: serveLandingPadPoint(strokePath, origin),
            }
          } else if (attempt === 1) {
            intent = { kind: 'second_serve' }
          } else {
            intent = {
              kind: 'foul',
              winnerTeam: serverTeam === 'a' ? 'b' : 'a',
              foulerQuadrant: servingPlayerQuadrant,
              isServe: true,
            }
          }
          devDebugLog('gesture-pad', 'serve resolved', {
            intent: intent.kind,
            landing,
            attempt,
            strokePoints: strokePath.length,
          })
          flushSync(() => {
            recordShot({
              entryId: serveEntryId,
              analysis: serveAnalysis,
              captured: serveCaptured,
              intent,
              awaitLoser: false,
              actorQuadrant: servingPlayerQuadrant,
              shotOrigin: serveMeta.shotOrigin,
            })
          })
          setServeMode(false)
          suppressCanvasDrawRef.current = true
          wipeCanvas()
          gestureHapticComplete()
          return
        }

        if (
          !awaitLoser &&
          pendingBallPathRef.current?.phase === 'glass_finish' &&
          rawPath.length >= 2
        ) {
          const pad = padRef.current
          if (!pad) {
            wipeCanvas()
            return
          }
          const inset = measureCourtInset(pad)
          if (!inset) {
            wipeCanvas()
            return
          }
          const pending = pendingBallPathRef.current
          const glass = pending.glassAnchorPad ?? pending.line[pending.line.length - 1]!
          const finishStroke = straightLinePath(rawPath[0]!, rawPath[rawPath.length - 1]!)
          const startDist = Math.hypot(
            finishStroke[0]!.x - glass.x,
            finishStroke[0]!.y - glass.y,
          )
          if (startDist > GLASS_FINISH_START_PAD_TOL) {
            wipeCanvas()
            gestureHapticComplete()
            return
          }
          const finish = finishStroke[1]!
          const netHoverHeld =
            netHoverSinceRef.current != null &&
            performance.now() - netHoverSinceRef.current >= NET_HOVER_HOLD_MS
          netHoverSinceRef.current = null
          const ballResult = resolveGlassReboundPath(
            pending.attackerQuadrant,
            glass,
            finish,
            inset,
            netHoverHeld,
          )
          if (!ballResult || ballResult.outcome === 'glass') {
            wipeCanvas()
            gestureHapticComplete()
            return
          }
          const fullLine = [pending.line[0]!, glass, finish]
          if (ballResult.outcome === 'out' || ballResult.outcome === 'net') {
            const foulMeta = shotDrawMetaFromOrigin(
              fullLine,
              pending.attackerQuadrant,
              pending.line[0]!,
            )
            const foulAnalysis = {
              ...analysis,
              report: ballResult.report,
              shape: 'LINE_V' as const,
              shapeLabel: ballResult.outcome === 'net' ? 'Net' : 'Out',
              start: pending.line[0]!,
            }
            const foulIntent: ScoringIntent = {
              kind: 'foul',
              winnerTeam: ballResult.winnerTeam,
              foulerQuadrant: ballResult.foulerQuadrant,
              isServe: false,
            }
            flushSync(() => {
              recordShot({
                entryId: pending.entryId,
                analysis: foulAnalysis,
                captured: gestureCaptured,
                intent: foulIntent,
                awaitLoser: false,
                actorQuadrant: pending.attackerQuadrant,
                shotOrigin: foulMeta.shotOrigin,
              })
            })
            pendingBallPathRef.current = null
            setPendingBallPath(null)
            suppressCanvasDrawRef.current = true
            wipeCanvas()
            gestureHapticComplete()
            return
          }
          const defenderQuadrant = defenderQuadrantForPath(ballResult)
          const pendingExchange: PendingBallPathExchange = {
            ...pending,
            line: fullLine,
            durationMs: pending.durationMs + durationMs,
            ballResult,
            phase: 'shot_pick',
            defenderQuadrant,
            defenderReachPad: finish,
          }
          flushSync(() => {
            setCoinPlacements((prev) => {
              const next = {
                ...prev,
                [pending.attackerQuadrant]: pending.line[0]!,
                [defenderQuadrant]: finish,
              }
              coinPlacementsRef.current = next
              return next
            })
            pendingBallPathRef.current = pendingExchange
            setPendingBallPath(pendingExchange)
          })
          anchorsRef.current = []
          freehandRef.current = []
          liveTipRef.current = null
          redraw()
          gestureHapticComplete()
          return
        }

        if (!awaitLoser && ballPathRally && !horizDraft && rawPath.length >= 2) {
          const pad = padRef.current
          if (!pad) {
            wipeCanvas()
            return
          }
          const inset = measureCourtInset(pad)
          if (!inset) {
            wipeCanvas()
            return
          }
          const netHoverHeld =
            netHoverSinceRef.current != null &&
            performance.now() - netHoverSinceRef.current >= NET_HOVER_HOLD_MS
          netHoverSinceRef.current = null
          const vertices =
            ballPathVerticesRef.current.length >= 1
              ? [...ballPathVerticesRef.current]
              : [rawPath[0]!]
          const attackerStart = vertices[0]!
          const finish = rawPath[rawPath.length - 1]!
          const ballResult = resolveBallPath(attackerStart, finish, inset, netHoverHeld)
          if (!ballResult) {
            wipeCanvas()
            gestureHapticComplete()
            return
          }
          const pathEntryId = newGestureEntryId()
          if (ballResult.outcome === 'glass') {
            const lastV = vertices[vertices.length - 1]!
            const fullLine =
              Math.hypot(finish.x - lastV.x, finish.y - lastV.y) < GLASS_MIN_VERTEX_GAP
                ? vertices
                : [...vertices, finish]
            const pendingExchange: PendingBallPathExchange = {
              entryId: pathEntryId,
              line: fullLine.length >= 2 ? fullLine : [attackerStart, finish],
              durationMs,
              ballResult,
              phase: 'glass_finish',
              attackerQuadrant: ballResult.hitterQuadrant,
              defenderQuadrant: defenderQuadrantForPath(ballResult),
              glassAnchorPad: finish,
            }
            flushSync(() => {
              setCoinPlacements((prev) => {
                const next = {
                  ...prev,
                  [ballResult.hitterQuadrant]: attackerStart,
                }
                coinPlacementsRef.current = next
                return next
              })
              pendingBallPathRef.current = pendingExchange
              setPendingBallPath(pendingExchange)
            })
            ballPathVerticesRef.current = []
            glassBandTrackRef.current = null
            glassApexRef.current = null
            glassApexDepthRef.current = 0
            redraw()
            gestureHapticAnchor()
            return
          }
          // Out / net = the hitter's foul → score immediately for the other team.
          // Do NOT open a defender shot-pick (which would drag the defender out).
          if (ballResult.outcome === 'out' || ballResult.outcome === 'net') {
            const foulMeta = shotDrawMetaFromOrigin(rawPath, ballResult.hitterQuadrant, attackerStart)
            const foulAnalysis = {
              ...analysis,
              report: ballResult.report,
              shape: 'LINE_V' as const,
              shapeLabel: ballResult.outcome === 'net' ? 'Net' : 'Out',
              start: attackerStart,
            }
            const foulIntent: ScoringIntent = {
              kind: 'foul',
              winnerTeam: ballResult.winnerTeam,
              foulerQuadrant: ballResult.foulerQuadrant,
              isServe: false,
            }
            flushSync(() => {
              recordShot({
                entryId: pathEntryId,
                analysis: foulAnalysis,
                captured: gestureCaptured,
                intent: foulIntent,
                awaitLoser: false,
                actorQuadrant: ballResult.hitterQuadrant,
                shotOrigin: foulMeta.shotOrigin,
              })
            })
            suppressCanvasDrawRef.current = true
            wipeCanvas()
            gestureHapticComplete()
            return
          }
          const fullLine = [...vertices, finish]
          const defenderQuadrant = defenderQuadrantForPath(ballResult)
          const defenderEnd = finish
          const pendingExchange: PendingBallPathExchange = {
            entryId: pathEntryId,
            line: fullLine,
            durationMs,
            ballResult,
            phase: 'shot_pick',
            attackerQuadrant: ballResult.hitterQuadrant,
            defenderQuadrant,
            defenderReachPad: defenderEnd,
          }
          flushSync(() => {
            setCoinPlacements((prev) => {
              const next = {
                ...prev,
                [ballResult.hitterQuadrant]: attackerStart,
                [defenderQuadrant]: defenderEnd,
              }
              coinPlacementsRef.current = next
              return next
            })
            pendingBallPathRef.current = pendingExchange
            setPendingBallPath(pendingExchange)
          })
          anchorsRef.current = []
          freehandRef.current = []
          liveTipRef.current = null
          ballPathVerticesRef.current = []
          glassBandTrackRef.current = null
          glassApexRef.current = null
          glassApexDepthRef.current = 0
          redraw()
          gestureHapticComplete()
          return
        }

        if (horizDraft && !awaitLoser) {
          const vertVerdict = detectVerticalVerdictStroke(
            gestureCaptured.pathPoints,
            horizDraft.horizEnd,
          )
          if (!vertVerdict) {
            persistHorizDraftOnCanvas()
            return
          }
          const built = buildDraftFromHoriz(
            entryId,
            gestureCaptured,
            analysis,
            horizDraft,
            gestureCaptured,
            durationMs,
            playerNames,
          )
          const draftActor = horizDraft.captured.startQuadrant
          const draftMeta = buildActorMeta(built.captured.pathPoints, draftActor)
          intent = resolveScoringIntent(
            built.analysis,
            built.captured.pathPoints,
            entryId,
            null,
          )
          if (rawPath.length >= 2) {
            startCleanupAnimation(rawPath, idealPath, null)
          }
          recordShot({
            entryId,
            analysis: patchAnalysisForOrigin(built.analysis, draftActor),
            captured: built.captured,
            intent,
            awaitLoser: false,
            ...draftMeta,
          })
          gestureHapticComplete()
          return
        }

        const serveOrigin = shotOriginLockRef.current?.origin
        const looksLikeServe =
          servePending &&
          Boolean(serveOrigin) &&
          servingPlayerQuadrant &&
          effectiveServeSideQuadrant &&
          isServeCrossCourtStroke(
            buildServePath(gestureCaptured.pathPoints, serveOrigin!),
            servingPlayerQuadrant,
            effectiveServeSideQuadrant,
          )

        if (!awaitLoser && looksLikeServe) {
          wipeCanvas()
          return
        }

        if (!awaitLoser && !servePending && isIncompleteHorizontalStroke(gestureCaptured, analysis, { servePhase: servePending })) {
          const draft = createHorizStrokeDraft(entryId, gestureCaptured, analysis)
          if (draft) {
            applyHorizDraft(draft)
            persistHorizDraftOnCanvas()
            gestureHapticComplete()
            return
          }
          clearCanvas()
          return
        }

        if (!awaitLoser && servePending) {
          wipeCanvas()
          gestureHapticComplete()
          return
        }

        if (!awaitLoser) {
          intent = resolveScoringIntent(
            analysis,
            gestureCaptured.pathPoints,
            entryId,
            null,
          )
          if (!intent) {
            tryBeginPointExchange(analysis, { id: entryId } as GestureDebugEntry)
          }
        }

        if (rawPath.length >= 2 && !looksLikeServe && !servePending) {
          startCleanupAnimation(rawPath, idealPath, null)
        } else {
          wipeCanvas()
        }

        recordShot({
          entryId,
          analysis,
          captured: gestureCaptured,
          intent,
          awaitLoser,
          ...actorMeta,
        })
        gestureHapticComplete()
        return
      }
    }

    if (rawPath.length >= 2) {
      startCleanupAnimation(rawPath, idealPath, null)
    } else {
      wipeCanvas()
    }

    const entry = appendGestureDebugEntry(analysis, {
      competitionId,
      gameNumber,
      courtId,
      matchSessionId: courtSetupKey,
    })
    if (courtSetupKey) {
      if (!loadMatchSession(courtSetupKey)) {
        const startedAt = matchStartedAt ?? new Date().toISOString()
        ensureMatchSession({
          id: courtSetupKey,
          competitionId,
          gameNumber,
          courtId,
          matchStartedAt: startedAt,
          isFriendly,
        })
        if (!matchStartedAt) setMatchStartedAt(startedAt)
      }
      recordMatchGesture(courtSetupKey, entry.id, entry)
    }

    gestureHapticComplete()
    setDebugLog((prev) => [entry, ...prev.filter((e) => e.id !== entry.id)].slice(0, 120))
    onGesture?.(captured)
  }

  const handleAssignQuadrant = useCallback(
    (quadrant: Quadrant) => {
      if (pendingTeamPlacement) return
      const team = teamForQuadrant(quadrant)
      if (teamIsPlaced(team, assignments)) return
      const pair = sessionTeams?.[team === 'a' ? 'teamA' : 'teamB']
      if (!pair) return
      const placement = teamPlacementFromQuadrant(quadrant, pair)
      setPendingTeamPlacement({ team, placement })
    },
    [assignments, pendingTeamPlacement, sessionTeams],
  )

  const handleAcceptTeamPlacement = useCallback(() => {
    if (!pendingTeamPlacement) return
    const updated = { ...assignments, ...pendingTeamPlacement.placement }
    setAssignments(updated)
    setPendingTeamPlacement(null)
    if (isCompleteAssignment(roster, updated)) {
      setSetupPhase('serve')
      void syncMatchLogToServer({
        logStage: 'serve_pick',
        setup: { assignments: updated, setupPhase: 'serve', pendingTeamPlacement: null },
      })
    } else {
      void syncMatchLogToServer({
        logStage: 'player_positions',
        setup: { assignments: updated, pendingTeamPlacement: null },
      })
    }
  }, [assignments, pendingTeamPlacement, roster, syncMatchLogToServer])

  const handleSwapTeamPlacement = useCallback(() => {
    setPendingTeamPlacement((pending) => {
      if (!pending) return pending
      return {
        ...pending,
        placement: swapTeamPlacementSides(pending.team, pending.placement),
      }
    })
  }, [])

  const handleUndoTeamPlacement = useCallback(() => {
    setPendingTeamPlacement(null)
  }, [])

  const showPlacementPrompt =
    setupPhase === 'positions' &&
    !pendingTeamPlacement &&
    !isCompleteAssignment(roster, assignments)

  useEffect(() => {
    if (!courtSetupKey || !setupHydrated) return
    const scoreboardSource =
      setupPhase === 'ready' && isCompleteAssignment(roster, assignments)
        ? 'assignments'
        : needsSetup && setupPhase !== 'ready' && sessionTeams
          ? 'session-roster'
          : 'none'
    logPadUiSnapshot(courtSetupKey, {
      setupHydrated,
      setupPhase,
      assignments,
      padPlayers,
      showPlacementPrompt,
      pendingTeam: Boolean(pendingTeamPlacement),
      scoreboardSource,
    })
    // #region agent log
    const pendingPreview = pendingTeamPlacement
      ? COURT_QUADRANTS.filter((q) => pendingTeamPlacement.placement[q]?.name?.trim()).map((q) => ({
          q,
          name: pendingTeamPlacement.placement[q]!.name,
        }))
      : []
    agentDebugIngest(
      'GestureAnnotationPad.tsx:uiSnapshot',
      'pad ui state vs chip sources',
      {
        runId: 'post-fix',
        setupPhase,
        showPlacementPrompt,
        showTeamRails,
        scoreboardSource,
        assignmentChips: COURT_QUADRANTS.filter((q) => assignments[q]?.name?.trim()).map((q) => ({
          q,
          name: assignments[q]!.name,
        })),
        pendingPreviewChips: pendingPreview,
        padPlayerChips: COURT_QUADRANTS.filter((q) => padPlayers[q]?.name?.trim()).map((q) => ({
          q,
          name: padPlayers[q]!.name,
        })),
        coinPlacementKeys: Object.keys(coinPlacements),
        showPlayerActorPick,
        showQuadrantWatermarks,
      },
      showPlacementPrompt && COURT_QUADRANTS.some((q) => assignments[q]?.name?.trim()) ? 'A' : showTeamRails ? 'C' : 'E',
    )
    // #endregion
  }, [
    assignments,
    courtSetupKey,
    padPlayers,
    pendingTeamPlacement,
    roster,
    setupHydrated,
    setupPhase,
    showPlacementPrompt,
    needsSetup,
    sessionTeams,
    showTeamRails,
    coinPlacements,
    showPlayerActorPick,
    showQuadrantWatermarks,
    pendingTeamPlacement,
  ])

  const handlePickServe = (quadrant: Quadrant) => {
    if (!isCompleteAssignment(roster, assignments)) return
    setPendingServeQuadrant(quadrant)
    setSetupPhase('confirm_serve')
    void syncMatchLogToServer({
      logStage: 'confirm_serve',
      setup: { setupPhase: 'confirm_serve', pendingServeQuadrant: quadrant },
    })
  }

  const handleChangeServe = () => {
    setPendingServeQuadrant(null)
    setSetupPhase('serve')
    void syncMatchLogToServer({
      logStage: 'serve_pick',
      setup: { setupPhase: 'serve', pendingServeQuadrant: null },
    })
  }

  const handleConfirmServe = () => {
    const quadrant = pendingServeQuadrant
    if (!quadrant || !isCompleteAssignment(roster, assignments)) return
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
      startMatchSession({
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
    setPendingServeQuadrant(null)
    setSetupPhase('ready')
    setPastServeThisPoint(false)
    resetServeAttempt()
    void syncMatchLogToServer({
      logStage: 'match_ready',
      setup: {
        setupPhase: 'ready',
        initialServeQuadrant: quadrant,
        pendingServeQuadrant: null,
        score: INITIAL_TENNIS_SCORE,
        matchStartedAt: startedAt,
      },
    })
  }

  const showPointNavigator =
    Boolean(matchStartedAt) &&
    setupPhase === 'ready' &&
    (!matchComplete || reviewMode) &&
    (needsSetup || Boolean(courtSetupKey))
  const showMatchTimer =
    Boolean(matchStartedAt) && setupPhase === 'ready' && !matchComplete

  return (
    <div
      className={`gesture-pad-root relative flex h-full min-h-0 flex-1 flex-col${
        rotatePad ? ' gesture-pad-rotated' : ''
      }`}
    >
      <div className="gesture-pad-header shrink-0 flex flex-col items-center gap-1 px-2 pb-1.5 sm:px-3 sm:pb-2">
        <div className="relative flex w-full justify-center">
          <div
            className="gesture-scoreboard-backdrop pointer-events-none absolute inset-x-0 inset-y-0"
            aria-hidden
          />
          <div className="relative flex w-full max-w-3xl items-stretch">
            <GesturePadScoreboard
              score={displayScore}
              gameLabel={gameLabel}
              matchElapsed={showMatchTimer ? matchElapsed : undefined}
              teamA={
                showTeamRails && scoreboardAssignments
                  ? [scoreboardAssignments.TL, scoreboardAssignments.TR]
                  : undefined
              }
              teamB={
                showTeamRails && scoreboardAssignments
                  ? [scoreboardAssignments.BL, scoreboardAssignments.BR]
                  : undefined
              }
              highlightPlayerKey={positionHighlightKey}
            />
          </div>
        </div>
      </div>
      <div
        ref={padRef}
        className="gesture-court-pad touch-none select-none"
        onPointerDown={(e) => {
          const target = e.target as HTMLElement
          if (target.closest('[data-player-coin], [data-rally-shot]')) return
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
        {!reviewMode ? (
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setShowResetConfirm(true)}
            className="absolute right-1.5 top-1.5 z-[8] rounded-full bg-black/45 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white/90 backdrop-blur-sm sm:right-2 sm:top-2"
          >
            Reset
          </button>
        ) : null}
        {!reviewMode && !matchComplete ? (
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => {
              setServeLiveLanding(null)
              setServeMode((v) => !v)
            }}
            className={`absolute right-1.5 top-9 z-[8] rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm transition-colors sm:right-2 sm:top-10 ${
              serveMode
                ? 'bg-amber-400 text-black'
                : 'bg-black/45 text-white/90'
            }`}
          >
            Serve
          </button>
        ) : null}
        {ballPathRally || ballPathGlassFinish ? (
          <div className="pointer-events-none absolute right-1.5 top-16 z-[7] sm:right-2 sm:top-[4.5rem]">
            <ShotDrawKey />
          </div>
        ) : null}
        {showResetConfirm ? (
          <div
            className="absolute inset-0 z-[30] flex items-center justify-center bg-black/60 p-4"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="w-full max-w-xs rounded-2xl bg-[#10233b] p-4 text-center text-white shadow-xl">
              <p className="text-sm font-bold">Reset this court?</p>
              <p className="mt-1 text-xs text-white/70">
                This clears the score, shots and setup, then starts again from player setup.
              </p>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowResetConfirm(false)}
                  className="flex-1 rounded-lg bg-white/10 py-2 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowResetConfirm(false)
                    void handleResetCourt()
                  }}
                  className="flex-1 rounded-lg bg-rose-600 py-2 text-xs font-bold"
                >
                  Reset
                </button>
              </div>
            </div>
          </div>
        ) : null}
        <div className={`absolute ${COURT_INSET} z-[2] flex items-center justify-center overflow-visible`}>
          <div className={`relative ${COURT_ASPECT_BOX}`}>
            <PadelCourtEnclosure
              glassBandFeedback={enclosureHighlightOn}
              startGlassBand={enclosureStartBand}
              activeGlassBand={enclosureActiveBand}
            />
            {ballPathGlassFinish && pendingBallPath && courtInset ? (
              <GlassAnchorDrag
                padRef={padRef}
                rotatePad={rotatePad}
                anchorPad={
                  pendingBallPath.glassAnchorPad ?? pendingBallPath.line[pendingBallPath.line.length - 1]!
                }
                courtInset={courtInset}
                onMove={handleGlassAnchorMove}
                onLock={handleGlassAnchorLock}
              />
            ) : null}
            {(isDrawing && rallyDrawHalf && !serveMode) || serveMode
              ? (() => {
                  // Frame hugging just OUTSIDE the glass/cage (not on them) — the
                  // reachable "ball left the court = out" ring around the court.
                  const gW = PADEL_ENCLOSURE_FULL_DEPTH_ALONG_WIDTH_FR
                  const gL = PADEL_ENCLOSURE_FULL_DEPTH_ALONG_LENGTH_FR
                  // Side walls only run out to the glass depth, so fill the red in
                  // from there (no blue gap between wall and the Out band).
                  const gWside = PADEL_ENCLOSURE_GLASS_DEPTH_ALONG_WIDTH_FR
                  const tW = 0.13
                  const tL = 0.065
                  const bg = 'rgba(239,68,68,0.24)'
                  const lbl =
                    'text-[8px] font-bold uppercase tracking-widest text-white/90'
                  return (
                    <div className="pointer-events-none absolute inset-0 z-[1]" aria-hidden>
                      <div
                        className="absolute flex items-center justify-center"
                        style={{ left: pct(-(gW + tW)), width: pct(1 + 2 * (gW + tW)), top: pct(-(gL + tL)), height: pct(tL), backgroundColor: bg }}
                      >
                        <span className={lbl}>Out</span>
                      </div>
                      <div
                        className="absolute flex items-center justify-center"
                        style={{ left: pct(-(gW + tW)), width: pct(1 + 2 * (gW + tW)), bottom: pct(-(gL + tL)), height: pct(tL), backgroundColor: bg }}
                      >
                        <span className={lbl}>Out</span>
                      </div>
                      <div
                        className="absolute flex items-center justify-center"
                        style={{ left: pct(-(gW + tW)), width: pct(gW + tW - gWside), top: pct(-gL), height: pct(1 + 2 * gL), backgroundColor: bg }}
                      >
                        <span className={`${lbl} [writing-mode:vertical-rl] rotate-180`}>Out</span>
                      </div>
                      <div
                        className="absolute flex items-center justify-center"
                        style={{ right: pct(-(gW + tW)), width: pct(gW + tW - gWside), top: pct(-gL), height: pct(1 + 2 * gL), backgroundColor: bg }}
                      >
                        <span className={`${lbl} [writing-mode:vertical-rl]`}>Out</span>
                      </div>
                    </div>
                  )
                })()
              : null}
            <div className="absolute inset-0" data-court-surface>
            <div className="pointer-events-none absolute inset-0" aria-hidden>
              <PadelCourtMarkings />
            </div>
            {isDrawing && rallyDrawHalf && !serveMode ? (
              <>
                <div
                  className="pointer-events-none absolute inset-x-0 z-[2] flex items-start justify-center"
                  style={{
                    top: pct(rallyDrawHalf === 'top' ? PADEL_NET_Y : 0),
                    height: pct(PADEL_NET_Y),
                    paddingTop: pct(0.04),
                    backgroundColor: 'rgba(34,197,94,0.16)',
                  }}
                  aria-hidden
                >
                  <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-50/80">
                    In
                  </span>
                </div>
                <div
                  className="pointer-events-none absolute inset-x-0 z-[3] flex items-center justify-center"
                  style={{
                    top: pct(
                      rallyDrawHalf === 'top'
                        ? PADEL_NET_Y - NET_SHORT_APPROACH_COURT
                        : PADEL_NET_Y,
                    ),
                    height: pct(NET_SHORT_APPROACH_COURT),
                    backgroundColor: 'rgba(239,68,68,0.26)',
                    boxShadow: 'inset 0 0 0 2px rgba(239,68,68,0.6)',
                  }}
                  aria-hidden
                >
                  <span className="text-[9px] font-bold uppercase tracking-wider text-white/90">
                    Net
                  </span>
                </div>
              </>
            ) : null}
            {serveMode && effectiveServeSideQuadrant
              ? (() => {
                  const serveSide = effectiveServeSideQuadrant
                  const receive = serveReceiveQuadrant(serveSide)
                  const wrongBox = partnerQuadrant(receive)
                  const serverTop = serveSide === 'TL' || serveSide === 'TR'
                  const receiveTop = receive === 'TL' || receive === 'TR'
                  const redBg = 'rgba(239,68,68,0.22)'
                  const redEdge = 'inset 0 0 0 2px rgba(239,68,68,0.55)'
                  const zone = (
                    box: { xMin: number; xMax: number; yMin: number; yMax: number },
                    label?: string,
                    z = 2,
                  ) => (
                    <div
                      key={`${box.xMin}-${box.yMin}-${label ?? 'foul'}`}
                      className={`pointer-events-none absolute flex items-center justify-center rounded-sm ${label ? '' : ''}`}
                      style={{
                        left: pct(box.xMin),
                        top: pct(box.yMin),
                        width: pct(box.xMax - box.xMin),
                        height: pct(box.yMax - box.yMin),
                        backgroundColor: redBg,
                        boxShadow: redEdge,
                        zIndex: z,
                      }}
                      aria-hidden
                    >
                      {label ? (
                        <span className="text-[8px] font-bold uppercase tracking-wider text-white/90">
                          {label}
                        </span>
                      ) : null}
                    </div>
                  )
                  const sb = serveStartBoxBounds(serveSide)
                  const good = serviceBoxBounds(receive)
                  const wrong = serviceBoxBounds(wrongBox)
                  const receiveBack = receiveTop
                    ? { xMin: 0, xMax: 1, yMin: 0, yMax: PADEL_SERVICE_LINE_TOP_Y }
                    : { xMin: 0, xMax: 1, yMin: PADEL_SERVICE_LINE_BOTTOM_Y, yMax: 1 }
                  const serverHalf = serverTop
                    ? { xMin: 0, xMax: 1, yMin: 0, yMax: PADEL_NET_Y }
                    : { xMin: 0, xMax: 1, yMin: PADEL_NET_Y, yMax: 1 }
                  const serverNet = serverTop
                    ? {
                        xMin: 0,
                        xMax: 1,
                        yMin: PADEL_SERVICE_LINE_TOP_Y,
                        yMax: PADEL_NET_Y,
                      }
                    : {
                        xMin: 0,
                        xMax: 1,
                        yMin: PADEL_NET_Y,
                        yMax: PADEL_SERVICE_LINE_BOTTOM_Y,
                      }
                  return (
                    <>
                      {zone(serverHalf)}
                      {zone(serverNet, 'Net', 3)}
                      {zone(wrong, 'Out')}
                      {zone(receiveBack, 'Out')}
                      <div
                        className="pointer-events-none absolute z-[2] rounded-sm"
                        style={{
                          left: pct(sb.xMin),
                          top: pct(sb.yMin),
                          width: pct(sb.xMax - sb.xMin),
                          height: pct(sb.yMax - sb.yMin),
                          backgroundColor: 'rgba(250,204,21,0.12)',
                          boxShadow: 'inset 0 0 0 2px rgba(250,204,21,0.7)',
                        }}
                        aria-hidden
                      />
                      <div
                        className="pointer-events-none absolute z-[4] flex items-start justify-center rounded-sm"
                        style={{
                          left: pct(good.xMin),
                          top: pct(good.yMin),
                          width: pct(good.xMax - good.xMin),
                          height: pct(good.yMax - good.yMin),
                          paddingTop: pct(0.02),
                          backgroundColor: 'rgba(34,197,94,0.28)',
                          boxShadow: 'inset 0 0 0 2px rgba(34,197,94,0.85)',
                        }}
                        aria-hidden
                      >
                        <span className="text-[8px] font-bold uppercase tracking-wider text-white/90">
                          Serve
                        </span>
                      </div>
                    </>
                  )
                })()
              : null}
            {showPlayerActorPick && watermarkPlayers ? (
              <PlayerShotOriginDrag
                players={watermarkPlayers}
                padRef={padRef}
                rotatePad={rotatePad}
                coinPlacements={coinPlacements}
                activeOrigin={shotOriginLock}
                freezeCoins={ballPathGlassFinish}
                draggableQuadrant={
                  pendingBallPath?.phase === 'glass_finish'
                    ? null
                    : (pendingBallPath?.defenderQuadrant ?? null)
                }
                draggableTeam={
                  pendingBallPath
                    ? null
                    : pointExchangePhase === 'await_loser' && pendingPoint
                      ? pendingPoint.loserTeam
                      : null
                }
                servingQuadrant={serveUiActive ? servingPlayerQuadrant : null}
                servePlayerQuadrant={serveUiActive ? servingPlayerQuadrant : null}
                serveSideQuadrant={serveUiActive ? effectiveServeSideQuadrant : null}
                servePending={serveUiActive}
                serveAttempt={serveUiActive ? serveAttempt : null}
                attackerQuadrant={pendingBallPath?.attackerQuadrant ?? null}
                defenderQuadrant={pendingBallPath?.defenderQuadrant ?? null}
                currentUserId={currentUserId}
                currentUserAvatarUrl={currentUserAvatarUrl}
                onDragActiveChange={(active) => {
                  playerDragRef.current = active
                }}
                onOriginMove={
                  pendingBallPath && pendingBallPath.phase !== 'glass_finish'
                    ? handleDefenderReachMove
                    : undefined
                }
                onLockOrigin={
                  pendingBallPath && pendingBallPath.phase !== 'glass_finish'
                    ? handleDefenderReachLock
                    : handleLockOrigin
                }
              />
            ) : null}
            {pendingBallPath &&
            pendingBallPath.phase !== 'glass_finish' ? (
              <>
                <RallyShotWheel
                  anchor={wheelAnchor(
                    pendingBallPath.line[0]!,
                    courtInset,
                  )}
                  quadrant={pendingBallPath.attackerQuadrant}
                  role="attacker"
                  selectedPick={
                    pendingBallPath.attackerShot != null &&
                    pendingBallPath.attackerShotAngleDeg != null
                      ? {
                          shot: pendingBallPath.attackerShot,
                          angleDeg: pendingBallPath.attackerShotAngleDeg,
                        }
                      : undefined
                  }
                  wave={pendingBallPath.attackerWave}
                  power={pendingBallPath.attackerPower}
                  interactive
                  onPick={handleAttackerShotPick}
                  onAngleChange={handleAttackerShotAngle}
                  onWaveChange={handleAttackerWave}
                  onPowerChange={handleAttackerPower}
                  onDeselect={handleAttackerShotDeselect}
                />
                <RallyShotWheel
                  anchor={wheelAnchor(
                    pendingBallPath.defenderReachPad ??
                      pendingBallPath.line[pendingBallPath.line.length - 1]!,
                    courtInset,
                  )}
                  quadrant={pendingBallPath.defenderQuadrant}
                  role="defender"
                  selectedPick={
                    pendingBallPath.defenderShot != null &&
                    pendingBallPath.defenderShotAngleDeg != null
                      ? {
                          shot: pendingBallPath.defenderShot,
                          angleDeg: pendingBallPath.defenderShotAngleDeg,
                        }
                      : undefined
                  }
                  wave={pendingBallPath.defenderWave}
                  power={pendingBallPath.defenderPower}
                  interactive
                  onPick={handleDefenderShotPick}
                  onAngleChange={handleDefenderShotAngle}
                  onWaveChange={handleDefenderWave}
                  onPowerChange={handleDefenderPower}
                  onDeselect={handleDefenderShotDeselect}
                />
              </>
            ) : null}
            {pendingBallPath?.phase === 'confirm' ? (
              <BallPathConfirmBar
                onCancel={handleBallPathCancel}
                onAccept={handleBallPathAccept}
              />
            ) : null}
            {needsSetup && setupPhase === 'positions' ? (
              <CourtPositionSetup
                assignments={positionVisibleAssignments}
                wizardPlayer={positionWizardPlayer}
                pendingConfirm={pendingTeamPlacement != null}
                showPlacementPrompt={showPlacementPrompt}
                highlightPlayerKey={positionHighlightKey}
                onAssignQuadrant={handleAssignQuadrant}
                onAcceptTeam={handleAcceptTeamPlacement}
                onSwapTeam={handleSwapTeamPlacement}
                onUndoTeam={handleUndoTeamPlacement}
              />
            ) : null}
            {needsSetup && (setupPhase === 'serve' || setupPhase === 'confirm_serve') ? (
              <CourtServeSetup
                phase={setupPhase === 'serve' ? 'serve' : 'confirm_serve'}
                pendingServe={pendingServeQuadrant}
                assignments={assignments}
                onPickServe={handlePickServe}
                onConfirmServe={handleConfirmServe}
                onChangeServe={handleChangeServe}
              />
            ) : null}
            </div>
          </div>
        </div>
        <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 z-[4] touch-none" />
        <div
          className={`pointer-events-none absolute ${COURT_INSET} z-[1] flex items-center justify-center`}
        >
          <div className={`${COURT_ASPECT_BOX} grid grid-cols-2 grid-rows-2`}>
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
                  : quadrantHighlightClass(
                      label,
                      startQuadrant,
                      courtActiveQuadrant,
                      isDrawing,
                    )
              }
            />
          ))}
          </div>
        </div>
        {horizVerdictLabel ? <HorizVerdictPrompt label={horizVerdictLabel} /> : null}

        {matchComplete && matchWinnerTeam && !reviewMode ? (
          <GesturePadMatchComplete
            score={tennisScore}
            winner={matchWinnerTeam}
            submitting={submittingMatch}
            submitted={matchSubmitted}
            error={submitError}
            savedLocally={!matchLogSaved}
            playerStats={matchPlayerStats}
            onSelectPlayer={setStatsPlayer}
            onClose={onMatchClosed}
          />
        ) : null}

        {statsPlayer ? (
          <PlayerGameStatsModal stats={statsPlayer} onClose={() => setStatsPlayer(null)} />
        ) : null}

        {showPointNavigator ? (
          <GesturePadGameLog
            events={pointEventsChrono}
            gestures={sessionGestures}
            playerNames={playerNames}
            reviewIndex={reviewPointIndex}
            onSelectPoint={handleSelectLogPoint}
            onResetToPoint={handleResetToPoint}
          />
        ) : null}
      </div>
    </div>
  )
}
