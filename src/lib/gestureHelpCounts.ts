import type { GestureAnalysis } from './gestureAnalysis'
import {
  detectHorizShotShapeFromAnchors,
  isLobDiagonalShape,
  isVolleyLShape,
  lobFinishDown,
  lobFinishUp,
  SMASH_DIRECTION_MIN,
  strokeFinishDown,
  strokeFinishUp,
  VOLLEY_DIRECTION_MIN,
} from './gestureAnalysis'
import type { GestureDebugEntry } from './gestureDebugLog'
import { courtShotZoneFromPoint } from './padelCourtLayout'
import { GESTURE_SHOT_TYPE_ORDER, type GestureShotTypeId } from './gestureShotTypes'

export type ShotCategoryId =
  | 'smash-score'
  | 'smash-foul'
  | 'backhand-lr-score'
  | 'backhand-lr-foul'
  | 'forehand-score'
  | 'forehand-foul'
  | 'volley-score'
  | 'volley-foul'
  | 'lob-score'
  | 'lob-foul'
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
  'lob-score',
  'lob-foul',
  'unregistered',
]

function finishUp(entry: GestureAnalysis): boolean {
  if (entry.shape === 'LOB') {
    if (entry.lobVerdict === 'WIN') return true
    return lobFinishUp(entry.anchors ?? entry.pathSample)
  }
  if (
    entry.strokeCorner &&
    entry.finishPoint &&
    entry.finishPoint !== entry.strokeCorner
  ) {
    if (strokeFinishUp(entry.strokeCorner, entry.finishPoint)) return true
  }
  if (entry.end.y - entry.start.y <= -SMASH_DIRECTION_MIN) return true

  const points = entry.pathSample
  if (points.length >= 2) {
    const prev = points[points.length - 2]!
    const end = points[points.length - 1]!
    if (end.y - prev.y <= -VOLLEY_DIRECTION_MIN) return true
  }
  if (points.length >= 1) {
    const peak = Math.min(...points.map((p) => p.y))
    if (entry.start.y - peak >= VOLLEY_DIRECTION_MIN) return true
  }
  return false
}

function finishDown(entry: GestureAnalysis): boolean {
  if (entry.shape === 'LOB') {
    if (entry.lobVerdict === 'FOUL') return true
    return lobFinishDown(entry.anchors ?? entry.pathSample)
  }
  if (
    entry.strokeCorner &&
    entry.finishPoint &&
    entry.finishPoint !== entry.strokeCorner
  ) {
    if (strokeFinishDown(entry.strokeCorner, entry.finishPoint)) return true
  }
  if (entry.end.y - entry.start.y >= SMASH_DIRECTION_MIN) return true

  const points = entry.pathSample
  if (points.length >= 2) {
    const prev = points[points.length - 2]!
    const end = points[points.length - 1]!
    if (end.y - prev.y >= VOLLEY_DIRECTION_MIN) return true
  }
  if (points.length >= 1) {
    const trough = Math.max(...points.map((p) => p.y))
    if (trough - entry.start.y >= VOLLEY_DIRECTION_MIN) return true
  }
  return false
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
    return 'volley-foul'
  }
  if (up) return groundScore
  if (down) return groundFoul
  return 'unregistered'
}

function classifyVerticalStroke(entry: GestureAnalysis): ShotCategoryId {
  if (finishUp(entry)) return 'smash-score'
  if (finishDown(entry)) return 'smash-foul'
  return 'unregistered'
}

