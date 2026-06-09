import type { MatchTeam } from './types'
import type { TennisScore } from './tennisScore'

/** Best-of-4: first team to win 4 games takes the match. */
export const GAMES_TO_WIN = 4

export function isMatchComplete(score: TennisScore): boolean {
  return score.gamesA >= GAMES_TO_WIN || score.gamesB >= GAMES_TO_WIN
}

export function matchWinner(score: TennisScore): MatchTeam | null {
  if (score.gamesA >= GAMES_TO_WIN) return 'a'
  if (score.gamesB >= GAMES_TO_WIN) return 'b'
  return null
}
