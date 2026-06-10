import { quadrantFromPoint, type NormalizedPoint, type Quadrant } from './gestureCapture'
import { pathLength, pathSpread, quadrantsVisited } from './gestureAnalysis'
import type { GestureDebugEntry } from './gestureDebugLog'
import type { MatchTeam } from './types'
import { oppositeTeam, type PendingPointExchange } from './pointExchange'
import { quadrantTeam } from './gestureScoring'
import { teamHalfFromQuadrant } from './courtHalfCapture'
import {
  enclosureZoneAtPad,
  padNormToCourtNorm,
  type CourtInsetBounds,
} from './padelCourtLayout'
import {
  isServeNetLanding,
  pointInServiceBox,
  serveReceiveQuadrant,
  serveStartBoxBounds,
} from './serveRotation'

const SERVE_MIN_TRAVEL = 0.05

/**
 * Membership test: is the serve origin (pad coords) inside the server's
 * "starters box"? The dimension is `serveStartBoxBounds` — the server's service
 * side from the back glass up to the service line — matching the highlighted
 * starters box. Starting behind the baseline is legal; starting through the
 * wall (beyond the glass) falls outside and is rejected.
 */
const SERVER_BOX_LINE_TOL = 0.008
export function serveOriginInServerBox(
  originPad: NormalizedPoint,
  serveSide: Quadrant,
  inset: CourtInsetBounds,
): boolean {
  const court = padNormToCourtNorm(originPad, inset)
  const b = serveStartBoxBounds(serveSide)
  return (
    court.x >= b.xMin - SERVER_BOX_LINE_TOL &&
    court.x <= b.xMax + SERVER_BOX_LINE_TOL &&
    court.y >= b.yMin - SERVER_BOX_LINE_TOL &&
    court.y <= b.yMax + SERVER_BOX_LINE_TOL
  )
}

export type ServeLanding = 'in' | 'net' | 'out'

export type ServeGestureResult = {
  server: Quadrant
  receive: Quadrant
  landing: ServeLanding
}

export type CompletedPointExchange = {
  winnerGestureId: string
  loserGestureId: string
  winnerQuadrant: Quadrant
  loserQuadrant: Quadrant
  winnerTeam: MatchTeam
  isServe: boolean
}

/** True when the stroke starts on the serving team and crosses into the receive box. */
export function isServeStrokeFromServer(
  path: NormalizedPoint[],
  servingPlayerQuadrant: Quadrant,
  serveSideQuadrant: Quadrant,
): boolean {
  if (path.length < 2) return false
  const origin = path[0]!
  if (quadrantTeam(quadrantFromPoint(origin)) !== quadrantTeam(servingPlayerQuadrant)) {
    return false
  }
  return isServeCrossCourtStroke(path, servingPlayerQuadrant, serveSideQuadrant)
}

/** Diagonal stroke from server half into the receive half — not a horizontal shot. */
export function isServeCrossCourtStroke(
  path: NormalizedPoint[],
  servingPlayerQuadrant: Quadrant,
  serveSideQuadrant: Quadrant,
): boolean {
  if (path.length < 2) return false
  if (pathLength(path) < SERVE_MIN_TRAVEL) return false

  const receive = serveReceiveQuadrant(serveSideQuadrant)
  const serverHalf = teamHalfFromQuadrant(servingPlayerQuadrant)
  const receiveHalf = teamHalfFromQuadrant(receive)

  const start = path[0]!
  const end = path[path.length - 1]!
  const startHalf = start.y < 0.5 ? 'top' : 'bottom'
  const endHalf = end.y < 0.5 ? 'top' : 'bottom'

  if (startHalf !== serverHalf || endHalf !== receiveHalf) return false

  const { xSpread, ySpread } = pathSpread(path)
  if (ySpread < 0.06) return false
  if (xSpread > ySpread * 2.4) return false

  const visited = quadrantsVisited(path)
  return visited.includes(serveSideQuadrant) || visited.includes(receive)
}

/** Trajectory from locked server origin through the drawn path to release. */
export function buildServePath(
  pathPoints: NormalizedPoint[],
  origin: NormalizedPoint,
): NormalizedPoint[] {
  if (pathPoints.length === 0) return [origin, origin]
  const tail = pathPoints.slice(1)
  return tail.length > 0 ? [origin, ...tail] : [origin, pathPoints[0]!]
}

export function isServeAttempt(
  pathPoints: NormalizedPoint[],
  origin: NormalizedPoint,
  servingPlayerQuadrant: Quadrant,
  serveSideQuadrant: Quadrant,
): boolean {
  return isServeCrossCourtStroke(
    buildServePath(pathPoints, origin),
    servingPlayerQuadrant,
    serveSideQuadrant,
  )
}

export function serveEndCourtPoint(
  pathPoints: NormalizedPoint[],
  origin: NormalizedPoint,
  inset: CourtInsetBounds,
): NormalizedPoint {
  const path = buildServePath(pathPoints, origin)
  const endPad = path[path.length - 1]!
  return padNormToCourtNorm(endPad, inset)
}

