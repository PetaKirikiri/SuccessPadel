import type { NormalizedPoint, Quadrant } from './gestureCapture'
import { quadrantTeam } from './gestureScoring'
import {
  courtNormToPadNorm,
  COURT_SURFACE_SELECTOR,
  measureCourtInset,
  padNormToCourtNorm,
  PADEL_NET_Y,
  PADEL_SERVICE_LINE_BOTTOM_Y,
  PADEL_SERVICE_LINE_TOP_Y,
  PADEL_HALF_INNER_END_BOTTOM_Y,
  PADEL_HALF_INNER_START_TOP_Y,
  PADEL_ENCLOSURE_GLASS_DEPTH_ALONG_LENGTH_FR,
  pct,
  type CourtInsetBounds,
  type CourtLayout,
} from './padelCourtLayout'
import type { MatchTeam } from './types'
import type { TennisScore } from './tennisScore'

export function partnerQuadrant(q: Quadrant): Quadrant {
  if (q === 'TL') return 'TR'
  if (q === 'TR') return 'TL'
  if (q === 'BL') return 'BR'
  return 'BL'
}

export function rightQuadrantForTeam(team: MatchTeam): Quadrant {
  return team === 'a' ? 'TL' : 'BR'
}

export function leftQuadrantForTeam(team: MatchTeam): Quadrant {
  return team === 'a' ? 'TR' : 'BL'
}

/** 1-based game index for the game currently in progress. */
export function currentGameNumber(score: TennisScore): number {
  return score.gamesA + score.gamesB + 1
}

/**
 * Padel serve rotation across games:
 * - Teams alternate each game (game 1 = initial pick, game 2 = other team).
 * - When the other team serves first, their right-side player serves.
 * - Each time a team regains serve, the partner alternates (other player, then back).
 */
export function serveQuadrantForGame(
  gameNumber: number,
  initialServeQuadrant: Quadrant,
): Quadrant {
  if (gameNumber <= 1) return initialServeQuadrant

  const initialTeam = quadrantTeam(initialServeQuadrant)
  const otherTeam: MatchTeam = initialTeam === 'a' ? 'b' : 'a'
  const servingTeam = gameNumber % 2 === 1 ? initialTeam : otherTeam

  if (servingTeam === initialTeam) {
    const teamServeCount = (gameNumber + 1) / 2
    return teamServeCount % 2 === 1
      ? initialServeQuadrant
      : partnerQuadrant(initialServeQuadrant)
  }

  const teamServeCount = gameNumber / 2
  return teamServeCount % 2 === 1
    ? rightQuadrantForTeam(otherTeam)
    : leftQuadrantForTeam(otherTeam)
}

export function currentServeQuadrant(
  score: TennisScore,
  initialServeQuadrant: Quadrant,
): Quadrant {
  return serveQuadrantForGame(currentGameNumber(score), initialServeQuadrant)
}

/** Current service side: right side first in each game, then alternate every point. */
export function currentServeSideQuadrant(
  score: TennisScore,
  servingPlayerQuadrant: Quadrant,
): Quadrant {
  const servingTeam = quadrantTeam(servingPlayerQuadrant)
  const pointIndex = score.pointsA + score.pointsB
  return pointIndex % 2 === 0
    ? rightQuadrantForTeam(servingTeam)
    : leftQuadrantForTeam(servingTeam)
}

/** FIP Rule 8: second serve is from the same side as the first serve. */
export function serveSideForAttempt(serveSide: Quadrant, _attempt: 1 | 2): Quadrant {
  return serveSide
}

/** Diagonal service box the server is targeting. */
export function serveReceiveQuadrant(server: Quadrant): Quadrant {
  if (server === 'TL') return 'BR'
  if (server === 'TR') return 'BL'
  if (server === 'BL') return 'TR'
  return 'TL'
}

export type ServerChipPlacement = {
  top: string
  left: string
  transform: string
}

export type CoinCourtPlacement = ServerChipPlacement

