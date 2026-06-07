import { useEffect, useRef, useState } from 'react'

type Props = {
  count: number
  slots: string[]
  onChange: (slots: string[]) => void
  disabled?: boolean
}

function padSlots(slots: string[], count: number): string[] {
  const next = slots.slice(0, count)
  while (next.length < count) next.push('')
  return next
}

function slotsEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  return a.every((value, i) => value === b[i])
}

export function CompetitionPlayerSlots({ count, slots, onChange, disabled }: Props) {
  const [local, setLocal] = useState(() => padSlots(slots, count))
  const editingRef = useRef(false)

  useEffect(() => {
    if (!editingRef.current) setLocal(padSlots(slots, count))
  }, [slots, count])

  const commit = (next: string[]) => {
    const padded = padSlots(next, count)
    if (!slotsEqual(padded, padSlots(slots, count))) onChange(padded)
  }

  return (
    <div className="space-y-2">
      <p className="text-[10px] text-brand-muted">Enter names in rank order — strongest first.</p>
      <div className="grid grid-cols-2 gap-x-2 gap-y-1">
        {Array.from({ length: count }, (_, index) => (
          <div key={index} className="flex min-w-0 items-center gap-1">
            <span className="w-4 shrink-0 text-[10px] tabular-nums text-brand-muted">
              {index + 1}
            </span>
            <input
              type="text"
              value={local[index] ?? ''}
              disabled={disabled}
              onChange={(e) => {
                const value = e.target.value
                setLocal((prev) => {
                  const next = [...prev]
                  while (next.length < count) next.push('')
                  next[index] = value
                  return next
                })
              }}
              onFocus={() => {
                editingRef.current = true
              }}
              onBlur={() => {
                editingRef.current = false
                setLocal((prev) => {
                  const padded = padSlots(prev, count)
                  commit(padded)
                  return padded
                })
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur()
              }}
              className="brand-input min-w-0 flex-1 py-1 text-sm"
              placeholder="Name"
            />
          </div>
        ))}
      </div>
    </div>
  )
}
