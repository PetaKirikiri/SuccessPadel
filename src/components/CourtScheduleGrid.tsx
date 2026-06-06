import { Link } from 'react-router-dom'
import { bangkokHour, formatClubTime, scheduleGridHours } from '../lib/courtSchedule'
import { isOverflow, rosterLabel } from '../lib/playerCaps'
import type { Court, CourtScheduleCell } from '../lib/types'

type Props = {
  day: string
  courts: Court[]
  cells: CourtScheduleCell[]
  isAdmin: boolean
  onCellClick: (cell: CourtScheduleCell) => void
  onDayChange: (day: string) => void
}

function shiftDay(day: string, delta: number): string {
  const d = new Date(`${day}T12:00:00`)
  d.setDate(d.getDate() + delta)
  return d.toISOString().slice(0, 10)
}

export function CourtScheduleGrid({
  day,
  courts,
  cells,
  isAdmin,
  onCellClick,
  onDayChange,
}: Props) {
  const hours = scheduleGridHours()
  const gridCols = `1.75rem repeat(${courts.length}, minmax(0, 1fr))`

  const cellAt = (courtId: string, hour: number) =>
    cells.find((c) => c.court.id === courtId && bangkokHour(c.slot.starts_at) === hour)

  const dayLabel = new Date(`${day}T12:00:00`).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })

  return (
    <div className="game-card overflow-hidden p-0">
      <div className="grid grid-cols-[1.5rem_1fr_auto] items-center gap-1 border-b border-brand-border bg-brand-bg-alt px-2 py-2">
        <button
          type="button"
          onClick={() => onDayChange(shiftDay(day, -1))}
          className="text-brand-accent text-sm font-medium"
        >
          ‹
        </button>
        <span className="truncate text-center text-sm font-semibold text-brand-primary">
          {dayLabel}
        </span>
        <div className="flex items-center gap-1.5">
          {isAdmin && (
            <Link to="/fun/new" className="text-[11px] font-medium text-brand-accent">
              Add
            </Link>
          )}
          <button
            type="button"
            onClick={() => onDayChange(shiftDay(day, 1))}
            className="text-brand-accent text-sm font-medium"
          >
            ›
          </button>
        </div>
      </div>

      <div className="overflow-hidden">
        <div
          className="grid border-b border-brand-border text-[10px] uppercase tracking-wide text-brand-muted"
          style={{ gridTemplateColumns: gridCols }}
        >
          <div className="px-0.5 py-2" />
          {courts.map((c) => (
            <div key={c.id} className="truncate px-0.5 py-2 text-center font-semibold">
              {c.name.replace('Court ', 'C')}
            </div>
          ))}
        </div>

        {hours.map((hour) => (
          <div
            key={hour}
            className="grid border-b border-brand-border/50"
            style={{ gridTemplateColumns: gridCols }}
          >
            <div className="px-0.5 py-1 text-[10px] text-brand-muted">
              {String(hour).padStart(2, '0')}:00
            </div>
            {courts.map((court) => {
              const cell = cellAt(court.id, hour)
              if (!cell) {
                return <div key={court.id} className="min-w-0 border-l border-brand-border/30 p-0.5" />
              }

              const target = cell.session.target_players ?? 4
              const flexible = cell.session.player_cap_mode === 'flexible'
              const countLabel = rosterLabel(cell.rosterCount, target, flexible)
              const overflow = isOverflow(cell.rosterCount, target)
              const grouped = Boolean(cell.session.game_group_id)

              return (
                <div key={court.id} className="min-w-0 border-l border-brand-border/30 p-0.5">
                  <button
                    type="button"
                    onClick={() => onCellClick(cell)}
                    className={`h-10 w-full min-w-0 rounded-md px-0.5 text-left transition ${
                      cell.isSpanStart
                        ? 'bg-brand-accent/15 ring-1 ring-brand-accent/40'
                        : 'bg-brand-accent/10'
                    }`}
                  >
                    <span
                      className={`block truncate text-[10px] font-semibold ${
                        overflow ? 'text-brand-accent' : 'text-brand-primary'
                      }`}
                    >
                      {countLabel}
                    </span>
                    <span className="block truncate text-[9px] text-brand-muted">
                      {cell.players.length}/4 · {formatClubTime(new Date(cell.slot.starts_at))}
                    </span>
                    {grouped && (
                      <span className="block truncate text-[8px] font-semibold text-brand-accent">
                        2 courts
                      </span>
                    )}
                  </button>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
