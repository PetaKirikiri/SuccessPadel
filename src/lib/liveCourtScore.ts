import type { AmericanoScoringUnit } from './competitionPresets'
import type { GameLogPoint } from './gameLogSerialize'
import { parseFriendlyCourtSetupKey, type MatchGestureLog } from './matchLogServer'
import type { TennisScore } from './tennisScore'

export type LiveCourtPointFeed = {
  courtKey: string
  points: GameLogPoint[]
  live: boolean
}

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
  const lastPoint = log.pointEvents[log.pointEvents.length - 1] as GameLogPoint | undefined
  const score: TennisScore | null | undefined = log.finalScore ?? lastPoint?.scoreAfter
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

export function liveCourtScoresFromCompetitionLogs(
  logs: MatchGestureLog[],
  courtIdToLabel: Map<string, string>,
  scoreUnit: AmericanoScoringUnit = 'games',
): Map<string, LiveCourtGamesScore> {
  const map = new Map<string, LiveCourtGamesScore>()
  for (const log of logs) {
    const gameNumber = log.gameNumber ? Number(log.gameNumber) : null
    const courtLabel = log.courtId ? courtIdToLabel.get(log.courtId) ?? log.courtId : null
    if (gameNumber == null || !courtLabel) continue
    const key = liveCourtScoreKey(gameNumber, courtLabel)
    const score = liveCourtGamesScore(log, scoreUnit)
    if (score) map.set(key, score)
  }
  return map
}

export function liveCourtFeedsFromLogs(
  logs: MatchGestureLog[],
  courtKeyForLog: (log: MatchGestureLog) => string | null,
): Map<string, LiveCourtPointFeed> {
  const map = new Map<string, LiveCourtPointFeed>()
  for (const log of logs) {
    const courtKey = courtKeyForLog(log)
    if (!courtKey || !log.pointEvents.length) continue
    map.set(courtKey, {
      courtKey,
      points: log.pointEvents,
      live: !log.matchEndedAt,
    })
  }
  return map
}
