import { useCallback, useEffect, useState } from 'react'
import type { AmericanoScoringUnit } from '../lib/competitionPresets'
import {
  liveCourtScoresFromLogs,
  type LiveCourtGamesScore,
} from '../lib/liveCourtScore'
import type { MatchGestureLog } from '../lib/matchLogServer'
import type { GameLogGesture, GameLogPoint, GameLogRosterSlot } from '../lib/gameLogSerialize'
import type { MatchTeam } from '../lib/types'
import type { PlayerStatsSnapshot } from '../lib/matchSessionLog'
import type { TennisScore } from '../lib/tennisScore'
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
    setupState: (row.setup_state ?? null) as MatchGestureLog['setupState'],
    updatedAt: (row.updated_at as string | null) ?? null,
  }
}

export function useFriendlyLiveCourtScores(
  friendlySessionId: string | undefined,
  scoreUnit: AmericanoScoringUnit = 'games',
) {
  const [scores, setScores] = useState<Map<string, LiveCourtGamesScore>>(() => new Map())

  const refresh = useCallback(async () => {
    if (!friendlySessionId) {
      setScores(new Map())
      return
    }
    const { data, error } = await supabase
      .from('match_gesture_logs')
      .select('*')
      .eq('friendly_session_id', friendlySessionId)

    if (error) {
      console.error('useFriendlyLiveCourtScores', error.message)
      return
    }
    setScores(liveCourtScoresFromLogs((data ?? []).map((row) => rowToLog(row)), scoreUnit))
  }, [friendlySessionId, scoreUnit])

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

  return { scores, refresh }
}
