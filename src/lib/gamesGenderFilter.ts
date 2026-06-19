import type { Gender } from './competitionPresets'
import type { TranslateFn } from '../i18n'
import { normalizeSessionGender } from './inviteBanners'

export function genderFilterLabel(filter: Gender, t: TranslateFn): string {
  if (filter === 'Men') return t('competition.filterMen')
  if (filter === 'Women') return t('competition.filterWomen')
  return t('competition.filterMixed')
}

export function matchesGamesGenderFilter(
  gender: string | null | undefined,
  filter: Gender,
): boolean {
  const normalized = normalizeSessionGender(gender)
  if (!normalized) return filter === 'Mixed'
  return normalized === filter
}
