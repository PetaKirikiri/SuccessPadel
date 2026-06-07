import { useState } from 'react'

type Props = {
  count: number
  slots: string[]
  onChange: (slots: string[]) => void
  disabled?: boolean
}

export function CompetitionPlayerSlots({ count, slots, onChange, disabled }: Props) {
  const [swapFrom, setSwapFrom] = useState<number | null>(null)

  const swap = (from: number, to: number) => {
    const next = [...slots]
    ;[next[from], next[to]] = [next[to], next[from]]
    onChange(next)
    setSwapFrom(null)
  }

  const handleTap = (index: number) => {
    if (disabled) return
    if (swapFrom === null) {
      setSwapFrom(index)
      return
    }
    if (swapFrom === index) {
      setSwapFrom(null)
      return
    }
    swap(swapFrom, index)
  }

  return (
    <div className="space-y-2">
      <p className="text-[10px] text-brand-muted">
        Tap two players to swap rank. Double-tap a name to edit.
      </p>
      <div className="grid grid-cols-2 gap-x-2 gap-y-1">
        {Array.from({ length: count }, (_, index) => (
          <div key={index} className="flex min-w-0 items-center gap-1">
            <span className="w-4 shrink-0 text-[10px] tabular-nums text-brand-muted">
              {index + 1}
            </span>
            <input
              type="text"
              value={slots[index] ?? ''}
              disabled={disabled}
              onChange={(e) => {
                setSwapFrom(null)
                const next = [...slots]
                while (next.length < count) next.push('')
                next[index] = e.target.value
                onChange(next)
              }}
              onMouseDown={(e) => {
                if (disabled) return
                if (document.activeElement === e.currentTarget) return
                e.preventDefault()
                handleTap(index)
              }}
              onDoubleClick={(e) => {
                e.preventDefault()
                setSwapFrom(null)
                e.currentTarget.focus()
                e.currentTarget.select()
              }}
              className={`brand-input min-w-0 flex-1 py-1 text-sm ${
                swapFrom === index ? 'ring-2 ring-brand-accent' : ''
              }`}
              placeholder="Name"
            />
          </div>
        ))}
      </div>
    </div>
  )
}
