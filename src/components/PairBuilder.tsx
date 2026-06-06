import type { Profile } from '../lib/types'

export type PairDraft = {
  pair_label?: string
  player_a_id: string
  player_b_id: string
}

type Props = {
  roster: Profile[]
  pairs: PairDraft[]
  onChange: (pairs: PairDraft[]) => void
}

export function PairBuilder({ roster, pairs, onChange }: Props) {
  const add = () => {
    if (roster.length < 2) return
    onChange([
      ...pairs,
      { player_a_id: roster[0].id, player_b_id: roster[1]?.id ?? roster[0].id },
    ])
  }

  const update = (i: number, patch: Partial<PairDraft>) => {
    const next = [...pairs]
    next[i] = { ...next[i], ...patch }
    onChange(next)
  }

  const remove = (i: number) => onChange(pairs.filter((_, j) => j !== i))

  return (
    <div className="space-y-2">
      {pairs.map((pair, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-2">
          <input
            placeholder="Pair name"
            value={pair.pair_label ?? ''}
            onChange={(e) => update(i, { pair_label: e.target.value })}
            className="w-24 rounded border border-zinc-200 bg-white px-2 py-1 text-sm"
          />
          <select
            value={pair.player_a_id}
            onChange={(e) => update(i, { player_a_id: e.target.value })}
            className="rounded border border-zinc-200 bg-white px-2 py-1 text-sm"
          >
            {roster.map((p) => (
              <option key={p.id} value={p.id}>
                {p.display_name}
              </option>
            ))}
          </select>
          <span className="text-zinc-500">+</span>
          <select
            value={pair.player_b_id}
            onChange={(e) => update(i, { player_b_id: e.target.value })}
            className="rounded border border-zinc-200 bg-white px-2 py-1 text-sm"
          >
            {roster.map((p) => (
              <option key={p.id} value={p.id}>
                {p.display_name}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => remove(i)} className="text-xs text-red-600">
            Remove
          </button>
        </div>
      ))}
      <button type="button" onClick={add} className="text-sm brand-link">
        Add pair
      </button>
    </div>
  )
}
