import { useCallback, useEffect, useRef, useState } from 'react'
import type { AmericanoScoringUnit } from '../lib/competitionPresets'
import { mergeMatchGestureLogsByCourt } from '../lib/gestureCameraLocalCache'
import {
  latchLiveCourtFeeds,
  latchLiveCourtGamesScores,
  liveCourtFeedsFromLogs,
  liveCourtScoreKey,
  liveCourtScoresFromCompetitionLogs,
  type LiveCourtGamesScore,
  type LiveCourtPointFeed,
} from '../lib/liveCourtScore'
import type { MatchGestureLog } from '../lib/matchLogServer'
import type { GameLogGesture, GameLogPoint, GameLogRosterSlot } from '../lib/gameLogSerialize'
import type { MatchTeam } from '../lib/types'
import type { PlayerStatsSnapshot } from '../lib/matchSessionLog'
import type { TennisScore } from '../lib/tennisScore'
import type { GameLogSetupState } from '../lib/gameLogSetupState'
import { supabase } from '../lib/supabaseClient'

const RECEIVER_REALTIME_DEBOUNCE_MS = 500

function rowToLog(row: Record<string, unknown>): MatchGestureLog {
  return {
    courtSetupKey: String(row.court_setup_key),
    friendlySessionId: (row.friendly_session_id as string | null) ?? null,
    competitionId: (row.competition_id as string | null) ?? null,
    gameNumber: (row.game_number as string | null) ?? null,
    courtId: (row.court_id as string | null) ?? null,
    matchStartedAt: String(row.match_started_at),
    matchEndedAt: (row.match_ended_at as string | null) ?? null,
    finalScore: (row.final_score ?? null) as TennisScore | null,
    winner: (row.winner ?? null) as MatchTeam | null,
    playerStats: (row.player_stats ?? []) as PlayerStatsSnapshot[],
    pointEvents: (row.point_events ?? []) as GameLogPoint[],
    gestures: (row.gestures ?? []) as GameLogGesture[],
    roster: (row.roster ?? []) as GameLogRosterSlot[],
    setupState: (row.setup_state ?? null) as GameLogSetupState | null,
    updatedAt: (row.updated_at as string | null) ?? null,
  }
}

export function useCompetitionLiveCourtScores(
  competitionId: string | undefined,
  courtIdToLabel: Map<string, string>,
  scoreUnit: AmericanoScoringUnit = 'games',
  pollMs = 0,
) {
  const [scores, setScores] = useState<Map<string, LiveCourtGamesScore>>(() => new Map())
  const [feeds, setFeeds] = useState<Map<string, LiveCourtPointFeed>>(() => new Map())
  const [logs, setLogs] = useState<MatchGestureLog[]>([])
  const displayFeedsRef = useRef<Map<string, LiveCourtPointFeed>>(new Map())
  const displayScoresRef = useRef<Map<string, LiveCourtGamesScore>>(new Map())

  const applyDisplayFromLogs = useCallback(
    (merged: MatchGestureLog[]) => {
      const scoresMap = liveCourtScoresFromCompetitionLogs(merged, courtIdToLabel, scoreUnit)
      const feedsMap = liveCourtFeedsFromLogs(merged, (log) => {
        const gameNumber = log.gameNumber ? Number(log.gameNumber) : null
        if (gameNumber == null || !log.courtId) return null
        const courtLabel = courtIdToLabel.get(log.courtId) ?? log.courtId
        return liveCourtScoreKey(gameNumber, courtLabel)
      })
      for (const log of merged) {
        const gameNumber = log.gameNumber ? Number(log.gameNumber) : null
        if (gameNumber == null || !log.courtId) continue
        const label = courtIdToLabel.get(log.courtId)
        if (!label || label === log.courtId) continue
        const labelKey = liveCourtScoreKey(gameNumber, label)
        const idKey = liveCourtScoreKey(gameNumber, log.courtId)
        const feed = feedsMap.get(labelKey) ?? feedsMap.get(idKey)
        if (feed) {
          feedsMap.set(labelKey, feed)
          feedsMap.set(idKey, feed)
        }
        const score = scoresMap.get(labelKey) ?? scoresMap.get(idKey)
        if (score) {
          scoresMap.set(labelKey, score)
          scoresMap.set(idKey, score)
        }
      }
      const latchedFeeds = latchLiveCourtFeeds(displayFeedsRef.current, feedsMap)
      const latchedScores = latchLiveCourtGamesScores(displayScoresRef.current, scoresMap)
      displayFeedsRef.current = latchedFeeds
      displayScoresRef.current = latchedScores
      setScores(latchedScores)
      setFeeds(latchedFeeds)
    },
    [courtIdToLabel, scoreUnit],
  )

  const refresh = useCallback(async () => {
    if (!competitionId) {
      displayFeedsRef.current = new Map()
      displayScoresRef.current = new Map()
      setScores(new Map())
      setFeeds(new Map())
      setLogs([])
      return
    }
    const { data, error } = await supabase
      .from('match_gesture_logs')
      .select('*')
      .eq('competition_id', competitionId)

    if (error) {
      console.error('useCompetitionLiveCourtScores', error.message)
      return
    }
    const rows = (data ?? []).map((row) => rowToLog(row))
    setLogs((prev) => {
      const merged = mergeMatchGestureLogsByCourt(prev, rows)
      applyDisplayFromLogs(merged)
      return merged
    })
  }, [applyDisplayFromLogs, competitionId])

  const refreshRef = useRef(refresh)
  refreshRef.current = refresh

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!competitionId) return
    let timer: ReturnType<typeof setTimeout> | undefined
    const channel = supabase
      .channel(`competition-court-scores-${competitionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'match_gesture_logs',
          filter: `competition_id=eq.${competitionId}`,
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
  }, [competitionId])

  useEffect(() => {
    if (!pollMs || !competitionId) return
    const timer = window.setInterval(() => void refresh(), pollMs)
    return () => window.clearInterval(timer)
  }, [competitionId, pollMs, refresh])

  return { scores, feeds, logs, refresh }
}
