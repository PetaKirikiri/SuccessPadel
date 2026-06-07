type Props = {
  count: number
  slots: string[]
  onChange: (slots: string[]) => void
  disabled?: boolean
}

export function CompetitionPlayerSlots({ count, slots, onChange, disabled }: Props) {
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
              value={slots[index] ?? ''}
              disabled={disabled}
              onChange={(e) => {
                const next = [...slots]
                while (next.length < count) next.push('')
                next[index] = e.target.value
                onChange(next)
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
