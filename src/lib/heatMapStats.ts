import type { GameLogGesture, GameLogPoint } from './gameLogSerialize'
import type { Quadrant } from './gestureCapture'
import type { PlayerStatsSnapshot } from './matchSessionLog'
import type { ShotTypeBreakdown, ShotTypeGroup } from './playerGameStats'
import type { TranslateFn } from '../i18n'

export type ShotKind = 'smash' | 'forehand' | 'backhand' | 'volley' | 'lob'
export type ShotOutcome = 'score' | 'foul' | 'unregistered'

export const SHOT_KINDS: ShotKind[] = ['smash', 'forehand', 'backhand', 'volley', 'lob']

export const SHOT_KIND_LABEL: Record<ShotKind, string> = {
  smash: 'Smash',
  forehand: 'Forehand',
  backhand: 'Backhand',
  volley: 'Volley',
  lob: 'Lob',
}

export const SHOT_KIND_COLOR: Record<ShotKind, string> = {
  smash: '#f87171',
  forehand: '#34d399',
  backhand: '#60a5fa',
  volley: '#fbbf24',
  lob: '#c084fc',
}

export type HeatMapDot = {
  x: number
  y: number
  kind: ShotKind | null
  outcome: ShotOutcome
}

export type DepthZoneId = 'net' | 'mid' | 'back'

export type DepthZoneStat = {
  id: DepthZoneId
  label: string
  count: number
  pct: number
}

export type ServeStat = { won: number; lost: number; total: number }

export function shotKindFromCategory(category: string): ShotKind | null {
  if (category.startsWith('smash-')) return 'smash'
  if (category.startsWith('forehand-')) return 'forehand'
  if (category.startsWith('backhand-')) return 'backhand'
  if (category.startsWith('volley-')) return 'volley'
  if (category.startsWith('lob-')) return 'lob'
  return null
}

export function shotOutcomeFromCategory(category: string): ShotOutcome {
  if (category.endsWith('-score')) return 'score'
  if (category.endsWith('-foul')) return 'foul'
  return 'unregistered'
}

export function gestureActorQuadrant(g: GameLogGesture): Quadrant {
  return g.actorQuadrant ?? g.startQuadrant
}

/**
 * Full-court normalized landing point (x: 0 left → 1 right, y: 0 top → 1 bottom).
 * Prefers heatMapEnd (half-court depth from net); falls back to the raw end point.
 */
export function gestureLandingPoint(g: GameLogGesture): { x: number; y: number } | null {
  if (g.heatMapEnd) {
    const { x, y, half } = g.heatMapEnd
    const courtY = half === 'top' ? 0.5 - y * 0.5 : 0.5 + y * 0.5
    return { x, y: courtY }
  }
  if (g.end) return { x: g.end.x, y: g.end.y }
  return null
}

export function playerGestures(
  gestures: GameLogGesture[],
  quadrant: Quadrant,
): GameLogGesture[] {
  return gestures.filter((g) => gestureActorQuadrant(g) === quadrant)
}

export function buildHeatMapDots(
  gestures: GameLogGesture[],
  quadrant: Quadrant,
): HeatMapDot[] {
  const dots: HeatMapDot[] = []
  for (const g of playerGestures(gestures, quadrant)) {
    const point = gestureLandingPoint(g)
    if (!point) continue
    dots.push({
      x: point.x,
      y: point.y,
      kind: shotKindFromCategory(g.shotCategory),
      outcome: shotOutcomeFromCategory(g.shotCategory),
    })
  }
  return dots
}

const ZONE_LABEL: Record<DepthZoneId, string> = {
  net: 'Net / Volley',
  mid: 'Mid court',
  back: 'Back court',
}

