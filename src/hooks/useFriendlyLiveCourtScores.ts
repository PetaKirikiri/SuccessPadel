import { useCallback, useEffect, useRef, useState } from 'react'
import type { AmericanoScoringUnit } from '../lib/competitionPresets'
import { mergeMatchGestureLogsByCourt } from '../lib/gestureCameraLocalCache'
import {
  latchLiveCourtFeeds,
  latchLiveCourtGamesScores,
  liveCourtFeedsFromLogs,
  liveCourtScoresFromLogs,
  liveCourtScoreKeyFromSetupKey,
  type LiveCourtGamesScore,
  type LiveCourtPointFeed,
} from '../lib/liveCourtScore'
import { fetchFriendlySessionMatchLogs, type MatchGestureLog } from '../lib/matchLogServer'
import { supabase } from '../lib/supabaseClient'
import { agentDebugIngest } from '../lib/debug/devDebug'

const RECEIVER_REALTIME_DEBOUNCE_MS = 500

export function useFriendlyLiveCourtScores(
  friendlySessionId: string | undefined,
  scoreUnit: AmericanoScoringUnit = 'games',
  pollMs = 0,
  courtSetupKeys: string[] = [],
) {
  const [scores, setScores] = useState<Map<string, LiveCourtGamesScore>>(() => new Map())
  const [feeds, setFeeds] = useState<Map<string, LiveCourtPointFeed>>(() => new Map())
  const [logs, setLogs] = useState<MatchGestureLog[]>([])
  const displayFeedsRef = useRef<Map<string, LiveCourtPointFeed>>(new Map())
  const displayScoresRef = useRef<Map<string, LiveCourtGamesScore>>(new Map())

  const applyDisplayFromLogs = useCallback(
    (merged: MatchGestureLog[]) => {
      const nextFeeds = liveCourtFeedsFromLogs(merged, (log) =>
        liveCourtScoreKeyFromSetupKey(log.courtSetupKey),
      )
      const nextScores = liveCourtScoresFromLogs(merged, scoreUnit)
      const latchedFeeds = latchLiveCourtFeeds(displayFeedsRef.current, nextFeeds)
      const latchedScores = latchLiveCourtGamesScores(displayScoresRef.current, nextScores)
      displayFeedsRef.current = latchedFeeds
      displayScoresRef.current = latchedScores
      setFeeds(latchedFeeds)
      setScores(latchedScores)
    },
    [scoreUnit],
  )

  const refresh = useCallback(async () => {
    if (!friendlySessionId) {
      displayFeedsRef.current = new Map()
      displayScoresRef.current = new Map()
      setScores(new Map())
      setFeeds(new Map())
      setLogs([])
      return
    }
    const rows = await fetchFriendlySessionMatchLogs(friendlySessionId, courtSetupKeys)
    setLogs((prev) => {
      const merged = mergeMatchGestureLogsByCourt(prev, rows)
      applyDisplayFromLogs(merged)
      return merged
    })
  }, [applyDisplayFromLogs, courtSetupKeys, friendlySessionId])

  const refreshRef = useRef(refresh)
  refreshRef.current = refresh

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!friendlySessionId) return
    let timer: ReturnType<typeof setTimeout> | undefined
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
        () => {
          if (timer) clearTimeout(timer)
          timer = setTimeout(() => void refreshRef.current(), RECEIVER_REALTIME_DEBOUNCE_MS)
        },
      )
      .subscribe()
    return () => {
      if (timer) clearTimeout(timer)
      void supabase.removeChannel(channel)
    }
  }, [friendlySessionId])

  useEffect(() => {
    if (!pollMs || !friendlySessionId) return
    const timer = window.setInterval(() => void refresh(), pollMs)
    return () => window.clearInterval(timer)
  }, [friendlySessionId, pollMs, refresh])

  const applyGestureLog = useCallback(
    (log: MatchGestureLog) => {
      setLogs((prev) => {
        const merged = mergeMatchGestureLogsByCourt(prev, [log])
        const chosen = merged.find((row) => row.courtSetupKey === log.courtSetupKey)
        // #region agent log
        agentDebugIngest(
          'useFriendlyLiveCourtScores.ts:applyGestureLog',
          'merged log for court',
          {
            incomingFinal: log.finalScore,
            chosenFinal: chosen?.finalScore ?? null,
            prevCount: prev.length,
            mergedCount: merged.length,
            incomingEvents: log.pointEvents.length,
            chosenEvents: chosen?.pointEvents.length ?? 0,
          },
          'E',
          '5d6061',
        )
        // #endregion
        applyDisplayFromLogs(merged)
        return merged
      })
    },
    [applyDisplayFromLogs],
  )

  return { scores, feeds, logs, refresh, applyGestureLog }
}
