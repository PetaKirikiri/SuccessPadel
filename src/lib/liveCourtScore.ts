import type { GameLogPoint } from './gameLogSerialize'
import { parseFriendlyCourtSetupKey, type MatchGestureLog } from './matchLogServer'
import type { TennisScore } from './tennisScore'

export type LiveCourtGamesScore = {
  scoreA: string
  scoreB: string
}

export function liveCourtGamesScore(log: MatchGestureLog): LiveCourtGamesScore | null {
  const score: TennisScore | null | undefined =
    log.finalScore ?? (log.pointEvents[0] as GameLogPoint | undefined)?.scoreAfter
  if (!score || (!log.pointEvents.length && !log.finalScore)) return null
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

export function liveCourtScoresFromLogs(logs: MatchGestureLog[]): Map<string, LiveCourtGamesScore> {
  const map = new Map<string, LiveCourtGamesScore>()
  for (const log of logs) {
    const key = liveCourtScoreKeyFromSetupKey(log.courtSetupKey)
    const score = key ? liveCourtGamesScore(log) : null
    if (key && score) map.set(key, score)
  }
  return map
}
