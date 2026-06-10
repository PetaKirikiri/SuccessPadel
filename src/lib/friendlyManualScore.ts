import type { CourtPlayer } from './americanoSchedule'
import type { AmericanoScoringUnit } from './competitionPresets'
import { friendlyCourtSetupKey } from './friendlyCourtLive'
import type { GameLogRosterSlot } from './gameLogSerialize'
import { upsertMatchGestureLog } from './matchLogServer'
import type { Quadrant } from './gestureCapture'
import type { MatchTeam } from './types'
import { INITIAL_TENNIS_SCORE, type TennisScore } from './tennisScore'

export type FriendlyCourtScoreSubmit = {
  gameNumber: number
  courtLabel: string
  teamA: number
  teamB: number
  teamAPlayers?: CourtPlayer[]
  teamBPlayers?: CourtPlayer[]
}

function rosterFromCourt(
  teamAPlayers?: CourtPlayer[],
  teamBPlayers?: CourtPlayer[],
): GameLogRosterSlot[] {
  const quads: Quadrant[] = ['TL', 'TR', 'BL', 'BR']
  const players = [teamAPlayers?.[0], teamAPlayers?.[1], teamBPlayers?.[0], teamBPlayers?.[1]]
  return quads.map((quadrant, i) => ({
    quadrant,
    playerId: players[i]?.id ?? null,
    name: players[i]?.name ?? '',
  }))
}

export function tennisScoreForManual(
  teamA: number,
  teamB: number,
  scoreUnit: AmericanoScoringUnit,
): TennisScore {
  if (scoreUnit === 'points') {
    return { ...INITIAL_TENNIS_SCORE, pointsA: teamA, pointsB: teamB }
  }
  return { ...INITIAL_TENNIS_SCORE, gamesA: teamA, gamesB: teamB }
}

export async function saveFriendlyManualCourtScore(
  sessionId: string,
  entry: FriendlyCourtScoreSubmit,
  scoreUnit: AmericanoScoringUnit,
): Promise<{ error: string | null }> {
  const now = new Date().toISOString()
  const finalScore = tennisScoreForManual(entry.teamA, entry.teamB, scoreUnit)
  const winner: MatchTeam = entry.teamA >= entry.teamB ? 'a' : 'b'
  const courtSetupKey = friendlyCourtSetupKey(sessionId, entry.gameNumber, entry.courtLabel)

  return upsertMatchGestureLog({
    courtSetupKey,
    friendlySessionId: sessionId,
    competitionId: null,
    gameNumber: String(entry.gameNumber),
    courtId: entry.courtLabel,
    matchStartedAt: now,
    matchEndedAt: now,
    finalScore,
    winner,
    playerStats: [],
    pointEvents: [],
    gestures: [],
    roster: rosterFromCourt(entry.teamAPlayers, entry.teamBPlayers),
    setupState: {
      updatedAt: now,
      setupPhase: 'ready',
      assignments: {},
    },
  })
}
