import { gestureShotLabel } from './gestureAnalysis'
import { COURT_QUADRANTS } from './courtPositionSetup'
import type { GestureDebugEntry } from './gestureDebugLog'
import type { GameLogSetupState } from './gameLogSetupState'
import { classifyGestureShot } from './gestureHelpCounts'
import type { Quadrant } from './gestureCapture'
import type { QuadrantPlayers } from './gesturePadPlayers'
import { quadrantTeam } from './gestureScoring'
import type { MatchPointEvent, PlayerStatsSnapshot } from './matchSessionLog'
import type { RallyWheelShot, ShotWaveOption } from './rallyShotWheel'
import type { MatchTeam } from './types'
import type { TennisScore } from './tennisScore'

export type GameLogPoint = {
  at: string
  winner: MatchTeam
  scoreAfter: TennisScore
  winnerGestureId: string
  loserGestureId: string
  winnerQuadrant: string
  loserQuadrant: string
  isServe: boolean
}

export type GameLogGesture = {
  id: string
  at: string
  startQuadrant: Quadrant
  endQuadrant: Quadrant
  team: MatchTeam
  shape: string
  shotCategory: string
  shotLabel: string
  shotZone: string
  durationMs: number
  start: { x: number; y: number }
  end: { x: number; y: number }
  actorQuadrant?: Quadrant
  heatMapPoint?: { x: number; y: number; half: 'top' | 'bottom' }
  heatMapStart?: { x: number; y: number; half: 'top' | 'bottom' }
  heatMapEnd?: { x: number; y: number; half: 'top' | 'bottom' }
  heatMapPath?: { x: number; y: number }[]
  drawPath?: { x: number; y: number }[]
  /** Rebound polyline incl. wall/cage bounce vertices. */
  anchors?: { x: number; y: number }[]
  /** Outcome report text (e.g. "FH→BH · Off the glass"). */
  report?: string
  /** Rally exchange — wheel picks, spin/extension, and shot power. */
  attackerShot?: RallyWheelShot
  defenderShot?: RallyWheelShot
  attackerWave?: ShotWaveOption
  defenderWave?: ShotWaveOption
  attackerPower?: number
  defenderPower?: number
  scoringIntent?: 'second_serve' | 'serve_in' | 'foul'
}

export type GameLogRosterSlot = {
  quadrant: Quadrant
  playerId: string | null
  name: string
}

export type GameLogPayload = {
  courtSetupKey: string
  friendlySessionId: string | null
  competitionId: string | null
  gameNumber: string | null
  courtId: string | null
  matchStartedAt: string
  matchEndedAt: string | null
  finalScore: TennisScore | null
  winner: MatchTeam | null
  playerStats: PlayerStatsSnapshot[]
  pointEvents: GameLogPoint[]
  gestures: GameLogGesture[]
  roster: GameLogRosterSlot[]
  setupState: GameLogSetupState
}

function roundCoord(n: number): number {
  return Math.round(n * 1000) / 1000
}

function point(p: { x: number; y: number }) {
  return { x: roundCoord(p.x), y: roundCoord(p.y) }
}

export function toGameLogGesture(entry: GestureDebugEntry): GameLogGesture {
  const shotLabel =
    gestureShotLabel(entry.shape, {
      smashVerdict: entry.smashVerdict,
      lobVerdict: entry.lobVerdict,
      volleyVerdict: entry.volleyVerdict,
      startQuadrant: entry.startQuadrant,
      start: entry.start,
      end: entry.end,
    }) ?? entry.shapeLabel

  return {
    id: entry.id,
    at: entry.at,
    startQuadrant: entry.startQuadrant,
    endQuadrant: entry.endQuadrant,
    team: quadrantTeam(entry.startQuadrant),
    shape: entry.shape,
    shotCategory: classifyGestureShot(entry),
    shotLabel,
    shotZone: entry.shotZone,
    durationMs: Math.round(entry.durationMs),
    start: point(entry.start),
    end: point(entry.end),
    ...(entry.actorQuadrant ? { actorQuadrant: entry.actorQuadrant } : {}),
    ...(entry.heatMapPoint ? { heatMapPoint: entry.heatMapPoint } : {}),
    ...(entry.heatMapStart ? { heatMapStart: entry.heatMapStart } : {}),
    ...(entry.heatMapEnd ? { heatMapEnd: entry.heatMapEnd } : {}),
    ...(entry.heatMapPath?.length ? { heatMapPath: entry.heatMapPath.map(point) } : {}),
    ...(entry.drawPath?.length ? { drawPath: entry.drawPath.map(point) } : {}),
    ...(entry.anchors?.length
      ? { anchors: entry.anchors.map(point) }
      : entry.pathSample.length >= 2
        ? { anchors: entry.pathSample.map(point) }
        : {}),
    ...(entry.report ? { report: entry.report } : {}),
    ...(entry.attackerShot ? { attackerShot: entry.attackerShot } : {}),
    ...(entry.defenderShot ? { defenderShot: entry.defenderShot } : {}),
    ...(entry.attackerWave ? { attackerWave: entry.attackerWave } : {}),
    ...(entry.defenderWave ? { defenderWave: entry.defenderWave } : {}),
    ...(entry.attackerPower != null ? { attackerPower: entry.attackerPower } : {}),
    ...(entry.defenderPower != null ? { defenderPower: entry.defenderPower } : {}),
    ...(entry.scoringIntent ? { scoringIntent: entry.scoringIntent } : {}),
  }
}

