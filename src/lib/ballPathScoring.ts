import { quadrantFromPoint, type NormalizedPoint, type Quadrant } from './gestureCapture'
import { teamHalfFromQuadrant, type TeamHalf } from './courtHalfCapture'
import {
  PADEL_ENCLOSURE_FULL_DEPTH_ALONG_LENGTH_FR,
  PADEL_ENCLOSURE_FULL_DEPTH_ALONG_WIDTH_FR,
  PADEL_NET_Y,
  clampPadToGlassZone,
  enclosureZoneAtPad,
  isGlassEnclosureZone,
  isMeshEnclosureZone,
  padNormToCourtNorm,
  type CourtInsetBounds,
  type CourtLayout,
} from './padelCourtLayout'

export { clampPadToGlassZone, clampPadToEnclosureZone } from './padelCourtLayout'
import { quadrantTeam } from './gestureScoring'
import type { MatchTeam } from './types'

export const NET_HOVER_HOLD_MS = 1000
/** Court-normal distance from net line that counts as “at the net”. */
export const NET_PROXIMITY_COURT = 0.042
/** Own-half end near net without crossing — net fault. */
export const NET_SHORT_APPROACH_COURT = 0.08

export type BallPathOutcome = 'score' | 'out' | 'net' | 'glass'

/** Pad distance — second stroke must start near the glass anchor. */
export const GLASS_FINISH_START_PAD_TOL = 0.055

export type BallPathResult = {
  outcome: BallPathOutcome
  hitterQuadrant: Quadrant
  endQuadrant: Quadrant
  winnerTeam: MatchTeam
  foulerQuadrant: Quadrant
  report: string
}

function courtHalf(y: number): TeamHalf {
  return y < PADEL_NET_Y ? 'top' : 'bottom'
}

/** Playable court interior (0–1). End beyond this = out. */
export function isCourtNormInBounds(point: NormalizedPoint): boolean {
  const tol = 0.006
  return (
    point.x >= -tol &&
    point.x <= 1 + tol &&
    point.y >= -tol &&
    point.y <= 1 + tol
  )
}

export function isCourtNormOut(point: NormalizedPoint): boolean {
  return !isCourtNormInBounds(point)
}

function isCourtNormInPlayable(point: NormalizedPoint): boolean {
  return point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1
}

export function isCourtNormBeyondEnclosure(point: NormalizedPoint): boolean {
  return (
    point.x < -PADEL_ENCLOSURE_FULL_DEPTH_ALONG_WIDTH_FR ||
    point.x > 1 + PADEL_ENCLOSURE_FULL_DEPTH_ALONG_WIDTH_FR ||
    point.y < -PADEL_ENCLOSURE_FULL_DEPTH_ALONG_LENGTH_FR ||
    point.y > 1 + PADEL_ENCLOSURE_FULL_DEPTH_ALONG_LENGTH_FR
  )
}

/** Court-normal glass hit test — same pattern as pointInServiceBox. */
export function isPadInGlass(
  pad: NormalizedPoint,
  inset: CourtInsetBounds,
  layout: CourtLayout = 'portrait',
): boolean {
  return isGlassEnclosureZone(enclosureZoneAtPad(pad, inset, layout))
}

/** Snap live stroke end onto the glass band while the finger is still down. */
export function snapPadEndToGlassIfNeeded(
  pad: NormalizedPoint,
  inset: CourtInsetBounds,
  layout: CourtLayout = 'portrait',
): { pad: NormalizedPoint; onGlass: boolean } {
  const zone = enclosureZoneAtPad(pad, inset, layout)
  const onGlass = isGlassEnclosureZone(zone)
  const snapped = onGlass ? clampPadToGlassZone(pad, inset, layout) : pad
  return { pad: snapped, onGlass }
}

export function courtNormDistanceToNet(point: NormalizedPoint): number {
  return Math.abs(point.y - PADEL_NET_Y)
}

