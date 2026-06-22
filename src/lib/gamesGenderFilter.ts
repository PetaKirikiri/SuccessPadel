import { GENDERS, type Gender } from './competitionPresets'
import type { TranslateFn } from '../i18n'
import { normalizeSessionGender } from './inviteBanners'

export function genderFilterLabel(filter: Gender, t: TranslateFn): string {
  if (filter === 'Men') return t('competition.filterMen')
  if (filter === 'Women') return t('competition.filterWomen')
  return t('competition.filterMixed')
}

const COMPETITIVE_GENDER_FILTER_STORAGE_KEY = 'competitiveGenderFilter'

export function storeCompetitiveGenderFilter(gender: Gender): void {
  try {
    sessionStorage.setItem(COMPETITIVE_GENDER_FILTER_STORAGE_KEY, gender)
  } catch {
    /* private mode */
  }
}

export function consumeStoredCompetitiveGenderFilter(): Gender | null {
  try {
    const saved = sessionStorage.getItem(COMPETITIVE_GENDER_FILTER_STORAGE_KEY)
    sessionStorage.removeItem(COMPETITIVE_GENDER_FILTER_STORAGE_KEY)
    if (saved && GENDERS.includes(saved as Gender)) return saved as Gender
  } catch {
    /* private mode */
  }
  return null
}

export function matchesGamesGenderFilter(
  gender: string | null | undefined,
  filter: Gender,
): boolean {
  const normalized = normalizeSessionGender(gender)
  if (!normalized) return filter === 'Mixed'
  return normalized === filter
}
