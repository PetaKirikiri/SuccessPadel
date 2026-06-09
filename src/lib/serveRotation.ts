import type { Quadrant } from './gestureCapture'
import { quadrantTeam } from './gestureScoring'
import {
  PADEL_SERVICE_LINE_BOTTOM_Y,
  PADEL_SERVICE_LINE_TOP_Y,
  pct,
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
    x: leftBox ? 0.44 : 0.56,
    y: topSide ? PADEL_SERVICE_LINE_TOP_Y : PADEL_SERVICE_LINE_BOTTOM_Y,
  }
}

export function receiveBoxCenter(receive: Quadrant): { x: number; y: number } {
  if (receive === 'TL') return { x: 0.25, y: 0.25 }
  if (receive === 'TR') return { x: 0.75, y: 0.25 }
  if (receive === 'BL') return { x: 0.25, y: 0.75 }
  return { x: 0.75, y: 0.75 }
}
