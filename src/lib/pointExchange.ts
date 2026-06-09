import type { GestureAnalysis } from './gestureAnalysis'
import { pathLength } from './gestureAnalysis'
import { classifyGestureShot } from './gestureHelpCounts'
import type { GestureDebugEntry } from './gestureDebugLog'
import type { NormalizedPoint, Quadrant } from './gestureCapture'
import type { MatchTeam } from './types'
import { pointWinnerFromGesture, quadrantTeam } from './gestureScoring'

export type PointExchangePhase = 'idle' | 'await_loser'

export type PendingPointExchange = {
  winnerGestureId: string
  winnerQuadrant: Quadrant
  winnerTeam: MatchTeam
  loserTeam: MatchTeam
  /** Ace already scored — awaiting receiver shot tag only. */
  isAceServe?: boolean
}

export type PointExchangeState =
  | { phase: 'idle' }
  | { phase: 'await_loser'; pending: PendingPointExchange }

const MIN_LOSER_TAG_PATH = 0.04

export function oppositeTeam(team: MatchTeam): MatchTeam {
  return team === 'a' ? 'b' : 'a'
}

export function isQuadrantOnTeam(q: Quadrant, team: MatchTeam): boolean {
  return quadrantTeam(q) === team
}

export function isWinningShot(analysis: GestureAnalysis): boolean {
  const category = classifyGestureShot(analysis)
  if (category.endsWith('-score')) return true
  // Live report already showed a win — don't reject a valid stroke over strict re-check.
  if (/\b(Win|Score)\b/.test(analysis.report)) return true
  return false
}

export function isLosingShot(analysis: GestureAnalysis): boolean {
  const category = classifyGestureShot(analysis)
  if (category.endsWith('-foul')) return true
  if (/\bFoul\b/.test(analysis.report)) return true
  return false
}

export function tryBeginPointExchange(
  analysis: GestureAnalysis,
  entry: GestureDebugEntry,
): { ok: true; pending: PendingPointExchange } | { ok: false; reason: string } {
  if (!isWinningShot(analysis)) {
    if (isLosingShot(analysis)) {
      return { ok: false, reason: 'That counted as a foul — draw the winning shot (finish going up)' }
    }
    return { ok: false, reason: 'Draw a winning shot (finish going up)' }
  }
  const winnerTeam = quadrantTeam(analysis.startQuadrant)
  return {
    ok: true,
    pending: {
      winnerGestureId: entry.id,
      winnerQuadrant: analysis.startQuadrant,
      winnerTeam,
      loserTeam: oppositeTeam(winnerTeam),
    },
  }
}

/** Foul = one gesture, point to the other team — no losing-shot follow-up. */
export function tryBeginFoulPoint(
  analysis: GestureAnalysis,
): { ok: true; winnerTeam: MatchTeam; foulerQuadrant: Quadrant } | { ok: false } {
  if (!isLosingShot(analysis)) return { ok: false }
  const winnerTeam = pointWinnerFromGesture(analysis)
  if (!winnerTeam) return { ok: false }
  return { ok: true, winnerTeam, foulerQuadrant: analysis.startQuadrant }
}

/** Any real stroke on the losing side — style and direction do not matter. */
export function isRecognizedLoserShot(
  analysis: GestureAnalysis,
  pathPoints: NormalizedPoint[],
): boolean {
  if (pathPoints.length < 2 || analysis.shape === 'TAP') return false
  return pathLength(pathPoints) >= MIN_LOSER_TAG_PATH
}

export function tryCompleteLoserTag(
  analysis: GestureAnalysis,
  entry: GestureDebugEntry,
  pending: PendingPointExchange,
  pathPoints: NormalizedPoint[],
): { ok: true; loserQuadrant: Quadrant; loserGestureId: string } | { ok: false; reason: string } {
  if (!isQuadrantOnTeam(analysis.startQuadrant, pending.loserTeam)) {
    return { ok: false, reason: 'Tag the losing shot on the red side' }
  }
  if (!isRecognizedLoserShot(analysis, pathPoints)) {
    return { ok: false, reason: 'Draw what they tried on the red side' }
  }
  return {
    ok: true,
    loserQuadrant: analysis.startQuadrant,
    loserGestureId: entry.id,
  }
}
