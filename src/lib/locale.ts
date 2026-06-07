export type AppLocale = 'en' | 'th' | 'fr' | 'ru'

export const LOCALE_STORAGE_KEY = 'sp-locale'

export function readStoredLocale(): AppLocale {
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY)
    if (stored === 'th' || stored === 'en' || stored === 'fr' || stored === 'ru') return stored
  } catch {
    /* ignore */
  }
  return 'en'
}

export function writeStoredLocale(locale: AppLocale): void {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale)
  } catch {
    /* ignore */
  }
}
