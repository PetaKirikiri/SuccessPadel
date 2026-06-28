import { useCallback, useEffect, useState } from 'react'
import type { LeaderboardEntry } from '../lib/leaderboardTypes'
import {
  DEFAULT_LEADERBOARD_FILTERS,
  leaderboardFiltersToRpc,
} from '../lib/leaderboardFilters'
import { normalizeLeaderboardEntries } from '../lib/leaderboardEntries'
import { supabase } from '../lib/supabaseClient'

export type SeasonLeaderboardMeta = {
  id: string
  name: string
  starts_on: string
  ends_on: string | null
  weeks_total: number
  weeks_left: number
}

type SeasonLeaderboardPayload = {
  season: SeasonLeaderboardMeta
  leaderboard: LeaderboardEntry[]
  has_live_competition: boolean
}

export function useSeasonLeaderboard(enabled = true, filters = DEFAULT_LEADERBOARD_FILTERS) {
  const [season, setSeason] = useState<SeasonLeaderboardMeta | null>(null)
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [hasLiveCompetition, setHasLiveCompetition] = useState(false)
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async (silent = false) => {
    if (!enabled) return
    if (!silent) setLoading(true)
    setError(null)
    try {
      const { data, error: rpcErr } = await supabase.rpc('get_season_competition_leaderboard', {
        ...leaderboardFiltersToRpc(filters),
      })
      if (rpcErr) throw new Error(rpcErr.message)

      const payload = data as SeasonLeaderboardPayload | null
      if (!payload?.season) {
        setSeason(null)
        setEntries([])
        setHasLiveCompetition(false)
        return
      }

      setSeason(payload.season)
      setHasLiveCompetition(Boolean(payload.has_live_competition))
      setEntries(normalizeLeaderboardEntries(payload.leaderboard ?? []))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load leaderboard')
      setSeason(null)
      setEntries([])
    } finally {
      if (!silent) setLoading(false)
    }
  }, [enabled, filters])

  useEffect(() => {
    if (!enabled) {
      setLoading(false)
      return
    }
    void refresh()
  }, [enabled, refresh])

  useEffect(() => {
    if (!enabled || !hasLiveCompetition) return
    const poll = setInterval(() => void refresh(true), 5000)
    return () => clearInterval(poll)
  }, [enabled, hasLiveCompetition, refresh])

  return { season, entries, loading, error, refresh }
}
