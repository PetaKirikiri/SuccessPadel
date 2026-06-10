import type { GestureDebugEntry } from './gestureDebugLog'
import type { MatchPointEvent } from './matchSessionLog'
import { INITIAL_TENNIS_SCORE, type TennisScore } from './tennisScore'
import type { TranslateFn } from '../i18n'

export type GameLogTimelineItem =
  | { kind: 'point'; event: MatchPointEvent; pointIndex: number }
  | { kind: 'serve_fault'; gesture: GestureDebugEntry; scoreAt: TennisScore }

export function isServeFirstFaultGesture(g: GestureDebugEntry): boolean {
  if (g.scoringIntent === 'second_serve') return true
  return g.shapeLabel === 'Serve' && /second serve/i.test(g.report ?? '')
}

export function serveGestureLabel(g: GestureDebugEntry, t: TranslateFn): string {
  const report = g.report ?? ''
  if (/serve in/i.test(report)) return t('pad.shots.serveIn')
  if (/net.*second serve/i.test(report)) return t('pad.shots.netSecondServe')
  if (/out.*second serve/i.test(report)) return t('pad.shots.outSecondServe')
  if (/net.*foul/i.test(report)) return t('pad.shots.netFoul')
  if (/serve out.*foul|out.*foul/i.test(report)) return t('pad.shots.serveOutFoul')
  if (g.shapeLabel === 'Serve') return t('pad.shots.serve')
  return report
}

export function buildGameLogTimeline(
  gesturesNewestFirst: GestureDebugEntry[],
  pointsChrono: MatchPointEvent[],
): GameLogTimelineItem[] {
  const chronoGestures = [...gesturesNewestFirst].reverse()
  const pointByWinnerId = new Map(
    pointsChrono.map((event, pointIndex) => [event.winnerGestureId, { event, pointIndex }]),
  )
  let scoreAt = INITIAL_TENNIS_SCORE
  const items: GameLogTimelineItem[] = []

  for (const gesture of chronoGestures) {
    const linked = pointByWinnerId.get(gesture.id)
    if (linked) {
      items.push({ kind: 'point', event: linked.event, pointIndex: linked.pointIndex })
      scoreAt = linked.event.scoreAfter
      continue
    }
    if (isServeFirstFaultGesture(gesture)) {
      items.push({ kind: 'serve_fault', gesture, scoreAt: { ...scoreAt } })
    }
  }

  return items
}
