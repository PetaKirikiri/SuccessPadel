import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { DuosLeaderboardRow, LeaderboardRow, RankMode, Season } from '../lib/types'

export function useLeaderboard(mode: RankMode = 'solo', seasonId?: string | null) {
  const [soloRows, setSoloRows] = useState<LeaderboardRow[]>([])
  const [duosRows, setDuosRows] = useState<DuosLeaderboardRow[]>([])
  const [season, setSeason] = useState<Season | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)

    const seasonQuery = seasonId
      ? supabase.from('seasons').select('*').eq('id', seasonId).maybeSingle()
      : supabase.from('seasons').select('*').eq('is_active', true).maybeSingle()

    const [seasonRes, solo, duos] = await Promise.all([
      seasonQuery,
      supabase.rpc('get_leaderboard', { p_season_id: seasonId ?? null }),
      supabase.rpc('get_duos_leaderboard', { p_season_id: seasonId ?? null }),
    ])

    if (seasonRes.error) setError(seasonRes.error.message)
    else setSeason((seasonRes.data as Season | null) ?? null)

    if (solo.error) setError(solo.error.message)
    else setSoloRows((solo.data as LeaderboardRow[]) ?? [])

    if (duos.error && !solo.error) setError(duos.error.message)
    else setDuosRows((duos.data as DuosLeaderboardRow[]) ?? [])

    setLoading(false)
  }, [seasonId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return {
    mode,
    season,
    soloRows,
    duosRows,
    rows: mode === 'solo' ? soloRows : duosRows,
    loading,
    error,
    refresh,
  }
}
