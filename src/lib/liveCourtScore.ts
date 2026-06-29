import type { AmericanoScoringUnit } from './competitionPresets'
import { isGestureCameraCourtLog } from './gestureCameraScore'
import type { GameLogPoint } from './gameLogSerialize'
import type { MatchTeam } from './types'
import { parseFriendlyCourtSetupKey, type MatchGestureLog } from './matchLogServer'
import { INITIAL_TENNIS_SCORE, formatGameScore, formatTennisPoint, type TennisScore } from './tennisScore'

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
  const camera = isGestureCameraCourtLog(log)
  const lastPoint = log.pointEvents[log.pointEvents.length - 1] as GameLogPoint | undefined
  const setupScore = (log.setupState as { score?: TennisScore } | null | undefined)?.score
  const score: TennisScore | null | undefined =
    log.finalScore ?? lastPoint?.scoreAfter ?? (camera ? setupScore : null)

  if (!score) {
    if (camera && !log.matchEndedAt) return manualScoreStrings(INITIAL_TENNIS_SCORE, scoreUnit)
    return null
  }

  if (!camera && !log.pointEvents.length && !log.finalScore) return null
  if (!camera && log.finalScore && log.pointEvents.length === 0 && log.gestures.length === 0) {
    return manualScoreStrings(score, scoreUnit)
  }
  return manualScoreStrings(score, scoreUnit)
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
    if (!courtKey) continue
    if (log.pointEvents.length > 0) {
      map.set(courtKey, {
        courtKey,
        points: log.pointEvents,
        live: !log.matchEndedAt,
      })
      continue
    }
    if (isGestureCameraCourtLog(log) && !log.matchEndedAt) {
      map.set(courtKey, { courtKey, points: [], live: true })
    }
  }
  return map
}

export type LiveCourtPointScores = {
  scoreA: string
  scoreB: string
}

/** Live tennis points for the court card centre (e.g. `15` / `30`). */
export function liveCourtPointScores(
  feed: LiveCourtPointFeed | undefined,
  trackingLive: boolean,
): LiveCourtPointScores | undefined {
  const scoreAfter = feed?.points[feed.points.length - 1]?.scoreAfter
  if (scoreAfter) {
    return {
      scoreA: formatTennisPoint(scoreAfter.pointsA),
      scoreB: formatTennisPoint(scoreAfter.pointsB),
    }
  }
  if (trackingLive || feed?.live) return { scoreA: '0', scoreB: '0' }
  return undefined
}

/** Tennis point readout for under games on a court card (e.g. `15 - 30`). */
export function liveCourtPointLine(
  feed: LiveCourtPointFeed | undefined,
  trackingLive: boolean,
): string | undefined {
  const lastPoint = feed?.points[feed.points.length - 1]
  const scoreAfter = lastPoint?.scoreAfter
  if (scoreAfter) return formatGameScore(scoreAfter)
  if (trackingLive || feed?.live) return '0 - 0'
  return undefined
}

export type LiveCourtGameResult = {
  gameNumber: number
  gamesA: number
  gamesB: number
  winner: MatchTeam
  /** Last point line when the game ended (e.g. `40 - 30`). */
  lastPointLine?: string
}

/** Each row is one completed game — when gamesA or gamesB increments in the log. */
export function liveCourtGameResults(points: GameLogPoint[] | undefined): LiveCourtGameResult[] {
  if (!points?.length) return []
  const results: LiveCourtGameResult[] = []
  let prevA = 0
  let prevB = 0
  let gameNumber = 0
  for (const point of points) {
    const { gamesA, gamesB } = point.scoreAfter
    if (gamesA > prevA) {
      gameNumber += 1
      results.push({
        gameNumber,
        gamesA,
        gamesB,
        winner: 'a',
        lastPointLine: point.scoreBefore ? formatGameScore(point.scoreBefore) : undefined,
      })
    } else if (gamesB > prevB) {
      gameNumber += 1
      results.push({
        gameNumber,
        gamesA,
        gamesB,
        winner: 'b',
        lastPointLine: point.scoreBefore ? formatGameScore(point.scoreBefore) : undefined,
      })
    }
    prevA = gamesA
    prevB = gamesB
  }
  return results
}
