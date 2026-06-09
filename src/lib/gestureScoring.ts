import type { GestureAnalysis } from './gestureAnalysis'
import { classifyGestureShot } from './gestureHelpCounts'
import type { Quadrant } from './gestureCapture'
import type { MatchTeam } from './types'

export function quadrantTeam(q: Quadrant): MatchTeam {
  return q === 'TL' || q === 'TR' ? 'a' : 'b'
}

export function pointWinnerFromGesture(analysis: GestureAnalysis): MatchTeam | null {
  const category = classifyGestureShot(analysis)
  if (category.endsWith('-score')) return quadrantTeam(analysis.startQuadrant)
  if (category.endsWith('-foul')) {
    const team = quadrantTeam(analysis.startQuadrant)
    return team === 'a' ? 'b' : 'a'
  }
  return null
}