export function serveLandingInBox(
  pathPoints: NormalizedPoint[],
  origin: NormalizedPoint,
  serveSideQuadrant: Quadrant,
  inset: CourtInsetBounds,
): boolean {
  const endCourt = serveEndCourtPoint(pathPoints, origin, inset)
  const receive = serveReceiveQuadrant(serveSideQuadrant)
  return pointInServiceBox(endCourt, receive)
}

export function classifyServeLanding(
  pathPoints: NormalizedPoint[],
  origin: NormalizedPoint,
  serveSideQuadrant: Quadrant,
  servingPlayerQuadrant: Quadrant,
  inset: CourtInsetBounds,
): ServeLanding | null {
  if (!isServeAttempt(pathPoints, origin, servingPlayerQuadrant, serveSideQuadrant)) return null
  return classifyServeLandingInServePhase(
    pathPoints,
    origin,
    serveSideQuadrant,
    servingPlayerQuadrant,
    inset,
  )
}

/** Serve phase — classify by landing position only (no cross-court shape gate). */
export function classifyServeLandingInServePhase(
  pathPoints: NormalizedPoint[],
  origin: NormalizedPoint,
  serveSideQuadrant: Quadrant,
  servingPlayerQuadrant: Quadrant,
  inset: CourtInsetBounds,
): ServeLanding {
  const endCourt = serveEndCourtPoint(pathPoints, origin, inset)
  const receive = serveReceiveQuadrant(serveSideQuadrant)
  if (pointInServiceBox(endCourt, receive)) return 'in'
  // Off the receiver-side glass or metal wall is a good serve; drawing past the
  // wall (beyond the enclosure, off court) falls through to 'out'.
  const endPad = serveLandingPadPoint(pathPoints, origin)
  if (enclosureZoneAtPad(endPad, inset) != null) return 'in'
  if (isServeNetLanding(endCourt, servingPlayerQuadrant)) return 'net'
  return 'out'
}

export function classifyServeGesture(
  pathPoints: NormalizedPoint[],
  origin: NormalizedPoint,
  serveSideQuadrant: Quadrant,
  servingPlayerQuadrant: Quadrant,
  inset: CourtInsetBounds,
): ServeGestureResult | null {
  const landing = classifyServeLanding(
    pathPoints,
    origin,
    serveSideQuadrant,
    servingPlayerQuadrant,
    inset,
  )
  if (!landing) return null
  return { server: serveSideQuadrant, receive: serveReceiveQuadrant(serveSideQuadrant), landing }
}

export function serveGestureLabel(
  pathPoints: NormalizedPoint[],
  origin: NormalizedPoint | null,
  servingPlayerQuadrant: Quadrant | null,
  serveSideQuadrant: Quadrant | null,
): string | null {
  if (!origin || !servingPlayerQuadrant || !serveSideQuadrant) return null
  if (!isServeAttempt(pathPoints, origin, servingPlayerQuadrant, serveSideQuadrant)) return null
  return 'Serve'
}

export function serveLandingPadPoint(
  pathPoints: NormalizedPoint[],
  origin: NormalizedPoint,
): NormalizedPoint {
  const path = buildServePath(pathPoints, origin)
  return path[path.length - 1]!
}

export type ServeResolution =
  | {
      ok: true
      kind: 'serve_in'
      receiveQuadrant: Quadrant
      landing: NormalizedPoint
    }
  | { ok: true; kind: 'second_serve' }
  | { ok: true; kind: 'out'; winnerTeam: MatchTeam; foulerQuadrant: Quadrant }
  | { ok: false }

export function tryResolveServe(
  pathPoints: NormalizedPoint[],
  _entry: GestureDebugEntry,
  origin: NormalizedPoint,
  serveSideQuadrant: Quadrant,
  servingPlayerQuadrant: Quadrant,
  inset: CourtInsetBounds,
  serveAttempt: 1 | 2,
): ServeResolution {
  if (!isServeAttempt(pathPoints, origin, servingPlayerQuadrant, serveSideQuadrant)) {
    return { ok: false }
  }

  const receive = serveReceiveQuadrant(serveSideQuadrant)
  const serverTeam = quadrantTeam(servingPlayerQuadrant)
  const landing = classifyServeLanding(
    pathPoints,
    origin,
    serveSideQuadrant,
    servingPlayerQuadrant,
    inset,
  )

  if (landing === 'in') {
    return {
      ok: true,
      kind: 'serve_in',
      receiveQuadrant: receive,
      landing: serveLandingPadPoint(pathPoints, origin),
    }
  }

  if (serveAttempt === 1) {
    return { ok: true, kind: 'second_serve' }
  }

  return {
    ok: true,
    kind: 'out',
    winnerTeam: oppositeTeam(serverTeam),
    foulerQuadrant: servingPlayerQuadrant,
  }
}

export function completedFromPending(
  pending: PendingPointExchange,
  loserQuadrant: Quadrant,
  loserGestureId: string,
): CompletedPointExchange {
  return {
    winnerGestureId: pending.winnerGestureId,
    loserGestureId,
    winnerQuadrant: pending.winnerQuadrant,
    loserQuadrant,
    winnerTeam: pending.winnerTeam,
    isServe: false,
  }
}
