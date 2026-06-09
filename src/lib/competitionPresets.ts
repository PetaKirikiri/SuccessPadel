import { formatClubDateShort, formatClubTime } from './courtSchedule'
import type { GameSession, PartnershipMode, ScoringConfig } from './types'

export function usesAmericanoScoring(
  session: Pick<GameSession, 'partnership_mode' | 'rules'>,
): boolean {
  if (session.partnership_mode === 'americano') return true
  return /americano/i.test(session.rules ?? '')
}

export type AmericanoScoringUnit = 'points' | 'sets' | 'games' | 'open'

export function americanoScoringUnit(
  session: Pick<GameSession, 'scoring_config'>,
): AmericanoScoringUnit {
  const unit = session.scoring_config?.americano_unit
  if (unit === 'open' || unit === 'sets' || unit === 'points' || unit === 'games') return unit
  if (session.scoring_config?.americano_target === 4) return 'sets'
  return 'games'
}

export function americanoScoreTarget(
  session: Pick<GameSession, 'scoring_config'>,
): number | undefined {
  if (americanoScoringUnit(session) === 'open') return undefined
  const unit = americanoScoringUnit(session)
  const t = session.scoring_config?.americano_target
  if (typeof t === 'number' && t > 0) return t
  if (unit === 'sets') return AMERICANO_DEFAULT_SETS
  if (unit === 'points') return AMERICANO_DEFAULT_TARGET
  return AMERICANO_DEFAULT_GAMES
}

export function americanoTargetPoints(
  session: Pick<GameSession, 'scoring_config'>,
): number | undefined {
  return americanoScoreTarget(session)
}

export const SKILL_LEVELS = ['Beginner', 'Low Inter', 'Intermediate', 'Advanced', 'Open'] as const
export const GENDERS = ['Mixed', 'Women', 'Men'] as const
export const PLAYER_CAPS = [4, 8, 12, 16] as const
export const DURATIONS = [1, 2, 3] as const
export const RULE_FORMATS = ['king_of_court', 'americano'] as const
export const AMERICANO_TARGETS = [4, 5, 6, 7, 8] as const
export const AMERICANO_DEFAULT_GAMES = 6
/** @deprecated legacy point-target sessions */
export const AMERICANO_DEFAULT_TARGET = 24
export const AMERICANO_DEFAULT_SETS = 4
export const PARTNER_STYLES = ['swapped', 'fixed'] as const

export type SkillLevel = (typeof SKILL_LEVELS)[number]
export type Gender = (typeof GENDERS)[number]
export type RuleFormat = (typeof RULE_FORMATS)[number]
export type PartnerStyle = (typeof PARTNER_STYLES)[number]

export function ruleFormatLabel(format: RuleFormat): string {
  return format === 'americano' ? 'Americano' : 'King of Court'
}

export function partnerStyleLabel(style: PartnerStyle): string {
  return style === 'fixed' ? 'Fixed' : 'Swapped'
}

export function buildRulesText(
  format: RuleFormat,
  partners: PartnerStyle | null,
  americano?: { target?: number; unit: AmericanoScoringUnit },
): string {
  if (format === 'americano') {
    if (americano?.unit === 'open') return 'Americano · open'
    if (americano?.unit === 'games') {
      return `Americano · ${americano.target ?? AMERICANO_DEFAULT_GAMES} games`
    }
    if (americano?.unit === 'sets') return `Americano · ${americano.target ?? AMERICANO_DEFAULT_SETS} sets`
    return `Americano · ${americano?.target ?? AMERICANO_DEFAULT_TARGET} pts`
  }
  return `King of Court · ${partnerStyleLabel(partners ?? 'swapped').toLowerCase()} partners`
}

export function americanoTargetLabel(target: number): string {
  return String(target)
}

export type AmericanoScoringChoice = (typeof AMERICANO_TARGETS)[number] | 'open'

export function buildAmericanoScoringConfig(
  choice: AmericanoScoringChoice,
  schedule?: { games?: number; breakMinutes?: number; gameMinutes?: number },
): ScoringConfig {
  const scheduleFields = {
    ...(schedule?.games ? { americano_games: schedule.games } : {}),
    ...(schedule?.breakMinutes !== undefined ? { break_minutes: schedule.breakMinutes } : {}),
    ...(schedule?.gameMinutes ? { game_minutes: schedule.gameMinutes } : {}),
  }
  if (choice === 'open') return { americano_unit: 'open', ...scheduleFields }
  return {
    americano_target: choice,
    americano_unit: 'games',
    ...scheduleFields,
  }
}

export function americanoScoringFromConfig(
  config: ScoringConfig | null | undefined,
): AmericanoScoringChoice {
  if (config?.americano_unit === 'open') return 'open'
  const target = config?.americano_target
  if (target && AMERICANO_TARGETS.includes(target as (typeof AMERICANO_TARGETS)[number])) {
    return target as (typeof AMERICANO_TARGETS)[number]
  }
  if (config?.americano_unit === 'sets' && target === 4) return 4
  return 'open'
}

export function rulesToPartnershipMode(
  format: RuleFormat,
  partners: PartnerStyle | null,
): PartnershipMode {
  if (format === 'americano') return 'americano'
  return partners === 'fixed' ? 'fixed_pairs' : 'rotating'
}

export function partnershipModeToRules(
  mode: PartnershipMode,
  rulesText?: string | null,
): { format: RuleFormat; partners: PartnerStyle | null } {
  if (mode === 'americano') return { format: 'americano', partners: null }
  if (mode === 'fixed_pairs') return { format: 'king_of_court', partners: 'fixed' }
  if (rulesText?.toLowerCase().includes('americano')) return { format: 'americano', partners: null }
  if (rulesText?.toLowerCase().includes('fixed')) {
    return { format: 'king_of_court', partners: 'fixed' }
  }
  return { format: 'king_of_court', partners: 'swapped' }
}

export function buildCompetitionTitle(
  level: string,
  startsAt: Date,
  customTitle?: string,
): string {
  const trimmed = customTitle?.trim()
  if (trimmed) return trimmed
  return `${level} · ${formatClubDateShort(startsAt)} · ${formatClubTime(startsAt)}`
}
