import { useTranslation } from '../hooks/useTranslation'
import { useGamesGenderFilterControls } from '../contexts/GamesGenderFilterContext'
import { GENDERS, type Gender } from '../lib/competitionPresets'

type Props = {
  value: Gender
  onChange: (gender: Gender) => void
}

const btnBase =
  'inline-flex h-11 w-11 items-center justify-center rounded-xl border shadow-sm backdrop-blur-sm transition active:scale-[0.98] sm:h-12 sm:w-12'

function genderTone(gender: Gender) {
  if (gender === 'Men') return 'text-[#6ed7ff]'
  if (gender === 'Women') return 'text-[#ff8fd8]'
  return 'text-[#60a5fa]'
}

function btnClass(active: boolean, gender: Gender) {
  return active
    ? `${btnBase} border-brand-accent bg-brand-accent/95 text-white shadow-[0_0_0_2px_rgba(96,165,250,0.18)]`
    : `${btnBase} border-brand-border/80 bg-brand-surface/90 ${genderTone(gender)} dark:border-white/20`
}

function GenderIcon({ gender }: { gender: Gender }) {
  if (gender === 'Men') return <span className="gender-css-icon gender-css-icon-men" aria-hidden="true" />
  if (gender === 'Women') return <span className="gender-css-icon gender-css-icon-women" aria-hidden="true" />
  return <span className="gender-css-icon gender-css-icon-mixed" aria-hidden="true" />
}

export function GamesGenderFilterButtons({ value, onChange }: Props) {
  const { t } = useTranslation()
  const labels: Record<Gender, string> = {
    Men: t('competition.filterMen'),
    Women: t('competition.filterWomen'),
    Mixed: t('competition.filterMixed'),
  }

  return (
    <div className="flex gap-2 sm:gap-2.5">
      {GENDERS.map((gender) => (
        <button
          key={gender}
          type="button"
          aria-label={labels[gender]}
          aria-pressed={value === gender}
          title={labels[gender]}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onChange(gender)
          }}
          className={btnClass(value === gender, gender)}
        >
          <GenderIcon gender={gender} />
          <span className="sr-only">{labels[gender]}</span>
        </button>
      ))}
    </div>
  )
}

/** Compact gender filter shown above the invite cards. */
export function GamesGenderFilterBannerOverlay() {
  const controls = useGamesGenderFilterControls()
  if (!controls) return null
  return (
    <div className="pointer-events-auto absolute right-4 top-4 z-40">
      <GamesGenderFilterButtons value={controls.gender} onChange={controls.setGender} />
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
