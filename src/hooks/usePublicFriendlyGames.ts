import { useCallback, useEffect, useState } from 'react'
import type { FriendlyGameRecord } from '../lib/friendlyGames'
import { clearFriendlyGamesCache } from '../lib/friendlyGames'
import { fetchFriendlyHomeGames } from '../lib/friendlyServer'

export function usePublicFriendlyGames() {
  const [games, setGames] = useState<FriendlyGameRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { games: remote, error: fetchError } = await fetchFriendlyHomeGames()
    setGames(remote)
    setError(fetchError)
    setLoading(false)
  }, [])

  useEffect(() => {
    clearFriendlyGamesCache()
    void refresh()
  }, [refresh])

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [refresh])

  return { games, loading, error, refresh }
}
