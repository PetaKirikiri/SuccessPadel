import type { AmericanoScoringUnit } from './competitionPresets'
import { gamesManualOverrideAt, isGestureCameraCourtLog, MANUAL_GAMES_GESTURE_ID, MANUAL_POINTS_GESTURE_ID } from './gestureCameraScore'
import type { GameLogPoint } from './gameLogSerialize'
import type { MatchTeam } from './types'
import { parseFriendlyCourtSetupKey, type MatchGestureLog } from './matchLogServer'
import { INITIAL_TENNIS_SCORE, formatGameScore, formatTennisPoint, type TennisScore } from './tennisScore'

export type LiveCourtPointFeed = {
  courtKey: string
  points: GameLogPoint[]
  live: boolean
  /** Set when games were typed on the court card — do not rewind with stale point feeds. */
  gamesManualOverrideAt?: string
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
  gamesManualOverrideAt?: string
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
  if (camera) {
    const manualAt = gamesManualOverrideAt(log)
    return {
      ...manualScoreStrings(score, scoreUnit),
      ...(manualAt ? { gamesManualOverrideAt: manualAt } : {}),
    }
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

/** Court card keys for a setup key — matches label and court-id aliases. */
export function liveCourtScoreKeysForSetupKey(
  courtSetupKey: string,
  courtIdToLabel?: Map<string, string>,
): string[] {
  const { gameNumber, courtLabel } = parseFriendlyCourtSetupKey(courtSetupKey)
  if (gameNumber == null || !courtLabel) return []
  const keys = new Set<string>([liveCourtScoreKey(gameNumber, courtLabel)])
  const mapped = courtIdToLabel?.get(courtLabel)
  if (mapped && mapped !== courtLabel) keys.add(liveCourtScoreKey(gameNumber, mapped))
  return [...keys]
}

function liveCourtScoreKeysForEphemeralSource(
  sourceKey: string,
  courtIdToLabel?: Map<string, string>,
): string[] {
  if (/^\d+:.+/.test(sourceKey)) return [sourceKey]
  return liveCourtScoreKeysForSetupKey(sourceKey, courtIdToLabel)
}

export function patchEphemeralFeed(
  feed: LiveCourtPointFeed | undefined,
  courtKey: string,
  score: TennisScore,
): LiveCourtPointFeed {
  const points = [...(feed?.points ?? [])]
  const last = points[points.length - 1]
  if (last) {
    points[points.length - 1] = { ...last, scoreAfter: score }
  } else {
    points.push({
      at: new Date().toISOString(),
      winner: 'a',
      scoreAfter: score,
      winnerGestureId: 'ephemeral',
      loserGestureId: '',
      winnerQuadrant: '',
      loserQuadrant: '',
      isServe: false,
    })
  }
  return { courtKey, points, live: true }
}

export function mergeEphemeralLiveCourtScores(
  scores: Map<string, LiveCourtGamesScore>,
  ephemeralScores: Map<string, TennisScore>,
  courtIdToLabel?: Map<string, string>,
  scoreUnit: AmericanoScoringUnit = 'games',
): Map<string, LiveCourtGamesScore> {
  const map = new Map(scores)
  for (const [setupKey, score] of ephemeralScores) {
    for (const courtKey of liveCourtScoreKeysForEphemeralSource(setupKey, courtIdToLabel)) {
      map.set(courtKey, manualScoreStrings(score, scoreUnit))
    }
  }
  return map
}

export function mergeEphemeralLiveCourtFeeds(
  feeds: Map<string, LiveCourtPointFeed>,
  ephemeralScores: Map<string, TennisScore>,
  courtIdToLabel?: Map<string, string>,
): Map<string, LiveCourtPointFeed> {
  const map = new Map(feeds)
  for (const [setupKey, score] of ephemeralScores) {
    for (const courtKey of liveCourtScoreKeysForEphemeralSource(setupKey, courtIdToLabel)) {
      if (map.get(courtKey)?.gamesManualOverrideAt) continue
      map.set(courtKey, patchEphemeralFeed(map.get(courtKey), courtKey, score))
    }
  }
  return map
}

export function tennisScoreFromFeed(feed: LiveCourtPointFeed | undefined): TennisScore | null {
  return feed?.points[feed.points.length - 1]?.scoreAfter ?? null
}

function feedDisplayProgress(feed: LiveCourtPointFeed): number {
  const score = tennisScoreFromFeed(feed)
  if (!score) return feed.live ? 0 : -1
  return feed.points.length * 1_000_000 + (score.gamesA + score.gamesB) * 10_000 + score.pointsA * 100 + score.pointsB
}

function shouldAcceptIncomingFeed(prev: LiveCourtPointFeed, next: LiveCourtPointFeed): boolean {
  if (next.gamesManualOverrideAt) {
    if (!prev.gamesManualOverrideAt) return true
    return Date.parse(next.gamesManualOverrideAt) >= Date.parse(prev.gamesManualOverrideAt)
  }
  if (prev.gamesManualOverrideAt) return false
  return feedDisplayProgress(next) >= feedDisplayProgress(prev)
}

/** Never let a DB refresh rewind live point feeds already shown on court cards. */
export function latchLiveCourtFeeds(
  prev: Map<string, LiveCourtPointFeed>,
  next: Map<string, LiveCourtPointFeed>,
): Map<string, LiveCourtPointFeed> {
  const out = new Map(next)
  for (const [key, prevFeed] of prev) {
    const nextFeed = out.get(key)
    if (!nextFeed) {
      out.set(key, prevFeed)
      continue
    }
    if (!shouldAcceptIncomingFeed(prevFeed, nextFeed)) {
      out.set(key, prevFeed)
    }
  }
  return out
}

function gamesScoreTotal(score: LiveCourtGamesScore): number {
  return (Number(score.scoreA) || 0) + (Number(score.scoreB) || 0)
}

function shouldAcceptIncomingGamesScore(
  prev: LiveCourtGamesScore,
  next: LiveCourtGamesScore,
): boolean {
  if (next.gamesManualOverrideAt) {
    if (!prev.gamesManualOverrideAt) return true
    return Date.parse(next.gamesManualOverrideAt) >= Date.parse(prev.gamesManualOverrideAt)
  }
  if (prev.gamesManualOverrideAt) return false
  return gamesScoreTotal(next) >= gamesScoreTotal(prev)
}

/** Never let a DB refresh rewind games already shown on court cards. */
export function latchLiveCourtGamesScores(
  prev: Map<string, LiveCourtGamesScore>,
  next: Map<string, LiveCourtGamesScore>,
): Map<string, LiveCourtGamesScore> {
  const out = new Map(next)
  for (const [key, prevScore] of prev) {
    const nextScore = out.get(key)
    if (!nextScore) {
      out.set(key, prevScore)
      continue
    }
    if (!shouldAcceptIncomingGamesScore(prevScore, nextScore)) {
      out.set(key, prevScore)
    }
  }
  return out
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
      const manualAt = gamesManualOverrideAt(log)
      map.set(courtKey, {
        courtKey,
        points: log.pointEvents,
        live: !log.matchEndedAt,
        ...(manualAt ? { gamesManualOverrideAt: manualAt } : {}),
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

/** Resolve centre tennis points for gesture-scored courts — always 0-0 until feed/ephemeral arrives. */
export function resolveGestureCourtPointScores(
  feed: LiveCourtPointFeed | undefined,
  trackingLive: boolean,
  showGesturePoints: boolean,
): LiveCourtPointScores | undefined {
  if (!showGesturePoints) return undefined
  if (feed?.gamesManualOverrideAt) return { scoreA: '0', scoreB: '0' }
  const fromFeed = liveCourtPointScores(feed, trackingLive || Boolean(feed?.live))
  return fromFeed ?? { scoreA: '0', scoreB: '0' }
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
    if (point.winnerGestureId === MANUAL_POINTS_GESTURE_ID) continue
    const { gamesA, gamesB } = point.scoreAfter
    if (gamesA > prevA) {
      gameNumber += 1
      results.push({
        gameNumber,
        gamesA,
        gamesB,
        winner: 'a',
        lastPointLine:
          point.winnerGestureId === MANUAL_GAMES_GESTURE_ID
            ? undefined
            : point.scoreBefore
              ? formatGameScore(point.scoreBefore)
              : formatGameScore(point.scoreAfter),
      })
    } else if (gamesB > prevB) {
      gameNumber += 1
      results.push({
        gameNumber,
        gamesA,
        gamesB,
        winner: 'b',
        lastPointLine:
          point.winnerGestureId === MANUAL_GAMES_GESTURE_ID
            ? undefined
            : point.scoreBefore
              ? formatGameScore(point.scoreBefore)
              : formatGameScore(point.scoreAfter),
      })
    }
    prevA = gamesA
    prevB = gamesB
  }
  return results
}
