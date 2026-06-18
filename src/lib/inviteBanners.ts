import type { Gender } from './competitionPresets'
import { GENDERS } from './competitionPresets'
import type { RuleChip } from './friendlyGameDisplay'
import menBanner from '../assets/invite-banners/invite-banner-men.jpg'
import womenBanner from '../assets/invite-banners/invite-banner-women.jpg'

const INVITE_BANNERS: Partial<Record<Gender, string>> = {
  Men: menBanner,
  Women: womenBanner,
}

export function normalizeSessionGender(gender: string | null | undefined): Gender | null {
  if (!gender) return null
  const trimmed = gender.trim()
  if (GENDERS.includes(trimmed as Gender)) return trimmed as Gender
  const lower = trimmed.toLowerCase()
  if (lower === 'men' || lower === 'man' || lower === 'male') return 'Men'
  if (lower === 'women' || lower === 'woman' || lower === 'female') return 'Women'
  if (lower === 'mixed') return 'Mixed'
  return null
}

export function genderFromRuleChips(chips: RuleChip[]): Gender | null {
  const chip = chips.find((c) => c.key === 'gender')
  return normalizeSessionGender(chip?.label)
}

export function inviteBannerForGender(gender: string | null | undefined): string | null {
  const normalized = normalizeSessionGender(gender)
  if (!normalized || normalized === 'Mixed') return null
  return INVITE_BANNERS[normalized] ?? null
}
