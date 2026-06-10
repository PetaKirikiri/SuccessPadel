import type { GestureAnalysis } from './gestureAnalysis'
import { pathLength } from './gestureAnalysis'
import type { GestureDebugEntry } from './gestureDebugLog'
import type { NormalizedPoint, Quadrant } from './gestureCapture'
import type { MatchTeam } from './types'
import { tryResolveServe } from './serveGesture'
import {
  tryBeginFoulPoint,
  tryBeginPointExchange,
  type PendingPointExchange,
} from './pointExchange'
import type { CourtInsetBounds } from './padelCourtLayout'

export type ServeContext = {
  origin: NormalizedPoint
  serveSideQuadrant: Quadrant
  servingPlayerQuadrant: Quadrant
  courtInset: CourtInsetBounds
  serveAttempt: 1 | 2
}

export type ScoringIntent =
  | {
      kind: 'serve_in'
      receiveQuadrant: Quadrant
      landing: NormalizedPoint
    }
  | { kind: 'foul'; winnerTeam: MatchTeam; foulerQuadrant: Quadrant; isServe?: boolean }
  | { kind: 'second_serve' }
  | {
      kind: 'ball_path_score'
      winnerQuadrant: Quadrant
      loserQuadrant: Quadrant
      winnerTeam: MatchTeam
    }
  | { kind: 'win'; pending: PendingPointExchange }

export function resolveScoringIntent(
  analysis: GestureAnalysis,
  pathPoints: NormalizedPoint[],
  entryId: string,
  serve: ServeContext | null,
): ScoringIntent | null {
  const entry = { id: entryId } as GestureDebugEntry

  if (serve) {
    const result = tryResolveServe(
      pathPoints,
      entry,
      serve.origin,
      serve.serveSideQuadrant,
      serve.servingPlayerQuadrant,
      serve.courtInset,
      serve.serveAttempt,
    )
    if (result.ok) {
      if (result.kind === 'serve_in') {
        return {
          kind: 'serve_in',
          receiveQuadrant: result.receiveQuadrant,
          landing: result.landing,
        }
      }
      if (result.kind === 'second_serve') {
        return { kind: 'second_serve' }
      }
      return {
        kind: 'foul',
        winnerTeam: result.winnerTeam,
        foulerQuadrant: result.foulerQuadrant,
        isServe: true,
      }
    }
    return null
  }

  const foul = tryBeginFoulPoint(analysis)
  if (foul.ok) {
    return { kind: 'foul', winnerTeam: foul.winnerTeam, foulerQuadrant: foul.foulerQuadrant }
  }

  const win = tryBeginPointExchange(analysis, entry)
  if (win.ok) {
    return { kind: 'win', pending: win.pending }
  }

  return null
}

const MIN_SWIPE_TRAVEL = 0.05
const MIN_SWIPE_DX = 0.07
const MAX_CONFIRM_MS = 420
const MAX_CONFIRM_POINTS = 10
const MAX_CONFIRM_TRAVEL = 0.13

/** Quick horizontal flick after both shot lines are drawn — not a shot stroke. */
export function detectConfirmSwipe(
  points: NormalizedPoint[],
  durationMs?: number,
): 'yes' | 'no' | null {
  if (points.length < 2) return null
  if (durationMs != null && durationMs > MAX_CONFIRM_MS) return null
  if (points.length > MAX_CONFIRM_POINTS) return null
  const travel = pathLength(points)
  if (travel < MIN_SWIPE_TRAVEL || travel > MAX_CONFIRM_TRAVEL) return null
  const start = points[0]!
  const end = points[points.length - 1]!
  const dx = end.x - start.x
  const dy = end.y - start.y
  if (Math.abs(dx) < MIN_SWIPE_DX) return null
  if (Math.abs(dy) > Math.abs(dx) * 0.65) return null
  return dx > 0 ? 'yes' : 'no'
}

/** Shot strokes are longer/slower than confirm flicks. */
export function isShotStrokeDraw(points: NormalizedPoint[], durationMs: number): boolean {
  if (points.length < 2) return false
  if (durationMs > MAX_CONFIRM_MS) return true
  if (points.length > MAX_CONFIRM_POINTS) return true
  return pathLength(points) > MAX_CONFIRM_TRAVEL
}
