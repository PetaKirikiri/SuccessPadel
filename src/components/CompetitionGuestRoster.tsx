import { useCallback, useEffect, useRef, useState } from 'react'
import { competitionJoinUrl } from '../lib/siteUrl'
import { rosterLabel } from '../lib/playerCaps'
import { sortRosterByRank } from '../lib/rankedSchedule'
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

function slotsFromRoster(roster: CompetitionPlayer[], slotCount: number): string[] {
  const sorted = sortRosterByRank(roster)
  return Array.from({ length: slotCount }, (_, i) =>
    sorted[i] ? rosterDisplayName(sorted[i]) : '',
  )
}

function slotsEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  return a.every((value, i) => value.trim() === b[i].trim())
}

export function CompetitionGuestRoster({ sessionId, session, roster, isAdmin, onRefresh }: Props) {
  const slotCount = session.target_players ?? session.max_players ?? 12
  const [slots, setSlots] = useState<string[]>(() => Array(slotCount).fill(''))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [swapFrom, setSwapFrom] = useState<number | null>(null)
  const [copiedJoin, setCopiedJoin] = useState(false)
  const slotsRef = useRef(slots)
  const editingRef = useRef(false)

  slotsRef.current = slots

  const rosterCount = roster.length
  const target = session.target_players ?? session.max_players ?? null
  const spots =
    target != null
      ? rosterLabel(rosterCount, target, session.player_cap_mode === 'flexible')
      : String(rosterCount)
  const canManageRoster =
    isAdmin && session.status === 'open' && !session.competition_started_at
  useEffect(() => {
    if (editingRef.current || busy) return
    setSlots(slotsFromRoster(roster, slotCount))
  }, [roster, slotCount, busy])

  const saveSlots = useCallback(
    async (next: string[]) => {
      if (!canManageRoster) return
      const trimmed = next.map((s) => s.trim())
      const current = slotsFromRoster(roster, slotCount).map((s) => s.trim())
      if (slotsEqual(trimmed, current)) return

      setBusy(true)
      setError(null)
      const { error: err } = await supabase.rpc('sync_competition_roster_slots', {
        p_session_id: sessionId,
        p_names: trimmed,
      })
      setBusy(false)
      if (err) setError(err.message)
      else onRefresh()
    },
    [canManageRoster, roster, sessionId, slotCount, onRefresh],
  )

  const handleSlotBlur = () => {
    editingRef.current = false
    void saveSlots(slotsRef.current)
  }

  const swapSlots = (from: number, to: number) => {
    setSlots((prev) => {
      const next = [...prev]
      ;[next[from], next[to]] = [next[to], next[from]]
      return next
    })
    setSwapFrom(null)
  }

  const handlePlayerTap = (index: number) => {
    if (!canManageRoster || busy) return
    if (swapFrom === null) {
      setSwapFrom(index)
      return
    }
    if (swapFrom === index) {
      setSwapFrom(null)
      return
    }
    swapSlots(swapFrom, index)
  }

  return (
    <div className="game-card space-y-2 px-3 py-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">Players</p>
        <span className="text-xs text-brand-muted">{spots}</span>
      </div>
      {canManageRoster && (
        <>
          <p className="text-[10px] text-brand-muted">
            Tap two players to swap rank. Double-tap a name to edit.
          </p>
          <div className="rounded-lg border border-brand-border/60 bg-brand-surface/50 px-2 py-2">
            <p className="text-[10px] text-brand-muted">
              Send players this link to add themselves (name or LINE sign-in):
            </p>
            <p className="mt-1 break-all text-[10px] text-brand-accent">
              {competitionJoinUrl(sessionId)}
            </p>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(competitionJoinUrl(sessionId)).then(() => {
                  setCopiedJoin(true)
                  setTimeout(() => setCopiedJoin(false), 2000)
                })
              }}
              className="mt-1 text-[10px] font-semibold text-brand-primary underline"
            >
              {copiedJoin ? 'Copied' : 'Copy sign-up link'}
            </button>
          </div>
        </>
      )}
      <div className="grid grid-cols-2 gap-x-2 gap-y-1">
        {slots.map((name, index) => (
          <div key={index} className="flex min-w-0 items-center gap-1">
            <span className="w-4 shrink-0 text-[10px] tabular-nums text-brand-muted">
              {index + 1}
            </span>
            {canManageRoster ? (
              <input
                type="text"
                value={name}
                disabled={busy}
                onChange={(e) => {
                  setSwapFrom(null)
                  const value = e.target.value
                  setSlots((prev) => {
                    const next = [...prev]
                    next[index] = value
                    return next
                  })
                }}
                onMouseDown={(e) => {
                  if (!canManageRoster || busy) return
                  if (editingRef.current && document.activeElement === e.currentTarget) return
                  e.preventDefault()
                  handlePlayerTap(index)
                }}
                onDoubleClick={(e) => {
                  e.preventDefault()
                  setSwapFrom(null)
                  editingRef.current = true
                  e.currentTarget.focus()
                  e.currentTarget.select()
                }}
                onFocus={() => {
                  editingRef.current = true
                }}
                onBlur={handleSlotBlur}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur()
                  if (e.key === 'Escape') setSwapFrom(null)
                }}
                className={`brand-input min-w-0 flex-1 py-1 text-sm ${
                  swapFrom === index ? 'ring-2 ring-brand-accent' : ''
                }`}
                placeholder="Name"
              />
            ) : (
              <span className="min-w-0 flex-1 truncate py-1 text-sm text-brand-text">
                {name || '—'}
              </span>
            )}
          </div>
        ))}
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
