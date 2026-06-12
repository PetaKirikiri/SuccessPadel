import { useTranslation } from '../hooks/useTranslation'
import {
  LEADERBOARD_GENDER_OPTIONS,
  LEADERBOARD_RANK_MODES,
  LEADERBOARD_SKILL_OPTIONS,
  type LeaderboardFilters,
} from '../lib/leaderboardFilters'

type Props = {
  filters: LeaderboardFilters
  onChange: (filters: LeaderboardFilters) => void
}

function TabStrip<T extends string>({
  options,
  value,
  label,
  onSelect,
  labelFor,
  scroll = false,
}: {
  options: readonly T[]
  value: T
  label: string
  onSelect: (next: T) => void
  labelFor: (option: T) => string
  scroll?: boolean
}) {
  return (
    <div
      className={`${scroll ? 'flex overflow-x-auto scrollbar-none' : 'grid'} border-b border-brand-border/60`}
      style={
        scroll
          ? undefined
          : ({ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` } as const)
      }
      role="tablist"
      aria-label={label}
    >
      {options.map((option) => {
        const selected = value === option
        return (
          <button
            key={option}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onSelect(option)}
            className={`shrink-0 px-2 py-2 font-display text-xs transition md:py-2.5 md:text-sm ${
              scroll ? 'min-w-[4.5rem]' : 'min-w-0'
            } ${
              selected
                ? 'bg-brand-bg-alt font-semibold text-brand-primary'
                : 'text-brand-muted hover:bg-brand-bg-alt/40'
            }`}
          >
            {labelFor(option)}
          </button>
        )
      })}
    </div>
  )
}

export function LeaderboardFilters({ filters, onChange }: Props) {
  const { t } = useTranslation()

  const genderLabel = (value: (typeof LEADERBOARD_GENDER_OPTIONS)[number]) =>
    value === 'all' ? t('leaderboard.filterAll') : value

  const skillLabel = (value: (typeof LEADERBOARD_SKILL_OPTIONS)[number]) =>
    value === 'all' ? t('leaderboard.filterAll') : value

  const rankLabel = (mode: (typeof LEADERBOARD_RANK_MODES)[number]) =>
    mode === 'solo' ? t('leaderboard.filterSolo') : t('leaderboard.filterDuos')

  return (
    <div className="shrink-0 bg-brand-surface">
      <TabStrip
        label={t('leaderboard.filterFormat')}
        options={LEADERBOARD_RANK_MODES}
        value={filters.rankMode}
        labelFor={rankLabel}
        onSelect={(rankMode) => onChange({ ...filters, rankMode })}
      />
      <TabStrip
        label={t('leaderboard.filterLevel')}
        options={LEADERBOARD_SKILL_OPTIONS}
        value={filters.skillLevel}
        labelFor={skillLabel}
        onSelect={(skillLevel) => onChange({ ...filters, skillLevel })}
        scroll
      />
      <TabStrip
        label={t('leaderboard.filterGender')}
        options={LEADERBOARD_GENDER_OPTIONS}
        value={filters.gender}
        labelFor={genderLabel}
        onSelect={(gender) => onChange({ ...filters, gender })}
      />
    </div>
  )
}
