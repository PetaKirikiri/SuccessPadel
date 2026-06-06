import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { formatClubTime } from '../lib/courtSchedule'
import { supabase } from '../lib/supabaseClient'
import type { Court, GameSession } from '../lib/types'

type CourtSession = GameSession & { courts: Court | null }

export function AdminGames() {
  const [sessions, setSessions] = useState<CourtSession[]>([])

  const load = () => {
    void supabase
      .from('game_sessions')
      .select('*, courts(*)')
      .order('starts_at', { ascending: false, nullsFirst: false })
      .then(({ data }) => setSessions((data as CourtSession[]) ?? []))
  }

  useEffect(load, [])

  const setStatus = async (id: string, status: GameSession['status']) => {
    await supabase.from('game_sessions').update({ status }).eq('id', id)
    setSessions((s) => s.map((x) => (x.id === id ? { ...x, status } : x)))
  }

  const courtGames = sessions.filter((s) => s.game_kind === 'court')
  const competitionGames = sessions.filter((s) => s.game_kind !== 'court')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="game-heading text-xl">Manage games</h2>
        <Link to="/admin/games/new" className="brand-link text-sm">
          + Court game
        </Link>
      </div>

      <section className="space-y-2">
        <h3 className="text-sm font-medium text-brand-primary">Court bookings</h3>
        {courtGames.length === 0 ? (
          <p className="game-subtle">No court games yet.</p>
        ) : (
          <ul className="space-y-2">
            {courtGames.map((s) => (
              <li key={s.id} className="game-card p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{s.title}</p>
                    <p className="game-subtle text-xs">
                      {s.courts?.name} · {s.status} · {s.visibility} ·{' '}
                      {s.starts_at
                        ? `${formatClubTime(new Date(s.starts_at))} – ${formatClubTime(new Date(s.ends_at!))}`
                        : s.starts_on}
                      {' · '}
                      {s.target_players ?? 4} players ({s.player_cap_mode ?? 'strict'})
                    </p>
                  </div>
                  <div className="flex flex-col gap-1 text-xs">
                    {s.status === 'draft' && (
                      <button type="button" onClick={() => void setStatus(s.id, 'open')} className="brand-link">
                        Open
                      </button>
                    )}
                    {s.status === 'open' && (
                      <button type="button" onClick={() => void setStatus(s.id, 'locked')} className="text-amber-700">
                        Lock
                      </button>
                    )}
                    {s.status !== 'cancelled' && (
                      <button
                        type="button"
                        onClick={() => void setStatus(s.id, 'cancelled')}
                        className="text-red-600"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-brand-primary">Competitions</h3>
          <Link to="/admin/games/competition/new" className="brand-link text-xs">
            + Competition
          </Link>
        </div>
        {competitionGames.length === 0 ? (
          <p className="game-subtle">No competition sessions.</p>
        ) : (
          <ul className="space-y-2">
            {competitionGames.map((s) => (
              <li key={s.id} className="game-card p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{s.title}</p>
                    <p className="game-subtle text-xs">
                      {s.status} · {s.partnership_mode} · {s.starts_on} – {s.ends_on}
                    </p>
                  </div>
                  <Link to={`/admin/games/${s.id}/edit`} className="brand-link text-xs">
                    Edit
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Link to="/admin/seasons" className="game-subtle block text-sm">
        Seasons
      </Link>
    </div>
  )
}
