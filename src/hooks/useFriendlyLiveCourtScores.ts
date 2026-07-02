import { useCallback, useEffect, useState } from 'react'
import type { AmericanoScoringUnit } from '../lib/competitionPresets'
import {
  liveCourtFeedsFromLogs,
  liveCourtScoresFromLogs,
  liveCourtScoreKeyFromSetupKey,
  type LiveCourtGamesScore,
  type LiveCourtPointFeed,
} from '../lib/liveCourtScore'
import { fetchFriendlySessionMatchLogs, type MatchGestureLog } from '../lib/matchLogServer'
import { supabase } from '../lib/supabaseClient'

export function useFriendlyLiveCourtScores(
  friendlySessionId: string | undefined,
  scoreUnit: AmericanoScoringUnit = 'games',
  pollMs = 0,
  courtSetupKeys: string[] = [],
) {
  const [scores, setScores] = useState<Map<string, LiveCourtGamesScore>>(() => new Map())
  const [feeds, setFeeds] = useState<Map<string, LiveCourtPointFeed>>(() => new Map())
  const [logs, setLogs] = useState<MatchGestureLog[]>([])

  const refresh = useCallback(async () => {
    if (!friendlySessionId) {
      setScores(new Map())
      setFeeds(new Map())
      setLogs([])
      return
    }
    const rows = await fetchFriendlySessionMatchLogs(friendlySessionId, courtSetupKeys)
    setLogs(rows)
    const nextScores = liveCourtScoresFromLogs(rows, scoreUnit)
    const nextFeeds = liveCourtFeedsFromLogs(rows, (log) => liveCourtScoreKeyFromSetupKey(log.courtSetupKey))
    setScores(nextScores)
    setFeeds(nextFeeds)
  }, [courtSetupKeys, friendlySessionId, scoreUnit])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!friendlySessionId) return
    const channel = supabase
      .channel(`friendly-court-scores-${friendlySessionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'match_gesture_logs',
          filter: `friendly_session_id=eq.${friendlySessionId}`,
        },
        () => void refresh(),
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [friendlySessionId, refresh])

  useEffect(() => {
    if (!pollMs || !friendlySessionId) return
    const timer = window.setInterval(() => void refresh(), pollMs)
    return () => window.clearInterval(timer)
  }, [friendlySessionId, pollMs, refresh])

  return { scores, feeds, logs, refresh }
}
