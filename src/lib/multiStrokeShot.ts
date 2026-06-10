import {
  BACKHAND_DIRECTION_MIN,
  buildComposedHorizVertAnalysis,
  detectHorizShotShape,
  detectVerticalVerdictStroke,
  horizStepLabel,
  horizStrokeFinishVerdict,
  parseHorizStroke,
  pathSpread,
  type GestureAnalysis,
  type GestureShape,
} from './gestureAnalysis'
import type { CapturedGesture, NormalizedPoint, Quadrant } from './gestureCapture'
import { isVolleyZoneStart } from './padelCourtLayout'

export type HorizStrokeDraft = {
  entryId: string
  captured: CapturedGesture
  analysis: GestureAnalysis
  shape: 'BACKHAND' | 'FOREHAND'
  horizStart: NormalizedPoint
  horizEnd: NormalizedPoint
  shotLabel: string
  innerZone: boolean
}

export { horizStepLabel, detectVerticalVerdictStroke, buildComposedHorizVertAnalysis }

/** Horizontal FH/BH leg alone — step 1 only; ↑/↓ vertical required to finish. */
export function isIncompleteHorizontalStroke(
  captured: CapturedGesture,
  analysis: GestureAnalysis,
  options?: { servePhase?: boolean },
): boolean {
  if (options?.servePhase) return false
  if (analysis.shape === 'SMASH' || analysis.shape === 'LOB' || analysis.shape === 'TAP') {
    return false
  }
  if (analysis.shape === 'VOLLEY') return false

  const parsed = parseHorizStroke(captured.pathPoints)
  if (parsed && parsed.finishPoint !== parsed.horizEnd) {
    return horizStrokeFinishVerdict(parsed.horizEnd, parsed.finishPoint) == null
  }

  return detectHorizontalRacketStroke(captured.pathPoints, analysis.startQuadrant) != null
}

export function isMultiStrokeHorizCandidate(
  captured: CapturedGesture,
  analysis: GestureAnalysis,
): boolean {
  return isIncompleteHorizontalStroke(captured, analysis)
}

export function detectHorizontalRacketStroke(
  points: NormalizedPoint[],
  startQuadrant: Quadrant,
): { shape: 'BACKHAND' | 'FOREHAND'; horizStart: NormalizedPoint; horizEnd: NormalizedPoint } | null {
  if (points.length < 2) return null

  const parsed = parseHorizStroke(points)
  if (parsed && parsed.finishPoint === parsed.horizEnd) {
    const shape = detectHorizShotShape(startQuadrant, parsed.horizStart, parsed.horizEnd)
    if (!shape) return null
    return { shape, horizStart: parsed.horizStart, horizEnd: parsed.horizEnd }
  }

  const start = points[0]!
  const end = points[points.length - 1]!
  const { xSpread, ySpread } = pathSpread(points)
  const dx = Math.abs(end.x - start.x)
  const dy = Math.abs(end.y - start.y)
  if (dx < BACKHAND_DIRECTION_MIN || dx <= dy * 1.35) return null
  if (xSpread < BACKHAND_DIRECTION_MIN || xSpread <= ySpread * 1.25) return null

  const shape = detectHorizShotShape(startQuadrant, start, end)
  if (!shape) return null
  return { shape, horizStart: start, horizEnd: end }
}

export function createHorizStrokeDraft(
  entryId: string,
  captured: CapturedGesture,
  analysis: GestureAnalysis,
): HorizStrokeDraft | null {
  const horiz = detectHorizontalRacketStroke(captured.pathPoints, analysis.startQuadrant)
  if (!horiz) return null
  const innerZone = isVolleyZoneStart(analysis.start, analysis.startQuadrant)
  return {
    entryId,
    captured,
    analysis: {
      ...analysis,
      shape: horiz.shape,
      shapeLabel: horiz.shape === 'BACKHAND' ? 'Backhand' : 'Forehand',
    },
    shape: horiz.shape,
    horizStart: horiz.horizStart,
    horizEnd: horiz.horizEnd,
    innerZone,
    shotLabel: horizStepLabel(horiz.shape, innerZone),
  }
}

export function buildDraftFromHoriz(
  _entryId: string,
  captured: CapturedGesture,
  _analysis: GestureAnalysis,
  draft: HorizStrokeDraft,
  vertCaptured: CapturedGesture,
  vertDurationMs: number,
  playerNames?: Partial<Record<Quadrant, string>>,
): { analysis: GestureAnalysis; captured: CapturedGesture; shotLabel: string } {
  const composed = buildComposedHorizVertAnalysis(
    draft.analysis,
    draft.captured.pathPoints,
    vertCaptured.pathPoints,
    vertDurationMs,
    { playerNames },
  )
  const combinedPath = [...draft.captured.pathPoints, ...vertCaptured.pathPoints.slice(1)]
  const mergedCaptured: CapturedGesture = {
    ...captured,
    pathPoints: combinedPath,
    start: draft.captured.start,
    end: vertCaptured.end,
    startQuadrant: draft.captured.startQuadrant,
    endQuadrant: vertCaptured.endQuadrant,
    code: `${draft.captured.code}+${vertCaptured.code}`,
  }
  const shotLabel =
    composedHorizVertShotLabel(
      draft.shape,
      draft.analysis.startQuadrant,
      draft.analysis.start,
      draft.horizEnd,
      vertCaptured.end,
    ) ?? composed.shapeLabel

  return { analysis: composed, captured: mergedCaptured, shotLabel }
}

export function composedHorizVertShotLabel(
  shape: Extract<GestureShape, 'BACKHAND' | 'FOREHAND'>,
  startQuadrant: Quadrant,
  horizStart: NormalizedPoint,
  horizEnd: NormalizedPoint,
  finish: NormalizedPoint,
): string | null {
  const inner = isVolleyZoneStart(horizStart, startQuadrant)
  const verdict = detectVerticalVerdictStroke([horizEnd, finish], horizEnd)
  const subtype = shape === 'BACKHAND' ? 'BH' : 'FH'

  if (inner) {
    if (verdict === 'SCORE') return `Volley ${subtype} Score`
    if (verdict === 'FOUL') return `Volley ${subtype} Foul`
    return `Volley ${subtype}`
  }
  if (verdict === 'FOUL') return shape === 'BACKHAND' ? 'Backhand Foul' : 'Forehand Foul'
  if (verdict === 'SCORE') return shape === 'BACKHAND' ? 'Backhand Win' : 'Forehand Win'
  return shape === 'BACKHAND' ? 'Backhand' : 'Forehand'
}
