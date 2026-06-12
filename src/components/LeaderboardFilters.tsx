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

function FilterChip({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
        active
          ? 'bg-brand-accent text-white shadow-sm'
          : 'border border-brand-border bg-brand-surface text-brand-text'
      }`}
    >
      {label}
    </button>
  )
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-brand-muted">{label}</p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
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
    <div className="space-y-3 border-b border-brand-border bg-brand-surface px-3 py-3 md:px-4">
      <FilterRow label={t('leaderboard.filterFormat')}>
        {LEADERBOARD_RANK_MODES.map((mode) => (
          <FilterChip
            key={mode}
            active={filters.rankMode === mode}
            label={rankLabel(mode)}
            onClick={() => onChange({ ...filters, rankMode: mode })}
          />
        ))}
      </FilterRow>
      <FilterRow label={t('leaderboard.filterGender')}>
        {LEADERBOARD_GENDER_OPTIONS.map((gender) => (
          <FilterChip
            key={gender}
            active={filters.gender === gender}
            label={genderLabel(gender)}
            onClick={() => onChange({ ...filters, gender })}
          />
        ))}
      </FilterRow>
      <FilterRow label={t('leaderboard.filterLevel')}>
        {LEADERBOARD_SKILL_OPTIONS.map((skillLevel) => (
          <FilterChip
            key={skillLevel}
            active={filters.skillLevel === skillLevel}
            label={skillLabel(skillLevel)}
            onClick={() => onChange({ ...filters, skillLevel })}
          />
        ))}
      </FilterRow>
    </div>
  )
}
