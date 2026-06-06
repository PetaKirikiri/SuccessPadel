import { useMemo, useState } from 'react'
import type { Profile } from '../lib/types'

type Props = {
  profiles: Profile[]
  selected: string[]
  onChange: (ids: string[]) => void
  max?: number
}

export function PlayerRosterPicker({ profiles, selected, onChange, max = 16 }: Props) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return profiles
    return profiles.filter((p) => p.display_name.toLowerCase().includes(q))
  }, [profiles, query])

  const toggle = (id: string) => {
    if (selected.includes(id)) onChange(selected.filter((x) => x !== id))
    else if (selected.length < max) onChange([...selected, id])
  }

  return (
    <div className="space-y-2">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search players…"
        className="brand-input py-2 text-xs"
      />
      <ul className="max-h-40 space-y-0.5 overflow-y-auto rounded-xl border border-brand-border p-1">
        {filtered.map((p) => {
          const checked = selected.includes(p.id)
          const disabled = !checked && selected.length >= max
          return (
            <li key={p.id}>
              <label
                className={`flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 ${
                  disabled ? 'opacity-40' : 'hover:bg-brand-bg-alt'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disabled}
                  onChange={() => toggle(p.id)}
                  className="accent-brand-accent"
                />
                <span className="text-sm">{p.display_name}</span>
              </label>
            </li>
          )
        })}
        {filtered.length === 0 && (
          <li className="game-subtle px-2 py-3 text-center text-xs">No players found</li>
        )}
      </ul>
      <p className="text-[10px] text-brand-muted">
        {selected.length}/{max} selected
      </p>
    </div>
  )
}
