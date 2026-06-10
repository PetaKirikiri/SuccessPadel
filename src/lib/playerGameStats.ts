import type { CourtPlayer } from './americanoSchedule'
import { COURT_QUADRANTS } from './courtPositionSetup'
import type { GestureDebugEntry } from './gestureDebugLog'
import { classifyGestureShot, type ShotCategoryId } from './gestureHelpCounts'
import type { Quadrant } from './gestureCapture'
import type { QuadrantPlayers } from './gesturePadPlayers'
import { firstDisplayName } from './leaderboardEntries'

export type ShotTypeGroup = 'smash' | 'backhand' | 'forehand' | 'volley'

export type ShotTypeBreakdown = Record<ShotTypeGroup, { scored: number; foul: number }>

export type PlayerGameStats = {
  quadrant: Quadrant
  player: CourtPlayer
  displayName: string
  totalShots: number
  scored: number
  fouls: number
  unregistered: number
  successRate: number
  byType: ShotTypeBreakdown
}

export type MatchStatsFilter = {
  competitionId?: string
  gameNumber?: string
  courtId?: string
  matchStartedAt?: string
  matchSessionId?: string
}

const SHOT_TYPE_LABELS: Record<ShotTypeGroup, string> = {
  smash: 'Smash',
  backhand: 'Backhand',
  forehand: 'Forehand',
  volley: 'Volley',
}

export function shotTypeLabel(type: ShotTypeGroup): string {
  return SHOT_TYPE_LABELS[type]
}

function categoryGroup(category: ShotCategoryId): ShotTypeGroup | null {
  if (category.startsWith('smash-')) return 'smash'
  if (category.startsWith('backhand-')) return 'backhand'
  if (category.startsWith('forehand-')) return 'forehand'
  if (category.startsWith('volley-')) return 'volley'
  return null
}

function emptyBreakdown(): ShotTypeBreakdown {
  return {
    smash: { scored: 0, foul: 0 },
    backhand: { scored: 0, foul: 0 },
    forehand: { scored: 0, foul: 0 },
    volley: { scored: 0, foul: 0 },
  }
}

export function filterMatchGestures(
  entries: GestureDebugEntry[],
  filter: MatchStatsFilter,
): GestureDebugEntry[] {
  return entries.filter((entry) => {
    if (filter.competitionId && entry.competitionId !== filter.competitionId) return false
    if (filter.gameNumber && entry.gameNumber !== filter.gameNumber) return false
    if (filter.courtId && entry.courtId !== filter.courtId) return false
    if (filter.matchSessionId && entry.matchSessionId !== filter.matchSessionId) return false
    if (filter.matchStartedAt && entry.at < filter.matchStartedAt) return false
    return true
  })
}

export function buildPlayerGameStats(
  quadrant: Quadrant,
  player: CourtPlayer,
  entries: GestureDebugEntry[],
): PlayerGameStats {
  const byType = emptyBreakdown()
  let scored = 0
  let fouls = 0
  let unregistered = 0

  for (const entry of entries) {
    const shotQuadrant = entry.actorQuadrant ?? entry.startQuadrant
    if (shotQuadrant !== quadrant) continue
    const category = classifyGestureShot(entry)
    if (category.endsWith('-score')) scored += 1
    else if (category.endsWith('-foul')) fouls += 1
    else unregistered += 1

    const group = categoryGroup(category)
    if (!group) continue
    if (category.endsWith('-score')) byType[group].scored += 1
    if (category.endsWith('-foul')) byType[group].foul += 1
  }

  const judged = scored + fouls
  const successRate = judged > 0 ? Math.round((scored / judged) * 100) : 0

  return {
    quadrant,
    player,
    displayName: firstDisplayName(player.name.trim() || 'Player'),
    totalShots: scored + fouls + unregistered,
    scored,
    fouls,
    unregistered,
    successRate,
    byType,
  }
}

export function buildMatchPlayerStatsFromEntries(
  matchEntries: GestureDebugEntry[],
  assignments: QuadrantPlayers,
): PlayerGameStats[] {
  return COURT_QUADRANTS.map((quadrant) => {
    const player = assignments[quadrant] ?? { id: null, name: '', avatarUrl: null }
    return buildPlayerGameStats(quadrant, player, matchEntries)
  }).filter((s) => s.player.name?.trim())
}

export function buildMatchPlayerStats(
  entries: GestureDebugEntry[],
  filter: MatchStatsFilter,
  assignments: QuadrantPlayers,
  sessionEntries?: GestureDebugEntry[] | null,
): PlayerGameStats[] {
  const matchEntries =
    sessionEntries && sessionEntries.length > 0
      ? sessionEntries
      : filterMatchGestures(entries, filter)
  return buildMatchPlayerStatsFromEntries(matchEntries, assignments)
}
