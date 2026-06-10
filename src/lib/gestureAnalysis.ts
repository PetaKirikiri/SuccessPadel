import {
  playerLabel,
  quadrantFromPoint,
  type CapturedGesture,
  type NormalizedPoint,
  type Quadrant,
} from './gestureCapture'
import { courtShotZoneFromPoint, isVolleyZoneStart, type CourtShotZone } from './padelCourtLayout'

export type GestureShape =
  | 'SMASH'
  | 'BACKHAND'
  | 'FOREHAND'
  | 'VOLLEY'
  | 'LOB'
  | 'LINE_V'
  | 'CURVE'
  | 'TAP'
export type SmashVerdict = 'WIN' | 'FOUL'
export type LobVerdict = 'WIN' | 'FOUL'
export type VolleyVerdict = 'SCORE' | 'FOUL'
export type BackhandDirection = 'L_TO_R' | 'R_TO_L'

export type GestureAnalysis = {
  code: string
  report: string
  shape: GestureShape
  shapeLabel: string
  smashVerdict: SmashVerdict | null
  lobVerdict: LobVerdict | null
  volleyVerdict: VolleyVerdict | null
  backhandDirection: BackhandDirection | null
  startQuadrant: Quadrant
  endQuadrant: Quadrant
  quadrantSequence: string
  quadrantsVisited: Quadrant[]
  crossingCount: number
  durationMs: number
  pointCount: number
  pathLength: number
  angleDeg: number
  direction: string
  xSpread: number
  ySpread: number
  straightness: number
  gridPath: string
  pathSignature: string
  patternKey: string
  start: NormalizedPoint
  end: NormalizedPoint
  pathSample: NormalizedPoint[]
  /** Collapsed anchor path — hold jitter at the end removed. */
  anchors?: NormalizedPoint[]
  /** End of the horizontal leg (anchor 2). Win/loss measured from here. */
  strokeCorner?: NormalizedPoint | null
  /** Meaningful finish after the horizontal leg — not hold noise. */
  finishPoint?: NormalizedPoint | null
  shotZone: CourtShotZone
}

/** Vertical straight stroke — x stays tight, y moves (overhead smash). */
export const SMASH_X_SPREAD_MAX = 0.09
export const SMASH_Y_SPREAD_MIN = 0.1
export const SMASH_STRAIGHTNESS_MIN = 0.8
/** Min vertical travel to call smash direction (y grows downward on screen). */
export const SMASH_DIRECTION_MIN = 0.05
export const BACKHAND_DIRECTION_MIN = 0.05
export const VOLLEY_LEG_MIN = 0.07
export const VOLLEY_STRAIGHTNESS_MAX = 0.72
export const VOLLEY_CORNER_MIN_DEG = 55
export const VOLLEY_CORNER_MAX_DEG = 130
export const VOLLEY_DIRECTION_MIN = 0.04
export const VOLLEY_END_BOTTOM_Y = 0.52

const DIRECTIONS = ['E', 'NE', 'N', 'NW', 'W', 'SW', 'S', 'SE'] as const

function segmentLength(a: NormalizedPoint, b: NormalizedPoint): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  return Math.hypot(dx, dy)
}

export function pathLength(points: NormalizedPoint[]): number {
  let total = 0
  for (let i = 1; i < points.length; i++) {
    total += segmentLength(points[i - 1], points[i])
  }
  return total
}

export function quadrantSequence(points: NormalizedPoint[]): string {
  const parts: Quadrant[] = []
  let last: Quadrant | null = null
  for (const point of points) {
    const q = quadrantFromPoint(point)
    if (q !== last) {
      parts.push(q)
      last = q
    }
  }
  return parts.join('>')
}

export function quadrantsVisited(points: NormalizedPoint[]): Quadrant[] {
  const seen = new Set<Quadrant>()
  const order: Quadrant[] = []
  for (const point of points) {
    const q = quadrantFromPoint(point)
    if (!seen.has(q)) {
      seen.add(q)
      order.push(q)
    }
  }
  return order
}

export function crossingCount(points: NormalizedPoint[]): number {
  let count = 0
  let last: Quadrant | null = null
  for (const point of points) {
    const q = quadrantFromPoint(point)
    if (last && q !== last) count++
    last = q
  }
  return count
}

export function angleDeg(start: NormalizedPoint, end: NormalizedPoint): number {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const rad = Math.atan2(-dy, dx)
  let deg = (rad * 180) / Math.PI
  if (deg < 0) deg += 360
  return Math.round(deg)
}