/** Depth bands by distance from the net (heatMapEnd.y: 0 = net, 1 = baseline). */
export function buildDepthZones(
  gestures: GameLogGesture[],
  quadrant: Quadrant,
): DepthZoneStat[] {
  const counts: Record<DepthZoneId, number> = { net: 0, mid: 0, back: 0 }
  let total = 0
  for (const g of playerGestures(gestures, quadrant)) {
    const depth = g.heatMapEnd?.y
    if (depth == null) continue
    total += 1
    if (depth < 1 / 3) counts.net += 1
    else if (depth < 2 / 3) counts.mid += 1
    else counts.back += 1
  }
  const zones: DepthZoneId[] = ['net', 'mid', 'back']
  return zones.map((id) => ({
    id,
    label: ZONE_LABEL[id],
    count: counts[id],
    pct: total > 0 ? Math.round((counts[id] / total) * 100) : 0,
  }))
}

/** Serve points won/lost for the player from point events flagged as serves. */
export function buildServeStats(
  pointEvents: GameLogPoint[],
  quadrant: Quadrant,
): ServeStat {
  let won = 0
  let lost = 0
  for (const event of pointEvents) {
    if (!event.isServe) continue
    if (event.winnerQuadrant === quadrant) won += 1
    else if (event.loserQuadrant === quadrant) lost += 1
  }
  return { won, lost, total: won + lost }
}

export type MatchGameInfo = {
  /** Number of games played in the match. */
  count: number
  /** Game index (0-based) for each point event. */
  pointGames: number[]
  /** Resolve which game a gesture belongs to. */
  gameOfGesture: (gesture: GameLogGesture) => number
}

/** Split a match into its games using the score progression in the point events. */
export function buildMatchGames(pointEvents: GameLogPoint[]): MatchGameInfo {
  const pointGames: number[] = []
  const gestureGame = new Map<string, number>()
  let prevGames = 0
  let gameNo = 0
  for (const ev of pointEvents) {
    pointGames.push(gameNo)
    if (ev.winnerGestureId) gestureGame.set(ev.winnerGestureId, gameNo)
    if (ev.loserGestureId) gestureGame.set(ev.loserGestureId, gameNo)
    const games = (ev.scoreAfter?.gamesA ?? 0) + (ev.scoreAfter?.gamesB ?? 0)
    if (games > prevGames) {
      gameNo += games - prevGames
      prevGames = games
    }
  }
  const count = pointGames.length ? Math.max(...pointGames) + 1 : 0
  const lastGame = Math.max(0, count - 1)

  const gameOfGesture = (gesture: GameLogGesture): number => {
    const mapped = gestureGame.get(gesture.id)
    if (mapped != null) return mapped
    for (let i = 0; i < pointEvents.length; i++) {
      if (pointEvents[i]!.at >= gesture.at) return pointGames[i]!
    }
    return lastGame
  }

  return { count, pointGames, gameOfGesture }
}

function emptyBreakdown(): ShotTypeBreakdown {
  return {
    smash: { scored: 0, foul: 0 },
    forehand: { scored: 0, foul: 0 },
    backhand: { scored: 0, foul: 0 },
    volley: { scored: 0, foul: 0 },
  }
}

/** Recompute a player's counts from a (possibly game-filtered) gesture set. */
export function computeMatchStats(
  gestures: GameLogGesture[],
  quadrant: Quadrant,
): PlayerStatsSnapshot {
  const byType = emptyBreakdown()
  let scored = 0
  let fouls = 0
  let unregistered = 0
  for (const g of playerGestures(gestures, quadrant)) {
    const outcome = shotOutcomeFromCategory(g.shotCategory)
    if (outcome === 'score') scored += 1
    else if (outcome === 'foul') fouls += 1
    else unregistered += 1
    const kind = shotKindFromCategory(g.shotCategory)
    if (kind && kind !== 'lob') {
      if (outcome === 'score') byType[kind].scored += 1
      else if (outcome === 'foul') byType[kind].foul += 1
    }
  }
  const judged = scored + fouls
  return {
    playerKey: quadrant,
    playerId: null,
    displayName: '',
    quadrant,
    totalShots: scored + fouls + unregistered,
    scored,
    fouls,
    unregistered,
    successRate: judged > 0 ? Math.round((scored / judged) * 100) : 0,
    byType,
  }
}

export type InsightCard = { label: string; value: string; hint?: string }

