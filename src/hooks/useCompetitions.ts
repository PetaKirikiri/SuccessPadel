import { useCallback, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import type { GameSession, Profile } from '../lib/types'
import { clubDisplayName } from '../lib/clubMemberDisplay'

export type CompetitionPlayer = {
  id: string
  profile_id: string | null
  padel_player_id: string | null
  guest_name: string | null
  guest_email: string | null
  rank_order: number | null
  profiles: Pick<Profile, 'id' | 'display_name' | 'avatar_url' | 'avatar_mode' | 'pixel_avatar'> | null
}

export function rosterDisplayName(sp: CompetitionPlayer): string {
  const fromProfile = sp.profiles?.display_name?.trim()
  if (fromProfile) {
    return clubDisplayName(sp.profile_id ?? sp.profiles?.id, fromProfile)
  }
  const guest = sp.guest_name?.trim()
  if (guest) return guest
  return 'Player'
}

export type CompetitionRow = GameSession & {
  session_players: CompetitionPlayer[]
  session_pairs?: CompetitionSessionPair[]
}

export type CompetitionSessionPair = {
  id: string
  pair_label: string | null
  roster_a_id: string | null
  roster_b_id: string | null
}

export function useCompetitions(_userId?: string) {
  const location = useLocation()
  const [rows, setRows] = useState<CompetitionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)

    const { data, error: queryError } = await supabase
      .from('game_sessions')
      .select(
        `*,
         session_players(id, profile_id, padel_player_id, guest_name, guest_email, rank_order, profiles(id, display_name, avatar_url, avatar_mode, pixel_avatar)),
         session_pairs(id, pair_label, roster_a_id, roster_b_id)`,
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
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh, location.key])

  return { rows, loading, error, refresh }
}