export function directionBucket(deg: number): string {
  const idx = Math.round(deg / 45) % 8
  return DIRECTIONS[idx]
}

function pointAtProgress(points: NormalizedPoint[], progress: number): NormalizedPoint {
  if (points.length === 0) return { x: 0, y: 0 }
  if (points.length === 1 || progress <= 0) return points[0]
  if (progress >= 1) return points[points.length - 1]

  const total = pathLength(points)
  if (total === 0) return points[0]

  const target = total * progress
  let walked = 0
  for (let i = 1; i < points.length; i++) {
    const seg = segmentLength(points[i - 1], points[i])
    if (walked + seg >= target) {
      const t = (target - walked) / seg
      return {
        x: points[i - 1].x + (points[i].x - points[i - 1].x) * t,
        y: points[i - 1].y + (points[i].y - points[i - 1].y) * t,
      }
    }
    walked += seg
  }
  return points[points.length - 1]
}

export function resamplePath(points: NormalizedPoint[], count = 24): NormalizedPoint[] {
  if (points.length === 0) return []
  if (points.length === 1) return [points[0]]
  return Array.from({ length: count }, (_, i) => pointAtProgress(points, i / (count - 1)))
}

function gridCell(point: NormalizedPoint, size: number): number {
  const col = Math.min(size - 1, Math.floor(point.x * size))
  const row = Math.min(size - 1, Math.floor(point.y * size))
  return row * size + col
}

export function gridPath(points: NormalizedPoint[], size = 4): string {
  const cells: number[] = []
  let last = -1
  for (const point of points) {
    const cell = gridCell(point, size)
    if (cell !== last) {
      cells.push(cell)
      last = cell
    }
  }
  return cells.join('-')
}

function roundPoint(point: NormalizedPoint, digits = 3): NormalizedPoint {
  const scale = 10 ** digits
  return {
    x: Math.round(point.x * scale) / scale,
    y: Math.round(point.y * scale) / scale,
  }
}

export function pathSignature(points: NormalizedPoint[]): string {
  return resamplePath(points, 16)
    .map((p) => roundPoint(p, 2))
    .map((p) => `${p.x},${p.y}`)
    .join('|')
}

export function pathSpread(points: NormalizedPoint[]): { xSpread: number; ySpread: number } {
  if (points.length === 0) return { xSpread: 0, ySpread: 0 }

  let minX = 1
  let maxX = 0
  let minY = 1
  let maxY = 0
  for (const point of points) {
    minX = Math.min(minX, point.x)
    maxX = Math.max(maxX, point.x)
    minY = Math.min(minY, point.y)
    maxY = Math.max(maxY, point.y)
  }
  return { xSpread: maxX - minX, ySpread: maxY - minY }
}

export function straightness(points: NormalizedPoint[]): number {
  if (points.length < 2) return 0
  const total = pathLength(points)
  if (total === 0) return 0
  return segmentLength(points[0], points[points.length - 1]) / total
}

const LINE_SPREAD_MAX = 0.09
const LINE_TRAVEL_MIN = 0.1
const LINE_STRAIGHTNESS_MIN = 0.8
const TAP_LENGTH_MAX = 0.06

function turnAngleDeg(a: NormalizedPoint, b: NormalizedPoint, c: NormalizedPoint): number {
  const v1x = b.x - a.x
  const v1y = b.y - a.y
  const v2x = c.x - b.x
  const v2y = c.y - b.y
  const m1 = Math.hypot(v1x, v1y)
  const m2 = Math.hypot(v2x, v2y)
  if (m1 === 0 || m2 === 0) return 0
  const dot = (v1x * v2x + v1y * v2y) / (m1 * m2)
  return (Math.acos(Math.min(1, Math.max(-1, dot))) * 180) / Math.PI
}

function findLCornerIndex(points: NormalizedPoint[]): number | null {
  const sampled = resamplePath(points, 16)
  if (sampled.length < 3) return null

  let bestIdx = -1
  let bestTurn = 0
  for (let i = 1; i < sampled.length - 1; i++) {
    const turn = turnAngleDeg(sampled[i - 1]!, sampled[i]!, sampled[i + 1]!)
    if (turn > bestTurn) {
      bestTurn = turn
      bestIdx = i
    }
  }

  if (bestIdx < 0 || bestTurn < VOLLEY_CORNER_MIN_DEG || bestTurn > VOLLEY_CORNER_MAX_DEG) {
    return null
  }

  const leg1 = pathLength(sampled.slice(0, bestIdx + 1))
  const leg2 = pathLength(sampled.slice(bestIdx))
  const total = pathLength(sampled)
  if (total === 0 || leg1 / total < 0.2 || leg2 / total < 0.2) return null

  return bestIdx
}

