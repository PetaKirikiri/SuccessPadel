import { GameScheduleSetup, type GameScheduleSetupValues } from './GameScheduleSetup'
import type { Gender, SkillLevel } from '../lib/competitionPresets'

export function SetupChip({
  active,
  children,
  disabled = false,
  onClick,
}: {
  active: boolean
  children: React.ReactNode
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-lg px-3 py-2 text-xs font-medium transition disabled:opacity-50 ${
        active
          ? 'bg-brand-accent text-white shadow-sm'
          : 'border border-brand-border bg-brand-surface text-brand-text'
      }`}
    >
      {children}
    </button>
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
  courtCaption: string
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
  courtCaption,
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
      <div className="space-y-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">
          {formatLabel}
        </span>
        <div className="flex flex-wrap gap-1.5">
          {playerModeOptions.map((option) => (
            <SetupChip
              key={option.value}
              active={playerMode === option.value}
              disabled={option.disabled}
              onClick={() => onPlayerModeChange(option.value)}
            >
              {option.label}
            </SetupChip>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">
          {courtsLabel}
        </span>
        <div
          className={`flex flex-wrap gap-1.5 ${courtControlsDisabled ? 'pointer-events-none opacity-60' : ''}`}
        >
          {courtOptions.map((count) => (
            <SetupChip
              key={count}
              active={courtCount === count}
              onClick={() => onCourtCountChange(count)}
            >
              {count}
            </SetupChip>
          ))}
        </div>
        <p className="text-xs text-brand-muted">{courtCaption}</p>
      </div>

      <GameScheduleSetup {...schedule} />
      {scheduleNotice}

      <div className="space-y-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">
          {levelLabel}
        </span>
        <div className="flex flex-wrap gap-1.5">
          {skillLevels.map((level) => (
            <SetupChip
              key={level}
              active={skillLevel === level}
              onClick={() => onSkillLevelChange(level)}
            >
              {level}
            </SetupChip>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">
          {genderLabel}
        </span>
        <div className="flex flex-wrap gap-1.5">
          {genders.map((item) => (
            <SetupChip
              key={item}
              active={gender === item}
              onClick={() => onGenderChange(item)}
            >
              {item}
            </SetupChip>
          ))}
        </div>
      </div>

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
