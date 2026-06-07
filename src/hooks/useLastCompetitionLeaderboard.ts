import { useCallback, useEffect, useState } from 'react'
import type { LeaderboardEntry } from '../components/CompetitionLeaderboard'
import { americanoScoringUnit } from '../lib/competitionPresets'
import { normalizeLeaderboardEntries } from '../lib/leaderboardEntries'
import type { AmericanoScoringUnit } from '../lib/competitionPresets'
import type { GameSession } from '../lib/types'
import { supabase } from '../lib/supabaseClient'

type LastCompetitionPayload = {
  session: GameSession
  leaderboard: LeaderboardEntry[]
}

export function useLastCompetitionLeaderboard() {
  const [session, setSession] = useState<GameSession | null>(null)
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [scoreUnit, setScoreUnit] = useState<AmericanoScoringUnit>('points')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    setError(null)
    try {
      const { data, error: rpcErr } = await supabase.rpc('get_last_competition_leaderboard', {})
      if (rpcErr) throw new Error(rpcErr.message)

      const payload = data as LastCompetitionPayload | null
      if (!payload?.session) {
        setSession(null)
        setEntries([])
        return
      }

      setSession(payload.session)
      setScoreUnit(americanoScoringUnit(payload.session))
      setEntries(normalizeLeaderboardEntries(payload.leaderboard ?? []))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load leaderboard')
      setSession(null)
      setEntries([])
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!session?.competition_started_at || session.status === 'complete') return
    const poll = setInterval(() => void refresh(true), 5000)
    return () => clearInterval(poll)
  }, [session?.competition_started_at, session?.status, refresh])

  return { session, entries, scoreUnit, loading, error, refresh }
}
