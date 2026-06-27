import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { COMPETITION_SCHEDULE } from '../lib/competitionScheduleLayout'
import { GAME_SETUP_MIN_BREAK_MINUTES } from '../lib/gameSchedule'

export type GameScheduleSetupValues = {
  gameCount: number
  gameMinutes: number
  breakMinutes: number
}

const MIN_GAMES = 1
const MAX_GAMES = 20
const MIN_GAME_MINUTES = 5
const MAX_GAME_MINUTES = 60
export const MIN_BREAK_MINUTES = GAME_SETUP_MIN_BREAK_MINUTES
const MAX_BREAK_MINUTES = 30

function clampInt(raw: string, min: number, max: number, fallback: number): number {
  const n = parseInt(raw, 10)
  if (!Number.isFinite(n)) return fallback
  return Math.max(min, Math.min(max, n))
}

function ScheduleNumberInput({
  label,
  value,
  min,
  max,
  fallback,
  onCommit,
}: {
  label: string
  value: number
  min: number
  max: number
  fallback: number
  onCommit: (n: number) => void
}) {
  const [text, setText] = useState(String(value))
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (!focused) setText(String(value))
  }, [value, focused])

  const commit = (raw: string) => {
    const trimmed = raw.trim()
    if (!trimmed) {
      setText(String(value))
      return
    }
    const next = clampInt(trimmed, min, max, fallback)
    onCommit(next)
    setText(String(next))
  }

  return (
    <label className="block min-w-0 space-y-1">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">
        {label}
      </span>
      <input
        type="number"
        min={min}
        max={max}
        value={text}
        onChange={(e: ChangeEvent<HTMLInputElement>) => setText(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false)
          commit(text)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        }}
        className="brand-input h-11"
      />
    </label>
  )
}

export function gameScheduleTotals({ gameCount, gameMinutes, breakMinutes }: GameScheduleSetupValues) {
  const restCount = Math.max(0, gameCount - 1)
  const gameTime = gameCount * gameMinutes
  const restTime = restCount * breakMinutes
  const playMinutes = gameTime + restTime
  return {
    restCount,
    gameTime,
    restTime,
    playMinutes,
    leadInMinutes: COMPETITION_SCHEDULE.leadInMinutes,
    eventMinutes: playMinutes + COMPETITION_SCHEDULE.leadInMinutes,
  }
}

type Props = {
  value: GameScheduleSetupValues
  onChange: (patch: Partial<GameScheduleSetupValues>) => void
  dateValue?: string
  onDateChange?: (value: string) => void
  startValue?: string
  endValue?: string
  onStartChange?: (value: string) => void
  onEndChange?: (value: string) => void
  windowMinutes?: number | null
}

export function GameScheduleSetup({
  value,
  onChange,
  dateValue,
  onDateChange,
  startValue,
  endValue,
  onStartChange,
  onEndChange,
  windowMinutes = null,
}: Props) {
  const totals = useMemo(() => gameScheduleTotals(value), [value])
  const showDate = Boolean(dateValue && onDateChange)
  const showWindow = Boolean(startValue && endValue && onStartChange && onEndChange)
  const gridClass = showDate && showWindow
    ? 'grid-cols-2 sm:grid-cols-6'
    : showWindow
      ? 'grid-cols-2 sm:grid-cols-5'
      : showDate
        ? 'grid-cols-2 sm:grid-cols-4'
        : 'grid-cols-3'
  const leftoverMinutes = windowMinutes == null ? null : windowMinutes - totals.playMinutes
  const fits = leftoverMinutes != null && leftoverMinutes >= 0
  const fitLabel =
    leftoverMinutes == null
      ? null
      : leftoverMinutes === 0
        ? 'Perfect fit'
        : `${leftoverMinutes > 0 ? '+' : ''}${leftoverMinutes} min`

  return (
    <div className="space-y-3 rounded-lg border border-brand-border/60 bg-brand-bg-alt/35 p-3">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">
          Game setup
        </p>
      </div>

      <div className={`grid gap-2 ${gridClass}`}>
        {showDate ? (
          <label className="block min-w-0 space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">
              Day
            </span>
            <input
              type="date"
              value={dateValue}
              onChange={(e) => onDateChange?.(e.target.value)}
              className="brand-input h-11"
            />
          </label>
        ) : null}
        {showWindow ? (
          <label className="block min-w-0 space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">
              Start
            </span>
            <input
              type="time"
              value={startValue}
              onChange={(e) => onStartChange?.(e.target.value)}
              className="brand-input h-11"
            />
          </label>
        ) : null}
        {showWindow ? (
          <label className="block min-w-0 space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">
              End
            </span>
            <input
              type="time"
              value={endValue}
              onChange={(e) => onEndChange?.(e.target.value)}
              className="brand-input h-11"
            />
          </label>
        ) : null}
        <ScheduleNumberInput
          label="Games"
          value={value.gameCount}
          min={MIN_GAMES}
          max={MAX_GAMES}
          fallback={7}
          onCommit={(gameCount) => onChange({ gameCount })}
        />
        <ScheduleNumberInput
          label="Game min"
          value={value.gameMinutes}
          min={MIN_GAME_MINUTES}
          max={MAX_GAME_MINUTES}
          fallback={14}
          onCommit={(gameMinutes) => onChange({ gameMinutes })}
        />
        <ScheduleNumberInput
          label="Rest min"
          value={value.breakMinutes}
          min={MIN_BREAK_MINUTES}
          max={MAX_BREAK_MINUTES}
          fallback={MIN_BREAK_MINUTES}
          onCommit={(breakMinutes) => onChange({ breakMinutes })}
        />
      </div>

      {fitLabel ? (
        <div
          className={`rounded-md border px-3 py-2 text-center font-display text-lg font-bold tabular-nums ${
            fits
              ? 'border-green-500/50 bg-green-50 text-green-700'
              : 'border-red-500/50 bg-red-50 text-red-700'
          }`}
        >
          {fitLabel}
        </div>
      ) : null}
    </div>
  )
}
