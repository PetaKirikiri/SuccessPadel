import type { GestureAnalysis } from './gestureAnalysis'
import { SMASH_DIRECTION_MIN } from './gestureAnalysis'
import type { GestureDebugEntry } from './gestureDebugLog'
import { courtShotZoneFromPoint } from './padelCourtLayout'

export type ShotCategoryId =
  | 'smash-score'
  | 'smash-foul'
  | 'backhand-lr-score'
  | 'backhand-lr-foul'
  | 'forehand-score'
  | 'forehand-foul'
  | 'volley-score'
  | 'volley-foul'
  | 'unregistered'

export const SHOT_CATEGORY_ORDER: ShotCategoryId[] = [
  'smash-score',
  'smash-foul',
  'backhand-lr-score',
  'backhand-lr-foul',
  'forehand-score',
  'forehand-foul',
  'volley-score',
  'volley-foul',
  'unregistered',
]

function finishUp(entry: GestureAnalysis): boolean {
  return entry.end.y - entry.start.y <= -SMASH_DIRECTION_MIN
}

function finishDown(entry: GestureAnalysis): boolean {
  return entry.end.y - entry.start.y >= SMASH_DIRECTION_MIN
}

function shotZone(entry: GestureAnalysis) {
  return entry.shotZone ?? courtShotZoneFromPoint(entry.start, entry.startQuadrant)
}

function isNetSideHorizontal(entry: GestureAnalysis): boolean {
  return entry.xSpread > entry.ySpread * 1.15 && entry.xSpread >= 0.06
}

function classifyNetSideHorizontal(entry: GestureAnalysis): ShotCategoryId {
  const up = finishUp(entry)
  const down = finishDown(entry)
  if (up) return 'volley-score'
  if (down) return 'volley-foul'
  return 'unregistered'
}

function classifyHorizStroke(
  entry: GestureAnalysis,
  groundScore: ShotCategoryId,
  groundFoul: ShotCategoryId,
): ShotCategoryId {
  const up = finishUp(entry)
  const down = finishDown(entry)
  if (shotZone(entry) === 'inner') {
    if (up) return 'volley-score'
    if (down) return 'volley-foul'
    return 'unregistered'
  }
  if (up) return groundScore
  if (down) return groundFoul
  return 'unregistered'
}

export function classifyGestureShot(entry: GestureAnalysis): ShotCategoryId {
  if (entry.shape === 'SMASH') {
    if (entry.smashVerdict === 'WIN' || finishUp(entry)) return 'smash-score'
    if (entry.smashVerdict === 'FOUL' || finishDown(entry)) return 'smash-foul'
    return 'unregistered'
  }

  if (entry.shape === 'BACKHAND') {
    if (entry.backhandDirection === 'L_TO_R') {
      return classifyHorizStroke(entry, 'backhand-lr-score', 'backhand-lr-foul')
    }
    return 'unregistered'
  }

  if (entry.shape === 'FOREHAND') {
    if (entry.backhandDirection === 'R_TO_L') {
      return classifyHorizStroke(entry, 'forehand-score', 'forehand-foul')
    }
    return 'unregistered'
  }

  if (entry.shape === 'VOLLEY') {
    if (shotZone(entry) === 'inner' && isNetSideHorizontal(entry)) {
      return classifyNetSideHorizontal(entry)
    }
    if (entry.volleyVerdict === 'SCORE' || finishUp(entry)) return 'volley-score'
    if (entry.volleyVerdict === 'FOUL' || finishDown(entry)) return 'volley-foul'
    return 'unregistered'
  }

  return 'unregistered'
}

export function countGestureShots(
  entries: GestureDebugEntry[],
  filter?: { competitionId?: string; gameNumber?: string },
): Record<ShotCategoryId, number> {
  const counts = Object.fromEntries(
    SHOT_CATEGORY_ORDER.map((id) => [id, 0]),
  ) as Record<ShotCategoryId, number>

  for (const entry of entries) {
    if (filter?.competitionId && entry.competitionId !== filter.competitionId) continue
    if (filter?.gameNumber && entry.gameNumber !== filter.gameNumber) continue
    const category = classifyGestureShot(entry)
    counts[category] += 1
  }

  return counts
}