export const LOB_STRAIGHTNESS_MIN = 0.75
export const LOB_LEG_MIN = 0.07
/** Reject near-vertical / near-horizontal — lob is a diagonal line. */
export const LOB_DIAG_RATIO_MIN = 0.35
export const LOB_DIAG_RATIO_MAX = 2.8

export function isLobDiagonalShape(points: NormalizedPoint[]): boolean {
  if (points.length < 2) return false

  const { xSpread, ySpread } = pathSpread(points)
  if (xSpread < LOB_LEG_MIN || ySpread < LOB_LEG_MIN) return false
  if (straightness(points) < LOB_STRAIGHTNESS_MIN) return false

  const ratio = xSpread / Math.max(ySpread, 1e-6)
  return ratio >= LOB_DIAG_RATIO_MIN && ratio <= LOB_DIAG_RATIO_MAX
}

export function isVolleyLShape(points: NormalizedPoint[]): boolean {
  if (points.length < 3) return false

  const { xSpread, ySpread } = pathSpread(points)
  if (xSpread < VOLLEY_LEG_MIN || ySpread < VOLLEY_LEG_MIN) return false
  if (straightness(points) >= VOLLEY_STRAIGHTNESS_MAX) return false

  return findLCornerIndex(points) !== null
}

function horizontalShotShape(
  points: NormalizedPoint[],
  startQuadrant: Quadrant,
  opts: { strict: boolean },
): GestureShape | null {
  const { xSpread, ySpread } = pathSpread(points)
  const straight = straightness(points)
  const start = points[0]!
  const end = points[points.length - 1]!

  const isLineH = opts.strict
    ? straight >= LINE_STRAIGHTNESS_MIN &&
      xSpread >= LINE_TRAVEL_MIN &&
      ySpread <= LINE_SPREAD_MAX &&
      xSpread > ySpread * 1.5
    : straight >= 0.55 &&
      xSpread >= 0.06 &&
      xSpread > ySpread * 1.15

  if (!isLineH) return null

  return detectHorizShotShape(startQuadrant, start, end)
}

const HORZ_LEG_MIN_DX = 0.04
/** Merge pause/hold anchors that sit on top of each other at the finish. */
const HOLD_ANCHOR_EPS = 0.012

export type HorizStrokeAnchors = {
  horizStart: NormalizedPoint
  horizEnd: NormalizedPoint
  finishPoint: NormalizedPoint
}

export function collapseHoldAnchors(points: NormalizedPoint[]): NormalizedPoint[] {
  if (points.length <= 1) return points
  const out: NormalizedPoint[] = [points[0]!]
  for (let i = 1; i < points.length; i++) {
    const p = points[i]!
    const last = out[out.length - 1]!
    if (Math.hypot(p.x - last.x, p.y - last.y) < HOLD_ANCHOR_EPS) continue
    out.push(p)
  }
  return out
}

/** Horizontal leg = anchor 1 → anchor 2; finish = last distinct anchor after that. */
export function parseHorizStroke(points: NormalizedPoint[]): HorizStrokeAnchors | null {
  const anchors = collapseHoldAnchors(points)
  if (anchors.length < 2) return null

  const horizStart = anchors[0]!
  const horizEnd = anchors[1]!
  const finishPoint = anchors[anchors.length - 1]!
  const legDx = Math.abs(horizEnd.x - horizStart.x)
  const legDy = Math.abs(horizEnd.y - horizStart.y)
  if (legDx < HORZ_LEG_MIN_DX || legDx <= legDy * 1.15) return null

  return { horizStart, horizEnd, finishPoint }
}

export function strokeFinishUp(corner: NormalizedPoint, finish: NormalizedPoint): boolean {
  return finish.y - corner.y <= -VOLLEY_DIRECTION_MIN
}

export function strokeFinishDown(corner: NormalizedPoint, finish: NormalizedPoint): boolean {
  return finish.y - corner.y >= SMASH_DIRECTION_MIN
}

export function horizStrokeFinishVerdict(
  corner: NormalizedPoint,
  finish: NormalizedPoint,
): VolleyVerdict | null {
  if (strokeFinishUp(corner, finish)) return 'SCORE'
  if (strokeFinishDown(corner, finish)) return 'FOUL'
  return null
}

