import { GameScheduleSetup, type GameScheduleSetupValues } from './GameScheduleSetup'
import type { Gender, SkillLevel } from '../../lib/competitionPresets'

export function SetupChip({
  active,
  children,
  disabled = false,
  onClick,
  compact = false,
}: {
  active: boolean
  children: React.ReactNode
  disabled?: boolean
  onClick: () => void
  compact?: boolean
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-lg font-medium transition disabled:opacity-50 ${
        compact ? 'px-1.5 py-1 text-[10px]' : 'px-3 py-2 text-xs'
      } ${
        active
          ? 'bg-brand-accent text-white shadow-sm'
          : 'border border-brand-border bg-brand-surface text-brand-text'
      }`}
    >
      {children}
    </button>
  )
}

function SetupChipGroup({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="min-w-0 space-y-1">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-brand-muted">
        {label}
      </span>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  )
}

type PlayerModeOption<T extends string> = {
  value: T
  label: string
  disabled?: boolean
}

type Props<TPlayerMode extends string, TCourtCount extends number> = {
  formatLabel: string
  playerMode: TPlayerMode
  playerModeOptions: PlayerModeOption<TPlayerMode>[]
  onPlayerModeChange: (mode: TPlayerMode) => void
  courtsLabel: string
  courtCount: TCourtCount
  courtOptions: readonly TCourtCount[]
  courtControlsDisabled?: boolean
  onCourtCountChange: (count: TCourtCount) => void
  schedule: {
    value: GameScheduleSetupValues
    dateValue?: string
    onDateChange?: (value: string) => void
    startValue: string
    endValue: string
    windowMinutes: number | null
    onStartChange: (value: string) => void
    onEndChange: (value: string) => void
    onChange: (patch: Partial<GameScheduleSetupValues>) => void
  }
  scheduleNotice?: React.ReactNode
  levelLabel: string
  skillLevels: readonly SkillLevel[]
  skillLevel: SkillLevel
  onSkillLevelChange: (level: SkillLevel) => void
  genderLabel: string
  genders: readonly Gender[]
  gender: Gender
  onGenderChange: (gender: Gender) => void
  titleLabel: string
  title: string
  titlePlaceholder: string
  onTitleChange: (value: string) => void
  onTitleBlur?: () => void
}

export function SessionSetupControls<TPlayerMode extends string, TCourtCount extends number>({
  formatLabel,
  playerMode,
  playerModeOptions,
  onPlayerModeChange,
  courtsLabel,
  courtCount,
  courtOptions,
  courtControlsDisabled = false,
  onCourtCountChange,
  schedule,
  scheduleNotice,
  levelLabel,
  skillLevels,
  skillLevel,
  onSkillLevelChange,
  genderLabel,
  genders,
  gender,
  onGenderChange,
  titleLabel,
  title,
  titlePlaceholder,
  onTitleChange,
  onTitleBlur,
}: Props<TPlayerMode, TCourtCount>) {
  return (
    <>
      <div className="grid grid-cols-4 gap-2">
        <SetupChipGroup label={formatLabel}>
          {playerModeOptions.map((option) => (
            <SetupChip
              key={option.value}
              active={playerMode === option.value}
              disabled={option.disabled}
              compact
              onClick={() => onPlayerModeChange(option.value)}
            >
              {option.label}
            </SetupChip>
          ))}
        </SetupChipGroup>

        <SetupChipGroup label={courtsLabel}>
          <div
            className={`flex flex-wrap gap-1 ${courtControlsDisabled ? 'pointer-events-none opacity-60' : ''}`}
          >
            {courtOptions.map((count) => (
              <SetupChip
                key={count}
                active={courtCount === count}
                compact
                onClick={() => onCourtCountChange(count)}
              >
                {count}
              </SetupChip>
            ))}
          </div>
        </SetupChipGroup>

        <SetupChipGroup label={levelLabel}>
          {skillLevels.map((level) => (
            <SetupChip
              key={level}
              active={skillLevel === level}
              compact
              onClick={() => onSkillLevelChange(level)}
            >
              {level}
            </SetupChip>
          ))}
        </SetupChipGroup>

        <SetupChipGroup label={genderLabel}>
          {genders.map((item) => (
            <SetupChip
              key={item}
              active={gender === item}
              compact
              onClick={() => onGenderChange(item)}
            >
              {item}
            </SetupChip>
          ))}
        </SetupChipGroup>
      </div>

      <GameScheduleSetup {...schedule} />
      {scheduleNotice}

      <label className="block space-y-1">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">
          {titleLabel}
        </span>
        <input
          type="text"
          value={title}
          onChange={(event) => onTitleChange(event.target.value)}
          onBlur={onTitleBlur}
          placeholder={titlePlaceholder}
          className="brand-input"
        />
      </label>
    </>
  )
}