/** Pre-serve pick: control servers on the service line, partners at the net. */
export function playForServeCoinPlacement(quadrant: Quadrant): CoinCourtPlacement {
  if (quadrant === 'TL' || quadrant === 'BR') {
    return serveCoinCourtPlacement(quadrant)
  }
  if (quadrant === 'TR') return serverPartnerCoinCourtPlacement('TL')
  return serverPartnerCoinCourtPlacement('BR')
}

/** Live serve formation — single source for setup confirm + servePending coins. */
export function serveFormationCoinPlacement(
  label: Quadrant,
  servePlayerQuadrant: Quadrant,
  serveSideQuadrant: Quadrant,
): CoinCourtPlacement {
  const receive = serveReceiveQuadrant(serveSideQuadrant)
  if (label === servePlayerQuadrant) {
    return serveCoinCourtPlacement(serveSideQuadrant)
  }
  if (label === receive) {
    return receiveCoinCourtPlacement(receive)
  }
  if (label === partnerQuadrant(receive)) {
    return receivePartnerCoinCourtPlacement(receive)
  }
  if (label === partnerQuadrant(servePlayerQuadrant)) {
    return serverPartnerCoinCourtPlacement(servePlayerQuadrant)
  }
  return serveCoinCourtPlacement(serveSideQuadrant)
}

/** After server pick — serving team stays put; only receivers move into formation. */
export function confirmServeCoinPlacement(
  label: Quadrant,
  initialServer: Quadrant,
): CoinCourtPlacement {
  const servingPartner = partnerQuadrant(initialServer)
  if (label === initialServer || label === servingPartner) {
    return playForServeCoinPlacement(label)
  }
  return serveFormationCoinPlacement(label, initialServer, initialServer)
}

/** Chip on correct service-box side, flush to baseline side of the service line. */
export function serverChipPlacement(server: Quadrant): ServerChipPlacement {
  const coords = serverChipCoords(server)
  const topSide = server === 'TL' || server === 'TR'
  const leftBox = server === 'TL' || server === 'BL'
  const yTransform = topSide ? 'calc(-100% - 2px)' : '2px'
  return {
    left: '50%',
    top: pct(coords.y),
    transform: leftBox
      ? `translate(calc(-100% - 4px), ${yTransform})`
      : `translate(4px, ${yTransform})`,
  }
}

export function serverChipCoords(server: Quadrant): { x: number; y: number } {
  const topSide = server === 'TL' || server === 'TR'
  const leftBox = server === 'TL' || server === 'BL'
  return {
    // Sit clearly inside the correct half so the coin doesn't straddle the
    // center line (coin is a fixed pixel size on a smaller court).
    x: leftBox ? 0.36 : 0.64,
    y: topSide ? PADEL_SERVICE_LINE_TOP_Y : PADEL_SERVICE_LINE_BOTTOM_Y,
  }
}

/** Matches PlayerShotOriginDrag coin: h-11 (44px) / sm:h-12 (48px). */
export function serveCoinPx(): number {
  if (typeof window !== 'undefined' && window.matchMedia('(min-width: 640px)').matches) {
    return 48
  }
  return 44
}

/** Diagonal receiver — behind the service line in the receiving service half. */
export function receiveCoinCoords(receiveQuadrant: Quadrant): { x: number; y: number } {
  const topSide = receiveQuadrant === 'TL' || receiveQuadrant === 'TR'
  const b = serviceBoxBounds(receiveQuadrant)
  return {
    x: (b.xMin + b.xMax) / 2,
    y: topSide ? PADEL_SERVICE_LINE_TOP_Y : PADEL_SERVICE_LINE_BOTTOM_Y,
  }
}

/** Receiver's partner — service line on the other half (covers their side). */
export function receivePartnerCoinCoords(receiveQuadrant: Quadrant): { x: number; y: number } {
  return receiveCoinCoords(partnerQuadrant(receiveQuadrant))
}