export function detectHorizShotShapeFromAnchors(
  points: NormalizedPoint[],
  startQuadrant: Quadrant,
): 'BACKHAND' | 'FOREHAND' | null {
  const parsed = parseHorizStroke(points)
  if (!parsed) return null
  return detectHorizShotShape(startQuadrant, parsed.horizStart, parsed.horizEnd)
}

/** Toward the player's left (across body) = backhand; toward their right = forehand. */
export function detectHorizShotShape(
  startQuadrant: Quadrant,
  start: NormalizedPoint,
  end: NormalizedPoint,
): 'BACKHAND' | 'FOREHAND' | null {
  const dx = end.x - start.x
  if (Math.abs(dx) < BACKHAND_DIRECTION_MIN) return null

  const facesSouth = startQuadrant === 'TL' || startQuadrant === 'TR'
  const towardPlayerLeft = facesSouth ? dx < 0 : dx > 0
  return towardPlayerLeft ? 'BACKHAND' : 'FOREHAND'
}

export function detectGestureShape(
  points: NormalizedPoint[],
  startQuadrant?: Quadrant,
): GestureShape {
  if (points.length < 2) return 'TAP'

  const { xSpread, ySpread } = pathSpread(points)
  const straight = straightness(points)
  const travel = Math.max(xSpread, ySpread)
  const quadrant = startQuadrant ?? quadrantFromPoint(points[0]!)
  const startZone = courtShotZoneFromPoint(points[0]!, quadrant)

  if (travel <= TAP_LENGTH_MAX) return 'TAP'

  const isSmash =
    straight >= SMASH_STRAIGHTNESS_MIN &&
    ySpread >= SMASH_Y_SPREAD_MIN &&
    xSpread <= SMASH_X_SPREAD_MAX &&
    ySpread > xSpread * 1.8

  if (isSmash) return 'SMASH'

  const isLineV =
    straight >= LINE_STRAIGHTNESS_MIN &&
    ySpread >= LINE_TRAVEL_MIN &&
    xSpread <= LINE_SPREAD_MAX &&
    ySpread > xSpread * 1.5

  if (isLineV) return 'LINE_V'

  if (startZone === 'back' && isLobDiagonalShape(points)) return 'LOB'

  const anchorHoriz = detectHorizShotShapeFromAnchors(points, quadrant)
  if (anchorHoriz) return anchorHoriz

  const strictHoriz = horizontalShotShape(points, quadrant, { strict: true })
  if (strictHoriz) return strictHoriz

  if (startZone === 'inner') {
    if (isVolleyLShape(points)) return 'VOLLEY'
    const netHoriz = horizontalShotShape(points, quadrant, { strict: false })
    if (netHoriz) return netHoriz
  }

  return 'CURVE'
}

export function shapeLabel(shape: GestureShape): string {
  if (shape === 'SMASH') return 'Smash'
  if (shape === 'BACKHAND') return 'Backhand'
  if (shape === 'FOREHAND') return 'Forehand'
  if (shape === 'VOLLEY') return 'Volley'
  if (shape === 'LOB') return 'Lob'
  if (shape === 'LINE_V') return 'Vertical line'
  if (shape === 'TAP') return 'Tap'
  return 'Curve'
}

/** Top → down = foul; bottom → up = win. */
export function detectSmashVerdict(
  start: NormalizedPoint,
  end: NormalizedPoint,
): SmashVerdict | null {
  const dy = end.y - start.y
  if (dy >= SMASH_DIRECTION_MIN) return 'FOUL'
  if (dy <= -SMASH_DIRECTION_MIN) return 'WIN'
  return null
}

/** Diagonal lob: bottom→up = win, top→down = foul (start vs last anchor). */
export function detectLobVerdict(anchors: NormalizedPoint[]): LobVerdict | null {
  const collapsed = collapseHoldAnchors(anchors)
  if (collapsed.length < 2) return null
  return detectSmashVerdict(collapsed[0]!, collapsed[collapsed.length - 1]!)
}

export function lobFinishUp(anchors: NormalizedPoint[]): boolean {
  const collapsed = collapseHoldAnchors(anchors)
  if (collapsed.length < 2) return false
  return collapsed[collapsed.length - 1]!.y - collapsed[0]!.y <= -SMASH_DIRECTION_MIN
}

export function lobFinishDown(anchors: NormalizedPoint[]): boolean {
  const collapsed = collapseHoldAnchors(anchors)
  if (collapsed.length < 2) return false
  return collapsed[collapsed.length - 1]!.y - collapsed[0]!.y >= SMASH_DIRECTION_MIN
}

