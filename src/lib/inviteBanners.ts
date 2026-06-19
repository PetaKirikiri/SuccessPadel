import type { Gender } from './competitionPresets'
import { GENDERS } from './competitionPresets'
import type { RuleChip } from './friendlyGameDisplay'
import duoMenBanner from '../assets/invite-banners/invite-banner-duo-men.png'
import menBanner from '../assets/invite-banners/invite-banner-men.jpg'
import womenBanner from '../assets/invite-banners/invite-banner-women.jpg'
import mixedBanner from '../assets/invite-banners/invite-banner-mixed.jpg'

const INVITE_BANNERS: Partial<Record<Gender, string>> = {
  Men: menBanner,
  Women: womenBanner,
  Mixed: mixedBanner,
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

export function inviteBannerForSession(opts: {
  gender?: string | null
  isDuo?: boolean
}): string | null {
  const normalized = normalizeSessionGender(opts.gender)
  if (!normalized) return null
  if (normalized === 'Men' && opts.isDuo) return duoMenBanner
  return INVITE_BANNERS[normalized] ?? null
}
