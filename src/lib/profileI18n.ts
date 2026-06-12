import type { TranslateFn } from '../i18n'
import type { SkillLevel } from './competitionPresets'
import {
  PLAYER_GENDERS,
  type PlayerGender,
  type PlayStyle,
} from './profileFields'
import type { DominantHand, PlaySide } from './types'

const GENDER_KEYS: Record<PlayerGender, string> = {
  Male: 'playerProfile.genderMale',
  Female: 'playerProfile.genderFemale',
}

const HAND_KEYS: Record<DominantHand, string> = {
  left: 'playerProfile.handLeft',
  right: 'playerProfile.handRight',
}

const SIDE_KEYS: Record<PlaySide, string> = {
  left: 'playerProfile.sideLeft',
  right: 'playerProfile.sideRight',
  both: 'playerProfile.sideBoth',
}

const SKILL_KEYS: Record<SkillLevel, string> = {
  Beginner: 'playerProfile.skillBeginner',
  'Low Inter': 'playerProfile.skillLowInter',
  Intermediate: 'playerProfile.skillIntermediate',
  Advanced: 'playerProfile.skillAdvanced',
  Open: 'playerProfile.skillOpen',
}

const STYLE_KEYS: Record<PlayStyle, string> = {
  Aggressive: 'playerProfile.styleAggressive',
  Defensive: 'playerProfile.styleDefensive',
  'All-court': 'playerProfile.styleAllCourt',
  'Net player': 'playerProfile.styleNetPlayer',
  Baseline: 'playerProfile.styleBaseline',
  Power: 'playerProfile.stylePower',
  Control: 'playerProfile.styleControl',
}

export function profileGenderLabel(gender: PlayerGender, t: TranslateFn): string {
  return t(GENDER_KEYS[gender])
}

export function profileGenderFromStored(
  value: string | null | undefined,
  t: TranslateFn,
): string | null {
  if (PLAYER_GENDERS.includes(value as PlayerGender)) {
    return profileGenderLabel(value as PlayerGender, t)
  }
  return value?.trim() || null
}

export function profileHandLabel(hand: DominantHand, t: TranslateFn): string {
  return t(HAND_KEYS[hand])
}

export function profileHandFromStored(
  value: DominantHand | null | undefined,
  t: TranslateFn,
): string | null {
  if (value === 'left' || value === 'right') return profileHandLabel(value, t)
  return null
}

export function profileSideLabel(side: PlaySide, t: TranslateFn): string {
  return t(SIDE_KEYS[side])
}

export function profileSideFromStored(
  value: PlaySide | null | undefined,
  t: TranslateFn,
): string | null {
  if (value === 'left' || value === 'right' || value === 'both') {
    return profileSideLabel(value, t)
  }
  return null
}

export function profileSkillLabel(level: SkillLevel, t: TranslateFn): string {
  return t(SKILL_KEYS[level])
}

export function profileSkillFromStored(
  value: string | null | undefined,
  t: TranslateFn,
): string | null {
  if (value && value in SKILL_KEYS) return profileSkillLabel(value as SkillLevel, t)
  return value?.trim() || null
}

export function profilePlayStyleLabel(style: PlayStyle, t: TranslateFn): string {
  return t(STYLE_KEYS[style])
}
