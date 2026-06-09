import { formatHourLabel, scheduleGridHours } from '../lib/courtSchedule'

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
  onDayChange: (day: string) => void
  onStartHourChange: (hour: number) => void
  onBlur?: () => void
}

export function SessionTimeSetup({ day, startHour, onDayChange, onStartHourChange, onBlur }: Props) {
  const hours = scheduleGridHours()

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
          Start
        </span>
        <div className="flex flex-wrap gap-1.5">
          {hours.map((h) => (
            <Chip key={h} active={startHour === h} onClick={() => onStartHourChange(h)}>
              {formatHourLabel(h)}
            </Chip>
          ))}
        </div>
      </div>
    </div>
  )
}
