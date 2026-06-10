import type { GameLogGesture, GameLogPoint, GameLogRosterSlot } from './gameLogSerialize'
import type { GameLogSetupState } from './gameLogSetupState'
import type { MatchGestureLog } from './matchLogServer'
import type { PlayerStatsSnapshot } from './matchSessionLog'
import type { MatchTeam } from './types'
import type { TennisScore } from './tennisScore'

/**
 * One save-game blob — maps to a `match_gesture_logs` row.
 * Feed this back into the court board to resume exactly where the ref left off.
 */
export type MatchSaveState = {
  courtSetupKey: string
  roster: GameLogRosterSlot[]
  /** Labeled setup timeline + current snapshot (positions → serve pick → confirm → live). */
  setup: GameLogSetupState
  timeline: {
    points: GameLogPoint[]
    gestures: GameLogGesture[]
  }
  matchStartedAt: string
  matchEndedAt: string | null
  finalScore: TennisScore | null
  winner: MatchTeam | null
  playerStats: PlayerStatsSnapshot[]
  updatedAt: string | null
}

export function matchSaveStateFromLog(log: MatchGestureLog): MatchSaveState {
  const setup = log.setupState ?? {
    updatedAt: log.updatedAt ?? log.matchStartedAt,
    setupPhase: 'positions' as const,
    assignments: {},
  }
  return {
    courtSetupKey: log.courtSetupKey,
    roster: log.roster,
    setup,
    timeline: {
      points: log.pointEvents,
      gestures: log.gestures,
    },
    matchStartedAt: log.matchStartedAt,
    matchEndedAt: log.matchEndedAt,
    finalScore: log.finalScore,
    winner: log.winner,
    playerStats: log.playerStats,
    updatedAt: log.updatedAt,
  }
}