export function detectBackhandDirection(
  start: NormalizedPoint,
  end: NormalizedPoint,
): BackhandDirection | null {
  const dx = end.x - start.x
  if (dx >= BACKHAND_DIRECTION_MIN) return 'L_TO_R'
  if (dx <= -BACKHAND_DIRECTION_MIN) return 'R_TO_L'
  return null
}

/** L-shaped volley: upward finish = score; ends bottom = foul. */
export function detectVolleyVerdict(
  points: NormalizedPoint[],
  end: NormalizedPoint,
): VolleyVerdict | null {
  const anchors = collapseHoldAnchors(points)
  const finish = anchors[anchors.length - 1] ?? end
  if (finish.y >= VOLLEY_END_BOTTOM_Y) return 'FOUL'

  const parsed = parseHorizStroke(points)
  if (parsed && parsed.finishPoint !== parsed.horizEnd) {
    return horizStrokeFinishVerdict(parsed.horizEnd, parsed.finishPoint)
  }

  const sampled = resamplePath(anchors, 16)
  const cornerIdx = findLCornerIndex(anchors)
  if (cornerIdx !== null && cornerIdx < sampled.length) {
    const corner = sampled[cornerIdx]!
    const finalDy = finish.y - corner.y
    if (finalDy <= -VOLLEY_DIRECTION_MIN) return 'SCORE'
    if (finalDy >= VOLLEY_DIRECTION_MIN) return 'FOUL'
  }

  if (finish.y < 0.48) return 'SCORE'
  return null
}

type GestureReportOpts = {
  smashVerdict?: SmashVerdict | null
  lobVerdict?: LobVerdict | null
  volleyVerdict?: VolleyVerdict | null
  backhandDirection?: BackhandDirection | null
  playerNames?: Partial<Record<Quadrant, string>>
  shotZone?: CourtShotZone
  startQuadrant?: Quadrant
  start?: NormalizedPoint
  end?: NormalizedPoint
}

function horizStrokeVerdict(start: NormalizedPoint, end: NormalizedPoint): VolleyVerdict | null {
  const dy = end.y - start.y
  if (dy <= -SMASH_DIRECTION_MIN) return 'SCORE'
  if (dy >= SMASH_DIRECTION_MIN) return 'FOUL'
  return null
}

/** Volley label with shot type: BH (backhand), FH (forehand), OH (overhead). */
export function volleyTypeLabel(
  subtype: 'BH' | 'FH' | 'OH',
  verdict: VolleyVerdict | null,
): string {
  const base = `Volley ${subtype}`
  if (verdict === 'SCORE') return `${base} Score`
  if (verdict === 'FOUL') return `${base} Foul`
  return base
}

function innerHorizVolleyLabel(
  shape: GestureShape,
  start: NormalizedPoint | undefined,
  end: NormalizedPoint | undefined,
  startQuadrant: Quadrant | undefined,
): string | null {
  if (!start || !end || !startQuadrant || !isVolleyZoneStart(start, startQuadrant)) return null
  if (shape !== 'BACKHAND' && shape !== 'FOREHAND') return null
  return volleyTypeLabel(shape === 'BACKHAND' ? 'BH' : 'FH', horizStrokeVerdict(start, end))
}

/** Shot-only label for pad feedback, e.g. "Smash Win" or "Backhand". */
export function gestureShotLabel(
  shape: GestureShape,
  opts: Omit<GestureReportOpts, 'playerNames'> = {},
): string | null {
  const {
    smashVerdict = null,
    lobVerdict = null,
    volleyVerdict: volleyVerdictIn = null,
    startQuadrant,
    start,
    end,
  } = opts

  let volleyVerdict = volleyVerdictIn
  if (
    volleyVerdict == null &&
    startQuadrant &&
    start &&
    end &&
    (shape === 'BACKHAND' || shape === 'FOREHAND') &&
    isVolleyZoneStart(start, startQuadrant)
  ) {
    volleyVerdict = horizStrokeVerdict(start, end) ?? 'FOUL'
  }

  if (shape === 'SMASH') {
    if (smashVerdict === 'WIN') return 'Smash Win'
    if (smashVerdict === 'FOUL') return 'Smash Foul'
    return 'Smash'
  }

  if (shape === 'LOB') {
    if (lobVerdict === 'WIN') return 'Lob Win'
    if (lobVerdict === 'FOUL') return 'Lob Foul'
    return 'Lob'
  }

  if (shape === 'VOLLEY') {
    return volleyTypeLabel('OH', volleyVerdict)
  }

  const innerVolley = innerHorizVolleyLabel(shape, start, end, startQuadrant)
  if (innerVolley) return innerVolley

  if (shape === 'BACKHAND') return 'Backhand'
  if (shape === 'FOREHAND') return 'Forehand'
  return null
}

