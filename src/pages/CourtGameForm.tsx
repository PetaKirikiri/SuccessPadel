import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PlayerRosterPicker } from '../components/PlayerRosterPicker'
import { fetchCourtAvailability } from '../hooks/useCourtSchedule'
import {
  buildHourBlocks,
  formatDateInput,
  formatHourLabel,
  maxConsecutiveHours,
  toIsoTimestamp,
} from '../lib/courtSchedule'
import { supabase } from '../lib/supabaseClient'
import type { Court, GameVisibility, PlayerCapMode, Profile } from '../lib/types'

function Chip({
  active,
  children,
  onClick,
  disabled,
}: {
  active: boolean
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-lg px-3 py-2 text-xs font-medium transition ${
        active
          ? 'bg-brand-accent text-white shadow-sm'
          : 'border border-brand-border bg-brand-surface text-brand-text'
      } disabled:opacity-40`}
    >
      {children}
    </button>
  )
}

export function CourtGameForm() {
  const navigate = useNavigate()
  const [courts, setCourts] = useState<Court[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [day, setDay] = useState(formatDateInput(new Date()))
  const [courtId, setCourtId] = useState('')
  const [startHour, setStartHour] = useState<number | null>(null)
  const [duration, setDuration] = useState(1)
  const [visibility, setVisibility] = useState<GameVisibility>('open')
  const [targetPlayers, setTargetPlayers] = useState(4)
  const [capMode, setCapMode] = useState<PlayerCapMode>('strict')
  const [maxPlayers, setMaxPlayers] = useState(4)
  const [samePlayersAllHours, setSamePlayersAllHours] = useState(true)
  const [allHourPlayers, setAllHourPlayers] = useState<string[]>([])
  const [slotRoster, setSlotRoster] = useState<Record<number, string[]>>({})
  const [availableHours, setAvailableHours] = useState<number[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void Promise.all([
      supabase.from('courts').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('profiles').select('*').order('display_name'),
    ]).then(([c, p]) => {
      const courtRows = (c.data as Court[]) ?? []
      setCourts(courtRows)
      setProfiles((p.data as Profile[]) ?? [])
      if (courtRows[0]) setCourtId(courtRows[0].id)
    })
  }, [])

  useEffect(() => {
    if (!courtId || !day) return
    void fetchCourtAvailability(day, courtId).then((hours) => {
      setAvailableHours(hours)
      setStartHour((prev) => (prev !== null && hours.includes(prev) ? prev : (hours[0] ?? null)))
    })
  }, [courtId, day])

  const maxDuration = useMemo(() => {
    if (startHour === null) return 1
    return maxConsecutiveHours(startHour, availableHours)
  }, [startHour, availableHours])

  useEffect(() => {
    if (duration > maxDuration) setDuration(maxDuration)
  }, [duration, maxDuration])

  const hourBlocks = useMemo(() => {
    if (startHour === null) return []
    const start = new Date(toIsoTimestamp(day, startHour))
    return buildHourBlocks(start, duration)
  }, [day, startHour, duration])

  const setSlotPlayers = (index: number, ids: string[]) => {
    setSlotRoster((prev) => ({ ...prev, [index]: ids.slice(0, 4) }))
  }

  const save = async (openAfter: boolean) => {
    if (!courtId || startHour === null) return
    setBusy(true)
    setError(null)

    const slotPlayersPayload = hourBlocks.map((b) => ({
      slot_index: b.index,
      profile_ids: samePlayersAllHours ? allHourPlayers.slice(0, 4) : (slotRoster[b.index] ?? []),
    }))

    const { error: rpcError } = await supabase.rpc('create_court_game', {
      p_court_id: courtId,
      p_starts_at: toIsoTimestamp(day, startHour),
      p_duration_hours: duration,
      p_visibility: visibility,
      p_target_players: targetPlayers,
      p_player_cap_mode: capMode,
      p_max_players: capMode === 'strict' ? maxPlayers : null,
      p_status: openAfter ? 'open' : 'draft',
      p_slot_players: slotPlayersPayload,
    })

    setBusy(false)
    if (rpcError) {
      setError(rpcError.message)
      return
    }
    navigate('/fun')
  }

  const canSave = courtId && startHour !== null && !busy

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div data-scroll-y className="scroll-y min-h-0 flex-1 space-y-3 pb-24">
        <div className="flex items-center justify-between">
          <Link to="/fun" className="text-sm font-medium text-brand-accent">
            ← Back
          </Link>
          <span className="text-xs font-semibold uppercase tracking-wide text-brand-muted">New game</span>
        </div>

        <section className="game-card space-y-3">
          <label className="block space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">Day</span>
            <input
              type="date"
              value={day}
              onChange={(e) => setDay(e.target.value)}
              className="brand-input"
            />
          </label>

          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">Court</span>
            <div className="grid grid-cols-4 gap-1.5">
              {courts.map((c) => (
                <Chip key={c.id} active={courtId === c.id} onClick={() => setCourtId(c.id)}>
                  {c.name.replace('Court ', 'C')}
                </Chip>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">Start</span>
            {availableHours.length === 0 ? (
              <p className="game-subtle text-xs">No free slots on this court.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {availableHours.map((h) => (
                  <Chip key={h} active={startHour === h} onClick={() => setStartHour(h)}>
                    {formatHourLabel(h)}
                  </Chip>
                ))}
              </div>
            )}
          </div>

          {startHour !== null && (
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">Hours</span>
              <div className="flex flex-wrap gap-1.5">
                {Array.from({ length: maxDuration }, (_, i) => i + 1).map((h) => (
                  <Chip key={h} active={duration === h} onClick={() => setDuration(h)}>
                    {h}h
                  </Chip>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="game-card space-y-3">
          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">Visibility</span>
            <div className="flex gap-1.5">
              <Chip active={visibility === 'open'} onClick={() => setVisibility('open')}>
                Open
              </Chip>
              <Chip active={visibility === 'private'} onClick={() => setVisibility('private')}>
                Private
              </Chip>
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">Players</span>
            <div className="flex flex-wrap gap-1.5">
              {[4, 8, 12].map((n) => (
                <Chip
                  key={n}
                  active={targetPlayers === n}
                  onClick={() => {
                    setTargetPlayers(n)
                    if (capMode === 'strict') setMaxPlayers(n)
                  }}
                >
                  {n}
                </Chip>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">Cap</span>
            <div className="flex gap-1.5">
              <Chip
                active={capMode === 'strict'}
                onClick={() => {
                  setCapMode('strict')
                  setMaxPlayers(targetPlayers)
                }}
              >
                Strict
              </Chip>
              <Chip active={capMode === 'flexible'} onClick={() => setCapMode('flexible')}>
                Flexible
              </Chip>
            </div>
          </div>

          {capMode === 'strict' && (
            <label className="block space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">Max</span>
              <input
                type="number"
                min={targetPlayers}
                max={16}
                value={maxPlayers}
                onChange={(e) => setMaxPlayers(Number(e.target.value))}
                className="brand-input"
              />
            </label>
          )}
        </section>

        {hourBlocks.length > 0 && (
          <section className="game-card space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">
                Roster
              </span>
              <label className="flex items-center gap-1.5 text-xs text-brand-text">
                <input
                  type="checkbox"
                  checked={samePlayersAllHours}
                  onChange={(e) => setSamePlayersAllHours(e.target.checked)}
                  className="accent-brand-accent"
                />
                Same all hours
              </label>
            </div>

            {samePlayersAllHours ? (
              <PlayerRosterPicker
                profiles={profiles}
                selected={allHourPlayers}
                onChange={setAllHourPlayers}
                max={4}
              />
            ) : (
              <div className="space-y-3">
                {hourBlocks.map((block) => (
                  <div key={block.index} className="rounded-xl border border-brand-border p-2">
                    <p className="mb-2 text-xs font-medium text-brand-primary">{block.label}</p>
                    <PlayerRosterPicker
                      profiles={profiles}
                      selected={slotRoster[block.index] ?? []}
                      onChange={(ids) => setSlotPlayers(block.index, ids)}
                      max={4}
                    />
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      <div className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 border-t border-brand-border bg-brand-surface/95 px-4 py-3 backdrop-blur-md">
        <div className="mx-auto flex max-w-lg gap-2">
          <button
            type="button"
            disabled={!canSave}
            onClick={() => void save(false)}
            className="brand-btn-outline flex-1 text-sm"
          >
            Draft
          </button>
          <button
            type="button"
            disabled={!canSave}
            onClick={() => void save(true)}
            className="brand-btn flex-[2] text-sm font-semibold"
          >
            Open game
          </button>
        </div>
      </div>
    </div>
  )
}