export function toGameLogGestures(entries: GestureDebugEntry[]): GameLogGesture[] {
  return entries.map(toGameLogGesture)
}

export function toGameLogPoint(event: MatchPointEvent): GameLogPoint {
  return {
    at: event.at,
    winner: event.winner,
    scoreAfter: event.scoreAfter,
    winnerGestureId: event.winnerGestureId,
    loserGestureId: event.loserGestureId,
    winnerQuadrant: event.winnerQuadrant,
    loserQuadrant: event.loserQuadrant,
    isServe: Boolean(event.isServe),
  }
}

function scoringIntentFromGesture(g: GameLogGesture): GestureDebugEntry['scoringIntent'] {
  if (g.scoringIntent) return g.scoringIntent
  const report = g.report ?? ''
  if (/serve in/i.test(report)) return 'serve_in'
  if (/second serve/i.test(report)) return 'second_serve'
  if (/foul/i.test(report)) return 'foul'
  return undefined
}

/** Rebuild a debug-log gesture entry from a stored game-log gesture (review). */
export function fromGameLogGesture(g: GameLogGesture): GestureDebugEntry {
  const sample = g.anchors?.length ? g.anchors : [g.start, g.end]
  return {
    id: g.id,
    at: g.at,
    code: g.shotCategory || 'review',
    report: g.report || g.shotLabel || '',
    shape: g.shape as GestureDebugEntry['shape'],
    shapeLabel: g.shotLabel || g.shape,
    smashVerdict: null,
    lobVerdict: null,
    volleyVerdict: null,
    backhandDirection: null,
    startQuadrant: g.startQuadrant,
    endQuadrant: g.endQuadrant,
    quadrantSequence: `${g.startQuadrant}${g.endQuadrant}`,
    quadrantsVisited: [g.startQuadrant, g.endQuadrant],
    crossingCount: 0,
    durationMs: g.durationMs,
    pointCount: sample.length,
    pathLength: 0,
    angleDeg: 0,
    direction: '',
    xSpread: 0,
    ySpread: 0,
    straightness: 1,
    gridPath: '',
    pathSignature: '',
    patternKey: '',
    start: g.start,
    end: g.end,
    pathSample: sample,
    shotZone: g.shotZone as GestureDebugEntry['shotZone'],
    actorQuadrant: g.actorQuadrant,
    heatMapPoint: g.heatMapPoint,
    heatMapStart: g.heatMapStart,
    heatMapEnd: g.heatMapEnd,
    heatMapPath: g.heatMapPath,
    drawPath: g.drawPath,
    anchors: g.anchors,
    attackerShot: g.attackerShot,
    defenderShot: g.defenderShot,
    attackerWave: g.attackerWave,
    defenderWave: g.defenderWave,
    attackerPower: g.attackerPower,
    defenderPower: g.defenderPower,
    scoringIntent: scoringIntentFromGesture(g),
  }
}

/** Rebuild a match point event from a stored game-log point (review). */
export function fromGameLogPoint(p: GameLogPoint): MatchPointEvent {
  return {
    at: p.at,
    winner: p.winner,
    scoreAfter: p.scoreAfter,
    winnerGestureId: p.winnerGestureId,
    loserGestureId: p.loserGestureId,
    winnerQuadrant: p.winnerQuadrant,
    loserQuadrant: p.loserQuadrant,
    isServe: p.isServe,
    gestureId: p.winnerGestureId,
  }
}

export function toGameLogRoster(assignments: QuadrantPlayers | null): GameLogRosterSlot[] {
  if (!assignments) return []
  return COURT_QUADRANTS.map((quadrant) => ({
    quadrant,
    playerId: assignments[quadrant]?.id ?? null,
    name: assignments[quadrant]?.name?.trim() ?? '',
  })).filter((slot) => slot.name)
}
