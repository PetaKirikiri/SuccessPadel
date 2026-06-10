import { useCallback, useEffect, useRef } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../lib/supabaseClient'
import type { NormalizedPoint, Quadrant } from '../lib/gestureCapture'
import type { PendingBallPathExchange } from '../lib/ballPathExchange'

/** Live ephemeral state shared between devices on the same court. */
export type CourtLiveEphemeral = {
  coins?: Partial<Record<Quadrant, NormalizedPoint>>
  pending?: PendingBallPathExchange | null
}

type Options = {
  enabled?: boolean
  /** Another device broadcast in-progress coin/exchange state. */
  onEphemeral?: (payload: CourtLiveEphemeral) => void
  /** The committed match log row changed (a point was scored, etc.). */
  onCommitted?: () => void
}

/**
 * Shared "live doc" channel for one court: a broadcast lane for ephemeral
 * coin/exchange state plus postgres_changes on the committed match log.
 */
export function useCourtLive(courtSetupKey: string | undefined, opts: Options) {
  const { enabled = true } = opts
  const channelRef = useRef<RealtimeChannel | null>(null)
  const onEphemeralRef = useRef(opts.onEphemeral)
  const onCommittedRef = useRef(opts.onCommitted)
  onEphemeralRef.current = opts.onEphemeral
  onCommittedRef.current = opts.onCommitted

  useEffect(() => {
    if (!courtSetupKey || !enabled) return
    const channel = supabase
      .channel(`court-live-${courtSetupKey}`, { config: { broadcast: { self: false } } })
      .on('broadcast', { event: 'ephemeral' }, ({ payload }) =>
        onEphemeralRef.current?.(payload as CourtLiveEphemeral),
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'match_gesture_logs',
          filter: `court_setup_key=eq.${courtSetupKey}`,
        },
        () => onCommittedRef.current?.(),
      )
      .subscribe()
    channelRef.current = channel
    return () => {
      channelRef.current = null
      void supabase.removeChannel(channel)
    }
  }, [courtSetupKey, enabled])

  const sendEphemeral = useCallback((payload: CourtLiveEphemeral) => {
    channelRef.current?.send({ type: 'broadcast', event: 'ephemeral', payload })
  }, [])

  return { sendEphemeral }
}
