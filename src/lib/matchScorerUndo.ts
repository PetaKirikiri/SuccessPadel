import type { GestureDebugEntry } from './gestureDebugLog'
import { removeGestureDebugEntry } from './gestureDebugLog'
import {
  chronologicalPointEvents,
  chronologicalSessionGestures,
  gesturesForPoint,
  gesturesSinceLastPoint,
  loadMatchSession,
  pruneSessionGestures,
  removeLastMatchPoint,
  removeMatchGesture,
  scoreBeforeChronologicalPoint,
  type MatchSessionRecord,
} from './matchSessionLog'
import type { TennisScore } from './tennisScore'
import { INITIAL_TENNIS_SCORE } from './tennisScore'

export type LiveUndoPlan =
  | {
      kind: 'first_serve_fault'
      gestureId: string
      serveAttempt: 1
    }
  | {
      kind: 'serve_point'
      gestureIds: string[]
      scoreAfterUndo: TennisScore
      serveAttempt: 1 | 2
    }
  | {
      kind: 'full_point'
      gestureIds: string[]
      scoreAfterUndo: TennisScore
      serveAttempt: 1
    }

function serveIntent(g: GestureDebugEntry): GestureDebugEntry['scoringIntent'] {
  if (g.scoringIntent) return g.scoringIntent
  if (g.shapeLabel !== 'Serve') return undefined
  if (g.report === 'Serve in') return 'serve_in'
  if (g.report?.includes('second serve')) return 'second_serve'
  if (g.report?.includes('foul')) return 'foul'
  return undefined
}

function isFirstServeFault(g: GestureDebugEntry): boolean {
  return serveIntent(g) === 'second_serve'
}

function serveAttemptFromPendingGestures(pending: GestureDebugEntry[]): 1 | 2 {
  return pending.some(isFirstServeFault) ? 2 : 1
}

/** What the live back button should undo next (scorer correction). */
export function planLiveUndo(
  session: MatchSessionRecord | null,
  allGestures: GestureDebugEntry[],
): LiveUndoPlan | null {
  if (!session) return null

  const chronoGestures = chronologicalSessionGestures(session, allGestures)
  const chronoPoints = chronologicalPointEvents(session)
  const pending = gesturesSinceLastPoint(chronoGestures, chronoPoints)

  if (pending.length > 0) {
    const last = pending[pending.length - 1]!
    const linkedIdx = chronoPoints.findIndex((p) => p.winnerGestureId === last.id)

    if (linkedIdx >= 0) {
      const scoreAfterUndo = scoreBeforeChronologicalPoint(chronoPoints, linkedIdx)
      const priorOnPoint = pending.slice(0, -1)
      const serveAttempt = serveAttemptFromPendingGestures(priorOnPoint)
      return {
        kind: 'serve_point',
        gestureIds: [last.id],
        scoreAfterUndo,
        serveAttempt,
      }
    }

    if (isFirstServeFault(last)) {
      return { kind: 'first_serve_fault', gestureId: last.id, serveAttempt: 1 }
    }

    return null
  }

  if (chronoPoints.length === 0) return null

  const lastIdx = chronoPoints.length - 1
  const pointGestures = gesturesForPoint(chronoGestures, chronoPoints, lastIdx)
  return {
    kind: 'full_point',
    gestureIds: pointGestures.map((g) => g.id),
    scoreAfterUndo: scoreBeforeChronologicalPoint(chronoPoints, lastIdx),
    serveAttempt: 1,
  }
}

export function canUndoLive(
  session: MatchSessionRecord | null,
  allGestures: GestureDebugEntry[],
): boolean {
  return planLiveUndo(session, allGestures) != null
}

export function serveAttemptFromSession(
  session: MatchSessionRecord | null,
  allGestures: GestureDebugEntry[],
): 1 | 2 {
  if (!session) return 1
  const pending = gesturesSinceLastPoint(
    chronologicalSessionGestures(session, allGestures),
    chronologicalPointEvents(session),
  )
  return serveAttemptFromPendingGestures(pending)
}

export function scoreFromSession(
  session: MatchSessionRecord | null,
): TennisScore {
  if (!session?.pointEvents.length) return INITIAL_TENNIS_SCORE
  return session.pointEvents[0]!.scoreAfter
}

export function truncateSessionGesturesFromPoint(
  sessionId: string,
  fromChronologicalIndex: number,
  allGestures: GestureDebugEntry[],
): void {
  const session = loadMatchSession(sessionId)
  if (!session) return

  const chronoPoints = chronologicalPointEvents(session)
  const chronoGestures = chronologicalSessionGestures(session, allGestures)
  const keptGestureIds = new Set<string>()

  for (let i = 0; i < fromChronologicalIndex && i < chronoPoints.length; i++) {
    for (const g of gesturesForPoint(chronoGestures, chronoPoints, i)) {
      keptGestureIds.add(g.id)
    }
  }

  pruneSessionGestures(sessionId, keptGestureIds)

  for (const g of chronoGestures) {
    if (!keptGestureIds.has(g.id)) {
      removeGestureDebugEntry(g.id)
    }
  }
}

export function applyLiveUndo(sessionId: string, plan: LiveUndoPlan): void {
  if (plan.kind === 'first_serve_fault') {
    removeMatchGesture(sessionId, plan.gestureId)
    removeGestureDebugEntry(plan.gestureId)
    return
  }

  if (plan.kind === 'serve_point') {
    removeLastMatchPoint(sessionId)
    for (const id of plan.gestureIds) {
      removeMatchGesture(sessionId, id)
      removeGestureDebugEntry(id)
    }
    return
  }

  removeLastMatchPoint(sessionId)
  for (const id of plan.gestureIds) {
    removeMatchGesture(sessionId, id)
    removeGestureDebugEntry(id)
  }
}