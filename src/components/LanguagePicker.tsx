import { useTranslation } from '../hooks/useTranslation'
import { useLocale } from '../providers/LocaleProvider'
import type { AppLocale } from '../lib/locale'

const options: { locale: AppLocale; flag: string; labelKey: string }[] = [
  { locale: 'en', flag: '🇬🇧', labelKey: 'lang.en' },
  { locale: 'th', flag: '🇹🇭', labelKey: 'lang.th' },
  { locale: 'fr', flag: '🇫🇷', labelKey: 'lang.fr' },
  { locale: 'ru', flag: '🇷🇺', labelKey: 'lang.ru' },
]

export function LanguagePicker({ dark = false }: { dark?: boolean }) {
  const { locale, setLocale } = useLocale()
  const { t } = useTranslation()

  const containerCls = dark
    ? 'border-white/35 bg-black/40 backdrop-blur-sm'
    : 'border-brand-border bg-brand-surface'
  const selectedCls = dark
    ? 'bg-white/20 ring-1 ring-white/45'
    : 'bg-brand-bg-alt ring-1 ring-brand-accent/50'

  return (
    <div
      className={`flex h-9 items-center gap-0.5 rounded-full border p-0.5 md:h-11 md:gap-1 md:p-1 ${containerCls}`}
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
            className={`flex h-7 w-7 items-center justify-center rounded-full text-base leading-none transition md:h-9 md:w-9 md:text-xl ${
              selected ? selectedCls : 'opacity-70 hover:opacity-100'
            }`}
          >
            <span aria-hidden>{option.flag}</span>
          </button>
        )
      })}
    </div>
  )
}
