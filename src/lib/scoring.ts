import type { ScoringConfig, ScoringPreset } from './types'

export type MatchOutcome = {
  isWinner: boolean
  marginBonusEarned?: boolean
}

export function computePoints(
  preset: ScoringPreset,
  config: ScoringConfig,
  marginBonusEnabled: boolean,
  outcome: MatchOutcome,
): number {
  if (preset === 'participation') return 1
  if (preset === 'winner_takes_all') return outcome.isWinner ? 4 : 0

  const winPts = preset === 'custom' ? (config.win_points ?? 3) : 3
  const lossPts = preset === 'custom' ? (config.loss_points ?? 1) : 1

  if (outcome.isWinner) {
    const bonus =
      marginBonusEnabled && outcome.marginBonusEarned ? (config.margin_bonus ?? 1) : 0
    const cap = config.margin_bonus_cap ?? 1
    return winPts + Math.min(bonus, cap)
  }
  return lossPts
}