/** Primary label: player + shot, e.g. "Player 2 - Smash Win". */
export function gestureReport(
  startQuadrant: Quadrant,
  shape: GestureShape,
  opts: GestureReportOpts = {},
): string {
  const {
    smashVerdict = null,
    lobVerdict = null,
    volleyVerdict = null,
    playerNames,
    start,
    end,
  } = opts
  const player = playerLabel(startQuadrant, playerNames)

  if (shape === 'SMASH') {
    if (smashVerdict === 'WIN') return `${player} - Smash Win`
    if (smashVerdict === 'FOUL') return `${player} - Smash Foul`
    return `${player} - Smash`
  }

  if (shape === 'LOB') {
    if (lobVerdict === 'WIN') return `${player} - Lob Win`
    if (lobVerdict === 'FOUL') return `${player} - Lob Foul`
    return `${player} - Lob`
  }

  if (shape === 'VOLLEY') {
    return `${player} - ${volleyTypeLabel('OH', volleyVerdict)}`
  }

  const innerVolley = innerHorizVolleyLabel(shape, start, end, startQuadrant)
  if (innerVolley) return `${player} - ${innerVolley}`

  if (shape === 'BACKHAND') return `${player} - Backhand`
  if (shape === 'FOREHAND') return `${player} - Forehand`

  return player
}

/** Live pad label — BH/FH use anchor 1→2 for shape, corner→finish for win/loss. */
export function gestureLiveShotLabel(
  path: NormalizedPoint[],
  startQuadrant: Quadrant,
): string | null {
  if (path.length < 2) return null
  const shape = detectGestureShape(path, startQuadrant)
  const parsed = parseHorizStroke(path)
  const start = path[0]!
  const end = path[path.length - 1]!

  if ((shape === 'BACKHAND' || shape === 'FOREHAND') && parsed) {
    const subtype = shape === 'BACKHAND' ? 'BH' : 'FH'
    const inner = isVolleyZoneStart(parsed.horizStart, startQuadrant)
    if (parsed.finishPoint !== parsed.horizEnd) {
      const verdict = horizStrokeFinishVerdict(parsed.horizEnd, parsed.finishPoint)
      if (inner) {
        if (verdict === 'SCORE') return volleyTypeLabel(subtype, 'SCORE')
        if (verdict === 'FOUL') return volleyTypeLabel(subtype, 'FOUL')
      } else if (verdict === 'FOUL') {
        return shape === 'BACKHAND' ? 'Backhand Foul' : 'Forehand Foul'
      }
    }
    if (inner) return volleyTypeLabel(subtype, null)
    return shape === 'BACKHAND' ? 'Backhand' : 'Forehand'
  }

  return gestureShotLabel(shape, {
    smashVerdict: shape === 'SMASH' ? detectSmashVerdict(start, end) : null,
    lobVerdict: shape === 'LOB' ? detectLobVerdict(path) : null,
    volleyVerdict: shape === 'VOLLEY' ? detectVolleyVerdict(path, end) : null,
    startQuadrant,
    start,
    end,
  })
}