/** Server's partner — conventional net / volley start at serve (FIP: anywhere on own side). */
export function serverPartnerCoinCoords(serverPlayerQuadrant: Quadrant): { x: number; y: number } {
  const partner = partnerQuadrant(serverPlayerQuadrant)
  const leftSide = partner === 'TL' || partner === 'BL'
  const topSide = partner === 'TL' || partner === 'TR'
  return {
    x: leftSide ? 0.25 : 0.75,
    y: topSide
      ? (PADEL_HALF_INNER_START_TOP_Y + PADEL_NET_Y) / 2
      : (PADEL_NET_Y + PADEL_HALF_INNER_END_BOTTOM_Y) / 2,
  }
}

function coinCourtPlacementFromCoords(
  coords: { x: number; y: number },
  topSide: boolean,
): { left: string; top: string; transform: string } {
  return {
    left: pct(coords.x),
    top: pct(coords.y),
    transform: topSide ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
  }
}

/** CSS placement — receiver behind the service line in the diagonal receive box. */
export function receiveCoinCourtPlacement(receiveQuadrant: Quadrant): {
  left: string
  top: string
  transform: string
} {
  const topSide = receiveQuadrant === 'TL' || receiveQuadrant === 'TR'
  return coinCourtPlacementFromCoords(receiveCoinCoords(receiveQuadrant), topSide)
}

/** CSS placement — receiver's partner on the other half at the service line. */
export function receivePartnerCoinCourtPlacement(receiveQuadrant: Quadrant): {
  left: string
  top: string
  transform: string
} {
  const partner = partnerQuadrant(receiveQuadrant)
  const topSide = partner === 'TL' || partner === 'TR'
  return coinCourtPlacementFromCoords(receivePartnerCoinCoords(receiveQuadrant), topSide)
}

/** CSS placement — server's partner at the net on their half. */
export function serverPartnerCoinCourtPlacement(serverPlayerQuadrant: Quadrant): {
  left: string
  top: string
  transform: string
} {
  const partner = partnerQuadrant(serverPlayerQuadrant)
  const topSide = partner === 'TL' || partner === 'TR'
  return coinCourtPlacementFromCoords(serverPartnerCoinCoords(serverPlayerQuadrant), topSide)
}

/** CSS placement inside the court surface — bottom/top of avatar on the service line. */
export function serveCoinCourtPlacement(serveSide: Quadrant): {
  left: string
  top: string
  transform: string
} {
  const { x, y } = serverChipCoords(serveSide)
  const topSide = serveSide === 'TL' || serveSide === 'TR'
  return {
    left: pct(x),
    top: pct(y),
    transform: topSide ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
  }
}

/** Pad-normalized shot origin at serve coin center. */
export function serveOriginPadNorm(
  pad: HTMLElement,
  serveSide: Quadrant,
  coinPx = serveCoinPx(),
): NormalizedPoint | null {
  const inset = measureCourtInset(pad)
  const court = pad.querySelector(COURT_SURFACE_SELECTOR) as HTMLElement | null
  const courtH = court?.getBoundingClientRect().height ?? 0
  if (!inset || courtH <= 0) return null
  const topSide = serveSide === 'TL' || serveSide === 'TR'
  const { x, y: lineY } = serverChipCoords(serveSide)
  const halfNorm = coinPx / 2 / courtH
  return courtNormToPadNorm(
    { x, y: topSide ? lineY - halfNorm : lineY + halfNorm },
    inset,
  )
}

export function receiveBoxCenter(receive: Quadrant): { x: number; y: number } {
  const b = serviceBoxBounds(receive)
  return {
    x: (b.xMin + b.xMax) / 2,
    y: (b.yMin + b.yMax) / 2,
  }
}

