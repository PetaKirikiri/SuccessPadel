import { useState } from 'react'
import { parseGuestLines } from '../lib/guestRosterParse'
import { canJoinGame, rosterLabel } from '../lib/playerCaps'
import { supabase } from '../lib/supabaseClient'
import type { CompetitionPlayer } from '../hooks/useCompetitions'
import { rosterDisplayName } from '../hooks/useCompetitions'
import type { GameSession } from '../lib/types'

type Props = {
  sessionId: string
  session: Pick<
    GameSession,
    | 'status'
    | 'visibility'
    | 'competition_started_at'
    | 'target_players'
    | 'max_players'
    | 'player_cap_mode'
  >
  roster: CompetitionPlayer[]
  isAdmin: boolean
  onRefresh: () => void
}

export function CompetitionGuestRoster({ sessionId, session, roster, isAdmin, onRefresh }: Props) {
  const [bulkText, setBulkText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const rosterCount = roster.length
  const target = session.target_players ?? session.max_players ?? null
  const spots =
    target != null
      ? rosterLabel(rosterCount, target, session.player_cap_mode === 'flexible')
      : String(rosterCount)
  const canAdd =
    isAdmin && session.status === 'open' && !session.competition_started_at && canJoinGame(session, rosterCount)
  const guestsWithoutEmail = roster.filter((sp) => sp.guest_name && !sp.guest_email).length

  const bulkAdd = async () => {
    const guests = parseGuestLines(bulkText)
    if (guests.length === 0) return
    setBusy(true)
    setError(null)
    const { error: err } = await supabase.rpc('add_competition_guests', {
      p_session_id: sessionId,
      p_guests: guests,
    })
    setBusy(false)
    if (err) setError(err.message)
    else {
      setBulkText('')
      onRefresh()
    }
  }

  const removeGuest = async (rosterId: string) => {
    setBusy(true)
    setError(null)
    const { error: err } = await supabase.rpc('remove_competition_guest', { p_roster_id: rosterId })
    setBusy(false)
    if (err) setError(err.message)
    else onRefresh()
  }

  return (
    <div className="game-card space-y-3 px-3 py-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">Players</p>
        <span className="text-xs text-brand-muted">{spots}</span>
      </div>

      {roster.length > 0 ? (
        <ul className="m-0 list-none space-y-1 p-0">
          {roster.map((sp) => (
            <li key={sp.id} className="flex items-center justify-between gap-2 text-sm text-brand-text">
              <span>
                {rosterDisplayName(sp)}
                    {sp.guest_name && <span className="ml-1 text-xs text-brand-muted">· guest</span>}
                    {sp.guest_email && (
                      <span className="ml-1 text-xs text-brand-muted">· {sp.guest_email}</span>
                    )}
              </span>
              {isAdmin && sp.guest_name && canAdd && (
                <button
                  type="button"
                  disabled={busy}
                  className="text-xs text-brand-muted"
                  onClick={() => void removeGuest(sp.id)}
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-brand-muted">No players yet — paste names below.</p>
      )}

      {canAdd && (
        <div className="space-y-2">
          <textarea
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            placeholder={'Name, email (recommended)\nBert, bert@email.com\nBia, bia@email.com'}
            rows={5}
            className="brand-input w-full resize-none text-sm"
          />
          <button
            type="button"
            disabled={busy || !bulkText.trim()}
            onClick={() => void bulkAdd()}
            className="brand-btn w-full py-2 text-sm"
          >
            {busy ? 'Adding…' : 'Add players'}
          </button>
        </div>
      )}

      {guestsWithoutEmail > 0 && canAdd && (
        <p className="text-xs text-amber-700">
          {guestsWithoutEmail} guest{guestsWithoutEmail > 1 ? 's' : ''} without email — they cannot
          self-serve scores on their phone.
        </p>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
