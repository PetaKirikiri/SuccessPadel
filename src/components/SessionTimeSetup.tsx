import {
  formatHourLabel,
  roundToSessionStartMinute,
  scheduleGridHours,
  SESSION_START_MINUTES,
} from '../lib/courtSchedule'

function Chip({
  active,
  children,
  onClick,
}: {
  active: boolean
  children: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-3 py-2 text-xs font-medium transition ${
        active
          ? 'bg-brand-accent text-white shadow-sm'
          : 'border border-brand-border bg-brand-surface text-brand-text'
      }`}
    >
      {children}
    </button>
  )
}

type Props = {
  day: string
  startHour: number
  startMinute?: number
  onDayChange: (day: string) => void
  onStartHourChange: (hour: number) => void
  onStartMinuteChange?: (minute: number) => void
  onBlur?: () => void
  minuteLabel?: string
}

export function SessionTimeSetup({
  day,
  startHour,
  startMinute = 0,
  onDayChange,
  onStartHourChange,
  onStartMinuteChange,
  onBlur,
  minuteLabel = 'Delay (min)',
}: Props) {
  const hours = scheduleGridHours()
  const minute = roundToSessionStartMinute(startMinute)

  return (
    <div className="space-y-3">
      <label className="block space-y-1">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">
          Day
        </span>
        <input
          type="date"
          value={day}
          onChange={(e) => onDayChange(e.target.value)}
          onBlur={onBlur}
          className="brand-input"
        />
      </label>

      <div className="space-y-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">
          Start · {formatHourLabel(startHour, minute)}
        </span>
        <div className="flex flex-wrap gap-1.5">
          {hours.map((h) => (
            <Chip key={h} active={startHour === h} onClick={() => onStartHourChange(h)}>
              {formatHourLabel(h)}
            </Chip>
          ))}
        </div>
      </div>

      {onStartMinuteChange ? (
        <div className="space-y-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">
            {minuteLabel}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {SESSION_START_MINUTES.map((m) => (
              <Chip key={m} active={minute === m} onClick={() => onStartMinuteChange(m)}>
                :{String(m).padStart(2, '0')}
              </Chip>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
