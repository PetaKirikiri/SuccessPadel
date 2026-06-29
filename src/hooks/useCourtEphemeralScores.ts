import { useEffect, useState } from 'react'
import type { CourtLiveEphemeral } from './useCourtLive'
import { supabase } from '../lib/supabaseClient'
import type { TennisScore } from '../lib/tennisScore'

/** Subscribes to optimistic score broadcasts from gesture scorers on each court channel. */
export function useCourtEphemeralScores(courtSetupKeys: string[]) {
  const [scores, setScores] = useState<Map<string, TennisScore>>(() => new Map())
  const keySig = courtSetupKeys.join('\0')

  useEffect(() => {
    if (!courtSetupKeys.length) {
      setScores(new Map())
      return
    }
    const channels = courtSetupKeys.map((courtSetupKey) =>
      supabase
        .channel(`court-live-${courtSetupKey}`, { config: { broadcast: { self: true } } })
        .on('broadcast', { event: 'ephemeral' }, ({ payload }) => {
          const score = (payload as CourtLiveEphemeral).scoreAfter
          if (!score) return
          setScores((prev) => {
            const next = new Map(prev)
            next.set(courtSetupKey, score)
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
