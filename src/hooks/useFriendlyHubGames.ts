import { useCallback, useEffect, useState } from 'react'
import type { FriendlyGameRecord } from '../lib/friendlyGames'
import { splitFriendlyGames } from '../lib/friendlyGames'
import { fetchFriendlyHomeGames } from '../lib/friendlyServer'
import { createHubListCache } from '../lib/hubListCache'

const cache = createHubListCache<FriendlyGameRecord[]>()

export function clearFriendlyHubCache(): void {
  cache.clear()
}

export function useFriendlyHubGames(enabled = true) {
  const [games, setGames] = useState<FriendlyGameRecord[]>(() => cache.read()?.data ?? [])
  const [loading, setLoading] = useState(enabled && !cache.read())
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!enabled) return
      if (!opts?.silent) setLoading(true)
      setError(null)
      try {
        const { games: remote, error: fetchError } = await fetchFriendlyHomeGames()
        const next = await cache.load(async () => remote, { force: true })
        setGames(next)
        setError(fetchError)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load games')
        setGames([])
      } finally {
        if (!opts?.silent) setLoading(false)
      }
    },
    [enabled],
  )

  useEffect(() => {
    if (!enabled) {
      setLoading(false)
      return
    }

    const cached = cache.read()
    if (cached) {
      setGames(cached.data)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    void (async () => {
      try {
        const { games: remote, error: fetchError } = await fetchFriendlyHomeGames()
        if (cancelled) return
        const next = await cache.load(async () => remote)
        if (cancelled) return
        setGames(next)
        setError(fetchError)
      } catch (e) {
        if (cancelled) return
        setError(e instanceof Error ? e.message : 'Failed to load games')
        setGames([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [enabled])

  return { games, loading, error, refresh }
}

export function useFriendlyHubGamesSplit(enabled = true) {
  const { games, loading, error, refresh } = useFriendlyHubGames(enabled)
  const { currentGames, pastGames } = splitFriendlyGames(games)
  return { currentGames, pastGames, games, loading, error, refresh }
}
