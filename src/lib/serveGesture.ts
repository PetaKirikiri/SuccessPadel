import { quadrantFromPoint, type NormalizedPoint, type Quadrant } from './gestureCapture'
import type { GestureDebugEntry } from './gestureDebugLog'
import { pathLength, pathSpread, quadrantsVisited, straightness } from './gestureAnalysis'
import type { MatchTeam } from './types'
import { oppositeTeam, type PendingPointExchange } from './pointExchange'
import { quadrantTeam } from './gestureScoring'
import { receiveBoxCenter, serveReceiveQuadrant } from './serveRotation'

const SERVE_STRAIGHTNESS_MIN = 0.72
const SERVE_TRAVEL_MIN = 0.1
const SERVE_DIAGONAL_MIN = 0.07
const RECEIVE_BOX_MARGIN = 0.16

export type ServeGestureResult = {
  server: Quadrant
  receive: Quadrant
  inBox: boolean
}

export type CompletedPointExchange = {
  winnerGestureId: string
  loserGestureId: string
  winnerQuadrant: Quadrant
  loserQuadrant: Quadrant
  winnerTeam: MatchTeam
  isServe: boolean
}

export function pointInReceiveBox(point: NormalizedPoint, receive: Quadrant): boolean {
  const center = receiveBoxCenter(receive)
  return (
    Math.abs(point.x - center.x) <= RECEIVE_BOX_MARGIN &&
    Math.abs(point.y - center.y) <= RECEIVE_BOX_MARGIN
  )
}

function isServeLineShape(points: NormalizedPoint[]): boolean {
  if (points.length < 2) return false
  const { xSpread, ySpread } = pathSpread(points)
  const travel = pathLength(points)
  const straight = straightness(points)
  return (
    straight >= SERVE_STRAIGHTNESS_MIN &&
    travel >= SERVE_TRAVEL_MIN &&
    xSpread >= SERVE_DIAGONAL_MIN &&
    ySpread >= SERVE_DIAGONAL_MIN &&
    xSpread > 0.04 &&
    ySpread > 0.04
  )
}

/** Serve must cross exactly the server box and diagonal receive box — not stay in one quadrant. */
function isServeQuadrantCrossing(points: NormalizedPoint[], serverQuadrant: Quadrant): boolean {
  const receive = serveReceiveQuadrant(serverQuadrant)
  const visited = quadrantsVisited(points)
  if (visited.length !== 2) return false
  return visited.includes(serverQuadrant) && visited.includes(receive)
}

export function classifyServeGesture(
  points: NormalizedPoint[],
  serverQuadrant: Quadrant,
): ServeGestureResult | null {
  if (!isServeStrokeInProgress(points, serverQuadrant)) return null

  const end = points[points.length - 1]!
  const receive = serveReceiveQuadrant(serverQuadrant)
  const inBox = pointInReceiveBox(end, receive)
  return { server: serverQuadrant, receive, inBox }
}

/** Live pad label while drawing a serve attempt — aces only, no fault concept. */
export function serveGestureLabel(
  points: NormalizedPoint[],
  serverQuadrant: Quadrant | null,
): string | null {
  if (!serverQuadrant || !isServeStrokeInProgress(points, serverQuadrant)) return null
  return 'Serve'
}

export function tryBeginAceServe(
  points: NormalizedPoint[],
  entry: GestureDebugEntry,
  serverQuadrant: Quadrant,
):
  | {
      ok: true
      pending: PendingPointExchange
      point: Omit<CompletedPointExchange, 'loserGestureId'>
    }
  | { ok: false } {
  if (!isServeStrokeInProgress(points, serverQuadrant)) return { ok: false }

  const receive = serveReceiveQuadrant(serverQuadrant)
  const serverTeam = quadrantTeam(serverQuadrant)
  return {
    ok: true,
    pending: {
      winnerGestureId: entry.id,
      winnerQuadrant: serverQuadrant,
      winnerTeam: serverTeam,
      loserTeam: oppositeTeam(serverTeam),
      isAceServe: true,
    },
    point: {
      winnerGestureId: entry.id,
      winnerQuadrant: serverQuadrant,
      loserQuadrant: receive,
      winnerTeam: serverTeam,
      isServe: true,
    },
  }
}

export function isServeStrokeInProgress(
  points: NormalizedPoint[],
  serverQuadrant: Quadrant | null,
): boolean {
  if (!serverQuadrant || points.length < 2) return false
  if (quadrantFromPoint(points[0]!) !== serverQuadrant) return false
  if (!isServeLineShape(points)) return false
  return isServeQuadrantCrossing(points, serverQuadrant)
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
