/** FIP regulation padel court — interior playing area (meters). */
import type { NormalizedPoint } from './gestureCapture'

/** Interior playing area — FIP Rule 1. */
export const PADEL_COURT_WIDTH_M = 10
export const PADEL_COURT_LENGTH_M = 20
/** All line markings are 5 cm wide (FIP). */
export const PADEL_LINE_WIDTH_M = 0.05
/** Net band — drawn slightly thicker than court lines for visibility. */
export const PADEL_NET_LINE_WIDTH_M = 0.085
/** Service line parallel to net, 6.95 m from net on each side. */
export const PADEL_SERVICE_LINE_FROM_NET_M = 6.95
/** Central service line extends 20 cm past the service line into the back court. */
export const PADEL_CENTRAL_LINE_EXTENSION_M = 0.2
/** Net at mid-court — 10 m from each baseline. */
export const PADEL_NET_FROM_BASELINE_M = PADEL_COURT_LENGTH_M / 2
/** Back-court depth behind the service line (3.05 m). */
export const PADEL_BACK_COURT_DEPTH_M =
  PADEL_NET_FROM_BASELINE_M - PADEL_SERVICE_LINE_FROM_NET_M

/** Portrait court on screen: width × height (10 m wide, 20 m long). */
export const PADEL_COURT_ASPECT_RATIO = `${PADEL_COURT_WIDTH_M} / ${PADEL_COURT_LENGTH_M}` as const

/** Line thickness as a fraction of court height / width (for CSS placement). */
export const PADEL_LINE_WIDTH_COURT_Y = PADEL_LINE_WIDTH_M / PADEL_COURT_LENGTH_M
export const PADEL_NET_LINE_WIDTH_COURT_Y = PADEL_NET_LINE_WIDTH_M / PADEL_COURT_LENGTH_M
export const PADEL_LINE_WIDTH_COURT_X = PADEL_LINE_WIDTH_M / PADEL_COURT_WIDTH_M

/** Along court length: top baseline = 0, bottom baseline = 1. */
export const PADEL_NET_Y = 0.5

/** Service line on each side, 6.95 m from the net (3.05 m from back wall). */
export const PADEL_SERVICE_LINE_TOP_Y =
  PADEL_BACK_COURT_DEPTH_M / PADEL_COURT_LENGTH_M

export const PADEL_SERVICE_LINE_BOTTOM_Y =
  (PADEL_COURT_LENGTH_M - PADEL_BACK_COURT_DEPTH_M) / PADEL_COURT_LENGTH_M

/** Central service line runs net → service line + 20 cm into back court. */
export const PADEL_CENTRAL_LINE_TOP_END_Y =
  PADEL_SERVICE_LINE_TOP_Y - PADEL_CENTRAL_LINE_EXTENSION_M / PADEL_COURT_LENGTH_M

export const PADEL_CENTRAL_LINE_BOTTOM_END_Y =
  PADEL_SERVICE_LINE_BOTTOM_Y + PADEL_CENTRAL_LINE_EXTENSION_M / PADEL_COURT_LENGTH_M

export const PADEL_CENTRAL_SEGMENT_HEIGHT_TOP = PADEL_NET_Y - PADEL_CENTRAL_LINE_TOP_END_Y
export const PADEL_CENTRAL_SEGMENT_HEIGHT_BOTTOM =
  PADEL_CENTRAL_LINE_BOTTOM_END_Y - PADEL_NET_Y

/** Center line divides width at 5 m (mid-court). */
export const PADEL_CENTER_LINE_X = 0.5

/** FIP enclosure heights (metres). */
export const PADEL_ENCLOSURE_HEIGHT_M = 4
export const PADEL_END_WALL_GLASS_HEIGHT_M = 3
export const PADEL_END_WALL_MESH_HEIGHT_M = 1

/**
 * Variant 2 Crystal (FIP) — plan segments along the 10 m end walls.
 * Full back wall: 3 m glass + 1 m mesh cap (all 10 m wide).
 */
export const PADEL_END_GLASS_WIDTH_M = PADEL_COURT_WIDTH_M

/** Side glass 4 m from each baseline; no mesh cap above side glass. */
export const PADEL_SIDE_GLASS_RUN_M = 4
export const PADEL_SIDE_MESH_CENTER_M =
  PADEL_COURT_LENGTH_M - 2 * PADEL_SIDE_GLASS_RUN_M