const SHOT_GROUPS: ShotTypeGroup[] = ['smash', 'forehand', 'backhand', 'volley']

const SHOT_GROUP_KEY: Record<ShotTypeGroup, string> = {
  smash: 'stats.kindSmash',
  forehand: 'stats.kindForehand',
  backhand: 'stats.kindBackhand',
  volley: 'stats.kindVolley',
}

/** Small "did you know" stats mined from the player's full shot array. */
export function buildPlayerInsights(
  gestures: GameLogGesture[],
  quadrant: Quadrant,
  stats: PlayerStatsSnapshot | null,
  t: TranslateFn,
): InsightCard[] {
  const shots = playerGestures(gestures, quadrant)
  const cards: InsightCard[] = []

  const fouls =
    stats?.fouls ??
    shots.filter((g) => shotOutcomeFromCategory(g.shotCategory) === 'foul').length
  cards.push({ label: t('stats.insTimesFouled'), value: String(fouls) })

  if (stats) {
    let favType: ShotTypeGroup | null = null
    let favCount = -1
    for (const group of SHOT_GROUPS) {
      const c = stats.byType[group].scored + stats.byType[group].foul
      if (c > favCount) {
        favCount = c
        favType = group
      }
    }
    cards.push({
      label: t('stats.insFavShot'),
      value: favCount > 0 && favType ? t(SHOT_GROUP_KEY[favType]) : t('stats.none'),
    })

    let bestType: ShotTypeGroup | null = null
    let bestRate = -1
    let bestAtt = 0
    for (const group of SHOT_GROUPS) {
      const judged = stats.byType[group].scored + stats.byType[group].foul
      if (judged < 1) continue
      const rate = stats.byType[group].scored / judged
      if (rate > bestRate || (rate === bestRate && judged > bestAtt)) {
        bestRate = rate
        bestType = group
        bestAtt = judged
      }
    }
    cards.push({
      label: t('stats.insMostReliable'),
      value: bestType ? t(SHOT_GROUP_KEY[bestType]) : t('stats.none'),
      hint: bestType ? t('stats.hintPctIn', { pct: Math.round(bestRate * 100) }) : undefined,
    })
  }

  const xs = shots
    .map(gestureLandingPoint)
    .filter((p): p is { x: number; y: number } => p != null)
    .map((p) => p.x)

  if (xs.length) {
    let left = 0
    let centre = 0
    let right = 0
    for (const x of xs) {
      if (x < 0.38) left += 1
      else if (x > 0.62) right += 1
      else centre += 1
    }
    const top = Math.max(left, centre, right)
    const side =
      top === left ? t('stats.valLeft') : top === right ? t('stats.valRight') : t('stats.valCentre')
    cards.push({
      label: t('stats.insGoToSide'),
      value: side,
      hint: t('stats.hintPctShots', { pct: Math.round((top / xs.length) * 100) }),
    })

    const spread = Math.max(...xs) - Math.min(...xs)
    const level =
      spread > 0.6 ? t('stats.valHigh') : spread > 0.35 ? t('stats.valMedium') : t('stats.valLow')
    cards.push({
      label: t('stats.insUnpredictability'),
      value: level,
      hint: t('stats.hintCourtWidth'),
    })
  }

  const zoned = shots.filter((g) => g.shotZone === 'inner' || g.shotZone === 'back')
  if (zoned.length) {
    const inner = zoned.filter((g) => g.shotZone === 'inner').length
    cards.push({
      label: t('stats.insNetPresence'),
      value: `${Math.round((inner / zoned.length) * 100)}%`,
      hint: t('stats.hintVolleyZone'),
    })
  }

  const durations = shots.map((g) => g.durationMs).filter((d) => d > 0)
  if (durations.length) {
    const avg = durations.reduce((sum, d) => sum + d, 0) / durations.length
    cards.push({
      label: t('stats.insAvgSwing'),
      value: `${(avg / 1000).toFixed(1)}s`,
      hint: t('stats.hintStrokeTempo'),
    })
  }

  return cards
}