export function analyzeGesture(
  gesture: CapturedGesture,
  durationMs: number,
  opts?: { playerNames?: Partial<Record<Quadrant, string>> },
): GestureAnalysis {
  const { pathPoints } = gesture
  const anchors = collapseHoldAnchors(pathPoints)
  const seq = quadrantSequence(pathPoints)
  const grid = gridPath(pathPoints)
  const signature = pathSignature(pathPoints)
  const { xSpread, ySpread } = pathSpread(pathPoints)
  const straight = straightness(pathPoints)
  const shape = detectGestureShape(pathPoints, gesture.startQuadrant)
  const label = shapeLabel(shape)
  const shotZone: CourtShotZone = isVolleyZoneStart(gesture.start, gesture.startQuadrant)
    ? 'inner'
    : 'back'
  const parsed = shape === 'LOB' ? null : parseHorizStroke(pathPoints)
  const strokeCorner = parsed?.horizEnd ?? null
  const finishPoint = parsed?.finishPoint ?? null
  const smashVerdict =
    shape === 'SMASH' ? detectSmashVerdict(gesture.start, gesture.end) : null
  const lobVerdict = shape === 'LOB' ? detectLobVerdict(pathPoints) : null
  const backhandDirection =
    shape === 'BACKHAND' || shape === 'FOREHAND'
      ? detectBackhandDirection(
          parsed?.horizStart ?? gesture.start,
          parsed?.horizEnd ?? gesture.end,
        )
      : null
  let volleyVerdict =
    shape === 'VOLLEY' ? detectVolleyVerdict(pathPoints, gesture.end) : null
  if ((shape === 'BACKHAND' || shape === 'FOREHAND') && shotZone === 'inner') {
    if (parsed && parsed.finishPoint !== parsed.horizEnd) {
      volleyVerdict = horizStrokeFinishVerdict(parsed.horizEnd, parsed.finishPoint) ?? 'FOUL'
    } else {
      volleyVerdict = 'FOUL'
    }
  }

  return {
    code: gesture.code,
    report: gestureReport(gesture.startQuadrant, shape, {
      smashVerdict,
      lobVerdict,
      volleyVerdict,
      backhandDirection,
      playerNames: opts?.playerNames,
      startQuadrant: gesture.startQuadrant,
      shotZone,
      start: gesture.start,
      end: gesture.end,
    }),
    shape,
    shapeLabel: label,
    smashVerdict,
    lobVerdict,
    volleyVerdict,
    backhandDirection,
    startQuadrant: gesture.startQuadrant,
    endQuadrant: gesture.endQuadrant,
    quadrantSequence: seq,
    quadrantsVisited: quadrantsVisited(pathPoints),
    crossingCount: crossingCount(pathPoints),
    durationMs: Math.round(durationMs),
    pointCount: pathPoints.length,
    pathLength: Math.round(pathLength(pathPoints) * 1000) / 1000,
    angleDeg: angleDeg(gesture.start, gesture.end),
    direction: directionBucket(angleDeg(gesture.start, gesture.end)),
    xSpread: Math.round(xSpread * 1000) / 1000,
    ySpread: Math.round(ySpread * 1000) / 1000,
    straightness: Math.round(straight * 1000) / 1000,
    gridPath: grid,
    pathSignature: signature,
    patternKey: `${gesture.startQuadrant}|${shape}|${seq}|${grid}`,
    start: roundPoint(gesture.start),
    end: roundPoint(gesture.end),
    pathSample: resamplePath(pathPoints, 24).map((p) => roundPoint(p)),
    anchors: anchors.map((p) => roundPoint(p)),
    strokeCorner: strokeCorner ? roundPoint(strokeCorner) : null,
    finishPoint: finishPoint ? roundPoint(finishPoint) : null,
    shotZone,
  }
}

function resamplePolyline(corners: NormalizedPoint[], count: number): NormalizedPoint[] {
  if (corners.length === 0) return []
  if (corners.length === 1) return Array.from({ length: count }, () => corners[0]!)

  const segLens: number[] = []
  let total = 0
  for (let i = 1; i < corners.length; i++) {
    const len = segmentLength(corners[i - 1]!, corners[i]!)
    segLens.push(len)
    total += len
  }
  if (total === 0) return Array.from({ length: count }, () => corners[0]!)

  return Array.from({ length: count }, (_, i) => {
    const target = count === 1 ? 0 : (i / (count - 1)) * total
    let walked = 0
    for (let s = 0; s < segLens.length; s++) {
      const seg = segLens[s]!
      if (walked + seg >= target) {
        const t = (target - walked) / seg
        const a = corners[s]!
        const b = corners[s + 1]!
        return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
      }
      walked += seg
    }
    return corners[corners.length - 1]!
  })
}

function chaikinSmooth(points: NormalizedPoint[], iterations = 2): NormalizedPoint[] {
  let current = points
  for (let iter = 0; iter < iterations; iter++) {
    if (current.length < 2) break
    const next: NormalizedPoint[] = [current[0]!]
    for (let i = 0; i < current.length - 1; i++) {
      const p0 = current[i]!
      const p1 = current[i + 1]!
      next.push(
        { x: 0.75 * p0.x + 0.25 * p1.x, y: 0.75 * p0.y + 0.25 * p1.y },
        { x: 0.25 * p0.x + 0.75 * p1.x, y: 0.25 * p0.y + 0.75 * p1.y },
      )
    }
    next.push(current[current.length - 1]!)
    current = next
  }
  return current
}