export const PADEL_END_GLASS_FR = PADEL_END_GLASS_WIDTH_M / PADEL_COURT_WIDTH_M
export const PADEL_SIDE_GLASS_FR = PADEL_SIDE_GLASS_RUN_M / PADEL_COURT_LENGTH_M
export const PADEL_SIDE_MESH_CENTER_FR = PADEL_SIDE_MESH_CENTER_M / PADEL_COURT_LENGTH_M

/** FIP tempered glass panels are ~2 m wide (1995 mm). */
export const PADEL_GLASS_PANEL_WIDTH_M = 2
/** 10 m end wall = 5 panels; each 4 m side-glass run = 2 panels. */
export const PADEL_END_WALL_PANEL_COUNT = Math.round(
  PADEL_END_GLASS_WIDTH_M / PADEL_GLASS_PANEL_WIDTH_M,
)
export const PADEL_SIDE_GLASS_PANEL_COUNT = Math.round(
  PADEL_SIDE_GLASS_RUN_M / PADEL_GLASS_PANEL_WIDTH_M,
)

/** Outward margin bands as a fraction of court width/height on screen. */
export const PADEL_ENCLOSURE_GLASS_OUTSET_FR =
  PADEL_END_WALL_GLASS_HEIGHT_M / PADEL_ENCLOSURE_HEIGHT_M
export const PADEL_ENCLOSURE_CAGE_OUTSET_FR =
  PADEL_END_WALL_MESH_HEIGHT_M / PADEL_ENCLOSURE_HEIGHT_M
/** Total outward depth (glass + cage) relative to court span. */
export const PADEL_ENCLOSURE_TOTAL_OUTSET_FR = 0.085

const enclosureGlassAlongLengthFr =
  PADEL_ENCLOSURE_GLASS_OUTSET_FR * PADEL_ENCLOSURE_TOTAL_OUTSET_FR
const enclosureCageAlongLengthFr =
  PADEL_ENCLOSURE_CAGE_OUTSET_FR * PADEL_ENCLOSURE_TOTAL_OUTSET_FR
const enclosureAspectAlongWidth =
  PADEL_COURT_LENGTH_M / PADEL_COURT_WIDTH_M

/** Outward glass depth — % of court height (end walls) or width (side walls). */
export const PADEL_ENCLOSURE_GLASS_DEPTH_ALONG_LENGTH_FR = enclosureGlassAlongLengthFr
export const PADEL_ENCLOSURE_GLASS_DEPTH_ALONG_WIDTH_FR =
  enclosureGlassAlongLengthFr * enclosureAspectAlongWidth
export const PADEL_ENCLOSURE_CAGE_DEPTH_ALONG_LENGTH_FR = enclosureCageAlongLengthFr
export const PADEL_ENCLOSURE_CAGE_DEPTH_ALONG_WIDTH_FR =
  enclosureCageAlongLengthFr * enclosureAspectAlongWidth
export const PADEL_ENCLOSURE_FULL_DEPTH_ALONG_LENGTH_FR =
  enclosureGlassAlongLengthFr + enclosureCageAlongLengthFr
export const PADEL_ENCLOSURE_FULL_DEPTH_ALONG_WIDTH_FR =
  PADEL_ENCLOSURE_FULL_DEPTH_ALONG_LENGTH_FR * enclosureAspectAlongWidth

export function pct(fraction: number): string {
  return `${(fraction * 100).toFixed(3)}%`
}

/** Glass margin segments — matches PadelCourtEnclosure layout. */
export type GlassBandId =
  | 'top'
  | 'bottom'
  | 'left-top'
  | 'left-bottom'
  | 'right-top'
  | 'right-bottom'

/** Side cage mesh only (not end-wall mesh). */
export type SideMeshZoneId = 'left-mesh' | 'right-mesh'

export type EnclosureZoneId = GlassBandId | SideMeshZoneId

const ENCLOSURE_ZONE_ORDER: EnclosureZoneId[] = [
  'top',
  'bottom',
  'left-top',
  'left-bottom',
  'right-top',
  'right-bottom',
  'left-mesh',
  'right-mesh',
]

/** Expand hit area — same idea as SERVICE_BOX_INSET on serve receive boxes. */
export const ENCLOSURE_HIT_EXPAND = 0.018

function isCourtNormInPlayable(point: NormalizedPoint): boolean {
  return point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1
}

