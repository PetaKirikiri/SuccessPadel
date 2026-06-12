import type { CapturedGesture, NormalizedPoint, Quadrant } from './gestureCapture'
import { quadrantTeam } from './gestureScoring'
import { padNormToCourtNorm, type CourtInsetBounds, type CourtLayout } from './padelCourtLayout'
import { partnerQuadrant } from './serveRotation'
import type { BallPathResult } from './ballPathScoring'
import type { RallyWheelShot, BallPathTagPhase, ShotWaveOption } from './rallyShotWheel'

export type PendingBallPathExchange = {
  entryId: string
  line: NormalizedPoint[]
  durationMs: number
  ballResult: BallPathResult
  phase: BallPathTagPhase
  attackerQuadrant: Quadrant
  defenderQuadrant: Quadrant
  attackerShot?: RallyWheelShot
  attackerShotAngleDeg?: number
  defenderShot?: RallyWheelShot
  defenderShotAngleDeg?: number
  /** Second-wave refinement (OH extension or FH/BH spin). */
  attackerWave?: ShotWaveOption
  defenderWave?: ShotWaveOption
  /** Shot power 0..1 from how far the coin was pulled out. */
  attackerPower?: number
  defenderPower?: number
  /** Pad-normal defender position (reach); ball drop stays on line end. */
  defenderReachPad?: NormalizedPoint
  /** Glass contact — draggable while phase is glass_finish. */
  glassAnchorPad?: NormalizedPoint
}

export function defenderQuadrantForPath(result: BallPathResult): Quadrant {
  const { hitterQuadrant, endQuadrant } = result
  const defTeam = quadrantTeam(hitterQuadrant) === 'a' ? 'b' : 'a'
  if (quadrantTeam(endQuadrant) === defTeam) return endQuadrant
  const partner = partnerQuadrant(endQuadrant)
  if (quadrantTeam(partner) === defTeam) return partner
  return defTeam === 'a' ? 'TL' : 'BL'
}

/** Court-normal anchor from the shot line endpoint. */
export function wheelAnchor(
  linePoint: NormalizedPoint,
  inset: CourtInsetBounds | null,
  layout: CourtLayout = 'portrait',
): NormalizedPoint {
  return inset ? padNormToCourtNorm(linePoint, inset, layout) : linePoint
}

export type FinalizedBallPath = {
  entryId: string
  line: NormalizedPoint[]
  durationMs: number
  ballResult: BallPathResult
  attackerQuadrant: Quadrant
  defenderQuadrant: Quadrant
  attackerShot: RallyWheelShot
  attackerShotAngleDeg: number
  defenderShot: RallyWheelShot
  defenderShotAngleDeg: number
  captured: CapturedGesture
}