/** Snap a messy stroke to the canonical path used for display after release. */
export function idealizeGesturePath(
  analysis: Pick<
    GestureAnalysis,
    'shape' | 'start' | 'end' | 'strokeCorner' | 'finishPoint' | 'startQuadrant'
  >,
  anchorPath: NormalizedPoint[],
): NormalizedPoint[] {
  const { shape, start, end } = analysis
  const parsed = parseHorizStroke(anchorPath)

  if (shape === 'SMASH' || shape === 'LINE_V') {
    return resamplePath([start, { x: start.x, y: end.y }], 28)
  }
  if (shape === 'LOB') return resamplePath([start, end], 28)
  if (shape === 'BACKHAND' || shape === 'FOREHAND') {
    if (parsed) {
      const corners = [parsed.horizStart, parsed.horizEnd]
      if (parsed.finishPoint !== parsed.horizEnd) corners.push(parsed.finishPoint)
      return resamplePolyline(corners, 28)
    }
    return resamplePath([start, end], 28)
  }
  if (shape === 'VOLLEY') {
    const cornerIdx = findLCornerIndex(anchorPath)
    if (cornerIdx != null) {
      const corner = resamplePath(anchorPath, 24)[cornerIdx]!
      return resamplePolyline([start, corner, end], 28)
    }
  }
  if (shape === 'TAP') return [start, end]
  const smoothed = chaikinSmooth(collapseHoldAnchors(anchorPath), 2)
  return resamplePath(smoothed.length >= 2 ? smoothed : anchorPath, 28)
}

export function lerpGesturePaths(
  from: NormalizedPoint[],
  to: NormalizedPoint[],
  t: number,
  samples = 32,
): NormalizedPoint[] {
  const a = resamplePath(from.length ? from : to, samples)
  const b = resamplePath(to.length ? to : from, samples)
  return a.map((p, i) => {
    const q = b[i]!
    return { x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t }
  })
}

const VERT_LEG_MIN_DY = 0.05

/** Step-2 vertical leg: ↑ score, ↓ foul (from horizontal corner). */
export function detectVerticalVerdictStroke(
  points: NormalizedPoint[],
  corner: NormalizedPoint,
): VolleyVerdict | null {
  if (points.length < 2) return null
  const start = points[0]!
  const end = points[points.length - 1]!
  const dy = Math.abs(end.y - start.y)
  const dx = Math.abs(end.x - start.x)
  if (dy < VERT_LEG_MIN_DY || dy <= dx * 1.1) return null
  return horizStrokeFinishVerdict(corner, end)
}

export function horizStepLabel(shape: 'BACKHAND' | 'FOREHAND', innerZone: boolean): string {
  const base = shape === 'BACKHAND' ? 'Backhand' : 'Forehand'
  if (innerZone) return `${base} volley · step 1 of 2`
  return `${base} · step 1 of 2`
}

export function buildComposedHorizVertAnalysis(
  horizAnalysis: GestureAnalysis,
  horizPath: NormalizedPoint[],
  vertPath: NormalizedPoint[],
  extraDurationMs: number,
  opts?: { playerNames?: Partial<Record<Quadrant, string>> },
): GestureAnalysis {
  const corner = horizAnalysis.strokeCorner ?? horizAnalysis.end
  const finish = vertPath[vertPath.length - 1]!
  const verdict = horizStrokeFinishVerdict(corner, finish)
  const combined = [...horizPath, ...vertPath.slice(1)]
  const shape: GestureShape =
    horizAnalysis.shape === 'BACKHAND' || horizAnalysis.shape === 'FOREHAND'
      ? horizAnalysis.shape
      : 'FOREHAND'
  const inner = horizAnalysis.shotZone === 'inner'
  const volleyVerdict: VolleyVerdict | null = inner ? (verdict ?? 'FOUL') : null

  return {
    ...horizAnalysis,
    shape,
    shapeLabel: shapeLabel(shape),
    report: gestureReport(horizAnalysis.startQuadrant, shape, {
      volleyVerdict,
      backhandDirection: horizAnalysis.backhandDirection,
      playerNames: opts?.playerNames,
      shotZone: horizAnalysis.shotZone,
      startQuadrant: horizAnalysis.startQuadrant,
      start: horizAnalysis.start,
      end: finish,
    }),
    volleyVerdict,
    end: roundPoint(finish),
    endQuadrant: quadrantFromPoint(finish),
    durationMs: Math.round(horizAnalysis.durationMs + extraDurationMs),
    pointCount: combined.length,
    pathLength: Math.round(pathLength(combined) * 1000) / 1000,
    pathSample: resamplePath(combined, 24).map((p) => roundPoint(p)),
    anchors: [roundPoint(horizAnalysis.start), roundPoint(corner), roundPoint(finish)],
    strokeCorner: roundPoint(corner),
    finishPoint: roundPoint(finish),
    patternKey: `${horizAnalysis.startQuadrant}|${shape}|2stroke|${verdict ?? '?'}`,
  }
}
