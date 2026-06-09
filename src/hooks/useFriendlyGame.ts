import { useCallback, useEffect, useState } from 'react'
import type { FriendlyGameRecord } from '../lib/friendlyGames'
import { isLocalFriendlyId } from '../lib/friendlyGames'
import { fetchFriendlySession } from '../lib/friendlyServer'

export function useFriendlyGame(id: string | undefined) {
  const [game, setGame] = useState<FriendlyGameRecord | null>(null)
  const [loading, setLoading] = useState(Boolean(id))

  const refresh = useCallback(async () => {
    if (!id) {
      setGame(null)
      setLoading(false)
      return
    }

    setLoading(true)
    if (isLocalFriendlyId(id)) {
      setGame(null)
      setLoading(false)
      return
    }

    const remote = await fetchFriendlySession(id)
    setGame(remote)
    setLoading(false)
  }, [id])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && id) void refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [id, refresh])

  return { game, loading, refresh }
}
