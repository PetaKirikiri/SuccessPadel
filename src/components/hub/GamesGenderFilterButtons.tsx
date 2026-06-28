import { useTranslation } from '../../hooks/useTranslation'
import { GENDERS, type Gender } from '../../lib/competitionPresets'

type Props = {
  value: Gender
  onChange: (gender: Gender) => void
  /** Smaller buttons for invite card header rail. */
  compact?: boolean
}

const btnBase =
  'inline-flex items-center justify-center rounded-xl border shadow-sm backdrop-blur-sm transition active:scale-[0.98]'

const btnSize = {
  default: 'h-10 w-10 sm:h-11 sm:w-11',
  compact: 'h-8 w-8 sm:h-9 sm:w-9',
}

const GENDER_ICON_SRC: Record<Gender, string> = {
  Mixed: '/gender-icons/mixed.png',
  Women: '/gender-icons/female.png',
  Men: '/gender-icons/male.png',
}

function btnClass(active: boolean, compact: boolean) {
  return active
    ? `${btnBase} ${btnSize[compact ? 'compact' : 'default']} border-brand-accent bg-brand-accent/95 text-white shadow-[0_0_0_2px_rgba(96,165,250,0.18)]`
    : `${btnBase} ${btnSize[compact ? 'compact' : 'default']} border-brand-border/80 bg-brand-surface/90 dark:border-white/20`
}

function GenderIcon({ gender }: { gender: Gender }) {
  return <img src={GENDER_ICON_SRC[gender]} alt="" className="gender-raster-icon" aria-hidden="true" />
}

export function GamesGenderFilterButtons({ value, onChange, compact = false }: Props) {
  const { t } = useTranslation()
  const labels: Record<Gender, string> = {
    Men: t('competition.filterMen'),
    Women: t('competition.filterWomen'),
    Mixed: t('competition.filterMixed'),
  }

  return (
    <div
      className={`flex shrink-0 ${compact ? 'flex-row gap-1' : 'gap-2 sm:gap-2.5'}`}
      role="group"
      aria-label={t('friendly.hint.gender')}
    >
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
          className={btnClass(value === gender, compact)}
        >
          <GenderIcon gender={gender} />
          <span className="sr-only">{labels[gender]}</span>
        </button>
      ))}
    </div>
  )
}
