import { useState } from 'react'
import type { GameSession, MatchTeam, Profile, RecordMatchPlayer, SessionPair } from '../lib/types'
import { supabase } from '../lib/supabaseClient'

type Props = {
  session: GameSession
  roster: Profile[]
  pairs: SessionPair[]
  onSaved: () => void
}

type Slot = { profile_id: string; team: MatchTeam }

export function MatchForm({ session, roster, pairs, onSaved }: Props) {
  const [scoreSummary, setScoreSummary] = useState('')
  const [winnerTeam, setWinnerTeam] = useState<MatchTeam>('a')
  const [marginBonus, setMarginBonus] = useState(false)
  const [pairAId, setPairAId] = useState(pairs[0]?.id ?? '')
  const [pairBId, setPairBId] = useState(pairs[1]?.id ?? '')
  const [slots, setSlots] = useState<Slot[]>([
    { profile_id: roster[0]?.id ?? '', team: 'a' },
    { profile_id: roster[1]?.id ?? '', team: 'a' },
    { profile_id: roster[2]?.id ?? '', team: 'b' },
    { profile_id: roster[3]?.id ?? '', team: 'b' },
  ])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const applyPairs = () => {
    const a = pairs.find((p) => p.id === pairAId)
    const b = pairs.find((p) => p.id === pairBId)
    if (!a || !b || !a.player_a_id || !a.player_b_id || !b.player_a_id || !b.player_b_id) return
    setSlots([
      { profile_id: a.player_a_id, team: 'a' },
      { profile_id: a.player_b_id, team: 'a' },
      { profile_id: b.player_a_id, team: 'b' },
      { profile_id: b.player_b_id, team: 'b' },
    ])
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const players: RecordMatchPlayer[] = slots.map((s) => ({
      profile_id: s.profile_id,
      team: s.team,
      is_winner: s.team === winnerTeam,
      margin_bonus_earned: marginBonus && s.team === winnerTeam,
    }))
    const { error: err } = await supabase.rpc('record_match', {
      p_session_id: session.id,
      p_score_summary: scoreSummary,
      p_notes: null,
      p_round_number: null,
      p_players: players,
    })
    setBusy(false)
    if (err) setError(err.message)
    else {
      setScoreSummary('')
      onSaved()
    }
  }

  if (session.partnership_mode === 'fixed_pairs' && pairs.length >= 2) {
    return (
      <form onSubmit={submit} className="space-y-3 rounded-xl border border-zinc-200 p-4">
        <select
          value={pairAId}
          onChange={(e) => setPairAId(e.target.value)}
          className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm"
          aria-label="Pair A"
        >
          {pairs.map((p) => (
            <option key={p.id} value={p.id}>
              {p.pair_label ?? 'Pair'} A
            </option>
          ))}
        </select>
        <select
          value={pairBId}
          onChange={(e) => setPairBId(e.target.value)}
          className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm"
          aria-label="Pair B"
        >
          {pairs.map((p) => (
            <option key={p.id} value={p.id}>
              {p.pair_label ?? 'Pair'} B
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={applyPairs}
          className="text-sm brand-link"
        >
          Load teams
        </button>
        <ScoreFields
          scoreSummary={scoreSummary}
          setScoreSummary={setScoreSummary}
          winnerTeam={winnerTeam}
          setWinnerTeam={setWinnerTeam}
          marginBonus={marginBonus}
          setMarginBonus={setMarginBonus}
          showMargin={session.margin_bonus_enabled}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={busy || !scoreSummary}
          className="w-full rounded-lg brand-btn py-2.5 font-medium disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Log match'}
        </button>
      </form>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-zinc-200 p-4">
      {slots.map((slot, i) => (
        <div key={i} className="flex gap-2">
          <select
            value={slot.profile_id}
            onChange={(e) => {
              const next = [...slots]
              next[i] = { ...next[i], profile_id: e.target.value }
              setSlots(next)
            }}
            className="flex-1 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm"
            aria-label={`Player ${i + 1}`}
          >
            {roster.map((p) => (
              <option key={p.id} value={p.id}>
                {p.display_name}
              </option>
            ))}
          </select>
          <select
            value={slot.team}
            onChange={(e) => {
              const next = [...slots]
              next[i] = { ...next[i], team: e.target.value as MatchTeam }
              setSlots(next)
            }}
            className="rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-2 text-sm"
            aria-label={`Team ${i + 1}`}
          >
            <option value="a">A</option>
            <option value="b">B</option>
          </select>
        </div>
      ))}
      <ScoreFields
        scoreSummary={scoreSummary}
        setScoreSummary={setScoreSummary}
        winnerTeam={winnerTeam}
        setWinnerTeam={setWinnerTeam}
        marginBonus={marginBonus}
        setMarginBonus={setMarginBonus}
        showMargin={session.margin_bonus_enabled}
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={busy || !scoreSummary}
        className="w-full rounded-lg brand-btn py-2.5 font-medium disabled:opacity-50"
      >
        {busy ? 'Saving…' : 'Log match'}
      </button>
    </form>
  )
}

function ScoreFields({
  scoreSummary,
  setScoreSummary,
  winnerTeam,
  setWinnerTeam,
  marginBonus,
  setMarginBonus,
  showMargin,
}: {
  scoreSummary: string
  setScoreSummary: (v: string) => void
  winnerTeam: MatchTeam
  setWinnerTeam: (v: MatchTeam) => void
  marginBonus: boolean
  setMarginBonus: (v: boolean) => void
  showMargin: boolean
}) {
  return (
    <>
      <input
        value={scoreSummary}
        onChange={(e) => setScoreSummary(e.target.value)}
        placeholder="e.g. 6-4 6-3"
        className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm"
        aria-label="Score"
      />
      <select
        value={winnerTeam}
        onChange={(e) => setWinnerTeam(e.target.value as MatchTeam)}
        className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm"
        aria-label="Winning team"
      >
        <option value="a">Team A wins</option>
        <option value="b">Team B wins</option>
      </select>
      {showMargin && (
        <label className="flex items-center gap-2 text-sm text-zinc-600">
          <input
            type="checkbox"
            checked={marginBonus}
            onChange={(e) => setMarginBonus(e.target.checked)}
            className="accent-brand-accent"
          />
          Margin set bonus
        </label>
      )}
    </>
  )
}
