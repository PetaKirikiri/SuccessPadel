import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import type { GameSession, Profile, RecordMatchPlayer } from '../lib/types'

type Parsed = {
  score_summary: string
  winner_team: 'a' | 'b'
  players: { profile_id: string; team: 'a' | 'b'; is_winner: boolean }[]
}

export function MatchNew() {
  const [params] = useSearchParams()
  const sessionId = params.get('session')
  const navigate = useNavigate()
  const [, setSession] = useState<GameSession | null>(null)
  const [roster, setRoster] = useState<Profile[]>([])
  const [text, setText] = useState('')
  const [preview, setPreview] = useState<Parsed | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!sessionId) return
    void Promise.all([
      supabase.from('game_sessions').select('*').eq('id', sessionId).single(),
      supabase
        .from('session_players')
        .select('profile_id, profiles(*)')
        .eq('session_id', sessionId),
    ]).then(([s, r]) => {
      setSession(s.data as GameSession)
      setRoster(
        (r.data ?? [])
          .map((row) => {
            const prof = row.profiles as Profile | Profile[] | null
            return Array.isArray(prof) ? prof[0] : prof
          })
          .filter((p): p is Profile => Boolean(p)),
      )
    })
  }, [sessionId])

  const parse = async () => {
    setBusy(true)
    setError(null)
    const { data, error: err } = await supabase.functions.invoke('parse-match', {
      body: { session_id: sessionId, text, roster: roster.map((p) => ({ id: p.id, name: p.display_name })) },
    })
    setBusy(false)
    if (err) setError(err.message)
    else if (data?.error) setError(data.error)
    else setPreview(data as Parsed)
  }

  const confirm = async () => {
    if (!preview || !sessionId) return
    setBusy(true)
    const players: RecordMatchPlayer[] = preview.players.map((p) => ({
      profile_id: p.profile_id,
      team: p.team,
      is_winner: p.is_winner,
    }))
    const { error: err } = await supabase.rpc('record_match', {
      p_session_id: sessionId,
      p_score_summary: preview.score_summary,
      p_players: players,
    })
    setBusy(false)
    if (err) setError(err.message)
    else navigate('/week')
  }

  if (!sessionId) return <p className="text-sm text-zinc-500">Missing session.</p>

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">GPT match entry</h2>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="e.g. Team A: Sam + Jo beat Alex + Lee 6-4 7-5"
        className="h-28 w-full rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm"
        aria-label="Match description"
      />
      <button
        type="button"
        disabled={busy || !text}
        onClick={() => void parse()}
        className="w-full rounded-lg border border-zinc-300 py-2 text-sm"
      >
        Preview
      </button>
      {preview && (
        <div className="rounded-xl border border-zinc-200 p-3 text-sm">
          <p className="font-medium">{preview.score_summary}</p>
          <ul className="mt-2 space-y-1 text-zinc-600">
            {preview.players.map((p) => {
              const name = roster.find((r) => r.id === p.profile_id)?.display_name ?? p.profile_id
              return (
                <li key={p.profile_id}>
                  {name} · team {p.team.toUpperCase()}
                  {p.is_winner ? ' ✓' : ''}
                </li>
              )
            })}
          </ul>
          <button
            type="button"
            disabled={busy}
            onClick={() => void confirm()}
            className="mt-3 w-full rounded-lg brand-btn py-2 text-sm font-medium"
          >
            Confirm & save
          </button>
        </div>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
