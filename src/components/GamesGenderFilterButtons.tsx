import { useTranslation } from '../hooks/useTranslation'
import { useGamesGenderFilterControls } from '../contexts/GamesGenderFilterContext'
import { GENDERS, type Gender } from '../lib/competitionPresets'

type Props = {
  value: Gender
  onChange: (gender: Gender) => void
}

const btnBase =
  'rounded-lg border px-2.5 py-1 font-display text-xs font-semibold shadow-sm backdrop-blur-sm transition active:scale-[0.98] sm:px-3 sm:text-sm'

function btnClass(active: boolean) {
  return active
    ? `${btnBase} border-brand-accent bg-brand-accent text-white shadow-sm`
    : `${btnBase} border-brand-border/80 bg-brand-surface/90 text-brand-primary dark:border-white/20 dark:text-brand-text`
}

export function GamesGenderFilterButtons({ value, onChange }: Props) {
  const { t } = useTranslation()
  const labels: Record<Gender, string> = {
    Men: t('competition.filterMen'),
    Women: t('competition.filterWomen'),
    Mixed: t('competition.filterMixed'),
  }

  return (
    <div className="flex gap-1.5 sm:gap-2">
      {GENDERS.map((gender) => (
        <button
          key={gender}
          type="button"
          aria-pressed={value === gender}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onChange(gender)
          }}
          className={btnClass(value === gender)}
        >
          {labels[gender]}
        </button>
      ))}
    </div>
  )
}

/** Gender filter on the first invite card banner (top-left — scoring stays top-right on all cards). */
export function GamesGenderFilterBannerOverlay() {
  const controls = useGamesGenderFilterControls()
  if (!controls) return null
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-30 aspect-[1024/172]">
      <div className="pointer-events-auto absolute left-3 top-3">
        <GamesGenderFilterButtons value={controls.gender} onChange={controls.setGender} />
      </div>
    </div>
  )
}

export function GamesGenderFilterEmptyBar() {
  const controls = useGamesGenderFilterControls()
  if (!controls) return null
  return (
    <div className="mb-3 flex justify-end">
      <GamesGenderFilterButtons value={controls.gender} onChange={controls.setGender} />
    </div>
  )
}
