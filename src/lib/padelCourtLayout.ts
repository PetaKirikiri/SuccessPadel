/** FIP regulation padel court — interior playing area (meters). */
export const PADEL_COURT_WIDTH_M = 10
export const PADEL_COURT_LENGTH_M = 20
/** Portrait court on screen: width × height (10 m wide, 20 m long). */
export const PADEL_COURT_ASPECT_RATIO = `${PADEL_COURT_WIDTH_M} / ${PADEL_COURT_LENGTH_M}` as const
export const PADEL_SERVICE_LINE_FROM_NET_M = 6.95
export const PADEL_CENTRAL_LINE_EXTENSION_M = 0.2
export const PADEL_NET_FROM_BASELINE_M = PADEL_COURT_LENGTH_M / 2

/** Along court length: top baseline = 0, bottom baseline = 1. */
export const PADEL_NET_Y = 0.5

/** Service line on each side, 6.95 m from the net (3.05 m from back wall). */
export const PADEL_SERVICE_LINE_TOP_Y =
  (PADEL_NET_FROM_BASELINE_M - PADEL_SERVICE_LINE_FROM_NET_M) / PADEL_COURT_LENGTH_M

export const PADEL_SERVICE_LINE_BOTTOM_Y =
  (PADEL_NET_FROM_BASELINE_M + PADEL_SERVICE_LINE_FROM_NET_M) / PADEL_COURT_LENGTH_M

/** Central service line runs net → service line + 20 cm into back court. */
export const PADEL_CENTRAL_LINE_TOP_END_Y =
  PADEL_SERVICE_LINE_TOP_Y - PADEL_CENTRAL_LINE_EXTENSION_M / PADEL_COURT_LENGTH_M

export const PADEL_CENTRAL_LINE_BOTTOM_END_Y =
  PADEL_SERVICE_LINE_BOTTOM_Y + PADEL_CENTRAL_LINE_EXTENSION_M / PADEL_COURT_LENGTH_M

export const PADEL_CENTRAL_SEGMENT_HEIGHT_TOP = PADEL_NET_Y - PADEL_CENTRAL_LINE_TOP_END_Y
export const PADEL_CENTRAL_SEGMENT_HEIGHT_BOTTOM =
  PADEL_CENTRAL_LINE_BOTTOM_END_Y - PADEL_NET_Y

export function pct(fraction: number): string {
  return `${(fraction * 100).toFixed(3)}%`
}

/** Back court vs volley band (inner 30% of each side, closest to net). */
export type CourtShotZone = 'back' | 'inner'

/** Share of each half-court depth counted as volley zone (nearest the net). */
export const PADEL_INNER_ZONE_FRACTION = 0.3

const PADEL_INNER_ZONE_DEPTH = PADEL_NET_Y * PADEL_INNER_ZONE_FRACTION

export const PADEL_HALF_INNER_START_TOP_Y = PADEL_NET_Y - PADEL_INNER_ZONE_DEPTH
export const PADEL_HALF_INNER_END_BOTTOM_Y = PADEL_NET_Y + PADEL_INNER_ZONE_DEPTH

export function courtShotZoneFromY(y: number): CourtShotZone {
  if (y < PADEL_NET_Y) {
    return y >= PADEL_HALF_INNER_START_TOP_Y ? 'inner' : 'back'
  }
  return y <= PADEL_HALF_INNER_END_BOTTOM_Y ? 'inner' : 'back'
}

export function courtShotZoneFromPoint(
  point: { x: number; y: number },
  quadrant?: 'TL' | 'TR' | 'BL' | 'BR',
): CourtShotZone {
  if (quadrant) {
    const topSide = quadrant === 'TL' || quadrant === 'TR'
    if (topSide) return point.y >= PADEL_HALF_INNER_START_TOP_Y ? 'inner' : 'back'
    return point.y <= PADEL_HALF_INNER_END_BOTTOM_Y ? 'inner' : 'back'
  }
  return courtShotZoneFromY(point.y)
}

/** Volley vs ground stroke is decided by the first anchor (stroke start). */
export function isVolleyZoneStart(
  start: { x: number; y: number },
  startQuadrant: 'TL' | 'TR' | 'BL' | 'BR',
): boolean {
  return courtShotZoneFromPoint(start, startQuadrant) === 'inner'
}
