import { useEffect, useMemo, useState } from 'react'
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

  useEffect(() => {
    if (!scopeKey || !courtSetupKey) {
      setCounts(new Map())
      return
    }

    const channel = supabase.channel(`gesture-scorers-${scopeKey}`, {
      config: { presence: { key: clientKey } },
    })

    const readPresence = () => {
      const state = channel.presenceState() as Record<string, GestureScorerPresencePayload[]>
      const next = new Map<string, number>()
      for (const entries of Object.values(state)) {
        for (const entry of entries) {
          if (!entry?.courtSetupKey) continue
          next.set(entry.courtSetupKey, (next.get(entry.courtSetupKey) ?? 0) + 1)
        }
      }
      setCounts(next)
    }

    channel.on('presence', { event: 'sync' }, readPresence)
    channel.subscribe((status) => {
      if (status !== 'SUBSCRIBED') return
      void channel.track({
        courtSetupKey,
        userId: userId ?? null,
        joinedAt: Date.now(),
      } satisfies GestureScorerPresencePayload)
    })

    return () => {
      void channel.untrack()
      void supabase.removeChannel(channel)
    }
  }, [clientKey, courtSetupKey, scopeKey, userId])

  return counts
}
