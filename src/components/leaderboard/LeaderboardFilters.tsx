import type { ReactNode } from 'react'
import { useTranslation } from '../../hooks/useTranslation'
import {
  LEADERBOARD_GENDER_OPTIONS,
  LEADERBOARD_RANK_MODES,
  LEADERBOARD_SKILL_OPTIONS,
  type LeaderboardFilters,
} from '../../lib/leaderboardFilters'
import { IconGauge, IconStar, IconUser, IconUsers } from '../ButtonIcons'

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
  iconFor,
  scroll = false,
}: {
  options: readonly T[]
  value: T
  label: string
  onSelect: (next: T) => void
  labelFor: (option: T) => string
  iconFor?: (option: T) => ReactNode
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
            className={`inline-flex shrink-0 items-center justify-center gap-1 px-2 py-2 font-display text-xs transition md:py-2.5 md:text-sm ${
              scroll ? 'min-w-[4.5rem]' : 'min-w-0'
            } ${
              selected
                ? 'bg-brand-bg-alt font-semibold text-brand-primary'
                : 'text-brand-muted hover:bg-brand-bg-alt/40'
            }`}
          >
            {iconFor ? iconFor(option) : null}
            <span className="truncate">{labelFor(option)}</span>
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

  const genderIcon = (value: (typeof LEADERBOARD_GENDER_OPTIONS)[number]) =>
    value === 'all' ? <IconUsers className="h-3.5 w-3.5" /> : <IconUser className="h-3.5 w-3.5" />

  const skillIcon = (value: (typeof LEADERBOARD_SKILL_OPTIONS)[number]) =>
    value === 'all' ? <IconGauge className="h-3.5 w-3.5" /> : <IconStar className="h-3.5 w-3.5" />

  const rankIcon = (mode: (typeof LEADERBOARD_RANK_MODES)[number]) =>
    mode === 'solo' ? <IconUser className="h-3.5 w-3.5" /> : <IconUsers className="h-3.5 w-3.5" />

  return (
    <div className="shrink-0 bg-brand-surface">
      <TabStrip
        label={t('leaderboard.filterFormat')}
        options={LEADERBOARD_RANK_MODES}
        value={filters.rankMode}
        onSelect={(rankMode) => onChange({ ...filters, rankMode })}
        labelFor={rankLabel}
        iconFor={rankIcon}
      />
      <TabStrip
        label={t('leaderboard.filterGender')}
        options={LEADERBOARD_GENDER_OPTIONS}
        value={filters.gender}
        onSelect={(gender) => onChange({ ...filters, gender })}
        labelFor={genderLabel}
        iconFor={genderIcon}
        scroll
      />
      <TabStrip
        label={t('leaderboard.filterSkill')}
        options={LEADERBOARD_SKILL_OPTIONS}
        value={filters.skillLevel}
        onSelect={(skillLevel) => onChange({ ...filters, skillLevel })}
        labelFor={skillLabel}
        iconFor={skillIcon}
        scroll
      />
    </div>
  )
}
