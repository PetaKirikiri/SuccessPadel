import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { Season } from '../lib/types'

export function AdminSeasons() {
  const [seasons, setSeasons] = useState<Season[]>([])
  const [name, setName] = useState('')
  const [startsOn, setStartsOn] = useState('')

  const load = () => {
    void supabase
      .from('seasons')
      .select('*')
      .order('starts_on', { ascending: false })
      .then(({ data }) => setSeasons((data as Season[]) ?? []))
  }

  useEffect(load, [])

  const add = async () => {
    await supabase.from('seasons').insert({ name, starts_on: startsOn, is_active: seasons.length === 0 })
    setName('')
    setStartsOn('')
    load()
  }

  const setActive = async (id: string) => {
    await supabase.from('seasons').update({ is_active: false }).neq('id', id)
    await supabase.from('seasons').update({ is_active: true }).eq('id', id)
    load()
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Seasons</h2>
      <ul className="space-y-2">
        {seasons.map((s) => (
          <li key={s.id} className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
            <span className="text-sm">
              {s.name} {s.is_active && <span className="brand-link">· active</span>}
            </span>
            {!s.is_active && (
              <button type="button" onClick={() => void setActive(s.id)} className="text-xs brand-link">
                Set active
              </button>
            )}
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Season name"
          className="flex-1 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm"
          aria-label="Season name"
        />
        <input
          type="date"
          value={startsOn}
          onChange={(e) => setStartsOn(e.target.value)}
          className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm"
          aria-label="Starts"
        />
        <button type="button" onClick={() => void add()} className="rounded-lg brand-btn px-3 text-sm">
          Add
        </button>
      </div>
    </div>
  )
}
