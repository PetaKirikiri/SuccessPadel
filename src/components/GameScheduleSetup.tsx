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
}

export function GameScheduleSetup({ value, onChange }: Props) {
  const totals = useMemo(() => gameScheduleTotals(value), [value])

  return (
    <div className="space-y-3 rounded-lg border border-brand-border/60 bg-brand-bg-alt/35 p-3">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">
          Game setup
        </p>
        <p className="mt-1 text-xs text-brand-muted">
          Rest is at least {MIN_BREAK_MINUTES} minutes between games.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
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

      <div className="grid grid-cols-3 gap-2 text-center tabular-nums">
        <div className="rounded-md bg-brand-surface px-2 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-brand-muted">Game time</p>
          <p className="text-sm font-semibold text-brand-primary">{totals.gameTime}m</p>
        </div>
        <div className="rounded-md bg-brand-surface px-2 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-brand-muted">Rest time</p>
          <p className="text-sm font-semibold text-brand-primary">{totals.restTime}m</p>
        </div>
        <div className="rounded-md bg-brand-surface px-2 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-brand-muted">Event</p>
          <p className="text-sm font-semibold text-brand-primary">{totals.eventMinutes}m</p>
        </div>
      </div>
      <p className="text-center text-[11px] text-brand-muted tabular-nums">
        {totals.playMinutes}m play · {totals.leadInMinutes}m before game 1
      </p>
    </div>
  )
}
