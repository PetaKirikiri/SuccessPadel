import { useMemo } from 'react'
import { createTranslator } from '../i18n'
import { useLocale } from '../providers/LocaleProvider'

export function useTranslation() {
  const { locale } = useLocale()
  return useMemo(() => createTranslator(locale), [locale])
}
