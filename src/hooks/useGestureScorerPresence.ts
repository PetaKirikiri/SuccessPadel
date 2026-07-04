import { useEffect, useMemo, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../lib/supabaseClient'

type GestureScorerPresencePayload = {
  courtSetupKey: string
  userId?: string | null
  joinedAt: number
}

const CLIENT_KEY_STORAGE = 'sp-gesture-scorer-presence-key'

function scorerClientKey(): string {
  try {
    const existing = sessionStorage.getItem(CLIENT_KEY_STORAGE)
    if (existing) return existing
    const next = crypto.randomUUID()
    sessionStorage.setItem(CLIENT_KEY_STORAGE, next)
    return next
  } catch {
    return crypto.randomUUID()
  }
}

export function useGestureScorerPresence(
  scopeKey: string | undefined,
  courtSetupKey: string | undefined,
  userId?: string | null,
): Map<string, number> {
  const [counts, setCounts] = useState<Map<string, number>>(() => new Map())
  const clientKey = useMemo(() => scorerClientKey(), [])
  const channelRef = useRef<RealtimeChannel | null>(null)
  const subscribedRef = useRef(false)
  const currentPresenceRef = useRef<GestureScorerPresencePayload | null>(null)

  useEffect(() => {
    if (!scopeKey) {
      setCounts(new Map())
      return
    }

    const channel = supabase.channel(`gesture-scorers-${scopeKey}`, {
      config: { presence: { key: clientKey } },
    })
    channelRef.current = channel

    const readPresence = () => {
      const state = channel.presenceState() as Record<string, GestureScorerPresencePayload[]>
      const next = new Map<string, number>()
      for (const [presenceKey, entries] of Object.entries(state)) {
        if (presenceKey === clientKey) continue
        const latest = entries
          .filter((entry) => entry?.courtSetupKey)
          .sort((a, b) => (b.joinedAt ?? 0) - (a.joinedAt ?? 0))[0]
        if (!latest?.courtSetupKey) continue
        next.set(latest.courtSetupKey, (next.get(latest.courtSetupKey) ?? 0) + 1)
      }
      setCounts(next)
    }

    channel.on('presence', { event: 'sync' }, readPresence)
    channel.subscribe((status) => {
      subscribedRef.current = status === 'SUBSCRIBED'
      if (status !== 'SUBSCRIBED') return
      readPresence()
      if (currentPresenceRef.current) void channel.track(currentPresenceRef.current)
    })

    return () => {
      if (channelRef.current === channel) channelRef.current = null
      subscribedRef.current = false
      void channel.untrack()
      void supabase.removeChannel(channel)
    }
  }, [clientKey, scopeKey])

  useEffect(() => {
    if (!scopeKey || !courtSetupKey) return
    const payload = {
      courtSetupKey,
      userId: userId ?? null,
      joinedAt: Date.now(),
    } satisfies GestureScorerPresencePayload
    currentPresenceRef.current = payload
    const channel = channelRef.current
    if (!channel || !subscribedRef.current) return
    void channel.track(payload)
  }, [courtSetupKey, scopeKey, userId])

  return counts
}