export function isNearNetCourt(point: NormalizedPoint): boolean {
  return courtNormDistanceToNet(point) <= NET_PROXIMITY_COURT
}

export function resolveBallPath(
  startPad: NormalizedPoint,
  endPad: NormalizedPoint,
  inset: CourtInsetBounds,
  netHoverHeld: boolean,
  layout: CourtLayout = 'portrait',
): BallPathResult | null {
  const startCourt = padNormToCourtNorm(startPad, inset, layout)
  const endCourt = padNormToCourtNorm(endPad, inset, layout)
  const hitterQuadrant = quadrantFromPoint(startCourt)
  const endQuadrant = quadrantFromPoint(endCourt)
  const hitterHalf = teamHalfFromQuadrant(hitterQuadrant)
  const endHalf = courtHalf(endCourt.y)
  const hitterTeam = quadrantTeam(hitterQuadrant)
  const otherTeam: MatchTeam = hitterTeam === 'a' ? 'b' : 'a'

  if (netHoverHeld) {
    return {
      outcome: 'net',
      hitterQuadrant,
      endQuadrant,
      winnerTeam: otherTeam,
      foulerQuadrant: hitterQuadrant,
      report: 'Net — foul',
    }
  }

  const endZone = enclosureZoneAtPad(endPad, inset, layout)

  if (isGlassEnclosureZone(endZone)) {
    return {
      outcome: 'glass',
      hitterQuadrant,
      endQuadrant,
      winnerTeam: hitterTeam,
      foulerQuadrant: hitterQuadrant,
      report: 'Off the glass',
    }
  }

  if (isMeshEnclosureZone(endZone) || isCourtNormBeyondEnclosure(endCourt)) {
    return {
      outcome: 'out',
      hitterQuadrant,
      endQuadrant,
      winnerTeam: otherTeam,
      foulerQuadrant: hitterQuadrant,
      report: 'Out — foul',
    }
  }

  if (!isCourtNormInPlayable(endCourt)) {
    return {
      outcome: 'out',
      hitterQuadrant,
      endQuadrant,
      winnerTeam: otherTeam,
      foulerQuadrant: hitterQuadrant,
      report: 'Out — foul',
    }
  }

  if (endHalf !== hitterHalf) {
    return {
      outcome: 'score',
      hitterQuadrant,
      endQuadrant,
      winnerTeam: hitterTeam,
      foulerQuadrant: endQuadrant,
      report: 'Ball in — point',
    }
  }

  // Same half — release in the net band (matches live red Net zone) = net foul.
  if (courtNormDistanceToNet(endCourt) <= NET_SHORT_APPROACH_COURT) {
    return {
      outcome: 'net',
      hitterQuadrant,
      endQuadrant,
      winnerTeam: otherTeam,
      foulerQuadrant: hitterQuadrant,
      report: 'Net — foul',
    }
  }

  return null
}

/** Second stroke after glass — credit outcome to the original attacker, not the wall anchor. */
export function resolveGlassReboundPath(
  attackerQuadrant: Quadrant,
  glassPad: NormalizedPoint,
  endPad: NormalizedPoint,
  inset: CourtInsetBounds,
  netHoverHeld: boolean,
  layout: CourtLayout = 'portrait',
): BallPathResult | null {
  const result = resolveBallPath(glassPad, endPad, inset, netHoverHeld, layout)
  if (!result || result.outcome === 'glass') return result

  const hitterTeam = quadrantTeam(attackerQuadrant)
  const otherTeam: MatchTeam = hitterTeam === 'a' ? 'b' : 'a'

  if (result.outcome === 'out' || result.outcome === 'net') {
    return {
      ...result,
      hitterQuadrant: attackerQuadrant,
      foulerQuadrant: attackerQuadrant,
      winnerTeam: otherTeam,
    }
  }

  if (result.outcome === 'score') {
    return {
      ...result,
      hitterQuadrant: attackerQuadrant,
      winnerTeam: hitterTeam,
    }
  }

  return result
}
