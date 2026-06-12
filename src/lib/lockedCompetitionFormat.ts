import {
  buildAmericanoScoringConfig,
  buildRulesText,
  ruleFormatLabel,
  rulesToPartnershipMode,
  type Gender,
  type SkillLevel,
} from './competitionPresets'
import { totalScheduleMinutes } from './competitionLayout'
import { RANKED_AMERICANO_GAMES, RANKED_GAME_MINUTES } from './rankedSchedule'
import type { TranslateFn } from '../i18n'
import type { FriendlyRuleChip } from './friendlyGameDisplay'
import type { ScoringConfig } from './types'

/** Fixed competition format — admin picks date, names, level, and gender. */
export const LOCKED_COMPETITION = {
  targetPlayers: 16 as const,
  gameCount: RANKED_AMERICANO_GAMES,
  americanoTarget: 6 as const,
  breakMinutes: 3,
  gameMinutes: RANKED_GAME_MINUTES,
} as const

export function lockedCompetitionRuleChips(t: TranslateFn): FriendlyRuleChip[] {
  return [
    {
      key: 'format',
      label: ruleFormatLabel('americano'),
      hintKey: 'friendly.hint.format',
      icon: 'americano',
    },
    {
      key: 'scoring',
      label: t('friendly.chip.bestOfGames', { n: LOCKED_COMPETITION.americanoTarget }),
      hintKey: 'friendly.hint.scoring',
      icon: 'scoring',
    },
    {
      key: 'rounds',
      label: t('friendly.chip.matches', { n: LOCKED_COMPETITION.gameCount }),
      hintKey: 'friendly.hint.rounds',
      icon: 'rounds',
    },
    {
      key: 'gameMin',
      label: t('friendly.chip.minsPerGame', { n: LOCKED_COMPETITION.gameMinutes }),
      hintKey: 'friendly.hint.gameMinutes',
      icon: 'game-minutes',
    },
    {
      key: 'break',
      label: t('friendly.chip.minBreaks', { n: LOCKED_COMPETITION.breakMinutes }),
      hintKey: 'friendly.hint.break',
      icon: 'break',
    },
  ]
}

export function lockedCompetitionEventMinutes(): number {
  return totalScheduleMinutes(
    LOCKED_COMPETITION.gameCount,
    LOCKED_COMPETITION.gameMinutes,
    LOCKED_COMPETITION.breakMinutes,
  )
}

export function lockedCompetitionScoringConfig(): ScoringConfig {
  return buildAmericanoScoringConfig(LOCKED_COMPETITION.americanoTarget, {
    games: LOCKED_COMPETITION.gameCount,
    breakMinutes: LOCKED_COMPETITION.breakMinutes,
    gameMinutes: LOCKED_COMPETITION.gameMinutes,
  })
}

export function lockedCompetitionSessionFields(opts: {
  skillLevel: SkillLevel
  gender: Gender
}) {
  const scoring_config = lockedCompetitionScoringConfig()
  return {
    skill_level: opts.skillLevel,
    gender: opts.gender,
    rules: buildRulesText('americano', null, {
      target: LOCKED_COMPETITION.americanoTarget,
      unit: 'games',
    }),
    target_players: LOCKED_COMPETITION.targetPlayers,
    max_players: LOCKED_COMPETITION.targetPlayers,
    player_cap_mode: 'strict' as const,
    partnership_mode: rulesToPartnershipMode('americano', null),
    scoring_preset: 'standard' as const,
    scoring_config,
    who_can_log_matches: 'roster_members' as const,
    margin_bonus_enabled: true,
  }
}