export function serviceBoxBounds(quadrant: Quadrant): {
  xMin: number
  xMax: number
  yMin: number
  yMax: number
} {
  const left = quadrant === 'TL' || quadrant === 'BL'
  const top = quadrant === 'TL' || quadrant === 'TR'
  return {
    xMin: left ? 0 : 0.5,
    xMax: left ? 0.5 : 1,
    // Service box = between the net and the service line on each half.
    yMin: top ? PADEL_SERVICE_LINE_TOP_Y : PADEL_NET_Y,
    yMax: top ? PADEL_NET_Y : PADEL_SERVICE_LINE_BOTTOM_Y,
  }
}

const SERVER_BOX_INSET = 0.012

/** Back-court box behind the service line — where the server may stand. */
export function serverBoxBounds(serveSide: Quadrant): {
  xMin: number
  xMax: number
  yMin: number
  yMax: number
} {
  const left = serveSide === 'TL' || serveSide === 'BL'
  const top = serveSide === 'TL' || serveSide === 'TR'
  return {
    xMin: left ? 0 : 0.5,
    xMax: left ? 0.5 : 1,
    yMin: top ? 0 : PADEL_SERVICE_LINE_BOTTOM_Y,
    yMax: top ? PADEL_SERVICE_LINE_TOP_Y : 1,
  }
}

/**
 * "Starters box" — where the server may legally begin the serve stroke. Padel
 * is served from BEHIND the baseline, so this extends serverBoxBounds back to
 * the inner face of the end glass. Starting beyond the glass (through the wall)
 * still falls outside and is rejected.
 */
export function serveStartBoxBounds(serveSide: Quadrant): {
  xMin: number
  xMax: number
  yMin: number
  yMax: number
} {
  const b = serverBoxBounds(serveSide)
  const top = serveSide === 'TL' || serveSide === 'TR'
  const back = PADEL_ENCLOSURE_GLASS_DEPTH_ALONG_LENGTH_FR
  return {
    xMin: b.xMin,
    xMax: b.xMax,
    yMin: top ? -back : b.yMin,
    yMax: top ? b.yMax : 1 + back,
  }
}

export function clampCourtPointToServerBox(
  point: NormalizedPoint,
  serveSide: Quadrant,
): NormalizedPoint {
  const b = serverBoxBounds(serveSide)
  return {
    x: Math.min(Math.max(point.x, b.xMin + SERVER_BOX_INSET), b.xMax - SERVER_BOX_INSET),
    y: Math.min(Math.max(point.y, b.yMin + SERVER_BOX_INSET), b.yMax - SERVER_BOX_INSET),
  }
}

export function clampPadPointToServerBox(
  padPoint: NormalizedPoint,
  serveSide: Quadrant,
  inset: CourtInsetBounds,
  layout: CourtLayout = 'portrait',
): NormalizedPoint {
  const court = padNormToCourtNorm(padPoint, inset, layout)
  return courtNormToPadNorm(clampCourtPointToServerBox(court, serveSide), inset, layout)
}

const SERVICE_BOX_INSET = 0.012

/** Court-normal point inside the FIP service box (diagonal receive target). */
export function pointInServiceBox(point: NormalizedPoint, box: Quadrant): boolean {
  const b = serviceBoxBounds(box)
  return (
    point.x >= b.xMin + SERVICE_BOX_INSET &&
    point.x <= b.xMax - SERVICE_BOX_INSET &&
    point.y >= b.yMin + SERVICE_BOX_INSET &&
    point.y <= b.yMax - SERVICE_BOX_INSET
  )
}

/** Serve lands between the service line and the net on the server's half — net fault. */
export function isServeNetLanding(
  endCourt: NormalizedPoint,
  servingPlayerQuadrant: Quadrant,
): boolean {
  const topHalf = servingPlayerQuadrant === 'TL' || servingPlayerQuadrant === 'TR'
  if (topHalf) {
    if (endCourt.y >= PADEL_NET_Y) return false
    return endCourt.y > PADEL_SERVICE_LINE_TOP_Y
  }
  if (endCourt.y <= PADEL_NET_Y) return false
  return endCourt.y < PADEL_SERVICE_LINE_BOTTOM_Y
}
