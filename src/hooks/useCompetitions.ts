import { useCallback, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import type { GameSession, Profile } from '../lib/types'

export type CompetitionPlayer = {
  id: string
  profile_id: string | null
  guest_name: string | null
  guest_email: string | null
  profiles: Pick<Profile, 'id' | 'display_name'> | null
}

export function rosterDisplayName(sp: CompetitionPlayer): string {
  return sp.guest_name ?? sp.profiles?.display_name ?? 'Player'
}

export type CompetitionRow = GameSession & {
  session_players: CompetitionPlayer[]
}

export function useCompetitions(userId?: string) {
  const location = useLocation()
  const [rows, setRows] = useState<CompetitionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!userId) {
      setRows([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const { data, error: queryError } = await supabase
      .from('game_sessions')
      .select(
        `*,
         session_players(id, profile_id, guest_name, guest_email, profiles(id, display_name))`,
      )
      .eq('game_kind', 'competition')
      .in('status', ['open', 'locked', 'complete'])
      .order('starts_at', { ascending: true })
      .order('starts_on', { ascending: true })

    if (queryError) {
      console.error('useCompetitions', queryError.message)
      setError(queryError.message)
      setRows([])
    } else {
      setRows((data as CompetitionRow[]) ?? [])
    }
    setLoading(false)
  }, [userId])

  useEffect(() => {
    void refresh()
  }, [refresh, location.key])

  return { rows, loading, error, refresh }
}
