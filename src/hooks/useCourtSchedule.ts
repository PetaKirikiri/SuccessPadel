import { useCallback, useEffect, useState } from 'react'
import { bangkokHour } from '../lib/courtSchedule'
import { supabase } from '../lib/supabaseClient'
import type { Court, CourtScheduleCell, GameSession, GameSlot, SlotPlayer } from '../lib/types'

type SlotRow = GameSlot & {
  game_sessions: GameSession & { courts: Court | null }
  slot_players: (SlotPlayer & { profiles: { display_name: string } | null })[]
}

export function useCourtSchedule(day: string) {
  const [courts, setCourts] = useState<Court[]>([])
  const [cells, setCells] = useState<CourtScheduleCell[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    const dayStart = `${day}T00:00:00+07:00`
    const dayEnd = `${day}T23:59:59+07:00`

    const [{ data: courtRows }, { data: slotRows }] = await Promise.all([
      supabase.from('courts').select('*').eq('is_active', true).order('sort_order'),
      supabase
        .from('game_slots')
        .select(
          `*, game_sessions!inner(*, courts(*)), slot_players(profile_id, joined_at, profiles(display_name))`,
        )
        .gte('starts_at', dayStart)
        .lte('starts_at', dayEnd)
        .order('starts_at'),
    ])

    setCourts((courtRows as Court[]) ?? [])

    const rows = (slotRows as SlotRow[]) ?? []
    const rosterByKey = new Map<string, Set<string>>()

    for (const row of rows) {
      const session = row.game_sessions
      const rosterKey = session.game_group_id ?? row.session_id
      if (!rosterByKey.has(rosterKey)) rosterByKey.set(rosterKey, new Set())
      for (const p of row.slot_players) rosterByKey.get(rosterKey)!.add(p.profile_id)
    }

    const sessionSlots = new Map<string, SlotRow[]>()
    for (const row of rows) {
      const list = sessionSlots.get(row.session_id) ?? []
      list.push(row)
      sessionSlots.set(row.session_id, list)
    }

    const built: CourtScheduleCell[] = []
    for (const row of rows) {
      const session = row.game_sessions
      if (session.game_kind !== 'court' || session.status === 'cancelled') continue
      const court = session.courts
      if (!court) continue

      const siblings = sessionSlots.get(row.session_id) ?? [row]
      const span = siblings.length
      const isSpanStart = row.slot_index === 0

      built.push({
        slot: row,
        session,
        court,
        players: row.slot_players.map((p) => ({
          slot_id: row.id,
          profile_id: p.profile_id,
          joined_at: p.joined_at,
          profiles: p.profiles ? { id: p.profile_id, display_name: p.profiles.display_name } : undefined,
        })),
        rosterCount: rosterByKey.get(session.game_group_id ?? row.session_id)?.size ?? 0,
        slotSpan: span,
        isSpanStart,
      })
    }

    setCells(built)
    setLoading(false)
  }, [day])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { courts, cells, loading, refresh }
}

export async function fetchCourtAvailability(date: string, courtId: string): Promise<number[]> {
  const { data, error } = await supabase.rpc('get_court_availability', {
    p_date: date,
    p_court_id: courtId,
  })
  if (error) return []
  return (data as { hour_start: string }[]).map((r) => bangkokHour(r.hour_start))
}
