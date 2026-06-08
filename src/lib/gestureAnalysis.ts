import {
  quadrantFromPoint,
  type CapturedGesture,
  type NormalizedPoint,
  type Quadrant,
} from './gestureCapture'

export type GestureShape = 'SMASH' | 'LINE_H' | 'LINE_V' | 'CURVE' | 'TAP'

export type GestureAnalysis = {
  code: string
  report: string
  shape: GestureShape
  shapeLabel: string
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
}

/** Vertical straight stroke — x stays tight, y moves (overhead smash). */
export const SMASH_X_SPREAD_MAX = 0.09
export const SMASH_Y_SPREAD_MIN = 0.1
export const SMASH_STRAIGHTNESS_MIN = 0.8

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

export function detectGestureShape(points: NormalizedPoint[]): GestureShape {
  if (points.length < 2) return 'TAP'

  const { xSpread, ySpread } = pathSpread(points)
  const straight = straightness(points)
  const travel = Math.max(xSpread, ySpread)

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

  const isLineH =
    straight >= LINE_STRAIGHTNESS_MIN &&
    xSpread >= LINE_TRAVEL_MIN &&
    ySpread <= LINE_SPREAD_MAX &&
    xSpread > ySpread * 1.5

  if (isLineH) return 'LINE_H'

  return 'CURVE'
}

export function shapeLabel(shape: GestureShape): string {
  if (shape === 'SMASH') return 'Smash'
  if (shape === 'LINE_V') return 'Vertical line'
  if (shape === 'LINE_H') return 'Horizontal line'
  if (shape === 'TAP') return 'Tap'
  return 'Curve'
}

/** Primary label: start quadrant + shape, e.g. "TR - Smash". */
export function gestureReport(startQuadrant: Quadrant, shape: GestureShape): string {
  if (shape === 'SMASH') return `${startQuadrant} - Smash`
  return startQuadrant
}

export function analyzeGesture(
  gesture: CapturedGesture,
  durationMs: number,
): GestureAnalysis {
  const { pathPoints } = gesture
  const seq = quadrantSequence(pathPoints)
  const grid = gridPath(pathPoints)
  const signature = pathSignature(pathPoints)
  const { xSpread, ySpread } = pathSpread(pathPoints)
  const straight = straightness(pathPoints)
  const shape = detectGestureShape(pathPoints)
  const label = shapeLabel(shape)

  return {
    code: gesture.code,
    report: gestureReport(gesture.startQuadrant, shape),
    shape,
    shapeLabel: label,
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
  }
}
