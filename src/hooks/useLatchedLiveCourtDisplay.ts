import { useMemo, useRef } from 'react'
import {
  latchLiveCourtFeeds,
  latchLiveCourtGamesScores,
  mergeEphemeralLiveCourtFeeds,
  mergeEphemeralLiveCourtScores,
  type LiveCourtGamesScore,
  type LiveCourtPointFeed,
} from '../lib/liveCourtScore'
import type { AmericanoScoringUnit } from '../lib/competitionPresets'
import type { TennisScore } from '../lib/tennisScore'

/**
 * Court card display: latch DB reads so they never rewind, then overlay ephemeral
 * scorer broadcasts (including undo) as the live source of truth.
 */
export function useLatchedLiveCourtDisplay(
  dbFeeds: Map<string, LiveCourtPointFeed>,
  dbScores: Map<string, LiveCourtGamesScore>,
  ephemeralScores: Map<string, TennisScore>,
  courtIdToLabel?: Map<string, string>,
  scoreUnit: AmericanoScoringUnit = 'games',
) {
  const latchedFeedsRef = useRef<Map<string, LiveCourtPointFeed>>(new Map())
  const latchedScoresRef = useRef<Map<string, LiveCourtGamesScore>>(new Map())

  const feeds = useMemo(() => {
    const dbLatched = latchLiveCourtFeeds(latchedFeedsRef.current, dbFeeds)
    const merged = mergeEphemeralLiveCourtFeeds(dbLatched, ephemeralScores, courtIdToLabel)
    latchedFeedsRef.current = merged
    return merged
  }, [courtIdToLabel, dbFeeds, ephemeralScores])

  const scores = useMemo(() => {
    const dbLatched = latchLiveCourtGamesScores(latchedScoresRef.current, dbScores)
    const merged = mergeEphemeralLiveCourtScores(dbLatched, ephemeralScores, courtIdToLabel, scoreUnit)
    latchedScoresRef.current = merged
    return merged
  }, [courtIdToLabel, dbScores, ephemeralScores, scoreUnit])

  return { feeds, scores }
}
