import { useLocale } from '../providers/LocaleProvider'
import type { AppLocale } from '../lib/locale'

const options: { locale: AppLocale; flag: string; label: string }[] = [
  { locale: 'en', flag: '🇬🇧', label: 'English' },
  { locale: 'th', flag: '🇹🇭', label: 'ไทย' },
  { locale: 'fr', flag: '🇫🇷', label: 'Français' },
]

export function LanguagePicker() {
  const { locale, setLocale } = useLocale()

  return (
    <div
      className="flex items-center gap-0.5 rounded-full border border-brand-border bg-brand-surface p-0.5"
      role="group"
      aria-label="Language"
    >
      {options.map((option) => {
        const selected = locale === option.locale
        return (
          <button
            key={option.locale}
            type="button"
            onClick={() => setLocale(option.locale)}
            aria-label={option.label}
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
