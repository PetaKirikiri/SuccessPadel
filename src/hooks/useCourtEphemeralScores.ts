import { useEffect, useMemo, useState } from 'react'
import type { CourtLiveEphemeral } from './useCourtLive'
import { supabase } from '../lib/supabaseClient'
import type { TennisScore } from '../lib/tennisScore'
import { liveCourtScoreKey } from '../lib/liveCourtScore'

/** Subscribes to optimistic score broadcasts from gesture scorers on each court channel. */
export function useCourtEphemeralScores(courtSetupKeys: string[]) {
  const [scores, setScores] = useState<Map<string, TennisScore>>(() => new Map())
  const normalizedKeys = useMemo(
    () => [...new Set(courtSetupKeys)].sort(),
    [courtSetupKeys],
  )
  const keySig = normalizedKeys.join('\0')

  useEffect(() => {
    setScores(new Map())
    if (!normalizedKeys.length) {
      return
    }
    const channels = normalizedKeys.map((courtSetupKey) =>
      supabase
        .channel(`court-live-${courtSetupKey}`, { config: { broadcast: { self: true } } })
        .on('broadcast', { event: 'ephemeral' }, ({ payload }) => {
          const event = payload as CourtLiveEphemeral
          const score = event.scoreAfter
          if (!score) return
          setScores((prev) => {
            const next = new Map(prev)
            next.set(courtSetupKey, score)
            if (typeof event.gameNumber === 'number') {
              if (event.courtLabel) {
                next.set(liveCourtScoreKey(event.gameNumber, event.courtLabel), score)
              }
              if (event.courtId) {
                next.set(liveCourtScoreKey(event.gameNumber, event.courtId), score)
              }
            }
            return next
          })
        })
        .subscribe(),
    )
    return () => {
      for (const channel of channels) void supabase.removeChannel(channel)
    }
  }, [keySig])

  return scores
}
