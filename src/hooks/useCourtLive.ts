import { useCallback, useEffect, useRef } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../lib/supabaseClient'
import type { NormalizedPoint, Quadrant } from '../lib/gestureCapture'
import type { PendingBallPathExchange } from '../lib/ballPathExchange'

import type { TennisScore } from '../lib/tennisScore'

/** Live ephemeral state shared between devices on the same court. */
export type CourtLiveEphemeral = {
  coins?: Partial<Record<Quadrant, NormalizedPoint>>
  pending?: PendingBallPathExchange | null
  /** Optimistic score from the gesture scorer — applied before DB round-trip. */
  scoreAfter?: TennisScore
  /** Explicit court-card routing from the gesture score navigator. */
  gameNumber?: number
  courtId?: string | null
  courtLabel?: string | null
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
  const channelKeyRef = useRef<string | null>(null)
  const activeKeyRef = useRef<string | null>(null)
  const subscribedRef = useRef(false)
  const pendingEphemeralRef = useRef<{ courtSetupKey: string; payload: CourtLiveEphemeral } | null>(
    null,
  )
  const onEphemeralRef = useRef(opts.onEphemeral)
  const onCommittedRef = useRef(opts.onCommitted)
  activeKeyRef.current = courtSetupKey && enabled ? courtSetupKey : null
  onEphemeralRef.current = opts.onEphemeral
  onCommittedRef.current = opts.onCommitted

  useEffect(() => {
    if (!courtSetupKey || !enabled) {
      channelRef.current = null
      channelKeyRef.current = null
      subscribedRef.current = false
      pendingEphemeralRef.current = null
      return
    }
    subscribedRef.current = false
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
    channelRef.current = channel
    channelKeyRef.current = courtSetupKey
    channel.subscribe((status) => {
      if (channelRef.current !== channel) return
      subscribedRef.current = status === 'SUBSCRIBED'
      if (!subscribedRef.current) return
      const pending = pendingEphemeralRef.current
      if (!pending || pending.courtSetupKey !== courtSetupKey) return
      pendingEphemeralRef.current = null
      void channel.send({ type: 'broadcast', event: 'ephemeral', payload: pending.payload })
    })
    return () => {
      if (channelRef.current === channel) channelRef.current = null
      if (channelKeyRef.current === courtSetupKey) channelKeyRef.current = null
      subscribedRef.current = false
      void supabase.removeChannel(channel)
    }
  }, [courtSetupKey, enabled])

  const sendEphemeral = useCallback((payload: CourtLiveEphemeral) => {
    const channel = channelRef.current
    const activeKey = activeKeyRef.current
    if (!channel || !subscribedRef.current || channelKeyRef.current !== activeKey) {
      if (activeKey) pendingEphemeralRef.current = { courtSetupKey: activeKey, payload }
      return
    }
    void channel.send({ type: 'broadcast', event: 'ephemeral', payload })
  }, [])

  return { sendEphemeral }
}
