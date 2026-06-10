import type { Quadrant } from './gestureCapture'

export const RALLY_SHOT_OPTIONS = ['OH', 'FH', 'BH', 'L'] as const
export type RallyWheelShot = (typeof RALLY_SHOT_OPTIONS)[number]

export type RallyShotPick = {
  shot: RallyWheelShot
  angleDeg: number
}

/** Second-wave options revealed as 4 zones after pulling a coin out. */
export const OVERHEAD_EXTENSIONS = ['vibora', 'bandeja', 'gancho', 'rulo'] as const
export type OverheadExtension = (typeof OVERHEAD_EXTENSIONS)[number]

export const GROUND_SPINS = ['topspin', 'backspin', 'slice'] as const
export type GroundSpin = (typeof GROUND_SPINS)[number]

export const LOB_HEIGHTS = ['high', 'low'] as const
export type LobHeight = (typeof LOB_HEIGHTS)[number]

/** Any second-wave selection (overhead extension, groundstroke spin, lob height). */
export type ShotWaveOption = OverheadExtension | GroundSpin | LobHeight

export const SHOT_WAVE_DISPLAY: Record<ShotWaveOption, string> = {
  vibora: 'Vibora',
  bandeja: 'Bandeja',
  gancho: 'Gancho',
  rulo: 'Rulo',
  topspin: 'Top Spin',
  backspin: 'Back Spin',
  slice: 'Slice',
  high: 'High',
  low: 'Low',
}

export type ShotWaveWedge = {
  value: ShotWaveOption
  /** Label direction in screen coords (0 = right, 90 = down, 270 = up). */
  midDeg: number
  startDeg: number
  endDeg: number
}

/** OH second wave — boundaries at 45/135/225/315. */
const OVERHEAD_WAVE_WEDGES: ShotWaveWedge[] = [
  { value: 'vibora', midDeg: 270, startDeg: 225, endDeg: 315 },
  { value: 'bandeja', midDeg: 0, startDeg: 315, endDeg: 405 },
  { value: 'gancho', midDeg: 90, startDeg: 45, endDeg: 135 },
  { value: 'rulo', midDeg: 180, startDeg: 135, endDeg: 225 },
]

/** FH/BH second wave — top spin up, back spin down, slice on both sides. */
const GROUND_WAVE_WEDGES: ShotWaveWedge[] = [
  { value: 'topspin', midDeg: 270, startDeg: 225, endDeg: 315 },
  { value: 'slice', midDeg: 0, startDeg: 315, endDeg: 405 },
  { value: 'backspin', midDeg: 90, startDeg: 45, endDeg: 135 },
  { value: 'slice', midDeg: 180, startDeg: 135, endDeg: 225 },
]

/** Lob second wave — high above, low below (two half-circle zones). */
const LOB_WAVE_WEDGES: ShotWaveWedge[] = [
  { value: 'high', midDeg: 270, startDeg: 180, endDeg: 360 },
  { value: 'low', midDeg: 90, startDeg: 0, endDeg: 180 },
]

/** The second-wave zone layout for a shot, or null if it has none. */
export function shotWaveWedges(shot: RallyWheelShot): ShotWaveWedge[] | null {
  if (shot === 'OH') return OVERHEAD_WAVE_WEDGES
  if (shot === 'FH' || shot === 'BH') return GROUND_WAVE_WEDGES
  if (shot === 'L') return LOB_WAVE_WEDGES
  return null
}

export function shotHasWave(shot: RallyWheelShot): boolean {
  return shotWaveWedges(shot) != null
}

/** Which second-wave option a drag angle falls into for the given shot. */
export function shotWaveFromAngle(shot: RallyWheelShot, deg: number): ShotWaveOption | null {
  if (!shotHasWave(shot)) return null
  const a = ((deg % 360) + 360) % 360
  if (shot === 'L') return a >= 180 ? 'high' : 'low'
  const overhead = shot === 'OH'
  if (a >= 45 && a < 135) return overhead ? 'gancho' : 'backspin'
  if (a >= 135 && a < 225) return overhead ? 'rulo' : 'slice'
  if (a >= 225 && a < 315) return overhead ? 'vibora' : 'topspin'
  return overhead ? 'bandeja' : 'slice'
}

export type BallPathTagPhase = 'glass_finish' | 'shot_pick' | 'confirm'

/** Button-center radius from the player coin center. */
export const RALLY_SHOT_RADIUS_PX = 50

type UnitDir = { x: number; y: number }

/** Screen-space unit directions: OH up, L down; FH/BH flip with court side. */
function shotDirsForQuadrant(quadrant: Quadrant): Record<RallyWheelShot, UnitDir> {
  const leftSide = quadrant === 'TL' || quadrant === 'BL'
  const towardCenter: UnitDir = leftSide ? { x: 1, y: 0 } : { x: -1, y: 0 }
  const towardSide: UnitDir = leftSide ? { x: -1, y: 0 } : { x: 1, y: 0 }

  return {
    OH: { x: 0, y: -1 },
    L: { x: 0, y: 1 },
    FH: towardCenter,
    BH: towardSide,
  }
}

export function offsetToAngleDeg(x: number, y: number): number {
  const deg = (Math.atan2(y, x) * 180) / Math.PI
  return deg < 0 ? deg + 360 : deg
}

export function rallyShotDefaultAngleDeg(quadrant: Quadrant, shot: RallyWheelShot): number {
  const { x, y } = rallyShotOffset(quadrant, shot)
  return offsetToAngleDeg(x, y)
}

export function rallyShotOffsetFromAngle(
  angleDeg: number,
  radius = RALLY_SHOT_RADIUS_PX,
): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180
  return { x: Math.cos(rad) * radius, y: Math.sin(rad) * radius }
}

export function angleDegFromClient(
  hubCenterX: number,
  hubCenterY: number,
  clientX: number,
  clientY: number,
): number {
  return offsetToAngleDeg(clientX - hubCenterX, clientY - hubCenterY)
}

export function rallyShotOffset(
  quadrant: Quadrant,
  shot: RallyWheelShot,
): { x: number; y: number } {
  const dir = shotDirsForQuadrant(quadrant)[shot]
  return {
    x: dir.x * RALLY_SHOT_RADIUS_PX,
    y: dir.y * RALLY_SHOT_RADIUS_PX,
  }
}

const RALLY_SHOT_DISPLAY: Record<RallyWheelShot, string> = {
  FH: 'Forehand',
  BH: 'Backhand',
  OH: 'Overhead',
  L: 'Lob',
}

export function rallyShotDisplayName(shot: RallyWheelShot): string {
  return RALLY_SHOT_DISPLAY[shot]
}

/** Parse stored ball-path report — legacy entries before structured shot fields. */
export function rallyShotsFromReport(
  report: string,
): { attacker: RallyWheelShot; defender: RallyWheelShot } | null {
  const match = report.match(/·\s*([A-Z]{2})@\d+°\s*vs\s*([A-Z]{2})@/)
  if (!match) return null
  const attacker = match[1] as RallyWheelShot
  const defender = match[2] as RallyWheelShot
  if (!(attacker in RALLY_SHOT_DISPLAY) || !(defender in RALLY_SHOT_DISPLAY)) return null
  return { attacker, defender }
}

export function rallyShotReport(
  attacker: RallyWheelShot,
  attackerAngleDeg: number,
  defender: RallyWheelShot,
  defenderAngleDeg: number,
  outcome: string,
): string {
  const a = Math.round(attackerAngleDeg)
  const d = Math.round(defenderAngleDeg)
  return `${outcome} · ${attacker}@${a}° vs ${defender}@${d}°`
}
