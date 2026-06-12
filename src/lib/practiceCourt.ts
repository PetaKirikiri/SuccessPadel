import type { CourtPlayer } from './americanoSchedule'
import type { Quadrant } from './gestureCapture'
import type { LoadedCourtSetup } from './courtPositionSetup'
import type { QuadrantPlayers } from './gesturePadPlayers'
import { INITIAL_TENNIS_SCORE } from './tennisScore'

export const PRACTICE_COURT_SETUP_KEY = 'practice-court-local'

/** Fixed roster for the practice pad — no setup wizard. */
export const PRACTICE_ROSTER: CourtPlayer[] = [
  { id: 'practice-a', name: 'Ana', avatarUrl: null },
  { id: 'practice-b', name: 'Bo', avatarUrl: null },
  { id: 'practice-c', name: 'Cy', avatarUrl: null },
  { id: 'practice-d', name: 'Di', avatarUrl: null },
]

export function practiceQuadrantPlayers(): QuadrantPlayers {
  return {
    TL: PRACTICE_ROSTER[0]!,
    TR: PRACTICE_ROSTER[1]!,
    BL: PRACTICE_ROSTER[2]!,
    BR: PRACTICE_ROSTER[3]!,
  }
}

/** Skip positions + serve pick — land on court ready to rally. */
export function practiceReadySetup(initialServe: Quadrant = 'BL'): LoadedCourtSetup {
  return {
    assignments: practiceQuadrantPlayers(),
    setupPhase: 'ready',
    pendingTeamPlacement: null,
    pendingServeQuadrant: null,
    initialServeQuadrant: initialServe,
    score: INITIAL_TENNIS_SCORE,
    matchSubmitted: false,
    matchStartedAt: new Date().toISOString(),
  }
}
