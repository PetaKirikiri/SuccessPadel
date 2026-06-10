import {
  captureGesture,
  gestureCode,
  type CapturedGesture,
  type NormalizedPoint,
  type Quadrant,
} from './gestureCapture'

/** Team side of the court — top (A) or bottom (B). */
export type TeamHalf = 'top' | 'bottom'

export type HeatMapPoint = {
  /** 0 = left sideline, 1 = right sideline (full court width). */
  x: number
  /** 0 = at net, 1 = at baseline on that half. */
  y: number
  half: TeamHalf
}

export type HeatMapPathPoint = { x: number; y: number }

export function teamHalfFromQuadrant(q: Quadrant): TeamHalf {
  return q === 'TL' || q === 'TR' ? 'top' : 'bottom'
}

export function pointInTeamHalf(point: NormalizedPoint, half: TeamHalf): boolean {
  const margin = 0.03
  return half === 'top' ? point.y < 0.5 + margin : point.y >= 0.5 - margin
}

export function heatMapPointFromPad(
  point: NormalizedPoint,
  actorQuadrant: Quadrant,
): HeatMapPoint {
  const half = teamHalfFromQuadrant(actorQuadrant)
  const depth =
    half === 'top' ? (0.5 - point.y) / 0.5 : (point.y - 0.5) / 0.5
  return {
    x: point.x,
    y: Math.max(0, Math.min(1, depth)),
    half,
  }
}

export function heatMapPathFromPad(
  points: NormalizedPoint[],
  actorQuadrant: Quadrant,
): HeatMapPathPoint[] {
  return points.map((p) => {
    const hm = heatMapPointFromPad(p, actorQuadrant)
    return { x: hm.x, y: hm.y }
  })
}

export function drawPathSnapshot(points: NormalizedPoint[]): NormalizedPoint[] {
  return points.map((p) => ({
    x: Math.round(p.x * 1000) / 1000,
    y: Math.round(p.y * 1000) / 1000,
  }))
}

export function shotDrawMeta(
  pathPoints: NormalizedPoint[],
  actorQuadrant: Quadrant,
  originPoint?: NormalizedPoint,
) {
  const origin = originPoint ?? pathPoints[0]!
  const end = pathPoints[pathPoints.length - 1]!
  return {
    actorQuadrant,
    shotOrigin: drawPathSnapshot([origin])[0],
    heatMapPoint: heatMapPointFromPad(origin, actorQuadrant),
    heatMapStart: heatMapPointFromPad(origin, actorQuadrant),
    heatMapEnd: heatMapPointFromPad(end, actorQuadrant),
    heatMapPath: heatMapPathFromPad(pathPoints, actorQuadrant),
    drawPath: drawPathSnapshot(pathPoints),
  }
}

export function shotDrawMetaFromOrigin(
  drawPath: NormalizedPoint[],
  actorQuadrant: Quadrant,
  origin: NormalizedPoint,
) {
  return shotDrawMeta(drawPath, actorQuadrant, origin)
}

/** Actor is chosen by tap; draw location maps to their team half for heat maps. */
export function captureGestureForActor(
  pathPoints: NormalizedPoint[],
  actorQuadrant: Quadrant,
): CapturedGesture | null {
  const base = captureGesture(pathPoints)
  if (!base) return null
  return {
    ...base,
    startQuadrant: actorQuadrant,
    code: gestureCode(actorQuadrant, base.endQuadrant),
  }
}