/** Court-normal bounds for each glass / side-mesh band (FIP Variant 2 Crystal). */
export function enclosureZoneBounds(zone: EnclosureZoneId): {
  xMin: number
  xMax: number
  yMin: number
  yMax: number
} {
  const gW = PADEL_ENCLOSURE_GLASS_DEPTH_ALONG_WIDTH_FR
  const gL = PADEL_ENCLOSURE_GLASS_DEPTH_ALONG_LENGTH_FR
  const sideGlass = PADEL_SIDE_GLASS_FR
  const sideMesh = PADEL_SIDE_MESH_CENTER_FR

  switch (zone) {
    case 'top':
      return { xMin: -gW, xMax: 1 + gW, yMin: -gL, yMax: 0 }
    case 'bottom':
      return { xMin: -gW, xMax: 1 + gW, yMin: 1, yMax: 1 + gL }
    case 'left-top':
      return { xMin: -gW, xMax: 0, yMin: 0, yMax: sideGlass }
    case 'left-bottom':
      return { xMin: -gW, xMax: 0, yMin: sideGlass + sideMesh, yMax: 1 }
    case 'right-top':
      return { xMin: 1, xMax: 1 + gW, yMin: 0, yMax: sideGlass }
    case 'right-bottom':
      return { xMin: 1, xMax: 1 + gW, yMin: sideGlass + sideMesh, yMax: 1 }
    case 'left-mesh':
      return { xMin: -gW, xMax: 0, yMin: sideGlass, yMax: sideGlass + sideMesh }
    case 'right-mesh':
      return { xMin: 1, xMax: 1 + gW, yMin: sideGlass, yMax: sideGlass + sideMesh }
  }
}

/** Court-normal point inside a glass or side-mesh band. */
export function pointInEnclosureZone(
  court: NormalizedPoint,
  zone: EnclosureZoneId,
  expand = ENCLOSURE_HIT_EXPAND,
): boolean {
  const b = enclosureZoneBounds(zone)
  return (
    court.x >= b.xMin - expand &&
    court.x <= b.xMax + expand &&
    court.y >= b.yMin - expand &&
    court.y <= b.yMax + expand
  )
}

/** Live hit test — court-normal fallback when pad-space misses. */
export function enclosureZoneAtCourtNorm(court: NormalizedPoint): EnclosureZoneId | null {
  if (isCourtNormInPlayable(court)) return null
  for (const zone of ENCLOSURE_ZONE_ORDER) {
    if (pointInEnclosureZone(court, zone)) return zone
  }
  return null
}

/**
 * Pad-normal hit test — matches PadelCourtEnclosure layout + slop into blue margin.
 * Court-normal alone rejects touches in the pad margin (extrapolated court y > 1.085).
 */
export function enclosureZoneAtPadNorm(
  pad: NormalizedPoint,
  inset: CourtInsetBounds,
): EnclosureZoneId | null {
  const L = inset.left
  const T = inset.top
  const R = L + inset.width
  const B = T + inset.height
  const gL = PADEL_ENCLOSURE_GLASS_DEPTH_ALONG_LENGTH_FR * inset.height
  const gW = PADEL_ENCLOSURE_GLASS_DEPTH_ALONG_WIDTH_FR * inset.width
  const sideGlassPad = PADEL_SIDE_GLASS_FR * inset.height
  const sideMeshPad = PADEL_SIDE_MESH_CENTER_FR * inset.height
  const slop = Math.max(0.028, inset.height * 0.045)

  if (pad.x >= L - gW - slop && pad.x <= R + gW + slop) {
    if (pad.y >= B - slop && pad.y <= B + gL + slop * 1.5) return 'bottom'
    if (pad.y >= T - gL - slop * 1.5 && pad.y <= T + slop) return 'top'
  }

  if (pad.x >= L - gW - slop * 1.5 && pad.x < L + slop) {
    if (pad.y >= T - slop && pad.y <= T + sideGlassPad + slop) return 'left-top'
    if (pad.y >= T + sideGlassPad + sideMeshPad - slop && pad.y <= B + slop) {
      return 'left-bottom'
    }
    if (
      pad.y >= T + sideGlassPad - slop &&
      pad.y <= T + sideGlassPad + sideMeshPad + slop
    ) {
      return 'left-mesh'
    }
  }

  if (pad.x > R - slop && pad.x <= R + gW + slop * 1.5) {
    if (pad.y >= T - slop && pad.y <= T + sideGlassPad + slop) return 'right-top'
    if (pad.y >= T + sideGlassPad + sideMeshPad - slop && pad.y <= B + slop) {
      return 'right-bottom'
    }
    if (
      pad.y >= T + sideGlassPad - slop &&
      pad.y <= T + sideGlassPad + sideMeshPad + slop
    ) {
      return 'right-mesh'
    }
  }

  return null
}

