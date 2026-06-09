import {
  playerLabel,
  quadrantFromPoint,
  type CapturedGesture,
  type NormalizedPoint,
  type Quadrant,
} from './gestureCapture'
import { courtShotZoneFromPoint, type CourtShotZone } from './padelCourtLayout'

export type GestureShape = 'SMASH' | 'BACKHAND' | 'FOREHAND' | 'VOLLEY' | 'LINE_V' | 'CURVE' | 'TAP'
export type SmashVerdict = 'WIN' | 'FOUL'
export type VolleyVerdict = 'SCORE' | 'FOUL'
export type BackhandDirection = 'L_TO_R' | 'R_TO_L'

export type GestureAnalysis = {
  code: string
  report: string
  shape: GestureShape
  shapeLabel: string
  smashVerdict: SmashVerdict | null
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

export function isVolleyLShape(points: NormalizedPoint[]): boolean {
  if (points.length < 3) return false

  const { xSpread, ySpread } = pathSpread(points)
  if (xSpread < VOLLEY_LEG_MIN || ySpread < VOLLEY_LEG_MIN) return false
  if (straightness(points) >= VOLLEY_STRAIGHTNESS_MAX) return false

  return findLCornerIndex(points) !== null
}

function horizontalShotShape(
  points: NormalizedPoint[],
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

  const dir = detectBackhandDirection(start, end)
  if (dir === 'R_TO_L') return 'FOREHAND'
  if (dir === 'L_TO_R') return 'BACKHAND'
  return null
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

  const strictHoriz = horizontalShotShape(points, { strict: true })
  if (strictHoriz) return strictHoriz

  if (startZone === 'inner') {
    const netHoriz = horizontalShotShape(points, { strict: false })
    if (netHoriz) return netHoriz
  }

  if (startZone === 'back' && isVolleyLShape(points)) return 'VOLLEY'

  return 'CURVE'
}

export function shapeLabel(shape: GestureShape): string {
  if (shape === 'SMASH') return 'Smash'
  if (shape === 'BACKHAND') return 'Backhand'
  if (shape === 'FOREHAND') return 'Forehand'
  if (shape === 'VOLLEY') return 'Volley'
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
  if (end.y >= VOLLEY_END_BOTTOM_Y) return 'FOUL'

  const sampled = resamplePath(points, 16)
  const cornerIdx = findLCornerIndex(points)
  if (cornerIdx !== null && cornerIdx < sampled.length) {
    const corner = sampled[cornerIdx]!
    const finalDy = end.y - corner.y
    if (finalDy <= -VOLLEY_DIRECTION_MIN) return 'SCORE'
    if (finalDy >= VOLLEY_DIRECTION_MIN) return 'FOUL'
  }

  if (end.y < 0.48) return 'SCORE'
  return null
}

type GestureReportOpts = {
  smashVerdict?: SmashVerdict | null
  volleyVerdict?: VolleyVerdict | null
  backhandDirection?: BackhandDirection | null
  playerNames?: Partial<Record<Quadrant, string>>
  shotZone?: CourtShotZone
  start?: NormalizedPoint
  end?: NormalizedPoint
}

function horizStrokeVerdict(start: NormalizedPoint, end: NormalizedPoint): VolleyVerdict | null {
  const dy = end.y - start.y
  if (dy <= -SMASH_DIRECTION_MIN) return 'SCORE'
  if (dy >= SMASH_DIRECTION_MIN) return 'FOUL'
  return null
}

function innerHorizVolleyLabel(
  shape: GestureShape,
  shotZone: CourtShotZone | undefined,
  start: NormalizedPoint | undefined,
  end: NormalizedPoint | undefined,
): string | null {
  if (shotZone !== 'inner' || !start || !end) return null
  if (shape !== 'BACKHAND' && shape !== 'FOREHAND') return null
  const verdict = horizStrokeVerdict(start, end)
  if (verdict === 'SCORE') return 'Volley Score'
  if (verdict === 'FOUL') return 'Volley Foul'
  return 'Volley'
}

/** Shot-only label for pad feedback, e.g. "Smash Win" or "Backhand". */
export function gestureShotLabel(
  shape: GestureShape,
  opts: Omit<GestureReportOpts, 'playerNames'> = {},
): string | null {
  const { smashVerdict = null, volleyVerdict = null, shotZone, start, end } = opts

  if (shape === 'SMASH') {
    if (smashVerdict === 'WIN') return 'Smash Win'
    if (smashVerdict === 'FOUL') return 'Smash Foul'
    return 'Smash'
  }

  if (shape === 'VOLLEY') {
    if (volleyVerdict === 'SCORE') return 'Volley Score'
    if (volleyVerdict === 'FOUL') return 'Volley Foul'
    return 'Volley'
  }

  const innerVolley = innerHorizVolleyLabel(shape, shotZone, start, end)
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
    volleyVerdict = null,
    backhandDirection = null,
    playerNames,
    shotZone,
    start,
    end,
  } = opts
  const player = playerLabel(startQuadrant, playerNames)

  if (shape === 'SMASH') {
    if (smashVerdict === 'WIN') return `${player} - Smash Win`
    if (smashVerdict === 'FOUL') return `${player} - Smash Foul`
    return `${player} - Smash`
  }

  if (shape === 'VOLLEY') {
    if (volleyVerdict === 'SCORE') return `${player} - Volley Score`
    if (volleyVerdict === 'FOUL') return `${player} - Volley Foul`
    return `${player} - Volley`
  }

  const innerVolley = innerHorizVolleyLabel(shape, shotZone, start, end)
  if (innerVolley) return `${player} - ${innerVolley}`

  if (shape === 'BACKHAND') {
    if (backhandDirection === 'L_TO_R') return `${player} - Backhand L→R`
    return `${player} - Backhand`
  }

  if (shape === 'FOREHAND') {
    if (backhandDirection === 'R_TO_L') return `${player} - Forehand R→L`
    return `${player} - Forehand`
  }

  return player
}

export function analyzeGesture(
  gesture: CapturedGesture,
  durationMs: number,
  opts?: { playerNames?: Partial<Record<Quadrant, string>> },
): GestureAnalysis {
  const { pathPoints } = gesture
  const seq = quadrantSequence(pathPoints)
  const grid = gridPath(pathPoints)
  const signature = pathSignature(pathPoints)
  const { xSpread, ySpread } = pathSpread(pathPoints)
  const straight = straightness(pathPoints)
  const shape = detectGestureShape(pathPoints, gesture.startQuadrant)
  const label = shapeLabel(shape)
  const shotZone = courtShotZoneFromPoint(gesture.start, gesture.startQuadrant)
  const smashVerdict =
    shape === 'SMASH' ? detectSmashVerdict(gesture.start, gesture.end) : null
  const backhandDirection =
    shape === 'BACKHAND' || shape === 'FOREHAND'
      ? detectBackhandDirection(gesture.start, gesture.end)
      : null
  let volleyVerdict =
    shape === 'VOLLEY' ? detectVolleyVerdict(pathPoints, gesture.end) : null
  if ((shape === 'BACKHAND' || shape === 'FOREHAND') && shotZone === 'inner') {
    volleyVerdict = horizStrokeVerdict(gesture.start, gesture.end)
  }

  return {
    code: gesture.code,
    report: gestureReport(gesture.startQuadrant, shape, {
      smashVerdict,
      volleyVerdict,
      backhandDirection,
      playerNames: opts?.playerNames,
      shotZone,
      start: gesture.start,
      end: gesture.end,
    }),
    shape,
    shapeLabel: label,
    smashVerdict,
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
    shotZone,
  }
}
