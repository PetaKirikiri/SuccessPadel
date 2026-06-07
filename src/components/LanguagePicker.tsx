import { useTranslation } from '../hooks/useTranslation'
import { useLocale } from '../providers/LocaleProvider'
import type { AppLocale } from '../lib/locale'

const options: { locale: AppLocale; flag: string; labelKey: string }[] = [
  { locale: 'en', flag: '🇬🇧', labelKey: 'lang.en' },
  { locale: 'th', flag: '🇹🇭', labelKey: 'lang.th' },
  { locale: 'fr', flag: '🇫🇷', labelKey: 'lang.fr' },
  { locale: 'ru', flag: '🇷🇺', labelKey: 'lang.ru' },
]

export function LanguagePicker() {
  const { locale, setLocale } = useLocale()
  const { t } = useTranslation()

  return (
    <div
      className="flex items-center gap-0.5 rounded-full border border-brand-border bg-brand-surface p-0.5"
      role="group"
      aria-label={t('aria.language')}
    >
      {options.map((option) => {
        const selected = locale === option.locale
        return (
          <button
            key={option.locale}
            type="button"
            onClick={() => setLocale(option.locale)}
            aria-label={t(option.labelKey)}
            aria-pressed={selected}
            className={`flex h-7 w-7 items-center justify-center rounded-full text-base leading-none transition ${
              selected ? 'bg-brand-bg-alt ring-1 ring-brand-accent/50' : 'opacity-70 hover:opacity-100'
            }`}
          >
            <span aria-hidden>{option.flag}</span>
          </button>
        )
      })}
    </div>
  )
}