export function enclosureZoneAtPad(
  pad: NormalizedPoint,
  inset: CourtInsetBounds,
): EnclosureZoneId | null {
  const padHit = enclosureZoneAtPadNorm(pad, inset)
  if (padHit) return padHit
  return enclosureZoneAtCourtNorm(padNormToCourtNorm(pad, inset))
}

export function isMeshEnclosureZone(
  zone: EnclosureZoneId | null,
): zone is SideMeshZoneId {
  return zone === 'left-mesh' || zone === 'right-mesh'
}

export function isGlassEnclosureZone(
  zone: EnclosureZoneId | null,
): zone is GlassBandId {
  return zone != null && !isMeshEnclosureZone(zone)
}

export function enclosureZoneKind(
  zone: EnclosureZoneId | null,
): 'glass' | 'mesh' | null {
  if (!zone) return null
  return isMeshEnclosureZone(zone) ? 'mesh' : 'glass'
}

export function glassBandAtCourtNorm(point: NormalizedPoint): GlassBandId | null {
  const zone = enclosureZoneAtCourtNorm(point)
  return isGlassEnclosureZone(zone) ? zone : null
}

export function glassBandAtPadNorm(
  pad: NormalizedPoint,
  inset: CourtInsetBounds,
): GlassBandId | null {
  const zone = enclosureZoneAtPad(pad, inset)
  return isGlassEnclosureZone(zone) ? zone : null
}

export function isCourtNormInGlassBand(point: NormalizedPoint): boolean {
  return glassBandAtCourtNorm(point) != null
}

export function clampPadToGlassZone(
  pad: NormalizedPoint,
  inset: CourtInsetBounds,
): NormalizedPoint {
  const zone = enclosureZoneAtPad(pad, inset)
  if (!isGlassEnclosureZone(zone)) return pad
  return clampPadToZoneBounds(pad, inset, zone)
}

/** Clamp onto whichever enclosure wall (glass or mesh) the point falls in. */
export function clampPadToEnclosureZone(
  pad: NormalizedPoint,
  inset: CourtInsetBounds,
): NormalizedPoint {
  const zone = enclosureZoneAtPad(pad, inset)
  if (!zone) return pad
  return clampPadToZoneBounds(pad, inset, zone)
}

function clampPadToZoneBounds(
  pad: NormalizedPoint,
  inset: CourtInsetBounds,
  zone: EnclosureZoneId,
): NormalizedPoint {
  const court = padNormToCourtNorm(pad, inset)
  const b = enclosureZoneBounds(zone)
  const edge = 0.006
  return courtNormToPadNorm(
    {
      x: Math.max(b.xMin + edge, Math.min(b.xMax - edge, court.x)),
      y: Math.max(b.yMin + edge, Math.min(b.yMax - edge, court.y)),
    },
    inset,
  )
}

export const COURT_SURFACE_SELECTOR = '[data-court-surface]'
export const SERVICE_LINE_TOP_SELECTOR = '[data-service-line="top"]'
export const SERVICE_LINE_BOTTOM_SELECTOR = '[data-service-line="bottom"]'

/** Court playable area as fractions of the pad element (matches COURT_INSET markings). */
export type CourtInsetBounds = {
  left: number
  top: number
  width: number
  height: number
}

export function measureCourtInset(pad: HTMLElement): CourtInsetBounds | null {
  const court = pad.querySelector(COURT_SURFACE_SELECTOR) as HTMLElement | null
  if (!court) return null
  const padRect = pad.getBoundingClientRect()
  const courtRect = court.getBoundingClientRect()
  if (padRect.width <= 0 || padRect.height <= 0) return null
  return {
    left: (courtRect.left - padRect.left) / padRect.width,
    top: (courtRect.top - padRect.top) / padRect.height,
    width: courtRect.width / padRect.width,
    height: courtRect.height / padRect.height,
  }
}

export function courtNormToPadNorm(
  point: NormalizedPoint,
  inset: CourtInsetBounds,
): NormalizedPoint {
  return {
    x: inset.left + point.x * inset.width,
    y: inset.top + point.y * inset.height,
  }
}

export function padNormToCourtNorm(
  point: NormalizedPoint,
  inset: CourtInsetBounds,
): NormalizedPoint {
  return {
    x: (point.x - inset.left) / inset.width,
    y: (point.y - inset.top) / inset.height,
  }
}

/** Back court vs volley band (inner 30% of each side, closest to net). */
export type CourtShotZone = 'back' | 'inner'

/** Share of each half-court depth counted as volley zone (nearest the net). */
export const PADEL_INNER_ZONE_FRACTION = 0.4

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
