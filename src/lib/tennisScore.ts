import type { MatchTeam } from './types'

export type TennisScore = {
  pointsA: number
  pointsB: number
  gamesA: number
  gamesB: number
}

export const INITIAL_TENNIS_SCORE: TennisScore = {
  pointsA: 0,
  pointsB: 0,
  gamesA: 0,
  gamesB: 0,
}

export function formatTennisPoint(p: number): string {
  if (p <= 0) return '0'
  if (p === 1) return '15'
  if (p === 2) return '30'
  return '40'
}

export function isDeuce(score: TennisScore): boolean {
  return score.pointsA >= 3 && score.pointsB >= 3 && score.pointsA === score.pointsB
}

export function formatGameScore(score: TennisScore): string {
  const left = formatTennisPoint(score.pointsA)
  const right = formatTennisPoint(score.pointsB)
  return isDeuce(score) ? `${left} - ${right} GP` : `${left} - ${right}`
}

function winGame(score: TennisScore, winner: MatchTeam): TennisScore {
  return {
    pointsA: 0,
    pointsB: 0,
    gamesA: score.gamesA + (winner === 'a' ? 1 : 0),
    gamesB: score.gamesB + (winner === 'b' ? 1 : 0),
  }
}

/** Tennis point scoring with golden point at deuce (40-40). */
export function applyTennisPoint(score: TennisScore, winner: MatchTeam): TennisScore {
  const w = winner === 'a' ? score.pointsA : score.pointsB
  const l = winner === 'a' ? score.pointsB : score.pointsA

  if (w >= 3 && l < 3) return winGame(score, winner)
  if (w >= 3 && l >= 3) return winGame(score, winner)

  if (winner === 'a') return { ...score, pointsA: w + 1 }
  return { ...score, pointsB: w + 1 }
}