function classifyFallbackShape(entry: GestureAnalysis): ShotCategoryId {
  const { xSpread, ySpread } = entry
  const anchorPath = entry.anchors ?? entry.pathSample
  if (isLobDiagonalShape(anchorPath)) {
    if (finishUp(entry)) return 'lob-score'
    if (finishDown(entry)) return 'lob-foul'
  }
  if (entry.strokeCorner && entry.finishPoint && entry.finishPoint !== entry.strokeCorner) {
    const legDx = Math.abs(entry.strokeCorner.x - entry.start.x)
    const legDy = Math.abs(entry.strokeCorner.y - entry.start.y)
    if (legDx >= 0.04 && legDx > legDy * 1.15) {
      const horizShape = detectHorizShotShapeFromAnchors(
        entry.anchors ?? entry.pathSample,
        entry.startQuadrant,
      )
      if (horizShape) {
        return classifyHorizStroke(
          { ...entry, shape: horizShape },
          horizShape === 'BACKHAND' ? 'backhand-lr-score' : 'forehand-score',
          horizShape === 'BACKHAND' ? 'backhand-lr-foul' : 'forehand-foul',
        )
      }
    }
  }
  if (ySpread > xSpread * 1.4 && ySpread >= 0.06) {
    return classifyVerticalStroke(entry)
  }
  if (xSpread > ySpread * 1.15 && xSpread >= 0.06) {
    return classifyHorizStroke(entry, 'forehand-score', 'forehand-foul')
  }
  if (isVolleyLShape(entry.pathSample)) {
    if (finishUp(entry)) return 'volley-score'
    if (finishDown(entry)) return 'volley-foul'
  }
  return 'unregistered'
}

export function classifyGestureShot(entry: GestureAnalysis): ShotCategoryId {
  if (entry.shape === 'SMASH' || entry.shape === 'LINE_V') {
    if (entry.smashVerdict === 'WIN') return 'smash-score'
    if (entry.smashVerdict === 'FOUL') return 'smash-foul'
    return classifyVerticalStroke(entry)
  }

  if (entry.shape === 'BACKHAND') {
    return classifyHorizStroke(entry, 'backhand-lr-score', 'backhand-lr-foul')
  }

  if (entry.shape === 'FOREHAND') {
    return classifyHorizStroke(entry, 'forehand-score', 'forehand-foul')
  }

  if (entry.shape === 'VOLLEY') {
    if (shotZone(entry) === 'inner' && isNetSideHorizontal(entry)) {
      return classifyNetSideHorizontal(entry)
    }
    if (entry.volleyVerdict === 'SCORE' || finishUp(entry)) return 'volley-score'
    if (entry.volleyVerdict === 'FOUL' || finishDown(entry)) return 'volley-foul'
    return 'unregistered'
  }

  if (entry.shape === 'LOB') {
    if (entry.lobVerdict === 'WIN' || finishUp(entry)) return 'lob-score'
    if (entry.lobVerdict === 'FOUL' || finishDown(entry)) return 'lob-foul'
    return 'unregistered'
  }

  if (entry.shape === 'CURVE') {
    return classifyFallbackShape(entry)
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

export type ShotGuideTabCounts = Record<GestureShotTypeId, { win: number; foul: number }>

function emptyShotGuideTabCounts(): ShotGuideTabCounts {
  return Object.fromEntries(
    GESTURE_SHOT_TYPE_ORDER.map((id) => [id, { win: 0, foul: 0 }]),
  ) as ShotGuideTabCounts
}

function addGuideOutcome(
  counts: ShotGuideTabCounts,
  tab: GestureShotTypeId,
  category: ShotCategoryId,
) {
  if (category.endsWith('-score')) counts[tab].win += 1
  else if (category.endsWith('-foul')) counts[tab].foul += 1
}

export function countShotGuideTabs(
  entries: GestureDebugEntry[],
  filter?: { competitionId?: string; gameNumber?: string },
): ShotGuideTabCounts {
  const counts = emptyShotGuideTabCounts()

  for (const entry of entries) {
    if (filter?.competitionId && entry.competitionId !== filter.competitionId) continue
    if (filter?.gameNumber && entry.gameNumber !== filter.gameNumber) continue

    const category = classifyGestureShot(entry)
    if (category === 'unregistered') continue

    if (entry.shape === 'SMASH') {
      addGuideOutcome(counts, 'overhead', category)
      continue
    }

    if (entry.shape === 'BACKHAND') {
      addGuideOutcome(counts, 'backhand', category)
      continue
    }

    if (entry.shape === 'FOREHAND') {
      addGuideOutcome(counts, 'forehand', category)
      continue
    }

    if (entry.shape === 'LOB') {
      addGuideOutcome(counts, 'lob', category)
    }
  }

  return counts
}
