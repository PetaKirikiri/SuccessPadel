import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { formatClubTime } from '../lib/courtSchedule'
import {
  canJoinGame,
  canJoinSlot,
  capModeLabel,
  isOverflow,
  rosterLabel,
} from '../lib/playerCaps'
import { supabase } from '../lib/supabaseClient'
import type { Court, CourtScheduleCell, GameSession, GameSlot, PlayerCapMode } from '../lib/types'

type Props = {
  cell: CourtScheduleCell | null
  courts: Court[]
  userId: string | undefined
  isAdmin: boolean
  onClose: () => void
  onUpdated: () => void
}

type SlotWithPlayers = GameSlot & {
  slot_players: { profile_id: string; profiles: { display_name: string } | null }[]
  slot_court_assignments: {
    court_id: string
    profile_id: string
    courts: { name: string } | null
    profiles: { display_name: string } | null
  }[]
}

export function GameDetailSheet({ cell, courts, userId, isAdmin, onClose, onUpdated }: Props) {
  const [slots, setSlots] = useState<SlotWithPlayers[]>([])
  const [session, setSession] = useState<GameSession | null>(null)
  const [busy, setBusy] = useState(false)
  const [expandCourtId, setExpandCourtId] = useState('')
  const [capMode, setCapMode] = useState<PlayerCapMode>('strict')
  const [maxPlayers, setMaxPlayers] = useState(4)
  const [message, setMessage] = useState<string | null>(null)

  const loadSlots = useCallback(() => {
    if (!cell) return
    setSession(cell.session)
    setCapMode(cell.session.player_cap_mode ?? 'strict')
    setMaxPlayers(cell.session.max_players ?? cell.session.target_players ?? 4)
    void supabase
      .from('game_slots')
      .select(
        `*, slot_players(profile_id, profiles(display_name)),
         slot_court_assignments(court_id, profile_id, courts(name), profiles(display_name))`,
      )
      .eq('session_id', cell.session.id)
      .order('slot_index')
      .then(({ data }) => setSlots((data as SlotWithPlayers[]) ?? []))
  }, [cell])

  useEffect(() => {
    loadSlots()
  }, [loadSlots])

  const rosterCount = useMemo(() => {
    const ids = new Set<string>()
    for (const slot of slots) {
      for (const p of slot.slot_players) ids.add(p.profile_id)
    }
    return ids.size
  }, [slots])

  if (!cell || !session) return null

  const target = session.target_players ?? 4
  const flexible = session.player_cap_mode === 'flexible'
  const overflow = isOverflow(rosterCount, target)

  const joinSlot = async (slotId: string, slotPlayerCount: number) => {
    if (!canJoinGame(session, rosterCount) || !canJoinSlot(slotPlayerCount)) return
    setBusy(true)
    const { error } = await supabase.rpc('join_game_slot', { p_slot_id: slotId })
    setBusy(false)
    if (error) setMessage(error.message)
    else {
      setMessage(null)
      loadSlots()
      onUpdated()
      if (session.game_group_id) {
        void supabase.rpc('apply_group_rotation', { p_session_id: session.id })
      }
    }
  }

  const expand = async () => {
    if (!expandCourtId) return
    setBusy(true)
    const { error } = await supabase.rpc('expand_game_to_two_courts', {
      p_session_id: session.id,
      p_second_court_id: expandCourtId,
    })
    setBusy(false)
    if (error) setMessage(error.message)
    else {
      setMessage('Expanded to two courts with rotation')
      onUpdated()
      onClose()
    }
  }

  const saveCap = async () => {
    setBusy(true)
    const payload = {
      player_cap_mode: capMode,
      max_players: capMode === 'strict' ? maxPlayers : null,
    }
    const q = supabase.from('game_sessions').update(payload).eq('id', session.id)
    if (session.game_group_id) {
      await supabase.from('game_sessions').update(payload).eq('game_group_id', session.game_group_id)
    } else {
      await q
    }
    setBusy(false)
    setMessage('Player cap updated')
    onUpdated()
  }

  const rotate = async () => {
    setBusy(true)
    const { error } = await supabase.rpc('apply_group_rotation', { p_session_id: session.id })
    setBusy(false)
    if (error) setMessage(error.message)
    else {
      setMessage('Rotation applied')
      loadSlots()
    }
  }

  const otherCourts = courts.filter((c) => c.id !== cell.court.id)

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4">
      <div
        data-scroll-y
        className="scroll-y max-h-[80dvh] w-full max-w-md rounded-2xl bg-brand-surface p-4 shadow-lg"
      >
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <h3 className="game-heading">{session.title}</h3>
            <p className="game-subtle mt-1">
              {cell.court.name} ·{' '}
              <span className={overflow ? 'font-semibold text-brand-accent' : ''}>
                {rosterLabel(rosterCount, target, flexible)}
              </span>{' '}
              · {capModeLabel(session.player_cap_mode)} · {session.visibility}
            </p>
            {session.game_group_id && (
              <p className="mt-1 text-xs font-medium text-brand-accent">2-court rotation</p>
            )}
          </div>
          <button type="button" onClick={onClose} className="text-brand-muted text-sm">
            Close
          </button>
        </div>

        <ul className="space-y-2">
          {slots.map((slot) => {
            const joined = slot.slot_players.some((p) => p.profile_id === userId)
            const canJoin =
              session.visibility === 'open' &&
              session.status === 'open' &&
              !joined &&
              canJoinGame(session, rosterCount) &&
              canJoinSlot(slot.slot_players.length)

            return (
              <li key={slot.id} className="game-card py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">
                    {formatClubTime(new Date(slot.starts_at))} –{' '}
                    {formatClubTime(new Date(slot.ends_at))}
                  </span>
                  <span className="text-xs text-brand-muted">
                    {slot.slot_players.length}/4 on court
                  </span>
                </div>
                {slot.slot_court_assignments.length > 0 ? (
                  <div className="mt-1 space-y-1 text-xs text-brand-muted">
                    {Object.entries(
                      slot.slot_court_assignments.reduce<Record<string, string[]>>((acc, a) => {
                        const court = a.courts?.name ?? 'Court'
                        acc[court] = acc[court] ?? []
                        acc[court].push(a.profiles?.display_name ?? 'Player')
                        return acc
                      }, {}),
                    ).map(([court, names]) => (
                      <p key={court}>
                        {court}: {names.join(', ')}
                      </p>
                    ))}
                  </div>
                ) : (
                  <p className="mt-1 text-xs text-brand-muted">
                    {slot.slot_players.length === 0
                      ? 'No players yet'
                      : slot.slot_players
                          .map((p) => p.profiles?.display_name ?? 'Player')
                          .join(', ')}
                  </p>
                )}
                {canJoin && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void joinSlot(slot.id, slot.slot_players.length)}
                    className="brand-btn mt-2 px-3 py-1 text-xs"
                  >
                    Join this hour
                  </button>
                )}
              </li>
            )
          })}
        </ul>

        {isAdmin && (
          <div className="mt-4 space-y-2 border-t border-brand-border pt-3">
            <p className="text-xs font-medium text-brand-primary">Player cap</p>
            <div className="flex gap-2 text-xs">
              <label className="flex items-center gap-1">
                <input
                  type="radio"
                  checked={capMode === 'strict'}
                  onChange={() => setCapMode('strict')}
                  className="accent-brand-accent"
                />
                Strict
              </label>
              <label className="flex items-center gap-1">
                <input
                  type="radio"
                  checked={capMode === 'flexible'}
                  onChange={() => setCapMode('flexible')}
                  className="accent-brand-accent"
                />
                Flexible
              </label>
            </div>
            {capMode === 'strict' && (
              <input
                type="number"
                min={target}
                max={16}
                value={maxPlayers}
                onChange={(e) => setMaxPlayers(Number(e.target.value))}
                className="brand-input"
              />
            )}
            <button type="button" disabled={busy} onClick={() => void saveCap()} className="brand-btn-outline w-full text-xs">
              Save cap
            </button>
          </div>
        )}

        {isAdmin && !session.game_group_id && (
          <div className="mt-4 space-y-2 border-t border-brand-border pt-3">
            <p className="text-xs font-medium text-brand-primary">Expand to two courts</p>
            <select
              value={expandCourtId}
              onChange={(e) => setExpandCourtId(e.target.value)}
              className="brand-input"
            >
              <option value="">Pick second court</option>
              {otherCourts.map((c: Court) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={busy || !expandCourtId}
              onClick={() => void expand()}
              className="brand-btn w-full text-xs"
            >
              Add second court
            </button>
          </div>
        )}

        {isAdmin && session.game_group_id && (
          <button type="button" disabled={busy} onClick={() => void rotate()} className="brand-btn-outline mt-3 w-full text-xs">
            Re-apply rotation
          </button>
        )}

        <Link
          to={`/week?session=${session.id}`}
          className="brand-link mt-3 block text-center text-xs"
        >
          View matches
        </Link>

        {message && <p className="mt-2 text-xs text-brand-accent">{message}</p>}
      </div>
    </div>
  )
}
