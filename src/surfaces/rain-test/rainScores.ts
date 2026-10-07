import type { RainRound } from './rainSchedule'

export type RainScore = { teamAPoints: number; teamBPoints: number }
export type RainScores = Record<string, RainScore>
export const rainScoreKey = (game: number, court: string) => `${game}:${court}`

// Include every pairing: a changed roster or draw must never inherit another draw's scores.
export function rainStorageKey(competitionId: string, rounds: RainRound[]): string {
  const draw = rounds.map(round => round.game.courts.map(court =>
    [...court.teamAPlayers!, ...court.teamBPlayers!].map(player => player.rosterId).join(','),
  ).join(';')).join('|')
  return `successpadel:rain-preview:v1:${competitionId}:${draw}`
}

export function validRainScore(value: unknown): value is RainScore {
  if (!value || typeof value !== 'object') return false
  const score = value as RainScore
  return [score.teamAPoints, score.teamBPoints].every(n => Number.isInteger(n) && n >= 0 && n <= 99)
}

export function readRainScores(raw: string | null): RainScores {
  if (!raw) return {}
  const value: unknown = JSON.parse(raw)
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Saved preview scores could not be read.')
  const scores: RainScores = {}
  for (const [key, score] of Object.entries(value)) {
    if (!/^[1-9]:rain-court-[12]$/.test(key) || !validRainScore(score)) throw new Error('Saved preview scores could not be read.')
    scores[key] = score
  }
  return scores
}

export function saveRainScore(storage: Pick<Storage, 'getItem' | 'setItem'>, storageKey: string, game: number, court: string, score: RainScore): RainScores {
  if (!/^[1-9]:rain-court-[12]$/.test(rainScoreKey(game, court)) || !validRainScore(score)) {
    throw new Error('Enter whole-number scores between 0 and 99.')
  }
  const next = { ...readRainScores(storage.getItem(storageKey)), [rainScoreKey(game, court)]: score }
  // Persist first. A quota/privacy failure must not be reported as a successful save.
  storage.setItem(storageKey, JSON.stringify(next))
  return next
}
