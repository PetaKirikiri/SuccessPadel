import type { AmericanoScoringUnit } from './competitionPresets'
import type { GameLogPoint } from './gameLogSerialize'
import { parseFriendlyCourtSetupKey, type MatchGestureLog } from './matchLogServer'
import type { TennisScore } from './tennisScore'

function manualScoreStrings(
  score: TennisScore,
  scoreUnit: AmericanoScoringUnit,
): { scoreA: string; scoreB: string } {
  if (scoreUnit === 'points') {
    return { scoreA: String(score.pointsA ?? 0), scoreB: String(score.pointsB ?? 0) }
  }
  return { scoreA: String(score.gamesA ?? 0), scoreB: String(score.gamesB ?? 0) }
}

export type LiveCourtGamesScore = {
  scoreA: string
  scoreB: string
}

export function liveCourtGamesScore(
  log: MatchGestureLog,
  scoreUnit: AmericanoScoringUnit = 'games',
): LiveCourtGamesScore | null {
  const score: TennisScore | null | undefined =
    log.finalScore ?? (log.pointEvents[0] as GameLogPoint | undefined)?.scoreAfter
  if (!score || (!log.pointEvents.length && !log.finalScore)) return null
  if (log.finalScore && log.pointEvents.length === 0 && log.gestures.length === 0) {
    return manualScoreStrings(score, scoreUnit)
  }
  return { scoreA: String(score.gamesA), scoreB: String(score.gamesB) }
}

export function liveCourtScoreKey(gameNumber: number, courtLabel: string): string {
  return `${gameNumber}:${courtLabel}`
}

export function liveCourtScoreKeyFromSetupKey(courtSetupKey: string): string | null {
  const { gameNumber, courtLabel } = parseFriendlyCourtSetupKey(courtSetupKey)
  if (gameNumber == null || !courtLabel) return null
  return liveCourtScoreKey(gameNumber, courtLabel)
}

export function liveCourtScoresFromLogs(
  logs: MatchGestureLog[],
  scoreUnit: AmericanoScoringUnit = 'games',
): Map<string, LiveCourtGamesScore> {
  const map = new Map<string, LiveCourtGamesScore>()
  for (const log of logs) {
    const key = liveCourtScoreKeyFromSetupKey(log.courtSetupKey)
    const score = key ? liveCourtGamesScore(log, scoreUnit) : null
    if (key && score) map.set(key, score)
  }
  return map
}
