import { useCallback, useEffect, useState } from 'react'
import type { AmericanoScoringUnit } from '../lib/competitionPresets'
import {
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
) {
  const [scores, setScores] = useState<Map<string, LiveCourtGamesScore>>(() => new Map())
  const [feeds, setFeeds] = useState<Map<string, LiveCourtPointFeed>>(() => new Map())

  const refresh = useCallback(async () => {
    if (!competitionId) {
      setScores(new Map())
      setFeeds(new Map())
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
    const logs = (data ?? []).map((row) => rowToLog(row))
    const scoresMap = liveCourtScoresFromCompetitionLogs(logs, courtIdToLabel, scoreUnit)
    const feedsMap = liveCourtFeedsFromLogs(logs, (log) => {
      const gameNumber = log.gameNumber ? Number(log.gameNumber) : null
      if (gameNumber == null || !log.courtId) return null
      const courtLabel = courtIdToLabel.get(log.courtId) ?? log.courtId
      return liveCourtScoreKey(gameNumber, courtLabel)
    })
    for (const log of logs) {
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
    setScores(scoresMap)
    setFeeds(feedsMap)
  }, [competitionId, courtIdToLabel, scoreUnit])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!competitionId) return
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
        () => void refresh(),
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [competitionId, refresh])

  return { scores, feeds, refresh }
}
