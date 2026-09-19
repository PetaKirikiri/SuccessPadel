import type { GestureRecognizerResult } from '@mediapipe/tasks-vision'

export type ThumbScoreAction = 'team1' | 'team2' | 'undo'
export type ThumbDecision = { action: ThumbScoreAction | null; releaseDetected: boolean }

export const THUMB_CONFIDENCE = 0.65
export const THUMB_ABSENCE_CONFIDENCE = 0.5

/**
 * Interpret the trained classifier, not hand-written joint/angle rules.
 * Keep all categories: filtering to thumbs could hide a stronger neutral result.
 * Any non-thumb pose can end a gesture, not a prescribed reset sign.
 * The episode gate filters short classification glitches across frames.
 */
export function thumbDecisionFromResult(
  result: Pick<GestureRecognizerResult, 'landmarks' | 'gestures'>,
): ThumbDecision {
  const unknown: ThumbDecision = { action: null, releaseDetected: false }
  if (result.landmarks.length === 0 && result.gestures.length === 0) {
    return { action: null, releaseDetected: true }
  }
  if (result.landmarks.length !== 1 || result.landmarks[0]?.length !== 21) return unknown
  const categories = result.gestures[0] ?? []
  const best = categories.reduce<(typeof categories)[number] | undefined>((top, item) => {
    if (!Number.isFinite(item.score) || item.score < 0 || item.score > 1) return top
    return !top || item.score > top.score ? item : top
  }, undefined)
  if (!best) return unknown
  if (best.score >= THUMB_CONFIDENCE) {
    if (best.categoryName === 'Thumb_Up') return { action: 'team1', releaseDetected: false }
    if (best.categoryName === 'Thumb_Down') return { action: 'team2', releaseDetected: false }
    if (best.categoryName === 'Victory') return { action: 'undo', releaseDetected: false }
  }
  const stillThumb = best.categoryName === 'Thumb_Up' || best.categoryName === 'Thumb_Down' || best.categoryName === 'Victory'
  return { action: null, releaseDetected: !stillThumb && best.score >= THUMB_ABSENCE_CONFIDENCE }
}
